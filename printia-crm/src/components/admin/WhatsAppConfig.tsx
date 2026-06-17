import React, { useState, useEffect } from 'react';
import { Smartphone, RefreshCw, QrCode, LogOut, CheckCircle2 } from 'lucide-react';

const WhatsAppConfig: React.FC = () => {
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'qr' | 'connected'>('disconnected');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // No futuro isso virá do Contexto de Auth do usuário logado
  const GRAFICA_ID = '11111111-1111-1111-1111-111111111111';
  const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

  const checkStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/api/whatsapp/status`, {
        headers: { 'x-grafica-id': GRAFICA_ID }
      });
      const data = await response.json();
      setStatus(data.status);
      setQrCode(data.qrCode);
    } catch (error) {
      console.error("Erro ao checar status do WhatsApp", error);
    }
  };

  useEffect(() => {
    checkStatus();
    // Faz polling a cada 3 segundos para pegar atualizações do QR code ou conexão
    const interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleConnect = async () => {
    setLoading(true);
    try {
      await fetch(`${API_URL}/api/whatsapp/connect`, {
        method: 'POST',
        headers: { 'x-grafica-id': GRAFICA_ID }
      });
      setStatus('connecting');
    } catch (error) {
      console.error("Erro ao conectar", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await fetch(`${API_URL}/api/whatsapp/logout`, {
        method: 'POST',
        headers: { 'x-grafica-id': GRAFICA_ID }
      });
      setStatus('disconnected');
      setQrCode(null);
    } catch (error) {
      console.error("Erro ao desconectar", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 bg-slate-50 p-8 flex justify-center items-start overflow-y-auto">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        
        <div className="bg-emerald-600 p-6 text-white flex items-center gap-4">
          <div className="p-3 bg-white/20 rounded-xl">
            <Smartphone size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight">Conexão WhatsApp</h2>
            <p className="text-emerald-100 font-medium">Conecte o número da gráfica nativamente ao CRM</p>
          </div>
        </div>

        <div className="p-8 flex flex-col items-center text-center gap-6">
          
          {/* STATUS: DISCONNECTED */}
          {status === 'disconnected' && (
            <>
              <div className="w-24 h-24 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mb-2">
                <LogOut size={40} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800">WhatsApp Desconectado</h3>
                <p className="text-slate-500 mt-2 max-w-sm">
                  O sistema precisa estar conectado ao seu celular para enviar e receber mensagens automaticamente.
                </p>
              </div>
              <button 
                onClick={handleConnect}
                disabled={loading}
                className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? <RefreshCw className="animate-spin" /> : <QrCode />}
                Gerar QR Code
              </button>
            </>
          )}

          {/* STATUS: CONNECTING */}
          {status === 'connecting' && (
            <>
              <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-2">
                <RefreshCw size={40} className="animate-spin" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800">Iniciando Motor...</h3>
                <p className="text-slate-500 mt-2 max-w-sm">
                  Aguarde um momento enquanto o sistema gera seu QR Code seguro.
                </p>
              </div>
            </>
          )}

          {/* STATUS: QR CODE READY */}
          {status === 'qr' && (
            <>
              <div>
                <h3 className="text-xl font-bold text-slate-800">Escaneie o QR Code</h3>
                <p className="text-slate-500 mt-2 max-w-sm">
                  1. Abra o WhatsApp no seu celular<br/>
                  2. Toque em Mais opções (⋮) ou Configurações<br/>
                  3. Toque em <strong>Aparelhos conectados</strong><br/>
                  4. Toque em <strong>Conectar um aparelho</strong><br/>
                  5. Aponte a câmera para esta tela
                </p>
              </div>
              
              <div className="p-4 bg-white border-4 border-slate-100 rounded-2xl shadow-inner mt-2">
                {qrCode ? (
                  <img src={qrCode} alt="WhatsApp QR Code" className="w-64 h-64 object-contain" />
                ) : (
                  <div className="w-64 h-64 flex items-center justify-center bg-slate-50 text-slate-400">
                    <RefreshCw className="animate-spin" size={32} />
                  </div>
                )}
              </div>
            </>
          )}

          {/* STATUS: CONNECTED */}
          {status === 'connected' && (
            <>
              <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-2 shadow-inner">
                <CheckCircle2 size={48} />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-800">WhatsApp Conectado!</h3>
                <p className="text-slate-500 mt-2 max-w-sm">
                  O motor nativo está rodando em segundo plano. Seu CRM já está recebendo as mensagens de clientes em tempo real.
                </p>
              </div>
              <button 
                onClick={handleDisconnect}
                disabled={loading}
                className="mt-4 bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold py-3 px-8 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? <RefreshCw className="animate-spin" /> : <LogOut />}
                Desconectar Aparelho
              </button>
            </>
          )}

        </div>
      </div>
    </div>
  );
};

export default WhatsAppConfig;
