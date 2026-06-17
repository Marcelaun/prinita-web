import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function run() {
  console.log('Criando tabela...');
  const res = await supabase.rpc('exec_sql', { sql: `
    CREATE TABLE IF NOT EXISTS categorias (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      nome TEXT NOT NULL UNIQUE,
      ordem INTEGER DEFAULT 0,
      criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    INSERT INTO categorias (nome, ordem) VALUES 
      ('Cartões de Visita', 1), 
      ('Blocos de Pedido', 2), 
      ('Adesivos e Rótulos', 3), 
      ('Panfletos', 4), 
      ('Banners', 5), 
      ('Lonas', 6), 
      ('Brindes', 7), 
      ('Calendários', 8) 
    ON CONFLICT (nome) DO NOTHING;
  ` });
  console.log(res);
}

run();
