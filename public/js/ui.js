// UI event handlers
function setupUIListeners() {
  // Menu screen buttons
  document.getElementById('create-game').addEventListener('click', createGame);
  document.getElementById('join-game').addEventListener('click', joinGame);
  document.getElementById('cancel-game').addEventListener('click', cancelGame);
  
  // Game controls
  document.getElementById('move-left').addEventListener('click', () => movePlayer('left'));
  document.getElementById('move-right').addEventListener('click', () => movePlayer('right'));
  document.getElementById('fire').addEventListener('click', fireWeapon);
  
  document.getElementById('angle-up').addEventListener('click', () => updateAngle(5));
  document.getElementById('angle-down').addEventListener('click', () => updateAngle(-5));
  
  document.getElementById('power-up').addEventListener('click', () => updatePower(5));
  document.getElementById('power-down').addEventListener('click', () => updatePower(-5));
  
  // Weapon selection
  document.querySelectorAll('.weapon-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const weaponIndex = parseInt(e.target.dataset.weapon);
      selectWeapon(weaponIndex);
    });
  });
  
  // Game over screen
  document.getElementById('play-again').addEventListener('click', playAgain);
  document.getElementById('main-menu').addEventListener('click', returnToMainMenu);
  
  // Keyboard controls
  document.addEventListener('keydown', handleKeyDown);
}

// Keyboard controls
function handleKeyDown(e) {
  // Only handle keyboard input during gameplay
  if (!gameState.isMyTurn || document.getElementById('game-screen').classList.contains('hidden')) {
    return;
  }
  
  switch (e.key) {
    case 'ArrowLeft':
      movePlayer('left');
      break;
    case 'ArrowRight':
      movePlayer('right');
      break;
    case 'ArrowUp':
      updateAngle(5);
      break;
    case 'ArrowDown':
      updateAngle(-5);
      break;
    case 'w':
    case 'W':
      updatePower(5);
      break;
    case 's':
    case 'S':
      updatePower(-5);
      break;
    case ' ':
      fireWeapon();
      break;
    case '1':
    case '2':
    case '3':
      const weaponIndex = parseInt(e.key) - 1;
      if (weaponIndex >= 0 && weaponIndex < 3) {
        selectWeapon(weaponIndex);
      }
      break;
  }
}

// Game creation and joining
function createGame() {
  // Generate a random 6-character room code
  const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
  
  // Join the room
  socket.emit('joinGame', roomId);
}

function joinGame() {
  const roomIdInput = document.getElementById('game-code');
  const roomId = roomIdInput.value.trim().toUpperCase();
  
  if (roomId.length > 0) {
    socket.emit('joinGame', roomId);
  } else {
    alert('Please enter a valid game code.');
  }
}

function cancelGame() {
  // Return to main menu
  showScreen('menu-screen');
  
  // Disconnect from room
  socket.disconnect();
  
  // Reconnect
  socket.connect();
}

// Game over options
function playAgain() {
  // Return to menu to create/join a new game
  showScreen('menu-screen');
  
  // Disconnect and reconnect to reset socket
  socket.disconnect();
  socket.connect();
}

function returnToMainMenu() {
  // Same as play again for now
  playAgain();
} 