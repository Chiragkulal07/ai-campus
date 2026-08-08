const { io } = require('socket.io-client');

// Usage: node test-shooting.js <shooterToken> <targetToken> <gameId>
const shooterToken = process.argv[2];
const targetToken = process.argv[3];
const gameId = process.argv[4];

const shooterSocket = io('http://localhost:4001');
const targetSocket = io('http://localhost:4001');

let shotsFired = 0;
const TOTAL_SHOTS = 5;

shooterSocket.on('connect_error', (err) => console.log('SHOOTER CONNECTION FAILED:', err.message));
targetSocket.on('connect_error', (err) => console.log('TARGET CONNECTION FAILED:', err.message));

shooterSocket.on('connect', () => {
  console.log('shooter connected, starting the game...');
  shooterSocket.emit('game:start', { gameId, token: shooterToken });

  setTimeout(() => {
    shooterSocket.emit('battle:join-room', { gameId, token: shooterToken });
  }, 500);
});

targetSocket.on('connect', () => {
  setTimeout(() => {
    targetSocket.emit('battle:join-room', { gameId, token: targetToken });
  }, 700);
});

shooterSocket.on('battle:room-state', (state) => {
  console.log('\nShooter sees room state. Players:', state.players.map(p => `${p.displayName} @ (${p.x},${p.y}) hp:${p.hp}`));

  // Both players spawn at the same y-coordinate (80), so an angle of 0
  // (pointing straight right, since Player 1 spawns at x:80 and Player 2 at x:920)
  // should score a direct hit every time — a clean, predictable test.
  console.log('\nFiring 5 shots, one every 800ms, aimed straight right (angle 0)...');

  const fireInterval = setInterval(() => {
    if (shotsFired >= TOTAL_SHOTS) {
      clearInterval(fireInterval);
      return;
    }
    shotsFired++;
    console.log(`\n--- Shot ${shotsFired} ---`);
    shooterSocket.emit('battle:fire', { gameId, token: shooterToken, angle: 0 });
  }, 800);
});

shooterSocket.on('battle:shot-fired', (data) => {
  console.log('shot fired by', data.shooterId.slice(0, 6), '- hit point:', data.hitPoint);
});

shooterSocket.on('battle:hit', (data) => {
  console.log(`HIT confirmed — target ${data.targetId.slice(0, 6)} now at ${data.newHp} HP`);
});

shooterSocket.on('battle:kill', (data) => {
  console.log(`\n*** KILL *** ${data.killerName} eliminated ${data.victimName}. Killer now has ${data.killerKills} kill(s).`);
});

shooterSocket.on('battle:respawn', (data) => {
  console.log(`\nRESPAWN — ${data.userId.slice(0, 6)} is back at (${data.x}, ${data.y}) with full HP.`);
  console.log('\nTest complete — shutting down.');
  setTimeout(() => process.exit(0), 500);
});

shooterSocket.on('game:error', (err) => console.log('SHOOTER ERROR:', err.message));
targetSocket.on('game:error', (err) => console.log('TARGET ERROR:', err.message));