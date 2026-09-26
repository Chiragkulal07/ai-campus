const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { ChatMistralAI } = require('@langchain/mistralai');

function buildLLMChain() {
  const gemini = new ChatGoogleGenerativeAI({
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    apiKey: process.env.GEMINI_API_KEY,
    temperature: 0.7,
    maxRetries: 0,
    timeout: 8000,
  });

  const mistral = new ChatMistralAI({
    model: process.env.MISTRAL_MODEL || 'mistral-large-latest',
    apiKey: process.env.MISTRAL_API_KEY,
    temperature: 0.7,
    maxRetries: 0,
    timeout: 8000,
  });

  // Wrap each model's invoke individually so we see exactly which one
  // is called and what each one does — fallback masking means the
  // top-level error alone can't tell us this.
  const originalGeminiInvoke = gemini.invoke.bind(gemini);
  gemini.invoke = async (...args) => {
    try {
      const result = await originalGeminiInvoke(...args);
      console.log('[llmChain] Gemini succeeded');
      return result;
    } catch (err) {
      console.error('[llmChain] Gemini FAILED:', err.message);
      throw err;
    }
  };

  const originalMistralInvoke = mistral.invoke.bind(mistral);
  mistral.invoke = async (...args) => {
    try {
      const result = await originalMistralInvoke(...args);
      console.log('[llmChain] Mistral succeeded (used as fallback)');
      return result;
    } catch (err) {
      console.error('[llmChain] Mistral FAILED:', err.message);
      throw err;
    }
  };

  return gemini.withFallbacks({ fallbacks: [mistral] });
}

module.exports = { buildLLMChain };