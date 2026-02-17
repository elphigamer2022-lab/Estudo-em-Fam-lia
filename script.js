// ============================================================
// VARIÁVEIS DE ESTADO
// ============================================================
let localStream;
let currentOutputVolume = 0.5; 
let isAudioMuted = false;
let isVideoOff = false;
let secondsElapsed = 0;
let unreadCount = 0;
let isHandRaised = false;
let screenStream = null;
let chatRestricted = 'all';
let selectedReplyText = "";
let currentInputDeviceId = null;
// VARIÁVEIS DE ESTADO DO ÁUDIO
let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let timerInterval;
let recordedAudioUrl = null;

// ============================================================
// SISTEMA DE LOGIN E CONTROLE DE ACESSO
// ============================================================
function handleAuth(type) {
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    
    if (!emailInput || !passwordInput) return;

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (email === "teste@reunia.com" && password === "123456") {
        sessionStorage.setItem('isLogged', 'true');
        sessionStorage.setItem('userName', "Usuário Teste");
        
        if (document.getElementById('authBox')) {
            exibirInterfaceLogada("Usuário Teste");
        } else {
            window.location.href = 'sala.html';
        }
    } else {
        alert("E-mail ou senha incorretos.");
    }
}

function exibirInterfaceLogada(name) {
    const authBox = document.getElementById('authBox');
    const optionsBox = document.getElementById('optionsBox');
    const userStatus = document.getElementById('userStatus');

    if (authBox) authBox.style.display = 'none';
    if (optionsBox) optionsBox.style.display = 'block';
    if (userStatus) userStatus.innerText = `Logado como: ${name}`;
}

function logout() {
    sessionStorage.clear();
    window.location.href = 'index.html';
}

// Verifica login ao carregar a página index.html
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('authBox') && sessionStorage.getItem('isLogged') === 'true') {
        exibirInterfaceLogada(sessionStorage.getItem('userName'));
    }
});
// ============================================================
// TIMER DA REUNIÃO (REGRA: SEM LIMITE DE DURAÇÃO)
// ============================================================
function startMeetingTimer() {
    const timerElement = document.querySelector('.meeting-timer');
    if (!timerElement) return;

    setInterval(() => {
        secondsElapsed++;
        const h = Math.floor(secondsElapsed / 3600);
        const m = Math.floor((secondsElapsed % 3600) / 60).toString().padStart(2, '0');
        const s = (secondsElapsed % 60).toString().padStart(2, '0');
        timerElement.innerText = h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
    }, 1000);
}

// ============================================================
// CONTROLE DO CHAT (VERSÃO COMPLETA E FUNCIONAL)
// ============================================================
function toggleChat() {
    const chat = document.getElementById('chatSidebar');
    if (!chat) return;

    if (chat.style.display === "flex") {
        chat.style.display = "none";
    } else {
        chat.style.display = "flex";
        unreadCount = 0;
        updateBadge();
    }
}

function toggleEmojiPicker(event) {
    event.stopPropagation();
    const picker = document.getElementById('emojiPicker');
    picker.style.display = (picker.style.display === 'flex') ? 'none' : 'flex';
}

function toggleChatSettings(event) {
    event.stopPropagation();
    const menu = document.getElementById('chatSettingsMenu');
    menu.classList.toggle('show');
}

// Fecha tudo ao clicar fora do chat
window.addEventListener('click', () => {
    document.getElementById('emojiPicker').style.display = 'none';
    document.getElementById('chatSettingsMenu').classList.remove('show');
});

// Garante que ao clicar no emoji, ele feche o menu após inserir
function insertEmoji(emoji) {
    const input = document.getElementById('chatInput');
    if (input) {
        input.value += emoji;
        input.focus();
    }
    // Opcional: fechar o menu após escolher um emoji
    document.getElementById('emojiPicker').classList.remove('show');
}

// Fechar menus ao clicar fora
window.addEventListener('click', function(e) {
    const emojiPicker = document.getElementById('emojiPicker');
    const settingsMenu = document.getElementById('chatSettingsMenu');
    
    // Se clicar fora do picker e do botão de emoji, fecha
    if (emojiPicker && !e.target.closest('.chat-input-area')) {
        emojiPicker.classList.remove('show');
    }
    
    // Se clicar fora da engrenagem, fecha o menu de settings
    if (settingsMenu && !e.target.closest('.chat-header')) {
        settingsMenu.classList.remove('show');
    }
});
function toggleChatRestriction(level) {
    chatRestricted = level;
    const input = document.getElementById('chatInput');
    const btn = input.parentElement.querySelector('button');
    
    document.querySelectorAll('#chatSettingsMenu .menu-item').forEach(item => {
        item.classList.remove('checked');
    });
    
    if (level === 'none') {
        input.disabled = true;
        input.placeholder = "O anfitrião bloqueou o chat.";
        btn.disabled = true;
        document.getElementById('allowChatNone').classList.add('checked');
    } else {
        input.disabled = false;
        input.placeholder = "Enviar mensagem...";
        btn.disabled = false;
        document.getElementById(level === 'all' ? 'allowChatAll' : 'allowChatHost').classList.add('checked');
    }
    toggleChatSettings();
}

function clearChat() {
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
        chatMessages.innerHTML = '<div class="msg-system">O anfitrião limpou o histórico do chat.</div>';
    }
    toggleChatSettings();
}

function setReply(text) {
    selectedReplyText = text;
    const preview = document.getElementById('replyPreview');
    const previewText = document.getElementById('replyText');
    if (preview && previewText) {
        previewText.innerText = "Respondendo a: " + (text.substring(0, 30) + "...");
        preview.style.display = "flex";
        document.getElementById('chatInput').focus();
    }
}

function cancelReply() {
    selectedReplyText = "";
    const preview = document.getElementById('replyPreview');
    if (preview) preview.style.display = "none";
}

function sendMessage() {
    const input = document.getElementById('chatInput');
    const chatMessages = document.getElementById('chatMessages');
    const target = document.getElementById('chatTarget');

    if (!input || input.value.trim() === "") return;

    let texto = input.value;
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-z0-9.-]+\.[a-z]{2,4}[^\s]*)/gi;
    texto = texto.replace(urlRegex, (url) => {
        let fullUrl = url.startsWith('http') ? url : 'https://' + url;
        return `<a href="${fullUrl}" target="_blank" style="color: #fff; text-decoration: underline;">${url}</a>`;
    });

    const isPrivate = target ? target.value !== 'todos' : false;
    const agora = new Date();
    const hora = agora.getHours().toString().padStart(2, '0') + ":" + agora.getMinutes().toString().padStart(2, '0');

    const msgDiv = document.createElement('div');
    msgDiv.className = isPrivate ? 'msg-bubble private' : 'msg-bubble';

    let replyHTML = selectedReplyText ? `<div class="msg-reply-context">${selectedReplyText}</div>` : "";

    msgDiv.innerHTML = `
        ${replyHTML}
        <strong>Você ${isPrivate ? '(Privado)' : ''}:</strong><br>
        ${texto}
        <span class="msg-time" style="display:block; font-size:10px; opacity:0.7; margin-top:5px;">
            ${hora} <span class="reply-btn" onclick="setReply('${input.value.replace(/'/g, "\\'")}')" style="cursor:pointer; margin-left:10px; text-decoration:underline;">Responder</span>
        </span>
    `;

    chatMessages.appendChild(msgDiv);
    cancelReply();
    input.value = "";
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function insertEmoji(emoji) {
    const input = document.getElementById('chatInput');
    if (input) {
        input.value += emoji;
        input.focus();
    }
}

function updateBadge() {
    const badge = document.getElementById('chatNotification');
    if (badge) {
        if (unreadCount > 0) {
            badge.innerText = unreadCount;
            badge.style.display = 'block';
        } else {
            badge.style.display = 'none';
        }
    }
}

function sendFileNotification() {
    const chatMessages = document.getElementById('chatMessages');
    const msgDiv = document.createElement('div');
    msgDiv.className = 'msg-system';
    msgDiv.innerText = "Arquivo selecionado e pronto para envio (Simulação).";
    if (chatMessages) chatMessages.appendChild(msgDiv);
}

// ============================================================
// LÓGICA DE MÍDIA E CONTROLES
// ============================================================

function toggleAudio() {
    if (!localStream) return;

    // Se estiver silenciado e tentar ativar, verifica a permissão do host
    if (isAudioMuted && !securitySettings.unmute) {
        alert("O anfitrião desativou a permissão para ativar o som.");
        return;
    }

    isAudioMuted = !isAudioMuted;
    localStream.getAudioTracks()[0].enabled = !isAudioMuted;
    const btn = document.getElementById('audioBtn');
    const label = btn.parentElement.querySelector('span');
    btn.innerHTML = isAudioMuted ? '🔇' : '🎙️';
    btn.style.color = isAudioMuted ? '#ea4335' : '#fff';
    label.innerText = isAudioMuted ? 'Ativar Som' : 'Desativar Som';
}

function toggleVideo() {
    if (!localStream) return;

    // Se o vídeo estiver desligado e tentar ligar, verifica a permissão
    if (isVideoOff && !securitySettings.startVideo) {
        alert("O anfitrião desativou a permissão para iniciar vídeo.");
        return;
    }

    isVideoOff = !isVideoOff;
    localStream.getVideoTracks()[0].enabled = !isVideoOff;
    const btn = document.getElementById('videoBtn');
    const label = btn.parentElement.querySelector('span');
    const videoEl = document.getElementById('localVideo');
    btn.innerHTML = isVideoOff ? '❌' : '📹';
    btn.style.color = isVideoOff ? '#ea4335' : '#fff';
    label.innerText = isVideoOff ? 'Iniciar Vídeo' : 'Interromper Vídeo';
    if (videoEl) videoEl.style.opacity = isVideoOff ? "0" : "1";
}
async function toggleScreenShare() {
    const shareBtn = document.getElementById('shareBtn');
    const shareLabel = document.getElementById('shareLabel');
    const videoGrid = document.getElementById('videoGrid');
     
    // Verifica se o host permite o compartilhamento
    if (!screenStream && !securitySettings.share) {
        alert("O compartilhamento de tela foi desativado pelo anfitrião.");
        return;
    }

    if (!screenStream) {
        try {
            screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
            
            // INDISPENSÁVEL: Ativa o modo de layout especial no grid
            videoGrid.classList.add('screen-share-active'); 

            const screenContainer = document.createElement('div');
            screenContainer.className = 'video-container screen-share-content'; 
            screenContainer.id = 'screenShareContainer';
            
            const screenVideo = document.createElement('video');
            screenVideo.id = 'screenShareVideo';
            screenVideo.autoplay = true;
            screenVideo.playsinline = true;
            screenVideo.srcObject = screenStream;
            
            screenContainer.innerHTML = `<div class="user-label">Sua Tela</div>`;
            screenContainer.prepend(screenVideo);
            videoGrid.prepend(screenContainer);

            shareBtn.style.color = "#ea4335";
            shareLabel.innerText = "Parar Compartilhamento";
            screenStream.getVideoTracks()[0].onended = () => stopScreenShare();
        } catch (err) { console.error("Erro:", err); }
    } else { 
        stopScreenShare(); 
    }
}

function stopScreenShare() {
    if (screenStream) { 
        screenStream.getTracks().forEach(track => track.stop());
        screenStream = null;
    }
    const screenContainer = document.getElementById('screenShareContainer');
    if (screenContainer) screenContainer.remove();

    // Remove o modo de layout especial
    document.getElementById('videoGrid').classList.remove('screen-share-active');

    const shareBtn = document.getElementById('shareBtn');
    const shareLabel = document.getElementById('shareLabel');
    shareBtn.style.color = "#2D8CFF";
    shareLabel.innerText = "Compartilhar Tela";
}
// ============================================================
// FUNÇÃO QUE ESTAVA FALTANDO: updateAudioDeviceList
// ============================================================
async function updateAudioDeviceList() {
    const micList = document.getElementById('micList');
    if (!micList) return;

    try {
        // Busca os dispositivos
        const devices = await navigator.mediaDevices.enumerateDevices();
        // Filtra apenas microfones
        const mics = devices.filter(device => device.kind === 'audioinput');

        micList.innerHTML = ''; // Limpa a lista antes de preencher

        if (mics.length === 0) {
            micList.innerHTML = '<div class="menu-item" style="opacity:0.5;">Nenhum microfone encontrado</div>';
            return;
        }

        mics.forEach(mic => {
            const item = document.createElement('div');
            item.className = 'menu-item';
            
            // Se o microfone tiver nome (label), usamos ele. Se não, usamos um nome padrão.
            const label = mic.label || `Microfone ${micList.children.length + 1}`;
item.innerText = label;

// Adiciona uma classe visual se for o selecionado
if (mic.deviceId === currentInputDeviceId) {
    item.classList.add('checked');
}

item.onclick = () => {
    changeAudioInput(mic.deviceId);
    closeAllMenus(); // Fecha o menu após escolher
};
micList.appendChild(item);
        });
        
        console.log("Lista de microfones atualizada com sucesso.");
    } catch (err) {
        console.error("Erro ao listar microfones:", err);
    }
}

// ============================================================
// SISTEMA DE REAÇÕES (ADICIONAR ESTA FUNÇÃO)
// ============================================================
function sendReaction(emoji, userId = 'localPlayer') {
    // 1. Encontra o container do vídeo (seu ou de outro participante)
    const targetContainer = document.getElementById(userId);
    
    if (!targetContainer) {
        console.warn("Container não encontrado para o ID: " + userId);
        return;
    }

    // 2. Cria o elemento do emoji
    const floatingEmoji = document.createElement('div');
    floatingEmoji.innerText = emoji;
    
    // 3. Aplica o estilo para ele flutuar sobre o vídeo correto
    floatingEmoji.style.cssText = `
        position: absolute; 
        bottom: 60px; 
        left: 50%; 
        transform: translateX(-50%); 
        font-size: 50px; 
        z-index: 2000; 
        pointer-events: none;
        animation: floatUp 2s forwards;
        text-shadow: 0 0 10px rgba(0,0,0,0.5);
    `;

    // 4. Adiciona o emoji dentro do container do vídeo
    targetContainer.appendChild(floatingEmoji);
    
    // 5. Remove o emoji da tela após 2 segundos
    setTimeout(() => {
        floatingEmoji.remove();
    }, 2000);
}

// ============================================================
// MENUS DROPDOWN (GESTÃO DE INTERFACE)
// ============================================================
function toggleAudioMenu(event) { 
    event.stopPropagation(); 
    const menu = document.getElementById('audioDropdown'); 
    if(menu) { 
        const isShowing = menu.classList.contains('show'); 
        closeAllMenus(); 
        if (!isShowing) {
            menu.classList.add('show');
            // USE O NOME EXATO DA FUNÇÃO:
            updateAudioDeviceList();
            updateSpeakerList();
        }
    } 
}
function toggleVideoMenu(event) { 
    event.stopPropagation(); 
    const menu = document.getElementById('videoDropdown'); 
    if(menu) { 
        const isShowing = menu.classList.contains('show'); 
        closeAllMenus(); 
        if (!isShowing) {
            menu.classList.add('show');
            // ADICIONE ESTA LINHA: preenche a lista da setinha
            fillDeviceListInMenu('videoinput', 'cameraList');
        }
    } 
}
function toggleSecurityMenu(event) { event.stopPropagation(); const menu = document.getElementById('securityDropdown'); if(menu) { const isShowing = menu.classList.contains('show'); closeAllMenus(); if (!isShowing) menu.classList.add('show'); } }
function toggleParticipantsMenu(event) { event.stopPropagation(); const menu = document.getElementById('participantsDropdown'); if(menu) { const isShowing = menu.classList.contains('show'); closeAllMenus(); if (!isShowing) menu.classList.add('show'); } }
function toggleReactionsMenu(event) { event.stopPropagation(); const menu = document.getElementById('reactionsDropdown'); if(menu) { const isShowing = menu.classList.contains('show'); closeAllMenus(); if (!isShowing) menu.classList.add('show'); } }

function closeAllMenus() {
    document.querySelectorAll('.dropdown-menu').forEach(menu => {
        menu.classList.remove('show');
    });
}

window.onclick = function(event) {
    if (!event.target.matches('.arrow-btn') && !event.target.matches('.control-btn') && !event.target.closest('.chat-header')) {
        closeAllMenus();
    }
};

// ============================================================
// GESTÃO DINÂMICA DE PARTICIPANTES (PREPARADO PARA REAL-TIME)
// ============================================================

// --- SISTEMA DE SALA DE ESPERA E ENTRADA ---

function addParticipantToGrid(userId, userName, stream = null) {
    // 1. Verifica se a reunião está bloqueada
    if (securitySettings.lock) {
        console.log("Entrada negada: Reunião Bloqueada.");
        return; 
    }

    // 2. Se a sala de espera estiver ativa, envia para o painel de aprovação
    if (securitySettings.waiting) {
        showWaitingNotification(userId, userName, stream);
        return;
    }

    // 3. Entrada direta caso não haja restrições
    executeParticipantEntry(userId, userName, stream);
}

// Exibe a notificação flutuante para o Host
function showWaitingNotification(userId, userName, stream) {
    const panel = document.getElementById('waitingRoomPanel');
    const toast = document.createElement('div');
    toast.id = `wait-${userId}`;
    toast.style.cssText = "background: #252525; border-left: 5px solid #0e71eb; padding: 15px; border-radius: 8px; color: white; box-shadow: 0 5px 15px rgba(0,0,0,0.3); animation: slideIn 0.3s ease;";
    
    toast.innerHTML = `
        <div style="font-size: 14px; margin-bottom: 10px;"><b>${userName}</b> deseja entrar</div>
        <div style="display: flex; gap: 10px;">
            <button onclick="approveParticipant('${userId}', '${userName}', ${stream})" style="background: #2ecc71; border: none; color: white; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 12px;">Admitir</button>
            <button onclick="rejectParticipant('${userId}')" style="background: #ea4335; border: none; color: white; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 12px;">Recusar</button>
        </div>
    `;
    panel.appendChild(toast);
}

// Função que efetivamente coloca o vídeo no Grid
function executeParticipantEntry(userId, userName, stream) {
    const grid = document.getElementById('videoGrid');
    if (!grid || document.getElementById(`user-${userId}`)) return;

    const container = document.createElement('div');
    container.className = 'video-container';
    container.id = `user-${userId}`;

    const video = document.createElement('video');
    video.autoplay = true;
    video.playsinline = true;
    if (stream) video.srcObject = stream;

    container.innerHTML = `
        <div class="video-placeholder"><span class="user-icon">👤</span></div>
        <div class="user-label">${userName}</div>
    `;
    container.prepend(video);
    grid.appendChild(container);
    
    // Remove do painel de espera se estiver lá
    rejectParticipant(userId);
}

function approveParticipant(userId, userName, stream) {
    executeParticipantEntry(userId, userName, stream);
}

function rejectParticipant(userId) {
    const toast = document.getElementById(`wait-${userId}`);
    if (toast) toast.remove();
}
// ============================================================
// INICIALIZAÇÃO E EVENTOS
// ============================================================
window.addEventListener('load', () => {
    const isLogged = sessionStorage.getItem('isLogged');
    const userName = sessionStorage.getItem('userName');
    const savedName = sessionStorage.getItem('userName');
if (savedName) {
    const label = document.querySelector('.video-container.local .video-label');
    if (label) label.innerText = `${savedName} (Eu)`;
}

    // Se estiver na página inicial
    if (document.getElementById('authBox') && isLogged === 'true') {
        exibirInterfaceLogada(userName);
    }

    // Se estiver na sala de reunião
    if (document.getElementById('videoGrid')) {
        if (isLogged !== 'true') {
            alert("Acesso negado. Por favor, faça login primeiro.");
            window.location.href = 'index.html';
            return;
        }
        initMedia(); // Inicia a sua câmera
        startMeetingTimer(); // Inicia o cronómetro
        
        // AQUI: Não chamamos mais o simulateParticipants. 
        // A sala ficará vazia aguardando conexões reais ou a sua própria câmera.
        console.log("Sala pronta e aguardando participantes.");
    }
});

    // Listener para o Enter no Chat
    document.getElementById('chatInput')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    // Listener para Arquivos
    document.getElementById('fileInput')?.addEventListener('change', () => {
        sendFileNotification();
    });

// Animações Necessárias
const styleSheet = document.createElement('style');
styleSheet.innerHTML = `
@keyframes floatUp { 
    0% { bottom: 60px; opacity: 1; transform: translateX(-50%) scale(1); } 
    100% { bottom: 160px; opacity: 0; transform: translateX(-50%) scale(1.5); } 
}`;
document.head.appendChild(styleSheet);

// Função para abrir o modal apenas via botão
function openIDModal() {
    const modal = document.getElementById('idModal');
    if (modal) {
        modal.style.display = 'flex';
        document.getElementById('meetingIDInput').focus();
    }
}

function closeIDModal() {
    document.getElementById('idModal').style.display = 'none';
}

// Fecha se clicar fora do quadrado branco
function closeModalOnOverlay(event) {
    if (event.target.id === 'idModal') closeIDModal();
}
// Lógica de entrada (Futura conexão com banco de dados)
function joinByID() {
    const idInput = document.getElementById('meetingIDInput');
    const idValue = idInput.value.trim();

    if (idValue === "") {
        alert("Por favor, insira o ID da reunião.");
        return;
    }

    // Armazena o ID se quiser usar na próxima página
    sessionStorage.setItem('currentMeetingID', idValue);
    window.location.href = 'sala.html';
}
// FUNÇÃO 1: O "Gatilho" inicial
async function initMedia() {
    try {
        console.log("Iniciando pedido de mídia...");
        const constraints = { video: true, audio: true };
        
        // Tenta capturar áudio e vídeo
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        console.log("Permissão concedida!");
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            currentInputDeviceId = audioTrack.getSettings().deviceId;
        }

        const videoElement = document.getElementById('localVideo');
        if (videoElement) videoElement.srcObject = localStream;

        // CORREÇÃO: Usando os nomes corretos das funções que existem no seu código
        await updateAudioDeviceList(); 
        await updateSpeakerList(); 
        
    } catch (err) {
        console.error("Erro ao acessar mídia:", err);
        // Se falhar o áudio, tenta abrir pelo menos o vídeo para o host aparecer
        if (err.name === 'NotFoundError' || err.name === 'NotReadableError') {
             try {
                 localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                 const videoElement = document.getElementById('localVideo');
                 if (videoElement) videoElement.srcObject = localStream;
             } catch (vErr) { console.error("Nem o vídeo pôde ser aberto:", vErr); }
        }
        // Tenta listar o que for possível
        await updateAudioDeviceList();
    }
}
// FUNÇÃO 2: Atualiza todas as listas de uma vez
async function atualizarTudoDeMidia() {
    await updateAudioDeviceList(); // Lista da setinha ^
    await updateSpeakerList();     // Lista de alto-falantes
    // Se o modal estiver aberto, ele preenche os selects também
    if (document.getElementById('micSelectModal')) {
        fillDeviceSelect('audioinput', 'micSelectModal', currentInputDeviceId);
    }
}

// FUNÇÃO 3: Preenchimento seguro de Selects (Modal)
async function fillDeviceSelect(kind, selectId, currentId) {
    const select = document.getElementById(selectId);
    if (!select) return;

    const devices = await navigator.mediaDevices.enumerateDevices();
    const filtered = devices.filter(d => d.kind === kind);

    select.innerHTML = "";
    filtered.forEach(device => {
        const opt = document.createElement('option');
        opt.value = device.deviceId;
        // Se o nome (label) for vazio, o código gera um nome amigável
        opt.text = device.label || `${kind === 'audioinput' ? 'Microfone' : 'Câmera'} ${select.length + 1}`;
        if (device.deviceId === currentId) opt.selected = true;
        select.appendChild(opt);
    });
}
// Dentro do evento de load na sala.html
const configRaw = sessionStorage.getItem('roomConfig');
if (configRaw) {
    const config = JSON.parse(configRaw);
    
    // 1. Ajusta o Nome/Logo na Navbar
    const logo = document.querySelector('.logo');
    if(logo) logo.innerText = config.logoName;

    // 2. Adiciona o Tema Centralizado
    if(config.theme) {
        const topBar = document.querySelector('.top-bar');
        const themeDiv = document.createElement('div');
        themeDiv.style.cssText = "position:absolute; left:50%; transform:translateX(-50%); font-weight:bold; color:white;";
        themeDiv.innerText = config.theme;
        topBar.appendChild(themeDiv);
    }

    // 3. Aplica a Cor de Destaque
    document.querySelectorAll('.btn-primary, .opt-btn.join').forEach(el => {
        el.style.backgroundColor = config.color;
    });
    
    // 4. Lógica de Tempo (Exemplo simplificado)
    if(config.duration !== 'unlimited') {
        console.log(`Reunião programada para ${config.duration} minutos.`);
        // Aqui você pode adicionar um setTimeout para encerrar
    }
}
// ============================================================
// GESTÃO DE DISPOSITIVOS DE ÁUDIO
// ============================================================

async function updateSpeakerList() {
    const speakerList = document.getElementById('speakerList');
    if (!speakerList) return;

    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioOutputs = devices.filter(device => device.kind === 'audiooutput');

    speakerList.innerHTML = "";

    if (audioOutputs.length === 0) {
        speakerList.innerHTML = '<div class="menu-item" style="opacity:0.5; cursor:default;">Padrão do Sistema</div>';
        return;
    }

    audioOutputs.forEach(device => {
        const item = document.createElement('div');
        item.className = 'menu-item';
        item.innerText = device.label || `Alto-falante ${speakerList.children.length + 1}`;
        
        item.onclick = async () => {
            const videoElement = document.getElementById('localVideo');
            if (videoElement.setSinkId) {
                await videoElement.setSinkId(device.deviceId);
                closeAllMenus();
            } else {
                alert("Seu navegador não suporta a troca de alto-falantes.");
            }
        };
        speakerList.appendChild(item);
    });
}

async function changeAudioInput(deviceId) {
    if (!deviceId) return;
    
    try {
        // 1. Para todas as trilhas de áudio atuais para liberar o hardware
        if (localStream) {
            localStream.getAudioTracks().forEach(track => track.stop());
        }
        
        // 2. Solicita o novo microfone específico
        const newStream = await navigator.mediaDevices.getUserMedia({
            audio: { deviceId: { exact: deviceId } }
        });

        const newAudioTrack = newStream.getAudioTracks()[0];
        
        // 3. Atualiza o stream principal mantendo o vídeo atual
        if (localStream) {
            const videoTrack = localStream.getVideoTracks()[0];
            localStream = new MediaStream([newAudioTrack, videoTrack]);
        } else {
            localStream = newStream;
        }

        currentInputDeviceId = deviceId;
        
        // 4. Atualiza a interface visual (a lista com o check)
        updateAudioDeviceList();
        
        console.log("Microfone trocado com sucesso para:", deviceId);
    } catch (err) {
        console.error("Erro ao trocar microfone:", err);
        alert("Não foi possível conectar a este microfone. Verifique se ele não está sendo usado por outro programa.");
    }
}
// ============================================================
// FUNÇÃO DE TESTE DE ÁUDIO (BIPE SENOIDAL)
// ============================================================
function testAudioDevices() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(440, audioCtx.currentTime); 
        
        // Usa o volume atual do sistema
        gainNode.gain.setValueAtTime(currentOutputVolume * 0.5, audioCtx.currentTime);

        oscillator.start();
        
        // Para o som automaticamente após 2 segundos sem travar a tela
        setTimeout(() => {
            oscillator.stop();
            audioCtx.close();
        }, 2000);
        
    } catch (err) {
        console.error("Erro no teste de áudio:", err);
    }
}
function renderAudioSettings() {
    const content = document.getElementById('settingsContent');
    const title = document.getElementById('settingsTitle');
    const tabs = document.querySelector('.settings-tabs');

    if (tabs) tabs.style.display = 'none'; 
    title.innerText = "Configurações de Áudio";

    content.innerHTML = `
        <div class="setting-row">
            <label>Microfone Principal</label>
            <select id="micSelectModal" class="modal-input" onchange="changeAudioInput(this.value)"></select>
        </div>
        
        <div class="setting-row">
            <label>Volume do Alto-falante</label>
            <input type="range" min="0" max="1" step="0.1" value="${currentOutputVolume}" style="width:100%" oninput="updateOutputVolume(this.value)">
        </div>

        <button class="btn-primary" style="background:#333; width:100%; margin-top:15px;" onclick="testAudioDevices()">
            🔊 Testar Som
        </button>
    `;
    // IMPORTANTE: kind deve ser 'audioinput'
    fillDeviceSelect('audioinput', 'micSelectModal', currentInputDeviceId);
}

// ============================================================
// CONTROLE DO MODAL DE CONFIGURAÇÕES
// ============================================================
function openSettingsModal(tab = 'audio') {
    const modal = document.getElementById('settingsModal');
    if (modal) {
        modal.style.display = 'flex';
        switchSettingsTab(tab);
    }
    closeAllMenus();
}

function closeSettingsModal() {
    document.getElementById('settingsModal').style.display = 'none';
}

function closeSettingsOnOverlay(event) {
    if (event.target.id === 'settingsModal') closeSettingsModal();
}

// ============================================================
// CONFIGURAÇÕES SEPARADAS (ÁUDIO E VÍDEO)
// ============================================================
function switchSettingsTab(tab) {
    const content = document.getElementById('settingsContent');
    const title = document.getElementById('settingsTitle');
    const tabsContainer = document.querySelector('.settings-tabs');

    // Esconde a navegação entre abas para manter a interface exclusiva
    if (tabsContainer) tabsContainer.style.display = 'none';

    if (tab === 'audio') {
        title.innerText = "Configurações de Áudio";
        content.innerHTML = `
            <div class="setting-row">
                <label>Microfone</label>
                <select id="micSelectModal" class="modal-input" onchange="changeAudioInput(this.value)"></select>
            </div>
            <div class="setting-row">
                <label>Volume do Alto-falante</label>
                <input type="range" id="volumeControl" min="0" max="1" step="0.1" value="${currentOutputVolume}" style="width: 100%;" oninput="updateOutputVolume(this.value)">
            </div>
            <button class="btn-primary" style="background:#333; width:100%; margin-top:10px;" onclick="testAudioDevices()">Testar Som</button>
        `;
        // CORREÇÃO: Usa a função de preenchimento de select para o modal
        fillDeviceSelect('audioinput', 'micSelectModal', currentInputDeviceId);
    } else if (tab === 'video') {
        title.innerText = "Configurações de Vídeo";
        content.innerHTML = `
            <div class="setting-row">
                <label>Câmera</label>
                <select id="cameraSelectModal" class="modal-input" onchange="changeVideoInput(this.value)"></select>
            </div>
            <div class="video-preview-container" style="margin-bottom: 15px; background: #000; height: 180px; border-radius: 8px; overflow: hidden;">
                <video id="settingsVideoPreview" autoplay playsinline muted style="width: 100%; height: 100%; object-fit: cover;"></video>
            </div>
            <div class="setting-row">
                <label>Filtro de Vídeo</label>
                <select class="modal-input" onchange="applyVideoFilter(this.value)">
                    <option value="none">Nenhum</option>
                    <option value="grayscale(100%)">Preto e Branco</option>
                    <option value="blur(5px)">Desfoque</option>
                </select>
            </div>
        `;
        fillDeviceSelect('videoinput', 'cameraSelectModal');
        startSettingsPreview();
    }
}

// Preenche qualquer <select> com os dispositivos encontrados
async function fillDeviceSelect(kind, selectId, currentId) {
    const select = document.getElementById(selectId);
    if (!select) return;

    try {
        // TRUQUE PARA O CHROME: Tenta capturar áudio rapidamente. 
        // Isso força o navegador a liberar os rótulos (labels) dos dispositivos.
        const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true }).catch(() => null);

        const devices = await navigator.mediaDevices.enumerateDevices();
        
        // Se conseguimos o stream temporário, fechamos ele logo em seguida
        if (tempStream) tempStream.getTracks().forEach(track => track.stop());

        const filtered = devices.filter(d => d.kind === kind);

        console.log("Dispositivos localizados:", filtered);

        select.innerHTML = '';

        if (filtered.length === 0 || filtered.every(d => d.label === "")) {
            const opt = document.createElement('option');
            opt.text = "Nenhum nome encontrado. Recarregue a página.";
            select.appendChild(opt);
            return;
        }

        filtered.forEach(device => {
            const opt = document.createElement('option');
            opt.value = device.deviceId;
            // Se o label ainda for vazio, usamos um nome genérico com contador
            opt.text = device.label || `${kind === 'audioinput' ? 'Microfone' : 'Câmera'} ${select.length + 1}`;
            
            if (device.deviceId === currentId) {
                opt.selected = true;
            }
            select.appendChild(opt);
        });
    } catch (err) {
        console.error("Erro ao listar dispositivos:", err);
    }
}
// Mostra a imagem da câmera no quadradinho do modal
async function startSettingsPreview() {
    const previewVideo = document.getElementById('settingsVideoPreview');
    if (previewVideo && localStream) {
        previewVideo.srcObject = localStream;
    }
}

// Troca a câmera real da reunião
async function changeVideoInput(deviceId) {
    if (localStream) {
        localStream.getVideoTracks().forEach(track => track.stop());
    }
    const constraints = { video: { deviceId: { exact: deviceId } }, audio: true };
    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    document.getElementById('localVideo').srcObject = localStream;
    startSettingsPreview(); // Atualiza o preview também
}
async function fillDeviceListInMenu(kind, elementId) {
    const listElement = document.getElementById(elementId);
    if (!listElement) return;

    const devices = await navigator.mediaDevices.enumerateDevices();
    const filtered = devices.filter(d => d.kind === kind && d.deviceId !== "");

    listElement.innerHTML = "";

    if (filtered.length === 0) {
        listElement.innerHTML = '<div class="menu-item" style="opacity:0.5;">Nenhum dispositivo encontrado</div>';
        return;
    }

    filtered.forEach(device => {
        const item = document.createElement('div');
        item.className = 'menu-item';
        item.innerText = device.label || (kind === 'videoinput' ? 'Câmera' : 'Microfone');
        
        item.onclick = () => {
            if (kind === 'videoinput') {
                changeVideoInput(device.deviceId);
            } else {
                changeAudioInput(device.deviceId);
            }
            closeAllMenus();
        };
        listElement.appendChild(item);
    });
}
function disconnectAudio() {
    if (localStream) {
        // Para todas as trilhas de áudio (desconecta o hardware)
        localStream.getAudioTracks().forEach(track => {
            track.stop();
        });
        
        isAudioMuted = true;
        const btn = document.getElementById('audioBtn');
        const label = btn.parentElement.querySelector('span');
        
        // Visual de desconectado
        btn.innerHTML = '🚫'; 
        btn.style.color = '#888';
        label.innerText = 'Áudio Off';
        
        alert("Áudio do computador desconectado.");
    }
    closeAllMenus();
}
function updateOutputVolume(volume) {
    currentOutputVolume = parseFloat(volume);
    
    // Ajusta o volume do vídeo (dos outros participantes)
    const videoElement = document.getElementById('localVideo');
    if (videoElement) {
        videoElement.volume = currentOutputVolume;
    }
    // Nota: Isso afetará o volume de quem você ouve (participantes) 
    // e do som de teste.
}
// Aplica filtros de cor e desfoque via CSS
function applyVideoFilter(filterValue) {
    const mainVideo = document.getElementById('localVideo');
    const previewVideo = document.getElementById('settingsVideoPreview');
    
    if (mainVideo) mainVideo.style.filter = filterValue;
    if (previewVideo) previewVideo.style.filter = filterValue;
}

// Lógica para Plano de Fundo (Aviso de funcionalidade)
function applyVirtualBackground(type) {
    if (type === 'blur') {
        applyVideoFilter('blur(8px)');
        alert("Fundo desfocado aplicado!");
    } else {
        alert("A substituição de fundo por imagem requer bibliotecas pesadas (como MediaPipe). Por enquanto, usamos filtros rápidos!");
    }
}

// Objeto para controlar o estado de segurança
let securitySettings = {
    lock: false,
    waiting: true,
    share: true,
    chat: true,
    rename: true,
    unmute: true,
    startVideo: true
};

function toggleSecuritySetting(setting) {
    // Inverte o valor booleano
    securitySettings[setting] = !securitySettings[setting];
    
    // Mapeamento visual (ID do elemento e classe 'checked')
    const ids = {
        lock: 'optLockMeeting',
        waiting: 'optWaitingRoom',
        share: 'optAllowShare',
        chat: 'optAllowChat',
        rename: 'optAllowRename',
        unmute: 'optAllowUnmute',
        startVideo: 'optAllowVideo'
    };

    const element = document.getElementById(ids[setting]);
    if (element) {
        element.classList.toggle('checked', securitySettings[setting]);
    }

    // Ações em tempo real baseadas na escolha:
    if (setting === 'chat') {
        // Usa sua função existente de restrição de chat
        toggleChatRestriction(securitySettings.chat ? 'all' : 'none');
    }
    
    if (setting === 'share' && !securitySettings.share) {
        if (screenStream) stopScreenShare(); // Para o share se ele for desabilitado
    }

    console.log(`Segurança atualizada: ${setting} agora é ${securitySettings[setting]}`);
}
// Abrir o modal de renomear
function openRenameModal() {
    // Verifica se a segurança permite renomear
    if (!securitySettings.rename) {
        alert("O anfitrião desativou a opção de renomear.");
        return;
    }
    
    const currentName = sessionStorage.getItem('userName') || "Participante";
    document.getElementById('newNameInput').value = currentName;
    document.getElementById('renameModal').style.display = 'flex';
}

function closeRenameModal() {
    document.getElementById('renameModal').style.display = 'none';
}

function closeRenameModalOnOverlay(event) {
    if (event.target.id === 'renameModal') closeRenameModal();
}

// Confirmar a alteração do nome
// Espera o DOM carregar para aplicar o evento de clique no nome
document.addEventListener('DOMContentLoaded', () => {
    // Seleciona a etiqueta do seu vídeo local
    const localLabel = document.querySelector('#localPlayer .user-label');
    
    if (localLabel) {
        localLabel.onclick = openRenameModal;
        localLabel.style.cursor = 'pointer';
        localLabel.title = "Clique para renomear";
        console.log("Sistema de renomear ativado na etiqueta:", localLabel.innerText);
    }
});
function confirmRename() {
    const newName = document.getElementById('newNameInput').value.trim();
    
    if (newName !== "") {
        sessionStorage.setItem('userName', newName);
        
        // Seleciona a etiqueta correta para atualizar o texto
        const localLabel = document.querySelector('#localPlayer .user-label');
        if (localLabel) {
            localLabel.innerText = `${newName} (Host)`;
        }
        
        closeRenameModal();
    }
}

// Abre/Fecha o menu de participantes
function toggleParticipantsMenu(event) {
    event.stopPropagation();
    const menu = document.getElementById('participantsDropdown');
    if (menu) {
        const isShowing = menu.classList.contains('show');
        closeAllMenus();
        if (!isShowing) menu.classList.add('show');
    }
}

// Função para copiar o link da reunião
function copyMeetingLink() {
    const dummy = document.createElement('input');
    const text = window.location.href; // Copia a URL atual

    document.body.appendChild(dummy);
    dummy.value = text;
    dummy.select();
    document.execCommand('copy');
    document.body.removeChild(dummy);

    alert("Link da reunião copiado para a área de transferência!");
}

// Abre as configurações específicas de gerenciamento (Sala de Espera/Remoção)
function toggleWaitingRoomSettings(event) {
    event.stopPropagation();
    // Por enquanto, apenas abre o menu de segurança para gerenciar a sala de espera
    // ou você pode direcionar para um modal específico futuramente.
    toggleSecurityMenu(event);
}
// Abre/Fecha o menu de ações da engrenagem
function toggleParticipantActions(event) {
    event.stopPropagation();
    const actionMenu = document.getElementById('participantActionsMenu');
    const isShowing = actionMenu.classList.contains('show');
    
    // Fecha outros sub-menus se houver, mas mantém o de participantes aberto
    actionMenu.classList.toggle('show');
}

// Lida com a remoção ou bloqueio
function handleMassAction(actionType) {
    // Como ainda não selecionamos um participante específico na lista, 
    // vamos preparar a lógica para os "participantes logados futuramente"
    
    if (actionType === 'remove') {
        const confirmRem = confirm("Deseja remover o participante selecionado da sala?");
        if (confirmRem) {
            console.log("Executando remoção via sinalização...");
            // Lógica futura: disparar comando de expulsão para o servidor
        }
    } else if (actionType === 'block') {
        const confirmBlock = confirm("Deseja bloquear este participante? Ele não poderá retornar através deste link.");
        if (confirmBlock) {
            console.log("ID adicionado à lista negra do servidor.");
            // Lógica futura: salvar o ID/IP em uma blacklist no servidor
        }
    }
    
    // Fecha o menu após a ação
    document.getElementById('participantActionsMenu').classList.remove('show');
}

// Atualizar o closeAllMenus para incluir o novo menu
// Adicione esta linha dentro da sua função closeAllMenus() já existente:
// document.getElementById('participantActionsMenu').classList.remove('show');
function toggleParticipantActions(event) {
    event.stopPropagation();
    const actionMenu = document.getElementById('participantActionsMenu');
    // Alterna apenas o sub-menu sem fechar o principal
    actionMenu.style.display = actionMenu.style.display === 'block' ? 'none' : 'block';
}

function handleParticipantAction(action) {
    if (action === 'remove') {
        alert("Função para remover participante preparada.");
        // Lógica futura de expulsão
    } else if (action === 'block') {
        alert("Função para bloquear entrada preparada.");
        // Lógica futura de blacklist
    }
    document.getElementById('participantActionsMenu').style.display = 'none';
}

function copyMeetingLink() {
    navigator.clipboard.writeText(window.location.href);
    alert("Link copiado!");
}
async function toggleVoiceRecording() {
    const voiceBtn = document.getElementById('voiceBtn');
    
    if (!isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunks.push(e.data);
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(audioChunks, { type: 'audio/webm' });
                
                // --- A MÁGICA PARA FUNCIONAR ---
                const reader = new FileReader();
                reader.readAsDataURL(blob); 
                reader.onloadend = () => {
                    recordedAudioUrl = reader.result; // Transforma o áudio em dados puros
                    
                    const player = document.getElementById('audioPreviewPlayer');
                    const container = document.getElementById('audioPreviewContainer');
                    if (player && container) {
                        player.src = recordedAudioUrl;
                        container.style.display = 'flex';
                        player.load(); // Força o navegador a carregar os dados
                    }
                };
            };

            mediaRecorder.start();
            isRecording = true;
            voiceBtn.style.color = "#ea4335";
            voiceBtn.innerHTML = "🛑";
        } catch (err) {
            alert("Erro no microfone: Verifique se o Live Server está rodando e se permitiu o acesso.");
        }
    } else {
        stopAudioRecording();
        voiceBtn.innerHTML = "🎤";
        voiceBtn.style.color = "#5f6368";
    }
}

function stopAudioRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;

        // O SEGREDO: Só muda o estilo se o elemento realmente existir
        const voiceBtn = document.getElementById('voiceBtn');
        if (voiceBtn) {
            voiceBtn.style.color = "#5f6368";
            voiceBtn.innerHTML = "🎤"; 
        }

        // Para as faixas do microfone (apaga a luzinha do navegador)
        if (mediaRecorder.stream) {
            mediaRecorder.stream.getTracks().forEach(t => t.stop());
        }
    }
}
function showAudioPreview(url) {
    const container = document.getElementById('audioPreviewContainer');
    const player = document.getElementById('audioPreviewPlayer');
    const input = document.getElementById('chatInput');

    // O player fica oculto pelo CSS, mas o SRC é carregado para o envio
    player.src = url;
    container.style.display = 'flex'; 
    
    input.placeholder = "Legenda do áudio...";
    input.focus();
}

function cancelAudioRecording() {
    recordedAudioUrl = null;
    document.getElementById('audioPreviewContainer').style.display = 'none';
    document.getElementById('audioPreviewPlayer').src = "";
    document.getElementById('chatInput').placeholder = "Enviar mensagem...";
}

// ATUALIZAÇÃO DA SUA FUNÇÃO SENDMESSAGE ORIGINAL
function sendMessage() {
    const input = document.getElementById('chatInput');
    const chatMessages = document.getElementById('chatMessages');
    const target = document.getElementById('chatTarget');

    if (input.value.trim() === "" && !recordedAudioUrl) return;

    const agora = new Date();
    const hora = agora.getHours().toString().padStart(2, '0') + ":" + agora.getMinutes().toString().padStart(2, '0');
    const isPrivate = target.value !== 'todos';

    const msgDiv = document.createElement('div');
    msgDiv.className = isPrivate ? 'msg-bubble private' : 'msg-bubble';

    if (recordedAudioUrl) {
        msgDiv.innerHTML = `
            <strong>Você (Áudio)${isPrivate ? ' - Privado' : ''}:</strong><br>
            <audio controls src="${recordedAudioUrl}" style="width: 100%; max-width: 210px; height: 35px; margin-top: 5px;"></audio>
            ${input.value ? `<p>${input.value}</p>` : ''}
            <span class="msg-time">${hora}</span>
        `;
        // Limpa o preview e a variável após o envio
        recordedAudioUrl = null;
        document.getElementById('audioPreviewContainer').style.display = 'none';
    } else {
        msgDiv.innerHTML = `
            <strong>Você${isPrivate ? ' - Privado' : ''}:</strong><br>
            <p>${input.value}</p>
            <span class="msg-time">${hora}</span>
        `;
    }

    chatMessages.appendChild(msgDiv);
    input.value = "";
    chatMessages.scrollTop = chatMessages.scrollHeight;
}
// ============================================================
// GESTÃO DA SALA PERSONALIZADA (MODAL E CONFIGURAÇÃO)
// ============================================================

// Abre o modal de personalização verificando a existência do elemento
function openCustomModal() {
    const modal = document.getElementById('customRoomModal');
    if (modal) {
        // Forçamos o reset do scroll interno e garantimos a exibição
        modal.scrollTop = 0;
        modal.style.display = 'flex';
        modal.style.opacity = '1';
        modal.style.visibility = 'visible';
    } else {
        console.error("Erro crítico: O elemento 'customRoomModal' não existe no HTML.");
    }
}
function closeCustomModal() {
    const modal = document.getElementById('customRoomModal');
    if (modal) {
        modal.style.display = 'none';
        modal.style.opacity = '0';
        modal.style.visibility = 'hidden';
    }
}

// Garante que o clique fora da caixa funcione sempre
function closeCustomModalOnOverlay(event) {
    // Se o ID do que foi clicado for o fundo escuro, fechamos
    if (event.target.id === 'customRoomModal') {
        closeCustomModal();
    }
}

// Adiciona campos dinâmicos para cadastrar suporte (Nome e Telefone)
function addSupportField() {
    const list = document.getElementById('supportList');
    if (!list) return;

    const div = document.createElement('div');
    div.className = "support-item";
    div.style.cssText = "display: flex; gap: 5px; margin-top: 8px;";
    
    div.innerHTML = `
        <input type="text" placeholder="Nome" class="modal-input" style="margin:0; flex:1">
        <input type="text" placeholder="Tel" class="modal-input" style="margin:0; flex:1">
        <button onclick="this.parentElement.remove()" style="background:none; border:none; color:#ea4335; cursor:pointer; font-size:16px;" title="Remover">🗑️</button>
    `;
    list.appendChild(div);
}

// Coleta todos os dados do formulário e salva no sessionStorage antes de ir para a sala
function startCustomMeeting() {
    // Captura dos elementos para evitar erros de referência
    const logoInput = document.getElementById('customLogoName');
    const typeInput = document.getElementById('instType');
    const themeInput = document.getElementById('eventTheme');
    const durationInput = document.getElementById('meetingDuration');
    const colorInput = document.getElementById('roomColor');
    const entryInput = document.querySelector('input[name="entryType"]:checked');

    const config = {
        logoName: logoInput ? logoInput.value || "Adoração Em Família" : "Adoração Em Família",
        type: typeInput ? typeInput.value : "religiao",
        theme: themeInput ? themeInput.value : "",
        duration: durationInput ? durationInput.value : "unlimited",
        color: colorInput ? colorInput.value : "#0e71eb",
        entry: entryInput ? entryInput.value : "id",
        support: []
    };

    // Coleta a lista de suportes cadastrados
    document.querySelectorAll('#supportList .support-item').forEach(div => {
        const inputs = div.querySelectorAll('input');
        if (inputs[0] && inputs[0].value.trim() !== "") {
            config.support.push({
                name: inputs[0].value.trim(),
                tel: inputs[1] ? inputs[1].value.trim() : ""
            });
        }
    });

    // Salva o objeto completo e redireciona
    sessionStorage.setItem('roomConfig', JSON.stringify(config));
    window.location.href = 'sala.html';
}
let currentChatAudioSpeed = 1.0;

// Abre/Fecha o menu de velocidade da setinha
function toggleChatVoiceMenu(event) {
    event.stopPropagation();
    const menu = document.getElementById('chatVoiceDropdown');
    // Fecha outros menus antes de abrir este
    document.querySelectorAll('.dropdown-menu').forEach(m => {
        if(m.id !== 'chatVoiceDropdown') m.style.display = 'none';
    });
    menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
}

// Define a velocidade e aplica aos áudios
function setAudioSpeed(speed) {
    currentChatAudioSpeed = speed;
    
    // Aplica a velocidade em todos os players de áudio na tela
    const audios = document.querySelectorAll('audio');
    audios.forEach(audio => {
        audio.playbackRate = speed;
    });

    // Atualiza o check visual no menu
    document.querySelectorAll('#chatVoiceDropdown .menu-item').forEach(item => {
        item.classList.remove('checked');
        if(parseFloat(item.innerText) === speed) item.classList.add('checked');
    });

    document.getElementById('chatVoiceDropdown').style.display = 'none';
}

// Função para abrir/fechar o seletor de emojis de forma independente
function toggleEmojiPicker(event) {
    event.stopPropagation();
    const picker = document.getElementById('emojiPicker');
    picker.style.display = (picker.style.display === 'flex') ? 'none' : 'flex';
}
// ============================================================
// SISTEMA DE MENUS ROBUSTO (CORREÇÃO DE CLIQUE ÚNICO)
// ============================================================

function toggleMenu(menuId, event) {
    if (event) event.stopPropagation();
    const menu = document.getElementById(menuId);
    if (!menu) return;

    const isShowing = menu.classList.contains('show');
    
    // Fecha todos os outros menus antes de abrir o atual
    closeAllMenus();

    // Se ele não estava aparecendo, agora ele aparece
    if (!isShowing) {
        menu.classList.add('show');
        
        // Casos específicos: preencher listas ao abrir
        if (menuId === 'audioDropdown') {
            updateAudioDeviceList();
            updateSpeakerList();
        }
        if (menuId === 'videoDropdown') {
            fillDeviceListInMenu('videoinput', 'cameraList');
        }
    }
}

// Substitua suas funções antigas por estas chamadas simplificadas
function toggleAudioMenu(event) { toggleMenu('audioDropdown', event); }
function toggleVideoMenu(event) { toggleMenu('videoDropdown', event); }
function toggleSecurityMenu(event) { toggleMenu('securityDropdown', event); }
function toggleParticipantsMenu(event) { toggleMenu('participantsDropdown', event); }
function toggleReactionsMenu(event) { toggleMenu('reactionsDropdown', event); }
function toggleChatSettings(event) { toggleMenu('chatSettingsMenu', event); }

// Função central de fechamento
function closeAllMenus() {
    // Remove a classe 'show' de todos os dropdowns
    document.querySelectorAll('.dropdown-menu').forEach(menu => {
        menu.classList.remove('show');
    });
    
    // Fecha popups específicos do chat que usam display: flex/block
    const emojiPicker = document.getElementById('emojiPicker');
    if (emojiPicker) emojiPicker.style.display = 'none';
    
    const voiceMenu = document.getElementById('chatVoiceDropdown');
    if (voiceMenu) voiceMenu.style.display = 'none';
}

// Fecha menus ao clicar em qualquer lugar vazio da página
window.onclick = function(event) {
    // Se o clique não foi em um botão de controle ou dentro de um menu, fecha tudo
    if (!event.target.closest('.control-item') && 
        !event.target.closest('.dropdown-container') && 
        !event.target.closest('.chat-header')) {
        closeAllMenus();
    }
};
// ============================================================
// SISTEMA DE GRAVAÇÃO DE ÁUDIO
// ============================================================

async function startAudioRecording() {
    try {
        // Verifica se o navegador suporta a API
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error("API de mídia não suportada");
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) audioChunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
            const blob = new Blob(audioChunks, { type: 'audio/webm' });
            recordedAudioUrl = URL.createObjectURL(blob);
            
            // Atualiza o player de preview
            const player = document.getElementById('audioPreviewPlayer');
            const container = document.getElementById('audioPreviewContainer');
            if (player && container) {
                player.src = recordedAudioUrl;
                container.style.display = 'flex';
            }
        };

        mediaRecorder.start();
        isRecording = true;
        document.getElementById('voiceBtn').style.color = "#ea4335";
        console.log("Gravação iniciada com sucesso!");

    } catch (err) {
        console.error("Erro ao capturar microfone:", err);
        alert("Erro: O microfone pode estar sendo usado por outro programa ou a permissão foi negada no sistema operacional.");
    }
}
function stopAudioRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        document.getElementById('micChatBtn').style.color = "";
        // Para as trilhas do microfone para fechar a luzinha do navegador
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
}

function cancelAudioRecording() {
    recordedAudioUrl = null;
    audioChunks = [];
    const preview = document.getElementById('audioPreviewContainer');
    if (preview) preview.style.display = 'none';
}

function showAudioPreview() {
    const preview = document.getElementById('audioPreviewContainer');
    if (preview) {
        preview.style.display = 'flex';
        preview.innerHTML = `
            <div style="background: #2D8CFF; padding: 5px 10px; border-radius: 20px; display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 12px;">🎤 Áudio pronto</span>
                <button onclick="cancelAudioRecording()" style="background:none; border:none; color:white; cursor:pointer;">✕</button>
            </div>
        `;
    }
}


