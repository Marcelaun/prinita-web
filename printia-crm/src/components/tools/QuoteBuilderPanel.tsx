import React, { useState, useEffect, useRef } from 'react';
import { Plus, Search, ChevronLeft, Send, Trash2, Edit2, Bot, Receipt, Loader2, Factory } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getPropostas, createProposta, updateProposta, sendWhatsAppMessage, generateProductionAI, createPedido } from '../../services/api';

interface QuoteBuilderPanelProps {
  activeLead?: any;
  activeChat?: any;
}

export default function QuoteBuilderPanel({ activeLead, activeChat }: QuoteBuilderPanelProps) {
  const [propostas, setPropostas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeProposta, setActiveProposta] = useState<any | null>(null);

  // Cart State
  const [produtos, setProdutos] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // AI State
  const [messages, setMessages] = useState<any[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [productionLoading, setProductionLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeChat) {
      loadPropostas();
    } else {
      setPropostas([]);
      setActiveProposta(null);
    }
  }, [activeChat]);

  useEffect(() => {
    // Carregar produtos para busca
    const fetchProdutos = async () => {
      const { data } = await supabase.from('produtos').select('*').eq('ativo', true).order('titulo', { ascending: true });
      if (data) setProdutos(data);
    };
    fetchProdutos();
  }, []);

  const loadPropostas = async () => {
    if (!activeChat) return;
    setLoading(true);
    try {
      const data = await getPropostas(activeChat.id);
      setPropostas(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProposta = async () => {
    if (!activeChat) return;
    try {
      const nova = {
        chat_id: activeChat.id,
        numero_cliente: activeChat.remote_jid,
        nome_proposta: `Orçamento #${Math.floor(Math.random() * 10000)}`,
        itens: [],
        valor_total: 0,
        status: 'rascunho'
      };
      const result = await createProposta(nova);
      setPropostas([result.proposta, ...propostas]);
      setActiveProposta(result.proposta);
    } catch (err) {
      console.error(err);
      alert('Erro ao criar orçamento');
    }
  };

  const handleUpdateProposta = async (id: string, updates: any) => {
    try {
      const res = await updateProposta(id, updates);
      setPropostas(propostas.map(p => p.id === id ? res.proposta : p));
      if (activeProposta?.id === id) {
        setActiveProposta(res.proposta);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddToCart = (produto: any) => {
    if (!activeProposta) return;
    const price = produto.tipo_calculo === 'Fixo' 
      ? (produto.desconto ? produto.desconto : produto.preco)
      : produto.custo_base;
      
    const newItem = {
      produto_id: produto.id,
      titulo: produto.titulo,
      quantidade: 1,
      preco_unitario: Number(price),
      preco_total: Number(price),
      specs: produto.specs
    };
    
    const novosItens = [...(activeProposta.itens || []), newItem];
    const novoTotal = novosItens.reduce((acc, item) => acc + item.preco_total, 0);
    
    handleUpdateProposta(activeProposta.id, { itens: novosItens, valor_total: novoTotal });
  };

  const handleRemoveItem = (index: number) => {
    if (!activeProposta) return;
    const novosItens = [...activeProposta.itens];
    novosItens.splice(index, 1);
    const novoTotal = novosItens.reduce((acc, item) => acc + item.preco_total, 0);
    handleUpdateProposta(activeProposta.id, { itens: novosItens, valor_total: novoTotal });
  };

  const handleUpdateItemQuantity = (index: number, newQty: number) => {
    if (!activeProposta || newQty < 1) return;
    const novosItens = [...activeProposta.itens];
    novosItens[index].quantidade = newQty;
    novosItens[index].preco_total = novosItens[index].preco_unitario * newQty;
    const novoTotal = novosItens.reduce((acc, item) => acc + item.preco_total, 0);
    handleUpdateProposta(activeProposta.id, { itens: novosItens, valor_total: novoTotal });
  };

  const handleSendAiMessage = async () => {
    if (!aiInput.trim() || !activeChat) return;
    
    const userMsg = { role: 'user', content: aiInput };
    setMessages([...messages, userMsg]);
    setAiInput('');
    setAiLoading(true);

    try {
      const leadContext = {
        name: activeChat.push_name || activeChat.number,
        phone: activeChat.number,
        itens: activeProposta?.itens || []
      };

      const res = await fetch(`http://localhost:3000/api/copilot/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          lead: leadContext,
          message: aiInput,
          mode: 'orcamento',
          vendedor: JSON.parse(localStorage.getItem('printia_user_profile') || '{}'),
          contextType: 'whatsapp'
        })
      });
      
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'assistant', content: "Desculpe, ocorreu um erro ao consultar a IA." }]);
    } finally {
      setAiLoading(false);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  const handleSendToWhatsApp = async () => {
    if (!activeChat || !activeProposta || !activeProposta.itens || activeProposta.itens.length === 0) {
      alert("O orçamento está vazio!");
      return;
    }

    const currentUser = JSON.parse(localStorage.getItem('printia_user_profile') || '{}');
    const atendenteNome = currentUser.name || 'Atendente';

    let text = `*${atendenteNome}:*\n\n*PROPOSTA COMERCIAL - ${activeProposta.nome_proposta}*\n\n`;
    activeProposta.itens.forEach((item: any) => {
      text += `🛒 *${item.titulo}*\n`;
      if (item.specs) text += `📄 Esp.: ${item.specs}\n`;
      text += `📦 Qtd: ${item.quantidade} | Un: R$ ${item.preco_unitario.toFixed(2)}\n`;
      text += `💰 Subtotal: R$ ${item.preco_total.toFixed(2)}\n\n`;
    });
    
    text += `*VALOR TOTAL:* R$ ${activeProposta.valor_total.toFixed(2)}\n\n`;
    text += `Podemos fechar o pedido?`;

    try {
      setLoading(true);
      await sendWhatsAppMessage(activeChat.remote_jid, text);
      handleUpdateProposta(activeProposta.id, { status: 'enviado' });
      alert('Orçamento enviado com sucesso!');
    } catch (error) {
      console.error(error);
      alert('Erro ao enviar.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendToProduction = async () => {
    if (!activeProposta || !activeChat) return;
    setProductionLoading(true);
    try {
      const res = await generateProductionAI(activeChat.id, activeProposta.id);
      
      await createPedido({
        chat_id: activeChat.id,
        proposta_id: activeProposta.id,
        cliente_nome: activeChat.name || activeChat.remote_jid,
        cliente_numero: activeChat.remote_jid,
        titulo: activeProposta.nome_proposta,
        status_producao: 'Na Fila',
        prazo_entrega: 'A definir',
        resumo_ia: res.resumo_ia
      });

      handleUpdateProposta(activeProposta.id, { status: 'produção' });
      alert('Enviado para a Produção com sucesso!');
    } catch (err) {
      console.error(err);
      alert('Erro ao enviar para produção');
    } finally {
      setProductionLoading(false);
    }
  };

  const filteredProdutos = produtos.filter(p => p.titulo.toLowerCase().includes(searchQuery.toLowerCase()));

  if (!activeChat) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-white">
        <Receipt size={48} className="text-slate-200 mb-4" />
        <h2 className="text-lg font-bold text-slate-700">Selecione uma conversa</h2>
        <p className="text-slate-500 text-sm mt-2">Você precisa abrir o chat de um cliente para gerenciar orçamentos.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden text-slate-800">
      
      {/* HEADER */}
      <div className="p-4 border-b border-slate-200 bg-white shrink-0 flex items-center justify-between">
        {activeProposta ? (
          <div className="flex items-center gap-3">
            <button onClick={() => setActiveProposta(null)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500">
              <ChevronLeft size={20} />
            </button>
            <div>
              <h2 className="text-sm font-bold text-slate-800">{activeProposta.nome_proposta}</h2>
              <p className="text-xs text-slate-500">Total: R$ {Number(activeProposta.valor_total || 0).toFixed(2)}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Receipt className="text-rose-500" size={24} />
            <h2 className="text-base font-bold text-slate-800 tracking-tight">Orçamentos</h2>
          </div>
        )}

        {!activeProposta && (
          <button onClick={handleCreateProposta} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors">
            <Plus size={14} /> Novo Orçamento
          </button>
        )}
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto bg-slate-50">
        
        {loading && !activeProposta ? (
          <div className="flex justify-center p-8"><Loader2 className="animate-spin text-indigo-500" /></div>
        ) : !activeProposta ? (
          /* LISTA DE PROPOSTAS */
          <div className="p-4 flex flex-col gap-3">
            {propostas.length === 0 ? (
              <div className="text-center p-8 bg-white border border-slate-200 rounded-xl border-dashed">
                 <p className="text-slate-400 text-sm">Nenhum orçamento para este cliente.</p>
              </div>
            ) : (
              propostas.map(prop => (
                <div key={prop.id} onClick={() => setActiveProposta(prop)} className="bg-white border border-slate-200 p-4 rounded-xl hover:shadow-sm cursor-pointer hover:border-rose-300 transition-all">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-slate-800 text-sm">{prop.nome_proposta}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                      prop.status === 'enviado' ? 'bg-blue-100 text-blue-700' :
                      prop.status === 'aprovado' ? 'bg-emerald-100 text-emerald-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {prop.status}
                    </span>
                  </div>
                  <div className="flex justify-between items-end">
                    <p className="text-xs text-slate-500">{prop.itens?.length || 0} itens</p>
                    <p className="font-black text-emerald-600">R$ {Number(prop.valor_total || 0).toFixed(2)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          /* EDICAO DE PROPOSTA (SPLIT VIEW) */
          <div className="flex flex-col h-full">
            
            {/* CARRINHO DE PRODUTOS */}
            <div className="p-4 bg-white border-b border-slate-200">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Itens do Orçamento</h3>
              
              {activeProposta.itens?.length === 0 ? (
                <div className="text-center py-4 bg-slate-50 rounded-lg border border-slate-100 mb-4">
                  <p className="text-xs text-slate-400">Nenhum item adicionado.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2 mb-4">
                  {activeProposta.itens?.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 border border-slate-100 rounded-lg">
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="text-xs font-bold text-slate-700 truncate">{item.titulo}</p>
                        <p className="text-[10px] text-slate-500">R$ {item.preco_unitario.toFixed(2)} un.</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <input
                          type="number"
                          min="1"
                          value={item.quantidade}
                          onChange={(e) => handleUpdateItemQuantity(idx, parseInt(e.target.value) || 1)}
                          className="w-12 px-1 py-0.5 text-xs text-center font-bold text-slate-700 bg-white border border-slate-200 rounded focus:outline-none focus:border-indigo-500"
                        />
                        <span className="text-xs font-bold text-slate-800 w-16 text-right">R$ {item.preco_total.toFixed(2)}</span>
                        <button onClick={() => handleRemoveItem(idx)} className="text-red-400 hover:text-red-600 ml-1"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* BUSCA DE PRODUTOS */}
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input 
                  type="text" 
                  placeholder="Buscar produto para adicionar..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500"
                />
              </div>

              {searchQuery && (
                <div className="max-h-40 overflow-y-auto flex flex-col gap-1 border border-slate-200 rounded-lg p-1 bg-white absolute z-20 w-[calc(100%-2rem)] shadow-lg">
                  {filteredProdutos.slice(0, 10).map(p => (
                    <button key={p.id} onClick={() => { handleAddToCart(p); setSearchQuery(''); }} className="flex items-center justify-between p-2 hover:bg-indigo-50 rounded text-left">
                      <span className="text-xs font-semibold text-slate-700 truncate pr-2">{p.titulo}</span>
                      <Plus size={14} className="text-indigo-600 shrink-0" />
                    </button>
                  ))}
                  {filteredProdutos.length === 0 && <p className="text-xs text-slate-400 p-2 text-center">Nenhum produto encontrado</p>}
                </div>
              )}

              <button onClick={handleSendToWhatsApp} className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold transition-colors mt-2">
                <Send size={16} /> Enviar Orçamento
              </button>

              <button 
                onClick={handleSendToProduction} 
                disabled={productionLoading}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-bold transition-colors mt-2 disabled:opacity-50"
              >
                <Factory size={16} /> {productionLoading ? 'Enviando...' : 'Enviar para Produção'}
              </button>
            </div>

            {/* IA ASSISTANT */}
            <div className="flex-1 flex flex-col min-h-[300px] bg-slate-50">
              <div className="p-3 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2 shrink-0">
                <Bot size={16} className="text-indigo-600" />
                <span className="text-xs font-bold text-indigo-800">IA de Orçamentos</span>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                {messages.length === 0 && (
                  <div className="text-center mt-4">
                    <p className="text-xs text-slate-500">A IA tem acesso aos itens do carrinho acima. Peça para ela sugerir descontos, textos de venda ou combinações de produtos!</p>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none shadow-sm'}`}>
                      {m.content}
                    </div>
                  </div>
                ))}
                {aiLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />
                      <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                      <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-3 bg-white border-t border-slate-200 shrink-0">
                <div className="relative">
                  <input
                    type="text"
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendAiMessage()}
                    placeholder="Pedir ajuda para a IA..."
                    className="w-full pl-4 pr-10 py-2 text-sm bg-slate-50 border border-slate-200 rounded-full focus:outline-none focus:border-indigo-500 focus:bg-white"
                  />
                  <button onClick={handleSendAiMessage} disabled={aiLoading || !aiInput.trim()} className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50">
                    <Send size={14} />
                  </button>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
