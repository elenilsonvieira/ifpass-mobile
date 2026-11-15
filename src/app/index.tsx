import * as Device from 'expo-device';
import { Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedIcon } from '@/components/animated-icon';
import { HintRow } from '@/components/hint-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WebBadge } from '@/components/web-badge';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, Text } from 'react-native';
import StudentCard from '../components/StudentCard';
import NfcStatusCard from '../components/NfcStatusCard';
import { Estudante } from '../types/Estudante';
import { buscarDadosEstudante } from '../service/VisualizarDadosEstudante';

export default function HomeScreen() {
  const [estudante, setEstudante] = useState<Estudante | null>(null);
  const [carregando, setCarregando] = useState<boolean>(true);

  useEffect(() => {
    async function carregarDados() {
      try {
        const dados = await buscarDadosEstudante();
        setEstudante(dados);
      } catch (error) {
        console.error('Erro ao buscar dados do estudante:', error);
      } finally {
        setCarregando(false);
      }
    }
    carregarDados();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.tituloHeader}>IFPASS</Text>

      {carregando ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2E7D32" />
          <Text style={styles.loadingText}>Carregando dados da carteirinha...</Text>
        </View>
      ) : estudante ? (
        <>
          <StudentCard {...estudante} />
          <NfcStatusCard />
        </>
      ) : (
        <Text style={styles.erroText}>Não foi possível carregar os dados.</Text>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6F8',
    padding: 16,
  },
  tituloHeader: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 16,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
});