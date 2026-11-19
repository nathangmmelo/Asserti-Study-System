const form = document.querySelector('.formulario-acesso');
const cadastro = Boolean(form.elements.nome);
const aviso = document.querySelector('[role="status"]');
if (!cadastro && location.search === '?cadastro=ok') aviso.textContent = 'Conta criada. Entre com seu e-mail e senha.';
form.addEventListener('submit', async evento => {
  evento.preventDefault();
  const dados = Object.fromEntries(new FormData(form));
  if (cadastro && dados.senha !== dados['confirmar-senha']) {
    aviso.textContent = 'As senhas precisam ser iguais.';
    form.elements['confirmar-senha'].focus();
    return;
  }
  const botao = form.querySelector('button');
  botao.disabled = true;
  try {
    const resposta = await fetch(cadastro ? '/api/cadastro' : '/api/login', {
      method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(dados)
    });
    if (!resposta.ok) throw new Error((await resposta.json()).erro);
    location.assign(cadastro ? '/login.html?cadastro=ok' : '/');
  } catch (erro) {
    aviso.textContent = erro.message;
    botao.disabled = false;
  }
});
