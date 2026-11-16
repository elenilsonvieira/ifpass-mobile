
import { useEffect, useRef, useState } from 'react';
import type { AudioPlayer } from 'expo-audio';

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from 'react-native';

export default function FeedbackAcesso() {
  const [detectado, setDetectado] = useState(false);
  const playerRef = useRef<AudioPlayer | null>(null);

  useEffect(() => {
    return () => {
      playerRef.current?.release();
      playerRef.current = null;
    };
  }, []);

  async function detectarAcesso() {
    setDetectado(true);

    try {
      const [Audio, Haptics] = await Promise.all([
        import('expo-audio'),
        import('expo-haptics'),
      ]);

      if (!playerRef.current) {
        playerRef.current = Audio.createAudioPlayer(
          require('../../assets/beep_acesso.wav')
        );
      }

      await playerRef.current.seekTo(0);
      playerRef.current.play();

      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      );
    } catch (error) {
      console.error('Erro no feedback de acesso:', error);
    }
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
            detectado && styles.indicadorAtivo,
          ]}
        />

        <Text style={styles.status}>
          {detectado
            ? 'Acesso detectado'
            : 'Aguardando detecção'}
        </Text>
      </View>

      <Text style={styles.descricao}>
        {detectado
          ? 'Reconhecido.'
          : 'Aproxime o dispositivo do sensor.'}
      </Text>

      <TouchableOpacity
        style={styles.botao}
        onPress={detectarAcesso}
        activeOpacity={0.8}
      >
        <Text style={styles.botaoTexto}>Detectar</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.botaoReset}
        onPress={() => setDetectado(false)}
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
