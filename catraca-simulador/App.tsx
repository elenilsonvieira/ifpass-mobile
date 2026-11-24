import React, { useEffect, useRef, useState } from 'react';
import type { AudioPlayer } from 'expo-audio';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Magnetometer } from 'expo-sensors';
import {
  NfcSyncBus,
  type CredencialAluno,
  type MensagemNFC,
} from './nfcSync';

type EstadoCatraca = 'aguardando' | 'lendo' | 'liberado' | 'negado';
type ModoCatraca = 'liberar' | 'recusar';

interface RegistroPassagem {
  id: string;
  horario: string;
  matricula: string;
  nome: string;
  resultado: 'liberado' | 'negado';
}

const LIMIAR_PROXIMIDADE_CATRACA_UT = 14;
const LEITURAS_CONSECUTIVAS = 2;

function vibrarSeguro(padrao: number | number[]) {
  if (Platform.OS === 'web') {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(padrao);
      }
    } catch {}
    return;
  }
  try {
    Vibration.vibrate(padrao);
  } catch {}
}

function tocarBeepWebFallback(liberado: boolean) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    const AudioCtx =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = liberado ? 'sine' : 'sawtooth';
    osc.frequency.setValueAtTime(liberado ? 880 : 220, ctx.currentTime);
    if (liberado) {
      osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.12);
    }
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {}
}

export default function App() {
  const [estado, setEstado] = useState<EstadoCatraca>('aguardando');
  const [modo, setModo] = useState<ModoCatraca>('liberar');
  const [conectado, setConectado] = useState<boolean>(false);
  const [usuarioArmado, setUsuarioArmado] = useState<boolean>(false);
  const [alunoArmadoInfo, setAlunoArmadoInfo] =
    useState<CredencialAluno | null>(null);
  const [horarioAtual, setHorarioAtual] = useState<string>('');
  const [campoDeltaUt, setCampoDeltaUt] = useState<number>(0);
  const [credencialRecebida, setCredencialRecebida] =
    useState<CredencialAluno | null>(null);
  const [motivoRecusa, setMotivoRecusa] = useState<string>('');
  const [historico, setHistorico] = useState<RegistroPassagem[]>([]);

  const playerRef = useRef<AudioPlayer | null>(null);
  const syncBusRef = useRef<NfcSyncBus | null>(null);
  const modoRef = useRef<ModoCatraca>('liberar');
  const estadoRef = useRef<EstadoCatraca>('aguardando');
  const autoResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const usuarioArmadoRef = useRef<{
    requestId: string;
    aluno: CredencialAluno;
  } | null>(null);

  const decisoesCacheRef = useRef<
    Map<
      string,
      {
        resultado: 'liberado' | 'negado';
        motivo?: string;
        horario: string;
        matricula: string;
      }
    >
  >(new Map());
  const processandoIdsRef = useRef<Set<string>>(new Set());

  const amostrasBaseRef = useRef<number[]>([]);
  const baseMagRef = useRef<number | null>(null);
  const picosConsecutivosRef = useRef<number>(0);

  function atualizarEstado(novo: EstadoCatraca) {
    estadoRef.current = novo;
    setEstado(novo);
  }

  function atualizarModo(novoModo: ModoCatraca) {
    modoRef.current = novoModo;
    setModo(novoModo);
    syncBusRef.current?.publish({
      type: 'CATRACA_HEARTBEAT',
      modo: novoModo,
    });
  }

  async function emitirFeedbackCatraca(liberado: boolean) {
    tocarBeepWebFallback(liberado);

    try {
      const Audio = await import('expo-audio');
      if (typeof Audio.setAudioModeAsync === 'function' && Platform.OS !== 'web') {
        await Audio.setAudioModeAsync({ playsInSilentMode: true });
      }

      if (!playerRef.current) {
        playerRef.current = Audio.createAudioPlayer(
          require('./assets/beep_acesso.wav')
        );
      }

      await playerRef.current.seekTo(0);
      playerRef.current.play();
    } catch {}

    if (Platform.OS !== 'web') {
      try {
        const Haptics = await import('expo-haptics');
        if (liberado) {
          await Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success
          );
        } else {
          await Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Error
          );
        }
      } catch {}
    }

    vibrarSeguro(liberado ? 600 : [120, 100, 120, 100, 400]);
  }

  async function processarCredencialRecebida(
    requestId: string,
    aluno: CredencialAluno
  ) {
    const cache = decisoesCacheRef.current.get(requestId);
    if (cache) {
      syncBusRef.current?.publish({
        type: 'CATRACA_DECISION',
        requestId,
        matricula: cache.matricula,
        resultado: cache.resultado,
        motivo: cache.motivo,
        horario: cache.horario,
      });
      return;
    }

    if (processandoIdsRef.current.has(requestId)) {
      return;
    }
    processandoIdsRef.current.add(requestId);

    if (autoResetTimerRef.current) {
      clearTimeout(autoResetTimerRef.current);
      autoResetTimerRef.current = null;
    }

    usuarioArmadoRef.current = null;
    setUsuarioArmado(false);
    setAlunoArmadoInfo(null);
    setCredencialRecebida(aluno);
    atualizarEstado('lendo');
    vibrarSeguro(60);

    setTimeout(async () => {
      const agora = new Date().toLocaleTimeString('pt-BR');
      const matriculaValida = Boolean(
        aluno.matricula && aluno.matricula.trim().length > 0
      );
      const deveLiberar = matriculaValida && modoRef.current === 'liberar';

      const resultado: 'liberado' | 'negado' = deveLiberar
        ? 'liberado'
        : 'negado';
      const motivo = !matriculaValida
        ? 'Matrícula não identificada no sinal NFC'
        : modoRef.current === 'recusar'
        ? 'Entrada recusada pela catraca (matrícula bloqueada)'
        : undefined;

      decisoesCacheRef.current.set(requestId, {
        resultado,
        motivo,
        horario: agora,
        matricula: aluno.matricula,
      });
      processandoIdsRef.current.delete(requestId);

      const enviarResposta = () => {
        syncBusRef.current?.publish({
          type: 'CATRACA_DECISION',
          requestId,
          matricula: aluno.matricula,
          resultado,
          motivo,
          horario: agora,
        });
      };
      enviarResposta();
      setTimeout(enviarResposta, 250);

      if (resultado === 'liberado') {
        setMotivoRecusa('');
        atualizarEstado('liberado');
        await emitirFeedbackCatraca(true);
      } else {
        setMotivoRecusa(motivo || 'Acesso recusado');
        atualizarEstado('negado');
        await emitirFeedbackCatraca(false);
      }

      setHistorico((prev) => [
        {
          id: `${Date.now()}_${Math.random()}`,
          horario: agora,
          matricula: aluno.matricula || '---',
          nome: aluno.nome || 'Usuário',
          resultado,
        },
        ...prev.slice(0, 7),
      ]);

      autoResetTimerRef.current = setTimeout(() => {
        atualizarEstado('aguardando');
        setMotivoRecusa('');
        setCredencialRecebida(null);
      }, 4500);
    }, 450);
  }

  function handleMensagemRecebida(msg: MensagemNFC) {
    if (msg.type === 'ALUNO_PING') {
      syncBusRef.current?.publish({
        type: 'CATRACA_HEARTBEAT',
        modo: modoRef.current,
      });
      return;
    }

    if (msg.type === 'NFC_ARMED') {
      usuarioArmadoRef.current = {
        requestId: msg.requestId,
        aluno: msg.aluno,
      };
      setUsuarioArmado(true);
      setAlunoArmadoInfo(msg.aluno);
      return;
    }

    if (msg.type === 'NFC_DISARMED') {
      usuarioArmadoRef.current = null;
      setUsuarioArmado(false);
      setAlunoArmadoInfo(null);
      return;
    }

    if (msg.type === 'NFC_SEND_CREDENTIAL') {
      processarCredencialRecebida(msg.requestId, msg.aluno);
      return;
    }

    if (msg.type === 'SYSTEM_RESET') {
      reiniciarLocal();
    }
  }

  function acionarSensorNfcNaCatraca() {
    const armado = usuarioArmadoRef.current;
    if (!armado) return;
    syncBusRef.current?.publish({
      type: 'CATRACA_PROXIMITY_TRIGGER',
      requestId: armado.requestId,
    });
    processarCredencialRecebida(armado.requestId, armado.aluno);
  }

  useEffect(() => {
    setHorarioAtual(new Date().toLocaleTimeString('pt-BR'));
    const clock = setInterval(() => {
      setHorarioAtual(new Date().toLocaleTimeString('pt-BR'));
    }, 1000);

    const bus = new NfcSyncBus(
      'catraca',
      (msg) => {
        handleMensagemRecebida(msg);
      },
      (isConnected) => {
        setConectado(isConnected);
      }
    );
    bus.start();
    syncBusRef.current = bus;

    const hbInicial = setTimeout(() => {
      bus.publish({ type: 'CATRACA_HEARTBEAT', modo: modoRef.current });
    }, 500);

    const hbLoop = setInterval(() => {
      bus.publish({ type: 'CATRACA_HEARTBEAT', modo: modoRef.current });
    }, 2500);

    let magSub: ReturnType<typeof Magnetometer.addListener> | null = null;
    if (Platform.OS !== 'web') {
      Magnetometer.isAvailableAsync()
        .then((disponivel) => {
          if (!disponivel) return;
          Magnetometer.setUpdateInterval(80);
          magSub = Magnetometer.addListener(({ x, y, z }) => {
            const mag = Math.sqrt(x * x + y * y + z * z);

            if (baseMagRef.current === null) {
              amostrasBaseRef.current.push(mag);
              if (amostrasBaseRef.current.length >= 6) {
                const soma = amostrasBaseRef.current.reduce((a, b) => a + b, 0);
                baseMagRef.current = soma / amostrasBaseRef.current.length;
              }
              return;
            }

            const delta = Math.abs(mag - baseMagRef.current);
            setCampoDeltaUt(delta);

            const armado = usuarioArmadoRef.current;
            if (armado && estadoRef.current === 'aguardando') {
              if (delta >= LIMIAR_PROXIMIDADE_CATRACA_UT) {
                picosConsecutivosRef.current += 1;
                if (picosConsecutivosRef.current >= LEITURAS_CONSECUTIVAS) {
                  picosConsecutivosRef.current = 0;
                  syncBusRef.current?.publish({
                    type: 'CATRACA_PROXIMITY_TRIGGER',
                    requestId: armado.requestId,
                  });
                  processarCredencialRecebida(armado.requestId, armado.aluno);
                }
              } else {
                picosConsecutivosRef.current = 0;
                if (delta < 6) {
                  baseMagRef.current = baseMagRef.current * 0.96 + mag * 0.04;
                }
              }
            } else {
              picosConsecutivosRef.current = 0;
              if (delta < 8) {
                baseMagRef.current = baseMagRef.current * 0.95 + mag * 0.05;
              }
            }
          });
        })
        .catch(() => {});
    }

    return () => {
      clearInterval(clock);
      clearTimeout(hbInicial);
      clearInterval(hbLoop);
      if (autoResetTimerRef.current) clearTimeout(autoResetTimerRef.current);
      magSub?.remove();
      bus.stop();
      playerRef.current?.release();
      playerRef.current = null;
    };
  }, []);

  function reiniciarLocal() {
    if (autoResetTimerRef.current) {
      clearTimeout(autoResetTimerRef.current);
      autoResetTimerRef.current = null;
    }
    usuarioArmadoRef.current = null;
    setUsuarioArmado(false);
    setAlunoArmadoInfo(null);
    atualizarEstado('aguardando');
    setMotivoRecusa('');
    setCredencialRecebida(null);
  }

  function reiniciarTudo() {
    reiniciarLocal();
    syncBusRef.current?.publish({ type: 'SYSTEM_RESET' });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.wrapper}>
          {/* Cabeçalho */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerBrand}>CATRACA IFPB • GUARABIRA</Text>
              <Text style={styles.headerSubtitle}>
                Simulador de Leitor NFC (Expo Go & Web)
              </Text>
            </View>
            <View style={styles.clockBadge}>
              <View
                style={[
                  styles.ledConexao,
                  conectado ? styles.ledVerde : styles.ledAmarelo,
                ]}
              />
              <Text style={styles.clockTexto}>{horarioAtual || '--:--:--'}</Text>
            </View>
          </View>

          {/* Pill de Status de Sincronização */}
          <View
            style={[
              styles.statusRedePill,
              usuarioArmado && styles.statusRedePillArmado,
            ]}
          >
            <Text style={styles.statusRedeTexto}>
              {!conectado
                ? '🟡 Conectando ao canal NFC...'
                : usuarioArmado
                ? `🔵 Celular de ${alunoArmadoInfo?.nome || 'usuário'} (${alunoArmadoInfo?.matricula || ''}) pronto p/ aproximar!`
                : Platform.OS === 'web'
                ? '🟢 Catraca Web Online • Aguardando sinal NFC do celular do usuário'
                : `🟢 Catraca Online • Aguardando sinal NFC (Δ ${Math.round(campoDeltaUt)} µT)`}
            </Text>
          </View>

          {/* Display Central da Catraca */}
          <TouchableOpacity
            activeOpacity={usuarioArmado ? 0.8 : 1}
            onPress={acionarSensorNfcNaCatraca}
            style={[
              styles.displayTerminal,
              usuarioArmado &&
                estado === 'aguardando' &&
                styles.displayProntoParaReceber,
              estado === 'lendo' && styles.displayLendo,
              estado === 'liberado' && styles.displayLiberado,
              estado === 'negado' && styles.displayNegado,
            ]}
          >
            <View style={styles.displayHeader}>
              <Text style={styles.displayHeaderTexto}>
                {estado === 'aguardando' &&
                  (usuarioArmado
                    ? '📡 SINAL DO USUÁRIO ARMADO • APROXIME OU TOQUE NO SENSOR'
                    : '📶 AGUARDANDO SINAL NFC DO USUÁRIO')}
                {estado === 'lendo' && '📡 RECEBENDO MATRÍCULA VIA NFC...'}
                {estado === 'liberado' && '✅ CATRACA LIBERADA • PODE PASSAR'}
                {estado === 'negado' &&
                  '⛔ CATRACA BLOQUEADA • ENTRADA RECUSADA'}
              </Text>
              <View
                style={[
                  styles.ledDisplay,
                  estado === 'lendo' && styles.ledAzul,
                  estado === 'liberado' && styles.ledVerde,
                  estado === 'negado' && styles.ledVermelho,
                ]}
              />
            </View>

            <View style={styles.displayCorpo}>
              {estado === 'aguardando' && (
                <>
                  <View
                    style={[
                      styles.radarCirculo,
                      usuarioArmado && styles.radarCirculoAtivo,
                    ]}
                  >
                    <Text style={styles.radarEmoji}>📡</Text>
                  </View>
                  <Text style={styles.displayTitulo}>
                    {usuarioArmado
                      ? 'APROXIME O CELULAR AQUI'
                      : 'AGUARDANDO APROXIMAÇÃO'}
                  </Text>
                  <Text style={styles.displaySub}>
                    {usuarioArmado
                      ? `Aproxime o celular (${alunoArmadoInfo?.matricula}) ou toque aqui no sensor NFC da catraca`
                      : 'A catraca está aguardando o sinal NFC do celular do usuário'}
                  </Text>
                </>
              )}

              {estado === 'lendo' && (
                <>
                  <ActivityIndicator
                    size="large"
                    color="#60A5FA"
                    style={{ marginBottom: 12 }}
                  />
                  <Text style={styles.displayTitulo}>MATRÍCULA DETECTADA</Text>
                  <Text style={styles.displayMatricula}>
                    {credencialRecebida?.matricula}
                  </Text>
                  <Text style={styles.displaySub}>Validando acesso...</Text>
                </>
              )}

              {estado === 'liberado' && (
                <>
                  <Text style={styles.iconeResultado}>✅</Text>
                  <Text style={styles.tituloLiberado}>ENTRADA LIBERADA</Text>
                  <Text style={styles.labelRecebido}>
                    MATRÍCULA RECEBIDA VIA NFC:
                  </Text>
                  <Text style={styles.displayMatricula}>
                    {credencialRecebida?.matricula}
                  </Text>
                  <Text style={styles.displayNome}>
                    {credencialRecebida?.nome}
                  </Text>
                  <Text style={styles.displayCurso}>
                    {credencialRecebida?.curso}
                  </Text>
                </>
              )}

              {estado === 'negado' && (
                <>
                  <Text style={styles.iconeResultado}>⛔</Text>
                  <Text style={styles.tituloNegado}>ENTRADA RECUSADA</Text>
                  <Text style={styles.labelRecebido}>
                    MATRÍCULA RECEBIDA VIA NFC:
                  </Text>
                  <Text style={styles.displayMatricula}>
                    {credencialRecebida?.matricula}
                  </Text>
                  <Text style={styles.displayNome}>
                    {credencialRecebida?.nome}
                  </Text>
                  <Text style={styles.displayMotivo}>{motivoRecusa}</Text>
                </>
              )}
            </View>
          </TouchableOpacity>

          {/* Seletor de Decisão da Catraca (Liberar ou Recusar) */}
          <View style={styles.seletorCard}>
            <Text style={styles.seletorTitulo}>
              Comportamento da Catraca ao Receber a Matrícula:
            </Text>
            <View style={styles.seletorBotoes}>
              <TouchableOpacity
                style={[
                  styles.seletorBtn,
                  modo === 'liberar' && styles.seletorBtnLiberar,
                ]}
                onPress={() => atualizarModo('liberar')}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.seletorBtnTexto,
                    modo === 'liberar' && styles.seletorBtnTextoAtivo,
                  ]}
                >
                  ✅ Liberar Entrada
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.seletorBtn,
                  modo === 'recusar' && styles.seletorBtnRecusar,
                ]}
                onPress={() => atualizarModo('recusar')}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.seletorBtnTexto,
                    modo === 'recusar' && styles.seletorBtnTextoAtivo,
                  ]}
                >
                  ⛔ Recusar Entrada
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Botão de Reset */}
          <TouchableOpacity
            style={styles.botaoReset}
            onPress={reiniciarTudo}
            activeOpacity={0.75}
          >
            <Text style={styles.resetTexto}>
              ↺ Limpar Catraca e Aguardar Próximo Usuário
            </Text>
          </TouchableOpacity>

          {/* Histórico */}
          {historico.length > 0 && (
            <View style={styles.historicoCard}>
              <Text style={styles.historicoTitulo}>
                Últimas Matrículas Recebidas
              </Text>
              {historico.map((item) => (
                <View key={item.id} style={styles.historicoLinha}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historicoNome}>{item.nome}</Text>
                    <Text style={styles.historicoSub}>
                      Matrícula: {item.matricula} • {item.horario}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.tagStatus,
                      item.resultado === 'liberado'
                        ? styles.tagLiberado
                        : styles.tagNegado,
                    ]}
                  >
                    <Text style={styles.tagTexto}>
                      {item.resultado === 'liberado' ? 'LIBERADO' : 'RECUSADO'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 18,
    alignItems: 'center',
  },
  wrapper: {
    width: '100%',
    maxWidth: 480,
    alignItems: 'center',
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerBrand: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  clockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 6,
  },
  ledConexao: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  ledVerde: {
    backgroundColor: '#22C55E',
  },
  ledAmarelo: {
    backgroundColor: '#F59E0B',
  },
  ledAzul: {
    backgroundColor: '#60A5FA',
  },
  ledVermelho: {
    backgroundColor: '#EF4444',
  },
  clockTexto: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  statusRedePill: {
    width: '100%',
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  statusRedePillArmado: {
    backgroundColor: '#1E3A8A',
    borderColor: '#3B82F6',
  },
  statusRedeTexto: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },

  /* Display */
  displayTerminal: {
    width: '100%',
    backgroundColor: '#0F172A',
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#334155',
    padding: 20,
    marginBottom: 18,
    minHeight: 265,
    justifyContent: 'space-between',
  },
  displayProntoParaReceber: {
    borderColor: '#38BDF8',
    backgroundColor: '#0F2942',
  },
  displayLendo: {
    backgroundColor: '#1E3A8A',
    borderColor: '#3B82F6',
  },
  displayLiberado: {
    backgroundColor: '#065F46',
    borderColor: '#22C55E',
  },
  displayNegado: {
    backgroundColor: '#7F1D1D',
    borderColor: '#EF4444',
  },
  displayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.15)',
    paddingBottom: 8,
  },
  displayHeaderTexto: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    fontWeight: '700',
  },
  ledDisplay: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#38BDF8',
  },
  displayCorpo: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  radarCirculo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(56, 189, 248, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  radarCirculoAtivo: {
    backgroundColor: 'rgba(56, 189, 248, 0.28)',
    borderColor: '#38BDF8',
  },
  radarEmoji: {
    fontSize: 28,
  },
  iconeResultado: {
    fontSize: 40,
    marginBottom: 6,
  },
  displayTitulo: {
    color: '#38BDF8',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  tituloLiberado: {
    color: '#86EFAC',
    fontSize: 23,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
  },
  tituloNegado: {
    color: '#FCA5A5',
    fontSize: 23,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
  },
  labelRecebido: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  displayMatricula: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    fontFamily: 'monospace',
    marginTop: 2,
    marginBottom: 4,
  },
  displayNome: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  displayCurso: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    marginTop: 2,
  },
  displaySub: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
  },
  displayMotivo: {
    color: '#FECACA',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
  },

  /* Seletor */
  seletorCard: {
    width: '100%',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  seletorTitulo: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 10,
  },
  seletorBotoes: {
    flexDirection: 'row',
    gap: 10,
  },
  seletorBtn: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  seletorBtnLiberar: {
    backgroundColor: '#15803D',
    borderColor: '#22C55E',
  },
  seletorBtnRecusar: {
    backgroundColor: '#B91C1C',
    borderColor: '#EF4444',
  },
  seletorBtnTexto: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  seletorBtnTextoAtivo: {
    color: '#FFFFFF',
  },

  /* Reset */
  botaoReset: {
    width: '100%',
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 18,
  },
  resetTexto: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
  },

  /* Histórico */
  historicoCard: {
    width: '100%',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  historicoTitulo: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  historicoLinha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    gap: 8,
  },
  historicoNome: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
  },
  historicoSub: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
    fontFamily: 'monospace',
  },
  tagStatus: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagLiberado: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
  },
  tagNegado: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  tagTexto: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
