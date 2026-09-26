const { StateGraph, END, START } = require('@langchain/langgraph');
const { buildLLMChain } = require('./llmChain');
const redisClient = require('../config/redisClient');
const { embedText, cosineSimilarity } = require('./embeddings');

const QUESTIONS_CACHE_TTL_SECONDS = 60 * 60 * 24 * 30;
const ROADMAP_CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;
const SIMILARITY_THRESHOLD = 0.90;
const MAX_CACHE_ENTRIES = 200; // per cache list, oldest dropped beyond this

const QUESTIONS_INDEX_KEY = 'semcache:questions:index';
const ROADMAP_INDEX_KEY = 'semcache:roadmap:index';

function stripCodeFence(text) {
  return text.trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim();
}

function normalizeTopic(topic) {
  return topic.trim().toLowerCase().replace(/\s+/g, ' ');
}

// ── Generic semantic cache helpers, reused by both caches ──

async function getIndex(indexKey) {
  try {
    const raw = await redisClient.get(indexKey);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error(`Redis read failed for ${indexKey}:`, err.message);
    return [];
  }
}

async function saveIndex(indexKey, entries) {
  try {
    const trimmed = entries.slice(-MAX_CACHE_ENTRIES); // keep most recent N
    await redisClient.set(indexKey, JSON.stringify(trimmed));
  } catch (err) {
    console.error(`Redis write failed for ${indexKey}:`, err.message);
  }
}

async function findSemanticMatch(indexKey, queryEmbedding) {
  const entries = await getIndex(indexKey);
  let best = null;
  let bestScore = -1;

  for (const entry of entries) {
    const score = cosineSimilarity(queryEmbedding, entry.embedding);
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }

  if (best && bestScore >= SIMILARITY_THRESHOLD) {
    console.log(`[semantic cache] HIT on "${indexKey}" — score ${bestScore.toFixed(3)} matched "${best.sourceText}"`);
    return best;
  }
  console.log(`[semantic cache] MISS on "${indexKey}" — best score ${bestScore.toFixed(3)}`);
  return null;
}

async function addToIndex(indexKey, entry) {
  const entries = await getIndex(indexKey);
  entries.push(entry);
  await saveIndex(indexKey, entries);
}

// ── Follow-up questions (semantic cache keyed by topic) ──
async function generateFollowUpQuestions(topic) {
  const normalizedTopic = normalizeTopic(topic);
  const queryEmbedding = await embedText(normalizedTopic);

  const match = await findSemanticMatch(QUESTIONS_INDEX_KEY, queryEmbedding);
  if (match) return match.questions;

  const chain = buildLLMChain();
  const prompt = `A user wants to learn about: "${topic}".
Ask exactly 4 short follow-up questions to understand their current level, their goal, and how much time they have, so a personalized learning roadmap can be built.
Return ONLY valid JSON, no markdown formatting, no commentary, in this exact shape:
{ "questions": ["question 1", "question 2", "question 3", "question 4"] }`;

  const response = await chain.invoke(prompt);
  const parsed = JSON.parse(stripCodeFence(response.content));
  if (!Array.isArray(parsed.questions)) throw new Error('LLM did not return a valid questions array');

  await addToIndex(QUESTIONS_INDEX_KEY, {
    sourceText: normalizedTopic,
    embedding: queryEmbedding,
    questions: parsed.questions,
    cachedAt: Date.now(),
  });

  return parsed.questions;
}

// ── Roadmap generation graph (two nodes: generate → parse/validate) ──
async function generateRoadmapNode(state) {
  const chain = buildLLMChain();
  const answersText = state.answers.map((a) => `Q: ${a.question}\nA: ${a.answer}`).join('\n\n');

  const prompt = `You are an expert curriculum designer.
Topic: "${state.topic}"

User context:
${answersText}

Create a personalized learning roadmap as a directed graph, ordered from beginner to the user's goal.
Return ONLY valid JSON, no markdown, no commentary, in this exact shape:
{
  "nodes": [{ "id": "string", "label": "string", "description": "one sentence" }],
  "edges": [{ "source": "node id", "target": "node id" }]
}
Use 6 to 14 nodes. An edge from A to B means "A should be learned before B".`;

  const response = await chain.invoke(prompt);
  return { ...state, rawOutput: response.content };
}

function parseRoadmapNode(state) {
  try {
    const parsed = JSON.parse(stripCodeFence(state.rawOutput));
    if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
      throw new Error('missing nodes or edges array');
    }
    return { ...state, roadmap: parsed, error: null };
  } catch (err) {
    return { ...state, error: `failed to parse roadmap JSON: ${err.message}` };
  }
}

const graph = new StateGraph({
  channels: {
    topic: null,
    answers: null,
    rawOutput: null,
    roadmap: null,
    error: null,
  }
})
  .addNode('generateRoadmap', generateRoadmapNode)
  .addNode('parseRoadmap', parseRoadmapNode)
  .addEdge(START, 'generateRoadmap')
  .addEdge('generateRoadmap', 'parseRoadmap')
  .addEdge('parseRoadmap', END);

const compiledGraph = graph.compile();

async function runRoadmapGraph(topic, answers) {
  const normalizedTopic = normalizeTopic(topic);
  const answersText = answers.map((a) => `${a.question}::${a.answer}`).join('|');
  const querySourceText = `${normalizedTopic}|${answersText}`;
  const queryEmbedding = await embedText(querySourceText);

  const match = await findSemanticMatch(ROADMAP_INDEX_KEY, queryEmbedding);
  if (match) return match.roadmap;

  const result = await compiledGraph.invoke({ topic, answers });
  if (result.error) throw new Error(result.error);

  await addToIndex(ROADMAP_INDEX_KEY, {
    sourceText: querySourceText,
    embedding: queryEmbedding,
    roadmap: result.roadmap,
    cachedAt: Date.now(),
  });

  return result.roadmap;
}

module.exports = { generateFollowUpQuestions, runRoadmapGraph };