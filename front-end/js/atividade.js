const form = document.querySelector('#atividade');
form.addEventListener('submit', async evento => {
  evento.preventDefault();
  const botao = form.querySelector('button');
  botao.disabled = true;
  try {
    const respostas = [...new FormData(form).values()].map(Number);
    const result = await fetch(location.pathname, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({respostas, versao:Number(form.dataset.versao)})
    });
    const data = await result.json();
    if (!result.ok) throw new Error(data.erro);
    form.hidden = true;
    document.querySelector('#resultado').textContent = 'Atividade concluída. Pontos registrados: ' + data.pontos + '.';
    document.querySelector('.link-painel').focus();
  } catch (erro) {
    document.querySelector('#resultado').textContent = erro.message;
    botao.disabled = false;
  }
});
