const form = document.querySelector('#atividade');
const campos = [...form.querySelectorAll('fieldset')];
const anterior = document.querySelector('#anterior');
const avancar = document.querySelector('#avancar');
const aviso = document.querySelector('#aviso');
const barra = document.querySelector('#barra');
let atual = 0;

function exibir(indice, focar = true) {
  atual = indice;
  campos.forEach((campo, i) => { campo.hidden = i !== atual; });
  barra.max = campos.length;
  barra.value = atual + 1;
  document.querySelector('#passo').textContent = `Pergunta ${atual + 1} de ${campos.length}`;
  anterior.disabled = atual === 0;
  avancar.textContent = atual === campos.length - 1 ? 'Concluir atividade' : 'Próxima pergunta →';
  aviso.textContent = '';
  if (focar) campos[atual].querySelector('legend').focus();
}

function mostrarResultado(data, respostas) {
  const certos = data.acertos.filter(Boolean).length;
  document.querySelector('#acertos').textContent = `${certos} de ${campos.length}`;
  document.querySelector('#taxa').textContent = Math.round(certos * 100 / campos.length) + '%';
  document.querySelector('#premios').textContent = `Novas medalhas: ${data.novas}. Pontos neste curso: ${data.pontos}.`;
  const lista = document.querySelector('#correcao');
  campos.forEach((campo,i) => {
    const item = document.createElement('li');
    item.className = data.acertos[i] ? 'certa' : 'errada';
    const estado = document.createElement('strong');
    estado.textContent = data.acertos[i] ? '✓ Correta' : '× Incorreta';
    const titulo = document.createElement('h4');
    titulo.textContent = campo.querySelector('legend').textContent;
    const escolha = document.createElement('p');
    escolha.textContent = 'Sua resposta: ' + campo.querySelectorAll('label span')[respostas[i]].textContent;
    const gabarito = document.createElement('p');
    gabarito.textContent = 'Resposta correta: ' + data.corretas[i];
    item.append(estado,titulo,escolha,gabarito);
    lista.append(item);
  });
  form.hidden = true;
  const resultado = document.querySelector('#resultado');
  resultado.hidden = false;
  resultado.focus();
}

anterior.addEventListener('click', () => exibir(atual-1));
form.addEventListener('submit', async evento => {
  evento.preventDefault();
  if (avancar.disabled) return;
  if (!campos[atual].querySelector(':checked')) {
    aviso.textContent = 'Escolha uma alternativa para continuar.';
    campos[atual].querySelector('input').focus();
    return;
  }
  if (atual < campos.length-1) return exibir(atual+1);
  const respostas = campos.map(campo => Number(campo.querySelector(':checked').value));
  avancar.disabled = anterior.disabled = true;
  avancar.textContent = 'Conferindo…';
  try {
    const res = await fetch(location.pathname, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({respostas, versao:Number(form.dataset.versao)})
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.erro);
    aviso.textContent = '';
    mostrarResultado(data,respostas);
  } catch (erro) {
    exibir(atual,false);
    aviso.textContent = erro.message;
    avancar.disabled = false;
  }
});
exibir(0,false);
