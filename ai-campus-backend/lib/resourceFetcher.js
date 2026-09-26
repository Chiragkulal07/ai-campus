const redisClient = require('../config/redisClient');

const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const CALL_TIMEOUT_MS = 4000;

function withTimeout(promise, ms, fallback) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallback), ms))
  ]);
}

async function fetchYoutubeVideos(query, maxResults = 2) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return [];

  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${maxResults}&q=${encodeURIComponent(query)}&key=${apiKey}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error('YouTube API error:', await res.text());
      return [];
    }
    const data = await res.json();
    return (data.items || []).map((item) => ({
      title: item.snippet.title,
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`
    }));
  } catch (err) {
    console.error('YouTube fetch failed:', err.message);
    return [];
  }
}

async function fetchArticles(query, maxResults = 2) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey, query, max_results: maxResults })
    });
    if (!res.ok) {
      console.error('Tavily API error:', await res.text());
      return [];
    }
    const data = await res.json();
    return (data.results || []).map((r) => ({ title: r.title, url: r.url }));
  } catch (err) {
    console.error('Tavily fetch failed:', err.message);
    return [];
  }
}

function cacheKeyFor(label) {
  return `resources:${label.trim().toLowerCase()}`;
}

async function getCachedResources(label) {
  try {
    const cached = await redisClient.get(cacheKeyFor(label));
    return cached ? JSON.parse(cached) : null;
  } catch (err) {
    console.error('Redis read failed:', err.message);
    return null; // cache miss on error, never block on Redis
  }
}

async function setCachedResources(label, data) {
  try {
    await redisClient.set(cacheKeyFor(label), JSON.stringify(data), 'EX', CACHE_TTL_SECONDS);
  } catch (err) {
    console.error('Redis write failed:', err.message);
    // non-fatal, just means no caching this time
  }
}

async function fetchResourcesForNode(node) {
  const cached = await getCachedResources(node.label);
  if (cached) {
    return { nodeId: node.id, youtube: cached.youtube, articles: cached.articles };
  }

  const query = `${node.label} tutorial`;
  const [youtube, articles] = await Promise.all([
    withTimeout(fetchYoutubeVideos(query), CALL_TIMEOUT_MS, []),
    withTimeout(fetchArticles(query), CALL_TIMEOUT_MS, [])
  ]);

  // Only cache if we actually got something — don't lock in empty results
  // from a timeout/failure for 7 days.
  if (youtube.length || articles.length) {
    await setCachedResources(node.label, { youtube, articles });
  }

  return { nodeId: node.id, youtube, articles };
}

// Runs YouTube + Tavily searches for every roadmap node in parallel.
// Cache hits skip external calls entirely. Cache misses are capped at
// CALL_TIMEOUT_MS each. If a key is missing or a call fails, that node
// just gets an empty array for that resource type — the roadmap itself
// is never blocked by this.
async function fetchResourcesForRoadmap(nodes) {
  const results = await Promise.all(nodes.map(fetchResourcesForNode));
  return results;
}

module.exports = { fetchResourcesForRoadmap };