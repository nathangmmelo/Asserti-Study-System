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

let sequencia = 0;

function numerarPerguntas(lista) {
  [...lista.children].forEach((campo, i) => {
    campo.querySelector("legend").textContent = `Pergunta ${i + 1}`;
    campo.querySelector(".remover-pergunta").disabled = lista.childElementCount === 1;
  });
}

function adicionarPergunta(lista, pergunta = {}) {
  const campo = document.querySelector("#modelo-pergunta").content.firstElementChild.cloneNode(true);
  const grupo = "gabarito-" + (++sequencia);
  if (pergunta.id) campo.dataset.id = pergunta.id;
  campo.querySelector(".enunciado").value = pergunta.texto || "";
  const alternativas = campo.querySelector(".alternativas");

  function numerarAlternativas() {
    [...alternativas.children].forEach((linha, i) => {
      const nome = "Alternativa " + (i + 1);
      linha.querySelector("span").textContent = nome;
      linha.querySelector("input[type=radio]").setAttribute("aria-label", nome + " correta");
      const remover = linha.querySelector("button");
      remover.setAttribute("aria-label", "Remover alternativa " + (i + 1));
      remover.disabled = alternativas.childElementCount <= 2;
    });
  }

  function adicionarAlternativa(texto = "", correta = false) {
    const linha = document.querySelector("#modelo-alternativa").content.firstElementChild.cloneNode(true);
    const resposta = linha.querySelector(".texto-alternativa");
    resposta.value = texto;
    const radio = linha.querySelector("input[type=radio]");
    radio.name = grupo;
    radio.checked = correta;
    linha.querySelector("button").onclick = () => {
      linha.remove();
      numerarAlternativas();
      campo.querySelector(".adicionar-alternativa").focus();
    };
    alternativas.append(linha);
    numerarAlternativas();
    return resposta;
  }

  (pergunta.opcoes || ["", ""]).forEach((texto, i) => adicionarAlternativa(texto, pergunta.correta === i));
  campo.querySelector(".adicionar-alternativa").onclick = () => adicionarAlternativa().focus();
  campo.querySelector(".remover-pergunta").onclick = () => {
    campo.remove();
    numerarPerguntas(lista);
    lista.parentElement.querySelector(".adicionar-pergunta").focus();
  };
  lista.append(campo);
  numerarPerguntas(lista);
  return campo;
}

function montarPerguntas(formulario, perguntas) {
  const lista = formulario.querySelector(".perguntas");
  lista.replaceChildren();
  perguntas.forEach(q => adicionarPergunta(lista, q));
  formulario.querySelector(".adicionar-pergunta").onclick = () =>
    adicionarPergunta(lista).querySelector(".enunciado").focus();
}

function lerPerguntas(formulario) {
  return [...formulario.querySelectorAll(".editor-pergunta")].map(campo => ({
    id: campo.dataset.id,
    texto: campo.querySelector(".enunciado").value.trim(),
    opcoes: [...campo.querySelectorAll(".texto-alternativa")].map(input => input.value.trim()),
    correta: [...campo.querySelectorAll("input[type=radio]")].findIndex(input => input.checked)
  }));
}

montarPerguntas(formularioInclusao, [{}]);

function limparSelecao() {
  selecionado = null;
  secaoLista.hidden = false;
  inclusao.hidden = true;
  edicao.hidden = true;
  exclusao.hidden = true;
}

function selecionarConteudo(evento, item, secao) {
  evento.preventDefault();
  limparSelecao();
  selecionado = item;
  resultado.textContent = "";

  if (secao === edicao) {
    montarPerguntas(formularioEdicao, item.questoes);
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

  secaoLista.hidden = true;
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
  const voltar = formulario.querySelector(".fechar-formulario");
  voltar.addEventListener("click", () => voltarParaLista(""));
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
      if (!campo.startsWith("gabarito-")) dados[campo] = valor.trim();
    }
    dados.questoes = lerPerguntas(formulario);
    const botao = formulario.querySelector('button[type="submit"]');
    botao.disabled = true;
    voltar.disabled = true;
    try {
      await salvar(dados);
      formulario.reset();
      montarPerguntas(formulario, [{}]);
    } catch (erro) {
      const aviso = formulario.querySelector("[role=status]");
      aviso.textContent = erro.message;
    } finally {
      botao.disabled = false;
      voltar.disabled = false;
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
  const {id,questoes} = await requisicao("/api/cursos", "POST", dados);
  conteudos.push({...dados, id, questoes, versao:1});
  voltarParaLista("Conteúdo incluído.");
});
configurarFormulario(formularioEdicao, async dados => {
  const alvo = selecionado;
  const {questoes} = await requisicao("/api/cursos/"+alvo.id, "PUT", {...dados, versao:alvo.versao});
  Object.assign(alvo, dados, {questoes, versao:alvo.versao+1});
  voltarParaLista("Alterações salvas.");
});

document.querySelector("#abrir-inclusao").addEventListener("click", (evento) => {
  evento.preventDefault();
  limparSelecao();
  resultado.textContent = "";
  secaoLista.hidden = true;
  inclusao.hidden = false;
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
