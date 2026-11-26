import { readFileSync } from 'node:fs';
import { categorias, sql } from './db.js';

export function asset(path, encoding = 'utf8') {
 return readFileSync(new URL('../front-end/'+path,import.meta.url),encoding);
}
const escape = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]);
const fill = (template, data) => template.replace(/\{\{([\w-]+)\}\}/g, (_,key) => data[key] ?? '');
export function page(file,user,data={}) {
 const conta = user ? '<a href="/perfil.html">Meu perfil</a>' + (user.papel==='admin' ? '<a href="/admin-conteudos.html">Administração</a>' : '') : '';
 const header = fill(asset('components/header.html'),{
   nav:fill(asset('components/nav.html'),{conta}),
   acesso:user ? '<form action="/sair" method="post"><button class="botao botao-menor">Sair</button></form>' : '<a class="botao botao-menor" href="/login.html">Entrar</a>'
 });
 const template = asset(file).replace('<!-- header -->',()=>header).replace('<!-- footer -->',()=>asset('components/footer.html'));
 return fill(template,data);
}
function creditos(c) {
 const items = JSON.parse(c.creditos).map(([k,v]) => `<div><dt>${escape(k)}</dt><dd>${escape(v)}</dd></div>`);
 return (items.length ? '<dl>'+items.join('')+'</dl>' : '') + (c.aviso ? '<p class="aviso-destino">'+escape(c.aviso)+'</p>' : '');
}
export function catalogo() {
 const cursos = sql('SELECT * FROM cursos WHERE ativo=1 ORDER BY id').all();
 const data = {totalCursos:cursos.length,totalCategorias:Object.keys(categorias).length};
 const primeiro = cursos[0];
 data.aulaInicial = primeiro ? `<a class="aula-vidro" href="/curso/${primeiro.id}">
   <span class="atalho-aula" aria-hidden="true">↗</span><span><small>Comece por aqui</small>
   <strong>${escape(primeiro.titulo)}</strong></span></a>` : '';
 for (const [key,tema] of Object.entries(categorias)) {
   const itens = cursos.filter(c => c.tema === tema);
   data['n-'+key] = itens.length === 1 ? '1 material' : itens.length + ' materiais';
   data[key] = itens.map(c => `<article class="curso">
     <div class="curso-topo"><small>${escape(c.formato)}</small><a class="seta" href="/curso/${c.id}" aria-label="Abrir aula: ${escape(c.titulo)}">↗</a></div>
     <h4><a href="/curso/${c.id}">${escape(c.titulo)}</a></h4><p>${escape(c.conteudo.split('\n')[0])}</p>
     <div class="curso-base"><details><summary>Sobre o material</summary>${creditos(c) || '<p>Material da plataforma ASSERTI.</p>'}</details>
     <a href="/curso/${c.id}">Abrir aula →</a></div></article>`).join('') || '<p>Nenhum curso nesta categoria.</p>';
 }
 return data;
}
export function perfil(u) {
 const cursos = sql(`SELECT c.id,c.titulo,p.pontos FROM progresso p JOIN cursos c ON c.id=p.curso
   WHERE p.usuario=? AND (c.ativo=1 OR p.pontos IS NOT NULL) ORDER BY c.id`).all(u.id);
 const medalhas = sql(`SELECT c.titulo,m.enunciado FROM medalhas m JOIN cursos c ON c.id=m.curso
   WHERE m.usuario=? ORDER BY c.id,m.rowid`).all(u.id);
 const feitos = cursos.filter(c=>c.pontos !== null);
 const total = sql(`SELECT COUNT(*) AS n FROM cursos WHERE ativo=1 OR id IN
   (SELECT curso FROM progresso WHERE usuario=? AND pontos IS NOT NULL)`).get(u.id).n;
 return {nome:escape(u.nome),email:escape(u.email),inicial:escape(Array.from(u.nome)[0]),total,maximo:Math.max(1,total),
   percentual:total ? Math.round(feitos.length * 100 / total) : 0,
   emCurso:cursos.length-feitos.length,nMedalhas:medalhas.length,concluidos:feitos.length,pontos:feitos.reduce((sum,c)=>sum+c.pontos,0),
   andamento:cursos.filter(c=>c.pontos===null).map(c=>`<li><a class="link-painel" href="/curso/${c.id}">Continuar: ${escape(c.titulo)}</a></li>`).join(''),
   medalhas:medalhas.map(c=>`<li><span aria-hidden="true">🏅</span> ${escape(c.titulo)} · ${escape(c.enunciado)}</li>`).join('')};
}
function video(url) {
 const u = new URL(url);
 const youtube = ['www.youtube.com','youtube.com','m.youtube.com'].includes(u.hostname);
 const id = youtube ? (u.pathname==='/watch' ? u.searchParams.get('v') : u.pathname.match(/^\/(?:shorts|embed)\/([^/]+)/)?.[1]) : u.hostname==='youtu.be' ? u.pathname.slice(1) : '';
 if (/^[\w-]{11}$/.test(id || '')) return `<iframe loading="lazy" title="Vídeo da aula" src="https://www.youtube-nocookie.com/embed/${id}" allowfullscreen></iframe>`;
 if (/\.(mp4|webm|ogv)$/i.test(u.pathname)) return `<video controls preload="none" src="${escape(url)}"></video>`;
 return '';
}
export function aula(c,u,progresso) {
 const fonte = creditos(c) + (c.url ? (c.formato==='Vídeo' ? video(c.url) : '') + `<p><a class="link-painel" href="${escape(c.url)}" target="_blank" rel="noopener noreferrer">Abrir fonte original ↗ (nova aba)</a></p>` : '');
 const concluido = progresso && progresso.pontos !== null;
 return {titulo:escape(c.titulo),categoria:Object.keys(categorias).find(k=>categorias[k]===c.tema),
   tema:escape(c.tema),conteudo:escape(c.conteudo),formato:escape(c.formato),fonte,
   atividade: concluido ? `<p>Curso concluído · ${progresso.pontos} pontos</p><a class="botao" href="/perfil.html">Ver meu perfil</a> <a class="link-painel" href="/curso/${c.id}/atividade">Tentar novamente</a>` :
    u ? `<a class="botao" href="/curso/${c.id}/atividade">Terminei a aula · Responder perguntas</a>` : '<a class="botao" href="/login.html">Entrar para registrar meu progresso</a>'};
}
export function questionario(c) {
 const campos = JSON.parse(c.questoes).map((q,i)=>`<fieldset><legend tabindex="-1">${i+1}. ${escape(q.texto)}</legend>
   <div class="lista-respostas">${q.opcoes.map((op,j)=>`<label class="opcao-resposta"><input required type="radio" name="q${i}" value="${j}"><span>${escape(op)}</span></label>`).join('')}</div></fieldset>`);
 return {id:c.id,titulo:escape(c.titulo),campos:campos.join(''),versao:c.versao};
}
