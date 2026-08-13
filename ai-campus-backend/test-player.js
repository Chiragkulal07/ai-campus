const { io } = require('socket.io-client');

const socket = io(SOCKET_URL);

socket.on('connect', () => {
  console.log('connected to realtime-server');
  socket.emit('ping-test', 'hello from test client');
});

socket.on('pong-test', (msg) => {
  console.log('server replied:', msg);
  process.exit(0);
});