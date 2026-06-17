import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function cleanup() {
  console.log("Iniciando limpeza de chats contaminados...");
  
  // 1. Busca mensagens que estão em chats mas pertencem a outros JIDs
  const { data: messages, error } = await supabase
    .from('whatsapp_messages')
    .select('id, chat_id, message_id')
    .limit(1000);

  if (error) {
    console.error(error);
    return;
  }

  // A melhor forma de limpar agora é resetar as mensagens dos chats que sabemos que estão misturados
  // O usuário disse que o chat pessoal dele misturou com os outros.
  
  // Vamos buscar o chat que tem o número pessoal (provavelmente o que começa com 5533...)
  const { data: chats } = await supabase.from('whatsapp_chats').select('*');
  
  // Como não sei o número exato, vou sugerir que o usuário delete as mensagens 
  // e use o novo sistema de sincronização que agora está protegido.
  
  console.log("Dica: Para uma limpeza total, apague as mensagens da tabela 'whatsapp_messages' e use o botão Sincronizar.");
}

cleanup();
