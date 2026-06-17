import type { Lead } from '../types/index';

export const mockLeads: Lead[] = [
  {
    id: "1776056451479",
    name: "Guilherme Alcântara Ferreira",
    initials: "GA",
    empresa: "SDG gráfica",
    cpf_cnpj: "70219798605",
    telefone: "33997054462",
    email: "guilhermealcantaraferreira@gmail.com",
    endereco: "Rua Hélio Ferreira Flores",
    itens: [
      { produto: "Cartão", descricao: "1000", preco_concorrente: "200" }
    ],
    probabilidade: 7,
    observacoes: "O concorrente demora",
    vendedor: "Marcelo Almeida Barbosa",
    status: 'aguardando',
    enriched: {
      capital: "R$ 50.000,00",
      fundacao: "Aprox. 4 anos"
    },
    historico_compras: [],
    history: []
  },
  {
    id: "1776056784415",
    name: "Laura Alcântara",
    initials: "LA",
    empresa: "Lucas venda s",
    cpf_cnpj: "5531991151126",
    telefone: "333949464949",
    email: "hsjababa",
    endereco: "Haisnsksn",
    itens: [
      { produto: "Bloco", descricao: "Sbnsbsbsh", preco_concorrente: "1000" }
    ],
    probabilidade: 8,
    observacoes: "Snaibbs (cliente exigente)",
    vendedor: "Marcelo Almeida Barbosa",
    status: 'aguardando',
    enriched: {
      capital: "R$ 20.000,00",
      fundacao: "Aprox. 2 anos"
    },
    historico_compras: [],
    history: []
  },
  {
    id: "1776065915833",
    name: "Fuuuuuu",
    initials: "FU",
    empresa: "Yoy3qccf",
    cpf_cnpj: "70219798605",
    telefone: "33997054462",
    email: "a njfwwggg",
    endereco: "Tytsshjjjj",
    itens: [
      { produto: "Bloco", descricao: "Fhf11wss", preco_concorrente: "100" }
    ],
    probabilidade: 8,
    observacoes: "Rrtxxvkjewdfg que eu l",
    vendedor: "Guilherme Alcantara Ferreira",
    status: 'aguardando',
    enriched: {
      capital: "R$ 10.000,00",
      fundacao: "Recém aberta"
    },
    historico_compras: [],
    history: []
  },
  {
    id: "1776085330819",
    name: "Ahabah",
    initials: "AH",
    empresa: "uaha",
    cpf_cnpj: "70219798605",
    telefone: "46494349461",
    email: "whhsshbs",
    endereco: "Syshhshss",
    itens: [
      { produto: "Cartão", descricao: "1000 cartões ", preco_concorrente: "250.00" },
      { produto: "Bloco", descricao: "10 blocos peguemos ", preco_concorrente: "100" }
    ],
    probabilidade: 7,
    observacoes: "Sbehebz",
    vendedor: "Valéria Tupy da Fonseca Naves",
    status: 'aguardando',
    enriched: {
      capital: "R$ 15.000,00",
      fundacao: "Não informada"
    },
    historico_compras: [],
    history: []
  },
  {
    id: "1776176079646",
    name: "Thiago Almeida",
    initials: "TA",
    empresa: "GD importação",
    cpf_cnpj: "94680764316",
    telefone: "3399645810",
    email: "contatomarceloalmeidabarbosa@gmail.com",
    endereco: "Teste teste",
    itens: [
      { produto: "Cartão", descricao: "100 cartões ", preco_concorrente: "500" }
    ],
    probabilidade: 5,
    observacoes: "Teste teste",
    vendedor: "Marcelo Almeida Barbosa",
    status: 'aguardando',
    enriched: {
      capital: "R$ 100.000,00",
      fundacao: "Aprox. 6 anos"
    },
    historico_compras: [],
    history: []
  }
];
