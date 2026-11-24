import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { HistoricoAcessosScreen } from '../../components/HistoricoAcessosScreen';
import * as AcessoService from '../AcessoService';
import { HistoricoPaginadoResponse } from '../../types/Acessos';

jest.mock('../AcessoService', () => ({
  buscarHistoricoAcessos: jest.fn(),
  formatarDataHora: jest.fn((iso: string) => {
    if (iso.includes('07:30')) return { data: '21/11/2026', hora: '07:30' };
    if (iso.includes('12:15')) return { data: '21/11/2026', hora: '12:15' };
    return { data: '20/11/2026', hora: '18:00' };
  }),
}));

const mockBuscarHistorico = AcessoService.buscarHistoricoAcessos as jest.MockedFunction<
  typeof AcessoService.buscarHistoricoAcessos
>;

describe('HistoricoAcessosScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBuscarHistorico.mockReset();
  });

  it('deve exibir o carregamento inicial e listar registros com data, hora e sentido', async () => {
    let resolverRequisicao!: (valor: HistoricoPaginadoResponse) => void;
    mockBuscarHistorico.mockReturnValueOnce(
      new Promise<HistoricoPaginadoResponse>((resolve) => {
        resolverRequisicao = resolve;
      })
    );

    await render(<HistoricoAcessosScreen />);

    expect(screen.getByText('Buscando registros...')).toBeTruthy();

    await act(async () => {
      resolverRequisicao({
        items: [
          {
            id: '1',
            dataHora: '2026-11-21T07:30:00-03:00',
            sentido: 'ENTRADA',
            catraca: 'Portaria Bloco A',
          },
          {
            id: '2',
            dataHora: '2026-11-21T12:15:00-03:00',
            sentido: 'SAIDA',
            catraca: 'Portaria Bloco A',
          },
        ],
        meta: { currentPage: 1, totalPages: 1, hasNextPage: false },
      });
    });

    expect(screen.getByText('↓ ENTRADA')).toBeTruthy();
    expect(screen.getByText('↑ SAÍDA')).toBeTruthy();
    expect(screen.getByText('07:30')).toBeTruthy();
    expect(screen.getByText('12:15')).toBeTruthy();
    expect(screen.getAllByText('21/11/2026')).toHaveLength(2);
  });

  it('deve carregar a próxima página ao chegar ao fim da lista', async () => {
    const pagina1: HistoricoPaginadoResponse = {
      items: [
        { id: '1', dataHora: '2026-11-21T07:30:00-03:00', sentido: 'ENTRADA' },
      ],
      meta: { currentPage: 1, totalPages: 2, hasNextPage: true },
    };

    const pagina2: HistoricoPaginadoResponse = {
      items: [
        { id: '2', dataHora: '2026-11-20T18:00:00-03:00', sentido: 'SAIDA' },
      ],
      meta: { currentPage: 2, totalPages: 2, hasNextPage: false },
    };

    mockBuscarHistorico
      .mockResolvedValueOnce(pagina1)
      .mockResolvedValueOnce(pagina2);

    await render(<HistoricoAcessosScreen />);

    await waitFor(() => {
      expect(screen.getByText('07:30')).toBeTruthy();
    });

    fireEvent(screen.getByTestId('lista-acessos'), 'onEndReached');

    await waitFor(() => {
      expect(mockBuscarHistorico).toHaveBeenCalledWith(2, 15);
      expect(screen.getByText('18:00')).toBeTruthy();
      expect(screen.getByText('20/11/2026')).toBeTruthy();
    });
  });

  it('deve exibir mensagem de lista vazia quando não houver acessos', async () => {
    mockBuscarHistorico.mockResolvedValueOnce({
      items: [],
      meta: { currentPage: 1, totalPages: 0, hasNextPage: false },
    });

    await render(<HistoricoAcessosScreen />);

    await waitFor(() => {
      expect(screen.getByText('Nenhum acesso encontrado')).toBeTruthy();
    });
  });

  it('deve exibir alerta de erro e permitir tentar novamente em caso de falha na API', async () => {
    mockBuscarHistorico
      .mockRejectedValueOnce(new Error('Network Error'))
      .mockResolvedValueOnce({
        items: [
          { id: '1', dataHora: '2026-11-21T07:30:00-03:00', sentido: 'ENTRADA' },
        ],
        meta: { currentPage: 1, totalPages: 1, hasNextPage: false },
      });

    await render(<HistoricoAcessosScreen />);

    await waitFor(() => {
      expect(
        screen.getByText('Não foi possível carregar seus registros de acesso. Tente novamente.')
      ).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Tentar novamente'));

    await waitFor(() => {
      expect(mockBuscarHistorico).toHaveBeenCalledTimes(2);
      expect(screen.getByText('↓ ENTRADA')).toBeTruthy();
    });
  });
});