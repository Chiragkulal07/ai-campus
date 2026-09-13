const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { ChatMistralAI } = require('@langchain/mistralai');

// Gemini is primary; if it errors (rate limit, outage, etc.) LangChain
// automatically retries the same call on Mistral instead.
function buildLLMChain() {
  const gemini = new ChatGoogleGenerativeAI({
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    apiKey: process.env.GEMINI_API_KEY,
    temperature: 0.7,
  });

  const mistral = new ChatMistralAI({
    model: process.env.MISTRAL_MODEL || 'mistral-large-latest',
    apiKey: process.env.MISTRAL_API_KEY,
    temperature: 0.7,
  });

  return gemini.withFallbacks({ fallbacks: [mistral] });
}

module.exports = { buildLLMChain };