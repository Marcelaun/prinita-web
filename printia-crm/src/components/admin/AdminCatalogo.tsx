import React, { useState, useEffect } from 'react';
import { Store, Plus, Edit2, LogOut, Loader2, Power, PowerOff, Users, ShieldCheck, User, FolderOpen, ChevronRight, Calculator, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

// Interfaces Atualizadas com o Motor de Cálculo
interface RegraMarkup { min: number; max: number; multiplicador: number; }
interface CustoExtra { nome: string; valor: number; }

interface Produto { 
  id: string; categoria: string; titulo: string; specs: string; 
  preco: number; desconto: number | null; prazo: string; ativo: boolean;
  tipo_calculo: 'Fixo' | 'Milheiro' | 'Area_m2' | 'Folha_A0' | 'Unidade';
  custo_base: number;
  regras_markup: RegraMarkup[];
  custos_extras: CustoExtra[];
}

interface Usuario { id: string; nome: string; cpf: string; role: 'admin' | 'vendedor' | 'producao'; senha?: string; ativo: boolean; }

// Categorias agora agem como "Pastas"
// As pastas agora são dinâmicas, carregadas do banco de dados

export default function AdminCatalogo() {
  const [activeTab, setActiveTab] = useState<'produtos' | 'equipe'>('produtos');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Estados de Produtos e Pastas
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [pastas, setPastas] = useState<any[]>([]);
  const [pastaAtiva, setPastaAtiva] = useState('');
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [prodFormData, setProdFormData] = useState<Partial<Produto>>({ 
    categoria: '', titulo: '', specs: '', preco: 0, desconto: null, prazo: '', ativo: true,
    tipo_calculo: 'Fixo', custo_base: 0, regras_markup: [], custos_extras: []
  });

  // Estados de Equipe
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userFormData, setUserFormData] = useState<Partial<Usuario>>({ nome: '', cpf: '', role: 'vendedor', senha: '', ativo: true });

  // =======================================================================
  // CARREGAMENTO DE DADOS
  // =======================================================================
  const fetchData = async () => {
    setLoading(true);
    const { data: pData } = await supabase.from('produtos').select('*').order('criado_em', { ascending: false });
    if (pData) setProdutos(pData);
    
    const { data: cData } = await supabase.from('categorias').select('*').order('ordem', { ascending: true }).order('criado_em', { ascending: true });
    if (cData) {
      setPastas(cData);
      if (cData.length > 0 && !pastaAtiva) setPastaAtiva(cData[0].nome);
    }
    
    const { data: uData } = await supabase.from('usuarios').select('*').order('nome', { ascending: true });
    if (uData) setUsuarios(uData);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleLogout = () => {
    localStorage.removeItem('printia_user_profile');
    window.location.reload();
  };

  // =======================================================================
  // FUNÇÕES DO MOTOR DE PRODUTOS
  // =======================================================================
  const handleAddMarkup = () => setProdFormData({ ...prodFormData, regras_markup: [...(prodFormData.regras_markup || []), { min: 1, max: 999, multiplicador: 2.0 }] });
  const handleRemoveMarkup = (index: number) => {
    const novasRegras = [...(prodFormData.regras_markup || [])];
    novasRegras.splice(index, 1);
    setProdFormData({ ...prodFormData, regras_markup: novasRegras });
  };
  const handleMarkupChange = (index: number, field: keyof RegraMarkup, value: string) => {
    const novasRegras = [...(prodFormData.regras_markup || [])];
    novasRegras[index] = { ...novasRegras[index], [field]: Number(value) };
    setProdFormData({ ...prodFormData, regras_markup: novasRegras });
  };

  const handleAddExtra = () => setProdFormData({ ...prodFormData, custos_extras: [...(prodFormData.custos_extras || []), { nome: '', valor: 0 }] });
  const handleRemoveExtra = (index: number) => {
    const novosExtras = [...(prodFormData.custos_extras || [])];
    novosExtras.splice(index, 1);
    setProdFormData({ ...prodFormData, custos_extras: novosExtras });
  };
  const handleExtraChange = (index: number, field: keyof CustoExtra, value: string) => {
    const novosExtras = [...(prodFormData.custos_extras || [])];
    novosExtras[index] = { ...novosExtras[index], [field]: field === 'valor' ? Number(value) : value };
    setProdFormData({ ...prodFormData, custos_extras: novosExtras });
  };

  const handleSaveProduto = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = { 
      ...prodFormData, 
      preco: Number(prodFormData.preco || 0), 
      desconto: prodFormData.desconto ? Number(prodFormData.desconto) : null,
      custo_base: Number(prodFormData.custo_base || 0)
    };
    
    if (prodFormData.id) await supabase.from('produtos').update(payload).eq('id', prodFormData.id);
    else await supabase.from('produtos').insert([payload]);
    
    setIsProductModalOpen(false);
    setSaving(false);
    fetchData();
  };

  const toggleAtivoProduto = async (id: string, currentStatus: boolean) => {
    await supabase.from('produtos').update({ ativo: !currentStatus }).eq('id', id);
    fetchData();
  };

  // =======================================================================
  // FUNÇÕES DE USUÁRIOS
  // =======================================================================
  const handleSaveUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = { nome: userFormData.nome, cpf: userFormData.cpf?.replace(/\D/g, ''), role: userFormData.role, senha: userFormData.senha || null };
    if (userFormData.id) await supabase.from('usuarios').update(payload).eq('id', userFormData.id);
    else await supabase.from('usuarios').insert([payload]);
    setIsUserModalOpen(false); setSaving(false); fetchData();
  };

  const toggleAtivoUsuario = async (id: string, currentStatus: boolean) => {
    await supabase.from('usuarios').update({ ativo: !currentStatus }).eq('id', id);
    fetchData();
  };

  // Produtos filtrados pela pasta atual
  const produtosDaPasta = produtos.filter(p => p.categoria === pastaAtiva);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      
      <header className="bg-slate-900 text-white p-4 shadow-md flex justify-between items-center z-20 shrink-0">
        <div className="flex items-center gap-3 ml-4">
          <div className="bg-emerald-500/20 p-2 rounded-lg"><ShieldCheck size={24} className="text-emerald-400" /></div>
          <div>
            <h1 className="text-xl font-black tracking-tight uppercase">PrintIA <span className="font-light">Admin</span></h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Painel de Gerenciamento</p>
          </div>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-2 bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-300 px-4 py-2 rounded-lg font-bold text-xs transition-colors mr-4">
          <LogOut size={14} /> Sair do Painel
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* MENU MASTER (ESQUERDA) */}
        <aside className="w-16 bg-slate-800 border-r border-slate-700 flex flex-col items-center py-6 gap-4 shrink-0 z-10 shadow-2xl">
          <button onClick={() => setActiveTab('produtos')} className={`p-3 rounded-2xl transition-all ${activeTab === 'produtos' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/50 scale-110' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`} title="Catálogo"><Store size={22} /></button>
          <button onClick={() => setActiveTab('equipe')} className={`p-3 rounded-2xl transition-all ${activeTab === 'equipe' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/50 scale-110' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`} title="Equipe"><Users size={22} /></button>
        </aside>

        {/* CONTEÚDO */}
        <main className="flex-1 flex overflow-hidden">
          {loading ? (
            <div className="flex-1 flex justify-center items-center"><Loader2 size={40} className="animate-spin text-indigo-500" /></div>
          ) : (
            <>
              {/* ========================================================= */}
              {/* ABA: CATÁLOGO (COM SISTEMA DE PASTAS)                       */}
              {/* ========================================================= */}
              {activeTab === 'produtos' && (
                <>
                  {/* EXPLORADOR DE PASTAS */}
                  <div className="w-64 bg-white border-r border-slate-200 flex flex-col h-full shrink-0 shadow-sm z-10">
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50"><h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pastas do Sistema</h2></div>
                    <div className="flex-1 overflow-y-auto py-2">
                      {pastas.map(pasta => {
                        const qtd = produtos.filter(p => p.categoria === pasta.nome).length;
                        return (
                          <button key={pasta.id} onClick={() => setPastaAtiva(pasta.nome)} className={`w-full text-left px-4 py-3 text-sm font-bold flex items-center gap-3 transition-colors ${pastaAtiva === pasta.nome ? 'bg-indigo-50 text-indigo-700 border-r-2 border-indigo-600' : 'text-slate-600 hover:bg-slate-50'}`}>
                            <FolderOpen size={16} className={pastaAtiva === pasta.nome ? 'text-indigo-500 fill-indigo-100' : 'text-slate-400'} />
                            <span className="flex-1 truncate">{pasta.nome}</span>
                            {qtd > 0 && <span className="bg-slate-100 text-slate-500 text-[10px] px-1.5 py-0.5 rounded">{qtd}</span>}
                          </button>
                        );
                      })}
                    </div>
                    <div className="p-4 border-t border-slate-100">
                      <button onClick={async () => {
                        const nova = prompt('Nome da nova pasta:');
                        if (nova?.trim()) {
                          await supabase.from('categorias').insert([{ nome: nova, ordem: pastas.length + 1 }]);
                          fetchData();
                        }
                      }} className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 rounded-lg text-sm font-bold transition-all">
                        <Plus size={16} /> Nova Pasta
                      </button>
                    </div>
                  </div>

                  {/* ARQUIVOS DA PASTA (PRODUTOS) */}
                  <div className="flex-1 p-8 overflow-y-auto bg-slate-50">
                    <div className="max-w-5xl mx-auto animate-in fade-in">
                      <div className="flex justify-between items-end mb-6">
                        <div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1"><Store size={12}/> Catálogo <ChevronRight size={12}/> {pastaAtiva}</p>
                          <h2 className="text-2xl font-black text-slate-800 uppercase">{pastaAtiva}</h2>
                        </div>
                        <button onClick={() => { setProdFormData({ categoria: pastaAtiva, titulo: '', specs: '', preco: 0, desconto: null, prazo: '', ativo: true, tipo_calculo: 'Fixo', custo_base: 0, regras_markup: [], custos_extras: [] }); setIsProductModalOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-5 rounded-xl shadow-md flex items-center gap-2">
                          <Plus size={18} /> Cadastrar Aqui
                        </button>
                      </div>
                      
                      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-widest border-b border-slate-200">
                              <th className="p-4 font-black">Status</th>
                              <th className="p-4 font-black">Produto</th>
                              <th className="p-4 font-black">Motor de Cálculo</th>
                              <th className="p-4 font-black">Preço Base</th>
                              <th className="p-4 font-black text-right">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="text-sm divide-y divide-slate-100">
                            {produtosDaPasta.map(p => (
                              <tr key={p.id} className={`hover:bg-slate-50 transition-colors ${!p.ativo ? 'opacity-50 grayscale' : ''}`}>
                                <td className="p-4">
                                  <button onClick={() => toggleAtivoProduto(p.id, p.ativo)} className={`p-2 rounded-lg flex items-center justify-center transition-colors ${p.ativo ? 'bg-emerald-100 text-emerald-600 hover:bg-rose-100' : 'bg-slate-200 text-slate-500 hover:bg-emerald-100'}`} title={p.ativo ? 'Desativar' : 'Ativar'}>
                                    {p.ativo ? <Power size={16} /> : <PowerOff size={16} />}
                                  </button>
                                </td>
                                <td className="p-4"><p className="font-bold text-slate-800">{p.titulo}</p><p className="text-xs text-slate-500 line-clamp-1">{p.specs}</p></td>
                                <td className="p-4">
                                  <span className={`font-bold px-2 py-1 rounded text-[10px] uppercase tracking-wider ${p.tipo_calculo === 'Fixo' ? 'bg-slate-100 text-slate-600' : 'bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center gap-1 w-max'}`}>
                                    {p.tipo_calculo !== 'Fixo' && <Calculator size={10} />} {p.tipo_calculo}
                                  </span>
                                </td>
                                <td className="p-4 font-black text-slate-700">R$ {p.tipo_calculo === 'Fixo' ? p.preco.toFixed(2) : p.custo_base.toFixed(2)}</td>
                                <td className="p-4 text-right">
                                  <button onClick={() => { setProdFormData(p); setIsProductModalOpen(true); }} className="bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white p-2 rounded-lg"><Edit2 size={16} /></button>
                                </td>
                              </tr>
                            ))}
                            {produtosDaPasta.length === 0 && <tr><td colSpan={5} className="p-10 text-center text-slate-400">Esta pasta está vazia.</td></tr>}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* ========================================================= */}
              {/* ABA: EQUIPE                                               */}
              {/* ========================================================= */}
              {activeTab === 'equipe' && (
                <div className="flex-1 p-8 overflow-y-auto bg-slate-50">
                  <div className="max-w-4xl mx-auto animate-in fade-in">
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-2xl font-black text-slate-800 uppercase">Equipe PrintIA</h2>
                      <button onClick={() => { setUserFormData({ nome: '', cpf: '', role: 'vendedor', senha: '', ativo: true }); setIsUserModalOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-5 rounded-xl shadow-md flex items-center gap-2">
                        <Plus size={18} /> Cadastrar Usuário
                      </button>
                    </div>
                    {/* Tabela de Usuários (Mantida como antes) */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-widest border-b border-slate-200">
                            <th className="p-4 font-black">Status</th>
                            <th className="p-4 font-black">Usuário</th>
                            <th className="p-4 font-black">CPF</th>
                            <th className="p-4 font-black">Acesso</th>
                            <th className="p-4 font-black text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-slate-100">
                          {usuarios.map(u => (
                            <tr key={u.id} className={`hover:bg-slate-50 transition-colors ${!u.ativo ? 'opacity-50 grayscale' : ''}`}>
                              <td className="p-4"><button onClick={() => toggleAtivoUsuario(u.id, u.ativo)} className={`p-2 rounded-lg flex items-center justify-center transition-colors ${u.ativo ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-500'}`}>{u.ativo ? <Power size={16} /> : <PowerOff size={16} />}</button></td>
                              <td className="p-4 flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500"><User size={14} /></div><p className="font-bold text-slate-800">{u.nome}</p></td>
                              <td className="p-4 font-mono text-xs text-slate-500">{u.cpf}</td>
                              <td className="p-4"><span className={`font-bold px-2.5 py-1 rounded text-[10px] uppercase tracking-wider border ${u.role === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-200' : u.role === 'producao' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>{u.role === 'admin' ? 'Administrador' : u.role === 'producao' ? 'Produção' : 'Vendedor'}</span></td>
                              <td className="p-4 text-right"><button onClick={() => { setUserFormData(u); setIsUserModalOpen(true); }} className="bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white p-2 rounded-lg"><Edit2 size={16} /></button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* ========================================================= */}
      {/* MODAL: PRODUTO (MOTOR DE PRECIFICAÇÃO DINÂMICO)           */}
      {/* ========================================================= */}
      {isProductModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="bg-indigo-600 p-6 text-white shrink-0"><h2 className="text-xl font-black">{prodFormData.id ? 'Editar Produto' : 'Novo Produto'}</h2></div>
            
            <form onSubmit={handleSaveProduto} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Informações Básicas */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Título do Produto / Serviço</label>
                  <input required type="text" value={prodFormData.titulo} onChange={e => setProdFormData({...prodFormData, titulo: e.target.value})} placeholder="Ex: Cartão de Visita Couchê 300g" className="w-full mt-1 p-3 border border-slate-200 rounded-xl bg-slate-50 outline-none focus:border-indigo-500 font-bold text-slate-800" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Especificações Físicas</label>
                  <input type="text" value={prodFormData.specs} onChange={e => setProdFormData({...prodFormData, specs: e.target.value})} placeholder="Ex: 4x4, Verniz Total Frente" className="w-full mt-1 p-3 border border-slate-200 rounded-xl bg-slate-50 outline-none focus:border-indigo-500 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Prazo de Entrega</label>
                  <input required type="text" value={prodFormData.prazo} onChange={e => setProdFormData({...prodFormData, prazo: e.target.value})} placeholder="Ex: 4 a 6 dias úteis" className="w-full mt-1 p-3 border border-slate-200 rounded-xl bg-slate-50 outline-none focus:border-indigo-500 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase text-indigo-600 flex items-center gap-1"><Calculator size={14}/> Motor de Cálculo</label>
                  <select value={prodFormData.tipo_calculo} onChange={e => setProdFormData({...prodFormData, tipo_calculo: e.target.value as any})} className="w-full mt-1 p-3 border border-indigo-200 rounded-xl bg-indigo-50 outline-none focus:border-indigo-500 font-bold text-indigo-700">
                    <option value="Fixo">Preço Fixo / Tabela Pronta</option>
                    <option value="Milheiro">Por Milheiro (Ex: Cartões)</option>
                    <option value="Area_m2">Por Metro Quadrado (Ex: Lonas)</option>
                    <option value="Folha_A0">Por Folha Base A0 (Ex: Blocos)</option>
                    <option value="Unidade">Por Unidade (Ex: Calendários)</option>
                  </select>
                </div>
              </div>

              <hr className="border-slate-100" />

              {/* LÓGICA CONDICIONAL DE CUSTO/PREÇO */}
              {prodFormData.tipo_calculo === 'Fixo' ? (
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Preço Final de Venda (R$)</label>
                    <input type="number" step="0.01" value={prodFormData.preco || ''} onChange={e => setProdFormData({...prodFormData, preco: e.target.value as any})} className="w-full mt-1 p-3 border border-slate-200 rounded-xl bg-white outline-none font-black text-lg" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Preço Promocional (Opcional)</label>
                    <input type="number" step="0.01" value={prodFormData.desconto || ''} onChange={e => setProdFormData({...prodFormData, desconto: e.target.value as any})} className="w-full mt-1 p-3 border border-slate-200 rounded-xl bg-white outline-none font-black text-lg text-emerald-600" />
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                    <label className="text-xs font-black text-indigo-700 uppercase">Custo Base ({prodFormData.tipo_calculo === 'Milheiro' ? 'do Milheiro' : prodFormData.tipo_calculo === 'Area_m2' ? 'do m²' : prodFormData.tipo_calculo === 'Folha_A0' ? 'da Folha A0' : 'da Unidade'})</label>
                    <div className="relative mt-2">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-indigo-400">R$</span>
                      <input type="number" step="0.01" required value={prodFormData.custo_base || ''} onChange={e => setProdFormData({...prodFormData, custo_base: e.target.value as any})} className="w-full p-4 pl-10 border border-indigo-200 rounded-xl bg-white outline-none focus:border-indigo-500 font-black text-xl text-indigo-900" placeholder="0.00" />
                    </div>
                  </div>

                  {/* Regras de Margem */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-bold text-slate-500 uppercase">Regras de Multiplicação (Margem/Markup)</label>
                      <button type="button" onClick={handleAddMarkup} className="text-[10px] bg-slate-200 text-slate-700 px-2 py-1 rounded font-bold hover:bg-slate-300 flex items-center gap-1"><Plus size={12}/> Adicionar Regra</button>
                    </div>
                    <div className="space-y-2">
                      {prodFormData.regras_markup?.map((regra, i) => (
                        <div key={i} className="flex gap-2 items-center bg-slate-50 p-2 rounded-lg border border-slate-200">
                          <span className="text-[10px] font-bold text-slate-400">De</span>
                          <input type="number" value={regra.min} onChange={e => handleMarkupChange(i, 'min', e.target.value)} className="w-20 p-2 border rounded-md text-xs font-bold text-center outline-none" />
                          <span className="text-[10px] font-bold text-slate-400">Até</span>
                          <input type="number" value={regra.max} onChange={e => handleMarkupChange(i, 'max', e.target.value)} className="w-20 p-2 border rounded-md text-xs font-bold text-center outline-none" />
                          <span className="text-[10px] font-bold text-slate-400">Multiplicar Custo por:</span>
                          <input type="number" step="0.1" value={regra.multiplicador} onChange={e => handleMarkupChange(i, 'multiplicador', e.target.value)} className="w-24 p-2 border border-emerald-200 bg-emerald-50 rounded-md text-xs font-black text-emerald-700 text-center outline-none" />
                          <button type="button" onClick={() => handleRemoveMarkup(i)} className="p-2 text-rose-400 hover:bg-rose-50 rounded-md"><Trash2 size={14}/></button>
                        </div>
                      ))}
                      {(!prodFormData.regras_markup || prodFormData.regras_markup.length === 0) && <p className="text-xs text-slate-400 italic text-center py-2">Nenhuma regra cadastrada.</p>}
                    </div>
                  </div>

                  {/* Custos Extras */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-bold text-slate-500 uppercase">Custos Extras / Setups (Opcional)</label>
                      <button type="button" onClick={handleAddExtra} className="text-[10px] bg-slate-200 text-slate-700 px-2 py-1 rounded font-bold hover:bg-slate-300 flex items-center gap-1"><Plus size={12}/> Adicionar Extra</button>
                    </div>
                    <div className="space-y-2">
                      {prodFormData.custos_extras?.map((extra, i) => (
                        <div key={i} className="flex gap-2 items-center bg-slate-50 p-2 rounded-lg border border-slate-200">
                          <input type="text" value={extra.nome} onChange={e => handleExtraChange(i, 'nome', e.target.value)} placeholder="Ex: Numeração, Arte" className="flex-1 p-2 border rounded-md text-xs font-bold outline-none" />
                          <span className="text-[10px] font-bold text-slate-400">+ R$</span>
                          <input type="number" step="0.01" value={extra.valor} onChange={e => handleExtraChange(i, 'valor', e.target.value)} className="w-24 p-2 border rounded-md text-xs font-bold text-center outline-none" />
                          <button type="button" onClick={() => handleRemoveExtra(i)} className="p-2 text-rose-400 hover:bg-rose-50 rounded-md"><Trash2 size={14}/></button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-6 border-t border-slate-100">
                <button type="button" onClick={() => setIsProductModalOpen(false)} className="w-1/3 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200">Cancelar</button>
                <button type="submit" disabled={saving} className="w-2/3 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 flex justify-center">{saving ? <Loader2 className="animate-spin" /> : 'Salvar Produto'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NOVO USUÁRIO (Mantido igual) */}
      {isUserModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-slate-800 p-6 text-white flex items-center gap-3"><Users size={24} className="text-emerald-400" /><h2 className="text-xl font-black">{userFormData.id ? 'Editar Usuário' : 'Novo Usuário'}</h2></div>
            <form onSubmit={handleSaveUsuario} className="p-6 space-y-4">
              <div><label className="text-xs font-bold text-slate-500 uppercase">Nome Completo</label><input required type="text" value={userFormData.nome} onChange={e => setUserFormData({...userFormData, nome: e.target.value})} className="w-full mt-1 p-3 border rounded-xl bg-slate-50 outline-none" /></div>
              <div><label className="text-xs font-bold text-slate-500 uppercase">CPF</label><input required type="text" value={userFormData.cpf} onChange={e => setUserFormData({...userFormData, cpf: e.target.value})} className="w-full mt-1 p-3 border rounded-xl bg-slate-50 outline-none" /></div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Nível de Acesso</label>
                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-2 text-sm"><input type="radio" value="vendedor" checked={userFormData.role === 'vendedor'} onChange={() => setUserFormData({...userFormData, role: 'vendedor'})} /> Vendedor</label>
                  <label className="flex items-center gap-2 text-sm"><input type="radio" value="producao" checked={userFormData.role === 'producao'} onChange={() => setUserFormData({...userFormData, role: 'producao'})} /> Produção</label>
                  <label className="flex items-center gap-2 text-sm"><input type="radio" value="admin" checked={userFormData.role === 'admin'} onChange={() => setUserFormData({...userFormData, role: 'admin'})} /> Administrador</label>
                </div>
              </div>
              {userFormData.role === 'admin' && (
                <div><label className="text-xs font-bold text-slate-500 uppercase">Senha Mestra</label><input required={!userFormData.id} type="password" value={userFormData.senha} onChange={e => setUserFormData({...userFormData, senha: e.target.value})} className="w-full mt-1 p-3 border rounded-xl bg-slate-50 outline-none" /></div>
              )}
              <div className="flex gap-3 pt-4"><button type="button" onClick={() => setIsUserModalOpen(false)} className="flex-1 py-3 bg-slate-100 font-bold rounded-xl">Cancelar</button><button type="submit" className="flex-1 py-3 bg-slate-800 text-white font-bold rounded-xl">Salvar</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}