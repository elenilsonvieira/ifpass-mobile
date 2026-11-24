import axios from 'axios';
import { HistoricoPaginadoResponse } from '../types/Acessos';

export const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3000',
  timeout: 8000,
});

api.interceptors.request.use((config: any) => {
  const token = '';
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export async function buscarHistoricoAcessos(
  page: number = 1,
  limit: number = 15
): Promise<HistoricoPaginadoResponse> {
  const { data } = await api.get<HistoricoPaginadoResponse>('/acessos/historico', {
    params: { page, limit },
  });
  return data;
}

export function formatarDataHora(isoString: string): { data: string; hora: string } {
  const dateObj = new Date(isoString);

  const data = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(dateObj);

  const hora = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(dateObj);

  return { data, hora };
}