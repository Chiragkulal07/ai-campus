const { io } = require('socket.io-client');

// Usage: node test-challenge-player.js <token> <challengeId> <isCreator: yes/no>
const token = process.argv[2];
const challengeId = process.argv[3];
const isCreator = process.argv[4] === 'yes';

const socket = io('http://localhost:4001');

socket.on('connect', () => {
  console.log('connected, joining challenge room...');
  socket.emit('challenge:join-room', { challengeId, token });
});

socket.on('challenge:room-state', (state) => {
  console.log('room state:', state);
  if (isCreator) {
    console.log('starting the challenge...');
    socket.emit('challenge:start', { challengeId, token });
  }
});

socket.on('challenge:started', () => {
  console.log('CHALLENGE STARTED');
});

socket.on('challenge:question', (q) => {
  console.log(`\nQUESTION ${q.questionIndex + 1}/${q.totalQuestions}: ${q.questionText}`);
  q.options.forEach((opt, i) => console.log(`  [${i}] ${opt}`));

  // Simulate answering — just always picks option 0 for this test
  setTimeout(() => {
    console.log('submitting answer: 0');
    socket.emit('challenge:answer', { challengeId, questionIndex: q.questionIndex, selectedIndex: 0, token });
  }, 1000);
});

socket.on('challenge:reveal', (data) => {
  console.log(`correct answer was index ${data.correctIndex}`);
  console.log('leaderboard:', data.leaderboard);
});

socket.on('challenge:completed', (data) => {
  console.log('\nCHALLENGE COMPLETED. Final leaderboard:', data.leaderboard);
  process.exit(0);
});

socket.on('challenge:error', (err) => {
  console.log('ERROR:', err.message);
});