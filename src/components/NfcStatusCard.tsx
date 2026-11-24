import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import NfcManager from 'react-native-nfc-manager';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function NfcStatusCard() {
  const [nfcAtivo, setNfcAtivo] = useState<boolean>(false);
  const [verificandoNfc, setVerificandoNfc] = useState<boolean>(true);
 
  useEffect(() => {
    async function verificarNfc() {
      try {
        const suportado = await NfcManager.isSupported();
        if (suportado) {
          await NfcManager.start();
          const habilitado = await NfcManager.isEnabled();
          setNfcAtivo(habilitado);
        }
      } catch (error) {
        console.warn('Erro ao verificar NFC:', error);
      } finally {
        setVerificandoNfc(false);
      }
    }
    verificarNfc();
  }, []);

  return (
    <View style={styles.nfcCard}>
      <MaterialCommunityIcons
        name={(nfcAtivo ? 'nfc' : 'nfc-off')as any}
        size={28}
        color={nfcAtivo ? '#1E8E3E' : '#fd3911'}
      />
      <View style={styles.nfcInfo}>
        <Text style={styles.nfcTitulo}>Status do Sensor NFC</Text>
        {verificandoNfc ? (
          <ActivityIndicator size="small" color="#2E7D32" />
        ) : (
          <Text style={styles.nfcDescricao}>
            {nfcAtivo ? 'Sensor ativo e pronto' : 'Sensor desativado ou indisponível'}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  nfcCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  nfcInfo: {
    marginLeft: 12,
    flex: 1,
  },
  nfcTitulo: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  nfcDescricao: {
    fontSize: 12,
    color: '#555',
    marginTop: 2,
  },
});