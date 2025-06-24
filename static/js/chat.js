// Chat application JavaScript
let currentChatUserId = null;
let lastMessageId = 0;
let users = [];
let messages = [];

// Load users list
async function loadUsers() {
    try {
        const response = await fetch('/api/get_users');
        const data = await response.json();
        
        if (data.error) {
            console.error('Error loading users:', data.error);
            return;
        }
        
        users = data.users;
        renderUserList();
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

// Render user list
function renderUserList() {
    const userList = document.getElementById('userList');
    
    if (users.length === 0) {
        userList.innerHTML = `
            <div class="p-3 text-center text-muted">
                <i data-feather="users" class="mb-2"></i>
                <p class="mb-0">No other users found</p>
            </div>
        `;
        feather.replace();
        return;
    }
    
    userList.innerHTML = users.map(user => `
        <div class="list-group-item user-item d-flex align-items-center p-3" 
             onclick="selectUser('${user.id}', '${escapeHtml(user.name)}', '${user.profile_image_url || ''}')">
            ${user.profile_image_url ? 
                `<img src="${user.profile_image_url}" alt="${escapeHtml(user.name)}" class="rounded-circle me-3" width="40" height="40" style="object-fit: cover;">` :
                `<div class="rounded-circle me-3 profile-image-fallback" style="width: 40px; height: 40px;">
                    <i data-feather="user"></i>
                </div>`
            }
            <div class="flex-grow-1">
                <h6 class="mb-0">${escapeHtml(user.name)}</h6>
                <small class="text-muted">${user.email || 'No email'}</small>
            </div>
        </div>
    `).join('');
    
    feather.replace();
}

// Select user for chat
function selectUser(userId, userName, profileImageUrl) {
    currentChatUserId = userId;
    lastMessageId = 0;
    messages = [];
    
    // Update UI
    document.getElementById('noChatSelected').classList.add('d-none');
    document.getElementById('chatArea').classList.remove('d-none');
    
    // Update chat header
    document.getElementById('currentChatName').textContent = userName;
    const avatarElement = document.getElementById('currentChatAvatar');
    if (profileImageUrl) {
        avatarElement.src = profileImageUrl;
        avatarElement.style.display = 'block';
    } else {
        avatarElement.style.display = 'none';
    }
    
    // Highlight selected user
    document.querySelectorAll('.user-item').forEach(item => {
        item.classList.remove('active');
    });
    event.currentTarget.classList.add('active');
    
    // Load messages
    loadMessages(userId);
}

// Load messages for current chat
async function loadMessages(userId, isPolling = false) {
    if (!userId) return;
    
    try {
        const url = `/api/get_messages?user_id=${userId}&last_message_id=${isPolling ? lastMessageId : 0}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.error) {
            console.error('Error loading messages:', data.error);
            return;
        }
        
        if (isPolling) {
            // Only add new messages
            const newMessages = data.messages;
            if (newMessages.length > 0) {
                messages.push(...newMessages);
                renderNewMessages(newMessages);
                lastMessageId = Math.max(...newMessages.map(m => m.id));
            }
        } else {
            // Load all messages
            messages = data.messages;
            renderAllMessages();
            if (messages.length > 0) {
                lastMessageId = Math.max(...messages.map(m => m.id));
            }
        }
        
    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

// Render all messages
function renderAllMessages() {
    const container = document.getElementById('messagesContainer');
    const loadingElement = document.getElementById('loadingMessages');
    
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }
    
    if (messages.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i data-feather="message-circle" class="mb-2"></i>
                <p class="mb-0">No messages yet. Start the conversation!</p>
            </div>
        `;
        feather.replace();
        return;
    }
    
    container.innerHTML = messages.map(message => createMessageHTML(message)).join('');
    scrollToBottom();
    feather.replace();
}

// Render new messages (for polling)
function renderNewMessages(newMessages) {
    const container = document.getElementById('messagesContainer');
    const newMessagesHTML = newMessages.map(message => createMessageHTML(message)).join('');
    container.insertAdjacentHTML('beforeend', newMessagesHTML);
    scrollToBottom();
    feather.replace();
}

// Create HTML for a message
function createMessageHTML(message) {
    const currentUserId = '{{ current_user.id }}';
    const isSent = message.sender_id === currentUserId;
    const messageClass = isSent ? 'sent' : 'received';
    const cardClass = isSent ? 'bg-primary text-white' : 'bg-body-secondary';
    
    const sentimentColor = {
        'positive': 'sentiment-positive',
        'negative': 'sentiment-negative',
        'neutral': 'sentiment-neutral'
    }[message.sentiment] || 'sentiment-neutral';
    
    const timestamp = new Date(message.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    return `
        <div class="message-bubble ${messageClass}">
            <div class="card ${cardClass} border-0">
                <div class="card-body p-3">
                    <p class="mb-1">${escapeHtml(message.content)}</p>
                    <div class="d-flex align-items-center justify-content-between">
                        <small class="message-timestamp">${timestamp}</small>
                        <div class="d-flex align-items-center">
                            ${message.sentiment ? `<span class="sentiment-indicator ${sentimentColor}" title="Sentiment: ${message.sentiment}"></span>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Send message
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const content = input.value.trim();
    
    if (!content || !currentChatUserId) {
        return;
    }
    
    try {
        const response = await fetch('/api/send_message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                content: content,
                receiver_id: currentChatUserId
            })
        });
        
        const data = await response.json();
        
        if (data.error) {
            alert('Error sending message: ' + data.error);
            return;
        }
        
        // Clear input
        input.value = '';
        
        // Add message to local array and render
        messages.push(data.message);
        renderNewMessages([data.message]);
        lastMessageId = data.message.id;
        
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message. Please try again.');
    }
}

// Refresh messages
function refreshMessages() {
    if (currentChatUserId) {
        loadMessages(currentChatUserId);
    }
}

// Scroll to bottom of messages
function scrollToBottom() {
    const container = document.getElementById('messagesContainer');
    container.scrollTop = container.scrollHeight;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Message form submission
    const messageForm = document.getElementById('messageForm');
    if (messageForm) {
        messageForm.addEventListener('submit', function(e) {
            e.preventDefault();
            sendMessage();
        });
    }
    
    // Enter key to send message
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }
});

// Auto-resize message input
function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
}
