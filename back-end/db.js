import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { randomBytes, randomUUID, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(scrypt);
const seed = JSON.parse(readFileSync(new URL('./curadoria.json', import.meta.url)));
export const categorias = seed.categorias;
mkdirSync(new URL('./data/', import.meta.url), { recursive: true, mode: 0o700 });
export const db = new DatabaseSync(new URL('./data/asserti.sqlite', import.meta.url));
export const sql = query => db.prepare(query);
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS usuarios (
 id INTEGER PRIMARY KEY, nome TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
 senha_hash TEXT NOT NULL, papel TEXT NOT NULL CHECK(papel IN ('aluno','admin')));
CREATE TABLE IF NOT EXISTS sessoes (
 token TEXT PRIMARY KEY, usuario INTEGER NOT NULL REFERENCES usuarios, expira INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS cursos (
 id INTEGER PRIMARY KEY, titulo TEXT NOT NULL, tema TEXT NOT NULL, formato TEXT NOT NULL,
 conteudo TEXT NOT NULL, url TEXT NOT NULL, questoes TEXT NOT NULL, creditos TEXT NOT NULL,
 aviso TEXT NOT NULL, ativo INTEGER NOT NULL DEFAULT 1, versao INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS progresso (
 usuario INTEGER NOT NULL REFERENCES usuarios, curso INTEGER NOT NULL REFERENCES cursos,
 pontos INTEGER, PRIMARY KEY(usuario,curso));`);
db.exec(`CREATE TABLE IF NOT EXISTS medalhas (
 usuario INTEGER NOT NULL REFERENCES usuarios, curso INTEGER NOT NULL REFERENCES cursos,
 pergunta TEXT NOT NULL, enunciado TEXT NOT NULL,
 PRIMARY KEY (usuario,curso,pergunta))`);
const inserir = sql('INSERT INTO cursos(titulo,tema,formato,conteudo,url,questoes,creditos,aviso) VALUES(?,?,?,?,?,?,?,?)');
export function criarCurso(c) {
 return inserir.run(c.titulo,c.tema,c.formato,c.conteudo,c.url,JSON.stringify(c.questoes),JSON.stringify(c.creditos || []),c.aviso || '').lastInsertRowid;
}
db.exec('BEGIN IMMEDIATE');
try {
 if (!sql('PRAGMA user_version').get().user_version) {
   for (const curso of seed.cursos) criarCurso(curso);
   db.exec('PRAGMA user_version=1');
 }
 if (sql('PRAGMA user_version').get().user_version < 2) {
   const atualizar = sql('UPDATE cursos SET questoes=? WHERE id=?');
   for (const curso of sql('SELECT id,questoes FROM cursos').all()) {
     const perguntas = JSON.parse(curso.questoes).map(q => ({...q, id:randomUUID()}));
     atualizar.run(JSON.stringify(perguntas),curso.id);
   }
   db.exec('PRAGMA user_version=2');
 }
 db.exec('COMMIT');
} catch (err) { db.exec('ROLLBACK'); throw err; }

export function exigir(ok, message, status = 400) {
 if (!ok) throw Object.assign(new Error(message), { status });
}
export async function criarConta({nome,email,senha}, papel = 'aluno') {
 exigir(typeof nome === 'string' && nome.trim() && nome.length <= 150,'Informe um nome de até 150 caracteres.');
 exigir(typeof email === 'string' && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()),'Informe um e-mail válido.');
 exigir(typeof senha === 'string' && senha.length >= 8 && senha.length <= 256,'Use uma senha de 8 a 256 caracteres.');
 const salt = randomBytes(16).toString('hex');
 const hash = await derive(senha,salt,64);
 const result = sql('INSERT INTO usuarios(nome,email,senha_hash,papel) VALUES(?,?,?,?) ON CONFLICT(email) DO NOTHING')
   .run(nome.trim(),email.trim().toLowerCase(),salt + ':' + hash.toString('hex'),papel);
 exigir(result.changes,'Este e-mail já está cadastrado.',409);
}
export async function autenticar(email,senha) {
 const u = sql('SELECT * FROM usuarios WHERE email=?').get(String(email).trim().toLowerCase());
 exigir(typeof senha === 'string' && senha.length <= 256,'E-mail ou senha incorretos.',401);
 const [salt,hash] = (u?.senha_hash || '0000000000000000:').split(':');
 const attempt = await derive(senha,salt,64);
 exigir(u && timingSafeEqual(attempt,Buffer.from(hash,'hex')),'E-mail ou senha incorretos.',401);
 const token = randomBytes(32).toString('hex');
 sql('DELETE FROM sessoes WHERE expira<=?').run(Date.now());
 sql('INSERT INTO sessoes VALUES(?,?,?)').run(digest(token),u.id,Date.now()+86400000);
 return token;
}
export const digest = token => createHash('sha256').update(token).digest('hex');
export function validarCurso(body, anteriores = []) {
 const c = {};
 for (const key of ['titulo','tema','formato','conteudo','url']) {
   exigir(typeof body[key] === 'string','Preencha os campos do curso.');
   c[key] = body[key].trim();
 }
 exigir(c.titulo && c.titulo.length <= 200 && c.conteudo,'Informe o título (até 200 caracteres) e o conteúdo.');
 exigir(Object.values(categorias).includes(c.tema) && ['Texto','Vídeo'].includes(c.formato),'Categoria ou formato inválido.');
 exigir(c.formato !== 'Vídeo' || c.url,'Informe a URL do vídeo.');
 if (c.url) exigir(URL.canParse(c.url) && ['https:','http:'].includes(new URL(c.url).protocol),'Use uma URL http ou https.');
 let perguntas = body.questoes;
 // Compatibilidade com o formulário anterior, cuja primeira alternativa era correta.
 if (perguntas === undefined && typeof body.atividade === 'string') {
   perguntas = body.atividade.split('\n').map(linha => {
     const [texto, ...opcoes] = linha.split('|');
     return {texto, opcoes, correta:0};
   });
 }
 exigir(Array.isArray(perguntas) && perguntas.length, 'Adicione pelo menos uma pergunta.');
 const disponiveis = new Set(anteriores.map(q => q.id));
 c.questoes = perguntas.map((q, i) => {
   const erro = `Revise o enunciado, as alternativas e a resposta correta da pergunta ${i+1}.`;
   exigir(q && typeof q.texto === 'string' && q.texto.trim() && Array.isArray(q.opcoes), erro);
   exigir(q.opcoes.length >= 2 && q.opcoes.every(op => typeof op === 'string' && op.trim()), erro);
   const opcoes = q.opcoes.map(op => op.trim());
   exigir(new Set(opcoes).size === opcoes.length && Number.isInteger(q.correta)
     && q.correta >= 0 && q.correta < opcoes.length, erro);
   exigir(q.id === undefined || disponiveis.delete(q.id), 'Identificador de pergunta inválido.');
   return {id:q.id ?? randomUUID(), texto:q.texto.trim(), opcoes, correta:q.correta};
 });
 return c;
}

export function corrigirAtividade(usuario, curso, versao, respostas) {
 db.exec('BEGIN IMMEDIATE');
 try {
   const atual = sql('SELECT versao,questoes FROM cursos WHERE id=? AND ativo=1').get(curso);
   exigir(atual && atual.versao === versao,'O curso mudou. Abra a aula novamente.',409);
   const perguntas = JSON.parse(atual.questoes);
   exigir(Array.isArray(respostas) && respostas.length === perguntas.length && perguntas.every((q,i) =>
     Number.isInteger(respostas[i]) && respostas[i] >= 0 && respostas[i] < q.opcoes.length),'Responda a todas as perguntas.');
   const progresso = sql('SELECT pontos FROM progresso WHERE usuario=? AND curso=?').get(usuario,curso);
   exigir(progresso,'Abra a aula antes de responder.',409);
   const registrar = sql('INSERT OR IGNORE INTO medalhas(usuario,curso,pergunta,enunciado) VALUES(?,?,?,?)');
   let novas = 0;
   const acertos = perguntas.map((q,i) => {
     if (respostas[i] !== q.correta) return false;
     novas += registrar.run(usuario,curso,q.id,q.texto).changes;
     return true;
   });
   const total = sql('SELECT count(*) AS n FROM medalhas WHERE usuario=? AND curso=?').get(usuario,curso).n;
   const pontos = Math.max(progresso.pontos ?? 0,total * 10);
   sql('UPDATE progresso SET pontos=? WHERE usuario=? AND curso=?').run(pontos,usuario,curso);
   db.exec('COMMIT');
   return {acertos,novas,pontos,corretas:perguntas.map(q => q.opcoes[q.correta])};
 } catch (erro) {
   db.exec('ROLLBACK');
   throw erro;
 }
}
