import React, { useState, useEffect } from 'react';
import { 
  Sparkles, Send, Bot, Zap, UserCircle, Loader2 
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { sendCopilotMessage } from '../../services/api';
import { supabase } from '../../lib/supabase'; // <-- Importamos o Supabase
import type { Lead } from '../../types/index';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  tab: 'cliente' | 'vendedor';
  isHistory?: boolean; // <-- Nova flag para saber se a mensagem veio do passado
}

interface AiCopilotPanelProps {
  activeLead?: Lead | null;
  activeChat?: any;
  contextType?: string;
}

// Utilitário para extrair texto puro dos elementos HTML gerados pelo Markdown
const extractText = (children: any): string => {
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return children.toString();
  if (Array.isArray(children)) return children.map(extractText).join('');
  if (children && children.props && children.props.children) {
    return extractText(children.props.children);
  }
  return '';
};

// --- COMPONENTE MÁGICO: EFEITO MÁQUINA DE ESCREVER + BOTÃO WHATSAPP ---
// Adicionamos o isHistory para não dar o efeito de digitar nas mensagens antigas
const TypewriterMarkdown = ({ content, leadPhone, isHistory }: { content: string, leadPhone: string, isHistory?: boolean }) => {
  const [displayedText, setDisplayedText] = useState(isHistory ? content : '');

  useEffect(() => {
    if (isHistory) {
      setDisplayedText(content);
      return;
    }

    let index = 0;
    const speed = 10;
    
    const interval = setInterval(() => {
      setDisplayedText(content.substring(0, index));
      index++;
      if (index > content.length) clearInterval(interval);
    }, speed);

    return () => clearInterval(interval);
  }, [content, isHistory]);

  return (
    <ReactMarkdown
      components={{
        h3: ({node, ...props}) => <h3 className="text-sm font-black text-indigo-900 mt-5 mb-2 uppercase tracking-widest border-b border-indigo-100 pb-1" {...props} />,
        strong: ({node, ...props}) => <strong className="font-black text-indigo-700 bg-indigo-50 px-1 rounded" {...props} />,
        p: ({node, ...props}) => <p className="mb-4 text-[13px] text-slate-700 leading-relaxed" {...props} />,
        ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-4 space-y-2 text-[13px] text-slate-700" {...props} />,
        li: ({node, ...props}) => <li className="pl-1" {...props} />,
        
        // AQUI ESTÁ A MÁGICA: Hackeando o Blockquote para virar o card do WhatsApp
        blockquote: ({node, children, ...props}) => {
          const rawText = extractText(children);
          
          const handleSendWa = () => {
            const phone = leadPhone ? leadPhone.replace(/\D/g, '') : '';
            const numeroFinal = phone.startsWith('55') ? phone : `55${phone}`;
            const url = `https://wa.me/${numeroFinal}?text=${encodeURIComponent(rawText.trim())}`;
            window.open(url, '_blank');
          };

          return (
            <div className="relative group my-4">
              <blockquote className="border-l-4 border-emerald-400 bg-emerald-50 text-emerald-900 p-4 rounded-r-xl italic font-medium shadow-inner pr-14" {...props}>
                {children}
              </blockquote>
              <button 
                onClick={handleSendWa}
                title="Enviar direto para o WhatsApp"
                className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-md scale-90 group-hover:scale-100 z-10 cursor-pointer"
              >
                <Send size={15} className="ml-0.5" />
              </button>
            </div>
          );
        }
      }}
    >
      {displayedText}
    </ReactMarkdown>
  );
};
// ----------------------------------------------------------------

const AiCopilotPanel: React.FC<AiCopilotPanelProps> = ({ activeLead, activeChat, contextType }) => {
  const [chatInput, setChatInput] = useState('');
  const [activeTab, setActiveTab] = useState<'cliente' | 'vendedor'>('cliente');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const isWhatsapp = contextType === 'whatsapp';
  const targetEntity = isWhatsapp ? activeChat : activeLead;
  const entityId = isWhatsapp ? targetEntity?.id : targetEntity?.id;
  const entityName = isWhatsapp ? (targetEntity?.pushName || targetEntity?.remoteJid?.split('@')[0]) : targetEntity?.empresa;
  const entityPhone = isWhatsapp ? targetEntity?.remoteJid : targetEntity?.telefone;

  const userProfile = JSON.parse(localStorage.getItem('printia_user_profile') || '{}');

  useEffect(() => {
    const fetchHistory = async () => {
      if (!entityId || !userProfile.cpf) {
        setMessages([]);
        return;
      }

      setIsLoadingHistory(true);
      try {
        const { data, error } = await supabase
          .from('copilot_historico')
          .select('role, content, tab')
          .eq('orcamento_id', entityId) // Usamos o mesmo campo para o ID do chat ou lead
          .eq('vendedor_cpf', userProfile.cpf)
          .order('criado_em', { ascending: true });

        if (error) throw error;

        if (data && data.length > 0) {
          const formattedHistory: Message[] = data.map(msg => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
            tab: msg.tab as 'cliente' | 'vendedor',
            isHistory: true
          }));
          setMessages(formattedHistory);
        } else {
          setMessages([]);
        }
      } catch (err) {
        console.error("Erro ao puxar histórico da IA:", err);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    fetchHistory();
  }, [entityId, userProfile.cpf]);

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !targetEntity || isLoading) return;

    const userMessage: Message = { role: 'user', content: chatInput, tab: activeTab };
    setMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsLoading(true);

    try {
      const mockLead = isWhatsapp ? { id: targetEntity.id, empresa: entityName, telefone: entityPhone } : targetEntity;
      const reply = await sendCopilotMessage(mockLead as any, chatInput, activeTab, userProfile, contextType);
      const assistantMessage: Message = { role: 'assistant', content: reply, tab: activeTab };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Erro ao chamar o Copilot:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Desculpe, ocorreu um erro de conexão com o cérebro da PrintIA.',
        tab: activeTab
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const currentMessages = messages.filter(m => m.tab === activeTab);

  if (!targetEntity) {
    return (
      <aside className="w-80 bg-slate-50 border-l border-slate-200 flex flex-col h-full items-center justify-center p-8 text-center text-slate-400 font-sans shrink-0">
        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
          <Bot size={32} strokeWidth={1.5} className="opacity-20" />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-widest leading-relaxed">
          Selecione {isWhatsapp ? 'uma conversa' : 'um lead'} para<br/>ativar o Copilot
        </p>
      </aside>
    );
  }

  return (
    <aside className="w-full bg-white border-l border-slate-200 flex flex-col h-full overflow-hidden shrink-0 font-sans shadow-sm">
      
      {/* HEADER IA */}
      <div className="px-6 py-4 border-b border-slate-100 bg-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-100">
            <Sparkles size={16} className="text-white" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-slate-800 tracking-tight">PrintIA Copilot</h2>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                Online • {userProfile.name?.split(' ')[0]}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* SELETOR DE ABAS */}
      <div className="p-2 bg-slate-50 border-b border-slate-100 flex gap-1 shrink-0">
        <button 
          onClick={() => setActiveTab('cliente')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
            activeTab === 'cliente' 
              ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' 
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Zap size={12} className={activeTab === 'cliente' ? 'fill-indigo-600' : ''} />
          Análise Cliente
        </button>
        <button 
          onClick={() => setActiveTab('vendedor')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
            activeTab === 'vendedor' 
              ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' 
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <UserCircle size={12} />
          Chat Vendedor
        </button>
      </div>

      {/* ÁREA DE CONTEÚDO DINÂMICA */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30 scroll-smooth">
        
        {isLoadingHistory ? (
          <div className="flex items-center justify-center h-full flex-col gap-3 text-slate-400 animate-pulse">
            <Loader2 className="animate-spin" size={24} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Sincronizando Memória...</span>
          </div>
        ) : (
          <>
            {currentMessages.length === 0 && (
              <div className="flex gap-3 animate-in fade-in duration-500">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${
                  activeTab === 'cliente' ? 'bg-amber-50 border-amber-100' : 'bg-indigo-50 border-indigo-100'
                }`}>
                  {activeTab === 'cliente' ? <Zap size={16} className="text-amber-600 fill-amber-600" /> : <Bot size={16} className="text-indigo-600" />}
                </div>
                <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-none p-4 shadow-sm">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {activeTab === 'cliente' 
                      ? (isWhatsapp 
                          ? `Cole abaixo o que ${entityName || 'o cliente'} te respondeu no WhatsApp. Vou analisar a intenção e sugerir respostas rápidas e empáticas.` 
                          : `Cole abaixo o que a ${entityName} te respondeu. Vou analisar a intenção e gerar 3 opções estratégicas de resposta.`)
                      : (isWhatsapp 
                          ? `Olá! Sou o seu parceiro de WhatsApp. Me peça para resumir a conversa ou sugerir um fechamento com ${entityName || 'este contato'}.` 
                          : `Olá! Sou o seu parceiro estratégico. Vamos destrinchar os dados da ${entityName} para garantir esse fechamento?`)}
                  </p>
                </div>
              </div>
            )}

            {currentMessages.map((msg, index) => (
              <div key={index} className={`flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${
                  msg.role === 'user' 
                    ? 'bg-slate-100 border-slate-200' 
                    : (activeTab === 'cliente' ? 'bg-amber-50 border-amber-100' : 'bg-indigo-50 border-indigo-100')
                }`}>
                  {msg.role === 'user' ? <UserCircle size={16} className="text-slate-500" /> : (activeTab === 'cliente' ? <Zap size={16} className="text-amber-600 fill-amber-600" /> : <Bot size={16} className="text-indigo-600" />)}
                </div>
                
                <div className={`max-w-[85%] border p-5 shadow-sm rounded-3xl ${
                  msg.role === 'user' 
                    ? 'bg-indigo-600 border-indigo-700 text-white rounded-tr-none' 
                    : 'bg-white border-slate-100 text-slate-800 rounded-tl-none shadow-xl shadow-indigo-900/5'
                }`}>
                  {msg.role === 'user' ? (
                    <p className="text-xs leading-relaxed whitespace-pre-wrap font-medium">{msg.content}</p>
                  ) : (
                    <TypewriterMarkdown content={msg.content} leadPhone={entityPhone || ''} isHistory={msg.isHistory} />
                  )}
                </div>
              </div>
            ))}
          </>
        )}

        {isLoading && (
          <div className="flex gap-3 animate-pulse">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200">
              <Loader2 size={16} className="text-indigo-600 animate-spin" />
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-none p-5 shadow-sm flex items-center h-12">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 bg-indigo-300 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-indigo-300 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-2 h-2 bg-indigo-300 rounded-full animate-bounce [animation-delay:0.4s]"></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* FOOTER: INPUT DE CHAT */}
      <div className="p-4 bg-white border-t border-slate-100 shrink-0">
        <div className="relative">
          <textarea 
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={activeTab === 'cliente' ? "Cole a resposta do cliente aqui..." : "Ex: Gere um briefing da empresa..."}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-5 pr-14 py-4 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none h-24 placeholder:text-slate-400 shadow-inner"
            disabled={isLoading}
          ></textarea>
          <button 
            onClick={handleSendMessage}
            className={`absolute right-3 bottom-3 w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
              chatInput.trim() && !isLoading
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-300 hover:scale-105 active:scale-95' 
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
            disabled={!chatInput.trim() || isLoading}
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} className="ml-1" />}
          </button>
        </div>
      </div>
    </aside>
  );
};

export default AiCopilotPanel;