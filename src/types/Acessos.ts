export type SentidoAcesso = 'ENTRADA' | 'SAIDA';

export interface RegistroAcesso {
  id: string;
  dataHora: string;
  sentido: SentidoAcesso;
  catraca?: string;
}

export interface HistoricoPaginadoResponse {
  items: RegistroAcesso[];
  meta: {
    currentPage: number;
    totalPages: number;
    hasNextPage: boolean;
  };
}