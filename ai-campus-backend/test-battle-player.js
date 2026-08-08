const { io } = require('socket.io-client');

// Usage: node test-battle-player.js <token> <gameId> <isCreator: yes/no>
const token = process.argv[2];
const gameId = process.argv[3];
const isCreator = process.argv[4] === 'yes';

const socket = io('http://localhost:4001');

socket.on('connect', () => {
  console.log('connected, waiting a moment before joining battle room...');

  if (isCreator) {
    console.log('starting the game...');
    socket.emit('game:start', { gameId, token });
  }

  // Give the server a moment to process game:start before joining the room
  setTimeout(() => {
    socket.emit('battle:join-room', { gameId, token });
  }, 500);
});

socket.on('battle:room-state', (state) => {
  console.log('\nBATTLE ROOM STATE:');
  console.log('Arena size:', state.arenaWidth, 'x', state.arenaHeight);
  console.log('Walls:', state.walls);
  console.log('Players:', state.players);
  console.log('Time remaining (ms):', state.msRemaining);

  // Try moving right for 4 seconds — if a wall is in the way, position should stop changing
  console.log('\nMoving right...');
  socket.emit('battle:move-input', { gameId, token, dx: 1, dy: 0 });

  setTimeout(() => {
    socket.emit('battle:move-input', { gameId, token, dx: 0, dy: 0 });
    console.log('stopped moving');
  }, 4000);
});

socket.on('battle:update', (data) => {
  const me = data.players.find((p) => true); // just log everyone for this simple test
  console.log('positions ->', data.players.map((p) => `${p.displayName}: (${Math.round(p.x)}, ${Math.round(p.y)})`).join(' | '), `| time left: ${Math.round(data.msRemaining / 1000)}s`);
});

socket.on('game:started', (data) => {
  console.log('\nGAME STARTED. Duration:', data.durationSec, 'seconds. Arena:', data.arenaWidth, 'x', data.arenaHeight);
});

socket.on('game:error', (err) => {
  console.log('ERROR:', err.message);
});