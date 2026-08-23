const { StateGraph, START, END } = require('@langchain/langgraph');
const { TavilySearch } = require('@langchain/tavily');
const { invokeWithFallback, parseJsonResponse } = require('./llmFallback');

// ── GRAPH 1: resume analysis + parallel question generation / job search ──

const resumeGraphChannels = {
  resumeText: { value: (x, y) => y ?? x, default: () => '' },
  questionCount: { value: (x, y) => y ?? x, default: () => 5 },
  extractedSkills: { value: (x, y) => y ?? x, default: () => [] },
  extractedProjects: { value: (x, y) => y ?? x, default: () => [] },
  questions: { value: (x, y) => y ?? x, default: () => [] },
  jobSearchResults: { value: (x, y) => y ?? x, default: () => [] },
  llmSource: { value: (x, y) => y ?? x, default: () => '' }
};

async function analyzeResumeNode(state) {
  const prompt = `You are an expert technical resume analyst. Read this resume and extract structured data.

Resume:
${state.resumeText}

Return ONLY a JSON object, no markdown, no explanation, in exactly this shape:
{
  "skills": [<list of specific technical skills, tools, languages, frameworks mentioned>],
  "projects": [<list of project names/short descriptions actually mentioned in the resume>]
}`;

  const { text, source } = await invokeWithFallback(prompt);
  const parsed = parseJsonResponse(text);

  return {
    extractedSkills: Array.isArray(parsed.skills) ? parsed.skills : [],
    extractedProjects: Array.isArray(parsed.projects) ? parsed.projects : [],
    llmSource: source
  };
}

async function generateQuestionsNode(state) {
  const count = Math.min(Math.max(Number(state.questionCount) || 5, 3), 5); // hard cap 5 per your requirement

  const prompt = `You are an experienced technical interviewer. Based on these extracted skills and projects, generate exactly ${count} interview questions.

Skills: ${state.extractedSkills.join(', ')}
Projects: ${state.extractedProjects.join('; ')}

Rules:
- Questions should test real knowledge depth of the listed skills/projects, not generic fluff
- Mix technical and behavioral where appropriate
- Return ONLY a JSON array of strings, no markdown, no explanation
- Example: ["Question one?", "Question two?"]`;

  const { text } = await invokeWithFallback(prompt);
  const questions = parseJsonResponse(text);

  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error('LLM returned an empty or invalid question list');
  }

  return { questions: questions.slice(0, count) };
}

async function searchJobsNode(state) {
  const skillsList = state.extractedSkills.slice(0, 8).join(', '); // keep query focused

  const tavily = new TavilySearch({
    tavilyApiKey: process.env.TAVILY_API_KEY,
    maxResults: 6
  });

  const searchResult = await tavily.invoke({
    query: `current job openings and companies hiring for ${skillsList} skills 2026`
  });

  // Tavily returns { results: [{ title, url, content }, ...] } — keep it lean for storage/prompting later
  const results = (searchResult.results || []).map((r) => ({
    title: r.title,
    url: r.url,
    snippet: (r.content || '').slice(0, 300)
  }));

  return { jobSearchResults: results };
}

const resumeWorkflow = new StateGraph({ channels: resumeGraphChannels })
  .addNode('analyze_resume', analyzeResumeNode)
  .addNode('generate_questions', generateQuestionsNode)
  .addNode('search_jobs', searchJobsNode)
  .addEdge(START, 'analyze_resume')
  // Two edges out of analyze_resume = parallel fan-out. Both run independently,
  // neither waits on the other — exactly the "not sequential" requirement.
  .addEdge('analyze_resume', 'generate_questions')
  .addEdge('analyze_resume', 'search_jobs')
  .addEdge('generate_questions', END)
  .addEdge('search_jobs', END);

const resumeAnalysisGraph = resumeWorkflow.compile();

async function runResumeAnalysis(resumeText, questionCount) {
  return resumeAnalysisGraph.invoke({ resumeText, questionCount });
}

// ── GRAPH 2: recommendations — sequential, runs only after quiz is answered ──

const recGraphChannels = {
  extractedSkills: { value: (x, y) => y ?? x, default: () => [] },
  extractedProjects: { value: (x, y) => y ?? x, default: () => [] },
  jobSearchResults: { value: (x, y) => y ?? x, default: () => [] },
  quizAnswers: { value: (x, y) => y ?? x, default: () => [] }, // [{question, answer}]
  questionCount: { value: (x, y) => y ?? x, default: () => 5 },
  recommendations: { value: (x, y) => y ?? x, default: () => null }
};

async function generateRecommendationsNode(state) {
  const qaText = state.quizAnswers
    .map((qa, i) => `Q${i + 1}: ${qa.question}\nA${i + 1}: ${qa.answer}`)
    .join('\n\n');

  const jobsText = state.jobSearchResults
    .map((j) => `- ${j.title}: ${j.snippet}`)
    .join('\n');

  const prompt = `You are an experienced technical interviewer and career advisor evaluating a candidate.

Extracted Skills: ${state.extractedSkills.join(', ')}
Extracted Projects: ${state.extractedProjects.join('; ')}

Interview Q&A:
${qaText}

Current job market findings for their skillset:
${jobsText || 'no job market data available'}

Based on their DEMONSTRATED knowledge in the interview (not just their resume), evaluate them and respond with ONLY a JSON object (no markdown) in exactly this shape:
{
  "score": <number out of ${state.quizAnswers.length * 10}, based on answer quality/depth/accuracy>,
  "targetRole": "<single best-fit job role title based on BOTH their demonstrated knowledge AND the current job market findings above>",
  "improvementAreas": [<2-4 short, specific, actionable improvement suggestions, based on gaps shown in their actual answers>],
  "overallFeedback": "<2-3 sentence summary of how the interview went and their readiness for the target role>"
}`;

  const { text } = await invokeWithFallback(prompt);
  const recommendations = parseJsonResponse(text);

  if (typeof recommendations.score !== 'number' || !recommendations.targetRole) {
    throw new Error('LLM returned an unexpected shape for recommendations');
  }

  return { recommendations };
}

const recWorkflow = new StateGraph({ channels: recGraphChannels })
  .addNode('generate_recommendations', generateRecommendationsNode)
  .addEdge(START, 'generate_recommendations')
  .addEdge('generate_recommendations', END);

const recommendationGraph = recWorkflow.compile();

async function runRecommendations({ extractedSkills, extractedProjects, jobSearchResults, quizAnswers }) {
  return recommendationGraph.invoke({ extractedSkills, extractedProjects, jobSearchResults, quizAnswers });
}

module.exports = { runResumeAnalysis, runRecommendations };