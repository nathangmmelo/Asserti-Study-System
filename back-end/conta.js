import { criarConta } from './db.js';
import { randomBytes } from 'node:crypto';

const [papel,email,nome] = process.argv.slice(2);
if (!['admin','aluno'].includes(papel) || !email || !nome) {
 console.error('Uso: node back-end/conta.js admin|aluno email "Nome completo"');
 process.exit(1);
}
const senha = randomBytes(12).toString('base64url');
try {
 await criarConta({nome,email,senha},papel);
 console.log('Conta criada. Senha de teste gerada para este acesso:',senha);
} catch (erro) {
 console.error(erro.status ? erro.message : 'Falha ao criar a conta.');
 process.exitCode = 1;
}
