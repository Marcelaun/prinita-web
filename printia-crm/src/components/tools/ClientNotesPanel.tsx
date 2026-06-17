import React, { useState, useEffect } from 'react';
import { FileText, Save, Loader2, Sparkles, RefreshCw, User, ShoppingBag, Target } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { generateAiProfile, updateManualNotes } from '../../services/api';

interface ClientNotesPanelProps {
  activeChat?: any;
  activeLead?: any;
  contextType?: string;
}

const ClientNotesPanel: React.FC<ClientNotesPanelProps> = ({ activeChat, activeLead, contextType }) => {
  const [manualNotes, setManualNotes] = useState('');
  const [aiSummary, setAiSummary] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const isWhatsapp = contextType === 'whatsapp';
  const targetEntity = isWhatsapp ? activeChat : activeLead;

  // Carrega as informações atuais quando a entidade muda
  useEffect(() => {
    if (targetEntity) {
      setManualNotes(targetEntity.manual_notes || '');
      setAiSummary(targetEntity.ai_summary || '');
    } else {
      setManualNotes('');
      setAiSummary('');
    }
  }, [targetEntity]);

  const handleGenerateSummary = async () => {
    if (!targetEntity || !isWhatsapp) return; // Atualmente só geramos para whatsapp

    setIsGenerating(true);
    try {
      const response = await generateAiProfile(targetEntity.id);
      if (response && response.summary) {
        setAiSummary(response.summary);
        
        // Atualiza a prop localmente para refletir sem recarregar a lista toda
        targetEntity.ai_summary = response.summary;
      }
    } catch (error: any) {
      console.error('Erro ao gerar resumo:', error);
      alert(error.message || 'Não foi possível gerar o resumo. Tente novamente mais tarde.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!targetEntity || !isWhatsapp) return; // Atualmente só salvamos no BD se for whatsapp
    
    setIsSaving(true);
    try {
      await updateManualNotes(targetEntity.id, manualNotes);
      targetEntity.manual_notes = manualNotes;
    } catch (error: any) {
      console.error('Erro ao salvar anotações:', error);
      alert(error.message || 'Não foi possível salvar as anotações.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!targetEntity) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-50 text-slate-400 p-6 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
          <FileText size={32} className="opacity-20" />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-widest leading-relaxed">
          Selecione {isWhatsapp ? 'um chat' : 'um lead'} para<br/>ver as anotações
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50 font-sans overflow-hidden">
      
      {/* HEADER */}
      <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center shadow-md shadow-amber-100">
            <FileText size={16} className="text-white" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-slate-800 tracking-tight">Dossiê e Anotações</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {isWhatsapp ? targetEntity.pushName || targetEntity.remoteJid?.split('@')[0] : targetEntity.empresa}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        
        {/* BLOCO IA SUMMARY */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-indigo-600" />
              <h3 className="font-bold text-sm text-indigo-900">Resumo Inteligente (IA)</h3>
            </div>
            {isWhatsapp && (
              <button 
                onClick={handleGenerateSummary}
                disabled={isGenerating}
                className="text-xs font-bold bg-white text-indigo-600 px-3 py-1.5 rounded-lg shadow-sm border border-indigo-100 hover:bg-indigo-50 hover:border-indigo-200 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {isGenerating ? (
                  <><Loader2 size={12} className="animate-spin" /> Gerando...</>
                ) : (
                  <><RefreshCw size={12} /> Atualizar</>
                )}
              </button>
            )}
          </div>
          
          <div className="p-5">
            {!aiSummary ? (
              <div className="text-center py-6 text-slate-400">
                <Target size={24} className="mx-auto mb-2 opacity-30" />
                <p className="text-xs font-medium">Nenhum dossiê gerado ainda.</p>
                <p className="text-[10px] mt-1">Clique em Atualizar para a IA analisar o histórico.</p>
              </div>
            ) : (
              <div className="text-xs text-slate-700 leading-relaxed markdown-summary">
                <ReactMarkdown
                  components={{
                    h3: ({node, ...props}) => <h3 className="text-xs font-black text-slate-800 mt-4 mb-2 uppercase tracking-wider flex items-center gap-1.5 before:content-[''] before:w-1.5 before:h-1.5 before:bg-indigo-400 before:rounded-full" {...props} />,
                    p: ({node, ...props}) => <p className="mb-3" {...props} />,
                    ul: ({node, ...props}) => <ul className="space-y-1.5 mb-3" {...props} />,
                    li: ({node, ...props}) => <li className="flex items-start gap-2 before:content-[''] before:w-1 before:h-1 before:bg-slate-300 before:rounded-full before:mt-1.5" {...props} />
                  }}
                >
                  {aiSummary}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </div>

        {/* BLOCO ANOTAÇÕES MANUAIS */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[280px]">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 rounded-t-2xl">
            <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
              <User size={16} className="text-amber-500" />
              Anotações do Vendedor
            </h3>
            {isWhatsapp && (
              <button 
                onClick={handleSaveNotes}
                disabled={isSaving}
                className="text-xs font-bold bg-amber-500 text-white px-3 py-1.5 rounded-lg shadow-sm shadow-amber-200 hover:bg-amber-600 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSaving ? (
                  <><Loader2 size={12} className="animate-spin" /> Salvando...</>
                ) : (
                  <><Save size={12} /> Salvar</>
                )}
              </button>
            )}
          </div>
          
          <textarea
            value={manualNotes}
            onChange={(e) => setManualNotes(e.target.value)}
            placeholder="Digite aqui observações sobre o cliente, formas de entrega, descontos prometidos..."
            className="flex-1 w-full p-5 text-xs text-slate-700 bg-transparent resize-none focus:outline-none placeholder:text-slate-300"
          />
        </div>

      </div>
    </div>
  );
};

export default ClientNotesPanel;
