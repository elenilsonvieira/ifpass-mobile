
import { useEffect, useRef, useState } from 'react';
import type { AudioPlayer } from 'expo-audio';
import { Accelerometer } from 'expo-sensors';

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Vibration,
} from 'react-native';
export default function FeedbackAcesso() {
  const [detectado, setDetectado] = useState(false);
  const [monitorando, setMonitorando] = useState(false);

  const playerRef = useRef<AudioPlayer | null>(null);

  const sensorRef = useRef<
    ReturnType<typeof Accelerometer.addListener> | null
  >(null);

  const movimentoAnteriorRef = useRef<{
    x: number;
    y: number;
    z: number;
  } | null>(null);

  const processandoRef = useRef(false);
  const acessoConcluidoRef = useRef(false);

  useEffect(() => {
    return () => {
      sensorRef.current?.remove();
      playerRef.current?.release();

      sensorRef.current = null;
      playerRef.current = null;
    };
  }, []);

  async function detectarAcesso() {
    if (processandoRef.current || acessoConcluidoRef.current) {
      return;
    }

    processandoRef.current = true;
    setDetectado(true);

    try {
      const Audio = await import('expo-audio');

      if (!playerRef.current) {
        playerRef.current = Audio.createAudioPlayer(
          require('../../assets/beep_acesso.wav')
        );
      }

      await playerRef.current.seekTo(0);
      playerRef.current.play();

      Vibration.vibrate(1000);

    } catch (error) {
      console.error('Erro no feedback de acesso:', error);
    } finally {
      acessoConcluidoRef.current = true;
      processandoRef.current = false;
    }
  }

  async function ativarDetector() {
    if (monitorando) {
      sensorRef.current?.remove();
      sensorRef.current = null;

      movimentoAnteriorRef.current = null;
      setMonitorando(false);
      return;
    }

    try {
      const disponivel = await Accelerometer.isAvailableAsync();

      if (!disponivel) {
        return;
      }

      Accelerometer.setUpdateInterval(100);

      sensorRef.current = Accelerometer.addListener(({ x, y, z }) => {
        const movimentoAnterior = movimentoAnteriorRef.current;

        movimentoAnteriorRef.current = { x, y, z };

        if (
          !movimentoAnterior ||
          processandoRef.current ||
          acessoConcluidoRef.current
        ) {
          return;
        }

        const variacao = Math.sqrt(
          Math.pow(x - movimentoAnterior.x, 2) +
          Math.pow(y - movimentoAnterior.y, 2) +
          Math.pow(z - movimentoAnterior.z, 2)
        );

        
        if (variacao > 0.55) {
          detectarAcesso();
        }
      });

      setMonitorando(true);
    } catch (error) {
      console.error('Erro ao ativar acelerômetro:', error);
    }
  }

  function reiniciar() {
    setDetectado(false);

    processandoRef.current = false;
    acessoConcluidoRef.current = false;
    movimentoAnteriorRef.current = null;
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <Text style={styles.titulo}>Controle de Acesso</Text>
      <Text style={styles.subtitulo}>
        Sistema de reconhecimento
      </Text>

      <View style={styles.statusContainer}>
        <View
          style={[
            styles.indicador,
            monitorando && styles.indicadorMonitorando,
            detectado && styles.indicadorAtivo,
          ]}
        />

        <Text style={styles.status}>
          {detectado
            ? 'Acesso detectado'
            : monitorando
            ? 'Detector ativado'
            : 'Detector desativado'}
        </Text>
      </View>

      <Text style={styles.descricao}>
        {detectado
          ? 'Movimento reconhecido. Acesso autorizado.'
          : monitorando
          ? 'Movimente o celular para simular a aproximação.'
          : 'Ative o detector para aguardar um movimento.'}
      </Text>

      <TouchableOpacity
        style={styles.botao}
        onPress={ativarDetector}
        activeOpacity={0.8}
      >
        <Text style={styles.botaoTexto}>
          {monitorando ? 'Desativar detector' : 'Ativar detector'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.botaoReset}
        onPress={reiniciar}
      >
        <Text style={styles.resetTexto}>Reiniciar</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },

  titulo: {
    color: '#1E293B',
    fontSize: 25,
    fontWeight: 'bold',
  },

  subtitulo: {
    color: '#64748B',
    fontSize: 14,
    marginTop: 8,
  },

  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 70,
    gap: 10,
  },

  indicador: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F59E0B',
  },

  indicadorMonitorando: {
    backgroundColor: '#3B82F6',
  },

  indicadorAtivo: {
    backgroundColor: '#22C55E',
  },

  status: {
    color: '#334155',
    fontSize: 17,
    fontWeight: '600',
  },

  descricao: {
    color: '#64748B',
    fontSize: 14,
    marginTop: 12,
    marginBottom: 45,
    textAlign: 'center',
  },

  botao: {
    width: '100%',
    backgroundColor: '#2563EB',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },

  botaoTexto: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  botaoReset: {
    padding: 16,
    marginTop: 5,
  },

  resetTexto: {
    color: '#64748B',
    fontSize: 14,
  },
});
