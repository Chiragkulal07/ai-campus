import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const ALPHABET = ['A', 'B', 'C', 'D'];

function ChallengeRoom({ token, myUserId, challengeId, onExit }) {
  const socketRef = useRef(null);

  const [status, setStatus] = useState('connecting');
  const [challengeName, setChallengeName] = useState('');
  const [participants, setParticipants] = useState([]);

  const [question, setQuestion] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalDuration, setTotalDuration] = useState(20);

  const [revealData, setRevealData] = useState(null);
  const [finalLeaderboard, setFinalLeaderboard] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const socket = io(SOCKET_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('challenge:join-room', { challengeId, token });
    });

    socket.on('challenge:room-state', (state) => {
      setChallengeName(state.name);
      setParticipants(state.participants);
      setStatus(state.status === 'IN_PROGRESS' ? 'in_progress' : 'waiting');
    });

    socket.on('challenge:started', () => setStatus('in_progress'));

    socket.on('challenge:question', (q) => {
      setQuestion(q);
      setSelectedIndex(null);
      setHasAnswered(false);
      setRevealData(null);
      setTimeLeft(q.durationSec);
      setTotalDuration(q.durationSec);
    });

    socket.on('challenge:reveal', (data) => {
      setRevealData(data);
      setParticipants(data.leaderboard);
    });

    socket.on('challenge:completed', (data) => {
      setStatus('completed');
      setFinalLeaderboard(data.leaderboard);
    });

    socket.on('challenge:error', (err) => setErrorMsg(err.message));

    return () => socket.disconnect();
  }, [challengeId, token]);

  useEffect(() => {
    if (!question || hasAnswered || timeLeft <= 0) return;
    const t = setTimeout(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, question, hasAnswered]);

  const handleStart = () => socketRef.current.emit('challenge:start', { challengeId, token });

  const handleAnswer = (index) => {
    if (hasAnswered || !question) return;
    setSelectedIndex(index);
    setHasAnswered(true);
    socketRef.current.emit('challenge:answer', {
      challengeId, questionIndex: question.questionIndex, selectedIndex: index, token,
    });
  };

  const timerPct = totalDuration > 0 ? (timeLeft / totalDuration) * 100 : 0;
  const timerColor = timerPct > 50 ? '#10b981' : timerPct > 25 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#0a0f1e',
      zIndex: 300, display: 'flex', flexDirection: 'column',
      fontFamily: "'Inter', sans-serif", overflowY: 'auto',
    }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 28px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.03)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={onExit}
            style={{
              background: 'rgba(255,255,255,0.08)', border: 'none', color: '#94a3b8',
              borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px',
            }}
          >
            ← Exit
          </button>
          <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '16px' }}>
            {challengeName || 'Loading...'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {status === 'waiting' && (
            <span style={{
              background: 'rgba(251,191,36,0.15)', color: '#fbbf24',
              border: '1px solid rgba(251,191,36,0.3)', borderRadius: '20px',
              padding: '4px 12px', fontSize: '12px', fontWeight: 600,
            }}>
              ⏳ Waiting to start
            </span>
          )}
          {status === 'in_progress' && (
            <span style={{
              background: 'rgba(16,185,129,0.15)', color: '#10b981',
              border: '1px solid rgba(16,185,129,0.3)', borderRadius: '20px',
              padding: '4px 12px', fontSize: '12px', fontWeight: 600,
            }}>
              🔴 Live
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, gap: '0' }}>
        {/* Sidebar: participants */}
        <div style={{
          width: '220px', flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.07)',
          padding: '20px 16px', background: 'rgba(0,0,0,0.2)',
        }}>
          <p style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
            Players
          </p>
          {participants.map((p, i) => (
            <div key={p.userId || i} style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '8px 10px', borderRadius: '10px', marginBottom: '6px',
              background: p.userId === myUserId ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
              border: p.userId === myUserId ? '1px solid rgba(99,102,241,0.4)' : '1px solid transparent',
            }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                background: `hsl(${(p.displayName?.charCodeAt(0) || 65) * 7 % 360}, 60%, 55%)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontWeight: 700, fontSize: '12px', flexShrink: 0,
              }}>
                {p.displayName?.[0]?.toUpperCase() || '?'}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: '#e2e8f0', fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.displayName}
                </div>
                {p.score !== undefined && (
                  <div style={{ color: '#6366f1', fontSize: '12px', fontWeight: 700 }}>
                    {p.score} pts
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Main content */}
        <div style={{ flex: 1, padding: '40px 48px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {errorMsg && (
            <div style={{
              background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
              color: '#fca5a5', borderRadius: '10px', padding: '10px 16px',
              fontSize: '13px', marginBottom: '24px', width: '100%', maxWidth: '600px',
            }}>
              ⚠️ {errorMsg}
            </div>
          )}

          {/* WAITING STATE */}
          {status === 'waiting' && (
            <div style={{ textAlign: 'center', maxWidth: '480px' }}>
              <div style={{ fontSize: '64px', marginBottom: '20px' }}>⏳</div>
              <h2 style={{ color: '#f1f5f9', marginBottom: '8px' }}>Waiting for players...</h2>
              <p style={{ color: '#64748b', marginBottom: '32px' }}>
                {participants.length} player{participants.length !== 1 ? 's' : ''} joined. The creator starts when ready.
              </p>
              <button
                onClick={handleStart}
                style={{
                  padding: '14px 40px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  color: 'white', border: 'none', borderRadius: '14px', fontSize: '16px',
                  fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 20px rgba(99,102,241,0.5)',
                }}
              >
                🚀 Start Challenge
              </button>
              <p style={{ color: '#475569', fontSize: '12px', marginTop: '12px' }}>
                Only the creator can start the challenge
              </p>
            </div>
          )}

          {/* IN PROGRESS – QUESTION */}
          {status === 'in_progress' && question && !revealData && (
            <div style={{ width: '100%', maxWidth: '600px' }}>
              {/* Progress & timer */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <span style={{ color: '#64748b', fontSize: '13px' }}>
                  Question {question.questionIndex + 1} of {question.totalQuestions}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: timerColor, fontWeight: 700, fontSize: '20px', minWidth: '28px', textAlign: 'right' }}>
                    {timeLeft}
                  </span>
                  <span style={{ color: '#475569', fontSize: '13px' }}>sec</span>
                </div>
              </div>

              {/* Timer bar */}
              <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', marginBottom: '32px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${timerPct}%`, borderRadius: '3px',
                  background: timerColor, transition: 'width 1s linear, background 0.3s',
                }} />
              </div>

              <h2 style={{ color: '#f1f5f9', fontSize: '20px', fontWeight: 700, marginBottom: '28px', lineHeight: '1.5', textAlign: 'center' }}>
                {question.questionText}
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {question.options.map((opt, i) => {
                  const isSelected = selectedIndex === i;
                  return (
                    <button
                      key={i}
                      onClick={() => handleAnswer(i)}
                      disabled={hasAnswered}
                      style={{
                        padding: '16px 18px', borderRadius: '14px', border: 'none',
                        background: isSelected
                          ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                          : 'rgba(255,255,255,0.06)',
                        color: isSelected ? 'white' : '#cbd5e1',
                        fontSize: '14px', fontWeight: isSelected ? 700 : 400,
                        cursor: hasAnswered ? 'not-allowed' : 'pointer',
                        textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px',
                        boxShadow: isSelected ? '0 4px 20px rgba(99,102,241,0.5)' : 'none',
                        transition: 'all 0.2s',
                        outline: '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      <span style={{
                        width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
                        background: isSelected ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.07)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: '13px',
                      }}>
                        {ALPHABET[i]}
                      </span>
                      {opt}
                    </button>
                  );
                })}
              </div>

              {hasAnswered && (
                <div style={{
                  marginTop: '24px', textAlign: 'center', color: '#64748b',
                  fontSize: '14px', padding: '12px',
                  background: 'rgba(255,255,255,0.03)', borderRadius: '10px',
                }}>
                  ✅ Answer locked in — waiting for others...
                </div>
              )}
            </div>
          )}

          {/* REVEAL STATE */}
          {status === 'in_progress' && revealData && question && (
            <div style={{ width: '100%', maxWidth: '600px' }}>
              <h2 style={{ color: '#f1f5f9', fontSize: '18px', marginBottom: '20px', textAlign: 'center' }}>
                {question.questionText}
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '28px' }}>
                {question.options.map((opt, i) => {
                  const isCorrect = i === revealData.correctIndex;
                  const wasSelected = i === selectedIndex;
                  return (
                    <div key={i} style={{
                      padding: '16px 18px', borderRadius: '14px',
                      background: isCorrect
                        ? 'rgba(16,185,129,0.2)'
                        : wasSelected ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${isCorrect ? 'rgba(16,185,129,0.5)' : wasSelected ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.08)'}`,
                      color: isCorrect ? '#34d399' : wasSelected ? '#f87171' : '#64748b',
                      display: 'flex', alignItems: 'center', gap: '12px',
                      fontSize: '14px', fontWeight: isCorrect ? 700 : 400,
                    }}>
                      <span style={{ fontSize: '16px' }}>{isCorrect ? '✅' : wasSelected ? '❌' : ''}</span>
                      {opt}
                    </div>
                  );
                })}
              </div>

              <h3 style={{ color: '#94a3b8', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
                Leaderboard
              </h3>
              {revealData.leaderboard.map((p, i) => (
                <div key={p.userId || i} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 14px', borderRadius: '10px', marginBottom: '6px',
                  background: i === 0 ? 'rgba(251,191,36,0.1)' : 'rgba(255,255,255,0.04)',
                  border: i === 0 ? '1px solid rgba(251,191,36,0.3)' : '1px solid rgba(255,255,255,0.06)',
                }}>
                  <span style={{ color: i === 0 ? '#fbbf24' : '#64748b', fontWeight: 700, width: '24px' }}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                  </span>
                  <span style={{ color: '#e2e8f0', flex: 1, fontWeight: 500 }}>{p.displayName}</span>
                  <span style={{ color: '#6366f1', fontWeight: 700 }}>{p.score} pts</span>
                </div>
              ))}
              <p style={{ textAlign: 'center', color: '#475569', fontSize: '13px', marginTop: '16px' }}>
                ⏳ Next question coming up...
              </p>
            </div>
          )}

          {/* COMPLETED STATE */}
          {status === 'completed' && finalLeaderboard && (
            <div style={{ width: '100%', maxWidth: '520px', textAlign: 'center' }}>
              <div style={{ fontSize: '64px', marginBottom: '16px' }}>🏆</div>
              <h2 style={{ color: '#f1f5f9', marginBottom: '6px' }}>Challenge Complete!</h2>
              <p style={{ color: '#64748b', marginBottom: '32px' }}>Final results are in</p>

              {finalLeaderboard.map((p, i) => (
                <div key={p.userId || i} style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  padding: '14px 20px', borderRadius: '14px', marginBottom: '10px',
                  background: i === 0 ? 'linear-gradient(135deg, rgba(251,191,36,0.15), rgba(251,191,36,0.05))' : 'rgba(255,255,255,0.04)',
                  border: i === 0 ? '1px solid rgba(251,191,36,0.4)' : '1px solid rgba(255,255,255,0.07)',
                  textAlign: 'left',
                }}>
                  <span style={{ fontSize: '22px' }}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#f1f5f9', fontWeight: 600 }}>{p.displayName}</div>
                    <div style={{ color: '#64748b', fontSize: '12px' }}>{p.userId === myUserId ? 'You' : ''}</div>
                  </div>
                  <span style={{ color: i === 0 ? '#fbbf24' : '#6366f1', fontWeight: 800, fontSize: '20px' }}>
                    {p.score}
                  </span>
                  <span style={{ color: '#475569', fontSize: '12px' }}>pts</span>
                </div>
              ))}

              <button
                onClick={onExit}
                style={{
                  marginTop: '28px', padding: '14px 36px',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  color: 'white', border: 'none', borderRadius: '14px',
                  fontSize: '15px', fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
                }}
              >
                Back to Lab
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ChallengeRoom;