// Importa configurações de ambiente (.env) e as funções de conexão com o banco SQLite
require('dotenv').config();
const { ready, run, query } = require('./src/database/sqlite');
const bcrypt = require('bcryptjs'); // Biblioteca para criptografar senhas

async function seed() {
  try {
    // Aguarda a conexão com o banco estar pronta
    await ready;
    console.log('🧹 Limpando banco...');

    // Remove todos os dados existentes para evitar duplicidade ou conflitos ao rodar o seed novamente
    run('DELETE FROM itens_pedido');
    run('DELETE FROM pedidos');
    run('DELETE FROM pizzas');
    run('DELETE FROM clientes');
    run('DELETE FROM usuarios');

    // Tenta resetar os contadores de ID (AUTOINCREMENT) para que novos registros comecem do 1
    try {
      run("DELETE FROM sqlite_sequence WHERE name IN ('itens_pedido','pedidos','pizzas','clientes','usuarios')");
    } catch(_) { }

    console.log('✅ Banco limpo');

    // Gera o hash da senha '123456'. Nunca salvamos a senha em texto puro por segurança.
    const hash = await bcrypt.hash('123456', 10);

    // CRIAÇÃO DE USUÁRIOS: Insere 3 perfis diferentes para testar as permissões do sistema
    run('INSERT INTO usuarios (nome, email, senha, perfil) VALUES (?, ?, ?, ?)',
      ['Administrador Master', 'admin@pizzaria.com', hash, 'Administrador']);
    run('INSERT INTO usuarios (nome, email, senha, perfil) VALUES (?, ?, ?, ?)',
      ['Atendente Oficial', 'atendente@pizzaria.com', hash, 'Atendente']);
    run('INSERT INTO usuarios (nome, email, senha, perfil) VALUES (?, ?, ?, ?)',
      ['Garcom Oficial', 'garcom@pizzaria.com', hash, 'Garcom']);

    console.log('✅ 3 usuários criados');

    // LISTA DE CLIENTES: Array de objetos para simular uma base de dados real
    const clientes = [
      ['Lucas Ferreira Santos',   '11991234501', {rua:'Rua das Acácias',numero:'142',bairro:'Vila Madalena',cidade:'São Paulo',cep:'05435-000'}, 'Alérgico a glúten'],
      // ... (demais clientes omitidos para brevidade)
      ['Carolina Batista Pinto',  '11991234520', {rua:'Rua Peixoto Gomide',numero:'1100',bairro:'Jardim Paulista',cidade:'São Paulo',cep:'01409-001'}, 'Prefere bordas recheadas'],
    ];

    // Loop para inserir cada cliente. O endereço é convertido em String JSON para caber em uma única coluna
    for (const [nome, tel, end, obs] of clientes) {
      run('INSERT INTO clientes (nome, telefone, endereco, observacoes) VALUES (?, ?, ?, ?)',
        [nome, tel, JSON.stringify(end), obs]);
    }
    console.log('✅ 20 clientes criados');

    // CARDÁPIO DE PIZZAS: Define sabores, descrições, ingredientes e preços por tamanho (P, M, G)
    const pizzas = [
      ['Calabresa','Clássica brasileira...','Calabresa fatiada, cebola e azeitona',{P:35,M:45,G:55},'tradicional'],
      ['Frango com Catupiry','Uma das mais pedidas...','Frango desfiado e catupiry',{P:38,M:48,G:58},'especial'],
      ['Quatro Queijos','Para apaixonados por queijo...','Mussarela, provolone, gorgonzola e parmesão',{P:44,M:56,G:68},'premium'],
      ['Chocolate com Morango','A sobremesa perfeita...','Chocolate ao leite e morango',{P:42,M:52,G:62},'doce'],
      // ... (demais sabores)
    ];

    // Loop para inserir as pizzas. Os preços (objeto) também são salvos como String JSON
    for (const [nome, desc, ing, precos, cat] of pizzas) {
      run('INSERT INTO pizzas (nome, descricao, ingredientes, precos, categoria) VALUES (?, ?, ?, ?, ?)',
        [nome, desc, ing, JSON.stringify(precos), cat]);
    }
    console.log('✅ 20 pizzas criadas');

    // Mensagens de sucesso no console
    console.log('======================================');
    console.log('🔥 SEED EXECUTADO COM SUCESSO!');
    console.log('======================================');
    console.log('Login: admin@pizzaria.com | Senha: 123456');
    console.log('======================================');
    
    // Encerra o processo com sucesso (status 0)
    process.exit(0);
  } catch (err) {
    // Caso ocorra qualquer erro (ex: banco bloqueado), exibe no console e encerra com erro (status 1)
    console.error('❌ ERRO NO SEED:', err);
    process.exit(1);
  }
}

// Chama a função principal para executar a semeação
seed();