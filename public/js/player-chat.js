// player-chat.js
const socket = io('http://localhost:3001');
let currentEpisode = null;

function initializeChat() {
    const urlParams = new URLSearchParams(window.location.search);
    const episodeTitle = urlParams.get('title');
    const episodeNumber = urlParams.get('episode');
    currentEpisode = `${episodeTitle}-ep${episodeNumber}`;
    
    socket.emit('join-episode-chat', {
        episode: currentEpisode,
        username: `User-${Math.random().toString(36).substr(2, 4)}`
    });
}

// Event listeners
document.getElementById('sendMessage').addEventListener('click', sendChatMessage);
document.getElementById('messageInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChatMessage();
});

function sendChatMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();
    if (!message) return;

    socket.emit('episode-chat-message', {
        episode: currentEpisode,
        message: message
    });

    input.value = '';
}

// Socket event handlers
socket.on('episode-chat-update', (data) => {
    document.getElementById('viewerCount').textContent = data.viewerCount;
});

socket.on('episode-chat-message', (message) => {
    addChatMessage(message.username, message.text, new Date(message.timestamp));
});

// In addChatMessage function, replace innerHTML with textContent
function addChatMessage(username, message, timestamp) {
  const chatMessages = document.getElementById('chatMessages');
  const messageDiv = document.createElement('div');
  messageDiv.className = 'chat-message';
  
  // Get first letter of username
  const initial = username.charAt(0).toUpperCase();
  
  messageDiv.innerHTML = `
    <div class="message-header">
      <span class="message-username" data-initial="${initial}">${username}</span>
      <span class="message-time">${timestamp.toLocaleTimeString()}</span>
    </div>
    <div class="message-content">${message}</div>
  `;
  
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Initialize when video loads
document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('title') && urlParams.has('episode')) {
    initializeChat();
  }
});