import React, { useState, useEffect } from 'react';
import { 
  Building2, User, Mail, UserPlus, UserCheck, 
  Siren, Store, Clock, ChevronRight, ShoppingCart, Search, Loader2
} from 'lucide-react';
import type { Lead, LeadStatus } from '../../types/index';
import { supabase } from '../../lib/supabase'; // Importante: Precisamos do Supabase aqui!

interface ChatAreaProps {
  lead: Lead | null;
  onStatusChange: (id: string, status: LeadStatus) => void;
  onAssumeLead: () => void;
  currentUserName: string;
}

const ChatArea: React.FC<ChatAreaProps> = ({ lead, onStatusChange, onAssumeLead, currentUserName }) => {
  const [categories, setCategories] = useState<any[]>([]);
  const [activeCategory, setActiveCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Novos estados para gerenciar os produtos do banco
  const [produtos, setProdutos] = useState<any[]>([]);
  const [loadingProdutos, setLoadingProdutos] = useState(false);

  // Busca os produtos ativos no Supabase quando o componente é montado
  useEffect(() => {
    const fetchProdutos = async () => {
      setLoadingProdutos(true);
      try {
        const { data: catData } = await supabase.from('categorias').select('*').order('ordem', { ascending: true }).order('criado_em', { ascending: true });
        if (catData) {
          setCategories(catData);
          if (catData.length > 0) setActiveCategory(catData[0].nome);
        }

        const { data, error } = await supabase
          .from('produtos')
          .select('*')
          .eq('ativo', true) // Puxa apenas o que estiver ativo
          .order('categoria', { ascending: true });
          
        if (!error && data) {
          setProdutos(data);
        }
      } catch (e) {
        console.error('Erro ao buscar catálogo', e);
      } finally {
        setLoadingProdutos(false);
      }
    };

    fetchProdutos();
  }, []);

  if (!lead) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 text-slate-400">
        <Building2 size={64} strokeWidth={1} className="mb-4 opacity-20" />
        <p className="text-sm font-medium">Selecione um lead para visualizar o catálogo</p>
      </div>
    );
  }

  const isBeingAttendedByMe = lead.atendido_por === currentUserName;

  // O filtro agora atua sobre os produtos puxados do banco de dados
  const produtosFiltrados = produtos.filter(p => 
    p.categoria === activeCategory && p.titulo.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-white relative overflow-hidden border-r border-slate-200">
      
      {/* PAINEL SUPERIOR: CONTEXTO DO LEAD */}
      <div className="bg-indigo-50/80 p-4 border-b border-indigo-200 z-10 shadow-sm flex flex-col gap-2 shrink-0">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="font-bold text-lg text-indigo-900 flex items-center gap-2">
              {lead.empresa} 
              <span className="bg-white border border-indigo-200 text-indigo-700 text-[10px] px-2 py-0.5 rounded font-mono">CNPJ: {lead.cpf_cnpj}</span>
            </h2>
            <div className="text-slate-600 text-xs mt-1 space-y-0.5">
              <p className="flex items-center gap-1.5"><User size={12} className="text-indigo-500" /> <strong>Contato:</strong> {lead.name} | {lead.telefone}</p>
              <p className="flex items-center gap-1.5"><Mail size={12} className="text-indigo-500" /> <strong>Email:</strong> {lead.email}</p>
            </div>
          </div>
          
          <div className="text-right">
            <span className="bg-green-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm border border-green-600 inline-block mb-1">
              Score: {lead.probabilidade}/10
            </span>
            <p className="text-[10px] text-indigo-700 font-medium">Captado por: {lead.vendedor}</p>
          </div>
        </div>

        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Status:</span>
            <select
              value={lead.status}
              onChange={(e) => onStatusChange(lead.id, e.target.value as LeadStatus)}
              className="text-xs border border-slate-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700"
            >
              <option value="aguardando">Aguardando Orçamento</option>
              <option value="enviado">Orçamento Enviado</option>
              <option value="aprovado">Aprovado e Pago</option>
            </select>
          </div>

          <div>
             {lead.atendido_por ? (
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold border ${isBeingAttendedByMe ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                  <UserCheck size={12} /> {isBeingAttendedByMe ? 'Seu Atendimento' : `Com: ${lead.atendido_por}`}
                </div>
              ) : (
                <button onClick={onAssumeLead} className="flex items-center gap-1.5 px-3 py-1 rounded bg-indigo-600 text-white text-[10px] font-bold hover:bg-indigo-700 transition-colors shadow-sm">
                  <UserPlus size={12} /> Assumir Lead
                </button>
              )}
          </div>
        </div>

        <div className="mt-2 bg-white p-3 rounded-lg border border-indigo-100 shadow-sm flex flex-col gap-2">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1">Pedido Inicial:</p>
            <div className="flex flex-wrap gap-2">
              {lead.itens.map((item, idx) => (
                <span key={idx} className="bg-indigo-600 text-white px-2 py-1 rounded shadow-sm text-xs font-medium">
                  {item.descricao} {item.produto}
                </span>
              ))}
            </div>
          </div>
          <div className="bg-amber-50 text-amber-800 p-2 rounded border border-amber-200 text-xs flex items-start gap-2">
            <Siren size={14} className="text-amber-600 shrink-0 mt-0.5" />
            <p><strong>Nota do Vendedor:</strong> "{lead.observacoes || 'Nenhuma'}"</p>
          </div>
        </div>
      </div>

      {/* ÁREA DINÂMICA (CATÁLOGO VINCULADO AO BANCO) */}
      <div className="flex-1 overflow-hidden relative bg-slate-50 flex">
        
        {!isBeingAttendedByMe && (
           <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/60 backdrop-blur-[2px]">
             <button onClick={onAssumeLead} className="bg-indigo-900 text-white font-bold py-3 px-6 rounded-lg shadow-2xl flex items-center gap-2 hover:scale-105 transition-transform">
               <UserPlus size={18} /> Assuma o lead para operar
             </button>
           </div>
        )}

        <div className="flex w-full h-full">
          {/* SIDEBAR ESQUERDA (Categorias) */}
          <div className="w-56 bg-white border-r border-slate-200 flex flex-col h-full shrink-0 shadow-sm z-10">
            <div className="p-3 border-b border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Filtrar Menu</p>
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" placeholder="Buscar produto..." 
                  value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded text-xs py-1.5 pl-8 pr-2 outline-none focus:border-indigo-400"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              {categories.map(cat => (
                <button 
                  key={cat.id} onClick={() => setActiveCategory(cat.nome)}
                  className={`w-full text-left px-4 py-2.5 text-xs font-semibold flex items-center justify-between transition-colors ${activeCategory === cat.nome ? 'bg-indigo-50 text-indigo-700 border-r-2 border-indigo-600' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  {cat.nome} <ChevronRight size={14} className={activeCategory === cat.nome ? 'text-indigo-600' : 'text-slate-300'} />
                </button>
              ))}
            </div>
          </div>

          {/* ÁREA DIREITA (Grid de Produtos) */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="mb-6 flex justify-between items-end">
              <div>
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">{activeCategory}</h3>
                <p className="text-xs text-slate-500 mt-1">
                  {loadingProdutos ? 'Carregando produtos...' : `Exibindo ${produtosFiltrados.length} produtos disponíveis.`}
                </p>
              </div>
            </div>

            {loadingProdutos ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 size={32} className="animate-spin text-indigo-500" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {produtosFiltrados.map(produto => (
                  <div key={produto.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:border-indigo-300 transition-all flex flex-col group">
                    <div className="h-32 bg-slate-100 flex items-center justify-center p-4 border-b border-slate-100 relative">
                      {produto.desconto && (
                         <div className="absolute top-2 right-2 bg-emerald-500 text-white text-[9px] font-black px-2 py-1 rounded shadow-sm">
                           PROMOÇÃO
                         </div>
                      )}
                      <Store size={48} className="text-slate-300 group-hover:text-indigo-200 transition-colors" />
                    </div>
                    <div className="p-4 flex-1 flex flex-col">
                      <h4 className="font-bold text-sm text-slate-800 leading-tight mb-1">{produto.titulo}</h4>
                      <p className="text-xs text-slate-500 mb-4 line-clamp-2">{produto.specs}</p>
                      
                      <div className="mt-auto">
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium mb-2">
                          <Clock size={12} /> Produção: {produto.prazo || 'Consultar'}
                        </div>
                        
                        <div className="flex items-end justify-between">
                          <div>
                            {produto.tipo_calculo === 'Fixo' ? (
                              // Se for Fixo, mostra o Preço ou o Desconto
                              produto.desconto ? (
                                <>
                                  <p className="text-[10px] text-slate-400 line-through">R$ {Number(produto.preco).toFixed(2)}</p>
                                  <p className="text-lg font-black text-emerald-600">R$ {Number(produto.desconto).toFixed(2)}</p>
                                </>
                              ) : (
                                <p className="text-lg font-black text-indigo-700">R$ {Number(produto.preco).toFixed(2)}</p>
                              )
                            ) : (
                              // Se for Dinâmico, mostra o Custo Base e avisa o vendedor
                              <>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Custo Base</p>
                                <p className="text-lg font-black text-slate-700">R$ {Number(produto.custo_base).toFixed(2)}</p>
                              </>
                            )}
                          </div>
                          <button className="bg-slate-100 hover:bg-indigo-600 text-slate-600 hover:text-white p-2 rounded-lg transition-colors" title="Adicionar ao Orçamento">
                            <ShoppingCart size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {produtosFiltrados.length === 0 && (
                  <div className="col-span-full py-12 text-center text-slate-400">
                    <p className="text-sm font-medium">Nenhum produto cadastrado nesta categoria ainda.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatArea;