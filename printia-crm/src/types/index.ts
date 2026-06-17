export type LeadStatus = 'aguardando' | 'enviado' | 'aprovado';

export interface BudgetItem {
  produto: string;
  descricao: string;
  preco_concorrente: string;
}

export interface ChatMessage {
  isCustomer: boolean;
  text: string;
  timestamp: string;
}

export interface PastPurchase {
  data: string;
  itens: string;
  valor_total: number;
}

export interface Lead {
  id: string;
  name: string;
  initials: string;
  empresa: string;
  cpf_cnpj: string;
  telefone: string;
  email: string;
  endereco: string;
  itens: BudgetItem[];
  probabilidade: number;
  observacoes: string;
  vendedor: string;
  status: LeadStatus;
  atendido_por?: string | null;
  enriched: {
    capital: string;
    fundacao: string;
  };
  historico_compras: PastPurchase[];
  history: ChatMessage[];
}
