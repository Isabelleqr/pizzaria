// --- IMPORTAÇÃO DE MÓDULOS ---
const initSqlJs = require('sql.js'); // Motor do banco de dados SQLite
const fs        = require('fs');     // Sistema de arquivos para ler/gravar o arquivo .db
const path      = require('path');   // Para lidar com caminhos de pastas de forma segura

// Define onde o arquivo do banco de dados será salvo (na raiz do projeto)
const DB_PATH = process.env.DB_PATH
  || path.join(__dirname, '..', '..', 'pizzaria.db');

const state = { db: null }; // Estado global para manter a conexão aberta

/**
 * Bloco de inicialização assíncrona.
 * Ele tenta ler um arquivo existente ou cria um banco vazio na memória.
 */
const ready = (async () => {
  const SQL = await initSqlJs();

  // Se o arquivo pizzaria.db já existir, carrega ele. Se não, cria um novo.
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    state.db = new SQL.Database(fileBuffer);
  } else {
    state.db = new SQL.Database();
  }

  const db = state.db;

  // Habilita chaves estrangeiras (garante que você não apague um cliente que tem pedidos, por exemplo)
  db.run('PRAGMA foreign_keys = ON');

  // --- CRIAÇÃO DAS TABELAS (O Esqueleto dos Dados) ---

  // Tabela de Funcionários (Admin, Garçom, etc)
  db.run(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    nome        TEXT    NOT NULL,
    email       TEXT    NOT NULL UNIQUE,
    senha       TEXT    NOT NULL,
    perfil      TEXT    NOT NULL DEFAULT 'Atendente', -- Define o cargo
    ativo       INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`);

  // Tabela de Clientes
  db.run(`
    CREATE TABLE IF NOT EXISTS clientes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      nome        TEXT    NOT NULL,
      telefone    TEXT    NOT NULL,
      endereco    TEXT    NOT NULL DEFAULT '{}', -- Salva o JSON do endereço
      observacoes TEXT    NOT NULL DEFAULT '',
      ativo       INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Tabela do Cardápio (Pizzas)
  db.run(`
    CREATE TABLE IF NOT EXISTS pizzas (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      nome         TEXT    NOT NULL,
      descricao    TEXT    NOT NULL DEFAULT '',
      ingredientes TEXT    NOT NULL,
      precos       TEXT    NOT NULL DEFAULT '{"P":0,"M":0,"G":0}', -- Preços por tamanho
      disponivel   INTEGER NOT NULL DEFAULT 1,
      categoria    TEXT    NOT NULL DEFAULT 'tradicional',
      created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Tabela de Pedidos (A "capa" do pedido com totais e status)
  db.run(`
    CREATE TABLE IF NOT EXISTS pedidos (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      numero_pedido    INTEGER,
      cliente_id       INTEGER NOT NULL REFERENCES clientes(id), -- Link com a tabela clientes
      subtotal         REAL    NOT NULL DEFAULT 0,
      taxa_entrega     REAL    NOT NULL DEFAULT 0,
      total            REAL    NOT NULL DEFAULT 0,
      forma_pagamento  TEXT    NOT NULL,
      troco            REAL    NOT NULL DEFAULT 0,
      status           TEXT    NOT NULL DEFAULT 'recebido',
      observacoes      TEXT    NOT NULL DEFAULT '',
      mesa             INTEGER, -- Se for nulo, é delivery/balcão
      origem           TEXT    NOT NULL DEFAULT 'balcao',
      garcom_id        INTEGER REFERENCES usuarios(id), -- Quem fez o atendimento
      created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Detalhes do Pedido (Quais pizzas estão dentro de cada pedido)
  db.run(`
    CREATE TABLE IF NOT EXISTS itens_pedido (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      pedido_id      INTEGER NOT NULL REFERENCES pedidos(id),
      pizza_id       INTEGER NOT NULL REFERENCES pizzas(id),
      nome_pizza     TEXT    NOT NULL,
      tamanho        TEXT    NOT NULL,
      quantidade     INTEGER NOT NULL DEFAULT 1,
      preco_unitario REAL    NOT NULL DEFAULT 0,
      subtotal       REAL    NOT NULL DEFAULT 0
    )
  `);

  salvar(); // Grava as tabelas recém-criadas no arquivo físico

  console.log('SQLite (sql.js) conectado:', DB_PATH);
  return db;
})();

/**
 * Função para persistir os dados da memória para o arquivo pizzaria.db
 */
function salvar() {
  if (!state.db) return;
  const data = state.db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

/**
 * Executa uma consulta (SELECT) e retorna uma lista de objetos.
 */
function query(sql, params = []) {
  const stmt    = state.db.prepare(sql);
  const results = [];
  stmt.bind(params);
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free(); // Libera a memória do "statement"
  return results;
}

/**
 * Executa comandos de alteração (INSERT, UPDATE, DELETE).
 * Salva o banco automaticamente após a alteração.
 */
function run(sql, params = []) {
  state.db.run(sql, params);
  const meta = query('SELECT last_insert_rowid() as id, changes() as changes');
  salvar(); // Crucial para não perder os dados se o servidor cair
  return {
    lastInsertRowid: meta[0]?.id, // Retorna o ID do que foi criado agora
    changes:         meta[0]?.changes, // Quantas linhas foram afetadas
  };
}

/**
 * Busca apenas uma única linha (Útil para buscar um usuário ou pizza por ID).
 */
function get(sql, params = []) {
  const rows = query(sql, params);
  return rows[0] || null;
}

// Exporta as funções para serem usadas no restante do servidor (API)
module.exports = { ready, query, run, get, salvar };