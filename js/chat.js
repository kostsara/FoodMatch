// js/chat.js

// 1. СТВОРЕННЯ HTML (Без зайвих кнопок)
document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('foodmatch-chat-root')) {
        const chatHTML = `
            <div id="foodmatch-chat-root">
            <button class="chat-launcher" onclick="toggleChat()">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="white">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path>
            </svg>
            </button>

                <div class="chat-window" id="chatWindow">
                    <div class="chat-header">
                        <span>Чат FoodMatch</span>
                        <button class="chat-close" onclick="toggleChat()">×</button>
                    </div>
                    
                    <div class="chat-messages" id="chatMessages">
                        <div style="text-align:center; color:#9ca3af; font-size:0.8rem; margin-top:20px;">
                            Завантаження...
                        </div>
                    </div>

                    <div class="reply-preview-bar" id="replyBar">
                        <div class="reply-info">
                            <span style="color:#A10404; font-weight:700;">Відповідь для:</span> 
                            <span id="replyToName">...</span>
                            <div id="replyToText" style="color:#555; font-size:0.8rem;">...</div>
                        </div>
                        <button class="close-reply" onclick="cancelReply()">×</button>
                    </div>

                    <div class="chat-input-area">
                        <input type="text" id="chatInput" class="chat-input" placeholder="Напишіть повідомлення..." autocomplete="off">
                        <button class="chat-send-btn" onclick="sendChatMessage()">➤</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', chatHTML);
        
        // Enter для відправки
        document.getElementById('chatInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') sendChatMessage();
        });
    }
});

// ЗМІННІ
let chatSub = null;
let chatUser = null;
let currentReply = null;

// 2. УПРАВЛІННЯ ВІКНОМ
async function toggleChat() {
    const win = document.getElementById('chatWindow');
    if (win.classList.contains('open')) {
        win.classList.remove('open');
    } else {
        win.classList.add('open');
        await initChatUser();
        loadMessages();
        subscribeToChat();
        setTimeout(() => scrollToBottom(), 100);
    }
}

async function initChatUser() {
    const { data: { user } } = await supabase.auth.getUser();
    chatUser = user;
}

// 3. ЗАВАНТАЖЕННЯ ПОВІДОМЛЕНЬ
async function loadMessages() {
    const { data: msgs, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(50);

    if (error) return;
    
    const container = document.getElementById('chatMessages');
    if (msgs.length > 0) container.innerHTML = '';
    
    msgs.forEach(msg => renderOneMessage(msg));
    scrollToBottom();
}

function renderOneMessage(msg) {
    const container = document.getElementById('chatMessages');
    if (document.getElementById(`msg-row-${msg.id}`)) return;

    const myId = chatUser ? chatUser.id : null;
    const isMe = msg.user_id === myId;

    const row = document.createElement('div');
    row.id = `msg-row-${msg.id}`;
    row.className = `msg-row ${isMe ? 'me' : 'others'}`;

    // Обробка тексту (захист від HTML)
    let contentHtml = escapeHtml(msg.content);
    
    // Якщо це старе фото (залишаємо підтримку перегляду, але не завантаження)
    if (msg.content.includes('chat-uploads') || msg.content.match(/\.(jpg|png|gif)$/i)) {
        contentHtml = `<img src="${msg.content}" class="msg-image">`;
    }

    // Цитата
    let quoteHtml = '';
    if (msg.reply_to_id) {
        quoteHtml = `
            <div class="msg-quote">
                <strong>${escapeHtml(msg.reply_to_name || '...')}</strong><br>
                ${escapeHtml(msg.reply_to_text || '...')}
            </div>
        `;
    }

    // Кнопки дій
    let actionsHtml = `
        <div class="msg-actions">
            <button class="action-btn" onclick="startReply('${msg.id}', '${escapeHtml(msg.user_name)}', '${escapeHtml(msg.content)}')">Відповісти</button>
            ${isMe ? `<button class="action-btn delete" onclick="deleteMessage('${msg.id}')">Видалити</button>` : ''}
        </div>
    `;

    row.innerHTML = `
        <div class="msg-bubble">
            ${!isMe ? `<div class="msg-author">${msg.user_name}</div>` : ''}
            ${quoteHtml}
            ${contentHtml}
        </div>
        ${actionsHtml}
    `;

    container.appendChild(row);
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function scrollToBottom() {
    const c = document.getElementById('chatMessages');
    if(c) c.scrollTop = c.scrollHeight;
}

// 4. REALTIME
function subscribeToChat() {
    if (chatSub) return;
    chatSub = supabase.channel('public:messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
            renderOneMessage(payload.new);
            scrollToBottom();
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, payload => {
            const el = document.getElementById(`msg-row-${payload.old.id}`);
            if (el) el.remove();
        })
        .subscribe();
}

// 5. ВІДПРАВКА
async function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    
    if (!text) return;
    if (!chatUser) return alert("Увійдіть у профіль!");

    input.value = ''; // Чистимо

    let userName = chatUser.user_metadata?.full_name || chatUser.email.split('@')[0];

    // Дані для відповіді
    let replyId = null, replyText = null, replyName = null;
    if (currentReply) {
        replyId = currentReply.id;
        replyText = currentReply.text;
        replyName = currentReply.name;
    }

    const { error } = await supabase.rpc('send_chat_message', {
        p_content: text,
        p_user_name: userName,
        p_reply_id: replyId,
        p_reply_text: replyText,
        p_reply_name: replyName
    });

    if (error) alert("⛔ " + error.message);
    cancelReply();
}

// 6. ФУНКЦІЇ ДІЙ
function startReply(id, name, text) {
    currentReply = { id, name, text };
    document.getElementById('replyToName').textContent = name;
    document.getElementById('replyToText').textContent = text.substring(0, 30) + (text.length > 30 ? '...' : '');
    document.getElementById('replyBar').classList.add('show');
    document.getElementById('chatInput').focus();
}

function cancelReply() {
    currentReply = null;
    document.getElementById('replyBar').classList.remove('show');
}

async function deleteMessage(id) {
    if (!confirm("Видалити повідомлення?")) return;
    const { error } = await supabase.from('messages').delete().eq('id', id);
    if(error) alert("Помилка видалення");
}

// Експорт функцій для HTML
window.toggleChat = toggleChat;
window.sendChatMessage = sendChatMessage;
window.startReply = startReply;
window.cancelReply = cancelReply;
window.deleteMessage = deleteMessage;