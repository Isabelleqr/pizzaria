// Importa as ferramentas de conexão com o banco de dados
const { ready, query, run, get } = require('../database/sqlite');

/**
 * Função Auxiliar: Tenta transformar a string que vem do banco em um objeto de preços.
 * Se o banco estiver vazio ou der erro, retorna preços zerados como padrão.
 */
function safeParsePrecos(precos) {
  try {
    return JSON.parse(precos || '{"P":0,"M":0,"G":0}');
  } catch {
    return { P: 0, M: 0, G: 0 };
  }
}

/**
 * Função Auxiliar: Formata a linha bruta do banco de dados para o padrão do Front-end.
 * Aqui acontece a conversão de tipos (String -> JSON e Inteiro -> Booleano).
 */
function formatarPizza(row) {
  if (!row) return null;

  return {
    id: row.id,
    nome: row.nome,
    descricao: row.descricao,
    ingredientes: row.ingredientes,
    precos: safeParsePrecos(row.precos), // Transforma a string do banco em objeto JS
    disponivel: row.disponivel === 1,    // Converte 1 para true e 0 para false
    categoria: row.categoria,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const Pizza = {

  // Busca todas as pizzas, organizadas por categoria (Ex: Tradicional primeiro)
  async findAll() {
    await ready;
    const rows = await query('SELECT * FROM pizzas ORDER BY categoria, nome');
    return rows.map(formatarPizza);
  },

  // Busca uma pizza específica pelo ID
  async findById(id) {
    await ready;
    const row = await get('SELECT * FROM pizzas WHERE id = ?', [id]);
    return formatarPizza(row);
  },

  // Cria uma nova pizza no cardápio
  async create({
    nome,
    descricao = '',
    ingredientes,
    precos = {},
    disponivel = true,
    categoria = 'tradicional'
  }) {
    await ready;

    // Validação básica: não permite pizza sem nome ou ingredientes
    if (!nome || !ingredientes) {
      throw new Error('Nome e ingredientes são obrigatórios');
    }

    const info = await run(
      `INSERT INTO pizzas 
       (nome, descricao, ingredientes, precos, disponivel, categoria) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        nome.trim(),
        descricao?.trim() || '',
        ingredientes.trim(),
        // Transforma o objeto {P, M, G} em uma string JSON para salvar no banco
        JSON.stringify({
          P: precos.P || 0,
          M: precos.M || 0,
          G: precos.G || 0
        }),
        disponivel ? 1 : 0,
        categoria
      ]
    );

    // Retorna a pizza que acabou de ser criada
    return this.findById(info.lastInsertRowid);
  },

  // Atualiza os dados de uma pizza (preço, nome, se está disponível, etc.)
  async update(id, dados) {
    await ready;

    // Verifica se a pizza existe antes de tentar atualizar
    const atual = await get('SELECT * FROM pizzas WHERE id = ?', [id]);
    if (!atual) return null;

    const precosAtuais = safeParsePrecos(atual.precos);

    // Lógica de "Merge" de preços: Se você enviar só o preço G, 
    // ele mantém os preços P e M que já estavam no banco.
    const precosFinal = dados.precos
      ? {
          P: dados.precos.P ?? precosAtuais.P,
          M: dados.precos.M ?? precosAtuais.M,
          G: dados.precos.G ?? precosAtuais.G
        }
      : precosAtuais;

    await run(
      `UPDATE pizzas SET
        nome         = ?,
        descricao    = ?,
        ingredientes = ?,
        precos       = ?,
        disponivel   = ?,
        categoria    = ?,
        updated_at   = datetime('now')
      WHERE id = ?`,
      [
        dados.nome ?? atual.nome,
        dados.descricao ?? atual.descricao,
        dados.ingredientes ?? atual.ingredientes,
        JSON.stringify(precosFinal),
        dados.disponivel !== undefined
          ? (dados.disponivel ? 1 : 0)
          : atual.disponivel,
        dados.categoria ?? atual.categoria,
        id
      ]
    );

    return this.findById(id);
  },

  // Remove a pizza do cardápio permanentemente
  async delete(id) {
    await ready;
    const info = await run('DELETE FROM pizzas WHERE id = ?', [id]);
    return info.changes > 0;
  },
};

module.exports = Pizza;