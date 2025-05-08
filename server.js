const express = require('express');
const path = require('path');
const axios = require('axios');
const { getAnimeVideoUrls } = require('./scraper');

const app = express();
const PORT = 3001;

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

// API Routes
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
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});