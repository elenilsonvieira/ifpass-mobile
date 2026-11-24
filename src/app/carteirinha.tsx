import React, { useEffect, useRef, useState } from 'react';
import type { AudioPlayer } from 'expo-audio';
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Magnetometer } from 'expo-sensors';

import StudentCard from '../components/StudentCard';
import NfcStatusCard from '../components/NfcStatusCard';
import { Estudante } from '../types/Estudante';
import { buscarDadosEstudante } from '../service/VisualizarDadosEstudante';
import { NfcSyncBus, type MensagemNFC } from '../service/nfcSync';

type StatusAcesso =
  | 'ocioso'
  | 'aguardando_aproximacao'
  | 'enviando_para_catraca'
  | 'liberado'
  | 'negado'
  | 'sem_resposta';

const INSTITUICAO_PADRAO =
  'Instituto Federal da Paraíba (IFPB) - Campus Guarabira';

// Limiar de variação da magnitude escalar do campo magnético (|B| = sqrt(x²+y²+z²)).
// A magnitude escalar NÃO altera ao inclinar, girar ou andar com o celular — só dispara
// quando outro celular (iPhone/Android) aproxima-se a poucos centímetros!
const LIMIAR_PROXIMIDADE_MAGNETICA_UT = 18;
const LEITURAS_CONSECUTIVAS_NECESSARIAS = 2;

export default function CarteirinhaScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ matricula?: string }>();

  const [estudante, setEstudante] = useState<Estudante | null>(null);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [status, setStatus] = useState<StatusAcesso>('ocioso');
  const [motivoNegado, setMotivoNegado] = useState<string>('');
  const [horarioResposta, setHorarioResposta] = useState<string>('');
  const [catracaOnline, setCatracaOnline] = useState<boolean>(false);
  const [campoDeltaUt, setCampoDeltaUt] = useState<number>(0);

  const playerRef = useRef<AudioPlayer | null>(null);
  const syncBusRef = useRef<NfcSyncBus | null>(null);
  const magSubRef = useRef<ReturnType<typeof Magnetometer.addListener> | null>(
    null
  );

  const estudanteRef = useRef<Estudante | null>(null);
  const statusRef = useRef<StatusAcesso>('ocioso');
  const activeRequestIdRef = useRef<string | null>(null);
  const lastCatracaSeenRef = useRef<number>(0);
  const retryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs do calibrador magnético escalar (imune a movimento/rotação)
  const amostrasBaseRef = useRef<number[]>([]);
  const baseMagRef = useRef<number | null>(null);
  const picosConsecutivosRef = useRef<number>(0);

  function atualizarStatus(novo: StatusAcesso) {
    statusRef.current = novo;
    setStatus(novo);
  }

  function pararSensorProximidade() {
    magSubRef.current?.remove();
    magSubRef.current = null;
    amostrasBaseRef.current = [];
    baseMagRef.current = null;
    picosConsecutivosRef.current = 0;
    setCampoDeltaUt(0);
  }

  function limparTimersRede() {
    if (retryTimerRef.current) {
      clearInterval(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (timeoutTimerRef.current) {
      clearTimeout(timeoutTimerRef.current);
      timeoutTimerRef.current = null;
    }
  }

  async function dispararFeedback(liberado: boolean) {
    try {
      const [Audio, Haptics] = await Promise.all([
        import('expo-audio'),
        import('expo-haptics'),
      ]);

      // Garante reprodução de áudio no iPhone mesmo com a chave lateral no silencioso
      if (typeof Audio.setAudioModeAsync === 'function') {
        await Audio.setAudioModeAsync({ playsInSilentMode: true });
      }

      if (!playerRef.current) {
        playerRef.current = Audio.createAudioPlayer(
          require('../../assets/beep_acesso.wav')
        );
      }

      await playerRef.current.seekTo(0);
      playerRef.current.play();

      if (liberado) {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );
        Vibration.vibrate(700);
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Vibration.vibrate([150, 100, 150, 100, 400]);
      }
    } catch (error) {
      console.warn('Erro ao emitir feedback sonoro/tátil:', error);
    }
  }

  // Envia a matrícula via canal NFC para a Catraca e aguarda a resposta real dela
  function enviarCredencialParaCatraca(requestIdForcado?: string) {
    const alunoAtual = estudanteRef.current;
    if (!alunoAtual) return;
    if (statusRef.current === 'enviando_para_catraca') return;

    pararSensorProximidade();
    limparTimersRede();

    const requestId =
      requestIdForcado ||
      activeRequestIdRef.current ||
      `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    activeRequestIdRef.current = requestId;

    atualizarStatus('enviando_para_catraca');
    Vibration.vibrate(60);

    const credencial = {
      nome: alunoAtual.nome,
      matricula: alunoAtual.matricula,
      curso: alunoAtual.curso,
      instituicao: INSTITUICAO_PADRAO,
    };

    const transmitir = () => {
      if (
        !activeRequestIdRef.current ||
        activeRequestIdRef.current !== requestId
      ) {
        return;
      }
      syncBusRef.current?.publish({
        type: 'NFC_SEND_CREDENTIAL',
        requestId,
        aluno: credencial,
      });
    };

    transmitir();
    retryTimerRef.current = setInterval(transmitir, 900);

    timeoutTimerRef.current = setTimeout(() => {
      if (activeRequestIdRef.current === requestId) {
        limparTimersRede();
        activeRequestIdRef.current = null;
        atualizarStatus('sem_resposta');
      }
    }, 12000);
  }

  async function handleMensagemDaCatraca(msg: MensagemNFC) {
    if (msg.type === 'CATRACA_HEARTBEAT') {
      lastCatracaSeenRef.current = Date.now();
      setCatracaOnline(true);
      return;
    }

    if (msg.type === 'SYSTEM_RESET') {
      pararSensorProximidade();
      limparTimersRede();
      activeRequestIdRef.current = null;
      setMotivoNegado('');
      setHorarioResposta('');
      atualizarStatus('ocioso');
      return;
    }

    // Se a Catraca (parada) detectou a aproximação física do celular do usuário enquanto o detector estava ativo
    if (
      msg.type === 'CATRACA_PROXIMITY_TRIGGER' &&
      statusRef.current === 'aguardando_aproximacao' &&
      activeRequestIdRef.current &&
      msg.requestId === activeRequestIdRef.current
    ) {
      enviarCredencialParaCatraca(msg.requestId);
      return;
    }

    // Resposta definitiva vinda da Catraca (Liberado ou Recusado)
    if (
      msg.type === 'CATRACA_DECISION' &&
      activeRequestIdRef.current &&
      msg.requestId === activeRequestIdRef.current
    ) {
      lastCatracaSeenRef.current = Date.now();
      setCatracaOnline(true);
      pararSensorProximidade();
      limparTimersRede();
      activeRequestIdRef.current = null;
      setHorarioResposta(msg.horario || new Date().toLocaleTimeString('pt-BR'));

      if (msg.resultado === 'liberado') {
        setMotivoNegado('');
        atualizarStatus('liberado');
        await dispararFeedback(true);
      } else {
        setMotivoNegado(msg.motivo || 'Entrada recusada pela catraca');
        atualizarStatus('negado');
        await dispararFeedback(false);
      }
    }
  }

  // Carrega dados do estudante (com a matrícula vinda da tela de login)
  useEffect(() => {
    async function carregarDados() {
      try {
        const matriculaParam =
          typeof params.matricula === 'string' ? params.matricula : undefined;
        const dados = await buscarDadosEstudante(matriculaParam);
        setEstudante(dados);
        estudanteRef.current = dados;
      } catch (error) {
        console.error('Erro ao buscar dados do estudante:', error);
      } finally {
        setCarregando(false);
      }
    }
    carregarDados();
  }, [params.matricula]);

  // Inicializa o barramento NFC em tempo real com o 2º celular (Catraca)
  useEffect(() => {
    const bus = new NfcSyncBus('usuario', (msg) => {
      handleMensagemDaCatraca(msg);
    });
    bus.start();
    syncBusRef.current = bus;

    const pingInicial = setTimeout(() => {
      bus.publish({ type: 'ALUNO_PING' });
    }, 500);

    const checkCatraca = setInterval(() => {
      bus.publish({ type: 'ALUNO_PING' });
      if (Date.now() - lastCatracaSeenRef.current > 8000) {
        setCatracaOnline(false);
      }
    }, 3500);

    return () => {
      clearTimeout(pingInicial);
      clearInterval(checkCatraca);
      pararSensorProximidade();
      limparTimersRede();
      bus.publish({ type: 'NFC_DISARMED' });
      bus.stop();
      playerRef.current?.release();
      playerRef.current = null;
    };
  }, []);

  /* =========================================================================
   * ATIVAR DETECTOR NFC (DIRETO NA TELA DA CARTEIRINHA):
   * - Não libera ao clicar e NÃO usa sensor de movimento (Accelerometer).
   * - Usa magnitude escalar do campo magnético (|B|) para detectar quando
   *   você aproxima fisicamente este celular do outro celular (Catraca).
   * - Ao aproximar, envia a matrícula para a Catraca e aguarda a resposta!
   * ========================================================================= */
  async function ativarDetectorNFC() {
    if (
      statusRef.current === 'aguardando_aproximacao' ||
      statusRef.current === 'enviando_para_catraca'
    ) {
      reiniciar();
      return;
    }

    const alunoAtual = estudanteRef.current;
    if (!alunoAtual) return;

    pararSensorProximidade();
    limparTimersRede();

    const requestId = `nfc_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 6)}`;
    activeRequestIdRef.current = requestId;
    setMotivoNegado('');
    setHorarioResposta('');
    atualizarStatus('aguardando_aproximacao');

    // Avisa a Catraca que este usuário ativou o detector NFC e está pronto para encostar
    syncBusRef.current?.publish({
      type: 'NFC_ARMED',
      requestId,
      aluno: {
        nome: alunoAtual.nome,
        matricula: alunoAtual.matricula,
        curso: alunoAtual.curso,
        instituicao: INSTITUICAO_PADRAO,
      },
    });

    try {
      const magDisponivel = await Magnetometer.isAvailableAsync();
      if (!magDisponivel) {
        return;
      }

      Magnetometer.setUpdateInterval(80);
      magSubRef.current = Magnetometer.addListener(({ x, y, z }) => {
        if (statusRef.current !== 'aguardando_aproximacao') return;

        // Magnitude escalar |B| = sqrt(x² + y² + z²): constante mesmo girando/movendo o celular no ar!
        const mag = Math.sqrt(x * x + y * y + z * z);

        if (baseMagRef.current === null) {
          amostrasBaseRef.current.push(mag);
          if (amostrasBaseRef.current.length >= 5) {
            const soma = amostrasBaseRef.current.reduce((acc, v) => acc + v, 0);
            baseMagRef.current = soma / amostrasBaseRef.current.length;
          }
          return;
        }

        const delta = Math.abs(mag - baseMagRef.current);
        setCampoDeltaUt(delta);

        if (delta >= LIMIAR_PROXIMIDADE_MAGNETICA_UT) {
          picosConsecutivosRef.current += 1;
          if (
            picosConsecutivosRef.current >= LEITURAS_CONSECUTIVAS_NECESSARIAS
          ) {
            // Aproximação física entre os 2 celulares detectada! Envia a matrícula para a Catraca!
            enviarCredencialParaCatraca(requestId);
          }
        } else {
          picosConsecutivosRef.current = 0;
          // Adaptação suave apenas para pequenas variações ambientais (< 8 µT)
          if (delta < 8) {
            baseMagRef.current = baseMagRef.current * 0.96 + mag * 0.04;
          }
        }
      });
    } catch (error) {
      console.warn('Magnetômetro indisponível:', error);
    }
  }

  function reiniciar() {
    pararSensorProximidade();
    limparTimersRede();
    activeRequestIdRef.current = null;
    setMotivoNegado('');
    setHorarioResposta('');
    atualizarStatus('ocioso');
    syncBusRef.current?.publish({ type: 'NFC_DISARMED' });
  }

  function sair() {
    reiniciar();
    router.replace('/login');
  }

  const detectorAtivo = status === 'aguardando_aproximacao';
  const enviando = status === 'enviando_para_catraca';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.container}>
        {/* Cabeçalho */}
        <View style={styles.headerRow}>
          <View style={{ width: 52 }} />
          <Text style={styles.tituloHeader}>IFPASS</Text>
          <TouchableOpacity onPress={sair} style={styles.botaoSair}>
            <Text style={styles.textoSair}>Sair</Text>
          </TouchableOpacity>
        </View>

        {carregando ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2E7D32" />
            <Text style={styles.loadingText}>
              Carregando dados da carteirinha...
            </Text>
          </View>
        ) : estudante ? (
          <>
            {/* Carteirinha Estudantil */}
            <StudentCard {...estudante} />

            {/* Status do Sensor NFC + Conexão com a Catraca */}
            <NfcStatusCard
              catracaOnline={catracaOnline}
              detectorAtivo={detectorAtivo}
              campoDeltaUt={campoDeltaUt}
            />

            {/* Bloco de Feedback de Acesso da Catraca */}
            <View
              style={[
                styles.statusCard,
                status === 'aguardando_aproximacao' && styles.statusCardAtivo,
                status === 'liberado' && styles.statusCardLiberado,
                status === 'negado' && styles.statusCardNegado,
              ]}
            >
              <View style={styles.statusLinha}>
                <View
                  style={[
                    styles.indicador,
                    detectorAtivo && styles.indicadorAtivo,
                    enviando && styles.indicadorEnviando,
                    status === 'liberado' && styles.indicadorLiberado,
                    status === 'negado' && styles.indicadorNegado,
                    status === 'sem_resposta' && styles.indicadorAlerta,
                  ]}
                />
                <Text
                  style={[
                    styles.statusTexto,
                    detectorAtivo && styles.textoAzul,
                    enviando && styles.textoAzul,
                    status === 'liberado' && styles.textoVerde,
                    status === 'negado' && styles.textoVermelho,
                    status === 'sem_resposta' && styles.textoAlerta,
                  ]}
                >
                  {status === 'ocioso' && 'Pronto para detectar acesso'}
                  {status === 'aguardando_aproximacao' &&
                    'Aproxime o celular da Catraca'}
                  {status === 'enviando_para_catraca' &&
                    'Aguardando resposta da Catraca...'}
                  {status === 'liberado' && 'Acesso Liberado'}
                  {status === 'negado' && 'Acesso Recusado'}
                  {status === 'sem_resposta' && 'Catraca não respondeu'}
                </Text>
                {enviando && (
                  <ActivityIndicator
                    size="small"
                    color="#2563EB"
                    style={{ marginLeft: 6 }}
                  />
                )}
              </View>

              {status === 'negado' && motivoNegado !== '' && (
                <Text style={styles.motivoTexto}>{motivoNegado}</Text>
              )}

              {(status === 'liberado' || status === 'negado') &&
                horarioResposta !== '' && (
                  <Text style={styles.horarioTexto}>
                    Confirmado pela catraca às {horarioResposta}
                  </Text>
                )}
            </View>

            {/* Botão Principal na própria tela da Carteirinha */}
            <View style={styles.acoesContainer}>
              <TouchableOpacity
                style={[
                  styles.botaoPrincipal,
                  detectorAtivo && styles.botaoAtivo,
                  enviando && styles.botaoEnviando,
                  status === 'liberado' && styles.botaoLiberado,
                  status === 'negado' && styles.botaoNegado,
                ]}
                onPress={ativarDetectorNFC}
                activeOpacity={0.85}
              >
                <Text style={styles.botaoTexto}>
                  {status === 'ocioso' && 'Detectar Acesso (NFC)'}
                  {status === 'aguardando_aproximacao' &&
                    'Aproxime da Catraca... (Cancelar)'}
                  {status === 'enviando_para_catraca' &&
                    'Validando matrícula na Catraca...'}
                  {status === 'liberado' && 'Detectar Novo Acesso'}
                  {status === 'negado' && 'Tentar Novamente'}
                  {status === 'sem_resposta' && 'Tentar Novamente'}
                </Text>
              </TouchableOpacity>

              {detectorAtivo && (
                <TouchableOpacity
                  style={styles.botaoManual}
                  onPress={() => enviarCredencialParaCatraca()}
                  activeOpacity={0.7}
                >
                  <Text style={styles.botaoManualTexto}>
                    Enviar matrícula agora (fallback sem proximidade magnética)
                  </Text>
                </TouchableOpacity>
              )}

              {status !== 'ocioso' && (
                <TouchableOpacity
                  style={styles.botaoReset}
                  onPress={reiniciar}
                  activeOpacity={0.7}
                >
                  <Text style={styles.resetTexto}>Reiniciar</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        ) : (
          <Text style={styles.erroText}>
            Não foi possível carregar os dados.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F4F6F8',
  },
  container: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  tituloHeader: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2E7D32',
    textAlign: 'center',
  },
  botaoSair: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  textoSair: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 10,
    color: '#555',
    fontSize: 14,
  },
  erroText: {
    textAlign: 'center',
    color: '#D93025',
    marginTop: 20,
    fontSize: 14,
  },

  /* Status */
  statusCard: {
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  statusCardAtivo: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD',
  },
  statusCardLiberado: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  statusCardNegado: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
  },
  statusLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  indicador: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#94A3B8',
  },
  indicadorAtivo: {
    backgroundColor: '#2563EB',
  },
  indicadorEnviando: {
    backgroundColor: '#2563EB',
  },
  indicadorLiberado: {
    backgroundColor: '#16A34A',
  },
  indicadorNegado: {
    backgroundColor: '#DC2626',
  },
  indicadorAlerta: {
    backgroundColor: '#F59E0B',
  },
  statusTexto: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
  },
  textoAzul: {
    color: '#1D4ED8',
  },
  textoVerde: {
    color: '#15803D',
  },
  textoVermelho: {
    color: '#B91C1C',
  },
  textoAlerta: {
    color: '#B45309',
  },
  motivoTexto: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },
  horarioTexto: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
  },

  /* Ações */
  acoesContainer: {
    marginTop: 18,
    gap: 10,
  },
  botaoPrincipal: {
    backgroundColor: '#2E7D32',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  botaoAtivo: {
    backgroundColor: '#2563EB',
  },
  botaoEnviando: {
    backgroundColor: '#1D4ED8',
  },
  botaoLiberado: {
    backgroundColor: '#16A34A',
  },
  botaoNegado: {
    backgroundColor: '#DC2626',
  },
  botaoTexto: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  botaoManual: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
  },
  botaoManualTexto: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  botaoReset: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  resetTexto: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
});
