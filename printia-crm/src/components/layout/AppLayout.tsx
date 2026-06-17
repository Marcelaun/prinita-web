import React, { useState, useEffect, useCallback } from 'react';
import { 
  Printer, Bell, Settings, User, Loader2, LogOut, 
  PanelLeftClose, PanelLeft, PanelRightClose, PanelRight,
  MessageCircle, Menu, X, ChevronDown, ChevronRight, ShoppingBag, List, BarChart3, Bot
} from 'lucide-react';
import { LeadSidebar } from '../sidebar/LeadSidebar';
import WhatsAppSidebar from '../sidebar/WhatsAppSidebar';
import ChatArea from '../chat/ChatArea';
import WhatsAppChatArea from '../chat/WhatsAppChatArea';
import RightToolPanel from './RightToolPanel';
import ProfileSetup from '../auth/ProfileSetup';
import { supabase } from '../../lib/supabase';
import { getLeads, getWhatsAppChats } from '../../services/api';
import type { Lead, LeadStatus } from '../../types/index';
import AdminCatalogo from '../admin/AdminCatalogo';
import WhatsAppConfig from '../admin/WhatsAppConfig';
import ProductionBoard from '../production/ProductionBoard';
import useSound from 'use-sound';
import { toast } from 'sonner';

const NOTIFICATION_SOUND_URL = '/notification.mp3';

const AppLayout: React.FC = () => {
  const [playNotificationSound] = useSound(NOTIFICATION_SOUND_URL, { volume: 0.7 });

  const [leads, setLeads] = useState<Lead[]>([]);
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // --- ESTADOS DO WHATSAPP ---
  const [whatsAppChats, setWhatsAppChats] = useState<any[]>([]);
  const whatsAppChatsRef = React.useRef(whatsAppChats);
  useEffect(() => {
    whatsAppChatsRef.current = whatsAppChats;
  }, [whatsAppChats]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  
  // --- NAVEGAÇÃO GLOBAL (HAMBÚRGUER) ---
  const [activeView, setActiveView] = useState<'whatsapp' | 'leads' | 'whatsapp-config'>('whatsapp');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [expandedMenu, setExpandedMenu] = useState<'whatsapp' | 'leads'>('whatsapp'); // Para o accordion do menu

  // --- ESTADOS DOS PAINÉIS MODULARES E LARGURA (RESIZE) ---
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isCopilotOpen, setIsCopilotOpen] = useState(true);
  
  // Larguras em pixels
  const [sidebarWidth, setSidebarWidth] = useState(320); // w-80 equivale a 320px
  const [copilotWidth, setCopilotWidth] = useState(585); 
  
  // Estados de "Estou arrastando"
  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false);
  const [isDraggingCopilot, setIsDraggingCopilot] = useState(false);
  // -------------------------------------

  // Perfil do usuário logado
  const [userProfile, setUserProfile] = useState<{name: string, cpf: string, isAdmin?: boolean} | null>(null);

  useEffect(() => {
    const savedProfile = localStorage.getItem('printia_user_profile');
    if (savedProfile) setUserProfile(JSON.parse(savedProfile));
  }, []);

  const handleProfileComplete = (name: string, cpf: string, isAdmin?: boolean, role?: string) => {
    const profile = { name, cpf, isAdmin: !!isAdmin, role: role || (isAdmin ? 'admin' : 'vendedor') };
    setUserProfile(profile);
    localStorage.setItem('printia_user_profile', JSON.stringify(profile));
  };

  const handleLogout = () => {
    localStorage.removeItem('printia_user_profile');
    setUserProfile(null);
  };

  // --- LÓGICA DE ARRASTAR (DRAG & RESIZE) ---
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingSidebar) {
        const newWidth = e.clientX; 
        if (newWidth >= 250 && newWidth <= 600) setSidebarWidth(newWidth);
      } else if (isDraggingCopilot) {
        // Pega o tamanho total da tela e subtrai onde o mouse está
        const newWidth = document.body.clientWidth - e.clientX;
        if (newWidth >= 350 && newWidth <= 900) setCopilotWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingSidebar(false);
      setIsDraggingCopilot(false);
    };

    if (isDraggingSidebar || isDraggingCopilot) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none'; // Evita selecionar texto enquanto arrasta
    } else {
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };
  }, [isDraggingSidebar, isDraggingCopilot]);
  // ------------------------------------------

  const formatLead = useCallback((item: any): Lead => {
    const names = item.cliente_nome ? item.cliente_nome.split(' ') : (item.name ? item.name.split(' ') : ['N', 'N']);
    const initials = names.length > 1 
      ? (names[0][0] + names[names.length - 1][0]).toUpperCase()
      : names[0].substring(0, 2).toUpperCase();

    const enriched = item.enriched || {
      capital: item.capital_social ? `R$ ${Number(item.capital_social).toLocaleString('pt-BR')}` : "N/A",
      fundacao: item.data_inicio_atividade 
        ? (item.data_inicio_atividade.includes('-') ? item.data_inicio_atividade.split('-').reverse().join('/') : item.data_inicio_atividade)
        : "N/A"
    };

    return {
      id: item.id?.toString() || Math.random().toString(),
      name: item.cliente_nome || item.name || 'Sem Nome',
      initials: initials,
      empresa: item.cliente_empresa || item.empresa || 'Sem Empresa',
      cpf_cnpj: item.cliente_cpf_cnpj || item.cpf_cnpj || '',
      telefone: item.cliente_telefone || item.telefone || '',
      email: item.cliente_email || item.email || '',
      endereco: item.cliente_endereco || item.endereco || '',
      itens: typeof item.itens === 'string' ? JSON.parse(item.itens) : (item.itens || []),
      probabilidade: item.probabilidade_venda || item.probabilidade || 5,
      observacoes: item.observacoes || '',
      vendedor: item.vendedor_nome || item.vendedor || '',
      status: item.status || 'aguardando',
      atendido_por: item.atendido_por || null,
      enriched: enriched,
      historico_compras: [],
      history: []
    };
  }, []);

  // Busca de Leads
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await getLeads();
        if (data && data.length > 0) {
          const formatted = data.map(item => formatLead(item));
          setLeads(formatted);
          if (!activeLeadId) setActiveLeadId(formatted[0].id);
        }
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    if (userProfile) fetchData();
  }, [userProfile]);

  // Realtime de Leads (Orçamentos)
  useEffect(() => {
    if (!userProfile) return;
    const channel = supabase.channel('realtime_orcamentos').on(
        'postgres_changes', { event: '*', schema: 'public', table: 'orcamentos' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newLead = formatLead(payload.new);
            setLeads(prev => { if (prev.find(l => l.id === newLead.id)) return prev; return [newLead, ...prev]; });
          } else if (payload.eventType === 'UPDATE') {
            const updatedLead = formatLead(payload.new);
            setLeads(prev => prev.map(l => l.id === updatedLead.id ? updatedLead : l));
          } else if (payload.eventType === 'DELETE') {
            setLeads(prev => prev.filter(l => l.id !== payload.old.id));
          }
        }
      ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [formatLead, userProfile]);

  // Carregar e Escutar Chats do WhatsApp
  useEffect(() => {
    const fetchChats = async () => {
      try {
        const chats = await getWhatsAppChats();
        setWhatsAppChats(chats);
      } catch (err) { console.error(err); }
    };
    if (userProfile) fetchChats();

    if (!userProfile) return;
    
    // Atualiza a lista de chats
    const chatChannel = supabase.channel('realtime_whatsapp_chats').on(
      'postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_chats' },
      () => { fetchChats(); }
    ).subscribe();

    // Toca som quando uma NOVA MENSAGEM de cliente chega
    const msgChannel = supabase.channel('realtime_whatsapp_msgs_global').on(
      'postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_messages' },
      (payload) => {
        if (!payload.new.from_me) {
          playNotificationSound();
          
          const chat = whatsAppChatsRef.current.find(c => c.id === payload.new.chat_id);
          const remetente = chat?.push_name || chat?.number || 'Cliente';
          
          toast.success(`Mensagem de: ${remetente}`, {
            description: payload.new.content?.substring(0, 50) + (payload.new.content?.length > 50 ? '...' : '') || 'Uma nova mensagem chegou.',
            duration: 4000,
          });
        }
      }
    ).subscribe();

    return () => { 
      supabase.removeChannel(chatChannel); 
      supabase.removeChannel(msgChannel);
    };
  }, [userProfile]);


  const activeLead = leads.find(l => l.id === activeLeadId) || null;
  const activeChat = whatsAppChats.find(c => c.id === activeChatId) || null;

  const updateLeadStatus = async (id: string, status: LeadStatus) => {
    const previousLeads = [...leads];
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l));
    try { await supabase.from('orcamentos').update({ status }).eq('id', id); } 
    catch (error) { setLeads(previousLeads); }
  };

  const assumeLead = async (id: string) => {
    if (!userProfile) return;
    const previousLeads = [...leads];
    setLeads(prev => prev.map(l => l.id === id ? { ...l, atendido_por: userProfile.name } : l));
    try { await supabase.from('orcamentos').update({ atendido_por: userProfile.name }).eq('id', id); } 
    catch (error) { setLeads(previousLeads); }
  };

  if (!userProfile) return <ProfileSetup onComplete={handleProfileComplete} />;
  if (userProfile.role === 'producao') return <ProductionBoard />;
  if (userProfile.isAdmin) return <AdminCatalogo />;

  return (
    <div className="h-screen w-full flex flex-col bg-slate-50 overflow-hidden font-sans relative">
      
      {/* MENU HAMBÚRGUER (OVERLAY) */}
      {isMenuOpen && (
        <div className="absolute inset-0 z-50 flex">
          {/* Fundo escuro clicável para fechar */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsMenuOpen(false)} />
          
          {/* Painel do Menu */}
          <div className="relative w-72 bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-left-full duration-200">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-indigo-900 text-white">
              <div className="flex items-center gap-2">
                <Printer size={20} className="text-indigo-300" />
                <span className="font-black uppercase tracking-tight">PrintIA Módulos</span>
              </div>
              <button onClick={() => setIsMenuOpen(false)} className="p-2 hover:bg-indigo-800 rounded-full text-indigo-300 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-2 px-3">
              
              {/* ACORDEÃO WHATSAPP */}
              <div className="flex flex-col gap-1">
                <button 
                  onClick={() => { setActiveView('whatsapp'); setExpandedMenu('whatsapp'); }}
                  className={`flex items-center justify-between p-3 rounded-xl transition-all font-bold text-sm ${expandedMenu === 'whatsapp' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <div className="flex items-center gap-3">
                    <MessageCircle size={20} className={expandedMenu === 'whatsapp' ? 'text-emerald-500' : ''} />
                    Atendimento WhatsApp
                  </div>
                  {expandedMenu === 'whatsapp' ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                
                {/* SUB-OPÇÕES WHATSAPP */}
                {expandedMenu === 'whatsapp' && (
                  <div className="pl-4 pr-2 py-2 flex flex-col gap-1 border-l-2 border-emerald-100 ml-4 animate-in slide-in-from-top-2">
                    <button onClick={() => { setActiveView('whatsapp'); setIsMenuOpen(false); }} className="flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 p-2 rounded-lg w-full text-left transition-colors">
                      <MessageCircle size={14} /> Conversas Ativas
                    </button>
                    <button onClick={() => setIsMenuOpen(false)} className="flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 p-2 rounded-lg w-full text-left transition-colors">
                      <ShoppingBag size={14} /> Catálogo de Produtos
                    </button>
                    <button onClick={() => setIsMenuOpen(false)} className="flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 p-2 rounded-lg w-full text-left transition-colors">
                      <Bot size={14} /> Mensagens Automáticas
                    </button>
                    <div className="h-px bg-emerald-100 my-1"></div>
                    <button onClick={() => { setActiveView('whatsapp-config'); setIsMenuOpen(false); }} className="flex items-center gap-2 text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:bg-emerald-100 bg-emerald-50 p-2 rounded-lg w-full text-left transition-colors border border-emerald-200 shadow-sm">
                      <Settings size={14} /> Conectar Aparelho
                    </button>
                  </div>
                )}
              </div>
              
              <div className="h-px bg-slate-100 my-2"></div>

              {/* ACORDEÃO LEADS */}
              <div className="flex flex-col gap-1">
                <button 
                  onClick={() => { setActiveView('leads'); setExpandedMenu('leads'); }}
                  className={`flex items-center justify-between p-3 rounded-xl transition-all font-bold text-sm ${expandedMenu === 'leads' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <div className="flex items-center gap-3">
                    <User size={20} className={expandedMenu === 'leads' ? 'text-indigo-500' : ''} />
                    Leads do Aplicativo
                  </div>
                  {expandedMenu === 'leads' ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>

                {/* SUB-OPÇÕES LEADS */}
                {expandedMenu === 'leads' && (
                  <div className="pl-4 pr-2 py-2 flex flex-col gap-1 border-l-2 border-indigo-100 ml-4 animate-in slide-in-from-top-2">
                    <button onClick={() => setIsMenuOpen(false)} className="flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 p-2 rounded-lg w-full text-left transition-colors">
                      <List size={14} /> Caixa de Entrada (Orçamentos)
                    </button>
                    <button onClick={() => setIsMenuOpen(false)} className="flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 p-2 rounded-lg w-full text-left transition-colors">
                      <User size={14} /> Meus Atendimentos
                    </button>
                    <button onClick={() => setIsMenuOpen(false)} className="flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 p-2 rounded-lg w-full text-left transition-colors">
                      <BarChart3 size={14} /> Relatório de Conversão
                    </button>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* CONTEÚDO PRINCIPAL (Header + Main) */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        
        <header className="bg-indigo-900 text-white p-4 shadow-md z-20 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsMenuOpen(true)}
              className="p-2 hover:bg-indigo-800 rounded-lg transition-colors focus:ring-2 focus:ring-white/50"
            >
              <Menu size={24} />
            </button>

            <div className="flex items-center gap-3 border-l border-indigo-800 pl-4">
              <div>
                <h1 className="text-xl font-black tracking-tight flex items-center gap-1.5 uppercase">PrintIA <span className="bg-indigo-500 text-[10px] px-1.5 py-0.5 rounded font-bold tracking-normal normal-case">CRM</span></h1>
                <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest opacity-80">
                  {activeView === 'leads' ? 'Gestão de Leads' : 'Central WhatsApp'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4">
              <button className="relative p-2 hover:bg-indigo-800 rounded-full transition-colors"><Bell size={20} /><span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border border-indigo-900" /></button>
              <button className="p-2 hover:bg-indigo-800 rounded-full transition-colors"><Settings size={20} /></button>
              <div className="w-px h-6 bg-indigo-700 mx-2" />
              <div className="flex items-center gap-3 cursor-pointer group relative">
                <div className="text-right">
                  <p className="text-xs font-bold leading-none">{userProfile.name}</p>
                  <p className="text-[10px] text-indigo-300 leading-none mt-1 uppercase font-bold tracking-tighter">Atendente Ativo</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center border-2 border-indigo-400 group-hover:border-white transition-all overflow-hidden shadow-lg shadow-indigo-900/50"><User size={24} strokeWidth={1.5} /></div>
                <button onClick={handleLogout} className="absolute -bottom-10 right-0 bg-white text-rose-600 text-[9px] font-black px-3 py-2 rounded-lg shadow-xl uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity border border-rose-100 flex items-center gap-2"><LogOut size={12} /> Sair</button>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 flex overflow-hidden relative">
          {loading ? (
            <div className="flex-1 flex items-center justify-center bg-slate-50">
              <div className="flex flex-col items-center gap-4"><Loader2 size={48} className="text-indigo-600 animate-spin" /><p className="text-slate-500 font-bold uppercase tracking-widest text-xs animate-pulse">Carregando Dados...</p></div>
            </div>
          ) : (
            <>
              {/* WRAPPER DA SIDEBAR (ESQUERDA) */}
              <div 
                className="transition-all duration-300 ease-in-out flex-shrink-0 h-full overflow-hidden border-r border-slate-200"
                style={{ width: isSidebarOpen ? `${sidebarWidth}px` : '0px' }}
              >
                <div style={{ width: `${sidebarWidth}px`, height: '100%' }}>
                  {activeView === 'leads' ? (
                    <LeadSidebar leads={leads} activeLeadId={activeLeadId || ''} onSelectLead={setActiveLeadId} currentUserName={userProfile.name} />
                  ) : (
                    <WhatsAppSidebar chats={whatsAppChats} activeChatId={activeChatId} onSelectChat={setActiveChatId} />
                  )}
                </div>
              </div>

              {/* ÁREA CENTRAL (CHAT) */}
              <div className="flex-1 relative h-full bg-white shadow-2xl z-10 flex">
                
                {/* BARRA DE REDIMENSIONAR (ESQUERDA) */}
                {isSidebarOpen && (
                  <div 
                    onMouseDown={() => setIsDraggingSidebar(true)}
                    className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-indigo-500/50 z-50 transition-colors"
                  />
                )}

                {/* Botão Flutuante de Controle da Sidebar */}
                <button 
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className={`absolute top-1/2 -translate-y-1/2 z-50 bg-white border border-slate-200 text-indigo-600 p-2 shadow-lg hover:bg-indigo-50 transition-all cursor-pointer ${isSidebarOpen ? 'left-2 rounded-full opacity-50 hover:opacity-100' : 'left-0 rounded-r-xl border-l-0'}`}
                >
                  {isSidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
                </button>

                <div className="flex-1 overflow-hidden">
                  {activeView === 'whatsapp-config' ? (
                    <WhatsAppConfig />
                  ) : activeView === 'leads' ? (
                    <ChatArea lead={activeLead} onStatusChange={updateLeadStatus} onAssumeLead={() => activeLead && assumeLead(activeLead.id)} currentUserName={userProfile.name} />
                  ) : (
                    <WhatsAppChatArea activeChat={activeChat} currentUserName={userProfile.name} />
                  )}
                </div>

                {/* BARRA DE REDIMENSIONAR (DIREITA) */}
                {isCopilotOpen && (
                  <div 
                    onMouseDown={() => setIsDraggingCopilot(true)}
                    className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-indigo-500/50 z-50 transition-colors"
                  />
                )}

                {/* Botão Flutuante de Controle do Copilot */}
                <button 
                  onClick={() => setIsCopilotOpen(!isCopilotOpen)}
                  className={`absolute top-1/2 -translate-y-1/2 z-50 bg-white border border-slate-200 text-indigo-600 p-2 shadow-lg hover:bg-indigo-50 transition-all cursor-pointer ${isCopilotOpen ? 'right-2 rounded-full opacity-50 hover:opacity-100' : 'right-0 rounded-l-xl border-r-0'}`}
                >
                  {isCopilotOpen ? <PanelRightClose size={18} /> : <PanelRight size={18} />}
                </button>

              </div>

              {/* WRAPPER DO COPILOT (DIREITA) */}
              <div 
                className="transition-all duration-300 ease-in-out flex-shrink-0 h-full overflow-hidden border-l border-slate-200"
                style={{ width: isCopilotOpen ? `${copilotWidth}px` : '0px' }}
              >
                <div style={{ width: `${copilotWidth}px`, height: '100%' }}>
                  <RightToolPanel activeLead={activeLead} activeChat={activeChat} contextType={activeView} />
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default AppLayout;