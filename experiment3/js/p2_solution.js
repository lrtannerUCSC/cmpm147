/* exported generateGrid, drawGrid */
/* global placeTile */

// Global variables
let currentMode = "dungeon"; // "dungeon" or "forest"
let chests = [];
let clickedChest = null;
let tileSize = 16;
let timeOfDay = 0;
let cycleSpeed = 0.001;

// Used in base.js
function switchMode() {
  currentMode = currentMode === "dungeon" ? "forest" : "dungeon";
  reseed();
}

function generateRiver(grid, numCols, numRows) {
  noiseSeed(Math.floor(random(10000)));
  const noiseScale = 0.1;
  let riverY = floor(random(numRows));
  
  for (let x = 0; x < numCols; x++) {
    const n = noise(x * noiseScale) * 2 - 1;
    riverY += floor(n * 1.5);
    riverY = constrain(riverY, 1, numRows-2);
    
    for (let yOffset = -1; yOffset <= 1; yOffset++) {
      const y = riverY + yOffset;
      if (y >= 0 && y < numRows) {
        grid[x][y] = "~";
      }
    }
  }
}

function generateRooms(grid, numCols, numRows, numRooms, mode) {
  const roomCenters = [];
  if (mode === "dungeon") chests = [];
  
  for (let r = 0; r < numRooms; r++) {
    const roomWidth = floor(random(mode === "dungeon" ? 5 : 3, numCols/3));
    const roomHeight = floor(random(mode === "dungeon" ? 5 : 3, numRows/3));
    
    const x = floor(random(1, numCols - roomWidth - 1));
    const y = floor(random(1, numRows - roomHeight - 1));
    
    roomCenters.push({
      x: x + floor(roomWidth/2),
      y: y + floor(roomHeight/2)
    });
    
    for (let i = x; i < x + roomWidth; i++) {
      for (let j = y; j < y + roomHeight; j++) {
        if (mode === "dungeon") {
          if (random(10) > 4 && i > x+1 && i < x+roomWidth-2 && j > y+1 && j < y+roomHeight-2) {
            grid[i][j] = "C";
            chests.push({x: i, y: j, opened: false, tileX: floor(random(3, 6)), tileY: floor(random(28, 30))});
          } else {
            grid[i][j] = ".";
          }
        } else {
          if (i > x+roomWidth/4 && i < x+roomWidth*.75 && j > y+roomHeight/4 && j < y+roomHeight*.75) {
            grid[i][j] = random(2) >= 1 ? "H" : ".";
          } else {
            grid[i][j] = ".";
          }
        }
      }
    }
  }
  return roomCenters;
}

function connectRooms(grid, roomCenters) {
  for (let i = 1; i < roomCenters.length; i++) {
    const start = roomCenters[i-1];
    const end = roomCenters[i];
    
    let x = start.x;
    while (x !== end.x) {
      grid[x][start.y] = ".";
      x += (x < end.x) ? 1 : -1;
    }
    
    let y = start.y;
    while (y !== end.y) {
      grid[x][y] = ".";
      y += (y < end.y) ? 1 : -1;
    }
  }
}

function generateGrid(numCols, numRows) {
  let grid = [];
  const numRooms = currentMode === "dungeon" ? 5 : 10;
  
  for (let i = 0; i < numCols; i++) {
    grid.push(new Array(numRows).fill("_"));
  }

  const roomCenters = generateRooms(grid, numCols, numRows, numRooms, currentMode);
  
  if (currentMode === "dungeon") {
    connectRooms(grid, roomCenters);
  } else {
    generateRiver(grid, numCols, numRows);
  }
  
  return grid;
}

// Combined drawing functions
function drawGrid(grid) {
  background(currentMode === "dungeon" ? 32 : 128);

  // Draw base tiles
  for (let i = 0; i < grid.length; i++) {
    for (let j = 0; j < grid[i].length; j++) {
      if (grid[i][j] === '.') {
        placeTile(i, j, floor(random(4)), currentMode === "dungeon" ? 15 : 0);
      }
      if (currentMode === "forest" && grid[i][j] === 'H') {
        placeTile(i, j, 26, floor(random(4)));
      }
      if (currentMode === "forest" && grid[i][j] === '~') {
        placeTile(i, j, floor(random(4)), 13);
      }
    }
  }

  // Draw special elements
  if (currentMode === "dungeon") {
    chests.forEach(chest => {
      placeTile(chest.x, chest.y, chest.opened ? chest.tileX-3 : chest.tileX, chest.tileY);
    });
  }

  // Draw walls with autotiling
  for (let i = 0; i < grid.length; i++) {
    for (let j = 0; j < grid[i].length; j++) {
      if (grid[i][j] === '_') {
        drawContext(grid, i, j, '.', 16, currentMode === "dungeon" ? 16 : 1);
      }
    }
  }

  // Forest-specific effects
  if (currentMode === "forest") {
    timeOfDay = (timeOfDay + cycleSpeed) % 1;
    const darkness = abs(sin(timeOfDay * PI)) * 200;
    fill(0, 0, 0, darkness);
    rect(0, 0, width, height);
    
    if (darkness > 100) {
      houseLights(grid);
    }
  }
}

// Shared utility functions
function gridCheck(grid, i, j, target) {
  return i >= 0 && i < grid.length && j >= 0 && j < grid[i].length && grid[i][j] === target;
}

function gridCode(grid, i, j, target) {
  let code = 0;
  if (gridCheck(grid, i-1, j, target)) code |= 1 << 0;
  if (gridCheck(grid, i+1, j, target)) code |= 1 << 1;
  if (gridCheck(grid, i, j+1, target)) code |= 1 << 2;
  if (gridCheck(grid, i, j-1, target)) code |= 1 << 3;
  return code;
}

function drawContext(grid, i, j, target, dti, dtj) {
  if (currentMode === "forest" && grid[i][j] === '~') return;
  
  const code = gridCode(grid, i, j, target);
  if (lookup[code]) {
    const [tiOffset, tjOffset] = lookup[code];
    placeTile(i, j, dti + tiOffset, dtj + tjOffset);
  } else {
    placeTile(i, j, dti, dtj);
  }
}

function handleChestClick() {
  if (currentMode !== "dungeon") return;
  
  const i = floor(mouseY / tileSize);
  const j = floor(mouseX / tileSize);
  
  clickedChest = chests.find(chest => chest.x === i && chest.y === j);
  if (clickedChest) clickedChest.opened = !clickedChest.opened;
}

// Used in base.js
function houseLights(grid) {
  noStroke();
  fill(255, 255, 150, 25);
  
  for (let i = 0; i < grid.length; i++) {
    for (let j = 0; j < grid[i].length; j++) {
      if (grid[i][j] === 'H') {
        const x = j * tileSize;
        const y = i * tileSize;
        rect(x - tileSize*1.5, y - tileSize*1.5, tileSize * 4, tileSize * 4);
      }
    }
  }
}

const lookup = [
  [0, 0], [0, -1], [0, 1], [1, 0],   // 0000-0011
  [3, 0], [3, -1], [3, 1], [3, 0],    // 0100-0111
  [2, 0], [2, -1], [2, 1], [2, 0],    // 1000-1011
  [0, 0], [0, -1], [0, 1], [0, 0]     // 1100-1111
];