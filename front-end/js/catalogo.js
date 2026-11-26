const busca = document.querySelector('#busca');
const grupos = [...document.querySelectorAll('.grupo-cursos')];
const aviso = document.querySelector('#estado-busca');
const normalizar = texto => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function filtrar() {
  const termo = normalizar(busca.value.trim());
  let total = 0;
  for (const grupo of grupos) {
    const categoria = normalizar(grupo.querySelector('h3').textContent);
    let encontrados = 0;
    for (const curso of grupo.querySelectorAll('.curso')) {
      const nome = normalizar(curso.querySelector('h4').textContent);
      curso.hidden = !(categoria.includes(termo) || nome.includes(termo));
      if (!curso.hidden) encontrados++;
    }
    grupo.hidden = Boolean(termo) && !encontrados;
    grupo.open = termo ? Boolean(encontrados) : grupo === grupos[0];
    total += encontrados;
  }
  aviso.textContent = termo ? (total ? `Materiais encontrados: ${total}.` : 'Nenhuma aula encontrada. Tente outra palavra.') : '';
}

function abrirDestino() {
  const grupo = grupos.find(item => '#' + item.id === location.hash);
  if (grupo) {
    if (busca.value) { busca.value = ''; filtrar(); }
    grupo.open = true;
    grupo.scrollIntoView();
  }
}

busca.addEventListener('input', filtrar);
window.addEventListener('hashchange', abrirDestino);
document.querySelectorAll('.categoria-tile').forEach(link => link.addEventListener('click', () => {
  if (link.hash === location.hash) abrirDestino();
}));
abrirDestino();
