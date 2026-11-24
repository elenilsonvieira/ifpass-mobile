import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { buscarHistoricoAcessos, formatarDataHora } from '../service/AcessoService';
import { RegistroAcesso } from '../types/Acessos';

const ITENS_POR_PAGINA = 15;

export function HistoricoAcessosScreen() {
  const [registros, setRegistros] = useState<RegistroAcesso[]>([]);
  const [paginaAtual, setPaginaAtual] = useState<number>(1);
  const [temProximaPagina, setTemProximaPagina] = useState<boolean>(false);

  const [carregandoInicial, setCarregandoInicial] = useState<boolean>(true);
  const [atualizando, setAtualizando] = useState<boolean>(false);
  const [carregandoMais, setCarregandoMais] = useState<boolean>(false);
  const [erro, setErro] = useState<string | null>(null);

  // Evita disparos duplicados do onEndReached durante a rolagem
  const requisicaoEmAndamento = useRef<boolean>(false);

  const carregarRegistros = useCallback(
    async (paginaAlvo: number, modo: 'inicial' | 'refresh' | 'paginacao') => {
      if (requisicaoEmAndamento.current) return;
      requisicaoEmAndamento.current = true;
      setErro(null);

      if (modo === 'inicial') setCarregandoInicial(true);
      if (modo === 'refresh') setAtualizando(true);
      if (modo === 'paginacao') setCarregandoMais(true);

      try {
        const resposta = await buscarHistoricoAcessos(paginaAlvo, ITENS_POR_PAGINA);

        setRegistros((anteriores) =>
          modo === 'paginacao' ? [...anteriores, ...resposta.items] : resposta.items
        );
        setPaginaAtual(resposta.meta.currentPage);
        setTemProximaPagina(resposta.meta.hasNextPage);
      } catch {
        setErro('Não foi possível carregar seus registros de acesso. Tente novamente.');
      } finally {
        setCarregandoInicial(false);
        setAtualizando(false);
        setCarregandoMais(false);
        requisicaoEmAndamento.current = false;
      }
    },
    []
  );

  useEffect(() => {
    carregarRegistros(1, 'inicial');
  }, [carregarRegistros]);

  const handleRefresh = () => {
    carregarRegistros(1, 'refresh');
  };

  const handleFimDaLista = () => {
    if (temProximaPagina && !carregandoMais && !carregandoInicial) {
      carregarRegistros(paginaAtual + 1, 'paginacao');
    }
  };

  const renderItem = ({ item }: { item: RegistroAcesso }) => {
    const { data, hora } = formatarDataHora(item.dataHora);
    const isEntrada = item.sentido === 'ENTRADA';

    return (
      <View
        style={styles.card}
        accessible
        accessibilityLabel={`${isEntrada ? 'Entrada' : 'Saída'} no dia ${data} às ${hora}`}
      >
        <View style={styles.colunaEsquerda}>
          <View
            style={[
              styles.badge,
              isEntrada ? styles.badgeEntrada : styles.badgeSaida,
            ]}
          >
            <Text
              style={[
                styles.badgeTexto,
                isEntrada ? styles.textoEntrada : styles.textoSaida,
              ]}
            >
              {isEntrada ? '↓ ENTRADA' : '↑ SAÍDA'}
            </Text>
          </View>

          {item.catraca ? (
            <Text style={styles.catracaTexto} numberOfLines={1}>
              {item.catraca}
            </Text>
          ) : null}
        </View>

        <View style={styles.colunaDireita}>
          <Text style={styles.horaTexto}>{hora}</Text>
          <Text style={styles.dataTexto}>{data}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.titulo}>Histórico de Acessos</Text>
        <Text style={styles.subtitulo}>Entradas e saídas registradas na catraca</Text>
      </View>

      {erro ? (
        <View style={styles.erroBox} accessibilityRole="alert">
          <Text style={styles.erroTexto}>{erro}</Text>
          <TouchableOpacity
            style={styles.botaoTentarNovamente}
            onPress={() => carregarRegistros(1, 'inicial')}
          >
            <Text style={styles.botaoTentarNovamenteTexto}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {carregandoInicial ? (
        <View style={styles.centralizado}>
          <ActivityIndicator size="large" color="#15803D" />
          <Text style={styles.loadingTexto}>Buscando registros...</Text>
        </View>
      ) : (
       <FlatList
          testID="lista-acessos"
          data={registros}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={
            registros.length === 0 ? styles.listaVaziaContainer : styles.listaContainer
          }
          onEndReached={handleFimDaLista}
          onEndReachedThreshold={0.3}
          refreshControl={
            <RefreshControl
              refreshing={atualizando}
              onRefresh={handleRefresh}
              colors={['#15803D']}
            />
          }
          ListEmptyComponent={
            !erro ? (
              <View style={styles.centralizado}>
                <Text style={styles.vazioTitulo}>Nenhum acesso encontrado</Text>
                <Text style={styles.vazioSubtitulo}>
                  Suas entradas e saídas na catraca aparecerão aqui.
                </Text>
              </View>
            ) : undefined
          }
          ListFooterComponent={
            carregandoMais ? (
              <View style={styles.footerLoading}>
                <ActivityIndicator size="small" color="#15803D" />
                <Text style={styles.footerTexto}>Carregando mais registros...</Text>
              </View>
            ) : undefined
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  titulo: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  subtitulo: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  listaContainer: {
    padding: 16,
    gap: 10,
  },
  listaVaziaContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  colunaEsquerda: {
    flex: 1,
    paddingRight: 12,
  },
  colunaDireita: {
    alignItems: 'flex-end',
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeEntrada: {
    backgroundColor: '#DCFCE7',
  },
  badgeSaida: {
    backgroundColor: '#DBEAFE',
  },
  badgeTexto: {
    fontSize: 12,
    fontWeight: '700',
  },
  textoEntrada: {
    color: '#166534',
  },
  textoSaida: {
    color: '#1E40AF',
  },
  catracaTexto: {
    marginTop: 6,
    fontSize: 12,
    color: '#6B7280',
  },
  horaTexto: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  dataTexto: {
    fontSize: 13,
    color: '#4B5563',
    marginTop: 2,
  },
  centralizado: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingTexto: {
    marginTop: 10,
    fontSize: 14,
    color: '#4B5563',
  },
  vazioTitulo: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  vazioSubtitulo: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  erroBox: {
    margin: 16,
    padding: 14,
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  erroTexto: {
    color: '#991B1B',
    fontSize: 14,
    marginBottom: 10,
  },
  botaoTentarNovamente: {
    alignSelf: 'flex-start',
    backgroundColor: '#991B1B',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  botaoTentarNovamenteTexto: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  footerLoading: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  footerTexto: {
    fontSize: 13,
    color: '#6B7280',
  },
});