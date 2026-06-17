import React, { useState } from 'react';
import type { Lead, LeadStatus } from '../../types/index';
import { Clock, Send, CheckCircle2, MessageSquare, LayoutDashboard, Settings, Inbox, Search } from 'lucide-react';

interface LeadSidebarProps {
  leads: Lead[];
  activeLeadId: string;
  onSelectLead: (id: string) => void;
  currentUserName: string;
}

const statusConfig: Record<LeadStatus, { color: string, label: string, icon: any, dot: string }> = {
  aguardando: { color: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Aguardando Orçamento', icon: Clock, dot: 'bg-amber-500' },
  enviado: { color: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Orçamento Enviado', icon: Send, dot: 'bg-blue-500' },
  aprovado: { color: 'bg-green-50 text-green-700 border-green-200', label: 'Aprovado e Pago', icon: CheckCircle2, dot: 'bg-green-500' },
};

export const LeadSidebar: React.FC<LeadSidebarProps> = ({ leads, activeLeadId, onSelectLead, currentUserName }) => {
  const [activeMenu, setActiveMenu] = useState<'my_leads' | 'available_leads' | 'dashboard' | 'config'>('my_leads');
  
  // ESTADOS DA PESQUISA E DO FILTRO
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'todos'>('todos');

  // =========================================================================
  // 🧠 LÓGICA DE FILTRAGEM
  // =========================================================================
  // 1. Separa quem é de quem
  let baseLeads = activeMenu === 'my_leads' 
    ? leads.filter(l => l.atendido_por === currentUserName)
    : leads.filter(l => !l.atendido_por);

  // 2. Aplica a Pesquisa de Texto (Nome ou Empresa)
  if (searchTerm.trim() !== '') {
    const lowerSearch = searchTerm.toLowerCase();
    baseLeads = baseLeads.filter(l => 
      l.name.toLowerCase().includes(lowerSearch) || 
      l.empresa.toLowerCase().includes(lowerSearch)
    );
  }

  // 3. Aplica o Filtro de Status (Apenas para os "Meus Leads")
  if (activeMenu === 'my_leads' && statusFilter !== 'todos') {
    baseLeads = baseLeads.filter(l => l.status === statusFilter);
  }

  const displayedLeads = baseLeads;
  const badgeText = activeMenu === 'my_leads' ? `${leads.filter(l => l.atendido_por === currentUserName).length} ATIVOS` : `${leads.filter(l => !l.atendido_por).length} ESPERANDO`;
  const listTitle = activeMenu === 'my_leads' ? 'Meus Atendimentos' : 'Leads na Fila';

  return (
    <div className="w-full h-full flex bg-white">
      
      {/* 1. BARRA DE NAVEGAÇÃO MASTER (Esquerda) */}
      <div className="w-16 h-full bg-slate-900 border-r border-slate-800 flex flex-col items-center py-6 gap-6 shrink-0 z-10 shadow-2xl">
        <button 
          onClick={() => { setActiveMenu('my_leads'); setSearchTerm(''); setStatusFilter('todos'); }}
          className={`p-3 rounded-2xl transition-all relative ${activeMenu === 'my_leads' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/50 scale-110' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
          title="Meus Atendimentos"
        >
          <MessageSquare size={22} />
          {leads.filter(l => l.atendido_por === currentUserName).length > 0 && (
             <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[9px] font-black w-4 h-4 flex items-center justify-center rounded-full border border-slate-900">
               {leads.filter(l => l.atendido_por === currentUserName).length}
             </span>
          )}
        </button>

        <button 
          onClick={() => { setActiveMenu('available_leads'); setSearchTerm(''); setStatusFilter('todos'); }}
          className={`p-3 rounded-2xl transition-all relative ${activeMenu === 'available_leads' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/50 scale-110' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
          title="Leads Disponíveis (Fila)"
        >
          <Inbox size={22} />
          {leads.filter(l => !l.atendido_por).length > 0 && (
             <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-black w-4 h-4 flex items-center justify-center rounded-full border border-slate-900 animate-pulse">
               {leads.filter(l => !l.atendido_por).length}
             </span>
          )}
        </button>
        
        <div className="w-8 h-px bg-slate-800 my-2"></div>

        <button 
          onClick={() => setActiveMenu('dashboard')}
          className={`p-3 rounded-2xl transition-all ${activeMenu === 'dashboard' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/50 scale-110' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
          title="Dashboard"
        >
          <LayoutDashboard size={22} />
        </button>

        <div className="flex-1"></div>
        
        <button 
          onClick={() => setActiveMenu('config')}
          className={`p-3 rounded-2xl transition-all ${activeMenu === 'config' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/50 scale-110' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
          title="Configurações"
        >
          <Settings size={22} />
        </button>
      </div>

      {/* 2. CONTEÚDO DA SIDEBAR */}
      <div className="flex-1 flex flex-col h-full border-r border-slate-200 bg-white overflow-hidden">
        
        {(activeMenu === 'my_leads' || activeMenu === 'available_leads') && (
          <>
            {/* Cabeçalho da Lista */}
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50 shrink-0">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">{listTitle}</h2>
              <span className={`px-2 py-0.5 rounded text-[9px] font-black tracking-widest shadow-sm ${activeMenu === 'my_leads' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                {badgeText}
              </span>
            </div>

            {/* ÁREA DE PESQUISA E FILTROS */}
            <div className="p-3 border-b border-slate-200 bg-white shrink-0 flex flex-col gap-3">
              {/* Barra de Pesquisa */}
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Buscar lead ou empresa..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg text-xs py-2 pl-8 pr-2 outline-none focus:border-indigo-400 transition-colors"
                />
              </div>

              {/* Botões de Filtro de Status (Apenas nos Meus Leads) */}
              {activeMenu === 'my_leads' && (
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                  <button 
                    onClick={() => setStatusFilter('todos')} 
                    className={`px-3 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition-colors ${statusFilter === 'todos' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                  >
                    Todos
                  </button>
                  <button 
                    onClick={() => setStatusFilter('aguardando')} 
                    className={`px-3 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition-colors ${statusFilter === 'aguardando' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                  >
                    Aguardando
                  </button>
                  <button 
                    onClick={() => setStatusFilter('enviado')} 
                    className={`px-3 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition-colors ${statusFilter === 'enviado' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                  >
                    Enviado
                  </button>
                  <button 
                    onClick={() => setStatusFilter('aprovado')} 
                    className={`px-3 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition-colors ${statusFilter === 'aprovado' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                  >
                    Aprovado
                  </button>
                </div>
              )}
            </div>
            
            {/* Lista de Leads */}
            <div className="flex-1 overflow-y-auto">
              {displayedLeads.length === 0 ? (
                <div className="p-8 text-center text-slate-400 flex flex-col items-center gap-3">
                  {searchTerm !== '' ? (
                    <>
                      <Search size={32} className="opacity-20" />
                      <p className="text-xs font-medium">Nenhum resultado para "{searchTerm}"</p>
                    </>
                  ) : (
                    <>
                      {activeMenu === 'my_leads' ? <MessageSquare size={32} className="opacity-20" /> : <Inbox size={32} className="opacity-20" />}
                      <p className="text-xs font-medium">Nenhum lead por aqui no momento.</p>
                    </>
                  )}
                </div>
              ) : (
                displayedLeads.map((lead) => {
                  const status = statusConfig[lead.status];
                  const isActive = lead.id === activeLeadId;
                  const lastMessage = lead.history[lead.history.length - 1];

                  return (
                    <div
                      key={lead.id} onClick={() => onSelectLead(lead.id)}
                      className={`p-4 border-b border-slate-100 cursor-pointer transition-all hover:bg-slate-50 relative overflow-hidden ${
                        isActive ? 'bg-indigo-50/60' : ''
                      }`}
                    >
                      {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600 rounded-r-md"></div>}
                      <div className="flex gap-3">
                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-xs shrink-0 shadow-sm border ${isActive ? 'bg-indigo-600 text-white border-indigo-700 shadow-indigo-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                          {lead.initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start mb-1">
                            <h3 className={`font-bold truncate text-sm ${isActive ? 'text-indigo-900' : 'text-slate-700'}`}>{lead.name}</h3>
                            <span className="text-[9px] font-bold text-slate-400 whitespace-nowrap bg-slate-100 px-1.5 rounded">{lastMessage?.timestamp || 'Novo'}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 font-medium truncate mb-2">{lead.empresa}</p>
                          
                          <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-wider ${status.color}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                            {status.label}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* DASHBOARD & CONFIGURAÇÕES (Mantidos) */}
        {activeMenu === 'dashboard' && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50">
            <LayoutDashboard size={40} className="text-slate-300 mb-4" />
            <h3 className="font-bold text-slate-700 text-sm">Dashboard de Vendas</h3>
            <p className="text-xs text-slate-500 mt-2">Gráficos de faturamento virão aqui.</p>
          </div>
        )}

        {activeMenu === 'config' && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50">
            <Settings size={40} className="text-slate-300 mb-4" />
            <h3 className="font-bold text-slate-700 text-sm">Configurações</h3>
            <p className="text-xs text-slate-500 mt-2">Ajustes de notificação.</p>
          </div>
        )}

      </div>
    </div>
  );
};