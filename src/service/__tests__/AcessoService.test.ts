import { api, buscarHistoricoAcessos, formatarDataHora } from '../AcessoService';
import { HistoricoPaginadoResponse } from '../../types/Acessos';

describe('AcessoService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('deve buscar o histórico paginado enviando page e limit corretos', async () => {
    const mockResposta: HistoricoPaginadoResponse = {
      items: [
        {
          id: 'acc_1',
          dataHora: '2026-11-21T07:30:00-03:00',
          sentido: 'ENTRADA',
          catraca: 'Portaria Principal - Bloco A',
        },
      ],
      meta: {
        currentPage: 1,
        totalPages: 2,
        hasNextPage: true,
      },
    };

    const getSpy = jest.spyOn(api, 'get').mockResolvedValueOnce({ data: mockResposta });

    const resultado = await buscarHistoricoAcessos(1, 15);

    expect(getSpy).toHaveBeenCalledWith('/acessos/historico', {
      params: { page: 1, limit: 15 },
    });
    expect(resultado).toEqual(mockResposta);
  });

  it('deve formatar data e hora no padrão brasileiro (dd/mm/aaaa e hh:mm)', () => {
    const { data, hora } = formatarDataHora('2026-11-21T14:05:00-03:00');

    expect(data).toMatch(/^\d{2}\/\d{2}\/2026$/);
    expect(hora).toMatch(/^\d{2}:\d{2}$/);
  });
});