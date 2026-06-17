import fs from 'fs';

let content = fs.readFileSync('server.js', 'utf8');

// 1. Add imports
if (!content.includes('whatsappService.js')) {
  content = content.replace(
    "import { GoogleGenerativeAI } from '@google/generative-ai';",
    "import { GoogleGenerativeAI } from '@google/generative-ai';\nimport { initWhatsApp, enviarMensagem, getBaileysOwnerNumber } from './whatsappService.js';"
  );
}

// 2. Replace getOwnerNumber
const oldGetOwnerNumber = `async function getOwnerNumber() {
  if (ownerNumber) return ownerNumber;
  try {
    const apiUrl = process.env.EVOLUTION_API_URL || 'https://evolution-backend.duckdns.org';
    const apiKey = process.env.EVOLUTION_API_KEY;
    const instance = process.env.EVOLUTION_INSTANCE_NAME;
    const response = await fetch(\`\${apiUrl}/instance/displayState/\${instance}\`, {
      headers: { 'apikey': apiKey }
    });
    if (response.ok) {
      const data = await response.json();
      ownerNumber = data.instance?.ownerJid?.split('@')[0] || data.instance?.number;
      console.log("Número da instância detectado:", ownerNumber);
    }
  } catch (e) {
    console.error("Erro ao buscar número do dono:", e);
  }
  return ownerNumber;
}`;

const newGetOwnerNumber = `async function getOwnerNumber() {
  if (ownerNumber) return ownerNumber;
  const num = getBaileysOwnerNumber();
  if (num) {
    ownerNumber = num;
  }
  return ownerNumber;
}`;
content = content.replace(oldGetOwnerNumber, newGetOwnerNumber);

// 3. Replace the /api/whatsapp/send logic
const oldSendRegex = /app\.post\('\/api\/whatsapp\/send', async \(req, res\) => \{[\s\S]*?\/\/\/ Webhook - receber mensagens/m;
const newSend = `app.post('/api/whatsapp/send', async (req, res) => {
  try {
    const { number, text } = req.body;
    if (!number || !text) {
      return res.status(400).json({ error: 'Número e texto são obrigatórios.' });
    }

    const data = await enviarMensagem(number, text);

    // Salva no banco
    const remoteJid = number.includes('@s.whatsapp.net') ? number : \`\${number}@s.whatsapp.net\`;
    let { data: chat } = await supabase.from('whatsapp_chats').select('*').eq('remote_jid', remoteJid).maybeSingle();

    if (!chat) {
      const { data: newChat } = await supabase.from('whatsapp_chats').insert([{
        remote_jid: remoteJid,
        push_name: number,
        number: number.replace('@s.whatsapp.net', ''),
        last_message: text,
        unread_count: 0
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
      const { data: insertedMsg, error: insertError } = await supabase.from('whatsapp_messages').insert([{
        chat_id: chat.id,
        content: text,
        from_me: true,
        message_id: data?.key?.id || \`msg_\${Date.now()}\`
      }]).select().single();
    }

    res.json({ success: true, message: 'Mensagem enviada com sucesso!' });
  } catch (error) {
    console.error('Erro ao enviar WhatsApp:', error);
    res.status(500).json({ error: 'Erro interno ao enviar mensagem.' });
  }
});

// Webhook - receber mensagens`;

content = content.replace(oldSendRegex, newSend);

// 4. Replace the webhook with Baileys Initialization
const oldWebhookRegex = /\/\/ Webhook - receber mensagens\napp\.post\('\/api\/webhook\/evolution'[\s\S]*?\/\/ Buscar conversas - SEM DUPLICATOS/m;

const newWebhook = `// Baileys Events Listener
initWhatsApp({
  onMessageUpsert: async ({ messages }) => {
    try {
      for (const msg of messages) {
        if (!msg.message) continue;
        const remoteJid = msg.key.remoteJid;
        
        if (!remoteJid || remoteJid.includes('@g.us') || remoteJid === 'status@broadcast') continue;

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

        let number = remoteJid.split('@')[0];
        const chat = await getOrCreateChat(remoteJid, /^(Carregando|Desconhecido)$/.test(pushName) ? null : pushName, number);

        if (chat) {
          const isFromMe = msg.key.fromMe || false;
          const updateData = { last_message: textMessage, last_message_time: new Date().toISOString() };

          if (!isFromMe) {
            const { data: currentChat } = await supabase.from('whatsapp_chats').select('unread_count').eq('id', chat.id).single();
            updateData.unread_count = (currentChat?.unread_count || 0) + 1;
          } else {
            updateData.unread_count = 0;
          }

          await supabase.from('whatsapp_chats').update(updateData).eq('id', chat.id);

          if (msg.key.id) {
            const { data: msgExists } = await supabase.from('whatsapp_messages').select('id').eq('message_id', msg.key.id).maybeSingle();
            if (!msgExists) {
              await supabase.from('whatsapp_messages').insert([{
                chat_id: chat.id,
                message_id: msg.key.id,
                content: textMessage,
                from_me: isFromMe
              }]);
            }
          }
        }
      }
    } catch (e) {
      console.error("Erro processando onMessageUpsert:", e);
    }
  },
  onMessageUpdate: async (updates) => {
    try {
      for (const update of updates) {
        const messageId = update.key?.id;
        const status = update.update?.status;
        const remoteJid = update.key?.remoteJid;

        if (messageId && status !== undefined) {
          // Baileys status: 2 (SERVER), 3 (DELIVERY_ACK), 4 (READ)
          const statusMap = { 2: 'sent', 3: 'delivered', 4: 'read' };
          const statusString = statusMap[status] || 'sent';

          await supabase.from('whatsapp_messages').update({ status: statusString }).eq('message_id', messageId);

          if (status === 4 && remoteJid) {
             const number = remoteJid.split('@')[0];
             await supabase.from('whatsapp_chats').update({ unread_count: 0 }).eq('number', number);
          }
        }
      }
    } catch (e) {
      console.error("Erro processando onMessageUpdate:", e);
    }
  },
  onPresenceUpdate: async (presenceEvent) => {
     try {
       const remoteJid = presenceEvent.id;
       const presences = presenceEvent.presences;
       if (remoteJid && !remoteJid.includes('@g.us') && presences) {
          const p = Object.values(presences)[0];
          const isTyping = p?.lastKnownPresence === 'composing';
          await supabase.from('whatsapp_chats').update({ is_typing: isTyping }).eq('remote_jid', remoteJid);
       }
     } catch (e) { }
  },
  onContactsUpdate: async (contacts) => {
    try {
      for (const contact of contacts) {
        const number = contact.id?.split('@')[0];
        const name = contact.name || contact.notify || contact.verifiedName;
        if (number && name) {
          await supabase.from('whatsapp_chats').update({ push_name: name }).eq('number', number).neq('push_name', null);
        }
      }
    } catch (e) {}
  }
});

// Buscar conversas - SEM DUPLICATOS`;

content = content.replace(oldWebhookRegex, newWebhook);

// 5. Disable old sync endpoint
const oldSyncRegex = /app\.post\('\/api\/whatsapp\/sync', async \(req, res\) => \{[\s\S]*?res\.json\(\{ success: true, message: \`Sincronização concluída! \$\{syncCount\} conversas\/contatos processados\.\` \}\);\n  \} catch \(error\) \{[\s\S]*?\}\n\}\);/m;

const newSync = `app.post('/api/whatsapp/sync', async (req, res) => {
  res.json({ success: true, message: 'Função de sincronização desativada no Baileys Nativo.' });
});`;

content = content.replace(oldSyncRegex, newSync);

// 6. Handle the extra load-history route that uses syncMessages
const oldLoadHistoryRegex = /app\.post\('\/api\/whatsapp\/chats\/:chatId\/load-history', async \(req, res\) => \{[\s\S]*?res\.status\(500\)\.json\(\{ error: 'Erro ao carregar histórico' \}\);\n  \}\n\}\);/m;

const newLoadHistory = `app.post('/api/whatsapp/chats/:chatId/load-history', async (req, res) => {
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
});`;

content = content.replace(oldLoadHistoryRegex, newLoadHistory);

fs.writeFileSync('server.js', content, 'utf8');
console.log('server.js modificado com sucesso!');
