import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function check() {
  const { data: chats, error } = await supabase
    .from('whatsapp_chats')
    .select('id, number, remote_jid, push_name')
    .order('number');

  if (error) {
    console.error('Error fetching chats:', error);
    return;
  }

  console.log('--- WHATSAPP CHATS ---');
  chats.forEach(c => {
    console.log(`ID: ${c.id} | Number: ${c.number} | JID: ${c.remote_jid} | Name: ${c.push_name}`);
  });

  const numbers = chats.map(c => c.number);
  const duplicates = numbers.filter((item, index) => numbers.indexOf(item) !== index);
  console.log('\nDuplicate numbers:', [...new Set(duplicates)]);
}

check();
