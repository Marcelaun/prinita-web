import type { Lead } from '../types/index';
import { supabase } from '../lib/supabase';

// Puxando a URL do backend de forma segura do .env (ou da Vercel)
const API_URL = import.meta.env.VITE_API_URL;

export const getLeads = async (): Promise<Lead[]> => {
  const res = await fetch(`${API_URL}/leads`);
  if (!res.ok) throw new Error('Erro ao buscar leads');
  return res.json();
};

export const sendCopilotMessage = async (lead: Lead, message: string, mode: 'cliente' | 'vendedor', vendedor?: any, contextType?: string) => {
  const res = await fetch(`${API_URL}/copilot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lead, message, mode, vendedor, contextType }) 
  });
  
  if (!res.ok) throw new Error('Erro no Copilot');
  const data = await res.json();
  return data.reply;
};

// ==========================================
// FUNÇÕES DO WHATSAPP (SUPABASE + EVOLUTION)
// ==========================================

export const getWhatsAppChats = async () => {
  const res = await fetch(`${API_URL}/whatsapp/chats`);
  if (!res.ok) throw new Error('Erro ao buscar conversas do WhatsApp');
  return res.json();
};

export const getWhatsAppMessages = async (chatId: string) => {
  const res = await fetch(`${API_URL}/whatsapp/chats/${chatId}/messages`);
  if (!res.ok) throw new Error('Erro ao buscar mensagens');
  return res.json();
};

export const markChatAsRead = async (chatId: string) => {
  const res = await fetch(`${API_URL}/whatsapp/chats/${chatId}/read`, {
    method: 'PUT'
  });
  if (!res.ok) throw new Error('Erro ao marcar como lido');
  return res.json();
};

export const sendWhatsAppMessage = async (number: string, text: string, files?: Array<{url: string, mimetype: string, name: string}>) => {
  const res = await fetch(`${API_URL}/whatsapp/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ number, text, files }) 
  });
  
  if (!res.ok) throw new Error('Erro ao enviar mensagem');
  return res.json();
};

export const syncWhatsAppHistory = async () => {
  const res = await fetch(`${API_URL}/whatsapp/sync`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Erro ao sincronizar histórico');
  return res.json();
};

export const generateAiProfile = async (chatId: string) => {
  const res = await fetch(`${API_URL}/whatsapp/chats/${chatId}/summarize`, {
    method: 'POST'
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || 'Erro ao gerar resumo da IA');
  }
  return res.json();
};

export const updateManualNotes = async (chatId: string, notes: string) => {
  const res = await fetch(`${API_URL}/whatsapp/chats/${chatId}/notes`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes })
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || 'Erro ao salvar anotações manuais');
  }
  return res.json();
};

export const updateChatLabels = async (chatId: string, labels: string[]) => {
  const res = await fetch(`${API_URL}/whatsapp/chats/${chatId}/labels`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ labels })
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || 'Erro ao atualizar etiquetas');
  }
  return res.json();
};

// ==========================================
// ROTAS DE PROPOSTAS / ORÇAMENTOS
// ==========================================

export const getPropostas = async (chatId?: string) => {
  const url = chatId ? `${API_URL}/propostas?chatId=${chatId}` : `${API_URL}/propostas`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Erro ao listar propostas');
  return res.json();
};

export const createProposta = async (data: any) => {
  const res = await fetch(`${API_URL}/propostas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Erro ao criar proposta');
  return res.json();
};

export const updateProposta = async (id: string, updates: any) => {
  const res = await fetch(`${API_URL}/propostas/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  if (!res.ok) throw new Error('Erro ao atualizar proposta');
  return res.json();
};

export const deleteProposta = async (id: string) => {
  const res = await fetch(`${API_URL}/propostas/${id}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('Erro ao excluir proposta');
  return res.json();
};

// ==========================================
// CATEGORIAS (PASTAS DINÂMICAS)
// ==========================================
export const getCategorias = async () => {
  const { data, error } = await supabase.from('categorias').select('*').order('ordem', { ascending: true }).order('criado_em', { ascending: true });
  if (error) throw error;
  return data || [];
};

export const createCategoria = async (nome: string, ordem: number = 0) => {
  const { data, error } = await supabase.from('categorias').insert([{ nome, ordem }]).select().single();
  if (error) throw error;
  return data;
};

// ==========================================
// PEDIDOS (PRODUÇÃO) E IA
// ==========================================
export const getPedidos = async () => {
  const { data, error } = await supabase.from('pedidos').select('*').order('criado_em', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const createPedido = async (pedido: any) => {
  const currentUser = JSON.parse(localStorage.getItem('printia_user_profile') || '{}');
  const graficaId = currentUser?.grafica_id || '11111111-1111-1111-1111-111111111111';
  
  const { data, error } = await supabase.from('pedidos').insert([{ ...pedido, grafica_id: graficaId }]).select().single();
  if (error) throw error;
  return data;
};

export const updatePedidoStatus = async (id: string, status: string) => {
  const { data, error } = await supabase.from('pedidos').update({ status_producao: status }).eq('id', id).select().single();
  if (error) throw error;
  return data;
};

export const generateProductionAI = async (chatId: string, propostaId?: string) => {
  const res = await fetch(`${API_URL}/ai/gerar-ordem-servico`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, propostaId })
  });
  if (!res.ok) throw new Error('Erro ao gerar Ordem de Serviço com IA');
  return res.json();
};
