const { io } = require('socket.io-client');

// Usage: node test-wall-collision.js <token> <gameId> <isCreator: yes/no>
const token = process.argv[2];
const gameId = process.argv[3];
const isCreator = process.argv[4] === 'yes';

const socket = io('http://localhost:4001');

socket.on('connect_error', (err) => {
  console.log('CONNECTION FAILED:', err.message);
});

socket.on('connect', () => {
  console.log('connected, waiting a moment before joining battle room...');

  if (isCreator) {
    console.log('starting the game...');
    socket.emit('game:start', { gameId, token });
  }

  setTimeout(() => {
    socket.emit('battle:join-room', { gameId, token });
  }, 500);
});

socket.on('battle:room-state', () => {
  console.log('\nMoving DOWN first, to align with the wall at y:150-190...');
  socket.emit('battle:move-input', { gameId, token, dx: 0, dy: 1 });

  // After moving down for 1.4s (should land around y=150, matching the wall's y-range),
  // stop vertical movement and start moving right into the wall at x:400-600
  setTimeout(() => {
    console.log('\nNow moving RIGHT, straight into the wall...');
    socket.emit('battle:move-input', { gameId, token, dx: 1, dy: 0 });
  }, 1400);

  // Stop after giving it plenty of time to hit the wall and get stuck.
  // Wall starts at x:400, player radius 16, so it should stop around x≈368.
  // Starting rightward move from x≈80, that's ~288px needed at 50px/sec ≈ 5.8s —
  // giving 8 seconds total of rightward movement to be safe.
  setTimeout(() => {
    socket.emit('battle:move-input', { gameId, token, dx: 0, dy: 0 });
    console.log('\nstopped moving — check above: x should have stopped increasing around x≈368 (well before the 984 arena edge)');
    process.exit(0);
  }, 10000);
});

socket.on('battle:update', (data) => {
  const me = data.players.find((p) => p.userId);
  console.log('positions ->', data.players.map((p) => `${p.displayName}: (${Math.round(p.x)}, ${Math.round(p.y)})`).join(' | '));
});

socket.on('game:started', (data) => {
  console.log('\nGAME STARTED.');
});

socket.on('game:error', (err) => {
  console.log('ERROR:', err.message);
});