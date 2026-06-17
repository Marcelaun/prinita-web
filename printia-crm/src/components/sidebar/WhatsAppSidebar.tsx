import React, { useState } from 'react';
import { User, RefreshCw, Search } from 'lucide-react';
import { syncWhatsAppHistory } from '../../services/api';

interface Chat {
  id: string;
  remote_jid: string;
  push_name: string;
  number: string;
  last_message: string;
  last_message_time: string;
  unread_count: number;
  labels?: string[];
}

export const LABEL_COLORS: Record<string, string> = {
  'urgente': 'bg-red-500 text-white',
  'aguardando': 'bg-amber-400 text-amber-950',
  'orcamento': 'bg-blue-500 text-white',
  'finalizado': 'bg-emerald-500 text-white'
};

export const LABEL_NAMES: Record<string, string> = {
  'urgente': 'Urgente',
  'aguardando': 'Aguardando',
  'orcamento': 'Orçamento',
  'finalizado': 'Finalizado'
};

interface Props {
  chats: Chat[];
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
}

const WhatsAppSidebar: React.FC<Props> = ({ chats, activeChatId, onSelectChat }) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await syncWhatsAppHistory();
      // Optional: Could trigger a parent refresh here if needed, or wait for Supabase Realtime
    } catch (error) {
      console.error('Erro ao sincronizar:', error);
      alert('Erro ao sincronizar o histórico. Verifique se o backend está rodando e conectado à Evolution API.');
    } finally {
      setIsSyncing(false);
    }
  };

  const filteredChats = chats.filter(chat => {
    const searchLower = searchTerm.toLowerCase();
    const nameMatch = chat.push_name?.toLowerCase().includes(searchLower);
    const numberMatch = chat.number?.includes(searchLower);
    const matchesSearch = nameMatch || numberMatch;
    
    const matchesFilter = activeFilter ? (chat.labels || []).includes(activeFilter) : true;
    
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="h-full bg-white flex flex-col">
      <div className="p-4 border-b border-slate-100 bg-emerald-50/50 flex flex-col gap-3">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">WhatsApp</h2>
            <p className="text-xs text-emerald-600 font-bold uppercase tracking-widest">Conversas Ativas</p>
          </div>
          <button 
            onClick={handleSync}
            disabled={isSyncing}
            title="Sincronizar Histórico da Evolution API"
            className="p-2 text-emerald-600 hover:bg-emerald-100 rounded-full transition-colors disabled:opacity-50"
          >
            <RefreshCw size={18} className={isSyncing ? 'animate-spin' : ''} />
          </button>
        </div>
        
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text"
            placeholder="Buscar por nome ou número..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-shadow placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-2 px-2">
          <button
            onClick={() => setActiveFilter(null)}
            className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-bold transition-colors ${
              activeFilter === null ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Todos
          </button>
          {Object.entries(LABEL_NAMES).map(([key, name]) => (
            <button
              key={key}
              onClick={() => setActiveFilter(key === activeFilter ? null : key)}
              className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-bold transition-all ${
                activeFilter === key 
                  ? LABEL_COLORS[key] + ' shadow-sm scale-105'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {filteredChats.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 font-bold flex flex-col items-center gap-2">
            <span className="text-3xl">📭</span>
            {searchTerm ? 'Nenhuma conversa encontrada para sua busca.' : 'Nenhuma conversa encontrada.'}
            {!searchTerm && <span className="text-xs text-slate-400 font-normal">Mande uma mensagem para o número conectado para testar!</span>}
          </div>
        ) : (
          filteredChats.map(chat => (
            <button
              key={chat.id}
              onClick={() => onSelectChat(chat.id)}
              className={`w-full flex items-center gap-3 p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors text-left relative ${activeChatId === chat.id ? 'bg-emerald-50/50' : ''}`}
            >
              {activeChatId === chat.id && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-500 rounded-r" />}
              
              <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 shrink-0 border border-slate-300">
                <User size={24} />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-slate-800 text-sm truncate">
                  {chat.push_name || (chat.number ? `+${chat.number}` : 'Carregando...')}
                </span>
                  <span className="text-[10px] text-slate-400 font-bold">
                    {chat.last_message_time ? new Date(chat.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <p className={`text-xs truncate flex-1 ${chat.unread_count > 0 ? 'text-slate-800 font-bold' : 'text-slate-500'}`}>
                    {chat.last_message}
                  </p>
                  {chat.labels && chat.labels.length > 0 && (
                    <div className="flex gap-1 shrink-0 ml-2">
                      {chat.labels.map(lbl => (
                        <div 
                          key={lbl} 
                          title={LABEL_NAMES[lbl]}
                          className={`w-2 h-2 rounded-full ${LABEL_COLORS[lbl]?.split(' ')[0] || 'bg-slate-400'}`} 
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              {chat.unread_count > 0 && (
                <div className="bg-emerald-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shrink-0 shadow-sm">
                  {chat.unread_count}
                </div>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export default WhatsAppSidebar;