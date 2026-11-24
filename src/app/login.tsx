import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

export default function Login() {
  const router = useRouter();

  const [matricula, setMatricula] = useState('20241014040029');
  const [senha, setSenha] = useState('');

  function entrar() {
    if (!matricula.trim() || !senha.trim()) {
      Alert.alert('Atenção', 'Preencha a matrícula e a senha.');
      return;
    }

    router.replace({
      pathname: '/carteirinha',
      params: { matricula: matricula.trim() },
    });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.marca}>IFPASS</Text>
          <Text style={styles.titulo}>Bem-vindo!</Text>
          <Text style={styles.subtitulo}>
            Acesse sua carteirinha digital para entrar no campus
          </Text>
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F4F6F8',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    marginBottom: 36,
  },
  marca: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2E7D32',
    letterSpacing: 1,
    marginBottom: 6,
  },
  titulo: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  subtitulo: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 6,
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
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#1E293B',
    marginBottom: 20,
  },
  botao: {
    backgroundColor: '#2E7D32',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 6,
  },
  botaoTexto: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
