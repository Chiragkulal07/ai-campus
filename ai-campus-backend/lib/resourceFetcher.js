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

// Runs YouTube + Tavily searches for every roadmap node in parallel.
// If a key is missing or a call fails, that node just gets an empty array
// for that resource type — the roadmap itself is never blocked by this.
async function fetchResourcesForRoadmap(nodes) {
  const results = await Promise.all(
    nodes.map(async (node) => {
      const query = `${node.label} tutorial`;
      const [youtube, articles] = await Promise.all([
        fetchYoutubeVideos(query),
        fetchArticles(query)
      ]);
      return { nodeId: node.id, youtube, articles };
    })
  );
  return results;
}

module.exports = { fetchResourcesForRoadmap };