// --- CONFIGURAÇÕES E ESTADO DO SISTEMA ---
const API = '/api'; // Define o endereço base da sua API

let cPizzas   = []; // Cache para armazenar a lista de pizzas e evitar requisições repetidas
let cClientes = []; // Cache para armazenar a lista de clientes

// Recupera o Token e os dados do Usuário salvos no navegador para manter o login ativo
let TOKEN          = localStorage.getItem('pz_token') || '';
let USUARIO_LOGADO = JSON.parse(localStorage.getItem('pz_usuario') || 'null');
let mesaEmFechamento = null; // Variável de controle para saber qual mesa está sendo encerrada

/**
 * Realiza o login enviando e-mail e senha para a API.
 * Se houver sucesso, salva o token e o perfil no localStorage.
 */
async function fazerLogin() {
  const email = document.getElementById('l-email').value.trim();
  const senha = document.getElementById('l-senha').value;
  const btn   = document.getElementById('btn-login');
  const erro  = document.getElementById('login-erro');

  if (!email || !senha) {
    erro.style.display = 'block';
    erro.textContent   = 'Preencha e-mail e senha.';
    return;
  }

  // Feedback visual de "carregando"
  btn.disabled    = true;
  btn.textContent = 'Entrando...';
  erro.style.display = 'none';

  try {
    const res  = await fetch(API + '/auth/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, senha }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || 'Credenciais inválidas');

    // Armazena a sessão no navegador
    TOKEN = data.token;
    USUARIO_LOGADO = data.usuario;
    localStorage.setItem('pz_token', TOKEN);
    localStorage.setItem('pz_usuario', JSON.stringify(data.usuario));

    aplicarPerfil(data.usuario); // Ajusta o que o usuário pode ver
    document.body.classList.add('logado');

  } catch (e) {
    erro.style.display = 'block';
    erro.textContent   = e.message;
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Entrar';
  }
}

/**
 * Remove os dados de login e volta para a tela inicial.
 */
function sair() {
  TOKEN = '';
  USUARIO_LOGADO = null;
  localStorage.removeItem('pz_token');
  localStorage.removeItem('pz_usuario');
  document.body.classList.remove('logado');
  document.getElementById('l-senha').value = '';
}

// Verifica se já existe um token salvo ao abrir o site para logar automático
if (TOKEN && USUARIO_LOGADO) {
  aplicarPerfil(USUARIO_LOGADO);
  document.body.classList.add('logado');
}

/**
 * Exibe uma notificação rápida (Toast) no site.
 */
function toast(msg, tipo = 'ok') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = `show ${tipo}`;
  setTimeout(() => el.className = '', 3000);
}

// Funções para manipular a abertura e fechamento de janelas modais
function abrir(id)  { document.getElementById(id).classList.add('open'); }
function fechar(id) { document.getElementById(id).classList.remove('open'); }

// Fecha modais ao clicar na área escura (background)
document.querySelectorAll('.modal-bg').forEach(bg =>
  bg.addEventListener('click', e => { if (e.target === bg) bg.classList.remove('open'); })
);

/**
 * Formata números para o padrão de moeda Real (R$).
 */
function R$(v) {
  return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');
}

/**
 * Retorna uma tag HTML com ícone e cor baseada no status do pedido.
 */
function badge(s) {
  const r = {
    recebido:     '📥 Recebido',
    em_preparo:   '👨‍🍳 Em Preparo',
    saiu_entrega: '🛵 Saiu p/ Entrega',
    entregue:     '✅ Entregue',
    cancelado:    '❌ Cancelado',
  };
  return `<span class="badge b-${s}">${r[s] || s}</span>`;
}

/**
 * Função centralizadora para requisições HTTP (GET, POST, etc).
 * Inclui o Token Bearer automaticamente e trata erro 401 (deslogado).
 */
async function api(method, url, body) {
  const opts = {
    method,
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${TOKEN}`,
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res  = await fetch(API + url, opts);
  const data = await res.json();

  if (res.status === 401) { sair(); throw new Error('Sessão expirada'); }
  if (!res.ok) throw new Error(data.erro || 'Erro na requisição');
  return data;
}

/**
 * Gerencia o que cada cargo (Admin ou Garçom) pode acessar na interface.
 */
function aplicarPerfil(usuario) {
  document.getElementById('sb-nome').textContent   = usuario.nome;
  document.getElementById('sb-perfil').textContent = usuario.perfil;

  const perfil  = usuario.perfil;
  const isAdmin = perfil === 'Administrador';
  const isGar   = perfil === 'Garcom';

  function show(id, visible, type = 'flex') {
    const el = document.getElementById(id);
    if (el) el.style.display = visible ? type : 'none';
  }

  function showEl(el, visible, type = 'flex') {
    if (el) el.style.display = visible ? type : 'none';
  }

  // Esconde menus de faturamento e usuários se não for Administrador
  show('menu-usuarios',   isAdmin, 'block');
  show('btn-usuarios',    isAdmin, 'flex');
  show('sb-group-garcom', isGar,   'block');
  show('btn-nav-mesas',   isGar,   'flex');

  showEl(document.querySelector('[onclick*="clientes"]'),  !isGar);
  showEl(document.querySelector('[onclick*="pedidos"]'),   !isGar);
  showEl(document.querySelector('[onclick*="dashboard"]'), !isGar);
  showEl(document.querySelector('.sb-group'), !isGar, 'block');

  // Ajusta títulos da página de acordo com o perfil
  const labelPizzas = document.getElementById('nav-pizzas-label');
  if (labelPizzas) labelPizzas.textContent = isGar ? 'Cardápio' : 'Pizzas';

  const tituloPizzas = document.getElementById('pg-pizzas-titulo');
  const subPizzas    = document.getElementById('pg-pizzas-sub');
  if (tituloPizzas) tituloPizzas.textContent = isGar ? 'Cardápio' : 'Pizzas';
  if (subPizzas)    subPizzas.textContent    = isGar ? 'Pizzas disponíveis hoje' : 'Gerencie o cardápio';
  show('btn-nova-pizza', !isGar, 'inline-flex');

  show('stat-fat', !isGar, 'block');
  show('stat-cli', !isGar, 'block');

  // Redireciona para a tela inicial de cada cargo
  if (isGar) {
    ir('mesas', document.getElementById('btn-nav-mesas'));
  } else {
    ir('dashboard', document.querySelector('[onclick*="dashboard"]'));
  }
}

/**
 * Busca os pedidos ativos das mesas e gera os cards visuais.
 */
async function carregarMesas(mesaFiltro = null) {
  const grid = document.getElementById('grid-mesas');
  grid.innerHTML = '<div class="spin-wrap"><div class="spin"></div> Carregando...</div>';

  document.getElementById('mesas-sub').textContent =
    `Olá, ${USUARIO_LOGADO?.nome}! Seus pedidos ativos.`;

  try {
    const url = `/pedidos?garcom=${USUARIO_LOGADO.id}`;
    const pedidos = await api('GET', url);

    const ativos = pedidos.filter(p => !['entregue','cancelado'].includes(p.status));

    // Atualiza estatísticas rápidas
    document.getElementById('g-ped').textContent     = pedidos.length;
    document.getElementById('g-ped-sub').textContent = `${ativos.length} ativo(s)`;

    const mesasAtivas = new Set(ativos.map(p => p.mesa).filter(Boolean));
    document.getElementById('g-mesas').textContent   = mesasAtivas.size;
    document.getElementById('g-preparo').textContent = ativos.filter(p => p.status === 'em_preparo').length;
    document.getElementById('g-prontos').textContent = ativos.filter(p => p.status === 'saiu_entrega').length;

    // Gera os botões de 1 a 10 para filtro de mesa
    const botoes = document.getElementById('mesa-botoes');
    botoes.innerHTML = Array.from({length: 10}, (_, i) => {
      const n      = i + 1;
      const temPed = mesasAtivas.has(n);
      const ativo  = mesaFiltro === n;
      return `
        <button class="btn btn-sm ${ativo ? 'btn-red' : temPed ? 'btn-green' : 'btn-ghost'}"
          onclick="carregarMesas(${n})"
          title="${temPed ? 'Mesa com pedido ativo' : 'Mesa livre'}">
          ${n}${temPed ? ' 🔴' : ''}
        </button>`;
    }).join('');

    const pedidosFiltrados = mesaFiltro
      ? ativos.filter(p => p.mesa === mesaFiltro)
      : ativos;

    if (!pedidosFiltrados.length) {
      grid.innerHTML = `
        <div class="empty" style="grid-column:1/-1">
          <span class="ei">🪑</span>
          Nenhum pedido ativo no momento.<br>
          <button class="btn btn-red" style="margin-top:12px" onclick="abrirPedidoMesa()">
            + Abrir primeiro pedido
          </button>
        </div>`;
      return;
    }

    // Organiza os pedidos por mesa para exibição
    const porMesa = {};
    pedidosFiltrados.forEach(p => {
      const key = p.mesa || 'balcão';
      if (!porMesa[key]) porMesa[key] = [];
      porMesa[key].push(p);
    });

    // Gera o HTML dos cartões de cada mesa
    grid.innerHTML = Object.entries(porMesa).map(([mesa, peds]) => {
      const totalMesa  = peds.reduce((s, p) => s + (p.total || 0), 0);
      const todosItens = peds.flatMap(p => p.itens);
      const itensAgrup = {};
      todosItens.forEach(it => {
        const k = `${it.nomePizza} (${it.tamanho})`;
        itensAgrup[k] = (itensAgrup[k] || 0) + it.quantidade;
      });
      const statusAtual = peds[peds.length - 1]?.status;

      return `
        <div class="mesa-card">
          <div class="mesa-card-head">
            <div>
              <div class="mesa-num">Mesa ${mesa}</div>
              <div style="font-size:.72rem;color:var(--muted);margin-top:2px">
                ${peds.length} pedido(s) · ${peds[0]?.cliente?.nome || 'Sem cadastro'}
              </div>
            </div>
            ${badge(statusAtual)}
          </div>
          <div class="mesa-card-body">
            ${Object.entries(itensAgrup).map(([nome, qtd]) => `
              <div class="mesa-item">
                <strong>${qtd}x ${nome}</strong>
              </div>`).join('')}
            <div class="mesa-total">
              <span style="color:var(--muted)">Total da mesa</span>
              <span style="color:var(--gold)">${R$(totalMesa)}</span>
            </div>
          </div>
          <div class="mesa-card-foot">
            <button class="btn btn-ghost btn-sm" style="flex:1"
              onclick="abrirPedidoMesa(${mesa})">
              + Item
            </button>
            <button class="btn btn-blue btn-sm"
              onclick="abrirStatus('${peds[peds.length-1]?._id}','${statusAtual}')">
              📝 Status
            </button>
            <button class="btn btn-green btn-sm"
              onclick="abrirFecharMesa(${mesa}, ${totalMesa}, '${peds.map(p=>p._id).join(',')}')">
              ✅ Fechar
            </button>
          </div>
        </div>`;
    }).join('');

  } catch (e) {
    grid.innerHTML = `<div class="empty" style="color:var(--red)">${e.message}</div>`;
  }
}

/**
 * Prepara o modal para um novo pedido em mesa, carregando cardápio e clientes.
 */
async function abrirPedidoMesa(mesaNum = null) {
  try {
    if (!cPizzas.length)   cPizzas   = await api('GET', '/pizzas');
    if (!cClientes.length) cClientes = await api('GET', '/clientes');
  } catch (e) { toast('Erro ao carregar dados', 'err'); return; }

  document.getElementById('pm-cli').innerHTML =
    '<option value="">— Sem cadastro —</option>' +
    cClientes.map(c => `<option value="${c._id}">${c.nome} · ${c.telefone}</option>`).join('');

  document.getElementById('pm-mesa').value = mesaNum || '';
  document.getElementById('itens-mesa-lista').innerHTML = '';
  document.getElementById('pm-obs').value  = '';
  document.getElementById('pm-sub').textContent = 'R$ 0,00';
  document.getElementById('pm-tot').textContent = 'R$ 0,00';

  addItemMesa();
  abrir('m-pedido-mesa');
}

/**
 * Adiciona uma linha de pizza ao formulário de pedido da mesa.
 */
function addItemMesa() {
  const d = document.createElement('div');
  d.className = 'item-row';
  const opts = cPizzas.filter(p => p.disponivel)
    .map(p => `<option value="${p._id}"
      data-p="${p.precos?.P||0}" data-m="${p.precos?.M||0}" data-g="${p.precos?.G||0}">
      ${p.nome}</option>`).join('');
  d.innerHTML = `
    <select class="ip" onchange="recalcMesa()"><option value="">Selecione...</option>${opts}</select>
    <select class="it" onchange="recalcMesa()">
      <option value="P">P</option><option value="M">M</option><option value="G" selected>G</option>
    </select>
    <input class="iq" type="number" value="1" min="1" oninput="recalcMesa()">
    <div class="is" style="font-size:.8rem;text-align:right;color:var(--muted)">R$ 0,00</div>
    <button class="btn-rm" onclick="this.parentElement.remove();recalcMesa()">×</button>`;
  document.getElementById('itens-mesa-lista').appendChild(d);
}

/**
 * Calcula o valor total do pedido da mesa lendo os preços guardados nos atributos data-p/m/g.
 */
function recalcMesa() {
  let sub = 0;
  document.querySelectorAll('#itens-mesa-lista .item-row').forEach(row => {
    const sel = row.querySelector('.ip');
    const tam = row.querySelector('.it').value.toLowerCase();
    const qtd = parseInt(row.querySelector('.iq').value) || 0;
    const pc  = parseFloat(sel.options[sel.selectedIndex]?.dataset?.[tam] || 0);
    const s   = pc * qtd; sub += s;
    row.querySelector('.is').textContent = R$(s);
  });
  document.getElementById('pm-sub').textContent = R$(sub);
  document.getElementById('pm-tot').textContent = R$(sub);
}

/**
 * Envia o pedido da mesa para a API. Se não houver cliente, cria um automático "Mesa X".
 */
async function salvarPedidoMesa() {
  const mesa = parseInt(document.getElementById('pm-mesa').value) || 0;
  if (!mesa || mesa < 1) { toast('Selecione a mesa', 'err'); return; }

  const cliId = document.getElementById('pm-cli').value || null;
  const itens = []; let valido = true;
  document.querySelectorAll('#itens-mesa-lista .item-row').forEach(row => {
    const pid = row.querySelector('.ip').value;
    if (!pid) { valido = false; return; }
    itens.push({
      pizza:      pid,
      tamanho:    row.querySelector('.it').value,
      quantidade: parseInt(row.querySelector('.iq').value) || 1,
    });
  });

  if (!valido || !itens.length) { toast('Adicione ao menos um item', 'err'); return; }

  let clienteId = cliId;
  if (!clienteId) {
    try {
      const todos = await api('GET', `/clientes?busca=Mesa ${mesa}`);
      const existe = todos.find(c => c.nome === `Mesa ${mesa}`);
      if (existe) {
        clienteId = existe._id;
      } else {
        const novo = await api('POST', '/clientes', { nome: `Mesa ${mesa}`, telefone: 'Mesa' });
        clienteId = novo._id;
        cClientes = [];
      }
    } catch (e) { toast('Erro ao registrar mesa', 'err'); return; }
  }

  try {
    await api('POST', '/pedidos', {
      cliente:        clienteId,
      itens,
      taxaEntrega:    0,
      formaPagamento: 'pix',
      observacoes:    document.getElementById('pm-obs').value,
      mesa,
      origem:         'mesa',
      garcom:         USUARIO_LOGADO?.id,
    });
    toast(`Pedido lançado na Mesa ${mesa}! 🍕`);
    fechar('m-pedido-mesa');
    carregarMesas();
  } catch (e) { toast('Erro: ' + e.message, 'err'); }
}

/**
 * Prepara o fechamento da conta da mesa.
 */
function abrirFecharMesa(mesa, total, ids) {
  mesaEmFechamento = { mesa, total, ids: ids.split(',') };
  document.getElementById('fm-titulo').textContent = `Fechar Mesa ${mesa}`;
  document.getElementById('fm-total').textContent  = R$(total);
  document.getElementById('fm-resumo').innerHTML   =
    `<p style="font-size:.82rem;color:var(--muted)">
      ${mesaEmFechamento.ids.length} pedido(s) serão marcados como <strong style="color:var(--green)">Entregue</strong>.
    </p>`;
  abrir('m-fechar-mesa');
}

/**
 * Confirma o fechamento e atualiza todos os pedidos daquela mesa para "entregue".
 */
async function confirmarFechamento() {
  if (!mesaEmFechamento) return;

  try {
    await Promise.all(
      mesaEmFechamento.ids.map(id =>
        api('PATCH', `/pedidos/${id}/status`, { status: 'entregue' })
      )
    );
    toast(`Mesa ${mesaEmFechamento.mesa} fechada! ✅`);
    fechar('m-fechar-mesa');
    mesaEmFechamento = null;
    carregarMesas();
  } catch (e) { toast('Erro: ' + e.message, 'err'); }
}

/**
 * Sistema de roteamento simples para trocar entre as telas (dashboard, pedidos, mesas, etc).
 */
function ir(pg, btn) {
  const perfil = document.getElementById('sb-perfil').textContent;
  if (pg === 'usuarios' && perfil !== 'Administrador') {
    toast('Acesso restrito a Administradores', 'err'); return;
  }
  if (pg === 'mesas' && perfil !== 'Garcom') {
    toast('Área exclusiva para Garçom', 'err'); return;
  }
  if (perfil === 'Garcom' && !['mesas','pizzas'].includes(pg)) {
    toast('Acesso não permitido para Garçom', 'err'); return;
  }
  document.querySelectorAll('.secao').forEach(s => s.classList.remove('ativa'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('ativo'));
  document.getElementById('pg-' + pg).classList.add('ativa');
  if (btn) btn.classList.add('ativo');

  // Chama a função de carregar os dados específicos da tela
  const loaders = {
    dashboard: carregarDashboard,
    pedidos:   carregarPedidos,
    pizzas:    carregarPizzas,
    clientes:  carregarClientes,
    usuarios:  carregarUsuarios,
    mesas:     carregarMesas,
  };
  if (loaders[pg]) loaders[pg]();
}

/**
 * Carrega os dados estatísticos da tela principal (Admin).
 */
async function carregarDashboard() {
  const h = new Date().getHours();
  const s = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  document.getElementById('dash-sub').textContent = `${s}! Aqui está o resumo.`;

  try {
    const [pizzas, clientes, pedidos] = await Promise.all([
      api('GET', '/pizzas'),
      api('GET', '/clientes'),
      api('GET', '/pedidos'),
    ]);

    cPizzas   = pizzas;
    cClientes = clientes;

    document.getElementById('s-piz').textContent = pizzas.length;
    document.getElementById('s-cli').textContent = clientes.length;
    document.getElementById('s-ped').textContent = pedidos.length;
    document.getElementById('s-ent').textContent =
      pedidos.filter(p => p.status === 'saiu_entrega').length;
    document.getElementById('s-fat').textContent =
      R$(pedidos.reduce((acc, p) => acc + (p.total || 0), 0));

    const pend = pedidos.filter(p => !['entregue','cancelado'].includes(p.status)).length;
    document.getElementById('s-ped-sub').textContent = `${pend} pendente(s)`;

    // Renderiza tabelas resumidas no Dashboard
    const elP = document.getElementById('dash-pedidos');
    elP.innerHTML = pedidos.slice(0, 8).map(p => `
      <div class="mini-row">
        <div>
          <div class="mn">#${String(p.numeroPedido || '?').padStart(3,'0')} · ${p.cliente?.nome || '—'}</div>
          <div class="mc">${new Date(p.createdAt).toLocaleString('pt-BR')}</div>
        </div>
        <div style="text-align:right">
          ${badge(p.status)}<br>
          <small style="color:var(--muted)">${R$(p.total)}</small>
        </div>
      </div>`).join('') ||
      '<div class="empty"><span class="ei">📋</span>Nenhum pedido ainda</div>';

  } catch (e) { toast('Erro dashboard: ' + e.message, 'err'); }
}

// ... As funções seguintes (carregarPizzas, carregarClientes, etc) 
// seguem o mesmo padrão de buscar na API e renderizar em tabelas HTML.

async function carregarPizzas() {
  const el = document.getElementById('tbl-pizzas');
  el.innerHTML = '<div class="spin-wrap"><div class="spin"></div> Carregando...</div>';
  try {
    cPizzas = await api('GET', '/pizzas');
    if (!cPizzas.length) {
      el.innerHTML = '<div class="empty"><span class="ei">🍕</span>Nenhuma pizza</div>';
      return;
    }
    el.innerHTML = `
      <table>
        <thead>
          <tr><th>Nome</th><th>Categoria</th><th>Ingredientes</th><th>P</th><th>M</th><th>G</th><th>Status</th><th>Ações</th>
        </thead>
        <tbody>
          ${cPizzas.map(p => `
            <tr>
              <td><strong>${p.nome}</strong><br><small style="color:var(--muted)">${p.descricao || ''}</small></td>
              <td><span class="badge b-cat">${p.categoria || 'tradicional'}</span></td>
              <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.ingredientes}</td>
              <td>${R$(p.precos?.P)}</td>
              <td>${R$(p.precos?.M)}</td>
              <td><strong style="color:var(--gold)">${R$(p.precos?.G)}</strong></td>
              <td><span class="badge ${p.disponivel ? 'b-on' : 'b-off'}">${p.disponivel ? '✅ Disponível' : '❌ Off'}</span></td>
              <td><div style="display:flex;gap:5px"><button class="btn btn-ghost btn-sm" onclick="editarPizza('${p._id}')">✏️</button><button class="btn btn-danger btn-sm" onclick="deletarPizza('${p._id}','${p.nome}')">🗑️</button></div></td>
             </tr>`).join('')}
        </tbody>
      </table>`;
  } catch (e) {
    el.innerHTML = `<div class="empty" style="color:var(--red)">${e.message}</div>`;
  }
}

// ... (Resto do código mantido idêntico) ...