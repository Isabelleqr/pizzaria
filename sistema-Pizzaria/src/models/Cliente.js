// Importa as funções de comunicação com o banco de dados SQLite
const { ready, query, run, get } = require('../database/sqlite');

/**
 * Função Auxiliar: Organiza os dados que vêm do banco.
 * O SQLite entrega o endereço como texto; esta função o transforma de volta em um objeto JS.
 */
function formatarCliente(row) {
  if (!row) return null;
  return {
    id:         row.id,
    nome:       row.nome,
    telefone:   row.telefone,
    // Converte a string JSON do endereço em objeto, ou retorna um objeto vazio se falhar
    endereco:   JSON.parse(row.endereco || '{}'),
    observacoes: row.observacoes,
    ativo:      row.ativo === 1, // Converte 1/0 para true/false
    createdAt:  row.created_at,
    updatedAt:  row.updated_at,
  };
}

const Cliente = {

  /**
   * Busca clientes no banco.
   * Se houver um termo de 'busca', ele filtra por nome ou telefone usando o operador LIKE.
   */
  async findAll(busca = '') {
    await ready;
    let rows;
    if (busca) {
      // O símbolo % permite buscar partes do texto (ex: "Silva" encontra "João Silva")
      const t = `%${busca}%`;
      rows = query(
        'SELECT * FROM clientes WHERE ativo = 1 AND (nome LIKE ? OR telefone LIKE ?) ORDER BY nome',
        [t, t]
      );
    } else {
      // Se não houver busca, traz todos os clientes ativos em ordem alfabética
      rows = query('SELECT * FROM clientes WHERE ativo = 1 ORDER BY nome');
    }
    return rows.map(formatarCliente);
  },

  // Localiza um cliente específico pelo ID
  async findById(id) {
    await ready;
    return formatarCliente(get('SELECT * FROM clientes WHERE id = ?', [id]));
  },

  // Cadastra um novo cliente
  async create({ nome, telefone, endereco = {}, observacoes = '' }) {
    await ready;
    const info = run(
      'INSERT INTO clientes (nome, telefone, endereco, observacoes) VALUES (?, ?, ?, ?)',
      [
        nome.trim(), 
        telefone.trim(), 
        JSON.stringify(endereco), // Transforma o objeto de endereço em texto para o banco
        observacoes
      ]
    );
    // Retorna os dados do cliente que acabou de ser inserido
    return this.findById(info.lastInsertRowid);
  },

  // Atualiza as informações de um cliente existente
  async update(id, { nome, telefone, endereco, observacoes, ativo }) {
    await ready;
    const atual = get('SELECT * FROM clientes WHERE id = ?', [id]);
    if (!atual) return null;

    // Lógica de "Merge" de Endereço:
    // Se você atualizar apenas a 'rua', ele mantém o 'bairro' e 'número' antigos.
    const endAtual = JSON.parse(atual.endereco || '{}');
    const endFinal = endereco ? { ...endAtual, ...endereco } : endAtual;

    run(`
      UPDATE clientes SET
        nome        = ?,
        telefone    = ?,
        endereco    = ?,
        observacoes = ?,
        ativo       = ?,
        updated_at  = datetime('now')
      WHERE id = ?
    `, [
      nome        ?? atual.nome,
      telefone    ?? atual.telefone,
      JSON.stringify(endFinal),
      observacoes ?? atual.observacoes,
      ativo !== undefined ? (ativo ? 1 : 0) : atual.ativo,
      id
    ]);

    return this.findById(id);
  },

  // Remove o cliente do banco de dados (Exclusão física)
  async delete(id) {
    await ready;
    const info = run('DELETE FROM clientes WHERE id = ?', [id]);
    return info.changes > 0;
  },
};

module.exports = Cliente;