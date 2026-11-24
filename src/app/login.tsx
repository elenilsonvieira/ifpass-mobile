
import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
} from 'react-native';

import { useRouter } from 'expo-router';

export default function Login() {
  const router = useRouter();

  const [matricula, setMatricula] = useState('');
  const [senha, setSenha] = useState('');

  function entrar() {
    if (!matricula.trim() || !senha.trim()) {
      Alert.alert('Atenção', 'Preencha a matrícula e a senha.');
      return;
    }

    router.replace('/NFC');
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <Text style={styles.titulo}>Bem-vindo!</Text>
      </View>

      <View style={styles.formulario}>
        <Text style={styles.label}>Matrícula</Text>
        <TextInput
          style={styles.input}
          placeholder="Digite sua matrícula"
          placeholderTextColor="#94A3B8"
          value={matricula}
          onChangeText={setMatricula}
          keyboardType="numeric"
          autoCapitalize="none"
        />

        <Text style={styles.label}>Senha</Text>
        <TextInput
          style={styles.input}
          placeholder="Digite sua senha"
          placeholderTextColor="#94A3B8"
          value={senha}
          onChangeText={setSenha}
          secureTextEntry
        />

        <TouchableOpacity
          style={styles.botao}
          onPress={entrar}
          activeOpacity={0.8}
        >
          <Text style={styles.botaoTexto}>Entrar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    padding: 24,
  },

  header: {
    marginBottom: 40,
  },

  titulo: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1E293B',
  },

  subtitulo: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 8,
  },

  formulario: {
    width: '100%',
  },

  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },

  input: {
    height: 50,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#1E293B',
    marginBottom: 22,
  },

  botao: {
    backgroundColor: '#2563EB',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },

  botaoTexto: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
