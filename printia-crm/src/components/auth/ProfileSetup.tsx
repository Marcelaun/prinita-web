import React, { useState } from 'react';
import { User, Fingerprint, Printer, ArrowRight, ShieldCheck, Lock, Unlock } from 'lucide-react';

import { supabase } from '../../lib/supabase';

interface ProfileSetupProps {
  onComplete: (name: string, cpf: string, isAdmin?: boolean, role?: string) => void;
}

const ProfileSetup: React.FC<ProfileSetupProps> = ({ onComplete }) => {
  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  
  // Estados para controlar a tela secreta de Admin
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && cpf.trim()) {
      setLoading(true);
      setLoginError('');
      try {
        const { data, error } = await supabase.from('usuarios').select('*').eq('cpf', cpf).single();
        if (error || !data) {
          setLoginError('Usuário não encontrado. Peça para o administrador cadastrar seu CPF.');
          setLoading(false);
          return;
        }
        if (!data.ativo) {
          setLoginError('Seu usuário está desativado.');
          setLoading(false);
          return;
        }
        onComplete(data.nome, data.cpf, data.role === 'admin', data.role);
      } catch (err) {
        setLoginError('Erro ao conectar com o banco de dados.');
      }
      setLoading(false);
    }
  };

  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // A SENHA MESTRA ESTÁ AQUI (Você pode mudar depois)
    if (adminPassword === 'printia2026') {
      // Passamos isAdmin = true para o App principal saber qual tela abrir
      onComplete('Administrador', '00000000000', true, 'admin'); 
    } else {
      setAdminError('Senha incorreta. Acesso negado.');
      setTimeout(() => setAdminError(''), 3000);
    }
  };

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-indigo-900 font-sans relative overflow-hidden">
      {/* Background Decorativo */}
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500 rounded-full blur-[120px] opacity-20"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-400 rounded-full blur-[120px] opacity-20"></div>

      <div className="w-full max-w-md p-8 bg-white rounded-[40px] shadow-2xl relative z-10 animate-in fade-in zoom-in duration-500 overflow-hidden">
        
        <div className={`transition-all duration-300 ${showAdminLogin ? '-translate-x-[150%] absolute opacity-0' : 'translate-x-0 relative opacity-100'}`}>
          <div className="flex flex-col items-center mb-10">
            <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl mb-4 transform -rotate-3">
              <Printer size={40} />
            </div>
            <h1 className="text-3xl font-black text-indigo-900 tracking-tighter uppercase">PrintIA CRM</h1>
            <div className="flex items-center gap-2 mt-2">
              <ShieldCheck size={14} className="text-emerald-500" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Acesso do Atendente</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Seu Nome Completo</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors"><User size={18} /></div>
                <input required type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Marcelo Almeida" className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-6 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-300" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Seu CPF (Somente números)</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors"><Fingerprint size={18} /></div>
                <input required type="text" value={cpf} onChange={(e) => setCpf(e.target.value.replace(/\D/g, ''))} placeholder="000.000.000-00" className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-6 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-300" />
              </div>
            </div>
            {loginError && <p className="text-xs text-rose-500 font-bold text-center mt-2">{loginError}</p>}
            <button disabled={loading} type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-5 rounded-2xl shadow-xl shadow-indigo-200 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3 uppercase tracking-widest text-xs border-b-4 border-indigo-800 mt-4 disabled:opacity-50">
              {loading ? 'Acessando...' : 'Acessar Dashboard'} <ArrowRight size={18} />
            </button>
          </form>
        </div>

        {/* TELA DO ADMINISTRADOR (Secreta) */}
        <div className={`transition-all duration-300 ${!showAdminLogin ? 'translate-x-[150%] absolute opacity-0' : 'translate-x-0 relative opacity-100'}`}>
          <div className="flex flex-col items-center mb-10">
            <div className="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center text-emerald-400 shadow-xl mb-4">
              <Lock size={40} />
            </div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tighter uppercase">Acesso Restrito</h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Área de Gerenciamento PrintIA</p>
          </div>

          <form onSubmit={handleAdminSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Senha Mestra</label>
              <div className="relative group">
                <input 
                  required type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} 
                  placeholder="••••••••" 
                  className={`w-full bg-slate-50 border rounded-2xl py-4 px-6 text-center text-xl font-black tracking-widest focus:outline-none focus:ring-4 transition-all ${adminError ? 'border-rose-400 focus:ring-rose-500/10 focus:border-rose-500 text-rose-600' : 'border-slate-100 focus:ring-slate-500/10 focus:border-slate-500'}`} 
                />
              </div>
              {adminError && <p className="text-xs text-rose-500 font-bold text-center animate-bounce mt-2">{adminError}</p>}
            </div>
            <button type="submit" className="w-full bg-slate-800 hover:bg-slate-900 text-white font-black py-5 rounded-2xl shadow-xl transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3 uppercase tracking-widest text-xs border-b-4 border-slate-950 mt-4">
              Desbloquear Sistema <Unlock size={18} />
            </button>
          </form>
        </div>
      </div>

      {/* BOTÃO DE ALTERNÂNCIA (Fica fora do card branco para ser mais discreto) */}
      <button 
        onClick={() => { setShowAdminLogin(!showAdminLogin); setAdminError(''); setAdminPassword(''); }}
        className="mt-8 text-[10px] font-black text-indigo-300/50 hover:text-white uppercase tracking-widest transition-colors z-10 flex items-center gap-2"
      >
        <ShieldCheck size={14} /> {showAdminLogin ? 'Voltar para Login de Vendedor' : 'Acesso Administrativo'}
      </button>

    </div>
  );
};

export default ProfileSetup;