// WebRTC Audio Call with Signaling
const userId = 'user-' + Math.random().toString(36).substr(2, 9);
let currentCallId = null;
let localStream = null;
let peerConnections = {};
let dataChannels = {};
let isMuted = false;
let socket = null;

// DOM elements
const startCallBtn = document.getElementById('startCall');
const joinCallBtn = document.getElementById('joinCall');
const leaveCallBtn = document.getElementById('leaveCall');
const toggleMicBtn = document.getElementById('toggleMic');
const participantsList = document.getElementById('participantsList');
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendMessageBtn = document.getElementById('sendMessage');
const callIdDisplay = document.getElementById('callIdDisplay');
const callIdText = document.getElementById('callIdText');
const copyCallIdBtn = document.getElementById('copyCallId');

// Connect to signaling server
connectSignalingServer();

// Event listeners
startCallBtn.addEventListener('click', startCall);
joinCallBtn.addEventListener('click', joinCall);
leaveCallBtn.addEventListener('click', leaveCall);
toggleMicBtn.addEventListener('click', toggleMic);
sendMessageBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});
copyCallIdBtn.addEventListener('click', copyCallId);

async function connectSignalingServer() {
    // In production, replace with your server URL
    socket = io('http://localhost:3000');
    
    socket.on('connect', () => {
        console.log('Connected to signaling server');
        socket.emit('register', userId);
    });

    socket.on('userJoined', (userId) => {
        console.log('User joined:', userId);
        addParticipant(userId, false);
        addMessage('system', `${userId} joined the call`);
        
        if (currentCallId && userId !== userId) {
            createPeerConnection(userId);
        }
    });

    socket.on('signal', async ({ from, signal }) => {
        if (!peerConnections[from]) {
            await createPeerConnection(from);
        }
        
        if (signal.type === 'offer') {
            await peerConnections[from].setRemoteDescription(
                new RTCSessionDescription(signal)
            );
            const answer = await peerConnections[from].createAnswer();
            await peerConnections[from].setLocalDescription(answer);
            socket.emit('signal', { to: from, signal: answer });
        } else if (signal.type === 'answer') {
            await peerConnections[from].setRemoteDescription(
                new RTCSessionDescription(signal)
            );
        } else if (signal.candidate) {
            await peerConnections[from].addIceCandidate(
                new RTCIceCandidate(signal)
            );
        }
    });

    socket.on('newMessage', (messageData) => {
        // Make sure we're dealing with the correct format
        if (typeof messageData === 'object' && messageData.message) {
            if (messageData.from !== userId) {
                addMessage(messageData.from, messageData.message, new Date(messageData.timestamp));
            }
        } else {
            // Fallback for plain text messages
            if (messageData.from !== userId) {
                addMessage(messageData.from, messageData, new Date());
            }
        }
    });
}

async function startCall() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        currentCallId = 'call-' + Math.random().toString(36).substr(2, 9);
        
        showCallId(currentCallId);
        startCallBtn.disabled = true;
        joinCallBtn.disabled = true;
        leaveCallBtn.disabled = false;
        
        // Clear and add yourself as creator
        participantsList.innerHTML = '';
        addParticipant(userId, true, true);  // true for isCreator
        
        addMessage('system', `Call started. You are the Housemaster. Share this ID to invite others: ${currentCallId}`);
        
        socket.emit('createCall', currentCallId);
    } catch (error) {
        console.error('Error starting call:', error);
        alert('Failed to access microphone. Please check permissions.');
    }
}

async function joinCall() {
    const callId = prompt("Enter Call ID:");
    if (!callId) return;

    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        currentCallId = callId;
        
        startCallBtn.disabled = true;
        joinCallBtn.disabled = true;
        leaveCallBtn.disabled = false;
        
        // Clear participants list - it will be populated by the updateParticipants event
        participantsList.innerHTML = '';
        
        addMessage('system', `Joining call ${callId}...`);
        
        socket.emit('joinCall', callId);
    } catch (error) {
        console.error('Error joining call:', error);
        alert('Failed to access microphone. Please check permissions.');
    }
}

async function createPeerConnection(targetUserId) {
    const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    
    peerConnections[targetUserId] = pc;

    // Add local stream
    if (localStream) {
        localStream.getTracks().forEach(track => {
            pc.addTrack(track, localStream);
        });
    }

    // Handle remote stream
    pc.ontrack = (event) => {
        const audio = document.createElement('audio');
        audio.srcObject = event.streams[0];
        audio.autoplay = true;
        document.body.appendChild(audio);
    };

    // ICE candidates
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('signal', {
                to: targetUserId,
                signal: {
                    candidate: event.candidate,
                    type: 'candidate'
                }
            });
        }
    };

    // Data channel for chat
    if (userId < targetUserId) { // Only create channel for one peer to avoid duplicates
        const dc = pc.createDataChannel('chat');
        setupDataChannel(dc, targetUserId);
    } else {
        pc.ondatachannel = (event) => {
            setupDataChannel(event.channel, targetUserId);
        };
    }

    // Create offer if we initiated the connection
    if (userId < targetUserId) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('signal', {
            to: targetUserId,
            signal: offer
        });
    }

    return pc;
}

function setupDataChannel(dc, targetUserId) {
    dataChannels[targetUserId] = dc;

    dc.onopen = () => {
        console.log(`Data channel with ${targetUserId} open`);
    };

    dc.onmessage = (event) => {
        const { from, message, timestamp } = JSON.parse(event.data);
        addMessage(from, message, new Date(timestamp));
    };

    dc.onmessage = (event) => {
        try {
            const messageData = JSON.parse(event.data);
            if (messageData.from && messageData.message) {
                if (messageData.from !== userId) {
                    addMessage(messageData.from, messageData.message, new Date(messageData.timestamp));
                }
            } else {
                // Fallback for plain text
                if (event.data !== userId) {
                    addMessage(targetUserId, event.data, new Date());
                }
            }
        } catch (e) {
            console.error('Error parsing message:', e);
            // Fallback - just display the raw data
            addMessage(targetUserId, event.data, new Date());
        }
    };

    dc.onclose = () => {
        console.log(`Data channel with ${targetUserId} closed`);
        delete dataChannels[targetUserId];
    };

    dc.onmessage = (event) => {
        const messageData = JSON.parse(event.data);
        // Only display if not from ourselves
        if (messageData.from !== userId) {
            addMessage(messageData.from, messageData.message, new Date(messageData.timestamp));
        }
    };
}

function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || !currentCallId) return;

    const messageData = {
        from: userId,
        message: message,
        timestamp: new Date().toISOString()
    };

    // First try data channels
    let sentViaDataChannel = false;
    Object.values(dataChannels).forEach(dc => {
        if (dc.readyState === 'open') {
            dc.send(JSON.stringify(messageData));
            sentViaDataChannel = true;
        }
    });

    // Fallback to signaling server
    if (!sentViaDataChannel) {
        socket.emit('sendMessage', {
            callId: currentCallId,
            message: messageData
        });
    }

    // Add to local chat
    addMessage(userId, message);
    messageInput.value = '';
}

// UI Functions (keep these the same as before)
function showCallId(callId) {
    callIdDisplay.style.display = 'flex';
    callIdText.textContent = callId;
}

function copyCallId() {
    if (!currentCallId) return;
    navigator.clipboard.writeText(currentCallId).then(() => {
        const originalText = copyCallIdBtn.textContent;
        copyCallIdBtn.textContent = 'Copied!';
        setTimeout(() => copyCallIdBtn.textContent = originalText, 2000);
    });
}

function addParticipant(id, isLocal, isCreator = false) {
    // Remove existing if present
    const existing = document.getElementById(`participant-${id}`);
    if (existing) existing.remove();

    const participantDiv = document.createElement('div');
    participantDiv.className = 'participant';
    participantDiv.id = `participant-${id}`;
    
    const micIcon = document.createElement('div');
    micIcon.innerHTML = '🎤';
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'participant-name';
    
    let displayName = isLocal ? 'You' : id;
    if (isCreator) {
        displayName += ' (Housemaster)';
        nameSpan.classList.add('housemaster');
    }
    nameSpan.textContent = displayName;
    
    participantDiv.appendChild(micIcon);
    participantDiv.appendChild(nameSpan);
    participantsList.appendChild(participantDiv);
}

function addMessage(sender, text, timestamp = new Date()) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    
    const senderSpan = document.createElement('span');
    senderSpan.className = 'message-sender';
    senderSpan.textContent = sender === userId ? 'You' : sender;
    
    const timeSpan = document.createElement('span');
    timeSpan.className = 'message-time';
    timeSpan.textContent = timestamp.toLocaleTimeString();
    
    const textDiv = document.createElement('div');
    textDiv.textContent = text;
    
    messageDiv.appendChild(senderSpan);
    messageDiv.appendChild(timeSpan);
    messageDiv.appendChild(textDiv);
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function toggleMic() {
    if (!localStream) return;
    isMuted = !isMuted;
    localStream.getAudioTracks()[0].enabled = !isMuted;
    toggleMicBtn.textContent = isMuted ? 'Unmute Mic' : 'Mute Mic';
}

function leaveCall() {
    // Stop local stream
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    
    // Close all peer connections
    Object.values(peerConnections).forEach(pc => pc.close());
    
    // Reset state
    localStream = null;
    currentCallId = null;
    peerConnections = {};
    dataChannels = {};
    
    // Update UI
    startCallBtn.disabled = false;
    joinCallBtn.disabled = false;
    leaveCallBtn.disabled = true;
    callIdDisplay.style.display = 'none';
    participantsList.innerHTML = '';
    
    // Notify server
    if (socket) socket.emit('leaveCall');

    
socket.on('userLeft', (userId) => {
    // Remove participant from UI
    const participantElement = document.getElementById(`participant-${userId}`);
    if (participantElement) {
        participantElement.remove();
    }
    
    // Close connection if it exists
    if (peerConnections[userId]) {
        peerConnections[userId].close();
        delete peerConnections[userId];
    }
    
    // Remove data channel if it exists
    if (dataChannels[userId]) {
        delete dataChannels[userId];
    }
    
    addMessage('system', `${userId} left the call`);
});

socket.on('initialParticipants', ({ participants, host }) => {
    participantsList.innerHTML = '';
    participants.forEach(participantId => {
        const isLocal = participantId === userId;
        const isCreator = participantId === host;
        addParticipant(participantId, isLocal, isCreator);
    });
});
    
    addMessage('system', 'You have left the call.');
}

// Update the updateParticipants event handler
socket.on('updateParticipants', ({ participants, newUser }) => {
    // Clear current participant list
    participantsList.innerHTML = '';
    
    // Get the call host from the server (you might need to modify this based on your implementation)
    const isHost = currentCallId && activeCalls[currentCallId]?.host === userId;
    
    // Add all participants
    participants.forEach(participantId => {
        const isLocal = participantId === userId;
        const isCreator = activeCalls[currentCallId]?.host === participantId;
        
        addParticipant(participantId, isLocal, isCreator);
    });
    
    // Notify chat if it's a new user
    if (newUser && newUser !== userId) {
        addMessage('system', `${newUser} joined the call`);
    }
});

// Update the addParticipant function
function addParticipant(id, isLocal, isCreator = false) {
    const existing = document.getElementById(`participant-${id}`);
    if (existing) return;

    const participantDiv = document.createElement('div');
    participantDiv.className = 'participant';
    participantDiv.id = `participant-${id}`;
    
    const micIcon = document.createElement('div');
    micIcon.innerHTML = '🎤';
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'participant-name';
    
    let displayName = isLocal ? 'You' : id;
    if (isCreator) {
        displayName += ' (Housemaster)';
    }
    nameSpan.textContent = displayName;
    
    participantDiv.appendChild(micIcon);
    participantDiv.appendChild(nameSpan);
    participantsList.appendChild(participantDiv);
}
