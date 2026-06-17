import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { LogOut, Loader2, Factory, Calendar, Clock, FileText, CheckCircle2, ChevronRight, Paperclip } from 'lucide-react';
import { toast } from 'sonner';
import { getPedidos, updatePedidoStatus, getWhatsAppMessages } from '../../services/api';
import { MessageSquare } from 'lucide-react';

const STATUSES = ['Na Fila', 'Produzindo', 'Pronto', 'Entregue'];

export default function ProductionBoard() {
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePedido, setActivePedido] = useState<any | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);

  const fetchPedidos = async () => {
    try {
      const data = await getPedidos();
      setPedidos(data);
    } catch (err) {
      toast.error('Erro ao buscar pedidos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPedidos();

    // Inscrição em tempo real para novos pedidos da equipe de vendas
    const channel = supabase.channel('realtime_pedidos').on(
      'postgres_changes', { event: '*', schema: 'public', table: 'pedidos' },
      () => { fetchPedidos(); }
    ).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('pedido_id', id);
  };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('pedido_id');
    if (!id) return;
    
    // Otimista
    setPedidos(prev => prev.map(p => p.id === id ? { ...p, status_producao: newStatus } : p));
    
    try {
      await updatePedidoStatus(id, newStatus);
      toast.success(`Movido para ${newStatus}`);
    } catch (err) {
      fetchPedidos(); // reverte em caso de erro
      toast.error('Erro ao atualizar status');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleLogout = () => {
    localStorage.removeItem('printia_user_profile');
    window.location.reload();
  };

  const handleOpenChat = async () => {
    if (!activePedido?.chat_id) {
      toast.error('Nenhum chat associado a este pedido.');
      return;
    }
    setShowChat(!showChat);
    if (!showChat && chatMessages.length === 0) {
      setLoadingChat(true);
      try {
        const msgs = await getWhatsAppMessages(activePedido.chat_id);
        setChatMessages(msgs.reverse());
      } catch (err) {
        toast.error('Erro ao carregar conversa');
      } finally {
        setLoadingChat(false);
      }
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-900 flex justify-center items-center"><Loader2 size={40} className="animate-spin text-indigo-500" /></div>;

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col font-sans text-slate-200">
      <header className="bg-slate-950 border-b border-slate-800 p-4 flex justify-between items-center z-20">
        <div className="flex items-center gap-3 ml-4">
          <div className="bg-orange-500/20 p-2 rounded-lg"><Factory size={24} className="text-orange-400" /></div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white uppercase">PrintIA <span className="font-light text-slate-400">Fábrica</span></h1>
            <p className="text-[10px] text-orange-400 font-bold uppercase tracking-widest">Painel de Produção</p>
          </div>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-2 bg-slate-900 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 border border-slate-800 px-4 py-2 rounded-lg font-bold text-xs transition-colors mr-4">
          <LogOut size={14} /> Sair
        </button>
      </header>

      <main className="flex-1 flex overflow-hidden p-6 gap-6">
        {STATUSES.map(status => (
          <div 
            key={status} 
            className="flex-1 bg-slate-800/50 rounded-2xl border border-slate-700/50 flex flex-col overflow-hidden"
            onDrop={(e) => handleDrop(e, status)}
            onDragOver={handleDragOver}
          >
            <div className="p-4 border-b border-slate-700 bg-slate-800/80 flex justify-between items-center">
              <h2 className="font-black text-sm text-slate-300 uppercase tracking-widest">{status}</h2>
              <span className="bg-slate-900 text-slate-400 text-xs px-2 py-1 rounded-md font-bold">
                {pedidos.filter(p => p.status_producao === status).length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {pedidos.filter(p => p.status_producao === status).map(pedido => (
                <div 
                  key={pedido.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, pedido.id)}
                  onClick={() => setActivePedido(pedido)}
                  className="bg-slate-700 hover:bg-slate-600 border border-slate-600 hover:border-indigo-500 p-4 rounded-xl cursor-pointer shadow-sm transition-all group"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider bg-orange-400/10 px-2 py-0.5 rounded">
                      {pedido.titulo}
                    </span>
                    {pedido.prazo_entrega && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-rose-400 uppercase">
                        <Clock size={10} /> {pedido.prazo_entrega}
                      </span>
                    )}
                  </div>
                  <p className="font-bold text-white text-sm mb-1">{pedido.cliente_nome}</p>
                  <p className="text-xs text-slate-400 line-clamp-2">{pedido.resumo_ia?.split('\\n')[0].replace(/#/g, '')}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </main>

      {/* MODAL DETALHES DA ORDEM DE SERVIÇO */}
      {activePedido && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-6" onClick={() => setActivePedido(null)}>
          <div className="bg-slate-800 rounded-2xl w-full max-w-3xl max-h-full overflow-hidden flex flex-col shadow-2xl border border-slate-700" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-900">
              <div>
                <h2 className="text-2xl font-black text-white">{activePedido.titulo}</h2>
                <p className="text-sm font-bold text-slate-400">Cliente: <span className="text-indigo-400">{activePedido.cliente_nome}</span> • WhatsApp: {activePedido.cliente_numero}</p>
              </div>
              <button onClick={() => { setActivePedido(null); setShowChat(false); setChatMessages([]); }} className="text-slate-400 hover:text-white p-2 bg-slate-800 rounded-xl">FECHAR</button>
            </div>
            <div className="p-8 overflow-y-auto prose prose-invert prose-indigo max-w-none flex-1">
              <div className="mb-6 p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-1">Prazo de Entrega Acordado</p>
                  <p className="text-lg font-black text-orange-400 flex items-center gap-2"><Calendar size={20}/> {activePedido.prazo_entrega || 'Não especificado'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 text-right">Status Atual</p>
                  <p className="text-lg font-black text-white">{activePedido.status_producao}</p>
                </div>
              </div>

              <div className="flex gap-4 mb-6">
                <button 
                  onClick={handleOpenChat}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors"
                >
                  <MessageSquare size={16} />
                  {showChat ? 'Ocultar Conversa' : 'Ver Arquivos e Conversa Original'}
                </button>
              </div>

              {showChat && (
                <div className="mb-6 border border-slate-700 bg-slate-950 rounded-xl flex flex-col h-[400px]">
                  <div className="p-3 border-b border-slate-800 bg-slate-900 rounded-t-xl">
                    <p className="text-xs font-bold text-slate-400 uppercase">Visualização Somente Leitura - WhatsApp</p>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                    {loadingChat ? (
                      <div className="flex-1 flex justify-center items-center"><Loader2 className="animate-spin text-indigo-500" /></div>
                    ) : chatMessages.length === 0 ? (
                      <div className="text-center text-slate-500 text-sm mt-4">Nenhuma mensagem encontrada.</div>
                    ) : (
                      chatMessages.map((m, i) => (
                        <div key={i} className={`flex ${m.from_me ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${m.from_me ? 'bg-slate-800 text-slate-300 rounded-tr-none' : 'bg-slate-700 text-white rounded-tl-none'}`}>
                            {m.type === 'image' ? (
                              <div className="flex flex-col gap-2">
                                {m.media_url ? (
                                  <a href={m.media_url} target="_blank" rel="noreferrer">
                                    <img src={m.media_url} alt="Imagem recebida" className="max-w-[200px] rounded-lg border border-slate-700 hover:opacity-80 transition-opacity cursor-pointer" />
                                  </a>
                                ) : (
                                  <div className="flex flex-col items-center gap-2 p-2">
                                    <Paperclip size={20} className="text-indigo-400" />
                                    <span className="text-xs font-bold text-indigo-300">[IMAGEM] Sem URL</span>
                                  </div>
                                )}
                                {m.content && <p className="whitespace-pre-wrap text-xs mt-1">{m.content}</p>}
                              </div>
                            ) : m.type === 'document' ? (
                              <div className="flex flex-col gap-2">
                                <a href={m.media_url || '#'} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-slate-900/50 hover:bg-slate-900 p-2 rounded-lg border border-slate-700 transition-colors">
                                  <Paperclip size={20} className="text-indigo-400 shrink-0" />
                                  <div className="flex flex-col">
                                    <span className="text-xs font-bold text-indigo-300">[{m.type.toUpperCase()}] Recebido</span>
                                    <span className="text-[10px] text-slate-400">Clique para baixar o arquivo</span>
                                  </div>
                                </a>
                                {m.content && <p className="whitespace-pre-wrap text-xs mt-1">{m.content}</p>}
                              </div>
                            ) : (
                              <p className="whitespace-pre-wrap">{m.content}</p>
                            )}
                            <span className="text-[10px] opacity-50 block mt-1 text-right">
                              {new Date(m.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Renderização do Resumo Técnico (Markdown Simplificado) */}
              <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap font-mono bg-slate-900 p-6 rounded-xl border border-slate-700">
                {activePedido.resumo_ia}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
