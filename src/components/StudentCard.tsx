import React from 'react';
import { StyleSheet, Text, View, Image } from 'react-native';
import { Estudante } from '../types/Estudante';

export default function StudentCard({
  nome,
  fotoUrl,
  curso,
  matricula,
  situacaoAtiva,
}: Estudante) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.instituicao}>IFPASS • Identificação</Text>
        <View
          style={[
            styles.badge,
            { backgroundColor: situacaoAtiva ? '#E6F4EA' : '#FCE8E6' },
          ]}
        >
          <View
            style={[
              styles.dot,
              { backgroundColor: situacaoAtiva ? '#1E8E3E' : '#D93025' },
            ]}
          />
          <Text
            style={[
              styles.badgeText,
              { color: situacaoAtiva ? '#1E8E3E' : '#D93025' },
            ]}
          >
            {situacaoAtiva ? 'ATIVA' : 'INATIVA'}
          </Text>
        </View>
      </View>

      <View style={styles.perfilRow}>
        <Image source={{ uri: fotoUrl }} style={styles.foto} />
        <View style={styles.infoCol}>
          <Text style={styles.label}>Nome</Text>
          <Text style={styles.valorNome}>{nome}</Text>

          <Text style={styles.label}>Matrícula</Text>
          <Text style={styles.valorMatricula}>{matricula}</Text>
        </View>
      </View>

      <View style={styles.divisor} />

      <View>
        <Text style={styles.label}>Curso</Text>
        <Text style={styles.valorCurso}>{curso}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderTopWidth: 5,
    borderTopColor: '#2E7D32',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  instituicao: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2E7D32',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  perfilRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  foto: {
    width: 68,
    height: 85,
    borderRadius: 8,
    backgroundColor: '#E1E4E8',
    marginRight: 14,
  },
  infoCol: {
    flex: 1,
  },
  label: {
    fontSize: 10,
    color: '#666',
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 1,
  },
  valorNome: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 8,
  },
  valorMatricula: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  divisor: {
    height: 1,
    backgroundColor: '#EEEEEE',
    marginVertical: 12,
  },
  valorCurso: {
    fontSize: 13,
    fontWeight: '500',
    color: '#222',
  },
});