const puppeteer = require('puppeteer');
const stringSimilarity = require('string-similarity');

const BASE_URL = 'https://animeheaven.me/';

async function getAnimeVideoUrls(animeTitle, episodeNumber) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    await page.setViewport({ width: 1366, height: 768 });

    // Search for anime
    const searchQuery = animeTitle.trim().replace(/\s+/g, '+');
    await page.goto(`${BASE_URL}search.php?s=${searchQuery}`, { 
      waitUntil: 'networkidle2', 
      timeout: 30000 
    });

    const searchResults = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('div.info3.bc1 div.similarimg')).map(block => ({
        title: block.querySelector('div.similarname a')?.innerText.trim(),
        url: block.querySelector('a')?.href
      })).filter(Boolean);
    });

    if (!searchResults.length) throw new Error('No anime found');

    // Find best match
    const bestMatch = findBestMatch(animeTitle, searchResults);

    // Go to anime page
    await page.goto(bestMatch.url, { waitUntil: 'networkidle2', timeout: 30000 });
    const episodes = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('div.linetitle2.c2 a')).map((ep, i) => ({
        number: ep.querySelector('div.watch2.bc')?.innerText.trim() || `Episode ${i+1}`,
        url: ep.href
      }));
    });

    if (!episodes.length) throw new Error('No episodes found');

    // Find episode
    const episode = findEpisode(episodeNumber, episodes);

    // Go to episode page
    await page.goto(episode.url, { waitUntil: 'networkidle2', timeout: 30000 });
    const videoUrls = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('video source'))
        .map(source => source.src)
        .filter(Boolean);
    });

    if (!videoUrls.length) throw new Error('No video sources found');
    return videoUrls;

  } catch (error) {
    console.error('Scraping error:', error.message);
    return [];
  } finally {
    if (browser) await browser.close();
  }
}

function findBestMatch(targetTitle, results) {
  const matches = stringSimilarity.findBestMatch(
    targetTitle.toLowerCase(),
    results.map(r => r.title.toLowerCase())
  );
  return results[matches.bestMatchIndex];
}

function findEpisode(targetNumber, episodes) {
  const targetStr = targetNumber.toString().toLowerCase().trim();
  const exactMatch = episodes.find(ep => 
    ep.number.toLowerCase().includes(`episode ${targetStr}`) || 
    ep.number.toLowerCase().includes(`ep ${targetStr}`) ||
    ep.number === targetStr
  );
  return exactMatch || episodes[0];
}

module.exports = {
  getAnimeVideoUrls
};