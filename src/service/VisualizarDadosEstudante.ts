import { Estudante } from "../types/Estudante";

export async function buscarDadosEstudante(): Promise<Estudante> {

    return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        nome: 'Gabriel De Lima Costa',
        fotoUrl: 'https://ifpb-suap.s3.sa-east-1.amazonaws.com/media/edu/aluno/fotos/2024/412/5abaed192a6f47f69b18df93e806e2ee.jpg?AWSAccessKeyId=AKIATK7PA3ZCSD745UZB&Signature=RH2c6ewgq9ac2PwF6yLNPw%2FCj4E%3D&Expires=1795342728',
        curso: 'Sistema para Internet',
        matricula: '202423810036',
        situacaoAtiva: true,
      });
    }, 800);
  });
}