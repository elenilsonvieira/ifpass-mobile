import { Estudante } from '../types/Estudante';

export async function buscarDadosEstudante(matriculaCustom?: string): Promise<Estudante> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        nome: 'Elenilson Vieira',
        fotoUrl: '',
        curso: 'Sistemas para Internet',
        matricula: matriculaCustom?.trim() || '20241014040029',
        situacaoAtiva: true,
      });
    }, 300);
  });
}
