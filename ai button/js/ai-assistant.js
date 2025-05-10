const floatingButton = document.getElementById('floating-button');
const floatingWindow = document.getElementById('floating-window');
const chatContainer = document.getElementById('chat-container');
const userInput = document.getElementById('userInput');
const sendButton = document.getElementById('send-button');
const closeButton = document.getElementById('close-button');
const typingIndicator = document.getElementById('typing-indicator');

// State
let isDragging = false;
let isWindowOpen = false;
let chatHistory = [
  { role: 'assistant', content: "Hello! I'm your AI assistant. How can I help you today?" }
];
let dragStartX = 0;
let dragStartLeft = 0;
let dragStartRight = 0;

function handleDragMove(e) {
  isDragging = true;
  
  // Calculate horizontal movement only (locked to bottom)
  const deltaX = e.clientX - dragStartX;
  
  if (floatingButton.style.right === 'auto') {
    // Moving from left position
    const newLeft = dragStartLeft + deltaX;
    floatingButton.style.left = `${newLeft}px`;
    floatingButton.style.right = 'auto';
  } else {
    // Moving from right position
    const newRight = dragStartRight - deltaX;
    floatingButton.style.right = `${newRight}px`;
    floatingButton.style.left = 'auto';
  }
}


function handleDragEnd() {
  // Remove dragging class to re-enable transitions
  floatingButton.classList.remove('dragging');
  
  document.removeEventListener('mousemove', handleDragMove);
  document.removeEventListener('mouseup', handleDragEnd);
  
  if (isDragging) {
    // Snap to nearest edge
    const buttonRect = floatingButton.getBoundingClientRect();
    const isNearLeft = buttonRect.left < window.innerWidth / 2;
    
    if (isNearLeft) {
      floatingButton.style.left = '24px';
      floatingButton.style.right = 'auto';
    } else {
      floatingButton.style.left = 'auto';
      floatingButton.style.right = '24px';
    }
    
    // Update window position if open
    if (isWindowOpen) {
      positionWindowRelativeToButton();
    }
  }
}

function positionWindowRelativeToButton() {
  const buttonRect = floatingButton.getBoundingClientRect();
  floatingWindow.style.bottom = `${window.innerHeight - buttonRect.top + 20}px`;
  
  if (buttonRect.left + buttonRect.width/2 < window.innerWidth/2) {
    floatingWindow.style.left = `${buttonRect.left}px`;
    floatingWindow.style.right = 'auto';
  } else {
    floatingWindow.style.right = `${window.innerWidth - buttonRect.right}px`;
    floatingWindow.style.left = 'auto';
  }
}

// Toggle window visibility
function toggleWindow() {
  isWindowOpen = !isWindowOpen;
  
  if (isWindowOpen) {
    floatingWindow.style.display = 'block';
    setTimeout(() => {
      floatingWindow.classList.add('active');
      positionWindowRelativeToButton();
    }, 10);
    userInput.focus();
    floatingButton.classList.remove('pulse');
  } else {
    floatingWindow.classList.remove('active');
    setTimeout(() => {
      floatingWindow.style.display = 'none';
    }, 300);
  }
}

// Add message to chat
function addMessage(role, content) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message ${role}-message animate__animated animate__fadeIn`;
  
  const markdownContent = document.createElement('div');
  markdownContent.className = 'markdown-content';
  markdownContent.innerHTML = marked.parse(content);
  
  messageDiv.appendChild(markdownContent);
  chatContainer.appendChild(messageDiv);
  
  setTimeout(() => {
    chatContainer.scrollTo({
      top: chatContainer.scrollHeight,
      behavior: 'smooth'
    });
  }, 50);
}

// Send message to AI (using your working API config)
async function sendMessage() {
  const input = userInput.value.trim();
  if (!input) return;
  
  addMessage('user', input);
  chatHistory.push({ role: 'user', content: input });
  userInput.value = '';
  
  typingIndicator.style.display = 'flex';
  chatContainer.scrollTo({
    top: chatContainer.scrollHeight,
    behavior: 'smooth'
  });
  
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer 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',
        'HTTP-Referer': 'https://www.vinzgwapo.com',
        'X-Title': 'VinzGwapo',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-r1:free',
        messages: chatHistory
      })
    });
    
    const data = await response.json();
    console.log("API Response:", data); // Debugging
    
    if (!response.ok) {
      throw new Error(data.error?.message || "API request failed");
    }
    
    const botResponse = data.choices?.[0]?.message?.content || "Sorry, I couldn't process your request.";
    addMessage('bot', botResponse);
    chatHistory.push({ role: 'assistant', content: botResponse });
    
  } catch (error) {
    console.error("Error:", error);
    addMessage('bot', `Error: ${error.message}`);
  } finally {
    typingIndicator.style.display = 'none';
  }
}

floatingButton.addEventListener('mousedown', function(e) {
  isDragging = false;
  dragStartX = e.clientX;
  
  // Get current position
  const buttonRect = floatingButton.getBoundingClientRect();
  dragStartLeft = buttonRect.left;
  dragStartRight = window.innerWidth - buttonRect.right;
  
  // Check if we're starting from left or right position
  const isStartingFromRight = floatingButton.style.left === 'auto';
  
  // Add dragging class to disable transitions
  floatingButton.classList.add('dragging');

  function handleMouseMove(e) {
    isDragging = true;
    const deltaX = e.clientX - dragStartX;
    
    if (isStartingFromRight) {
      // Moving from right position
      const newRight = Math.max(0, dragStartRight - deltaX);
      floatingButton.style.right = `${newRight}px`;
      floatingButton.style.left = 'auto';
    } else {
      // Moving from left position
      const newLeft = Math.max(0, dragStartLeft + deltaX);
      floatingButton.style.left = `${newLeft}px`;
      floatingButton.style.right = 'auto';
    }
    
    // Update window position if open
    if (isWindowOpen) {
      positionWindowRelativeToButton();
    }
  }

  function handleMouseUp() {
    // Remove event listeners
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    
    // Remove dragging class to re-enable transitions
    floatingButton.classList.remove('dragging');
    
    if (isDragging) {
      // Snap to nearest edge
      const buttonRect = floatingButton.getBoundingClientRect();
      const isNearLeft = buttonRect.left < window.innerWidth / 2;
      
      // Apply smooth transition for snap
      floatingButton.style.transition = 'left 0.3s ease, right 0.3s ease';
      
      if (isNearLeft) {
        floatingButton.style.left = '24px';
        floatingButton.style.right = 'auto';
      } else {
        floatingButton.style.left = 'auto';
        floatingButton.style.right = '24px';
      }
      
      // Update window position if open
      if (isWindowOpen) {
        positionWindowRelativeToButton();
      }
      
      // Remove transition after snap completes
      setTimeout(() => {
        floatingButton.style.transition = '';
      }, 300);
    }
  }
  
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
});

// Event listeners
floatingButton.addEventListener('click', function(e) {
  if (!isDragging) toggleWindow();
});

closeButton.addEventListener('click', toggleWindow);
sendButton.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', function(e) {
  if (e.key === 'Enter') sendMessage();
});

// Close when clicking outside
document.addEventListener('click', function(e) {
  if (isWindowOpen && 
      !floatingWindow.contains(e.target) && 
      !floatingButton.contains(e.target)) {
    toggleWindow();
  }
});

// Prevent window close when clicking inside
floatingWindow.addEventListener('click', function(e) {
  e.stopPropagation();
});

// Add pulse animation on load
floatingButton.classList.add('pulse');
