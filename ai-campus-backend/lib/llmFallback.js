const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { ChatMistralAI } = require('@langchain/mistralai');
const { ChatOpenAI } = require('@langchain/openai');

// Gemini primary, then Mistral, then Grok (via xAI's OpenAI-compatible endpoint),
// then OpenRouter/Llama as a final safety net. Each is a LangChain chat model,
// so this works as a drop-in inside any LangGraph node.
function getProviders() {
  return [
    {
      name: 'gemini-2.5-flash',
      model: new ChatGoogleGenerativeAI({
        apiKey: process.env.GEMINI_API_KEY,
        model: 'gemini-3.7-flash '
      })
    },
    {
      name: 'mistral-large',
      model: new ChatMistralAI({
        apiKey: process.env.MISTRAL_API_KEY,
        model: 'mistral-large-latest'
      })
    },
    {
      name: 'grok-4',
      model: new ChatOpenAI({
        apiKey: process.env.GROK_API_KEY,
        model: 'grok-4-latest',
        configuration: { baseURL: 'https://api.x.ai/v1' }
      })
    },
    {
      name: 'openrouter-llama',
      model: new ChatOpenAI({
        apiKey: process.env.OPENROUTER_API_KEY,
        model: 'meta-llama/llama-3.3-70b-instruct',
        configuration: { baseURL: 'https://openrouter.ai/api/v1' }
      })
    }
  ];
}

// Tries each provider in order, returns as soon as one succeeds.
// Returns { text, source } — source tells you which provider actually answered,
// same shape your old generateWithFallback returned, so downstream code doesn't change.
async function invokeWithFallback(prompt) {
  const providers = getProviders();

  for (const provider of providers) {
    try {
      const result = await provider.model.invoke(prompt);
      return { text: result.content, source: provider.name };
    } catch (err) {
      console.warn(`[LLM] ${provider.name} failed:`, err.message);
    }
  }

  throw new Error('All LLM providers failed (gemini, mistral, grok, openrouter)');
}

// Small helper: LLMs sometimes wrap JSON in markdown fences or add stray text.
// Strips fences and parses. Throws if the result still isn't valid JSON.
function parseJsonResponse(text) {
  const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(cleaned);
}

module.exports = { invokeWithFallback, parseJsonResponse };