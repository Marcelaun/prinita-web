import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Define the storage provider: 'supabase', 'r2' ou 'local_api'
// Quando você criar o mini-servidor ou conta R2 no futuro, basta alterar isso no .env
const STORAGE_PROVIDER = process.env.STORAGE_PROVIDER || 'supabase';
const LOCAL_API_URL = process.env.LOCAL_API_URL || 'http://localhost:4000/upload';

// Variáveis para a Cloudflare R2
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'printia-media';
const R2_PUBLIC_DEV_URL = process.env.R2_PUBLIC_DEV_URL || ''; // Ex: https://pub-xxxxxxxxxxxxxx.r2.dev

/**
 * Faz o upload de um buffer de mídia para o provedor de armazenamento configurado.
 * @param {string} fileName Nome do arquivo (ex: chat_id/123_abc.pdf)
 * @param {Buffer} buffer Conteúdo do arquivo em memória
 * @param {string} mimetype Tipo do arquivo (ex: application/pdf)
 * @returns {Promise<string>} URL pública do arquivo
 */
export async function uploadMedia(fileName, buffer, mimetype) {
  try {
    if (STORAGE_PROVIDER === 'supabase') {
      const { data, error } = await supabase.storage.from('whatsapp_media').upload(fileName, buffer, {
        contentType: mimetype
      });
      
      if (error) {
        console.error("Erro no upload para Supabase:", error);
        throw error;
      }
      
      const { data: publicUrlData } = supabase.storage.from('whatsapp_media').getPublicUrl(fileName);
      return publicUrlData.publicUrl;
      
    } else if (STORAGE_PROVIDER === 'r2') {
      // --------------------------------------------------------------------------------
      // INTEGRAÇÃO CLOUDFLARE R2
      // --------------------------------------------------------------------------------
      const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
      
      const s3Client = new S3Client({
        region: "auto",
        endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: R2_ACCESS_KEY_ID,
          secretAccessKey: R2_SECRET_ACCESS_KEY,
        },
      });

      const command = new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: fileName,
        Body: buffer,
        ContentType: mimetype,
      });

      await s3Client.send(command);
      
      // Retorna a URL pública que o Cloudflare R2 gera para você (precisa estar ativado no painel deles)
      return `${R2_PUBLIC_DEV_URL}/${fileName}`;

    } else if (STORAGE_PROVIDER === 'local_api') {
      // --------------------------------------------------------------------------------
      // PREPARADO PARA O FUTURO:
      // Aqui ficaria o código para enviar o Buffer para o seu "Mini Servidor Local".
      // Você vai construir uma API simples (ex: Node.js/Express) rodando na máquina.
      // --------------------------------------------------------------------------------
      
      /* Exemplo de implementação futura:
      const formData = new FormData();
      formData.append('file', new Blob([buffer], { type: mimetype }), fileName);
      
      const response = await fetch(LOCAL_API_URL, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) throw new Error("Erro na API local");
      
      const result = await response.json();
      return result.public_url; // O seu mini servidor precisa retornar a URL onde o arquivo pode ser acessado
      */
      
      console.log("Upload para API Local ainda não está ativo. Retornando URL simulada.");
      return `http://meu-mini-servidor.local/files/${fileName}`;
    }
  } catch (err) {
    console.error("Erro fatal no StorageService:", err);
    throw err;
  }
}
