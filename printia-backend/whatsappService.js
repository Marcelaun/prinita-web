import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcodeTerminal from 'qrcode-terminal';
import qrcode from 'qrcode';

// Map to store sessions: { [graficaId]: { sock, status, qrCode, ownerNumber } }
const sessions = new Map();

export async function initWhatsApp(graficaId, callbacks) {
  if (sessions.has(graficaId) && sessions.get(graficaId).status === 'connected') {
    return sessions.get(graficaId);
  }

  const { onMessageUpsert, onMessageUpdate, onPresenceUpdate, onContactsUpdate } = callbacks;
  const authPath = `./sessions/auth_info_${graficaId}`;
  
  // Cria pasta localmente de forma nativa se n existir
  const fs = await import('fs');
  if (!fs.existsSync('./sessions')) {
    fs.mkdirSync('./sessions');
  }

  const { state, saveCreds } = await useMultiFileAuthState(authPath);
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`Usando WA v${version.join('.')}, isLatest: ${isLatest}`);

  if (!sessions.has(graficaId)) {
    sessions.set(graficaId, { sock: null, status: 'connecting', qrCode: null, ownerNumber: null });
  }
  const sessionData = sessions.get(graficaId);
  sessionData.status = 'connecting';
  sessionData.qrCode = null;

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }), 
    printQRInTerminal: false,
    syncFullHistory: false,
    browser: ['Printia CRM', 'Chrome', '20.0.04'],
    qrTimeout: 120000, // Dá 2 minutos de tempo total para ler o QR
    getMessage: async (key) => {
      return { conversation: '...' };
    },
    cachedGroupMetadata: async (jid) => {}
  });
  
  sessionData.sock = sock;

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      console.log(`\n=== NOVO QR CODE GERADO PARA A GRÁFICA: ${graficaId} ===\n`);
      qrcodeTerminal.generate(qr, { small: true });
      // Converter para Data URL (Base64) para o Frontend
      const qrDataUrl = await qrcode.toDataURL(qr);
      sessionData.status = 'qr';
      sessionData.qrCode = qrDataUrl;
    }
    
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log(`Conexão fechada para gráfica ${graficaId}. Reconectando...`, shouldReconnect);
      console.error("Motivo do erro:", lastDisconnect?.error);
      sessionData.status = 'disconnected';
      sessionData.qrCode = null;
      if (shouldReconnect) {
        setTimeout(() => initWhatsApp(graficaId, callbacks), 3000);
      } else {
        console.log(`Gráfica ${graficaId} deslogou.`);
      }
    } else if (connection === 'open') {
      console.log(`✅ WhatsApp conectado para a gráfica ${graficaId}!`);
      sessionData.status = 'connected';
      sessionData.qrCode = null;
      sessionData.ownerNumber = sock.user?.id?.split(':')[0] || null;
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async (m) => {
    if (onMessageUpsert) onMessageUpsert(m, sock, graficaId);
  });

  sock.ev.on('messages.update', async (m) => {
    if (onMessageUpdate) onMessageUpdate(m, sock, graficaId);
  });

  sock.ev.on('presence.update', async (p) => {
    if (onPresenceUpdate) onPresenceUpdate(p, sock, graficaId);
  });

  sock.ev.on('contacts.upsert', async (c) => {
    if (onContactsUpdate) onContactsUpdate(c, sock, graficaId);
  });
  
  sock.ev.on('contacts.update', async (c) => {
    if (onContactsUpdate) onContactsUpdate(c, sock, graficaId);
  });

  return sessionData;
}

export async function enviarMensagem(graficaId, number, text, imageUrl = null) {
  const session = sessions.get(graficaId);
  if (!session || !session.sock || session.status !== 'connected') {
    throw new Error('WhatsApp não está conectado para esta gráfica.');
  }
  let jid = number;
  if (!jid.includes('@')) {
    jid = `${jid}@s.whatsapp.net`;
  }
  
  let result;
  if (imageUrl) {
    result = await session.sock.sendMessage(
      jid, 
      { image: { url: imageUrl }, caption: text }
    );
  } else {
    result = await session.sock.sendMessage(
      jid, 
      { text }
    );
  }
  return result;
}

export function getBaileysOwnerNumber(graficaId) {
  const session = sessions.get(graficaId);
  if (!session || !session.ownerNumber) return null;
  return session.ownerNumber;
}

export function getSessionStatus(graficaId) {
  const session = sessions.get(graficaId);
  if (!session) return { status: 'disconnected', qrCode: null };
  return { status: session.status, qrCode: session.qrCode };
}

export async function logoutSession(graficaId) {
  const session = sessions.get(graficaId);
  if (session && session.sock) {
    await session.sock.logout();
    sessions.delete(graficaId);
    
    // Deleta a pasta de sessão local
    const fs = await import('fs');
    const dir = `./sessions/auth_info_${graficaId}`;
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    return true;
  }
  return false;
}
