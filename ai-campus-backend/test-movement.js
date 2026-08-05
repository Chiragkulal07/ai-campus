const { io } = require('socket.io-client');

// When you run this, pass a name, like: node test-movement.js Alice
const playerName = process.argv[2] || 'Player';

const socket = io('http://localhost:4001');

socket.on('connect', () => {
  console.log(`${playerName} connected as ${socket.id}`);

  // Simulate holding the right arrow key
  socket.emit('move-input', { dx: 1, dy: 0 });

  setTimeout(() => {
    // Simulate releasing the key after 3 seconds
    socket.emit('move-input', { dx: 0, dy: 0 });
    console.log(`${playerName} stopped moving`);
  }, 3000);
});

socket.on('world-snapshot', (players) => {
  console.log(`${playerName} sees initial world:`, players);
});

socket.on('player-joined', (player) => {
  console.log(`${playerName} sees new player join:`, player.id);
});

socket.on('world-update', (players) => {
  const summary = players.map(p => `${p.id.slice(0, 5)}: (${p.x}, ${p.y})`).join(' | ');
  console.log(`${playerName} sees positions -> ${summary}`);
});

socket.on('player-left', (id) => {
  console.log(`${playerName} sees player leave:`, id);
});