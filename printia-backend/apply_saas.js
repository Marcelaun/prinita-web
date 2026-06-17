import fs from 'fs';

let content = fs.readFileSync('server.js', 'utf8');

// 1. Update imports
if (!content.includes('getSessionStatus')) {
  content = content.replace(
    "import { initWhatsApp, enviarMensagem, getBaileysOwnerNumber } from './whatsappService.js';",
    "import { initWhatsApp, enviarMensagem, getBaileysOwnerNumber, getSessionStatus, logoutSession } from './whatsappService.js';"
  );
}

// 2. Add middleware
if (!content.includes('req.grafica_id =')) {
  content = content.replace(
    "app.use(express.urlencoded({ limit: '50mb', extended: true }));",
    "app.use(express.urlencoded({ limit: '50mb', extended: true }));\n\n// Middleware Multi-Tenant\napp.use((req, res, next) => {\n  req.grafica_id = req.headers['x-grafica-id'] || '11111111-1111-1111-1111-111111111111';\n  next();\n});"
  );
}

// 3. Update /api/whatsapp/send to use req.grafica_id
const oldSendRegex = /app\.post\('\/api\/whatsapp\/send', async \(req, res\) => \{[\s\S]*?res\.status\(500\)\.json\(\{ error: 'Erro interno ao enviar mensagem.' \}\);\n  \}\n\}\);/m;
const newSend = `app.post('/api/whatsapp/send', async (req, res) => {
  try {
    const { number, text } = req.body;
    const graficaId = req.grafica_id;
    if (!number || !text) {
      return res.status(400).json({ error: 'Número e texto são obrigatórios.' });
    }

    const data = await enviarMensagem(graficaId, number, text);

    // Salva no banco
    const remoteJid = number.includes('@s.whatsapp.net') ? number : \`\${number}@s.whatsapp.net\`;
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
        message_id: data?.key?.id || \`msg_\${Date.now()}\`,
        grafica_id: graficaId
      }]);
    }

    res.json({ success: true, message: 'Mensagem enviada com sucesso!' });
  } catch (error) {
    console.error('Erro ao enviar WhatsApp:', error);
    res.status(500).json({ error: 'Erro interno ao enviar mensagem.' });
  }
});`;

if (content.match(oldSendRegex)) {
   content = content.replace(oldSendRegex, newSend);
}

// 4. Update the Baileys initialization block
const initBlockRegex = /\/\/ Baileys Events Listener\ninitWhatsApp\(\{[\s\S]*?\}\);\n\n\/\/ Buscar conversas/m;

const newInitBlock = `// Start a session for a specific Grafica
const startBaileysSession = async (graficaId) => {
  await initWhatsApp(graficaId, {
    onMessageUpsert: async ({ messages }, sock, gId) => {
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
          
          // Lógica de inserção isolada por grafica_id
          let { data: chat } = await supabase.from('whatsapp_chats').select('*').eq('number', number).eq('grafica_id', gId).maybeSingle();
          if (!chat) {
            const { data: newChat } = await supabase.from('whatsapp_chats').insert([{
               remote_jid: remoteJid, push_name: pushName, number: number, unread_count: 0, grafica_id: gId
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
                await supabase.from('whatsapp_messages').insert([{
                  chat_id: chat.id, message_id: msg.key.id, content: textMessage, from_me: isFromMe, grafica_id: gId
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

// Buscar conversas`;

if (content.match(initBlockRegex)) {
  content = content.replace(initBlockRegex, newInitBlock);
}

fs.writeFileSync('server.js', content, 'utf8');
console.log('server.js refatorado para SaaS com sucesso!');
