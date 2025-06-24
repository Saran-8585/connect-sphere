// Chat application JavaScript
let currentChatId = null;
let currentChatType = null; // 'user' or 'group'
let lastMessageId = 0;
let users = [];
let chats = [];
let messages = [];
let currentGroupInfo = null;

// Load chats (conversations and groups)
async function loadChats() {
    try {
        const response = await fetch('/api/get_chats');
        const data = await response.json();
        
        if (data.error) {
            console.error('Error loading chats:', data.error);
            return;
        }
        
        chats = data.chats;
        renderChatList();
    } catch (error) {
        console.error('Error loading chats:', error);
    }
}

// Load users for modals
async function loadUsersForModals() {
    try {
        const response = await fetch('/api/get_users');
        const data = await response.json();
        
        if (data.error) {
            console.error('Error loading users:', data.error);
            return;
        }
        
        users = data.users;
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

// Render chat list
function renderChatList() {
    const chatList = document.getElementById('chatList');
    
    if (chats.length === 0) {
        chatList.innerHTML = `
            <div class="p-3 text-center text-muted">
                <i data-feather="message-circle" class="mb-2"></i>
                <p class="mb-0">No chats yet</p>
                <small>Create a group or start a new chat</small>
            </div>
        `;
        feather.replace();
        return;
    }
    
    chatList.innerHTML = chats.map(chat => {
        const isGroup = chat.is_group;
        const avatarHtml = isGroup ? 
            `<div class="rounded-circle me-3 bg-primary d-flex align-items-center justify-content-center" style="width: 40px; height: 40px;">
                <i data-feather="users" class="text-white"></i>
            </div>` :
            (chat.profile_image_url ? 
                `<img src="${chat.profile_image_url}" alt="${escapeHtml(chat.name)}" class="rounded-circle me-3" width="40" height="40" style="object-fit: cover;">` :
                `<div class="rounded-circle me-3 profile-image-fallback" style="width: 40px; height: 40px;">
                    <i data-feather="user"></i>
                </div>`
            );
        
        const subtitle = isGroup ? 
            `${chat.member_count} members` :
            (chat.other_user?.email || 'Direct message');
            
        return `
            <div class="list-group-item chat-item user-item d-flex align-items-center p-3" 
                 onclick="selectChat('${chat.id}', '${isGroup ? 'group' : 'user'}', '${escapeHtml(chat.name)}')">
                ${avatarHtml}
                <div class="flex-grow-1">
                    <h6 class="mb-0">${escapeHtml(chat.name)}</h6>
                    <small class="text-muted">${subtitle}</small>
                </div>
                ${isGroup ? '<span class="badge bg-primary">Group</span>' : ''}
            </div>
        `;
    }).join('');
    
    feather.replace();
}

// Select chat (user or group)
function selectChat(chatId, chatType, chatName) {
    currentChatId = chatId;
    currentChatType = chatType;
    lastMessageId = 0;
    messages = [];
    
    // Update UI
    document.getElementById('noChatSelected').classList.add('d-none');
    document.getElementById('chatArea').classList.remove('d-none');
    
    // Update chat header
    document.getElementById('currentChatName').textContent = chatName;
    document.getElementById('refreshButton').style.display = 'block';
    
    const avatarElement = document.getElementById('currentChatAvatar');
    const infoElement = document.getElementById('currentChatInfo');
    const groupInfoButton = document.getElementById('groupInfoButton');
    
    if (chatType === 'group') {
        // Find group info
        const group = chats.find(c => c.id == chatId && c.is_group);
        currentGroupInfo = group;
        
        avatarElement.innerHTML = `
            <div class="rounded-circle me-3 bg-primary d-flex align-items-center justify-content-center" style="width: 40px; height: 40px;">
                <i data-feather="users" class="text-white"></i>
            </div>
        `;
        infoElement.textContent = `${group?.member_count || 0} members`;
        groupInfoButton.style.display = 'block';
        
        // Load group messages
        loadGroupMessages(chatId);
    } else {
        // Find user info
        const chat = chats.find(c => c.id == chatId && !c.is_group);
        const profileImageUrl = chat?.profile_image_url;
        
        if (profileImageUrl) {
            avatarElement.innerHTML = `<img src="${profileImageUrl}" alt="${escapeHtml(chatName)}" class="rounded-circle me-3" width="40" height="40" style="object-fit: cover;">`;
        } else {
            avatarElement.innerHTML = `
                <div class="rounded-circle me-3 profile-image-fallback" style="width: 40px; height: 40px;">
                    <i data-feather="user"></i>
                </div>
            `;
        }
        infoElement.textContent = 'Online';
        groupInfoButton.style.display = 'none';
        
        // Load direct messages
        loadMessages(chat?.other_user?.id || chatId);
    }
    
    // Highlight selected chat
    document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.remove('active');
    });
    event.currentTarget.classList.add('active');
    
    feather.replace();
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
    // Get current user ID from a global variable set by the template
    const currentUserId = window.currentUserId;
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
    
    // For group messages, show sender name if not sent by current user
    const isGroupMessage = message.is_group_message;
    const senderName = isGroupMessage && !isSent ? message.sender_name : '';
    const senderAvatar = isGroupMessage && !isSent && message.sender_profile_image ? 
        `<img src="${message.sender_profile_image}" alt="${escapeHtml(senderName)}" class="rounded-circle me-2" width="24" height="24" style="object-fit: cover;">` :
        (isGroupMessage && !isSent ? `<div class="rounded-circle me-2 bg-secondary d-flex align-items-center justify-content-center" style="width: 24px; height: 24px;"><i data-feather="user" style="width: 12px; height: 12px;"></i></div>` : '');
    
    return `
        <div class="message-bubble ${messageClass}">
            <div class="card ${cardClass} border-0">
                <div class="card-body p-3">
                    ${isGroupMessage && !isSent ? `
                        <div class="d-flex align-items-center mb-2">
                            ${senderAvatar}
                            <small class="fw-bold">${escapeHtml(senderName)}</small>
                        </div>
                    ` : ''}
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

// Send message (works for both direct and group chats)
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const content = input.value.trim();
    
    if (!content || !currentChatId || !currentChatType) {
        return;
    }
    
    try {
        let endpoint, body;
        
        if (currentChatType === 'group') {
            endpoint = '/api/send_group_message';
            body = {
                content: content,
                group_id: currentChatId
            };
        } else {
            endpoint = '/api/send_message';
            // For direct chat, we need to find the actual user ID
            const chat = chats.find(c => c.id == currentChatId && !c.is_group);
            body = {
                content: content,
                receiver_id: chat?.other_user?.id || currentChatId
            };
        }
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body)
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

// Load group messages
async function loadGroupMessages(groupId, isPolling = false) {
    if (!groupId) return;
    
    try {
        const url = `/api/get_group_messages?group_id=${groupId}&last_message_id=${isPolling ? lastMessageId : 0}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.error) {
            console.error('Error loading group messages:', data.error);
            return;
        }
        
        if (isPolling) {
            const newMessages = data.messages;
            if (newMessages.length > 0) {
                messages.push(...newMessages);
                renderNewMessages(newMessages);
                lastMessageId = Math.max(...newMessages.map(m => m.id));
            }
        } else {
            messages = data.messages;
            renderAllMessages();
            if (messages.length > 0) {
                lastMessageId = Math.max(...messages.map(m => m.id));
            }
        }
        
    } catch (error) {
        console.error('Error loading group messages:', error);
    }
}

// Refresh messages
function refreshMessages() {
    if (currentChatId && currentChatType) {
        if (currentChatType === 'group') {
            loadGroupMessages(currentChatId);
        } else {
            const chat = chats.find(c => c.id == currentChatId && !c.is_group);
            loadMessages(chat?.other_user?.id || currentChatId);
        }
    }
}

// Show create group modal
function showCreateGroupModal() {
    // Load users into checkboxes
    const container = document.getElementById('memberCheckboxes');
    container.innerHTML = users.map(user => `
        <div class="form-check">
            <input class="form-check-input" type="checkbox" value="${user.id}" id="member_${user.id}">
            <label class="form-check-label d-flex align-items-center" for="member_${user.id}">
                ${user.profile_image_url ? 
                    `<img src="${user.profile_image_url}" alt="${escapeHtml(user.name)}" class="rounded-circle me-2" width="24" height="24" style="object-fit: cover;">` :
                    `<div class="rounded-circle me-2 bg-secondary d-flex align-items-center justify-content-center" style="width: 24px; height: 24px;">
                        <i data-feather="user" style="width: 12px; height: 12px;"></i>
                    </div>`
                }
                ${escapeHtml(user.name)}
            </label>
        </div>
    `).join('');
    
    feather.replace();
    
    const modal = new bootstrap.Modal(document.getElementById('createGroupModal'));
    modal.show();
}

// Create group
async function createGroup() {
    try {
        const name = document.getElementById('groupName').value.trim();
        const description = document.getElementById('groupDescription').value.trim();
        const memberIds = Array.from(document.querySelectorAll('#memberCheckboxes input:checked')).map(cb => cb.value);
        
        if (!name) {
            alert('Group name is required');
            return;
        }
        
        if (memberIds.length === 0) {
            alert('Please select at least one member');
            return;
        }
        
        const response = await fetch('/api/create_group', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: name,
                description: description,
                member_ids: memberIds
            })
        });
        
        const data = await response.json();
        
        if (data.error) {
            alert('Error creating group: ' + data.error);
            return;
        }
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('createGroupModal'));
        modal.hide();
        
        // Clear form
        document.getElementById('createGroupForm').reset();
        
        // Reload chats
        loadChats();
        
        alert('Group created successfully!');
        
    } catch (error) {
        console.error('Error creating group:', error);
        alert('Failed to create group. Please try again.');
    }
}

// Show new chat modal
function showNewChatModal() {
    const container = document.getElementById('usersList');
    container.innerHTML = users.map(user => `
        <div class="list-group-item d-flex align-items-center p-3" style="cursor: pointer;" onclick="startDirectChat('${user.id}')">
            ${user.profile_image_url ? 
                `<img src="${user.profile_image_url}" alt="${escapeHtml(user.name)}" class="rounded-circle me-3" width="40" height="40" style="object-fit: cover;">` :
                `<div class="rounded-circle me-3 profile-image-fallback" style="width: 40px; height: 40px;">
                    <i data-feather="user"></i>
                </div>`
            }
            <div>
                <h6 class="mb-0">${escapeHtml(user.name)}</h6>
                <small class="text-muted">${user.email || 'No email'}</small>
            </div>
        </div>
    `).join('');
    
    feather.replace();
    
    const modal = new bootstrap.Modal(document.getElementById('newChatModal'));
    modal.show();
}

// Start direct chat
function startDirectChat(userId) {
    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('newChatModal'));
    modal.hide();
    
    // Find or create conversation
    selectChat(userId, 'user', users.find(u => u.id === userId)?.name || 'User');
}

// Show group info modal
function showGroupInfoModal() {
    if (!currentGroupInfo) return;
    
    const content = document.getElementById('groupInfoContent');
    content.innerHTML = `
        <div class="mb-3">
            <h6>Group Name</h6>
            <p class="text-muted">${escapeHtml(currentGroupInfo.name)}</p>
        </div>
        ${currentGroupInfo.description ? `
            <div class="mb-3">
                <h6>Description</h6>
                <p class="text-muted">${escapeHtml(currentGroupInfo.description)}</p>
            </div>
        ` : ''}
        <div class="mb-3">
            <h6>Members (${currentGroupInfo.member_count})</h6>
            <div class="list-group">
                ${currentGroupInfo.members.map(member => `
                    <div class="list-group-item d-flex align-items-center">
                        ${member.profile_image_url ? 
                            `<img src="${member.profile_image_url}" alt="${escapeHtml(member.name)}" class="rounded-circle me-3" width="32" height="32" style="object-fit: cover;">` :
                            `<div class="rounded-circle me-3 bg-secondary d-flex align-items-center justify-content-center" style="width: 32px; height: 32px;">
                                <i data-feather="user" style="width: 16px; height: 16px;"></i>
                            </div>`
                        }
                        <span>${escapeHtml(member.name)}</span>
                    </div>
                `).join('')}
            </div>
        </div>
        <div class="mb-3">
            <h6>Created by</h6>
            <p class="text-muted">${escapeHtml(currentGroupInfo.created_by)}</p>
        </div>
    `;
    
    feather.replace();
    
    const modal = new bootstrap.Modal(document.getElementById('groupInfoModal'));
    modal.show();
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
