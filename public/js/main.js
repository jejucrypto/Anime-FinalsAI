// Handle search form submission
document.getElementById('search-form')?.addEventListener('submit', function(e) {
  e.preventDefault();
  const query = this.query.value.trim();
  if (query) {
    window.location.href = `/search?query=${encodeURIComponent(query)}`;
  }
});

// Helper function to query AniList API
async function queryAniList(query, variables = {}) {
  const url = 'https://graphql.anilist.co';
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables
    })
  };

  try {
    const response = await fetch(url, options);
    return await response.json();
  } catch (error) {
    console.error('AniList API error:', error);
    return null;
  }
}

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
      
      // Basic info
      document.title = anime.title.romaji || anime.title.english;
      document.getElementById('anime-title').textContent = anime.title.romaji || anime.title.english;
      document.getElementById('anime-poster').src = anime.coverImage.large;
      document.getElementById('anime-poster').alt = anime.title.romaji;
      
      // Description
      const description = anime.description?.replace(/<[^>]*>/g, '') || 'No description available';
      document.getElementById('anime-description').textContent = description;
      
      // Enhanced anime stats section
      const animeStatsHTML = `
        <div class="anime-stats-grid">
          ${anime.averageScore ? `
            <div class="stat-item">
              <span class="stat-label">Rating:</span>
              <div class="star-rating">
                ${generateStarRating(anime.averageScore)}
                <span class="rating-value">${(anime.averageScore / 10).toFixed(1)}/10</span>
              </div>
            </div>
          ` : ''}
          
          ${anime.popularity ? `
            <div class="stat-item">
              <span class="stat-label">Views:</span>
              <span class="stat-value">${formatNumber(anime.popularity)}</span>
            </div>
          ` : ''}
          
          ${anime.startDate ? `
            <div class="stat-item">
              <span class="stat-label">Released:</span>
              <span class="stat-value">${formatDate(anime.startDate)}</span>
            </div>
          ` : ''}
          
          ${anime.status ? `
            <div class="stat-item">
              <span class="stat-label">Status:</span>
              <span class="stat-value">${formatStatus(anime.status)}</span>
            </div>
          ` : ''}
          
          ${anime.episodes ? `
            <div class="stat-item">
              <span class="stat-label">Episodes:</span>
              <span class="stat-value">${anime.episodes}</span>
            </div>
          ` : ''}
          
          ${anime.genres?.length ? `
            <div class="stat-item">
              <span class="stat-label">Genres:</span>
              <span class="stat-value">${anime.genres.join(', ')}</span>
            </div>
          ` : ''}
          
          ${anime.synonyms?.length ? `
            <div class="stat-item">
              <span class="stat-label">Also Known As:</span>
              <span class="stat-value">${anime.synonyms.join(', ')}</span>
            </div>
          ` : ''}
        </div>
      `;
      
      document.getElementById('anime-stats').innerHTML = animeStatsHTML;
      
      // Episodes
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
  
  // Helper functions
  function generateStarRating(score) {
    const starsTotal = 5;
    const starPercentage = (score / 100) * starsTotal;
    const starPercentageRounded = Math.round(starPercentage * 10) / 10;
    
    let starsHTML = '';
    for (let i = 1; i <= starsTotal; i++) {
      if (i <= starPercentageRounded) {
        starsHTML += '<i class="fas fa-star"></i>';
      } else if (i - 0.5 <= starPercentageRounded) {
        starsHTML += '<i class="fas fa-star-half-alt"></i>';
      } else {
        starsHTML += '<i class="far fa-star"></i>';
      }
    }
    return starsHTML;
  }
  
  function formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }
  
  function formatDate(date) {
    if (!date) return 'Unknown';
    const { year, month, day } = date;
    return new Date(year, month - 1, day).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
  
  function formatStatus(status) {
    const statusMap = {
      'RELEASING': 'Currently Airing',
      'FINISHED': 'Completed',
      'NOT_YET_RELEASED': 'Not Yet Released',
      'CANCELLED': 'Cancelled',
      'HIATUS': 'On Hiatus'
    };
    return statusMap[status] || status;
  }
  
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