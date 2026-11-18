"use strict";

const conteudos = [
  {
    titulo: "Conhecendo o teclado e o mouse",
    tema: "Uso do Computador",
    formato: "Texto",
    conteudo: "Conheça as teclas principais e aprenda a apontar, clicar e abrir itens com o mouse.",
    url: "",
  },
  {
    titulo: "Navegação segura na internet",
    tema: "Internet",
    formato: "Vídeo",
    conteudo: "Aprenda a conferir o endereço de um site e identificar links suspeitos antes de clicar.",
    url: "",
  },
];

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

  formulario.addEventListener("submit", (evento) => {
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
    salvar(dados);
    formulario.reset();
  });

  formulario.querySelector('button[type="submit"]').disabled = false;
}

configurarFormulario(formularioInclusao, (dados) => {
  conteudos.push(dados);
  voltarParaLista("Conteúdo incluído.");
});

configurarFormulario(formularioEdicao, (dados) => {
  if (edicao.hidden || !selecionado) return;

  Object.assign(selecionado, dados);
  voltarParaLista("Alterações salvas na lista de demonstração.");
});

document.querySelector("#abrir-inclusao").addEventListener("click", (evento) => {
  evento.preventDefault();
  limparSelecao();
  resultado.textContent = "";
  inclusao.focus();
});

confirmarExclusao.addEventListener("click", () => {
  if (exclusao.hidden || !selecionado) return;

  conteudos.splice(conteudos.indexOf(selecionado), 1);
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

atualizarLista();
