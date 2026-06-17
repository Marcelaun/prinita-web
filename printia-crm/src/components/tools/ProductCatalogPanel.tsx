import React, { useState, useEffect } from 'react';
import { Search, ChevronRight, Store, Clock, Loader2, Calculator, Menu, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { sendWhatsAppMessage } from '../../services/api';

interface ProductCatalogPanelProps {
  activeLead?: any;
  activeChat?: any;
}

const ProductCatalogPanel: React.FC<ProductCatalogPanelProps> = ({ activeLead, activeChat }) => {
  const [categories, setCategories] = useState<any[]>([]);
  const [activeCategory, setActiveCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  
  const [produtos, setProdutos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Sidebar comes closed by default to save space

  useEffect(() => {
    const fetchProdutos = async () => {
      setLoading(true);
      try {
        const { data: catData } = await supabase.from('categorias').select('*').order('ordem', { ascending: true }).order('criado_em', { ascending: true });
        if (catData) {
          setCategories(catData);
          if (catData.length > 0) setActiveCategory(catData[0].nome);
        }

        const { data } = await supabase
          .from('produtos')
          .select('*')
          .eq('ativo', true)
          .order('titulo', { ascending: true });
        
        if (data) setProdutos(data);
      } catch (err) {
        console.error("Erro ao carregar produtos:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProdutos();
  }, []);

  const filteredProducts = produtos.filter(p => {
    if (p.categoria !== activeCategory) return false;
    if (searchQuery && !p.titulo?.toLowerCase().includes(searchQuery.toLowerCase()) && !p.specs?.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  const handleSendToChat = async (product: any) => {
    if (!activeChat) {
      alert("Selecione uma conversa do WhatsApp primeiro!");
      return;
    }

    const qty = quantities[product.id] || 1;
    const unitPrice = product.tipo_calculo === 'Fixo' 
      ? (product.desconto ? product.desconto : product.preco)
      : product.custo_base;
    
    const totalPrice = Number(unitPrice) * qty;
    
    const priceFormatted = Number(totalPrice).toFixed(2);
    const priceLabel = product.tipo_calculo === 'Fixo' ? 'Preço Total:' : 'Preço Base Total:';

    const messageText = `*${product.titulo.toUpperCase()}*\n\n📄 *Especificações:* ${product.specs}\n📦 *Quantidade:* ${qty}\n⏱️ *Produção:* ${product.prazo || 'Sob Consulta'}\n💰 *${priceLabel}* R$ ${priceFormatted}`;

    try {
      setLoading(true);
      await sendWhatsAppMessage(activeChat.remote_jid, messageText, product.imagem_url);
      alert('Produto enviado com sucesso!');
    } catch (error) {
      console.error('Erro ao enviar produto:', error);
      alert('Erro ao enviar produto para o chat.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex bg-white overflow-hidden text-slate-800">
      {/* Sidebar - Categories */}
      {isSidebarOpen && (
        <div className="w-56 border-r border-slate-200 flex flex-col shrink-0 bg-white animate-in slide-in-from-left-4 duration-200">
          <div className="p-4 border-b border-slate-200">
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Filtrar Menu</h3>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={16} className="text-slate-400" />
              </div>
              <input 
                type="text" 
                placeholder="Buscar produto..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>
          </div>
          
          <nav className="p-2 space-y-1">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => { setActiveCategory(cat.nome); setIsSidebarOpen(false); }}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors ${
                  activeCategory === cat.nome
                    ? 'bg-indigo-50 text-indigo-700 font-bold'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span>{cat.nome}</span>
                {activeCategory === cat.nome && <ChevronRight size={14} />}
              </button>
            ))}
          </nav>
        </div>
      )}

      {/* Main Content - Products List */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 relative">
        <div className="p-6 shrink-0 flex flex-col gap-5">
          <div className="flex">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={`flex items-center gap-2 px-3 py-2 -ml-3 rounded-lg transition-colors border border-transparent ${isSidebarOpen ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'}`}
              title="Mostrar/Ocultar Filtros"
            >
              <Menu size={20} />
              <span className="text-xs font-bold uppercase tracking-wider">Mostrar/Ocultar Filtros</span>
            </button>
          </div>
          
          <div>
            <h1 className="text-[22px] font-black text-slate-900 uppercase tracking-tight">{activeCategory}</h1>
            <p className="text-slate-500 text-sm mt-1">
              {loading ? 'Carregando produtos...' : `Exibindo ${filteredProducts.length} produtos disponíveis.`}
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {loading ? (
             <div className="flex justify-center items-center h-40">
               <Loader2 size={32} className="animate-spin text-indigo-500" />
             </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                {filteredProducts.map(product => (
                  <div key={product.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-md hover:border-indigo-300 transition-all flex flex-col h-full group relative">
                    {product.desconto && (
                      <div className="absolute top-3 right-3 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-md z-10 shadow-sm">
                        Oferta
                      </div>
                    )}
                    
                    <div className="h-32 bg-slate-100 flex items-center justify-center shrink-0 group-hover:bg-indigo-50 transition-colors relative overflow-hidden">
                      {product.imagem_url ? (
                        <img src={product.imagem_url} alt={product.titulo} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <Store size={40} className="text-slate-300 group-hover:text-indigo-400 transition-colors" />
                      )}
                    </div>
                    
                    <div className="p-5 flex flex-col flex-1">
                      <h3 className="text-sm font-bold text-slate-800 leading-tight mb-1">{product.titulo}</h3>
                      <p className="text-slate-500 text-xs mb-4 line-clamp-2">{product.specs}</p>
                      
                      <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-6">
                        <Clock size={12} />
                        Produção: {product.prazo || 'Sob Consulta'}
                      </div>
                      
                      <div className="mt-auto">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          {product.tipo_calculo === 'Fixo' ? 'Preço Final' : 'Custo Base'}
                        </p>
                        
                        {product.tipo_calculo === 'Fixo' ? (
                          product.desconto ? (
                            <div className="flex items-end gap-2">
                              <p className="text-xs text-slate-400 line-through mb-1">R$ {Number(product.preco).toFixed(2)}</p>
                              <p className="text-2xl font-black text-emerald-600 tracking-tight">R$ {Number(product.desconto).toFixed(2)}</p>
                            </div>
                          ) : (
                            <p className="text-xl font-black text-indigo-700 tracking-tight">R$ {Number(product.preco).toFixed(2)}</p>
                          )
                        ) : (
                           <div className="flex flex-col">
                             <p className="text-xl font-black text-slate-700 tracking-tight">R$ {Number(product.custo_base).toFixed(2)}</p>
                             <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1 mt-0.5">
                                <Calculator size={10} /> Base para cálculo dinâmico
                             </span>
                           </div>
                        )}
                      </div>
                      
                      {activeChat && (
                        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500 font-medium">Quantidade:</span>
                            <input 
                              type="number" 
                              min="1" 
                              value={quantities[product.id] || 1} 
                              onChange={(e) => setQuantities({...quantities, [product.id]: parseInt(e.target.value) || 1})}
                              className="w-16 px-2 py-1 text-sm font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded text-center focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                            />
                          </div>
                          <button
                            onClick={() => handleSendToChat(product)}
                            className="w-full flex items-center justify-center gap-2 py-2 bg-slate-100 hover:bg-emerald-500 text-slate-600 hover:text-white rounded-lg text-xs font-bold transition-colors"
                          >
                            <Send size={14} /> Enviar para o Cliente
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              {filteredProducts.length === 0 && (
                 <div className="flex flex-col items-center justify-center h-40 text-slate-400 mt-10">
                    <Store size={32} className="mb-2 opacity-20" />
                    <p className="text-sm font-medium">Nenhum produto cadastrado nesta categoria</p>
                 </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductCatalogPanel;
