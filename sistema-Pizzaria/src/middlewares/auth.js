// Importa a biblioteca JSON Web Token, usada para criar e validar tokens de acesso
const jwt = require('jsonwebtoken');

/**
 * Função de Middleware para proteger rotas.
 * @param req - Objeto da Requisição (contém os dados enviados pelo cliente)
 * @param res - Objeto da Resposta (usado para enviar mensagens de volta)
 * @param next - Função que, quando chamada, permite que a requisição siga para a próxima etapa
 */
function autenticar(req, res, next) {
  // Busca o cabeçalho 'authorization' na requisição HTTP
  const authHeader = req.headers['authorization'];
  
  // O formato comum é "Bearer <TOKEN>". 
  // Esta linha tenta pegar apenas a segunda parte (o token em si)
  const token      = authHeader && authHeader.split(' ')[1];

  // Se o token não existir (usuário não enviou nada), barra a requisição aqui mesmo
  if (!token) {
    return res.status(401).json({ erro: 'Token não fornecido. Faça login.' });
  }

  try {
    // Tenta validar o token usando a CHAVE SECRETA guardada no arquivo .env
    // Se o token foi alterado ou expirou, o jwt.verify vai disparar um erro
    const payload  = jwt.verify(token, process.env.JWT_SECRET);
    
    // Se estiver tudo certo, os dados do usuário (ID, nome, perfil) que estavam 
    // "escondidos" dentro do token são injetados na requisição (req.usuario)
    req.usuario    = payload;
    
    // Libera a passagem para a próxima função (a rota desejada)
    next();
  } catch (erro) {
    // Se cair no catch, significa que o token é falso, foi modificado ou já passou do tempo de validade
    return res.status(401).json({ erro: 'Token inválido ou expirado.' });
  }
}

// Exporta a função para ser usada em outros arquivos (ex: nas rotas de pedidos)
module.exports = autenticar;