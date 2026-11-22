import { Estudante } from "../types/Estudante";

export async function buscarDadosEstudante(): Promise<Estudante> {

    return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        nome: 'GL',
        fotoUrl: "imagem.png",
        curso: 'Sistema para Internet',
        matricula: '005386875',
        situacaoAtiva: true,
      });
    }, 800);
  });
}