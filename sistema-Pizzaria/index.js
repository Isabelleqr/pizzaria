// Carrega as variáveis de ambiente do arquivo .env (como a porta do servidor)
require('dotenv').config();

const express = require('express'); // Framework principal para criar o servidor web
const cors    = require('cors');    // Permite que o front-end acesse a API de diferentes origens
const path    = require('path');    // Utilitário para manipular caminhos de pastas e arquivos

const app  = express();
// Define a porta: usa a do .env ou a 3001 como padrão
const PORT = process.env.PORT || 3001;

// MIDDLEWARES (Configurações de cada requisição)
app.use(cors()); // Habilita o CORS para evitar erros de segurança no navegador
app.use(express.json()); // Permite que o servidor entenda requisições que enviam dados em JSON

// Define a pasta 'public' como local de arquivos estáticos (HTML, CSS, JS do front-end)
app.use(express.static(path.join(__dirname, 'public')));

// Importa a promessa de conexão do banco de dados e o arquivo central de rotas
const { ready } = require('./src/database/sqlite');
const routes    = require('./src/routes/index');

// Só inicia o servidor DEPOIS que o banco de dados estiver pronto
ready.then(() => {
  
  // Acopla todas as rotas da API sob o prefixo '/api' (Ex: /api/pizzas, /api/pedidos)
  app.use('/api', routes);

  // Rota de teste para verificar se a API está respondendo
  app.get('/api-status', (req, res) => {
    res.json({ mensagem: 'API da Pizzaria funcionando!', status: 'online', porta: PORT });
  });

  // Rota principal: Entrega o arquivo index.html (o front-end) para quem acessar a raiz "/"
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  // Inicia o servidor para ouvir as requisições na porta definida
  app.listen(PORT, () => {
    console.log('=================================');
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`API: http://localhost:${PORT}/api`);
    console.log(`Front-end: http://localhost:${PORT}`);
    console.log('=================================');
  });

}).catch(err => {
  // Caso o banco de dados falhe ao iniciar (ex: erro de permissão), o sistema trava e mostra o erro
  console.error('Erro ao inicializar banco:', err);
  process.exit(1); // Encerra o Node.js com código de erro
});