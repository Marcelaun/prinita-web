import React, { useState } from 'react';
import { Bot, Package, FileText, Receipt } from 'lucide-react';
import AiCopilotPanel from '../ai/AiCopilotPanel';
import ProductCatalogPanel from '../tools/ProductCatalogPanel';
import ClientNotesPanel from '../tools/ClientNotesPanel';
import QuoteBuilderPanel from '../tools/QuoteBuilderPanel';

interface RightToolPanelProps {
  activeLead?: any;
  activeChat?: any;
  contextType?: string;
}

type TabType = 'copilot' | 'catalog' | 'notes' | 'quotes';

const RightToolPanel: React.FC<RightToolPanelProps> = ({ activeLead, activeChat, contextType }) => {
  const [activeTab, setActiveTab] = useState<TabType>('copilot');

  return (
    <div className="h-full flex bg-slate-50">
      {/* Vertical Icon Bar (Activity Bar) */}
      <div className="w-[60px] shrink-0 bg-white border-r border-slate-200 flex flex-col items-center py-4 gap-4 z-20">
        
        <div className="group relative">
          <button
            onClick={() => setActiveTab('copilot')}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
              activeTab === 'copilot' 
                ? 'bg-indigo-50 text-indigo-600 shadow-sm border border-indigo-100' 
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Bot size={22} className={activeTab === 'copilot' ? 'text-indigo-600' : ''} />
          </button>
          <div className="absolute left-14 top-1/2 -translate-y-1/2 px-2 py-1 bg-slate-800 text-white text-[11px] font-medium rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
            PrintIA Copilot
          </div>
        </div>

        <div className="group relative">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
              activeTab === 'catalog' 
                ? 'bg-emerald-50 text-emerald-600 shadow-sm border border-emerald-100' 
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Package size={22} className={activeTab === 'catalog' ? 'text-emerald-600' : ''} />
          </button>
          <div className="absolute left-14 top-1/2 -translate-y-1/2 px-2 py-1 bg-slate-800 text-white text-[11px] font-medium rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
            Catálogo
          </div>
        </div>

        <div className="group relative">
          <button
            onClick={() => setActiveTab('notes')}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
              activeTab === 'notes' 
                ? 'bg-amber-50 text-amber-600 shadow-sm border border-amber-100' 
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileText size={22} className={activeTab === 'notes' ? 'text-amber-600' : ''} />
          </button>
          <div className="absolute left-14 top-1/2 -translate-y-1/2 px-2 py-1 bg-slate-800 text-white text-[11px] font-medium rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
            Anotações
          </div>
        </div>

        <div className="group relative">
          <button
            onClick={() => setActiveTab('quotes')}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
              activeTab === 'quotes' 
                ? 'bg-rose-50 text-rose-600 shadow-sm border border-rose-100' 
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Receipt size={22} className={activeTab === 'quotes' ? 'text-rose-600' : ''} />
          </button>
          <div className="absolute left-14 top-1/2 -translate-y-1/2 px-2 py-1 bg-slate-800 text-white text-[11px] font-medium rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
            Orçamentos
          </div>
        </div>

      </div>

      {/* Tab Content Wrapper */}
      <div className="flex-1 overflow-hidden relative">
        <div className={`absolute inset-0 transition-opacity duration-200 ${activeTab === 'copilot' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
           <AiCopilotPanel activeLead={activeLead} activeChat={activeChat} contextType={contextType} />
        </div>
        
        <div className={`absolute inset-0 transition-opacity duration-200 ${activeTab === 'catalog' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
           <ProductCatalogPanel activeLead={activeLead} activeChat={activeChat} />
        </div>

        <div className={`absolute inset-0 transition-opacity duration-200 ${activeTab === 'notes' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
           <ClientNotesPanel activeLead={activeLead} activeChat={activeChat} contextType={contextType} />
        </div>
        
        <div className={`absolute inset-0 transition-opacity duration-200 ${activeTab === 'quotes' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
           <QuoteBuilderPanel activeLead={activeLead} activeChat={activeChat} />
        </div>
      </div>
    </div>
  );
};

export default RightToolPanel;
