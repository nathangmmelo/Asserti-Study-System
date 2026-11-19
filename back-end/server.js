import { createServer } from 'node:http';
import { sql, categorias, exigir, criarConta, autenticar, digest, criarCurso, validarCurso } from './db.js';
import { asset, page, catalogo, perfil, aula, questionario } from './views.js';

async function payload(req) {
 exigir(req.headers['content-type']?.split(';')[0] === 'application/json','Envie dados em JSON.',415);
 const parts = [];
 let size = 0;
 for await (const part of req) {
   size += part.length;
   exigir(size <= 65536,'O formulário ultrapassa 64 KB.',413);
   parts.push(part);
 }
 try {
   const obj = JSON.parse(Buffer.concat(parts).toString());
   if (!obj || Array.isArray(obj) || typeof obj !== 'object') throw new Error();
   return obj;
 } catch { exigir(false,'Dados inválidos.'); }
}

const assets = new Set(['/css/styles.css','/js/acesso.js','/js/atividade.js','/js/admin-conteudos.js']);
const aliases = new Map([['/dashboard.html','/perfil.html'],['/primeiro-acesso.html','/perfil.html'],
 ['/aula-computador.html','/curso/28'],['/perguntas-aula.html','/curso/28/atividade']]);
const cookie = 'Path=/; HttpOnly; SameSite=Lax';
async function handle(req,res) {
 const path = new URL(req.url,'http://localhost').pathname;
 const method = req.method;
 const get = method === 'GET';
 const send = (type,body,status=200) => {res.writeHead(status,{'Content-Type':type+'; charset=utf-8'});res.end(body);};
 const json = (body,status) => send('application/json',JSON.stringify(body),status);
 const redirect = location => {res.writeHead(303,{Location:location});res.end();};
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 if (get && assets.has(path)) return send(path.endsWith('.css')?'text/css':'text/javascript',asset(path.slice(1)));
 if (get && aliases.has(path)) return redirect(aliases.get(path));
 if (!get && req.headers.origin) exigir(req.headers.origin === 'http://'+req.headers.host,'Origem inválida.',403);
 const token = /(?:^|;\s*)sessao=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
 const user = token && sql('SELECT u.id,u.nome,u.email,u.papel FROM usuarios u JOIN sessoes s ON s.usuario=u.id WHERE s.token=? AND s.expira>?').get(digest(token),Date.now());
 const render = (file,data) => send('text/html',page(file,user,data));
 if (path === '/api/cadastro' && method==='POST') {
   await criarConta(await payload(req));
   return json({ok:true},201);
 }
 if (path === '/api/login' && method==='POST') {
   const {email,senha} = await payload(req);
   const novo = await autenticar(email,senha);
   if (token) sql('DELETE FROM sessoes WHERE token=?').run(digest(token));
   res.setHeader('Set-Cookie','sessao='+novo+'; '+cookie+'; Max-Age=86400');
   return json({ok:true});
 }
 if (path === '/sair' && method==='POST') {
   if (token) sql('DELETE FROM sessoes WHERE token=?').run(digest(token));
   res.setHeader('Set-Cookie','sessao=; '+cookie+'; Max-Age=0');
   return redirect('/');
 }
 if (get && ['/', '/index.html'].includes(path)) return render('index.html',catalogo());
 if (get && ['/cadastro.html','/login.html','/recuperar-acesso.html'].includes(path)) return render(path.slice(1));
 if (get && path==='/perfil.html') return user ? render('perfil.html',perfil(user)) : redirect('/login.html');
 if (path==='/admin-conteudos.html' || /^\/api\/cursos(?:\/\d+)?$/.test(path)) {
   if (!user && get && path==='/admin-conteudos.html') return redirect('/login.html');
   exigir(user,'Entre na sua conta.',401);
   if (user.papel !== 'admin' && get && path==='/admin-conteudos.html') {
     return send('text/html',page('aviso.html',user,{mensagem:'Acesso restrito à Administração.'}),403);
   }
   exigir(user.papel==='admin','Acesso restrito à Administração.',403);
   if (get && path==='/admin-conteudos.html') return render('admin-conteudos.html',{categorias:Object.values(categorias).map(v=>'<option>'+v+'</option>').join('')});
   if (get && path==='/api/cursos') {
     const cursos = sql('SELECT id,titulo,tema,formato,conteudo,url,questoes,versao FROM cursos WHERE ativo=1 ORDER BY id').all();
     return json(cursos.map(({questoes,...c})=>({...c,atividade:JSON.parse(questoes).map(q=>[q.texto,q.opcoes[q.correta],...q.opcoes.filter((_,i)=>i!==q.correta)].join(' | ')).join('\n')})));
   }
   if (method==='POST' && path==='/api/cursos') return json({id:criarCurso(validarCurso(await payload(req)))},201);
   const id = path.match(/^\/api\/cursos\/(\d+)$/)?.[1];
   if (id && ['PUT','DELETE'].includes(method)) {
     const body = await payload(req);
     const c = sql('SELECT * FROM cursos WHERE id=? AND ativo=1').get(id);
     exigir(c,'Curso indisponível.',404);
     exigir(body.versao===c.versao,'O curso mudou. Recarregue a lista antes de continuar.',409);
     if (method==='DELETE') sql('UPDATE cursos SET ativo=0 WHERE id=?').run(id);
     else {
       const d = validarCurso(body);
       const mesmaFonte = d.url===c.url;
       sql(`UPDATE cursos SET titulo=?,tema=?,formato=?,conteudo=?,url=?,questoes=?,creditos=?,aviso=?,versao=versao+1 WHERE id=?`)
         .run(d.titulo,d.tema,d.formato,d.conteudo,d.url,JSON.stringify(d.questoes),mesmaFonte?c.creditos:'[]',mesmaFonte?c.aviso:'',id);
     }
     return json({ok:true});
   }
 }
 const match = path.match(/^\/curso\/(\d+)(\/atividade)?$/);
 if (match) {
   const c = sql('SELECT * FROM cursos WHERE ativo=1 AND id=?').get(match[1]);
   exigir(c,'Curso indisponível.',404);
   if (user && get) sql('INSERT OR IGNORE INTO progresso(usuario,curso) VALUES(?,?)').run(user.id,c.id);
   const progress = () => sql('SELECT pontos FROM progresso WHERE usuario=? AND curso=?').get(user.id,c.id);
   if (get && !match[2]) return render('aula-computador.html',aula(c,user,user && progress()));
   if (match[2]) {
     if (!user && get) return redirect('/login.html');
     exigir(user,'Entre novamente para continuar.',401);
     if (get) return progress().pontos===null ? render('perguntas-aula.html',questionario(c)) : redirect('/curso/'+c.id);
     if (method==='POST') {
       const {respostas,versao} = await payload(req);
       const atual = sql('SELECT questoes,versao FROM cursos WHERE id=? AND ativo=1').get(c.id);
       exigir(atual && atual.versao===versao,'O curso mudou. Abra a aula novamente.',409);
       const q = JSON.parse(atual.questoes);
       exigir(Array.isArray(respostas) && respostas.length===q.length && q.every((v,i)=>Number.isInteger(respostas[i]) && respostas[i]>=0 && respostas[i]<v.opcoes.length),'Responda a todas as perguntas.');
       exigir(progress(),'Abra a aula antes de responder.',409);
       const pontos = q.filter((v,i)=>v.correta===respostas[i]).length*10;
       sql('UPDATE progresso SET pontos=? WHERE usuario=? AND curso=? AND pontos IS NULL').run(pontos,user.id,c.id);
       return json(progress());
     }
   }
 }
 exigir(false,'Página não encontrada.',404);
}
createServer((req,res)=>handle(req,res).catch(error=>{
 const status = error.status || 500;
 const message = error.status ? error.message : 'Não foi possível concluir a operação.';
 const api = req.url.startsWith('/api/') || req.method!=='GET';
 res.writeHead(status,{'Content-Type':(api?'application/json':'text/html')+'; charset=utf-8'});
 res.end(api ? JSON.stringify({erro:message}) : page('aviso.html',null,{mensagem:message}));
})).listen(Number(process.env.PORT || 3000),'127.0.0.1',function(){
 console.log('ASSERTI em http://127.0.0.1:'+this.address().port);
});
