const { StateGraph, END, START } = require('@langchain/langgraph');
const { buildLLMChain } = require('./llmChain');

function stripCodeFence(text) {
  return text.trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim();
}

// ── Follow-up questions (single LLM call, no graph needed) ──
async function generateFollowUpQuestions(topic) {
  const chain = buildLLMChain();
  const prompt = `A user wants to learn about: "${topic}".
Ask exactly 4 short follow-up questions to understand their current level, their goal, and how much time they have, so a personalized learning roadmap can be built.
Return ONLY valid JSON, no markdown formatting, no commentary, in this exact shape:
{ "questions": ["question 1", "question 2", "question 3", "question 4"] }`;

  const response = await chain.invoke(prompt);
  const parsed = JSON.parse(stripCodeFence(response.content));
  if (!Array.isArray(parsed.questions)) throw new Error('LLM did not return a valid questions array');
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
  const result = await compiledGraph.invoke({ topic, answers });
  if (result.error) throw new Error(result.error);
  return result.roadmap;
}

module.exports = { generateFollowUpQuestions, runRoadmapGraph };