import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import StudentCard from '../components/StudentCard';
import NfcStatusCard from '../components/NfcStatusCard';
import { Estudante } from '../types/Estudante';
import { buscarDadosEstudante } from '../service/VisualizarDadosEstudante';

export default function HomeScreen() {
  const router = useRouter();
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

          <View style={styles.acoesContainer}>
            <TouchableOpacity
              style={styles.botaoNfc}
              onPress={() => router.push('/NFC' as any)}
              activeOpacity={0.8}
            >
              <Text style={styles.botaoTexto}>Controle de Acesso (Feedback / NFC)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.botaoLogin}
              onPress={() => router.push('/login' as any)}
              activeOpacity={0.8}
            >
              <Text style={styles.botaoLoginTexto}>Ir para Tela de Login</Text>
            </TouchableOpacity>
          </View>
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
  acoesContainer: {
    marginTop: 16,
    gap: 10,
  },
  botaoNfc: {
    backgroundColor: '#2E7D32',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  botaoTexto: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  botaoLogin: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  botaoLoginTexto: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '600',
  },
});
