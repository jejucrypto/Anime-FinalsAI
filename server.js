const express = require('express');
const path = require('path');
const axios = require('axios');
const { getAnimeVideoUrls } = require('./scraper');

//for chats
const http = require('http');
const socketIo = require('socket.io');
const episodeChats = new Map();

const users = {};
const activeCalls = {};

const app = express();
const PORT = 3001;

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});



// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'views')));
app.use(express.urlencoded({ extended: true }));

// API Routes

// Popular Anime
app.get('/get-popular-anime', async (req, res) => {
  try {
    const page = req.query.page || 1;
    const response = await axios.post('https://graphql.anilist.co', {
      query: `
        query ($page: Int, $perPage: Int) {
          Page(page: $page, perPage: $perPage) {
            media(sort: POPULARITY_DESC, type: ANIME) {
              id
              title {
                romaji
                english
              }
              coverImage {
                large
              }
              episodes
            }
          }
        }
      `,
      variables: { page, perPage: 10 }
    });
    res.json(response.data.data.Page.media);
  } catch (error) {
    console.error('Popular anime error:', error);
    res.status(500).json({ error: 'Error loading popular anime' });
  }
});

// New Anime
app.get('/get-new-anime', async (req, res) => {
  try {
    const page = req.query.page || 1;
    const response = await axios.post('https://graphql.anilist.co', {
      query: `
        query ($page: Int, $perPage: Int) {
          Page(page: $page, perPage: $perPage) {
            media(sort: START_DATE_DESC, type: ANIME, status: RELEASING) {
              id
              title {
                romaji
                english
              }
              coverImage {
                large
              }
              episodes
            }
          }
        }
      `,
      variables: { page, perPage: 10 }
    });
    res.json(response.data.data.Page.media);
  } catch (error) {
    console.error('New anime error:', error);
    res.status(500).json({ error: 'Error loading new anime' });
  }
});

// Updated Episodes
app.get('/get-updated-episodes', async (req, res) => {
  try {
    const page = req.query.page || 1;
    const response = await axios.post('https://graphql.anilist.co', {
      query: `
        query ($page: Int, $perPage: Int) {
          Page(page: $page, perPage: $perPage) {
            media(sort: UPDATED_AT_DESC, type: ANIME) {
              id
              title {
                romaji
                english
              }
              coverImage {
                large
              }
              episodes
              nextAiringEpisode {
                episode
              }
            }
          }
        }
      `,
      variables: { page, perPage: 10 }
    });
    
    // Add latest episode info
    const results = response.data.data.Page.media.map(anime => ({
      ...anime,
      latestEpisode: anime.nextAiringEpisode?.episode ? anime.nextAiringEpisode.episode - 1 : anime.episodes
    }));
    
    res.json(results);
  } catch (error) {
    console.error('Updated episodes error:', error);
    res.status(500).json({ error: 'Error loading updated episodes' });
  }
});

app.get('/search-anime', async (req, res) => {
  try {
    const response = await axios.post('https://graphql.anilist.co', {
      query: `
        query ($search: String) {
          Page(page: 1, perPage: 10) {
            media(search: $search, type: ANIME) {
              id
              title {
                romaji
                english
              }
              coverImage {
                large
              }
              episodes
            }
          }
        }
      `,
      variables: { search: req.query.query }
    });
    res.json(response.data.data.Page.media);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Error searching anime' });
  }
});

app.get('/get-anime-details', async (req, res) => {
  try {
    const response = await axios.post('https://graphql.anilist.co', {
      query: `
        query ($id: Int) {
          Media(id: $id) {
            id
            title {
              romaji
              english
            }
            coverImage {
              large
            }
            episodes
          }
        }
      `,
      variables: { id: parseInt(req.query.id) }
    });
    res.json(response.data.data.Media);
  } catch (error) {
    console.error('Anime details error:', error);
    res.status(500).json({ error: 'Error loading anime details' });
  }
});

app.get('/get-video-urls', async (req, res) => {
  try {
    const videoUrls = await getAnimeVideoUrls(req.query.title, req.query.episode);
    res.json({ videoUrls });
  } catch (error) {
    console.error('Video URLs error:', error);
    res.status(500).json({ error: 'Error getting video URLs' });
  }
});

app.get('/stream', async (req, res) => {
  try {
    const videoUrl = decodeURIComponent(req.query.url);
    const range = req.headers.range;
    const headers = {
      'Referer': 'https://animeheaven.me/',
      'Origin': 'https://animeheaven.me/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    };
    if (range) {
      headers['Range'] = range;
    }

    const response = await axios({
      method: 'get',
      url: videoUrl,
      responseType: 'stream',
      headers: headers,
      validateStatus: status => status >= 200 && status < 500 // Accept 206 and 200
    });

    // Forward headers for partial content
    if (response.status === 206) {
      res.status(206);
      res.set({
        'Content-Type': response.headers['content-type'],
        'Content-Length': response.headers['content-length'],
        'Content-Range': response.headers['content-range'],
        'Accept-Ranges': 'bytes'
      });
    } else {
      res.set({
        'Content-Type': response.headers['content-type'],
        'Content-Length': response.headers['content-length'],
        'Accept-Ranges': 'bytes'
      });
    }

    response.data.pipe(res);
  } catch (error) {
    console.error('Stream error:', error.message);
    res.status(500).send('Error streaming video');
  }
});

//for chats
io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}`);

  socket.on('register', (userId) => {
    users[userId] = socket.id;
    socket.userId = userId;
    console.log(`User registered: ${userId}`);
  });

  socket.on('createCall', (callId) => {
    activeCalls[callId] = {
        host: socket.userId,  // Track who created the call
        participants: [socket.userId]
    };
    socket.join(callId);
    console.log(`Call created: ${callId} by ${socket.userId}`);
});

socket.on('joinCall', (callId) => {
  if (activeCalls[callId]) {
      activeCalls[callId].participants.push(socket.userId);
      socket.join(callId);
      
      // Send current participant list to the new joiner
      socket.emit('initialParticipants', {
          participants: activeCalls[callId].participants,
          host: activeCalls[callId].host
      });
      
      // Notify others about the new participant
      socket.to(callId).emit('userJoined', socket.userId);
      
      console.log(`${socket.userId} joined call ${callId}`);
  }
});

socket.on('join-episode-chat', ({ episode, username }) => {
  socket.join(episode);
  socket.episodeChat = episode;
  socket.username = username;

  // Update viewer count
  const viewers = io.sockets.adapter.rooms.get(episode)?.size || 0;
  episodeChats.set(episode, (episodeChats.get(episode) || new Set()).add(socket.id));
  
  io.to(episode).emit('episode-chat-update', {
      viewerCount: viewers
  }); 
});

socket.on('episode-chat-message', ({ episode, message }) => {
  io.to(episode).emit('episode-chat-message', {
      username: socket.username,
      text: message,
      timestamp: new Date().toISOString()
  });
});

// Remove the second disconnect handler and modify the first one:
socket.on('disconnect', () => {
  // Episode chat cleanup
  if (socket.episodeChat) {
    const episode = socket.episodeChat;
    const viewers = io.sockets.adapter.rooms.get(episode)?.size || 0;
    
    io.to(episode).emit('episode-chat-update', {
      viewerCount: viewers - 1
    });
    
    // Clean up empty rooms
    if (viewers <= 1) {
      episodeChats.delete(episode);
    }
  }

  // Voice call cleanup
  if (socket.userId) {
    delete users[socket.userId];
    console.log(`User disconnected: ${socket.userId}`);
  }
});

  socket.on('signal', ({ to, signal }) => {
    if (users[to]) {
      io.to(users[to]).emit('signal', {
        from: socket.userId,
        signal
      });
    }
  });

  socket.on('sendMessage', ({ callId, message }) => {
    // Ensure proper message format
    const formattedMessage = typeof message === 'string' ? {
        from: socket.userId,
        message: message,
        timestamp: new Date().toISOString()
    } : message;
    
    io.to(callId).emit('newMessage', formattedMessage);
});
});

// HTML Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/search', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'search.html'));
});

app.get('/select', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'anime.html'));
});

app.get('/play', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'player.html'));
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});