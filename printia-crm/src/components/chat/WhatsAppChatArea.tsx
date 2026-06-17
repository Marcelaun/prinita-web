import React, { useState, useEffect, useRef } from 'react';
import { Send, User, Check, CheckCheck, FileText, Download, Tag } from 'lucide-react';
import { getWhatsAppMessages, sendWhatsAppMessage, markChatAsRead, updateChatLabels } from '../../services/api';
import { supabase } from '../../lib/supabase';
import { LABEL_COLORS, LABEL_NAMES } from '../sidebar/WhatsAppSidebar';

interface Chat {
  id: string;
  remote_jid: string;
  push_name: string;
  number: string;
  labels?: string[];
}

interface Message {
  id: string;
  content: string;
  from_me: boolean;
  created_at: string;
  status?: 'pending' | 'sent' | 'delivered' | 'read';
  media_url?: string;
  media_type?: string;
  media_mimetype?: string;
}

interface Props {
  activeChat: Chat | null;
  currentUserName?: string;
}

const WhatsAppChatArea: React.FC<Props> = ({ activeChat, currentUserName }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [chatLabels, setChatLabels] = useState<string[]>([]);
  const [showLabelMenu, setShowLabelMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    // RESET TOTAL DO ESTADO AO TROCAR DE CHAT
    setMessages([]);
    setLoading(true);
    setInputText('');
    setIsTyping(false);
    setChatLabels([]);
    setShowLabelMenu(false);

    if (!activeChat?.id) {
      setLoading(false);
      return;
    }

    let isCurrentEffect = true; // Trava para evitar que dados de um chat antigo 'vazem' para o novo

    const fetchMessages = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL;
        // Chamada de load-history que agora é mais robusta no backend
        const loadResponse = await fetch(`${apiUrl}/whatsapp/chats/${activeChat.id}/load-history`, {
          method: 'POST'
        });
        
        const { data: chatData } = await supabase.from('whatsapp_chats').select('labels').eq('id', activeChat.id).single();
        if (isCurrentEffect && chatData?.labels) {
          setChatLabels(chatData.labels);
        }
        if (!isCurrentEffect) return;

        if (loadResponse.ok) {
          const loadData = await loadResponse.json();
          if (isCurrentEffect) setMessages(loadData.messages || []);
        } else {
          const data = await getWhatsAppMessages(activeChat.id);
          if (isCurrentEffect) setMessages(data);
        }
      } catch (error) {
        if (isCurrentEffect) {
          console.error('Erro ao carregar mensagens:', error);
          const data = await getWhatsAppMessages(activeChat.id);
          if (isCurrentEffect) setMessages(data);
        }
      } finally {
        if (isCurrentEffect) {
          setLoading(false);
          setTimeout(scrollToBottom, 150);
          await markChatAsRead(activeChat.id);
        }
      }
    };

    fetchMessages();

    // Inscrição Realtime no Supabase - MENSAGENS (INSERÇÃO E ATUALIZAÇÃO)
    const msgChannel = supabase.channel(`chat_realtime_msgs_${activeChat.id}_${Date.now()}`)
      .on('postgres_changes', { 
        event: '*', // Escuta INSERT e UPDATE
        schema: 'public', 
        table: 'whatsapp_messages',
        filter: `chat_id=eq.${activeChat.id}`
      }, (payload) => {
        if (!isCurrentEffect || payload.new.chat_id !== activeChat.id) return;
        
        if (payload.eventType === 'INSERT') {
          setMessages(prev => {
            if (prev.find(m => m.id === payload.new.id)) return prev;
            return [...prev, payload.new as Message];
          });
          setTimeout(scrollToBottom, 50);
        } else if (payload.eventType === 'UPDATE') {
          setMessages(prev => prev.map(m => 
            m.id === payload.new.id ? { ...m, status: payload.new.status } : m
          ));
        }
      }).subscribe();

    // Inscrição Realtime no Supabase - STATUS DE DIGITANDO (TABELA CHATS)
    const chatChannel = supabase.channel(`chat_status_${activeChat.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'whatsapp_chats',
        filter: `id=eq.${activeChat.id}`
      }, (payload) => {
        if (!isCurrentEffect) return;
        if (payload.new.is_typing !== undefined) {
          setIsTyping(payload.new.is_typing);
        }
      }).subscribe();

    return () => {
      isCurrentEffect = false;
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(chatChannel);
    };
  }, [activeChat?.id]); // Re-executa sempre que o ID mudar

  const handleSend = async () => {
    if (!inputText.trim() || !activeChat) return;
    
    // Se tiver nome do usuário, adiciona no começo da mensagem
    const text = currentUserName 
      ? `*${currentUserName}:*\n${inputText.trim()}` 
      : inputText.trim();
      
    setInputText(''); 
    
    try {
      const result = await sendWhatsAppMessage(activeChat.remote_jid, text);
      console.log("Mensagem enviada com sucesso, atualizando UI localmente...");
      
      const newMessage: Message = {
        id: result.data?.key?.id || `temp_${Date.now()}`,
        content: text,
        from_me: true,
        created_at: new Date().toISOString()
      };
      
      setMessages(prev => {
        // Evita duplicidade se o realtime for MUITO rápido
        if (prev.find(m => m.id === newMessage.id)) return prev;
        return [...prev, newMessage];
      });
      
      // Scroll forçado
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
      
    } catch (error) {
      console.error("Erro ao enviar mensagem", error);
      alert("Erro ao enviar mensagem.");
      setInputText(text); // Devolve o texto se der erro
    }
  };

  const toggleLabel = async (label: string) => {
    if (!activeChat?.id) return;
    const newLabels = chatLabels.includes(label) 
      ? chatLabels.filter(l => l !== label)
      : [...chatLabels, label];
    
    setChatLabels(newLabels);
    try {
      await updateChatLabels(activeChat.id, newLabels);
    } catch (error) {
      console.error('Erro ao atualizar etiqueta:', error);
      // Reverter em caso de erro
      setChatLabels(chatLabels);
    }
  };

  if (!activeChat) {
    return (
      <div className="h-full flex flex-col bg-[#efeae2] items-center justify-center relative">
        <div className="absolute inset-0 opacity-10 bg-[url('https://i.pinimg.com/originals/8c/98/99/8c98994518b575bfd8c949e91d20548b.jpg')] bg-repeat" />
        <div className="bg-white/80 backdrop-blur-sm text-slate-600 px-6 py-3 rounded-full text-xs font-bold uppercase tracking-widest shadow-sm z-10">
          Selecione uma conversa para começar
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#efeae2] relative">
      {/* Background WhatsApp Pattern */}
      <div className="absolute inset-0 opacity-5 bg-[url('https://i.pinimg.com/originals/8c/98/99/8c98994518b575bfd8c949e91d20548b.jpg')] bg-repeat pointer-events-none" />

      {/* Header */}
      <div className="p-3 bg-white border-b border-slate-200 shadow-sm flex items-center gap-3 z-10 relative">
        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
          <User size={20} />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-bold text-slate-800 leading-tight">
            {activeChat.push_name || (activeChat.number ? `+${activeChat.number}` : 'Contato')}
          </h2>
          {isTyping ? (
            <p className="text-[11px] text-emerald-600 font-bold animate-pulse">Digitando...</p>
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-[11px] text-slate-500 font-medium">+{activeChat.number}</p>
              {chatLabels.map(lbl => (
                <span key={lbl} className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${LABEL_COLORS[lbl] || 'bg-slate-200 text-slate-700'}`}>
                  {LABEL_NAMES[lbl]}
                </span>
              ))}
            </div>
          )}
        </div>
        
        {/* Etiqueta Menu */}
        <div className="relative">
          <button 
            onClick={() => setShowLabelMenu(!showLabelMenu)}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors border border-transparent hover:border-emerald-100"
            title="Etiquetas"
          >
            Adicionar Tags
            <Tag size={16} />
          </button>
          
          {showLabelMenu && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="px-3 pb-2 mb-2 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-400 uppercase">Adicionar Etiqueta</span>
              </div>
              {Object.entries(LABEL_NAMES).map(([key, name]) => {
                const isActive = chatLabels.includes(key);
                return (
                  <button
                    key={key}
                    onClick={() => {
                      toggleLabel(key);
                      setShowLabelMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center justify-between transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${LABEL_COLORS[key].split(' ')[0]}`} />
                      <span className={isActive ? 'font-bold text-slate-800' : 'text-slate-600'}>{name}</span>
                    </span>
                    {isActive && <Check size={14} className="text-emerald-500" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
      
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 z-10">
        {loading && messages.length === 0 ? (
          <div className="text-center text-slate-400 text-xs mt-4">Carregando mensagens...</div>
        ) : (
          messages.map((msg, index) => {
            const showTail = index === 0 || messages[index - 1].from_me !== msg.from_me;
            return (
              <div key={msg.id} className={`flex ${msg.from_me ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] relative px-3 py-2 shadow-sm ${
                  msg.from_me 
                    ? `bg-[#d9fdd3] text-slate-800 ${showTail ? 'rounded-l-xl rounded-b-xl rounded-tr-sm' : 'rounded-xl'}` 
                    : `bg-white text-slate-800 ${showTail ? 'rounded-r-xl rounded-b-xl rounded-tl-sm' : 'rounded-xl'}`
                }`}>
                  {msg.media_url && msg.media_type === 'imageMessage' && (
                    <a href={msg.media_url} target="_blank" rel="noreferrer" className="block relative group cursor-pointer mb-2">
                      <img src={msg.media_url} alt="Imagem" className="w-full max-w-[300px] rounded-lg object-cover border border-black/5" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                        <Download size={24} className="text-white" />
                      </div>
                    </a>
                  )}
                  {msg.media_url && msg.media_type === 'videoMessage' && (
                    <video src={msg.media_url} controls className="w-full max-w-[300px] rounded-lg mb-2 border border-black/5" />
                  )}
                  {msg.media_url && msg.media_type === 'audioMessage' && (
                    <audio src={msg.media_url} controls className="w-full max-w-[250px] mb-2" />
                  )}
                  {msg.media_url && msg.media_type === 'documentMessage' && (
                    <a href={msg.media_url} target="_blank" rel="noreferrer" className="flex items-center gap-3 bg-black/5 p-3 rounded-lg mb-2 hover:bg-black/10 transition-colors border border-black/5">
                      {msg.media_mimetype?.includes('pdf') ? (
                        <FileText size={24} className="text-rose-500 shrink-0" />
                      ) : msg.media_mimetype?.includes('word') ? (
                        <FileText size={24} className="text-blue-500 shrink-0" />
                      ) : msg.media_mimetype?.includes('spreadsheet') || msg.media_mimetype?.includes('excel') || msg.media_mimetype?.includes('csv') ? (
                        <FileText size={24} className="text-emerald-500 shrink-0" />
                      ) : msg.media_mimetype?.includes('presentation') || msg.media_mimetype?.includes('powerpoint') ? (
                        <FileText size={24} className="text-orange-500 shrink-0" />
                      ) : (
                        <FileText size={24} className="text-slate-500 shrink-0" />
                      )}
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-sm font-semibold text-slate-700 truncate">
                          {msg.media_mimetype?.includes('pdf') ? 'Arquivo PDF' : 
                           msg.media_mimetype?.includes('word') ? 'Documento Word' : 
                           msg.media_mimetype?.includes('spreadsheet') || msg.media_mimetype?.includes('excel') ? 'Planilha' : 
                           'Documento'}
                        </span>
                        <span className="text-[10px] text-slate-500 uppercase">{msg.media_mimetype?.split('/')[1]?.split('.')[0] || 'ARQUIVO'}</span>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm">
                        <Download size={14} className="text-slate-600" />
                      </div>
                    </a>
                  )}
                  {msg.media_url && msg.media_type === 'stickerMessage' && (
                    <img src={msg.media_url} alt="Sticker" className="w-32 h-32 object-contain mb-2" />
                  )}
                  <p className="text-[14px] whitespace-pre-wrap leading-relaxed">
                    {msg.content.split(/(\*[^*]+\*)/g).map((part, i) => {
                      if (part.startsWith('*') && part.endsWith('*')) {
                        return <strong key={i} className="font-bold">{part.slice(1, -1)}</strong>;
                      }
                      return <React.Fragment key={i}>{part}</React.Fragment>;
                    })}
                  </p>
                  <div className="text-[10px] text-slate-400 mt-0.5 text-right w-full flex justify-end items-center gap-1">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {msg.from_me && (
                      <span className="flex items-center">
                        {msg.status === 'read' ? (
                          <CheckCheck size={14} className="text-sky-500" />
                        ) : msg.status === 'delivered' ? (
                          <CheckCheck size={14} className="text-slate-400" />
                        ) : (
                          <Check size={14} className="text-slate-400" />
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input Area */}
      <div className="p-3 bg-[#f0f2f5] flex gap-2 items-center z-10">
        <input 
          type="text" 
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Digite uma mensagem..." 
          className="flex-1 rounded-xl border-none px-4 py-3 focus:ring-0 shadow-sm outline-none text-sm text-slate-700 bg-white"
        />
        <button 
          onClick={handleSend}
          disabled={!inputText.trim()}
          className={`w-12 h-12 flex items-center justify-center rounded-full transition-all shadow-sm ${
            inputText.trim() ? 'bg-emerald-500 hover:bg-emerald-600 text-white cursor-pointer' : 'bg-slate-300 text-slate-500 cursor-not-allowed'
          }`}
        >
          <Send size={20} className={`${inputText.trim() ? 'ml-1' : ''}`} />
        </button>
      </div>
    </div>
  );
};

export default WhatsAppChatArea;