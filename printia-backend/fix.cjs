const fs = require('fs');

let content = fs.readFileSync('server.js', 'utf8');

const marker = '// GERAR ORDEM DE SERVIÇO COM IA (PRODUÇÃO)';
let index = content.indexOf(marker);

// Volta pro começo do comentário
if (index > -1) {
  index = content.lastIndexOf('// ==========================================', index);
  if (index > -1) {
    content = content.substring(0, index);
  }
} else {
  const badMarker = '// GERAR ORDEM';
  index = content.indexOf(badMarker);
  if(index > -1) {
      index = content.lastIndexOf('// ==========================================', index);
      content = content.substring(0, index);
  }
}

// Limpa qualquer quebra de linha estranha no final
content = content.trimEnd() + '\n';

const add = `
// ==========================================
// GERAR ORDEM DE SERVIÇO COM IA (PRODUÇÃO)
// ==========================================
app.post('/api/ai/gerar-ordem-servico', async (req, res) => {
  try {
    const { chatId, propostaId } = req.body;
    
    // Puxa as últimas mensagens
    let transcript = 'Sem histórico de conversa.';
    if (chatId) {
      const { data: messages } = await supabase
        .from('whatsapp_messages')
        .select('content, from_me, created_at')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (messages && messages.length > 0) {
        transcript = messages.reverse().map(m => {
          const sender = m.from_me ? 'ATENDIMENTO' : 'CLIENTE';
          return \`[\${new Date(m.created_at).toLocaleTimeString()}] \${sender}: \${m.content || '(arquivo/imagem)'}\`;
        }).join('\\n');
      }
    }
    
    // Puxa os itens da proposta se existir
    let propostaText = 'Sem itens da proposta informados.';
    if (propostaId) {
      const { data: proposta } = await supabase.from('propostas').select('*').eq('id', propostaId).single();
      if (proposta && proposta.itens) {
        propostaText = proposta.itens.map(i => \`- \${i.quantidade}x \${i.produto.titulo} (\${i.produto.specs})\`).join('\\n');
      }
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = \`Você é um Assistente de Produção da gráfica PrintIA.
Sua tarefa é ler a negociação feita no WhatsApp e os itens fechados na proposta, e escrever uma ORDEM DE SERVIÇO TÉCNICA E CLARA para a equipe do chão de fábrica (que vai operar as impressoras, plotters, encadernadoras, etc).
A equipe de produção NÃO deve ver valores financeiros nem papo de vendedor, apenas os detalhes TÉCNICOS: o que é para imprimir, tamanhos, cores, acabamentos, se o cliente enviou arte pronta ou precisa fazer, etc.

ITENS DO ORÇAMENTO APROVADO:
\${propostaText}

HISTÓRICO DA CONVERSA:
\${transcript}

Escreva a Ordem de Serviço em Markdown usando:
### 📌 Resumo do Trabalho
[Descreva o que é para fazer]
### ⚙️ Instruções Técnicas e Acabamentos
[Quais os materiais, cortes, vincos, encadernações, etc que foram combinados]
### 📎 Status das Artes
[A arte foi enviada? Quem vai criar? Onde ela está?]\`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    res.json({ success: true, resumo_ia: text });
  } catch (error) {
    console.error('Erro ao gerar OS:', error);
    res.status(500).json({ error: 'Falha ao gerar Ordem de Serviço' });
  }
});
`;

fs.writeFileSync('server.js', content + add, 'utf8');
console.log('Fixed');
