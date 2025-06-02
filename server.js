const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

// Create Express app and HTTP server
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Game state
const rooms = {};
const PLAYER_LIMIT = 2;

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Handle player joining a game
  socket.on('joinGame', (roomId) => {
    // Create room if it doesn't exist
    if (!rooms[roomId]) {
      rooms[roomId] = {
        id: roomId,
        players: [],
        gameState: {
          terrain: null,
          currentPlayer: 0,
          wind: 0,
          projectile: null,
          gameOver: false
        }
      };
    }

    // Check if room is full
    if (rooms[roomId].players.length >= PLAYER_LIMIT) {
      socket.emit('roomFull');
      return;
    }

    // Add player to room
    const player = {
      id: socket.id,
      x: rooms[roomId].players.length === 0 ? 100 : 700, // Position based on player number
      y: 300,
      health: 100,
      angle: 45,
      power: 50,
      selectedWeapon: 0
    };

    socket.join(roomId);
    rooms[roomId].players.push(player);
    socket.emit('gameJoined', { roomId, playerId: player.id, playerNumber: rooms[roomId].players.length });
    
    // If room is now full, start the game
    if (rooms[roomId].players.length === PLAYER_LIMIT) {
      // Generate terrain and initial game state
      const terrain = generateTerrain();
      rooms[roomId].gameState.terrain = terrain;
      rooms[roomId].gameState.wind = (Math.random() * 0.6 - 0.3); // Random wind -0.3 to 0.3
      
      // Update player positions based on terrain
      rooms[roomId].players.forEach(player => {
        player.y = findTerrainHeight(terrain, player.x);
      });
      
      io.to(roomId).emit('gameStart', {
        gameState: rooms[roomId].gameState,
        players: rooms[roomId].players
      });
    }
  });

  // Handle player actions
  socket.on('playerAction', ({ roomId, action, data }) => {
    const room = rooms[roomId];
    if (!room) return;
    
    const playerIndex = room.players.findIndex(p => p.id === socket.id);
    if (playerIndex === -1 || playerIndex !== room.gameState.currentPlayer) return;
    
    switch (action) {
      case 'move':
        // Validate and apply move
        const newX = room.players[playerIndex].x + data.dx;
        if (newX >= 50 && newX <= 750) {
          room.players[playerIndex].x = newX;
          room.players[playerIndex].y = findTerrainHeight(room.gameState.terrain, newX);
          io.to(roomId).emit('gameUpdate', {
            gameState: room.gameState,
            players: room.players
          });
        }
        break;
        
      case 'fire':
        // Start projectile simulation
        room.gameState.projectile = {
          x: room.players[playerIndex].x,
          y: room.players[playerIndex].y - 10,
          vx: Math.cos(data.angle * Math.PI / 180) * data.power / 5,
          vy: -Math.sin(data.angle * Math.PI / 180) * data.power / 5,
          type: data.weaponType
        };
        
        // Schedule the projectile updates on the server
        simulateProjectile(roomId);
        break;
        
      case 'updateAngle':
        room.players[playerIndex].angle = data.angle;
        io.to(roomId).emit('gameUpdate', {
          gameState: room.gameState,
          players: room.players
        });
        break;
        
      case 'updatePower':
        room.players[playerIndex].power = data.power;
        io.to(roomId).emit('gameUpdate', {
          gameState: room.gameState,
          players: room.players
        });
        break;
        
      case 'selectWeapon':
        room.players[playerIndex].selectedWeapon = data.weaponIndex;
        io.to(roomId).emit('gameUpdate', {
          gameState: room.gameState,
          players: room.players
        });
        break;
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Find and remove player from any rooms
    for (const roomId in rooms) {
      const room = rooms[roomId];
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      
      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);
        
        // If room is now empty, remove it
        if (room.players.length === 0) {
          delete rooms[roomId];
        } else {
          // Notify remaining players
          io.to(roomId).emit('playerDisconnected', { playerId: socket.id });
        }
        break;
      }
    }
  });
});

// Helper function to generate terrain
function generateTerrain() {
  const width = 80; // 800px / 10px grid size
  const height = 60; // 600px / 10px grid size
  const terrain = Array(width).fill().map(() => Array(height).fill(0));
  
  // Simple terrain generation - will be improved in the client rendering
  const baseHeight = height - 15;
  for (let x = 0; x < width; x++) {
    // Simple sine wave terrain
    const h = Math.floor(baseHeight + Math.sin(x / 10) * 5);
    for (let y = h; y < height; y++) {
      terrain[x][y] = 1;
    }
  }
  
  return terrain;
}

// Helper function to find terrain height at a position
function findTerrainHeight(terrain, x) {
  const gridX = Math.floor(x / 10); // Assuming 10px grid size
  
  // Find the highest terrain point at this x
  for (let y = 0; y < terrain[0].length; y++) {
    if (terrain[gridX][y] === 1) {
      return y * 10 - 10; // Adjust for tank height
    }
  }
  
  return 500; // Default height if no terrain found
}

// Function to simulate projectile path on the server
function simulateProjectile(roomId) {
  const room = rooms[roomId];
  if (!room || !room.gameState.projectile) return;
  
  const projectile = room.gameState.projectile;
  const gravity = 0.5;
  const wind = room.gameState.wind;
  
  // Update projectile position
  projectile.vx += wind;
  projectile.x += projectile.vx;
  projectile.y += projectile.vy;
  projectile.vy += gravity;
  
  // Send update to clients
  io.to(roomId).emit('projectileUpdate', {
    projectile: projectile
  });
  
  // Check if projectile is out of bounds
  if (projectile.x < 0 || projectile.x > 800 || projectile.y < 0 || projectile.y > 600) {
    endTurn(roomId);
    return;
  }
  
  // Check collision with terrain or players
  const gridX = Math.floor(projectile.x / 10);
  const gridY = Math.floor(projectile.y / 10);
  
  // Terrain collision
  if (gridX >= 0 && gridX < room.gameState.terrain.length &&
      gridY >= 0 && gridY < room.gameState.terrain[0].length &&
      room.gameState.terrain[gridX][gridY] === 1) {
    handleImpact(roomId);
    return;
  }
  
  // Player collision (simplified)
  for (let i = 0; i < room.players.length; i++) {
    const player = room.players[i];
    if (Math.abs(projectile.x - player.x) < 15 && Math.abs(projectile.y - player.y) < 10) {
      // Direct hit
      player.health -= 20; // Base damage
      handleImpact(roomId);
      return;
    }
  }
  
  // Continue simulation on next frame
  setTimeout(() => simulateProjectile(roomId), 16); // ~60fps
}

// Handle projectile impact
function handleImpact(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  
  // Simplified impact handling - can be expanded with explosion radius, etc.
  
  // Check if any player is dead
  const deadPlayerIndex = room.players.findIndex(p => p.health <= 0);
  if (deadPlayerIndex !== -1) {
    room.gameState.gameOver = true;
    room.gameState.winner = 1 - deadPlayerIndex; // Other player wins
    
    io.to(roomId).emit('gameOver', {
      winner: room.gameState.winner,
      players: room.players
    });
  } else {
    endTurn(roomId);
  }
}

// End current turn and prepare for next
function endTurn(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  
  // Clear projectile
  room.gameState.projectile = null;
  
  // Switch to next player
  room.gameState.currentPlayer = (room.gameState.currentPlayer + 1) % room.players.length;
  
  // Generate new wind
  room.gameState.wind = (Math.random() * 0.6 - 0.3); // Random wind -0.3 to 0.3
  
  io.to(roomId).emit('turnEnd', {
    gameState: room.gameState,
    players: room.players
  });
}

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 