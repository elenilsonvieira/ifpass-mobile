import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface NfcStatusCardProps {
  catracaOnline?: boolean;
  detectorAtivo?: boolean;
  campoDeltaUt?: number;
}

export default function NfcStatusCard({
  catracaOnline = false,
  detectorAtivo = false,
  campoDeltaUt = 0,
}: NfcStatusCardProps) {
  const corIcone = detectorAtivo
    ? '#2563EB'
    : catracaOnline
    ? '#1E8E3E'
    : '#F59E0B';

  const descricao = detectorAtivo
    ? `Detector NFC ativo — aproxime da catraca (campo: ${Math.round(campoDeltaUt)} µT)`
    : catracaOnline
    ? 'Catraca detectada e pronta para leitura NFC'
    : 'Abra o app da Catraca no outro celular';

  return (
    <View style={[styles.nfcCard, detectorAtivo && styles.nfcCardAtivo]}>
      <MaterialCommunityIcons
        name={(catracaOnline || detectorAtivo ? 'nfc' : 'nfc-off') as any}
        size={28}
        color={corIcone}
      />
      <View style={styles.nfcInfo}>
        <Text style={styles.nfcTitulo}>Status do Sensor NFC</Text>
        <Text style={styles.nfcDescricao}>{descricao}</Text>
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
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  nfcCardAtivo: {
    borderColor: '#93C5FD',
    backgroundColor: '#EFF6FF',
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
    color: '#475569',
    marginTop: 2,
  },
});
