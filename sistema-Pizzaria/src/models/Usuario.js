// Importa as funções de conexão e execução do banco SQLite
const { ready, query, run, get } = require('../database/sqlite');
// Importa o bcrypt para lidar com a segurança das senhas
const bcrypt = require('../../node_modules/bcryptjs/umd');

/**
 * Função Auxiliar: Transforma uma linha bruta do banco de dados (row)
 * em um objeto JavaScript limpo e padronizado para o Front-end.
 */
function formatarUsuario(row) {
  if (!row) return null;
  return {
    id:        row.id,
    nome:      row.nome,
    email:     row.email,
    perfil:    row.perfil,
    ativo:     row.ativo === 1, // Converte 1/0 do SQLite para true/false
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const Usuario = {

  // Busca todos os usuários cadastrados, do mais novo para o mais antigo
  async findAll() {
    await ready; // Garante que o banco está conectado
    const rows = query(`
      SELECT id, nome, email, perfil, ativo, created_at, updated_at
      FROM usuarios ORDER BY created_at DESC
    `);
    return rows.map(formatarUsuario); // Formata cada um dos usuários encontrados
  },

  // Busca um usuário específico pelo e-mail (usado no Login)
  async findByEmail(email) {
    await ready;
    // .toLowerCase().trim() evita erros de espaços extras ou letras maiúsculas
    return get('SELECT * FROM usuarios WHERE email = ?', [email.toLowerCase().trim()]);
  },

  // Busca um usuário pelo ID numérico
  async findById(id) {
    await ready;
    const row = get(`
      SELECT id, nome, email, perfil, ativo, created_at, updated_at
      FROM usuarios WHERE id = ?
    `, [id]);
    return formatarUsuario(row);
  },

  // Cria um novo usuário no sistema
  async create({ nome, email, senha, perfil = 'Atendente' }) {
    await ready;
    // Criptografa a senha antes de salvar (Segurança máxima)
    const hash = await bcrypt.hash(senha, 10);
    const info = run(
      'INSERT INTO usuarios (nome, email, senha, perfil) VALUES (?, ?, ?, ?)',
      [nome.trim(), email.toLowerCase().trim(), hash, perfil]
    );
    // Retorna o usuário recém-criado buscando-o pelo ID gerado (lastInsertRowid)
    return this.findById(info.lastInsertRowid);
  },

  // Atualiza os dados de um usuário existente
  async update(id, { nome, email, senha, perfil, ativo }) {
    await ready;
    // Primeiro, verifica se o usuário realmente existe
    const atual = get('SELECT * FROM usuarios WHERE id = ?', [id]);
    if (!atual) return null;

    // Se uma nova senha foi enviada, criptografa. Se não, mantém a atual.
    let senhaFinal = atual.senha;
    if (senha) senhaFinal = await bcrypt.hash(senha, 10);

    run(`
      UPDATE usuarios SET
        nome       = ?,
        email      = ?,
        senha      = ?,
        perfil     = ?,
        ativo      = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `, [
      nome   ?? atual.nome,  // Operador ??: Se o novo for nulo, usa o valor atual
      email  ?? atual.email,
      senhaFinal,
      perfil ?? atual.perfil,
      ativo !== undefined ? (ativo ? 1 : 0) : atual.ativo,
      id
    ]);

    return this.findById(id);
  },

  // Remove um usuário do banco de dados
  async delete(id) {
    await ready;
    const info = run('DELETE FROM usuarios WHERE id = ?', [id]);
    return info.changes > 0; // Retorna true se alguma linha foi deletada
  },

  // Compara a senha que o usuário digitou com o código (hash) salvo no banco
  verificarSenha(senhaDigitada, hashSalvo) {
    return bcrypt.compare(senhaDigitada, hashSalvo);
  },
};

module.exports = Usuario;