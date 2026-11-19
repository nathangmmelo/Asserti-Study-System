"use strict";

let conteudos = [];

const secaoLista = document.querySelector("#lista-conteudos");
const lista = document.querySelector(".lista-admin-conteudos");
const estadoVazio = document.querySelector(".estado-vazio");
const modelo = document.querySelector("#modelo-conteudo");
const resultado = document.querySelector("#resultado-admin");
const inclusao = document.querySelector("#incluir-conteudo");
const edicao = document.querySelector("#editar-conteudo");
const exclusao = document.querySelector("#confirmar-exclusao");
const formularioInclusao = inclusao.querySelector("form");
const formularioEdicao = edicao.querySelector("form");
const nomeEdicao = document.querySelector("#nome-edicao");
const nomeExclusao = document.querySelector("#nome-exclusao");
const confirmarExclusao = exclusao.querySelector("button");

let selecionado = null;

function limparSelecao() {
  selecionado = null;
  edicao.hidden = true;
  exclusao.hidden = true;
}

function selecionarConteudo(evento, item, secao) {
  evento.preventDefault();
  limparSelecao();
  selecionado = item;
  resultado.textContent = "";

  if (secao === edicao) {
    nomeEdicao.textContent = item.titulo;

    for (const [campo, valor] of Object.entries(item)) {
      const controle = formularioEdicao.elements.namedItem(campo);
      if (!controle) continue;
      controle.value = valor;
      controle.setCustomValidity("");
    }
  } else {
    nomeExclusao.textContent = `“${item.titulo}”`;
  }

  secao.hidden = false;
  secao.focus();
}

function atualizarLista() {
  const itens = conteudos.map((item) => {
    const linha = modelo.content.firstElementChild.cloneNode(true);
    linha.querySelector("h3").textContent = item.titulo;
    linha.querySelector("p").textContent = `${item.tema} · ${item.formato}`;

    const [linkEditar, linkExcluir] = linha.querySelectorAll(".acoes-admin a");
    linkEditar.setAttribute("aria-label", `Editar: ${item.titulo}`);
    linkExcluir.setAttribute("aria-label", `Excluir: ${item.titulo}`);
    linkEditar.addEventListener("click", (evento) => selecionarConteudo(evento, item, edicao));
    linkExcluir.addEventListener("click", (evento) => selecionarConteudo(evento, item, exclusao));
    return linha;
  });

  lista.replaceChildren(...itens);
  estadoVazio.hidden = conteudos.length > 0;
}

function voltarParaLista(mensagem) {
  limparSelecao();
  atualizarLista();
  resultado.textContent = mensagem;
  secaoLista.focus();
}

function configurarFormulario(formulario, salvar) {
  formulario.addEventListener("input", (evento) => {
    evento.target.setCustomValidity("");
  });

  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    for (const campo of ["titulo", "conteudo"]) {
      const controle = formulario.elements.namedItem(campo);
      if (!controle.value.trim()) {
        controle.setCustomValidity("Preencha este campo com texto.");
        controle.reportValidity();
        return;
      }
    }

    const dados = {};
    for (const [campo, valor] of new FormData(formulario)) {
      dados[campo] = valor.trim();
    }
    const botao = formulario.querySelector('button[type="submit"]');
    botao.disabled = true;
    try {
      await salvar(dados);
      formulario.reset();
    } catch (erro) {
      const aviso = formulario.querySelector("[role=status]");
      aviso.textContent = erro.message;
    } finally {
      botao.disabled = false;
    }
  });

  formulario.querySelector('button[type="submit"]').disabled = false;
}

async function requisicao(url, metodo = "GET", dados) {
  const resposta = await fetch(url, {
    method: metodo, headers: {"Content-Type": "application/json"},
    body: JSON.stringify(dados)
  });
  const resultado = await resposta.json();
  if (!resposta.ok) throw new Error(resultado.erro);
  return resultado;
}

async function carregar() {
  conteudos = await requisicao("/api/cursos");
  atualizarLista();
}
configurarFormulario(formularioInclusao, async dados => {
  const {id} = await requisicao("/api/cursos", "POST", dados);
  conteudos.push({...dados, id, versao:1});
  voltarParaLista("Conteúdo incluído.");
});
configurarFormulario(formularioEdicao, async dados => {
  const alvo = selecionado;
  await requisicao("/api/cursos/"+alvo.id, "PUT", {...dados, versao:alvo.versao});
  Object.assign(alvo, dados, {versao:alvo.versao+1});
  voltarParaLista("Alterações salvas.");
});

document.querySelector("#abrir-inclusao").addEventListener("click", (evento) => {
  evento.preventDefault();
  limparSelecao();
  resultado.textContent = "";
  inclusao.focus();
});

confirmarExclusao.addEventListener("click", async () => {
  if (exclusao.hidden || !selecionado) return;

  const alvo = selecionado;
  confirmarExclusao.disabled = true;
  try {
    await requisicao("/api/cursos/"+alvo.id, "DELETE", {versao:alvo.versao});
  } catch (erro) {
    exclusao.querySelector("[role=status]").textContent = erro.message;
    return;
  } finally {
    confirmarExclusao.disabled = false;
  }
  conteudos.splice(conteudos.indexOf(alvo), 1);
  const mensagem = conteudos.length ? "Conteúdo excluído." : "Conteúdo excluído. A lista está vazia.";
  voltarParaLista(mensagem);
});
confirmarExclusao.disabled = false;

document.querySelector("#cancelar-exclusao").addEventListener("click", (evento) => {
  evento.preventDefault();
  limparSelecao();
  resultado.textContent = "Exclusão cancelada.";
  secaoLista.focus();
});

carregar().catch(erro => { resultado.textContent = erro.message; });
