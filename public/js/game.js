// Constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const GRID_SIZE = 10;
const GRAVITY = 0.5;
const COLORS = {
  SKY: '#87CEEB',
  TERRAIN_TOP: '#8B4513',
  TERRAIN_INNER: '#654321',
  TANK1: '#FF5555',
  TANK2: '#5555FF',
  PROJECTILE: {
    STANDARD: '#000000',
    EXPLOSIVE: '#FF0000',
    PIERCE: '#0000FF'
  }
};

// Game state
const gameState = {
  playerId: null,
  playerNumber: null,
  roomId: null,
  players: [],
  terrain: null,
  wind: 0,
  currentPlayer: 0,
  projectile: null,
  gameOver: false,
  winner: null,
  isMyTurn: false
};

// Socket.io connection
const socket = io();

// Canvas setup
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// Initialize game
function initGame() {
  // Make sure menu screen is shown first
  showScreen('menu-screen');
  
  // Socket event listeners
  setupSocketListeners();
  
  // UI event listeners
  setupUIListeners();
}

// Setup Socket.io event listeners
function setupSocketListeners() {
  // Connection events
  socket.on('connect', () => {
    console.log('Connected to server with ID:', socket.id);
  });
  
  socket.on('gameJoined', (data) => {
    console.log('Joined game:', data);
    gameState.playerId = data.playerId;
    gameState.playerNumber = data.playerNumber;
    gameState.roomId = data.roomId;
    
    // Show room code on waiting screen
    document.getElementById('room-code').textContent = data.roomId;
    
    // Switch to waiting screen
    showScreen('waiting-screen');
  });
  
  socket.on('roomFull', () => {
    alert('This game is already full.');
    showScreen('menu-screen');
  });
  
  // Game state events
  socket.on('gameStart', (data) => {
    console.log('Game started:', data);
    
    // Update game state
    gameState.terrain = data.gameState.terrain;
    gameState.wind = data.gameState.wind;
    gameState.currentPlayer = data.gameState.currentPlayer;
    gameState.players = data.players;
    
    // Check if it's player's turn
    gameState.isMyTurn = gameState.playerNumber === gameState.currentPlayer + 1;
    
    // Show game screen and hide other screens
    showScreen('game-screen');
    
    // Update UI
    updateUI();
    
    // Show controls if it's player's turn
    toggleControls(gameState.isMyTurn);
    
    // Start game loop
    window.requestAnimationFrame(gameLoop);
  });
  
  socket.on('gameUpdate', (data) => {
    console.log('Game update:', data);
    
    // Update game state
    gameState.gameState = data.gameState;
    gameState.players = data.players;
    gameState.currentPlayer = data.gameState.currentPlayer;
    
    // Check if it's player's turn
    gameState.isMyTurn = gameState.playerNumber === gameState.currentPlayer + 1;
    
    // Update UI
    updateUI();
    
    // Toggle controls
    toggleControls(gameState.isMyTurn);
  });
  
  socket.on('projectileUpdate', (data) => {
    // Update projectile position
    gameState.projectile = data.projectile;
  });
  
  socket.on('turnEnd', (data) => {
    // Update game state
    gameState.gameState = data.gameState;
    gameState.players = data.players;
    gameState.currentPlayer = data.gameState.currentPlayer;
    gameState.wind = data.gameState.wind;
    gameState.projectile = null;
    
    // Check if it's player's turn
    gameState.isMyTurn = gameState.playerNumber === gameState.currentPlayer + 1;
    
    // Update UI
    updateUI();
    
    // Toggle controls
    toggleControls(gameState.isMyTurn);
  });
  
  socket.on('gameOver', (data) => {
    // Update game state
    gameState.gameOver = true;
    gameState.winner = data.winner;
    
    // Show game over screen
    showGameOver(data.winner);
  });
  
  socket.on('playerDisconnected', (data) => {
    alert('Opponent disconnected.');
    showScreen('menu-screen');
  });
}

// Game loop
function gameLoop() {
  // Clear canvas
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  
  // Draw background
  drawBackground();
  
  // Draw terrain
  drawTerrain();
  
  // Draw players
  drawPlayers();
  
  // Draw projectile if exists
  if (gameState.projectile) {
    drawProjectile();
  }
  
  // Draw wind indicator
  drawWindIndicator();
  
  // Continue the loop
  window.requestAnimationFrame(gameLoop);
}

// Draw functions
function drawBackground() {
  ctx.fillStyle = COLORS.SKY;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

function drawTerrain() {
  if (!gameState.terrain) return;
  
  for (let x = 0; x < gameState.terrain.length; x++) {
    for (let y = 0; y < gameState.terrain[x].length; y++) {
      if (gameState.terrain[x][y] === 1) {
        // Determine if it's top of terrain
        const isTop = y > 0 && gameState.terrain[x][y-1] === 0;
        
        ctx.fillStyle = isTop ? COLORS.TERRAIN_TOP : COLORS.TERRAIN_INNER;
        ctx.fillRect(x * GRID_SIZE, y * GRID_SIZE, GRID_SIZE, GRID_SIZE);
      }
    }
  }
}

function drawPlayers() {
  if (!gameState.players || gameState.players.length === 0) return;
  
  gameState.players.forEach((player, index) => {
    const color = index === 0 ? COLORS.TANK1 : COLORS.TANK2;
    drawTank(player.x, player.y, color, player.angle, index === gameState.currentPlayer);
    
    // Update health display
    updatePlayerHealth(index + 1, player.health);
  });
}

function drawTank(x, y, color, angle, isCurrentPlayer) {
  // Draw tank body
  ctx.fillStyle = color;
  ctx.fillRect(x - 15, y - 10, 30, 20);
  
  // Draw tank cannon with correct angle
  const facingRight = x < CANVAS_WIDTH / 2;
  const actualAngle = facingRight ? angle : 180 - angle;
  const radians = actualAngle * Math.PI / 180;
  
  const cannonLength = 30;
  const cannonEndX = x + Math.cos(radians) * cannonLength;
  const cannonEndY = y - 5 - Math.sin(radians) * cannonLength;
  
  ctx.beginPath();
  ctx.moveTo(x, y - 5);
  ctx.lineTo(cannonEndX, cannonEndY);
  ctx.lineWidth = 3;
  ctx.strokeStyle = color;
  ctx.stroke();
  
  // Highlight current player
  if (isCurrentPlayer) {
    ctx.beginPath();
    ctx.arc(x, y - 25, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
  }
}

function drawProjectile() {
  const projectile = gameState.projectile;
  if (!projectile) return;
  
  const weaponTypes = ['STANDARD', 'EXPLOSIVE', 'PIERCE'];
  const projectileColor = COLORS.PROJECTILE[weaponTypes[projectile.type] || 'STANDARD'];
  
  ctx.beginPath();
  ctx.arc(projectile.x, projectile.y, 3, 0, Math.PI * 2);
  ctx.fillStyle = projectileColor;
  ctx.fill();
}

function drawWindIndicator() {
  // Wind indicator is displayed in UI, not on canvas
  const windValue = document.getElementById('wind-value');
  const windArrow = document.getElementById('wind-arrow');
  
  if (windValue && windArrow) {
    // Update wind value text
    const windPercent = Math.round(gameState.wind * 100 / 0.3);
    windValue.textContent = `${Math.abs(windPercent)}%`;
    
    // Update arrow style
    windArrow.style.width = `${Math.abs(windPercent / 2)}px`;
    
    if (gameState.wind > 0) {
      // Wind blowing right
      windArrow.style.transform = 'scaleX(1)';
    } else {
      // Wind blowing left
      windArrow.style.transform = 'scaleX(-1)';
    }
  }
}

// Player actions
function movePlayer(direction) {
  if (!gameState.isMyTurn) return;
  
  socket.emit('playerAction', {
    roomId: gameState.roomId,
    action: 'move',
    data: {
      dx: direction === 'left' ? -10 : 10
    }
  });
}

function fireWeapon() {
  if (!gameState.isMyTurn) return;
  
  const playerIndex = gameState.playerNumber - 1;
  if (playerIndex < 0 || playerIndex >= gameState.players.length) return;
  
  const player = gameState.players[playerIndex];
  
  socket.emit('playerAction', {
    roomId: gameState.roomId,
    action: 'fire',
    data: {
      angle: player.angle,
      power: player.power,
      weaponType: player.selectedWeapon
    }
  });
  
  // Disable controls while projectile is in flight
  toggleControls(false);
}

function updateAngle(amount) {
  if (!gameState.isMyTurn) return;
  
  const playerIndex = gameState.playerNumber - 1;
  if (playerIndex < 0 || playerIndex >= gameState.players.length) return;
  
  const player = gameState.players[playerIndex];
  let newAngle = player.angle + amount;
  
  // Clamp angle between 0 and 90
  newAngle = Math.max(0, Math.min(90, newAngle));
  
  socket.emit('playerAction', {
    roomId: gameState.roomId,
    action: 'updateAngle',
    data: {
      angle: newAngle
    }
  });
}

function updatePower(amount) {
  if (!gameState.isMyTurn) return;
  
  const playerIndex = gameState.playerNumber - 1;
  if (playerIndex < 0 || playerIndex >= gameState.players.length) return;
  
  const player = gameState.players[playerIndex];
  let newPower = player.power + amount;
  
  // Clamp power between 10 and 100
  newPower = Math.max(10, Math.min(100, newPower));
  
  socket.emit('playerAction', {
    roomId: gameState.roomId,
    action: 'updatePower',
    data: {
      power: newPower
    }
  });
}

function selectWeapon(weaponIndex) {
  if (!gameState.isMyTurn) return;
  
  socket.emit('playerAction', {
    roomId: gameState.roomId,
    action: 'selectWeapon',
    data: {
      weaponIndex: weaponIndex
    }
  });
}

// UI helper functions
function toggleControls(show) {
  const controls = document.getElementById('controls');
  if (controls) {
    controls.classList.toggle('hidden', !show);
  }
  
  const turnIndicator = document.getElementById('current-turn');
  if (turnIndicator) {
    turnIndicator.textContent = show ? 'Your Turn' : 'Opponent\'s Turn';
  }
}

function updatePlayerHealth(playerNum, health) {
  const healthElement = document.getElementById(`player${playerNum}-health`);
  if (healthElement) {
    healthElement.style.width = `${health}%`;
  }
}

function updateUI() {
  // Update angle display
  const angleValue = document.getElementById('angle-value');
  const playerIndex = gameState.playerNumber - 1;
  
  if (angleValue && playerIndex >= 0 && gameState.players[playerIndex]) {
    angleValue.textContent = `${gameState.players[playerIndex].angle}°`;
  }
  
  // Update power display
  const powerValue = document.getElementById('power-value');
  if (powerValue && playerIndex >= 0 && gameState.players[playerIndex]) {
    powerValue.textContent = gameState.players[playerIndex].power;
  }
  
  // Update weapon selection
  if (playerIndex >= 0 && gameState.players[playerIndex]) {
    const selectedWeapon = gameState.players[playerIndex].selectedWeapon;
    
    document.querySelectorAll('.weapon-btn').forEach((btn, index) => {
      if (parseInt(btn.dataset.weapon) === selectedWeapon) {
        btn.classList.add('selected');
      } else {
        btn.classList.remove('selected');
      }
    });
  }
  
  // Update turn indicator
  const turnIndicator = document.getElementById('current-turn');
  if (turnIndicator) {
    turnIndicator.textContent = gameState.isMyTurn ? 'Your Turn' : 'Opponent\'s Turn';
  }
}

function showGameOver(winner) {
  const winnerText = document.getElementById('winner-text');
  if (winnerText) {
    const playerNum = gameState.playerNumber;
    const playerWon = (winner + 1) === playerNum;
    
    winnerText.textContent = playerWon ? 'You Win!' : 'You Lose!';
  }
  
  showScreen('game-over-screen');
}

function showScreen(screenId) {
  console.log('Showing screen:', screenId);
  
  // Hide all screens
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.add('hidden');
  });
  
  // Show the specified screen
  const screen = document.getElementById(screenId);
  if (screen) {
    screen.classList.remove('hidden');
  } else {
    console.error('Screen not found:', screenId);
  }
}

// Initialize the game when window loads
window.addEventListener('load', initGame); 