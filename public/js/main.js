// Handle search form submission
document.getElementById('search-form')?.addEventListener('submit', function(e) {
  e.preventDefault();
  const query = this.query.value.trim();
  if (query) {
    window.location.href = `/search?query=${encodeURIComponent(query)}`;
  }
});

// Load search results
if (window.location.pathname === '/search') {
  const loadSearchResults = async () => {
    const query = new URLSearchParams(window.location.search).get('query');
    const resultsContainer = document.getElementById('search-results');
    const loadingElement = document.getElementById('loading');
    
    try {
      const response = await fetch(`/search-anime?query=${encodeURIComponent(query)}`);
      const results = await response.json();
      
      loadingElement.style.display = 'none';
      
      if (results.length === 0) {
        resultsContainer.innerHTML = '<p>No results found</p>';
        return;
      }
      
      resultsContainer.innerHTML = results.map(anime => `
        <div class="anime-card" onclick="window.location.href='/select?id=${anime.id}'">
          <img src="${anime.coverImage.large}" class="anime-poster" alt="${anime.title.romaji}">
          <div class="anime-info">
            <h3 class="anime-title">${anime.title.romaji || anime.title.english}</h3>
            <p class="anime-episodes">${anime.episodes || '?'} episodes</p>
          </div>
        </div>
      `).join('');
    } catch (error) {
      loadingElement.textContent = 'Error loading results. Please try again.';
      console.error('Search error:', error);
    }
  };
  
  window.addEventListener('load', loadSearchResults);
}

// Global variables to track loaded anime
let popularPage = 1;
let newPage = 1;
let updatedPage = 1;

// Load initial anime sections when homepage loads
if (window.location.pathname === '/') {
  document.addEventListener('DOMContentLoaded', () => {
    loadPopularAnime();
    loadNewAnime();
    loadUpdatedEpisodes();
  });
}

// Function to load popular anime
async function loadPopularAnime() {
  const container = document.getElementById('popular-anime');
  container.innerHTML = '<div class="loading-spinner"></div>';
  
  try {
    const response = await fetch(`/get-popular-anime?page=${popularPage}`);
    const results = await response.json();
    
    container.innerHTML = results.map(anime => createAnimeCard(anime)).join('');
  } catch (error) {
    container.innerHTML = '<p>Error loading popular anime</p>';
    console.error('Popular anime error:', error);
  }
}

// Function to load new anime
async function loadNewAnime() {
  const container = document.getElementById('new-anime');
  container.innerHTML = '<div class="loading-spinner"></div>';
  
  try {
    const response = await fetch(`/get-new-anime?page=${newPage}`);
    const results = await response.json();
    
    container.innerHTML = results.map(anime => createAnimeCard(anime)).join('');
  } catch (error) {
    container.innerHTML = '<p>Error loading new anime</p>';
    console.error('New anime error:', error);
  }
}

// Function to load updated episodes
async function loadUpdatedEpisodes() {
  const container = document.getElementById('updated-anime');
  container.innerHTML = '<div class="loading-spinner"></div>';
  
  try {
    const response = await fetch(`/get-updated-episodes?page=${updatedPage}`);
    const results = await response.json();
    
    container.innerHTML = results.map(anime => createAnimeCard(anime, true)).join('');
  } catch (error) {
    container.innerHTML = '<p>Error loading updated episodes</p>';
    console.error('Updated episodes error:', error);
  }
}

// Helper function to create anime card HTML
function createAnimeCard(anime, showLatestEpisode = false) {
  const title = anime.title.romaji || anime.title.english;
  const episodeInfo = showLatestEpisode && anime.latestEpisode ? 
    `Latest: Episode ${anime.latestEpisode}` : 
    `${anime.episodes || '?'} episodes`;
  
  return `
    <div class="anime-card" onclick="window.location.href='/select?id=${anime.id}'">
      <img src="${anime.coverImage.large}" class="anime-poster" alt="${title}">
      <div class="anime-info">
        <h3 class="anime-title">${title}</h3>
        <p class="anime-episodes">${episodeInfo}</p>
      </div>
    </div>
  `;
}

// Function to load more anime for a section
async function loadMore(section) {
  switch(section) {
    case 'popular':
      popularPage++;
      await loadPopularAnime();
      break;
    case 'new':
      newPage++;
      await loadNewAnime();
      break;
    case 'updated':
      updatedPage++;
      await loadUpdatedEpisodes();
      break;
  }
}

// Load anime details
if (window.location.pathname === '/select') {
  const loadAnimeDetails = async () => {
    const animeId = new URLSearchParams(window.location.search).get('id');
    
    try {
      const response = await fetch(`/get-anime-details?id=${animeId}`);
      const anime = await response.json();
      
      document.title = anime.title.romaji || anime.title.english;
      document.getElementById('anime-title').textContent = anime.title.romaji || anime.title.english;
      document.getElementById('anime-poster').src = anime.coverImage.large;
      document.getElementById('anime-poster').alt = anime.title.romaji;
      document.getElementById('episode-count').textContent = `${anime.episodes || '?'} episodes`;
      // In the loadAnimeDetails function:
      document.getElementById('anime-description').textContent = anime.description?.replace(/<[^>]*>/g, '') || 'No description available';
      
      const episodesContainer = document.getElementById('episodes-container');
      const episodeCount = anime.episodes || 12;
      
      episodesContainer.innerHTML = Array.from({ length: episodeCount }, (_, i) => 
        `<a href="/play?title=${encodeURIComponent(anime.title.romaji)}&episode=${i+1}" class="episode-btn">Episode ${i+1}</a>`
      ).join('');
    } catch (error) {
      document.getElementById('anime-title').textContent = 'Error loading anime details';
      console.error('Anime details error:', error);
    }
  };
  
  window.addEventListener('load', loadAnimeDetails);
}

// Load video player
// Replace the entire video player section in main.js with this:

if (window.location.pathname === '/play') {
  let currentVideoUrl = '';
  let isPlayerInitialized = false;

  const loadVideoPlayer = async () => {
    const params = new URLSearchParams(window.location.search);
    const title = params.get('title');
    const episode = params.get('episode');
    
    document.getElementById('player-title').textContent = `${title} - Episode ${episode}`;
    showLoadingOverlay(true);

    try {
      const response = await fetch(`/get-video-urls?title=${encodeURIComponent(title)}&episode=${episode}`);
      const { videoUrls } = await response.json();
      
      if (videoUrls.length === 0) throw new Error('No video sources found');
      
      currentVideoUrl = videoUrls[0];
      initializeVideoPlayer(currentVideoUrl);

      if (videoUrls.length > 1) {
        const qualityButtons = document.getElementById('quality-buttons');
        qualityButtons.innerHTML = videoUrls.map((url, index) => 
          `<button class="quality-btn" onclick="changeQuality(${index})">Quality ${index + 1}</button>`
        ).join('');
        document.getElementById('quality-options').style.display = 'block';
      }

    } catch (error) {
      console.error('Player error:', error);
      document.getElementById('player-title').textContent = 'Error loading video';
      showLoadingOverlay(false);
    }
  };

  function initializeVideoPlayer(videoUrl) {
    const videoPlayer = document.getElementById('video-player');
    
    // Clear existing sources
    videoPlayer.innerHTML = '';
    
    const source = document.createElement('source');
    source.src = `/stream?url=${encodeURIComponent(videoUrl)}`;
    source.type = 'video/mp4';
    videoPlayer.appendChild(source);
    
    // Restore playback position if available
    const savedTime = localStorage.getItem('videoTime');
    if (savedTime) {
      videoPlayer.currentTime = parseFloat(savedTime);
    }

    videoPlayer.load();
    
    videoPlayer.addEventListener('loadeddata', () => {
      showLoadingOverlay(false);
      if (!isPlayerInitialized) {
        videoPlayer.play().catch(e => console.log('Autoplay prevented:', e));
        isPlayerInitialized = true;
      }
    });

    videoPlayer.addEventListener('waiting', () => {
      showLoadingOverlay(true);
    });

    videoPlayer.addEventListener('playing', () => {
      showLoadingOverlay(false);
    });

    videoPlayer.addEventListener('error', () => {
      showLoadingOverlay(false);
      console.error('Video error:', videoPlayer.error);
    });

    // Save playback position
    videoPlayer.addEventListener('timeupdate', () => {
      if (videoPlayer.currentTime > 5) {
        localStorage.setItem('videoTime', videoPlayer.currentTime);
      }
    });
  }

  window.changeQuality = async (index) => {
    const params = new URLSearchParams(window.location.search);
    const title = params.get('title');
    const episode = params.get('episode');
    
    showLoadingOverlay(true);
    
    try {
      const response = await fetch(`/get-video-urls?title=${encodeURIComponent(title)}&episode=${episode}`);
      const { videoUrls } = await response.json();
      
      if (videoUrls[index]) {
        currentVideoUrl = videoUrls[index];
        initializeVideoPlayer(currentVideoUrl);
      }
    } catch (error) {
      console.error('Quality change error:', error);
      showLoadingOverlay(false);
    }
  };

  function showLoadingOverlay(show) {
    const overlay = document.getElementById('loading-overlay');
    overlay.style.display = show ? 'flex' : 'none';
  }

  window.addEventListener('load', loadVideoPlayer);
}