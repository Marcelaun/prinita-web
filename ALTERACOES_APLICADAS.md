# Registro de Alterações Aplicadas - PrintIA CRM
**Data:** 5 de Junho de 2026

Hoje realizamos uma série de melhorias críticas na estabilidade, segurança e usabilidade do sistema de WhatsApp integrado ao CRM. Abaixo estão os detalhes das implementações:

## 1. Estabilidade e Resgate de Dados (Fallback)
- **Lógica de Resgate de IDs:** Implementado sistema de "fallback" para contatos identificados com ID temporário (`@lid`). Se a busca falhar ou retornar vazia, o sistema agora tenta automaticamente pelo número oficial (`@s.whatsapp.net`).
- **Sincronização Profunda:** Adicionado o endpoint `/load-history` que realiza uma busca de até 100 mensagens retroativas sempre que uma conversa é aberta, garantindo que o histórico não fique incompleto.

## 2. Refatoração "Número-Cêntrica" e Isolamento
- **Proteção do Dono (Owner Protection):** Implementada trava de segurança que identifica o número da própria instância. Isso impede que as mensagens da sua conta pessoal se misturem com as de clientes.
- **Isolamento de Conversas:** Refatoração completa no mapeamento de mensagens. Agora, cada conversa é isolada estritamente pelo seu identificador único, eliminando o problema de mensagens "vazando" de um contato para outro.
- **Filtro de Grupos:** Implementado bloqueio rigoroso de mensagens de grupos e atualizações de status, mantendo o CRM focado exclusivamente em atendimento 1-on-1 (Leads).

## 3. Experiência de Usuário (UX) e Tempo Real
- **Notificações de Mensagens Não Lidas:** Adicionada a "bolinha verde" na barra lateral com a contagem exata de mensagens pendentes por contato.
- **Status "Digitando...":** Integração com o evento `presence.update` para exibir um aviso animado quando o cliente está escrevendo no WhatsApp.
- **Confirmação de Leitura (Vistos):** Implementação dos ícones de status (✓, ✓✓ cinza e ✓✓ azul) refletindo o status real da mensagem no WhatsApp do cliente.
- **Busca Aprimorada:** O campo de busca na barra lateral agora aceita tanto nomes de contatos quanto números de telefone (com formatação flexível).

## 4. Melhorias Técnicas (Backend & Frontend)
- **Captions de Mídia:** O sistema agora extrai e exibe legendas de fotos, vídeos e documentos, além de identificar o tipo de mídia recebida (📷, 🎥, 🎵, etc).
- **Consolidação de Duplicados:** Script de limpeza profunda que unifica registros de chats que possuam o mesmo número de telefone, priorizando o JID oficial.
- **Realtime Robusto:** Otimização das inscrições do Supabase para evitar "race conditions" ao trocar de chat rapidamente, garantindo que as mensagens apareçam sempre no lugar certo.

---
*Este documento resume o estado atual da integração WhatsApp/CRM e serve como base para futuras manutenções.*
