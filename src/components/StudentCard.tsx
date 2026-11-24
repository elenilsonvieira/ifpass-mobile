import React from 'react';
import { StyleSheet, Text, View, Image } from 'react-native';
import { Estudante } from '../types/Estudante';

function obterIniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return 'IF';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase();
}

export default function StudentCard({
  nome,
  fotoUrl,
  curso,
  matricula,
  situacaoAtiva,
}: Estudante) {
  const temFotoValida =
    typeof fotoUrl === 'string' &&
    (fotoUrl.startsWith('http://') ||
      fotoUrl.startsWith('https://') ||
      fotoUrl.startsWith('data:'));

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.instituicao}>IFPASS • Identificação Estudantil</Text>
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
        {temFotoValida ? (
          <Image source={{ uri: fotoUrl }} style={styles.foto} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarIniciais}>{obterIniciais(nome)}</Text>
          </View>
        )}

        <View style={styles.infoCol}>
          <Text style={styles.label}>Nome</Text>
          <Text style={styles.valorNome}>{nome}</Text>

          <Text style={styles.label}>Matrícula</Text>
          <Text style={styles.valorMatricula}>{matricula}</Text>
        </View>
      </View>

      <View style={styles.divisor} />

      <View style={styles.footerInfo}>
        <View style={{ marginBottom: 8 }}>
          <Text style={styles.label}>Curso</Text>
          <Text style={styles.valorCurso}>{curso}</Text>
        </View>
        <View>
          <Text style={styles.label}>Instituição</Text>
          <Text style={styles.valorInstituicao}>
            Instituto Federal da Paraíba (IFPB) - Campus Guarabira
          </Text>
        </View>
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
    borderRadius: 10,
    backgroundColor: '#E1E4E8',
    marginRight: 14,
  },
  avatarPlaceholder: {
    width: 68,
    height: 80,
    borderRadius: 10,
    backgroundColor: '#E6F4EA',
    borderWidth: 1,
    borderColor: '#C8E6C9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarIniciais: {
    fontSize: 22,
    fontWeight: '800',
    color: '#2E7D32',
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
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 8,
  },
  valorMatricula: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  divisor: {
    height: 1,
    backgroundColor: '#EEEEEE',
    marginVertical: 12,
  },
  footerInfo: {
    flexDirection: 'column',
  },
  valorCurso: {
    fontSize: 13,
    fontWeight: '600',
    color: '#222',
  },
  valorInstituicao: {
    fontSize: 12,
    fontWeight: '500',
    color: '#475569',
  },
});
