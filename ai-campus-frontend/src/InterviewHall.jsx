import { useState } from 'react';
import { API_URL } from './config';

const PHASES = {
  UPLOAD: 'upload',
  SETUP: 'setup',
  ANSWERING: 'answering',
  RESULTS: 'results'
};

function InterviewHall({ token, onBackToMap }) {
  const [phase, setPhase] = useState(PHASES.UPLOAD);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [resumeText, setResumeText] = useState('');
  const [questionCount, setQuestionCount] = useState(5);
  const [questions, setQuestions] = useState([]);

  const [sessionId, setSessionId] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [answerDraft, setAnswerDraft] = useState('');

  const [results, setResults] = useState(null);

  const formInputStyle = {
    width: '100%',
    padding: '12px 14px',
    background: 'rgba(15, 23, 42, 0.45)',
    border: '1.5px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '12px',
    color: '#f8fafc',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box'
  };

  // ── Phase 1: Resume upload ──
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('resume', file);

    try {
      const res = await fetch(`${API_URL}/interview/upload-resume`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Could not process this resume');
        setLoading(false);
        return;
      }

      setResumeText(data.resumeText);
      setPhase(PHASES.SETUP);
      setLoading(false);
    } catch (err) {
      setError('Could not reach the server');
      setLoading(false);
    }
  };

  // ── Phase 2: Generate questions + start session ──
  const handleGenerateAndStart = async () => {
    setLoading(true);
    setError('');

    try {
      const genRes = await fetch(`${API_URL}/interview/generate-questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ resumeText, questionCount: Number(questionCount) })
      });
      const genData = await genRes.json();

      if (!genRes.ok) {
        setError(genData.error || 'Could not generate questions');
        setLoading(false);
        return;
      }

      const startRes = await fetch(`${API_URL}/interview/start-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ resumeText, questions: genData.questions })
      });
      const startData = await startRes.json();

      if (!startRes.ok) {
        setError(startData.error || 'Could not start the interview session');
        setLoading(false);
        return;
      }

      setQuestions(genData.questions);
      setSessionId(startData.sessionId);
      setCurrentQuestionIndex(startData.currentQuestionIndex);
      setCurrentQuestion(startData.currentQuestion);
      setPhase(PHASES.ANSWERING);
      setLoading(false);
    } catch (err) {
      setError('Could not reach the server');
      setLoading(false);
    }
  };

  // ── Phase 3: Submit each answer ──
  const handleSubmitAnswer = async () => {
    if (!answerDraft.trim()) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/interview/session/${sessionId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ answerText: answerDraft.trim() })
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Could not submit answer');
        setLoading(false);
        return;
      }

      setAnswerDraft('');

      if (data.readyToFinish) {
        await handleFinish();
      } else {
        setCurrentQuestionIndex(data.currentQuestionIndex);
        setCurrentQuestion(data.currentQuestion);
        setLoading(false);
      }
    } catch (err) {
      setError('Could not reach the server');
      setLoading(false);
    }
  };

  // ── Phase 4: Finish and get scored ──
  const handleFinish = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/interview/session/${sessionId}/finish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Could not finish the interview');
        setLoading(false);
        return;
      }

      setResults(data);
      setPhase(PHASES.RESULTS);
      setLoading(false);
    } catch (err) {
      setError('Could not reach the server');
      setLoading(false);
    }
  };

  const handleStartOver = () => {
    setPhase(PHASES.UPLOAD);
    setError('');
    setResumeText('');
    setQuestions([]);
    setSessionId(null);
    setCurrentQuestionIndex(0);
    setCurrentQuestion('');
    setAnswerDraft('');
    setResults(null);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(4, 7, 17, 0.85)',
      zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(16px)', padding: '20px',
    }}>
      <div style={{
        width: '100%', maxWidth: '780px', maxHeight: '90vh', overflowY: 'auto',
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.9) 100%)',
        borderRadius: '28px', border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 40px 100px rgba(0, 0, 0, 0.7)',
        fontFamily: "'Inter', sans-serif",
      }}>
        {/* Header */}
        <div style={{
          padding: '32px 36px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              fontSize: '32px', width: '56px', height: '56px',
              background: 'rgba(255, 255, 255, 0.03)', borderRadius: '16px',
              border: '1.5px solid rgba(255, 255, 255, 0.05)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>🎤</div>
            <div>
              <h2 style={{ margin: 0, color: '#f8fafc', fontSize: '22px', fontWeight: 800 }}>
                Interview Hall
              </h2>
              <p style={{ margin: 0, color: '#64748b', fontSize: '13.5px', marginTop: '2px' }}>
                Upload your resume for a personalized mock interview
              </p>
            </div>
          </div>
          <button
            onClick={onBackToMap}
            style={{
              background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)',
              color: '#94a3b8', borderRadius: '12px', padding: '10px 16px',
              cursor: 'pointer', fontSize: '13px', fontWeight: 600,
            }}
          >
            ← Leave
          </button>
        </div>

        <div style={{ padding: '32px 36px' }}>
          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
              color: '#fca5a5', borderRadius: '12px', padding: '12px 16px',
              fontSize: '13.5px', marginBottom: '24px',
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* ── PHASE 1: Upload ── */}
          {phase === PHASES.UPLOAD && (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📄</div>
              <h3 style={{ color: '#f8fafc', fontSize: '17px', fontWeight: 700, marginBottom: '8px' }}>
                Upload Your Resume
              </h3>
              <p style={{ color: '#64748b', fontSize: '13.5px', marginBottom: '24px' }}>
                PDF only. We'll generate personalized interview questions based on your background.
              </p>
              <label style={{
                display: 'inline-block', padding: '14px 32px',
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                color: 'white', borderRadius: '14px', fontSize: '14px', fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
              }}>
                {loading ? 'Processing...' : 'Choose PDF File'}
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  disabled={loading}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          )}

          {/* ── PHASE 2: Setup (question count) ── */}
          {phase === PHASES.SETUP && (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>✅</div>
              <h3 style={{ color: '#f8fafc', fontSize: '17px', fontWeight: 700, marginBottom: '8px' }}>
                Resume Loaded
              </h3>
              <p style={{ color: '#64748b', fontSize: '13.5px', marginBottom: '24px' }}>
                {resumeText.length} characters extracted. How many questions would you like?
              </p>

              <div style={{ maxWidth: '200px', margin: '0 auto 24px' }}>
                <input
                  type="number" min="3" max="10" value={questionCount}
                  onChange={(e) => setQuestionCount(e.target.value)}
                  style={{ ...formInputStyle, textAlign: 'center' }}
                />
              </div>

              <button
                onClick={handleGenerateAndStart}
                disabled={loading}
                style={{
                  padding: '14px 32px',
                  background: loading ? 'rgba(99,102,241,0.4)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white', border: 'none', borderRadius: '14px',
                  fontSize: '14px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? 'Generating questions...' : 'Start Interview'}
              </button>
            </div>
          )}

          {/* ── PHASE 3: Answering ── */}
          {phase === PHASES.ANSWERING && (
            <div>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'
              }}>
                <span style={{ color: '#64748b', fontSize: '13px', fontWeight: 600 }}>
                  Question {currentQuestionIndex + 1} of {questions.length}
                </span>
                <div style={{
                  width: '140px', height: '6px', background: 'rgba(255,255,255,0.06)',
                  borderRadius: '3px', overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${((currentQuestionIndex) / questions.length) * 100}%`, height: '100%',
                    background: 'linear-gradient(90deg, #6366f1, #8b5cf6)', transition: 'width 0.3s'
                  }} />
                </div>
              </div>

              <div style={{
                background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '16px', padding: '24px', marginBottom: '20px'
              }}>
                <p style={{ color: '#f8fafc', fontSize: '16px', fontWeight: 600, lineHeight: '1.5', margin: 0 }}>
                  {currentQuestion}
                </p>
              </div>

              <textarea
                value={answerDraft}
                onChange={(e) => setAnswerDraft(e.target.value)}
                placeholder="Type your answer here..."
                rows={6}
                style={{ ...formInputStyle, resize: 'vertical', marginBottom: '16px' }}
              />

              <button
                onClick={handleSubmitAnswer}
                disabled={loading || !answerDraft.trim()}
                style={{
                  width: '100%', padding: '14px',
                  background: (loading || !answerDraft.trim()) ? 'rgba(99,102,241,0.3)' : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                  color: 'white', border: 'none', borderRadius: '14px',
                  fontSize: '14.5px', fontWeight: 700,
                  cursor: (loading || !answerDraft.trim()) ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? 'Submitting...' : currentQuestionIndex + 1 >= questions.length ? 'Submit & Finish Interview' : 'Submit & Next Question'}
              </button>
            </div>
          )}

          {/* ── PHASE 4: Results ── */}
          {phase === PHASES.RESULTS && results && (
            <div>
              <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Your Score
                </div>
                <div style={{ fontSize: '48px', fontWeight: 800, color: '#f8fafc' }}>
                  {results.score}<span style={{ fontSize: '24px', color: '#64748b' }}>/{results.maxScore}</span>
                </div>
              </div>

              <div style={{
                background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '16px', padding: '20px', marginBottom: '16px'
              }}>
                <h4 style={{ color: '#a5b4fc', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
                  Overall Feedback
                </h4>
                <p style={{ color: '#e2e8f0', fontSize: '14px', lineHeight: '1.6', margin: 0 }}>
                  {results.overallFeedback}
                </p>
              </div>

              <div style={{
                background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '16px', padding: '20px', marginBottom: '16px'
              }}>
                <h4 style={{ color: '#34d399', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
                  Suggested Roles
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {results.roleSuggestions.map((role, i) => (
                    <span key={i} style={{
                      background: 'rgba(16,185,129,0.12)', color: '#34d399',
                      border: '1px solid rgba(16,185,129,0.2)', borderRadius: '20px',
                      padding: '6px 14px', fontSize: '13px', fontWeight: 600
                    }}>
                      {role}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{
                background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '16px', padding: '20px', marginBottom: '24px'
              }}>
                <h4 style={{ color: '#fbbf24', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
                  Areas to Improve
                </h4>
                <ul style={{ color: '#e2e8f0', fontSize: '14px', lineHeight: '1.8', margin: 0, paddingLeft: '20px' }}>
                  {results.improvementAreas.map((area, i) => (
                    <li key={i}>{area}</li>
                  ))}
                </ul>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={handleStartOver}
                  style={{
                    flex: 1, padding: '14px',
                    background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
                    color: '#a5b4fc', borderRadius: '14px', fontSize: '14px', fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  Try Another Interview
                </button>
                <button
                  onClick={onBackToMap}
                  style={{
                    flex: 1, padding: '14px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white', border: 'none', borderRadius: '14px', fontSize: '14px', fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  Back to Campus
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default InterviewHall;