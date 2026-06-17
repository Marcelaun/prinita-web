setTimeout(() => {
  if (document.getElementById('printia-wrapper')) return;

  let isLoading = false;
  let selectedMessagesContext = []; 
  let isCaptureMode = false;
  
  // =========================================================================
  // 👤 SISTEMA DE LOGIN / IDENTIFICAÇÃO DO VENDEDOR NA EXTENSÃO
  // =========================================================================
  const getVendedorLogado = () => {
    const salvo = localStorage.getItem('printia_ext_vendedor');
    return salvo ? JSON.parse(salvo) : null;
  };

  const setVendedorLogado = (nome, cpf) => {
    const perfil = { name: nome, cpf: cpf };
    localStorage.setItem('printia_ext_vendedor', JSON.stringify(perfil));
    return perfil;
  };

  const logoutVendedor = () => {
    localStorage.removeItem('printia_ext_vendedor');
    document.getElementById('view-setup').style.display = 'flex';
    document.getElementById('app-content').style.display = 'none';
    document.getElementById('nome-vendedor-header').style.display = 'none';
  };

  // =========================================================================
  // 🕵️ LEITOR DE CONTATOS DO WHATSAPP (A ETIQUETA DA GAVETA)
  // =========================================================================
  const getActiveWhatsAppContact = () => {
    try {
      const headerTitle = document.querySelector('#main header span[dir="auto"][title]') || 
                          document.querySelector('#main header span[title]');
      if (headerTitle) {
        return {
          empresa: headerTitle.getAttribute('title') || headerTitle.innerText,
          telefone: "N/A", itens: [], observacoes: "Lead via WhatsApp.",
          enriched: { capital: "Desconhecido", fundacao: "Desconhecida", perfil_ia: "Novo Lead dinâmico" }
        };
      }
    } catch (e) { console.error("Erro ao ler contato", e); }
    return { empresa: "Cliente Desconhecido", telefone: "", itens: [], observacoes: "", enriched: {} };
  };

  const wrapper = document.createElement('div');
  wrapper.id = 'printia-wrapper';

  const floatingBtn = document.createElement('button');
  floatingBtn.id = 'printia-floating-btn';
  floatingBtn.innerHTML = '✨';

  const panel = document.createElement('div');
  panel.id = 'printia-sidebar-injected';
  
  panel.innerHTML = `
    <div id="printia-header" style="background-color: #312e81; color: white; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center;">
      <h1 style="margin: 0; font-size: 14px; font-weight: bold; display: flex; align-items: center; gap: 8px;">✨ PrintIA Copilot</h1>
      <div style="display: flex; align-items: center; gap: 10px;">
        <span id="nome-vendedor-header" style="font-size: 10px; background: #4f46e5; padding: 2px 6px; border-radius: 4px; display: none;"></span>
        <button id="printia-close-btn" style="background: none; border: none; color: white; cursor: pointer; font-size: 14px;">✖</button>
      </div>
    </div>

    <div id="view-setup" style="display: flex; flex-direction: column; padding: 30px 20px; height: calc(100% - 45px); background: #f8fafc; align-items: center; text-align: center;">
      <div style="font-size: 40px; margin-bottom: 10px;">🚀</div>
      <h2 style="color: #1e293b; font-size: 18px; margin: 0 0 10px 0;">Bem-vindo ao PrintIA!</h2>
      <p style="color: #64748b; font-size: 12px; margin-bottom: 25px;">Para o seu histórico ser salvo corretamente, identifique-se.</p>
      
      <div style="width: 100%; max-width: 300px; display: flex; flex-direction: column; gap: 15px; text-align: left;">
        <div>
          <label style="font-size: 11px; font-weight: bold; color: #475569; margin-bottom: 5px; display: block;">Seu Nome Completo</label>
          <input type="text" id="setup-nome" placeholder="Ex: Hudson Silva" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1; outline: none; box-sizing: border-box;">
        </div>
        <div>
          <label style="font-size: 11px; font-weight: bold; color: #475569; margin-bottom: 5px; display: block;">Seu CPF (Somente números)</label>
          <input type="text" id="setup-cpf" placeholder="Ex: 11806383608" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1; outline: none; box-sizing: border-box;">
        </div>
        <button id="btn-salvar-setup" style="background: #4f46e5; color: white; border: none; padding: 12px; border-radius: 8px; font-weight: bold; cursor: pointer; margin-top: 10px;">
          Começar a Vender ✨
        </button>
      </div>
    </div>

    <div id="app-content" style="display: none; height: calc(100% - 45px);">
      
      <div style="width: 60px; background: #f8fafc; border-right: 1px solid #e2e8f0; display: flex; flex-direction: column; align-items: center; padding: 10px 0; gap: 15px;">
        <button class="nav-btn active" data-target="view-home" title="Início" style="background: #e0e7ff; color: #4f46e5; border: none; border-radius: 10px; width: 40px; height: 40px; font-size: 18px; cursor: pointer; transition: 0.2s;">🏠</button>
        <button class="nav-btn" data-target="view-pesquisa" title="Smart Chat" style="background: transparent; color: #64748b; border: none; border-radius: 10px; width: 40px; height: 40px; font-size: 18px; cursor: pointer; transition: 0.2s;">💬</button>
        <button class="nav-btn" data-target="view-chat" title="Quebra Objeção" style="background: transparent; color: #64748b; border: none; border-radius: 10px; width: 40px; height: 40px; font-size: 18px; cursor: pointer; transition: 0.2s;">⚡</button>
        <button class="nav-btn" data-target="view-corretor" title="Corretor Mágico" style="background: transparent; color: #64748b; border: none; border-radius: 10px; width: 40px; height: 40px; font-size: 18px; cursor: pointer; transition: 0.2s;">✍️</button>
        
        <div style="flex: 1;"></div>
        <button id="btn-logout" title="Sair / Trocar Usuário" style="background: #fee2e2; color: #ef4444; border: none; border-radius: 10px; width: 40px; height: 40px; font-size: 18px; cursor: pointer; margin-bottom: 5px;">🚪</button>
        <div style="width: 30px; height: 1px; background: #cbd5e1; margin: 5px 0;"></div>
        <a href="http://localhost:5173" target="_blank" title="Abrir CRM Web" style="text-decoration: none; background: #10b981; color: white; border: none; border-radius: 10px; width: 40px; height: 40px; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.2);">🖥️</a>
      </div>

      <div style="flex: 1; position: relative; background: white; overflow: hidden;">
        
        <div id="view-home" class="view-screen" style="padding: 20px; height: 100%; overflow-y: auto;">
          <h2 style="font-size: 16px; color: #1e293b; margin-top: 0;">Ferramentas Rápidas</h2>
          <p style="font-size: 12px; color: #64748b; margin-bottom: 20px;">O que você precisa resolver agora?</p>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="nav-btn" data-target="view-pesquisa" style="border: 1px solid #e2e8f0; padding: 15px; border-radius: 12px; cursor: pointer;" onmouseover="this.style.borderColor='#4f46e5'" onmouseout="this.style.borderColor='#e2e8f0'">
              <div style="font-size: 24px; margin-bottom: 8px;">💬</div><strong style="font-size: 12px;">Smart Chat</strong>
            </div>
            <div class="nav-btn" data-target="view-chat" style="border: 1px solid #e2e8f0; padding: 15px; border-radius: 12px; cursor: pointer;" onmouseover="this.style.borderColor='#4f46e5'" onmouseout="this.style.borderColor='#e2e8f0'">
              <div style="font-size: 24px; margin-bottom: 8px;">⚡</div><strong style="font-size: 12px;">Quebra Objeção</strong>
            </div>
            <div class="nav-btn" data-target="view-corretor" style="border: 1px solid #e2e8f0; padding: 15px; border-radius: 12px; cursor: pointer; grid-column: span 2;" onmouseover="this.style.borderColor='#4f46e5'" onmouseout="this.style.borderColor='#e2e8f0'">
              <div style="font-size: 24px; margin-bottom: 8px;">✍️</div><strong style="font-size: 12px;">Corretor de Texto</strong>
              <p style="font-size: 10px; color: #64748b; margin: 4px 0 0 0;">Lê a caixa do WhatsApp e melhora o português.</p>
            </div>
          </div>
        </div>

        <div id="view-pesquisa" class="view-screen" style="display: none; flex-direction: column; height: 100%; background: #f8fafc;">
          <div style="padding: 10px 15px; background: white; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between;">
            <button id="btn-toggle-capture" style="background: #10b981; color: white; border: none; padding: 8px 12px; border-radius: 8px; font-weight: bold; cursor: pointer;">🎯 Capturar Msgs</button>
            <button id="btn-clear-smart" title="Limpar" style="background: #f1f5f9; border: 1px solid #cbd5e1; padding: 8px; border-radius: 8px; cursor: pointer;">🧹</button>
          </div>
          <div id="capture-status" style="display: none; font-size: 11px; color: #475569; background: #e0e7ff; padding: 8px 15px;"></div>
          <div id="printia-pesquisa-content" style="flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 16px;">
            <div class="printia-msg-container bot"><div class="printia-avatar">💬</div><div class="printia-bubble">Ligue a captura, clique nas mensagens do cliente e tire sua dúvida!</div></div>
          </div>
          <div style="padding: 15px; background: white; border-top: 1px solid #e2e8f0; display: flex; gap: 10px;">
            <input type="text" id="printia-pesquisa-input" placeholder="Ex: Crie um resumo disto..." style="flex: 1; padding: 12px; border-radius: 12px; border: 1px solid #cbd5e1; outline: none;">
            <button id="printia-pesquisa-send" style="background: #4f46e5; color: white; border: none; border-radius: 12px; padding: 0 16px; cursor: pointer; font-weight: bold;">Enviar</button>
          </div>
        </div>

        <div id="view-chat" class="view-screen" style="display: none; flex-direction: column; height: 100%; background: #f8fafc;">
          <div style="padding: 10px 15px; background: white; border-bottom: 1px solid #e2e8f0; text-align: right;">
            <button id="btn-clear-chat" title="Limpar Chat" style="background: #f1f5f9; border: 1px solid #cbd5e1; padding: 8px; border-radius: 8px; cursor: pointer;">🧹 Limpar Chat</button>
          </div>
          <div id="printia-chat-content" style="flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 16px;">
            <div class="printia-msg-container bot"><div class="printia-avatar">⚡</div><div class="printia-bubble">Cole a objeção do cliente aqui para eu destrinchar!</div></div>
          </div>
          <div style="padding: 15px; background: white; border-top: 1px solid #e2e8f0; display: flex; gap: 10px;">
            <input type="text" id="printia-chat-input" placeholder="Cole a objeção aqui..." style="flex: 1; padding: 12px; border-radius: 12px; border: 1px solid #cbd5e1; outline: none;">
            <button id="printia-chat-send" style="background: #4f46e5; color: white; border: none; border-radius: 12px; padding: 0 16px; cursor: pointer; font-weight: bold;">Enviar</button>
          </div>
        </div>

        <div id="view-corretor" class="view-screen" style="display: none; flex-direction: column; height: 100%; background: #f8fafc;">
          <div style="padding: 20px; text-align: center; border-bottom: 1px solid #e2e8f0; background: white;">
            <h3 style="margin: 0 0 10px 0; color: #1e293b; font-size: 15px;">✍️ Corretor Mágico</h3>
            <p style="font-size: 11px; color: #64748b; margin-bottom: 15px;">Digite de qualquer jeito no WhatsApp e clique no botão abaixo para puxar o texto e corrigir.</p>
            <button id="btn-puxar-corrigir" style="width: 100%; background: #4f46e5; color: white; border: none; padding: 12px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s;">
              Puxar texto do WhatsApp 📥
            </button>
          </div>
          <div id="corretor-resultado-area" style="flex: 1; padding: 20px; overflow-y: auto; display: none;">
            <div style="font-size: 11px; font-weight: bold; color: #64748b; margin-bottom: 5px;">Texto Corrigido:</div>
            <div id="corretor-texto-final" style="background: white; border: 1px solid #cbd5e1; padding: 15px; border-radius: 8px; font-size: 13px; color: #334155; line-height: 1.5; min-height: 80px;"></div>
            <button id="btn-injetar-zap" style="width: 100%; background: #10b981; color: white; border: none; padding: 12px; border-radius: 8px; font-weight: bold; cursor: pointer; margin-top: 15px; display: flex; align-items: center; justify-content: center;">
              Substituir no WhatsApp 📤
            </button>
          </div>
          <div id="corretor-loading" style="display: none; flex: 1; align-items: center; justify-content: center; flex-direction: column; gap: 10px;">
            <div style="font-size: 30px; animation: bounce 1s infinite;">🤖</div>
            <div style="font-size: 12px; color: #4f46e5; font-weight: bold;">Reescrevendo texto...</div>
          </div>
        </div>

      </div>
    </div>
  `;

  wrapper.appendChild(floatingBtn);
  wrapper.appendChild(panel);
  document.body.appendChild(wrapper);

  // =========================================================================
  // INICIALIZAÇÃO E EVENTOS DE LOGIN
  // =========================================================================
  const initApp = () => {
    const vendedor = getVendedorLogado();
    if (vendedor) {
      document.getElementById('view-setup').style.display = 'none';
      document.getElementById('app-content').style.display = 'flex';
      const labelNome = document.getElementById('nome-vendedor-header');
      labelNome.style.display = 'block';
      labelNome.innerText = vendedor.name.split(' ')[0];
    } else {
      document.getElementById('view-setup').style.display = 'flex';
      document.getElementById('app-content').style.display = 'none';
      document.getElementById('nome-vendedor-header').style.display = 'none';
    }
  };

  const togglePanel = () => {
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) initApp();
  };
  
  floatingBtn.addEventListener('click', togglePanel);
  document.getElementById('printia-close-btn').addEventListener('click', togglePanel);

  document.getElementById('btn-salvar-setup').addEventListener('click', () => {
    const nome = document.getElementById('setup-nome').value.trim();
    const cpf = document.getElementById('setup-cpf').value.replace(/\D/g, '');
    if (!nome || !cpf) return alert('Preencha Nome e CPF!');
    setVendedorLogado(nome, cpf);
    initApp();
  });

  document.getElementById('btn-logout').addEventListener('click', logoutVendedor);

  // Navegação do Menu
  const navButtons = document.querySelectorAll('.nav-btn');
  const viewScreens = document.querySelectorAll('.view-screen');

  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      viewScreens.forEach(screen => screen.style.display = 'none');
      const targetScreen = document.getElementById(targetId);
      targetScreen.style.display = (targetId === 'view-home') ? 'block' : 'flex';

      document.querySelectorAll('.nav-btn').forEach(b => {
        if(b.parentElement.style.width === '60px') b.style.background = 'transparent';
      });
      if(btn.parentElement.style.width === '60px') btn.style.background = '#e0e7ff';
    });
  });

  // =========================================================================
  // LIMPEZA DE MEMÓRIA (A VASSOURA CHAMA A API PARA LIMPAR O NODEJS)
  // =========================================================================
  const clearMemory = async (type) => {
    const currentLead = getActiveWhatsAppContact();
    try {
      await fetch('http://localhost:3000/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          lead: currentLead, 
          message: "CLEAR_HISTORY", 
          mode: 'clear',
          vendedor: getVendedorLogado() // 🔥 INJETADO
        })
      });
    } catch (e) { console.error("Erro ao limpar backend", e); }

    if (type === 'smart') {
      document.getElementById('printia-pesquisa-content').innerHTML = `<div class="printia-msg-container bot"><div class="printia-avatar">💬</div><div class="printia-bubble">Chat limpo! Memória zerada.</div></div>`;
      selectedMessagesContext = [];
      document.getElementById('capture-status').style.display = 'none';
    } else {
      document.getElementById('printia-chat-content').innerHTML = `<div class="printia-msg-container bot"><div class="printia-avatar">⚡</div><div class="printia-bubble">Objeções limpas! Pode mandar a próxima.</div></div>`;
    }
  };

  document.getElementById('btn-clear-smart').addEventListener('click', () => clearMemory('smart'));
  document.getElementById('btn-clear-chat').addEventListener('click', () => clearMemory('chat'));

  // =========================================================================
  // CAPTURADOR DE MENSAGENS DO WHATSAPP (SMART CHAT)
  // =========================================================================
  const btnToggleCapture = document.getElementById('btn-toggle-capture');
  const captureStatus = document.getElementById('capture-status');

  const captureWhatsAppClick = (e) => {
    if (!isCaptureMode) return;
    if (e.target.closest('#printia-wrapper')) return;

    e.preventDefault(); e.stopPropagation();

    let text = e.target.innerText || e.target.textContent;
    if (text && text.trim().length > 0) {
      selectedMessagesContext.push(text.trim());
      captureStatus.style.display = 'block';
      captureStatus.innerHTML = `<strong>${selectedMessagesContext.length} msg(s) capturada(s).</strong>`;
      e.target.style.transition = "0.2s"; e.target.style.backgroundColor = "#e0e7ff";
      setTimeout(() => e.target.style.backgroundColor = "transparent", 500);
    }
  };

  btnToggleCapture.addEventListener('click', () => {
    isCaptureMode = !isCaptureMode;
    if (isCaptureMode) {
      btnToggleCapture.innerHTML = '🛑 Parar Captura'; btnToggleCapture.style.background = '#ef4444';
      document.body.style.cursor = 'crosshair'; document.addEventListener('click', captureWhatsAppClick, true);
    } else {
      btnToggleCapture.innerHTML = '🎯 Capturar Msgs'; btnToggleCapture.style.background = '#10b981';
      document.body.style.cursor = 'default'; document.removeEventListener('click', captureWhatsAppClick, true);
    }
  });

  // =========================================================================
  // ENVIOS PARA O SERVIDOR (SMART CHAT & QUEBRA OBJEÇÃO)
  // =========================================================================
  const formatMarkdown = (text) => text.replace(/### (.*?)\n/g, '<h3 style="color:#312e81; margin:15px 0 5px 0; font-size:14px; border-bottom:1px solid #e2e8f0; padding-bottom:3px;">$1</h3>').replace(/\*\*(.*?)\*\*/g, '<strong style="color:#4338ca; background:#e0e7ff; padding:0 4px; border-radius:4px;">$1</strong>').replace(/> (.*?)\n/g, '<blockquote style="border-left:4px solid #10b981; background:#ecfdf5; color:#065f46; padding:10px; border-radius:0 8px 8px 0; font-style:italic; margin:10px 0;">$1</blockquote>').replace(/\n/g, '<br>');

  const sendToBackend = async (inputId, contentId, modeType) => {
    const input = document.getElementById(inputId);
    const content = document.getElementById(contentId);
    const text = input.value.trim();
    if (!text || isLoading) return;

    content.innerHTML += `<div class="printia-msg-container user"><div class="printia-bubble">${text}</div></div>`;
    input.value = ''; isLoading = true;

    let contextoAdicional = "";
    if (modeType === 'vendedor' && selectedMessagesContext.length > 0) {
      contextoAdicional = `\n\n[MENSAGENS CAPTURADAS DA TELA]:\n` + selectedMessagesContext.map(msg => `"${msg}"`).join('\n');
    }

    const currentLead = getActiveWhatsAppContact();
    const promptFinal = text + contextoAdicional;

    const loadingId = 'load-' + Date.now();
    content.innerHTML += `<div id="${loadingId}" class="printia-msg-container bot"><div class="printia-avatar">🤖</div><div class="printia-bubble"><div class="printia-loading"><div class="printia-dot"></div><div class="printia-dot"></div><div class="printia-dot"></div></div></div></div>`;
    content.scrollTop = content.scrollHeight;

    try {
      const response = await fetch('http://localhost:3000/api/copilot', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          lead: currentLead, 
          message: promptFinal, 
          mode: modeType,
          vendedor: getVendedorLogado() // 🔥 INJETADO
        })
      });
      const data = await response.json();
      const loader = document.getElementById(loadingId);
      if (loader) loader.remove();
      content.innerHTML += `<div class="printia-msg-container bot"><div class="printia-avatar">🤖</div><div class="printia-bubble">${formatMarkdown(data.reply)}</div></div>`;
      
      if (modeType === 'vendedor') {
        selectedMessagesContext = []; document.getElementById('capture-status').style.display = 'none';
      }
    } catch (e) {
      const loader = document.getElementById(loadingId);
      if (loader) loader.remove();
      content.innerHTML += `<div class="printia-msg-container bot"><div class="printia-avatar">❌</div><div class="printia-bubble" style="color:red;">Erro de conexão com o servidor. Verifique se o Node.js está rodando.</div></div>`;
    } finally {
      isLoading = false; content.scrollTop = content.scrollHeight;
    }
  };

  document.getElementById('printia-pesquisa-send').addEventListener('click', () => sendToBackend('printia-pesquisa-input', 'printia-pesquisa-content', 'vendedor'));
  document.getElementById('printia-pesquisa-input').addEventListener('keypress', (e) => { if (e.key === 'Enter') sendToBackend('printia-pesquisa-input', 'printia-pesquisa-content', 'vendedor'); });

  document.getElementById('printia-chat-send').addEventListener('click', () => sendToBackend('printia-chat-input', 'printia-chat-content', 'cliente'));
  document.getElementById('printia-chat-input').addEventListener('keypress', (e) => { if (e.key === 'Enter') sendToBackend('printia-chat-input', 'printia-chat-content', 'cliente'); });

  // =========================================================================
  // ✍️ CORRETOR MÁGICO
  // =========================================================================
  let waInputBox = null; let textoCorrigidoMemoria = "";
  document.getElementById('btn-puxar-corrigir').addEventListener('click', async () => {
    waInputBox = document.querySelector('footer div[contenteditable="true"]') || document.querySelector('#main div[contenteditable="true"]');
    if (!waInputBox || !waInputBox.innerText.trim()) return alert("⚠️ Digite algo no WhatsApp primeiro!");

    document.getElementById('btn-puxar-corrigir').style.display = 'none';
    document.getElementById('corretor-resultado-area').style.display = 'none';
    document.getElementById('corretor-loading').style.display = 'flex';

    try {
      const response = await fetch('http://localhost:3000/api/copilot', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          lead: getActiveWhatsAppContact(), 
          message: `Atue como um corretor ortográfico sênior. Corrija a gramática e melhore levemente o tom da seguinte mensagem: "${waInputBox.innerText.trim()}". Retorne APENAS o texto corrigido, sem aspas.`, 
          mode: 'vendedor',
          vendedor: getVendedorLogado() // 🔥 INJETADO
        })
      });
      const data = await response.json();
      textoCorrigidoMemoria = data.reply.trim();
      document.getElementById('corretor-texto-final').innerText = textoCorrigidoMemoria;
      
      document.getElementById('corretor-loading').style.display = 'none';
      document.getElementById('corretor-resultado-area').style.display = 'block';
      document.getElementById('btn-puxar-corrigir').style.display = 'block';
      document.getElementById('btn-puxar-corrigir').innerText = "Puxar outro texto";
    } catch (e) {
      console.error(e);
      document.getElementById('corretor-loading').style.display = 'none';
      document.getElementById('corretor-resultado-area').style.display = 'block'; 
      document.getElementById('corretor-texto-final').innerHTML = '<span style="color:red;">Erro ao conectar com a IA. O servidor está rodando?</span>';
      document.getElementById('btn-puxar-corrigir').style.display = 'block';
      document.getElementById('btn-puxar-corrigir').innerText = "Tentar Novamente";
    }
  });

  document.getElementById('btn-injetar-zap').addEventListener('click', () => {
    if (!waInputBox || !textoCorrigidoMemoria) return;
    waInputBox.focus();
    document.execCommand('selectAll', false, null);
    document.execCommand('insertText', false, textoCorrigidoMemoria);
    const btnInjetar = document.getElementById('btn-injetar-zap');
    btnInjetar.innerHTML = "Substituído com sucesso! ✅"; btnInjetar.style.background = "#4f46e5";
    setTimeout(() => { btnInjetar.innerHTML = "Substituir no WhatsApp 📤"; btnInjetar.style.background = "#10b981"; }, 2000);
  });

}, 3000);