import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
function CodingLab({ token, onEnterChallenge }) {
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [category, setCategory] = useState('MCQ_SPRINT');
  const [difficulty, setDifficulty] = useState('EASY');
  const [questionCount, setQuestionCount] = useState(3);
  const [maxParticipants, setMaxParticipants] = useState(4);
  const [creating, setCreating] = useState(false);

  const loadChallenges = () => {
    setLoading(true);
    fetch('http://localhost:4000/challenges')
      .then((res) => res.json())
      .then((data) => {
        setChallenges(data);
        setLoading(false);
      })
      .catch(() => {
        setError('could not load challenges — is index.js running?');
        setLoading(false);
      });
  };

 useEffect(() => {
    loadChallenges();

    // Listen for challenges created by ANYONE, and add them to the list live
    const socket = io('http://localhost:4001');

    socket.on('challenge:created', (newChallenge) => {
      setChallenges((prev) => [newChallenge, ...prev]);
    });

    return () => socket.disconnect();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError('');

    try {
      const res = await fetch('http://localhost:4000/challenges', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          category,
          difficulty,
          questionCount: Number(questionCount),
          maxParticipants: Number(maxParticipants)
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'could not create challenge');
        setCreating(false);
        return;
      }

      setName('');
      setCreating(false);
      loadChallenges();
    } catch (err) {
      setError('could not reach the server');
      setCreating(false);
    }
  };

 const handleJoin = async (challengeId) => {
    setError('');
    const res = await fetch(`http://localhost:4000/challenges/${challengeId}/join`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await res.json();

    if (!res.ok) {
      // If we're already a participant (e.g. the creator navigated away and came back),
      // that's not really a failure — just let them back into the room they already joined.
      if (data.error === 'you already joined this challenge') {
        onEnterChallenge(challengeId);
        return;
      }

      setError(data.error || 'could not join challenge');
      return;
    }

    onEnterChallenge(challengeId);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '700px', margin: '0 auto' }}>
      <h2>Coding Lab</h2>

      <h3>Create a Challenge</h3>
      <form onSubmit={handleCreate} style={{ marginBottom: '30px' }}>
        <div style={{ marginBottom: '8px' }}>
          <input
            type="text"
            placeholder="Challenge name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ width: '100%', padding: '8px' }}
            required
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ flex: 1, padding: '8px' }}>
            <option value="MCQ_SPRINT">MCQ Sprint</option>
            <option value="DSA_BATTLE">DSA Battle</option>
            <option value="SQL_CHALLENGE">SQL Challenge</option>
          </select>

          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} style={{ flex: 1, padding: '8px' }}>
            <option value="EASY">Easy</option>
            <option value="MEDIUM">Medium</option>
            <option value="HARD">Hard</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <input
            type="number"
            min="1"
            max="8"
            value={questionCount}
            onChange={(e) => setQuestionCount(e.target.value)}
            style={{ flex: 1, padding: '8px' }}
          />
          <input
            type="number"
            min="1"
            max="20"
            value={maxParticipants}
            onChange={(e) => setMaxParticipants(e.target.value)}
            style={{ flex: 1, padding: '8px' }}
          />
        </div>
        <p style={{ fontSize: '12px', color: '#666' }}>Left number = question count, right number = max participants</p>

        <button type="submit" disabled={creating} style={{ padding: '10px 16px', cursor: 'pointer' }}>
          {creating ? 'Creating...' : 'Create Challenge'}
        </button>
      </form>

      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      <h3>Open Challenges</h3>
      {loading && <p>Loading...</p>}
      {!loading && challenges.length === 0 && <p>No open challenges right now — create one above.</p>}

      {challenges.map((c) => (
        <div
          key={c.id}
          style={{
            border: '1px solid #ccc',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '10px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div>
            <strong>{c.name}</strong> — {c.category} ({c.difficulty})
            <br />
            <span style={{ fontSize: '13px', color: '#666' }}>
              {c.currentParticipants}/{c.maxParticipants} joined · by {c.creatorName}
            </span>
          </div>
          <button onClick={() => handleJoin(c.id)} style={{ padding: '8px 14px', cursor: 'pointer' }}>
            Join
          </button>
        </div>
      ))}
    </div>
  );
}

export default CodingLab;