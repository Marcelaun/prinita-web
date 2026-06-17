import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { initWhatsApp, enviarMensagem, getBaileysOwnerNumber, getSessionStatus, logoutSession } from './whatsappService.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Middleware Multi-Tenant
app.use((req, res, next) => {
  req.grafica_id = req.headers['x-grafica-id'] || '11111111-1111-1111-1111-111111111111';
  next();
});

// ==========================================
const memoriaTemporaria = new Map();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// VARIÁVEL PARA GUARDAR O NÚMERO DA INSTÂNCIA (Prevenção de mistura)
let ownerNumber = null;

async function getOwnerNumber() {
  if (ownerNumber) return ownerNumber;
  const num = getBaileysOwnerNumber();
  if (num) {
    ownerNumber = num;
  }
  return ownerNumber;
}

// TRAVA DE SINCRONIZAÇÃO (Previne múltiplas syncs simultâneas para o mesmo chat)
const syncLocks = new Set();

// HELPERS DE WHATSAPP
const fetchWithTimeout = (url, options, timeout = 20000) => {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout na Evolution API')), timeout))
  ]);
};

// Função para garantir que temos apenas um registro de chat por número (consolidação @lid)
async function getOrCreateChat(remoteJid, pushName, number) {
  try {
    const owner = await getOwnerNumber();

    if (!number || number === 'undefined' || number === 'null') {
       // Se for LID e não temos número, usamos o próprio LID como "número" temporário
       // para garantir separação absoluta
       if (remoteJid.includes('@lid')) {
         number = remoteJid.split('@')[0];
       } else {
         return null;
       }
    }

    // PROTEÇÃO CRÍTICA: Se o número extraído for o número da PRÓPRIA INSTÂNCIA,
    // mas o JID não for o do dono (ou for um LID de cliente), NUNCA associamos.
    if (owner && number === owner && !remoteJid.includes(owner)) {
       console.log(`Proteção: Evitando associar JID ${remoteJid} ao número do dono ${owner}. Usando JID como número.`);
       number = remoteJid.split('@')[0]; 
    }

    // BLOQUEIO DE GRUPOS E STATUS: Não queremos misturar conversas de grupos com leads
    if (remoteJid.includes('@g.us') || remoteJid.includes('status@broadcast')) {
      return null;
    }

    // 1. Sempre tenta buscar pelo número primeiro (nosso identificador mestre absoluto)
    let { data: chatByNumber } = await supabase.from('whatsapp_chats')
      .select('*')
      .eq('number', number)
      .maybeSingle();

    if (chatByNumber) {
      // Se encontrou pelo número, garantimos que o remote_jid mestre seja o @s.whatsapp.net (se disponível)
      // ou o primeiro que aparecer.
      if (remoteJid && chatByNumber.remote_jid !== remoteJid) {
        // Só atualiza o JID se o novo for o "oficial" e o antigo for LID
        if (remoteJid.includes('@s.whatsapp.net') && chatByNumber.remote_jid.includes('@lid')) {
          console.log(`Atualizando JID oficial para ${number}: ${chatByNumber.remote_jid} -> ${remoteJid}`);
          await supabase.from('whatsapp_chats')
            .update({ remote_jid: remoteJid, push_name: pushName || chatByNumber.push_name })
            .eq('id', chatByNumber.id);
        }
      } else if (!chatByNumber.push_name && pushName && !/^\d+$/.test(pushName)) {
        await supabase.from('whatsapp_chats').update({ push_name: pushName }).eq('id', chatByNumber.id);
      }
      return chatByNumber;
    }

    // 2. Se não existe pelo número, tenta pelo remoteJid (mas apenas como fallback)
    let { data: chatByJid } = await supabase.from('whatsapp_chats').select('*').eq('remote_jid', remoteJid).maybeSingle();
    
    // Se encontrou pelo JID mas o número gravado é diferente do número atual, TEMOS UM ERRO DE MAPEAMENTO
    if (chatByJid && chatByJid.number !== number) {
      console.warn(`CONFLITO: JID ${remoteJid} já associado ao número ${chatByJid.number}, mas recebido número ${number}. Mantendo o original para evitar mistura.`);
      return chatByJid; 
    } else if (chatByJid) {
      return chatByJid;
    }

    // 3. Cria novo chat garantindo que o número esteja correto
    console.log(`Criando novo chat para o número ${number} (JID: ${remoteJid})`);
    const { data: newChat } = await supabase.from('whatsapp_chats').insert([{
      remote_jid: remoteJid,
      push_name: pushName,
      number: number,
      unread_count: 0,
      last_message: "Conversa sincronizada",
    }]).select().single();

    return newChat;
  } catch (error) {
    console.error('Erro em getOrCreateChat:', error);
    return null;
  }
}

// Função para unificar mensagens de chats duplicados (limpeza profunda)
async function unifyDuplicateChats() {
  try {
    console.log("Iniciando unificação de chats duplicados...");
    const { data: allChats } = await supabase.from('whatsapp_chats').select('*').order('created_at', { ascending: true });
    
    const byNumber = {};
    allChats.forEach(chat => {
      if (!byNumber[chat.number]) byNumber[chat.number] = [];
      byNumber[chat.number].push(chat);
    });

    let mergedCount = 0;
    for (const number in byNumber) {
      const chats = byNumber[number];
      // Só unifica se for um número real (não um LID parcial ou vazio)
      if (chats.length > 1 && number.length > 5 && !number.includes('@')) {
        // Mantemos o chat mais completo ou o primeiro criado
        const masterChat = chats.find(c => c.remote_jid.includes('@s.whatsapp.net')) || chats[0];
        const duplicates = chats.filter(c => c.id !== masterChat.id);
        const duplicateIds = duplicates.map(d => d.id);

        // 1. Move todas as mensagens dos duplicados para o master
        const { error: moveError } = await supabase.from('whatsapp_messages')
          .update({ chat_id: masterChat.id })
          .in('chat_id', duplicateIds);

        if (!moveError) {
          // 2. Deleta os registros duplicados
          await supabase.from('whatsapp_chats').delete().in('id', duplicateIds);
          mergedCount += duplicates.length;
          console.log(`Unificados ${duplicates.length} chats para o número ${number}`);
        }
      }
    }
    return mergedCount;
  } catch (error) {
    console.error("Erro na unificação:", error);
    return 0;
  }
}

async function syncMessages(chatId, remoteJid, limit = 50) {
  // Se já estiver sincronizando este chat, pula para evitar duplicados
  if (syncLocks.has(chatId)) {
    console.log(`Sync já em andamento para chat ${chatId}, pulando...`);
    return { success: true, added: 0 };
  }

  syncLocks.add(chatId);

  const apiUrl = process.env.EVOLUTION_API_URL || 'https://evolution-backend.duckdns.org';
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instance = process.env.EVOLUTION_INSTANCE_NAME;

  try {
    console.log(`Buscando mensagens para ${remoteJid} (ChatId: ${chatId}, Limit: ${limit})...`);
    
    const extractMsgs = (data) => {
      if (!data) return [];
      if (Array.isArray(data)) return data;
      if (data.messages && Array.isArray(data.messages)) return data.messages;
      if (data.messages && Array.isArray(data.messages.records)) return data.messages.records;
      if (data.records && Array.isArray(data.records)) return data.records;
      return [];
    };

    let msgs = [];
    let response = await fetchWithTimeout(`${apiUrl}/chat/findMessages/${instance}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
      body: JSON.stringify({ "where": { "remoteJid": remoteJid }, "limit": limit })
    });

    if (response.ok) {
      const messagesData = await response.json();
      msgs = extractMsgs(messagesData);
      console.log(`Sync: Encontradas ${msgs.length} mensagens totais via API para ${remoteJid}`);
    } else {
      const errorText = await response.text();
      console.warn(`Aviso API Evolution (${response.status}) para ${remoteJid}:`, errorText);
    }

    // ESTRATÉGIA DE FALLBACK: Se não encontrou nada (ou deu erro) e o ID era @lid, tenta pelo @s.whatsapp.net
    if (msgs.length === 0 && remoteJid.includes('@lid')) {
      const { data: chatData } = await supabase.from('whatsapp_chats').select('number').eq('id', chatId).single();
      
      if (chatData?.number && !chatData.number.includes('@lid') && chatData.number.length < 25) {
        const fallbackJid = `${chatData.number}@s.whatsapp.net`;
        console.log(`Nenhuma mensagem para LID ${remoteJid}. Tentando fallback para ${fallbackJid}...`);
        
        const fbResponse = await fetchWithTimeout(`${apiUrl}/chat/findMessages/${instance}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
          body: JSON.stringify({ "where": { "remoteJid": fallbackJid }, "limit": limit })
        });
        
        if (fbResponse.ok) {
          const fallbackData = await fbResponse.json();
          const fbMsgs = extractMsgs(fallbackData);
          if (fbMsgs.length > 0) {
             console.log(`Fallback funcionou! Encontradas ${fbMsgs.length} mensagens para ${fallbackJid}`);
             msgs = fbMsgs;
             const officialNumber = chatData.number; 
             await supabase.from('whatsapp_chats').update({ 
               remote_jid: fallbackJid,
               number: officialNumber 
             }).eq('id', chatId);
          }
        }
      }
    }

    if (msgs.length === 0) {
      console.log(`Nenhuma mensagem encontrada para ${remoteJid}`);
      syncLocks.delete(chatId);
      return { success: true, added: 0 };
    }

    let lastPushName = null;
    const messagesToInsert = [];

    // Coleta mensagens e IDs existentes em uma única consulta
    const msgIds = msgs.filter(m => m?.key?.id).map(m => m.key.id);
    const { data: existingMsgs } = await supabase.from('whatsapp_messages')
      .select('message_id')
      .in('message_id', msgIds);
    
    const existingIds = new Set(existingMsgs?.map(m => m.message_id) || []);

    const owner = await getOwnerNumber();

    for (const msg of msgs) {
      if (!msg || !msg.key?.id || existingIds.has(msg.key.id)) continue;
      
      const msgRemoteJid = (msg.key?.remoteJid || '').toLowerCase();
      const targetJid = remoteJid.toLowerCase();
      const participant = (msg.key?.participant || '').split('@')[0];
      
      // FILTRO DE GRUPOS: Nunca queremos mensagens de grupos nas conversas individuais
      if (msgRemoteJid.includes('@g.us')) {
        continue;
      }

      // Validação de 1-on-1
      const msgPrefix = msgRemoteJid.split('@')[0];
      const targetPrefix = targetJid.split('@')[0];
      
      const isDirectMsg = msgPrefix === targetPrefix || 
                          (targetJid.includes('@lid') && msgRemoteJid.includes('@s.whatsapp.net')) ||
                          (targetJid.includes('@s.whatsapp.net') && msgRemoteJid.includes('@lid'));

      if (!isDirectMsg) continue;

      // PROTEÇÃO EXTRA: Se a mensagem é de grupo (participant existe e não é o dono nem o alvo), ignora
      if (participant && owner && participant !== owner && participant !== targetPrefix) {
        continue;
      }

      if (msg.pushName && !/^\d+$/.test(msg.pushName) && msg.pushName !== 'Desconhecido') {
        lastPushName = msg.pushName;
      }

      // Tenta extrair texto de vários campos possíveis (incluindo legendas de mídia)
      let textMessage = msg.message?.conversation || 
                         msg.message?.extendedTextMessage?.text || 
                         msg.message?.imageMessage?.caption || 
                         msg.message?.videoMessage?.caption || 
                         msg.message?.documentMessage?.caption;

      if (!textMessage && msg.messageType) {
        textMessage = {
          imageMessage: '📷 Imagem recebida',
          videoMessage: '🎥 Vídeo recebido',
          audioMessage: '🎵 Áudio recebido',
          documentMessage: '📄 Documento recebido',
          stickerMessage: '🖼️ Figurinha recebida',
          contactMessage: '👤 Contato recebido',
          locationMessage: '📍 Localização recebida'
        }[msg.messageType] || 'Mensagem recebida';
      }

      if (textMessage) {
        const createdAt = msg.messageTimestamp ? new Date(msg.messageTimestamp * 1000).toISOString() : new Date().toISOString();
        messagesToInsert.push({
          chat_id: chatId,
          message_id: msg.key.id,
          content: textMessage,
          from_me: msg.key?.fromMe || false,
          created_at: createdAt
        });
        // Evita duplicados dentro do próprio lote da API
        existingIds.add(msg.key.id);
      }
    }

    if (messagesToInsert.length > 0) {
      const { error: insertError } = await supabase.from('whatsapp_messages').insert(messagesToInsert);
      if (insertError) console.error("Erro ao inserir lote de mensagens:", insertError);
      console.log(`Inseridas ${messagesToInsert.length} novas mensagens.`);
    } else if (msgs.length > 0) {
      console.log(`Sync: Nenhuma das ${msgs.length} mensagens encontradas passou pelo filtro 1-on-1 ou já existiam.`);
    }

    if (lastPushName) {
      const { data: currentChat } = await supabase.from('whatsapp_chats').select('push_name').eq('id', chatId).single();
      if (!currentChat?.push_name || /^\d+$/.test(currentChat.push_name)) {
        await supabase.from('whatsapp_chats').update({ push_name: lastPushName }).eq('id', chatId);
      }
    }

    syncLocks.delete(chatId);
    return { success: true, added: messagesToInsert.length };
  } catch (error) {
    console.error(`Erro ao sincronizar mensagens de ${remoteJid}:`, error.message);
    syncLocks.delete(chatId);
    return { success: false, error: error.message };
  }
}

// ROTA 1: BUSCAR E CRUZAR LEADS
app.get('/api/leads', async (req, res) => {
  try {
    const { data: orcamentos, error } = await supabase
      .from('orcamentos')
      .select('*')
      .order('criado_em', { ascending: false })
      .limit(30);

    if (error) throw error;

    const formattedLeads = await Promise.all(orcamentos.map(async (orc) => {
      const cnpjLimpo = orc.cliente_cpf_cnpj ? String(orc.cliente_cpf_cnpj).replace(/\D/g, '') : '';
      let enriched = { capital: 'N/A', fundacao: 'N/A', perfil_ia: 'Novo lead. Perfil ainda não mapeado.' };

      if (cnpjLimpo) {
        let cnpjSemZero = cnpjLimpo;
        while(cnpjSemZero.startsWith('0')) {
            cnpjSemZero = cnpjSemZero.substring(1);
        }

        let leadMg = null;

        const { data: leadMg1 } = await supabase
          .from('leads_mg')
          .select('capital_social, data_inicio_atividade, perfil_ia')
          .eq('cnpj', cnpjLimpo)
          .maybeSingle();

        if (leadMg1) {
          leadMg = leadMg1;
        } else {
          const { data: leadMg2 } = await supabase
            .from('leads_mg')
            .select('capital_social, data_inicio_atividade, perfil_ia')
            .eq('cnpj', cnpjSemZero)
            .maybeSingle();
          if (leadMg2) leadMg = leadMg2;
        }

        if (!leadMg) {
          const { data: leadMg3 } = await supabase
            .from('leads_mg')
            .select('capital_social, data_inicio_atividade, perfil_ia')
            .like('cnpj', `%${cnpjSemZero}%`)
            .maybeSingle();
          if (leadMg3) leadMg = leadMg3;
        }

        if (leadMg) {
          enriched.capital = leadMg.capital_social ? `R$ ${Number(leadMg.capital_social).toLocaleString('pt-BR')}` : 'N/A';
          let dataFormatada = leadMg.data_inicio_atividade;
          if (dataFormatada && typeof dataFormatada === 'string' && dataFormatada.includes('-')) {
              const partes = dataFormatada.split('-');
              if(partes.length === 3) dataFormatada = `${partes[2]}/${partes[1]}/${partes[0]}`;
          }
          enriched.fundacao = dataFormatada || 'N/A';
          if (leadMg.perfil_ia) enriched.perfil_ia = leadMg.perfil_ia;
        }
      }

      const itensFormatados = typeof orc.itens === 'string' ? JSON.parse(orc.itens) : (orc.itens || []);

      return {
        id: orc.id.toString(),
        name: orc.cliente_nome || 'Cliente',
        initials: (orc.cliente_nome || 'CL').substring(0, 2).toUpperCase(),
        empresa: orc.cliente_empresa || 'Empresa',
        cpf_cnpj: orc.cliente_cpf_cnpj,
        telefone: orc.cliente_telefone,
        email: orc.cliente_email,
        endereco: orc.cliente_endereco || '',
        itens: itensFormatados,
        probabilidade: (orc.probabilidade_venda || 5),
        observacoes: orc.observacoes || '',
        vendedor: orc.vendedor_nome,
        status: orc.status || 'aguardando',
        atendido_por: orc.atendido_por || null,
        enriched: enriched,
        historico_compras: [],
        history: []
      };
    }));

    res.json(formattedLeads);
  } catch (error) {
    console.error('Erro ao buscar leads:', error);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// ROTAS DO CATÁLOGO
app.get('/api/produtos', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('produtos')
      .select('*')
      .eq('ativo', true)
      .order('categoria', { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar produtos' });
  }
});

app.post('/api/produtos', async (req, res) => {
  try {
    const { categoria, titulo, specs, preco, desconto, prazo } = req.body;
    const { data, error } = await supabase
      .from('produtos')
      .insert([{ categoria, titulo, specs, preco, desconto, prazo }])
      .select();

    if (error) throw error;
    res.json(data[0]);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar produto' });
  }
});

app.put('/api/produtos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const atualizacoes = req.body;
    const { data, error } = await supabase
      .from('produtos')
      .update(atualizacoes)
      .eq('id', id)
      .select();

    if (error) throw error;
    res.json(data[0]);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar produto' });
  }
});

// COPILOT COM MEMÓRIA
app.post('/api/copilot', async (req, res) => {
  try {
    const { lead, message, mode, vendedor, contextType } = req.body;
    const nomeContatoZap = lead.empresa || 'Cliente Desconhecido';
    const vendedorCpf = vendedor?.cpf || '000.000.000-00';

    let orcamentoId = lead.id || null;
    let dadosEnriquecidos = "";
    let catalogoDinamico = "CATÁLOGO INDISPONÍVEL NO MOMENTO.";

    if (contextType === 'leads' && nomeContatoZap && nomeContatoZap !== "Cliente Desconhecido") {
      // Se for contexto de CRM e não temos o cnpj, vamos tentar buscar pra enriquecer
      const { data: orc } = await supabase
        .from('orcamentos')
        .select('id, cliente_cpf_cnpj')
        .eq('id', lead.id)
        .maybeSingle();

      if (orc) {
        const cnpjLimpo = orc.cliente_cpf_cnpj ? String(orc.cliente_cpf_cnpj).replace(/\D/g, '') : '';
        if (cnpjLimpo) {
          const { data: mg } = await supabase
            .from('leads_mg')
            .select('*')
            .eq('cnpj', cnpjLimpo)
            .maybeSingle();

          if (mg) {
            dadosEnriquecidos = `
            DADOS REAIS DO BANCO (LEADS_MG) PARA ESSE CLIENTE:
            - Razão Social: ${mg.razao_social}
            - Capital Social: R$ ${mg.capital_social}
            - Data de Fundação: ${mg.data_inicio_atividade}
            - Localização: ${mg.logradouro}, ${mg.numero}, ${mg.bairro}, ${mg.municipio} - ${mg.uf}`;
          }
        }
      }
    }

    if (mode === 'vendedor') {
      const { data: produtos } = await supabase
        .from('produtos')
        .select('*')
        .eq('ativo', true);

      if (produtos && produtos.length > 0) {
        catalogoDinamico = "TABELA DE PREÇOS E PRAZOS OFICIAIS DA GRÁFICA:\n";
        produtos.forEach(p => {
          const precoExibicao = p.desconto ? `R$ ${p.preco} (Promoção: R$ ${p.desconto})` : `R$ ${p.preco}`;
          catalogoDinamico += `- [${p.categoria}] ${p.titulo} (${p.specs || ''}): ${precoExibicao} - Prazo: ${p.prazo || 'Consultar'}\n`;
        });
      } else {
        catalogoDinamico = "O catálogo está vazio no momento. Avise o vendedor para cadastrar os produtos no sistema.";
      }
    }

    if (mode === 'clear') {
      if (orcamentoId) {
        await supabase.from('copilot_historico').delete().eq('orcamento_id', orcamentoId).eq('vendedor_cpf', vendedorCpf);
      } else {
        memoriaTemporaria.delete(nomeContatoZap);
      }
      return res.json({ reply: "Memória apagada com sucesso!" });
    }

    let systemInstruction = "";

    if (mode === 'orcamento') {
      systemInstruction = `Você é a PrintIA, assistente especialista em criação de orçamentos e propostas comerciais. Vendedor atual: ${vendedor?.name || 'Vendedor'}.
      Sua tarefa é ajudar o vendedor a montar um orçamento atraente e lucrativo. Você pode sugerir descontos, combos e estratégias de fechamento.
      DADOS DO CONTATO: ${nomeContatoZap}.
      CARRINHO ATUAL (se houver): ${lead?.itens ? JSON.stringify(lead.itens) : 'Vazio'}.
      Gere textos de proposta comercial prontos para enviar pro WhatsApp do cliente, com formatação limpa e gatilhos mentais. Não forneça código.`;
    } else if (mode === 'cliente') {
      if (contextType === 'whatsapp') {
        systemInstruction = `Você é um assistente rápido de WhatsApp especializado em gráficas. Vendedor atual: ${vendedor?.name || 'Vendedor'}. Sua tarefa é gerar respostas curtas, amigáveis, empáticas e com uso estratégico de emojis para o WhatsApp do cliente. DADOS DO CONTATO: ${nomeContatoZap}. Gere 3 opções rápidas de resposta para copiar e colar baseadas no que o cliente mandou.`;
      } else {
        systemInstruction = `Você é a PrintIA, especialista em fechamento B2B e CRM de Vendas. Vendedor atual: ${vendedor?.name || 'Vendedor'}. Sua tarefa é agir rápido. O vendedor colará uma objeção do cliente baseada no Lead. Gere argumentos estruturados e persuasivos para quebrar a objeção. Não use tabela de preços a menos que o vendedor peça. DADOS DO LEAD: ${nomeContatoZap}. OBSERVAÇÕES: ${lead.observacoes || 'Nenhuma'}`;
      }
    } else {
      if (contextType === 'whatsapp') {
        systemInstruction = `Você é a PrintIA, assistente de bolso do vendedor para WhatsApp. Vendedor atual: ${vendedor?.name || 'Vendedor'}.
        Você tem acesso ao catálogo de preços da gráfica e deve ajudar o vendedor a responder dúvidas de cotação rápido.
        CONTATO ATUAL: ${nomeContatoZap}
        ${catalogoDinamico}
        Responda de forma direta e curta, sem formalidades excessivas. Se for para corrigir texto, retorne APENAS o texto corrigido, sem aspas.`;
      } else {
        systemInstruction = `Você é a PrintIA, mentor estratégico de contas B2B. Vendedor atual: ${vendedor?.name || 'Vendedor'}.
        Você tem acesso completo aos dados ricos do CRM (Leads) e ao catálogo de preços.
        LEAD ATUAL: ${nomeContatoZap}
        ${dadosEnriquecidos}
        ${catalogoDinamico}
        Seja analítico. Foque em fechar negócio, cruze os dados enriquecidos com os produtos para montar propostas B2B. Se for para corrigir um texto, APENAS retorne o texto corrigido.`;
      }
    }

    let geminiHistory = [];
    if (orcamentoId) {
      const { data: hist } = await supabase
        .from('copilot_historico')
        .select('role, content')
        .eq('orcamento_id', orcamentoId)
        .eq('vendedor_cpf', vendedorCpf)
        .order('criado_em', { ascending: true })
        .limit(10);

      if (hist) {
        geminiHistory = hist.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
      }
    } else {
      geminiHistory = memoriaTemporaria.get(nomeContatoZap) || [];
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: systemInstruction
    });

    const chat = model.startChat({ history: geminiHistory });
    const result = await chat.sendMessage(message);
    const respostaIA = result.response.text();

    if (orcamentoId) {
      await supabase.from('copilot_historico').insert([
        { orcamento_id: orcamentoId, role: 'user', content: message, tab: mode, vendedor_cpf: vendedorCpf },
        { orcamento_id: orcamentoId, role: 'assistant', content: respostaIA, tab: mode, vendedor_cpf: vendedorCpf }
      ]);
    } else {
      const novoHistorico = [...geminiHistory, { role: 'user', parts: [{ text: message }] }, { role: 'model', parts: [{ text: respostaIA }] }];
      memoriaTemporaria.set(nomeContatoZap, novoHistorico);
    }

    res.json({ reply: respostaIA });

  } catch (error) {
    console.error('Erro Copilot:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// ROTAS DE WHATSAPP (EVOLUTION API)

// Sync de histórico - busca últimas 50 msgs para extrair nome
app.post('/api/whatsapp/sync', async (req, res) => {
  res.json({ success: true, message: 'Função de sincronização desativada no Baileys Nativo.' });
});

// Marcar como lida
app.put('/api/whatsapp/chats/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    await supabase.from('whatsapp_chats').update({ unread_count: 0 }).eq('id', id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/whatsapp/chats/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    await supabase.from('whatsapp_chats').update({ unread_count: 0 }).eq('id', id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Enviar mensagem
app.post('/api/whatsapp/send', async (req, res) => {
  try {
    const { number, text, imageUrl } = req.body;
    const graficaId = req.grafica_id;
    if (!number || (!text && !imageUrl)) {
      return res.status(400).json({ error: 'Número e texto (ou imagem) são obrigatórios.' });
    }

    const data = await enviarMensagem(graficaId, number, text, imageUrl);

    // Salva no banco
    const remoteJid = number.includes('@s.whatsapp.net') ? number : `${number}@s.whatsapp.net`;
    let { data: chat } = await supabase.from('whatsapp_chats').select('*').eq('remote_jid', remoteJid).eq('grafica_id', graficaId).maybeSingle();

    if (!chat) {
      const { data: newChat } = await supabase.from('whatsapp_chats').insert([{
        remote_jid: remoteJid,
        push_name: number,
        number: number.replace('@s.whatsapp.net', ''),
        last_message: text,
        unread_count: 0,
        grafica_id: graficaId
      }]).select().single();
      chat = newChat;
    } else {
      const { data: updatedChat } = await supabase.from('whatsapp_chats').update({
        last_message: text,
        last_message_time: new Date().toISOString()
      }).eq('id', chat.id).select().single();
      chat = updatedChat;
    }

    if (chat) {
      await supabase.from('whatsapp_messages').insert([{
        chat_id: chat.id,
        content: text,
        from_me: true,
        message_id: data?.key?.id || `msg_${Date.now()}`,
        grafica_id: graficaId
      }]);
    }

    res.json({ success: true, message: 'Mensagem enviada com sucesso!' });
  } catch (error) {
    console.error('Erro ao enviar WhatsApp:', error);
    res.status(500).json({ error: 'Erro interno ao enviar mensagem.' });
  }
});

// Start a session for a specific Grafica
const startBaileysSession = async (graficaId) => {
  await initWhatsApp(graficaId, {
    onMessageUpsert: async ({ messages }, sock, gId) => {
      try {
        for (const msg of messages) {
          if (!msg.message) continue;
          let resolvedJid = msg.key.remoteJid;
          if (!resolvedJid || resolvedJid.includes('@g.us') || resolvedJid === 'status@broadcast') continue;

          const pushName = msg.pushName || 'Desconhecido';
          let textMessage = msg.message?.conversation || msg.message?.extendedTextMessage?.text;

          if (!textMessage) {
            const msgType = Object.keys(msg.message)[0];
            if (msgType === 'imageMessage') textMessage = "📷 Imagem recebida";
            else if (msgType === 'videoMessage') textMessage = "🎥 Vídeo recebido";
            else if (msgType === 'audioMessage') textMessage = "🎵 Áudio recebido";
            else if (msgType === 'documentMessage') textMessage = "📄 Documento recebido";
            else if (msgType === 'stickerMessage') textMessage = "🖼️ Figurinha recebida";
            else if (msgType === 'contactMessage') textMessage = "👤 Contato recebido";
            else continue;
          }

          let number = resolvedJid.split('@')[0];
          
          if (resolvedJid.includes('@lid')) {
            try {
              const fs = await import('fs');
              const path = await import('path');
              const mapFile = path.join(process.cwd(), 'sessions', `auth_info_${gId}`, `lid-mapping-${number}_reverse.json`);
              if (fs.existsSync(mapFile)) {
                const realNumber = JSON.parse(fs.readFileSync(mapFile, 'utf8'));
                number = realNumber;
                resolvedJid = `${number}@s.whatsapp.net`;
              }
            } catch (e) {
              console.error("Erro ao resolver LID:", e);
            }
          }
          
          // Lógica de inserção isolada por grafica_id
          let { data: chat } = await supabase.from('whatsapp_chats').select('*').eq('number', number).eq('grafica_id', gId).maybeSingle();
          if (!chat) {
            const { data: newChat } = await supabase.from('whatsapp_chats').insert([{
               remote_jid: resolvedJid, push_name: pushName, number: number, unread_count: 0, grafica_id: gId
            }]).select().single();
            chat = newChat;
          }

          if (chat) {
            const isFromMe = msg.key.fromMe || false;
            const updateData = { last_message: textMessage, last_message_time: new Date().toISOString() };

            if (!isFromMe) {
              updateData.unread_count = (chat.unread_count || 0) + 1;
            } else {
              updateData.unread_count = 0;
            }

            await supabase.from('whatsapp_chats').update(updateData).eq('id', chat.id);

            if (msg.key.id) {
              const { data: msgExists } = await supabase.from('whatsapp_messages').select('id').eq('message_id', msg.key.id).maybeSingle();
              if (!msgExists) {
                let mediaUrl = null;
                let mediaType = null;
                let mediaMimetype = null;

                const msgType = Object.keys(msg.message)[0];
                const mediaTypes = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'];
                
                if (mediaTypes.includes(msgType)) {
                  try {
                    const { downloadMediaMessage } = await import('@whiskeysockets/baileys');
                    const buffer = await downloadMediaMessage(msg, 'buffer', {}, { reuploadRequest: sock.updateMediaMessage });
                    
                    const mimetype = msg.message[msgType]?.mimetype || 'application/octet-stream';
                    let ext = 'bin';
                    if (mimetype.includes('image/jpeg')) ext = 'jpg';
                    else if (mimetype.includes('image/png')) ext = 'png';
                    else if (mimetype.includes('video/mp4')) ext = 'mp4';
                    else if (mimetype.includes('audio/ogg')) ext = 'ogg';
                    else if (mimetype.includes('application/pdf')) ext = 'pdf';
                    else if (msgType === 'stickerMessage') ext = 'webp';

                    const fileName = `${chat.id}/${Date.now()}_${msg.key.id}.${ext}`;
                    
                    const { uploadMedia } = await import('./storageService.js');
                    mediaUrl = await uploadMedia(fileName, buffer, mimetype);
                    mediaType = msgType;
                    mediaMimetype = mimetype;
                    console.log(`Mídia processada e salva em: ${mediaUrl}`);
                  } catch (mediaErr) {
                    console.error("Erro ao processar mídia:", mediaErr);
                  }
                }

                await supabase.from('whatsapp_messages').insert([{
                  chat_id: chat.id, 
                  message_id: msg.key.id, 
                  content: textMessage, 
                  from_me: isFromMe, 
                  grafica_id: gId,
                  media_url: mediaUrl,
                  media_type: mediaType,
                  media_mimetype: mediaMimetype
                }]);
              }
            }
          }
        }
      } catch (e) { console.error("Erro onMessageUpsert:", e); }
    },
    onMessageUpdate: async (updates, sock, gId) => {
      try {
        for (const update of updates) {
           const messageId = update.key?.id;
           const status = update.update?.status;
           const remoteJid = update.key?.remoteJid;
           if (messageId && status !== undefined) {
             const statusMap = { 2: 'sent', 3: 'delivered', 4: 'read' };
             const statusString = statusMap[status] || 'sent';
             await supabase.from('whatsapp_messages').update({ status: statusString }).eq('message_id', messageId);
             if (status === 4 && remoteJid) {
               const number = remoteJid.split('@')[0];
               await supabase.from('whatsapp_chats').update({ unread_count: 0 }).eq('number', number).eq('grafica_id', gId);
             }
           }
        }
      } catch (e) { }
    },
    onPresenceUpdate: async (presenceEvent, sock, gId) => {
       try {
         const remoteJid = presenceEvent.id;
         const presences = presenceEvent.presences;
         if (remoteJid && !remoteJid.includes('@g.us') && presences) {
            const p = Object.values(presences)[0];
            const isTyping = p?.lastKnownPresence === 'composing';
            await supabase.from('whatsapp_chats').update({ is_typing: isTyping }).eq('remote_jid', remoteJid).eq('grafica_id', gId);
         }
       } catch (e) { }
    },
    onContactsUpdate: async (contacts, sock, gId) => {
      try {
        for (const contact of contacts) {
          const number = contact.id?.split('@')[0];
          const name = contact.name || contact.notify || contact.verifiedName;
          if (number && name) {
            await supabase.from('whatsapp_chats').update({ push_name: name }).eq('number', number).eq('grafica_id', gId);
          }
        }
      } catch (e) {}
    }
  });
};

// Auto-start for primary Grafica (Compatibility)
startBaileysSession('11111111-1111-1111-1111-111111111111');

// Endpoints de Status e Conexão (Fase 1 + 2)
app.post('/api/whatsapp/connect', async (req, res) => {
  const graficaId = req.grafica_id;
  await startBaileysSession(graficaId);
  res.json({ success: true, message: 'Processo de conexão iniciado.' });
});

app.get('/api/whatsapp/status', (req, res) => {
  const graficaId = req.grafica_id;
  const statusInfo = getSessionStatus(graficaId);
  res.json(statusInfo);
});

app.post('/api/whatsapp/logout', async (req, res) => {
  const graficaId = req.grafica_id;
  const success = await logoutSession(graficaId);
  res.json({ success });
});

// Buscar conversas - SEM DUPLICATOS (um por número)
app.get('/api/whatsapp/chats', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('whatsapp_chats')
      .select('*')
      .not('remote_jid', 'ilike', '%@g.us%') // EXCLUI GRUPOS DA LISTAGEM
      .order('last_message_time', { ascending: false });
    if (error) throw error;

    // Remove duplicados pelo número - mantém o primeiro (mais recente)
    const seenNumbers = new Set();
    const uniqueChats = [];
    for (const chat of data) {
      if (!seenNumbers.has(chat.number)) {
        uniqueChats.push(chat);
        seenNumbers.add(chat.number);
      }
    }

    res.json(uniqueChats);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar conversas' });
  }
});

// Buscar mensagens de uma conversa
app.get('/api/whatsapp/chats/:chatId/messages', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { data, error } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar mensagens' });
  }
});

// Lazy load: busca mensagens e atualiza nome quando usuário abre o chat
app.post('/api/whatsapp/chats/:chatId/load-history', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { data: messages } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    res.json({ messages: messages || [] });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao carregar histórico' });
  }
});

// Marcar como lida
app.put('/api/whatsapp/chats/:chatId/read', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { error } = await supabase.from('whatsapp_chats').update({ unread_count: 0 }).eq('id', chatId);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar chat' });
  }
});

// Atualizar etiquetas (labels)
app.put('/api/whatsapp/chats/:chatId/labels', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { labels } = req.body;
    
    if (!Array.isArray(labels)) {
      return res.status(400).json({ error: 'Labels deve ser um array de strings' });
    }

    const { data, error } = await supabase
      .from('whatsapp_chats')
      .update({ labels })
      .eq('id', chatId)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, chat: data });
  } catch (error) {
    console.error('Erro ao atualizar labels:', error);
    res.status(500).json({ error: 'Erro ao atualizar etiquetas' });
  }
});

// Limpar chats duplicados
app.post('/api/whatsapp/clean-duplicates', async (req, res) => {
  try {
    const removed = await unifyDuplicateChats();
    res.json({ success: true, removed, message: `Unificados e limpos ${removed} chats duplicados, mensagens migradas.` });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao limpar duplicados' });
  }
});

// ==========================================
// RESUMO INTELIGENTE E ANOTAÇÕES (WHATSAPP)
// ==========================================
app.post('/api/whatsapp/chats/:id/summarize', async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Puxar as mensagens do chat
    const { data: messages, error: messagesError } = await supabase
      .from('whatsapp_messages')
      .select('content, from_me, created_at')
      .eq('chat_id', id)
      .order('created_at', { ascending: false })
      .limit(50); // Pegar as ultimas 50 para ter contexto sem estourar token
      
    if (!messages || messages.length === 0) {
      return res.status(404).json({ error: 'Nenhuma mensagem encontrada para resumir.' });
    }

    // Ordenar de forma cronológica (a mais antiga primeiro)
    const cronologicalMessages = messages.reverse();
    
    // Formatar como transcrição
    const transcript = cronologicalMessages.map(m => {
      const sender = m.from_me ? 'VENDEDOR' : 'CLIENTE';
      return `[${new Date(m.created_at).toLocaleTimeString()}] ${sender}: ${m.content || '(imagem/áudio)'}`;
    }).join('\n');

    // 2. Chamar o Gemini para gerar o Dossiê
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = `Você é um CRM automatizado da gráfica PrintIA. 
Abaixo está a transcrição das últimas mensagens trocadas pelo WhatsApp com um cliente. 
Sua tarefa é ler a conversa e extrair um Dossiê Rápido (Profile) do cliente. 

O Dossiê DEVE estar em formato Markdown contendo obrigatoriamente:
### Perfil do Cliente
- [Tom e Perfil de Compra baseado nas respostas]
### Resumo da Demanda
- [O que ele estava procurando ou o último pedido/orçamento conversado]
### Próximos Passos
- [Ação sugerida para o vendedor]

Se a conversa for muito curta ou não tiver detalhes de pedido, adapte da melhor forma e deduza pelo contexto. Seja sucinto.

--- TRANSCRIÇÃO ---
${transcript}
--- FIM DA TRANSCRIÇÃO ---
`;

    const result = await model.generateContent(prompt);
    const summary = result.response.text();

    // 3. Salvar o resumo no banco (coluna ai_summary na tabela whatsapp_chats)
    await supabase
      .from('whatsapp_chats')
      .update({ ai_summary: summary })
      .eq('id', id);

    return res.json({ summary });

  } catch (error) {
    console.error('Erro ao gerar resumo:', error);
    res.status(500).json({ error: 'Erro interno ao gerar resumo.' });
  }
});

app.put('/api/whatsapp/chats/:id/notes', async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    await supabase
      .from('whatsapp_chats')
      .update({ manual_notes: notes })
      .eq('id', id);

    return res.json({ success: true });
  } catch (error) {
    console.error('Erro ao salvar notas manuais:', error);
    res.status(500).json({ error: 'Erro ao salvar notas.' });
  }
});

// ==========================================
// 📄 ROTAS DE PROPOSTAS / ORÇAMENTOS (QUOTE BUILDER)
// ==========================================

app.get('/api/propostas', async (req, res) => {
  try {
    const { chatId } = req.query;
    let query = supabase.from('propostas').select('*').eq('grafica_id', req.grafica_id).order('criado_em', { ascending: false });
    
    if (chatId) {
      query = query.eq('chat_id', chatId);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Erro ao listar propostas:', error);
    res.status(500).json({ error: 'Erro ao listar propostas' });
  }
});

app.post('/api/propostas', async (req, res) => {
  try {
    const { chat_id, numero_cliente, nome_proposta, itens, valor_total, status } = req.body;
    const { data, error } = await supabase.from('propostas').insert([{
      chat_id, numero_cliente, nome_proposta, itens, valor_total, status, grafica_id: req.grafica_id
    }]).select().single();
    
    if (error) throw error;
    res.json({ success: true, proposta: data });
  } catch (error) {
    console.error('Erro ao criar proposta:', error);
    res.status(500).json({ error: 'Erro ao criar proposta' });
  }
});

app.put('/api/propostas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const { data, error } = await supabase.from('propostas')
      .update(updates)
      .eq('id', id)
      .eq('grafica_id', req.grafica_id)
      .select().single();
      
    if (error) throw error;
    res.json({ success: true, proposta: data });
  } catch (error) {
    console.error('Erro ao atualizar proposta:', error);
    res.status(500).json({ error: 'Erro ao atualizar proposta' });
  }
});

app.delete('/api/propostas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('propostas').delete().eq('id', id).eq('grafica_id', req.grafica_id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao excluir proposta:', error);
    res.status(500).json({ error: 'Erro ao excluir proposta' });
  }
});


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
          return `[${new Date(m.created_at).toLocaleTimeString()}] ${sender}: ${m.content || '(arquivo/imagem)'}`;
        }).join('\n');
      }
    }
    
    // Puxa os itens da proposta se existir
    let propostaText = 'Sem itens da proposta informados.';
    if (propostaId) {
      const { data: proposta } = await supabase.from('propostas').select('*').eq('id', propostaId).single();
      if (proposta && proposta.itens) {
        propostaText = proposta.itens.map(i => `- ${i.quantidade}x ${i.titulo} (${i.specs || 'Sem especificações extras'})`).join('\n');
      }
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = `Você é um Assistente de Produção da gráfica PrintIA.
Sua tarefa é ler a negociação feita no WhatsApp e os itens fechados na proposta, e escrever uma ORDEM DE SERVIÇO TÉCNICA E CLARA para a equipe do chão de fábrica (que vai operar as impressoras, plotters, encadernadoras, etc).
A equipe de produção NÃO deve ver valores financeiros nem papo de vendedor, apenas os detalhes TÉCNICOS: o que é para imprimir, tamanhos, cores, acabamentos, se o cliente enviou arte pronta ou precisa fazer, etc.

ITENS DO ORÇAMENTO APROVADO:
${propostaText}

HISTÓRICO DA CONVERSA:
${transcript}

Escreva a Ordem de Serviço em Markdown usando:
### 📌 Resumo do Trabalho
[Descreva o que é para fazer]
### ⚙️ Instruções Técnicas e Acabamentos
[Quais os materiais, cortes, vincos, encadernações, etc que foram combinados]
### 📎 Status das Artes
[A arte foi enviada? Quem vai criar? Onde ela está?]`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    res.json({ success: true, resumo_ia: text });
  } catch (error) {
    console.error('Erro ao gerar OS:', error);
    res.status(500).json({ error: 'Falha ao gerar Ordem de Serviço' });
  }
});

// Endpoint fallback - 404
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint não encontrado no Cérebro PrintIA' });
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`Cérebro PrintIA rodando na porta ${process.env.PORT || 3000}`);
});

