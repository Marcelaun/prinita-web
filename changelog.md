# Changelog - PrintIA CRM & Backend

Este documento registra as principais implementações feitas até o momento no sistema.

## 🚀 Novas Funcionalidades
- **Painel de Produção (Kanban)**
  - Criação da tela de Fábrica/Produção (`ProductionBoard.tsx`).
  - Arrastar e soltar cards de pedidos entre status: "Na Fila", "Produzindo", "Pronto", "Entregue".
  - Atualização em tempo real (Realtime) via Supabase quando novos pedidos são recebidos.
  - Modal detalhado de visualização da Ordem de Serviço (OS).

- **Gestão de Perfis de Acesso (RBAC)**
  - Adição do perfil `producao` ao sistema.
  - Tela de login configurada para direcionar usuários da "Produção" diretamente para o Painel Kanban, ocultando chats do WhatsApp.
  - Atualização da Check Constraint (`usuarios_role_check`) no banco de dados para aceitar o novo perfil.

- **Inteligência Artificial na Produção**
  - Implementação de endpoint no backend (`/api/ai/gerar-ordem-servico`) que utiliza Gemini AI.
  - Botão "Enviar para Produção" no `QuoteBuilderPanel`.
  - A IA extrai apenas informações técnicas e de maquinário da conversa com o cliente, ocultando valores e histórico comercial da equipe de fábrica.

- **Visualização de Mídia (WhatsApp)**
  - Produção consegue visualizar os arquivos originais e fotos enviados pelo cliente em modo Somente Leitura (Sem risco de envio acidental).
  - Configuração de um Storage Bucket (`whatsapp_media`) no Supabase para salvar documentos PDF e Imagens localmente e exibi-los no Frontend.

## 🛠 Correções e Ajustes
- **Backend:** 
  - Resolvido erro de parsing de string literals e injeções no `server.js`.
  - Corrigido mapeamento de campos (de `produto.titulo` para `titulo` direto do array do carrinho).
  - Rotas reorganizadas para evitar bloqueio pelo Middleware de `404 Not Found`.
- **Frontend:** 
  - Ajustada a base da URL da API em `api.ts` para evitar duplicação de rota (`/api/api/`).
  - Mapeamento correto de metadados do Supabase (`created_at` e `from_me`) para exibição do chat histórico na Produção.
