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
      position: 'fixed', inset: 0, background: 'rgba(4, 7, 17, 0.9)',
      zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(20px)', padding: '20px',
    }}>
      <div style={{
        width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto',
        background: 'linear-gradient(145deg, rgba(23, 29, 50, 0.95) 0%, rgba(10, 14, 26, 0.98) 100%)',
        borderRadius: '28px', border: '1px solid rgba(99, 102, 241, 0.25)',
        boxShadow: '0 40px 100px rgba(0, 0, 0, 0.8), 0 0 40px rgba(99, 102, 241, 0.1)',
        fontFamily: "'Outfit', 'Inter', sans-serif",
      }}>
        {/* Header */}
        <div style={{
          padding: '32px 40px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{
              fontSize: '32px', width: '64px', height: '64px',
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(251, 191, 36, 0.05) 100%)',
              borderRadius: '20px',
              border: '1.5px solid rgba(245, 158, 11, 0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 20px rgba(245, 158, 11, 0.15)'
            }}>🎤</div>
            <div>
              <h2 style={{ margin: 0, color: '#f8fafc', fontSize: '24px', fontWeight: 900, letterSpacing: '-0.5px' }}>
                Interview Simulator Terminal
              </h2>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '14.5px', marginTop: '4px' }}>
                Analyze your resume profile & undergo an automated oral panel.
              </p>
            </div>
          </div>
          <button
            onClick={onBackToMap}
            style={{
              background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)',
              color: '#94a3b8', borderRadius: '12px', padding: '10px 20px',
              cursor: 'pointer', fontSize: '13px', fontWeight: 700,
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)'; e.currentTarget.style.color = '#f87171'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'; e.currentTarget.style.color = '#94a3b8'; }}
          >
            Leave Simulator
          </button>
        </div>

        <div style={{ padding: '36px 40px' }}>
          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#fca5a5', borderRadius: '14px', padding: '14px 20px',
              fontSize: '14px', marginBottom: '28px',
              boxShadow: '0 4px 15px rgba(239, 68, 68, 0.1)'
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* ── PHASE 1: Upload ── */}
          {phase === PHASES.UPLOAD && (
            <div style={{ textAlign: 'center', padding: '50px 20px' }}>
              <div style={{ fontSize: '64px', marginBottom: '24px', filter: 'drop-shadow(0 0 15px rgba(99, 102, 241, 0.2))' }}>📄</div>
              <h3 style={{ color: '#f8fafc', fontSize: '20px', fontWeight: 800, marginBottom: '10px', letterSpacing: '-0.5px' }}>
                Load Resume Profile
              </h3>
              <p style={{ color: '#94a3b8', fontSize: '14.5px', marginBottom: '32px', maxWidth: '420px', margin: '0 auto 32px', lineHeight: '1.6' }}>
                Upload your PDF CV. The simulator will compile structural inquiries custom-tailored to your stack.
              </p>
              <label style={{
                display: 'inline-block', padding: '16px 40px',
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: 'white', borderRadius: '16px', fontSize: '15px', fontWeight: 800,
                cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
                boxShadow: '0 8px 24px rgba(245, 158, 11, 0.3)',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.boxShadow = '0 12px 30px rgba(245, 158, 11, 0.45)'; } }}
              onMouseLeave={e => { if (!loading) { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(245, 158, 11, 0.3)'; } }}
              >
                {loading ? 'Processing Document...' : 'Select Resume (PDF)'}
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
            <div style={{ textAlign: 'center', padding: '30px 20px' }}>
              <div style={{ fontSize: '56px', marginBottom: '20px' }}>⚙️</div>
              <h3 style={{ color: '#f8fafc', fontSize: '20px', fontWeight: 800, marginBottom: '10px', letterSpacing: '-0.5px' }}>
                Simulator Setup
              </h3>
              <p style={{ color: '#94a3b8', fontSize: '14.5px', marginBottom: '32px' }}>
                Extracted profile metadata ({resumeText.length} chars). Specify question count:
              </p>

              <div style={{ maxWidth: '240px', margin: '0 auto 36px' }}>
                <label style={{ display: 'block', color: '#64748b', fontSize: '12px', fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Target Questions
                </label>
                <input
                  type="number" min="3" max="10" value={questionCount}
                  onChange={(e) => setQuestionCount(e.target.value)}
                  style={{
                    ...formInputStyle,
                    textAlign: 'center',
                    fontSize: '18px',
                    fontWeight: 800,
                    borderColor: 'rgba(245, 158, 11, 0.3)',
                    color: '#fbbf24',
                    background: 'rgba(245, 158, 11, 0.05)',
                  }}
                />
              </div>

              <button
                onClick={handleGenerateAndStart}
                disabled={loading}
                style={{
                  padding: '16px 40px',
                  background: loading ? 'rgba(245,158,11,0.4)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white', border: 'none', borderRadius: '16px',
                  fontSize: '15px', fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 8px 24px rgba(16, 185, 129, 0.25)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.boxShadow = '0 12px 30px rgba(16, 185, 129, 0.4)'; } }}
                onMouseLeave={e => { if (!loading) { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(16, 185, 129, 0.25)'; } }}
              >
                {loading ? 'Compiling simulator...' : 'Boot Simulator Session'}
              </button>
            </div>
          )}

          {/* ── PHASE 3: Answering ── */}
          {phase === PHASES.ANSWERING && (
            <div>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px'
              }}>
                <span style={{ color: '#fbbf24', fontSize: '13px', fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase' }}>
                  Inquiry {currentQuestionIndex + 1} / {questions.length}
                </span>
                <div style={{
                  width: '160px', height: '8px', background: 'rgba(255,255,255,0.06)',
                  borderRadius: '4px', overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${((currentQuestionIndex) / questions.length) * 100}%`, height: '100%',
                    background: 'linear-gradient(90deg, #f59e0b, #fbbf24)', transition: 'width 0.4s ease-out'
                  }} />
                </div>
              </div>

              <div style={{
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(15, 23, 42, 0.6) 100%)',
                border: '1px solid rgba(245, 158, 11, 0.2)',
                borderRadius: '20px', padding: '32px', marginBottom: '28px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.15)'
              }}>
                <p style={{ color: '#f8fafc', fontSize: '18px', fontWeight: 700, lineHeight: '1.6', margin: 0, letterSpacing: '-0.3px' }}>
                  "{currentQuestion}"
                </p>
              </div>

              <textarea
                value={answerDraft}
                onChange={(e) => setAnswerDraft(e.target.value)}
                placeholder="Draft your answer text here (elaborate to receive accurate scoring)..."
                rows={7}
                style={{
                  ...formInputStyle,
                  resize: 'vertical',
                  marginBottom: '24px',
                  padding: '16px 20px',
                  fontSize: '15px',
                  lineHeight: '1.6',
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                  background: 'rgba(15, 23, 42, 0.65)'
                }}
                onFocus={(e) => { e.target.style.borderColor = 'rgba(245, 158, 11, 0.5)'; e.target.style.boxShadow = '0 0 15px rgba(245, 158, 11, 0.08)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'; e.target.style.boxShadow = 'none'; }}
              />

              <button
                onClick={handleSubmitAnswer}
                disabled={loading || !answerDraft.trim()}
                style={{
                  width: '100%', padding: '16px',
                  background: (loading || !answerDraft.trim()) ? 'rgba(245,158,11,0.2)' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: 'white', border: 'none', borderRadius: '16px',
                  fontSize: '15px', fontWeight: 800,
                  cursor: (loading || !answerDraft.trim()) ? 'not-allowed' : 'pointer',
                  boxShadow: (loading || !answerDraft.trim()) ? 'none' : '0 8px 24px rgba(245, 158, 11, 0.25)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => { if (!loading && answerDraft.trim()) e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { if (!loading && answerDraft.trim()) e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                {loading ? 'Evaluating response...' : currentQuestionIndex + 1 >= questions.length ? 'Finalize & Score Simulated Session' : 'Submit & Await Next Question'}
              </button>
            </div>
          )}

          {/* ── PHASE 4: Results ── */}
          {phase === PHASES.RESULTS && results && (
            <div>
              <div style={{
                textAlign: 'center',
                padding: '24px 30px',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 100%)',
                borderRadius: '24px',
                border: '1px solid rgba(255,255,255,0.04)',
                marginBottom: '36px'
              }}>
                <div style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 800, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '2px' }}>
                  Simulator Evaluation Score
                </div>
                <div style={{ fontSize: '64px', fontWeight: 900, color: '#f8fafc', letterSpacing: '-2px' }}>
                  {results.score}<span style={{ fontSize: '28px', color: '#475569', fontWeight: 700 }}>/{results.maxScore}</span>
                </div>
                <div style={{
                  display: 'inline-block',
                  padding: '6px 16px',
                  background: results.score >= (results.maxScore * 0.7) ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                  color: results.score >= (results.maxScore * 0.7) ? '#34d399' : '#fbbf24',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 800,
                  marginTop: '12px',
                  letterSpacing: '1px',
                  textTransform: 'uppercase'
                }}>
                  {results.score >= (results.maxScore * 0.75) ? 'EXCELLENT FIT' : results.score >= (results.maxScore * 0.5) ? 'PASSING MATCH' : 'DEVELOPMENT REQUIRED'}
                </div>
              </div>

              <div style={{
                background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: '20px', padding: '24px 28px', marginBottom: '20px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
              }}>
                <h4 style={{ margin: '0 0 12px', color: '#fbbf24', fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Overall Assessment
                </h4>
                <p style={{ color: '#cbd5e1', fontSize: '14.5px', lineHeight: '1.7', margin: 0 }}>
                  {results.overallFeedback}
                </p>
              </div>

              <div style={{
                background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: '20px', padding: '24px 28px', marginBottom: '20px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
              }}>
                <h4 style={{ margin: '0 0 16px', color: '#34d399', fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Simulated Ideal Roles
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {results.roleSuggestions.map((role, i) => (
                    <span key={i} style={{
                      background: 'rgba(16,185,129,0.08)', color: '#34d399',
                      border: '1px solid rgba(16,185,129,0.2)', borderRadius: '12px',
                      padding: '8px 16px', fontSize: '13.5px', fontWeight: 700
                    }}>
                      💼 {role}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{
                background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: '20px', padding: '24px 28px', marginBottom: '32px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
              }}>
                <h4 style={{ margin: '0 0 14px', color: '#fbbf24', fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Recommended Action Plans
                </h4>
                <ul style={{ color: '#cbd5e1', fontSize: '14.5px', lineHeight: '1.8', margin: 0, paddingLeft: '20px' }}>
                  {results.improvementAreas.map((area, i) => (
                    <li key={i} style={{ marginBottom: '8px' }}>{area}</li>
                  ))}
                </ul>
              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                <button
                  onClick={handleStartOver}
                  style={{
                    flex: 1, padding: '16px',
                    background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
                    color: '#fbbf24', borderRadius: '16px', fontSize: '15px', fontWeight: 800, cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.15)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.1)'; }}
                >
                  Restart Simulation
                </button>
                <button
                  onClick={onBackToMap}
                  style={{
                    flex: 1, padding: '16px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white', border: 'none', borderRadius: '16px', fontSize: '15px', fontWeight: 800, cursor: 'pointer',
                    boxShadow: '0 8px 24px rgba(16, 185, 129, 0.2)',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  Return to Campus
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