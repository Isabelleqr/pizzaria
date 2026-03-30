const express  = require('express');
const jwt      = require('jsonwebtoken');
const router   = express.Router();
const auth     = require('../middlewares/auth'); // O "porteiro" que vimos antes

// Importação dos Modelos (os arquivos que conversam direto com as tabelas do banco)
const Usuario  = require('../models/Usuario');
const Pizza    = require('../models/Pizza');
const Cliente  = require('../models/Cliente');
const Pedido   = require('../models/Pedido');

/**
 * SEÇÃO DE AUTENTICAÇÃO
 */
router.post('/auth/login', async (req, res) => {
  try {
    const { email, senha } = req.body;
    if (!email || !senha) return res.status(400).json({ erro: 'E-mail e senha são obrigatórios' });

    // Busca o usuário e verifica se a senha bate (usando bcrypt)
    const usuario = await Usuario.findByEmail(email);
    if (!usuario) return res.status(401).json({ erro: 'Credenciais inválidas' });

    const ok = await Usuario.verificarSenha(senha, usuario.senha);
    if (!ok) return res.status(401).json({ erro: 'Credenciais inválidas' });

    // Cria o Token JWT que vale por 8 horas
    const token = jwt.sign(
      { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({ token, usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil } });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

/**
 * SEÇÃO DE PIZZAS (CRUD)
 * Note que todas as rotas abaixo usam o middleware 'auth'
 */
router.get('/pizzas', auth, async (req, res) => {
  try { res.json(await Pizza.findAll()); }
  catch (e) { res.status(500).json({ erro: e.message }); }
});

router.post('/pizzas', auth, async (req, res) => {
  try {
    if (!req.body.nome || !req.body.ingredientes)
      return res.status(400).json({ erro: 'Nome e ingredientes são obrigatórios' });
    res.status(201).json(await Pizza.create(req.body));
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// ... (GET por ID, PUT e DELETE seguem a mesma lógica de verificar existência e agir)

/**
 * SEÇÃO DE CLIENTES
 */
router.get('/clientes', auth, async (req, res) => {
  try { 
    // Aceita um parâmetro de busca (ex: /api/clientes?busca=João)
    res.json(await Cliente.findAll(req.query.busca)); 
  }
  catch (e) { res.status(500).json({ erro: e.message }); }
});

/**
 * SEÇÃO DE PEDIDOS
 */
router.post('/pedidos', auth, async (req, res) => {
  try {
    const { cliente, itens, formaPagamento } = req.body;
    if (!cliente || !itens?.length || !formaPagamento)
      return res.status(400).json({ erro: 'cliente, itens e formaPagamento são obrigatórios' });

    const novo = await Pedido.create({
      clienteId:      cliente,
      itens,
      taxaEntrega:    req.body.taxaEntrega,
      formaPagamento,
      troco:          req.body.troco,
      observacoes:    req.body.observacoes,
      mesa:           req.body.mesa,
      origem:         req.body.origem,
      // Se não vier um garçom específico, usa o ID de quem está logado
      garcomId:       req.body.garcom || req.usuario?.id,
    });
    res.status(201).json(novo);
  } catch (e) { res.status(400).json({ erro: e.message }); }
});

// Rota específica para mudar o status (ex: de 'recebido' para 'em_preparo')
router.patch('/pedidos/:id/status', auth, async (req, res) => {
  try {
    const validos = ['recebido','em_preparo','saiu_entrega','entregue','cancelado'];
    if (!validos.includes(req.body.status))
      return res.status(400).json({ erro: 'Status inválido' });
    const p = await Pedido.updateStatus(req.params.id, req.body.status);
    if (!p) return res.status(404).json({ erro: 'Pedido não encontrado' });
    res.json(p);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

/**
 * SEÇÃO DE USUÁRIOS (GESTÃO DO SISTEMA)
 * Estas rotas verificam se req.usuario.perfil é 'Administrador'
 */
router.get('/usuarios', auth, async (req, res) => {
  try {
    if (req.usuario.perfil !== 'Administrador')
      return res.status(403).json({ erro: 'Acesso restrito a Administradores' });
    res.json(await Usuario.findAll());
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

router.post('/usuarios', auth, async (req, res) => {
  try {
    if (req.usuario.perfil !== 'Administrador')
      return res.status(403).json({ erro: 'Acesso restrito a Administradores' });
    
    const { nome, email, senha, perfil } = req.body;
    if (!nome || !email || !senha)
      return res.status(400).json({ erro: 'Nome, email e senha são obrigatórios' });
    
    res.status(201).json(await Usuario.create({ nome, email, senha, perfil }));
  } catch (e) {
    // Tratamento específico para e-mail duplicado (regra do banco SQLite)
    if (e.message?.includes('UNIQUE')) return res.status(400).json({ erro: 'E-mail já cadastrado' });
    res.status(500).json({ erro: e.message });
  }
});

module.exports = router;