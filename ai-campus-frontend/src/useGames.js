import { useCallback, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { API_URL, SOCKET_URL } from './config';
import { readJson } from './utils';

// Open match list + join flow, shared by the Dashboard and the Gaming Lab.
export default function useGames(token, onEnterBattlefield) {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [joiningId, setJoiningId] = useState(null);

  const loadGames = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/games`);
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || 'Could not load matches');
      setGames(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message === 'Failed to fetch' ? 'Unable to reach the server.' : err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGames();
    const socket = io(SOCKET_URL);
    socket.on('game:created', (newGame) => {
      // De-duplicate: the same match can arrive from both the socket and a refetch.
      setGames((prev) => [newGame, ...prev.filter((g) => g.id !== newGame.id)]);
    });
    return () => socket.disconnect();
  }, [loadGames]);

  const joinGame = useCallback(async (gameId) => {
    setJoiningId(gameId);
    setError('');
    try {
      const res = await fetch(`${API_URL}/games/${gameId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      const data = await readJson(res);
      if (!res.ok && res.status !== 409) {
        setError(data.error ? data.error.charAt(0).toUpperCase() + data.error.slice(1) : 'Could not join match');
        return;
      }
      // 409 = already joined; just take the player back into the lobby.
      onEnterBattlefield(gameId);
    } catch {
      setError('Unable to reach the server.');
    } finally {
      setJoiningId(null);
    }
  }, [token, onEnterBattlefield]);

  return { games, loading, error, setError, joiningId, loadGames, joinGame };
}
