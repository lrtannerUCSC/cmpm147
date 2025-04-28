"use strict";

/* global XXH */
/* exported --
    p3_preload
    p3_setup
    p3_worldKeyChanged
    p3_tileWidth
    p3_tileHeight
    p3_tileClicked
    p3_drawBefore
    p3_drawTile
    p3_drawSelectedTile
    p3_drawAfter
*/

let bgColor;
let worldSeed;
let frameCounter = 0;
let clicks = {};

let asteroidHealth = 5;
let asteroids = {}; // Track asteroid states

let spaceship = {
    worldX: 0,
    worldY: 0,
    currentTile: { i: 0, j: 0 },
    targetTile: { i: 0, j: 0 },
    speed: 2,
    isMoving: false,
    miningCooldown: 0,        // Current cooldown timer
    miningInterval: 1000,      // 1 second between mines (in milliseconds)
};

let upgrades = {
  drillUpgrade: {
    level: 0,
    cost: 10, // Base cost
    costMultiplier: 1.5, // Cost increases by 50% each level
  }
};
let coins = 0;

function p3_preload() {
  bgColor = color(10, 0, 20); // Dark purpley space color
}

function p3_setup() {
    frameCounter = 0;
    // Initialize ship at center of tile (0,0)
    const pos = tileToScreen(0, 0);
    spaceship.worldX = pos.x;
    spaceship.worldY = pos.y;
}

function p3_worldKeyChanged(key) {
  worldSeed = XXH.h32(key, 0);
  noiseSeed(worldSeed);
  randomSeed(worldSeed);
  frameCounter = 0;
  coins = 0;
  asteroids = {};
  for (const upgradeName in upgrades) {
    if (upgrades.hasOwnProperty(upgradeName)) {
      upgrades[upgradeName].level = 0;
      // Reset to base cooldown if it exists
      if (upgrades[upgradeName].baseCD) {
        upgrades[upgradeName].cooldown = upgrades[upgradeName].baseCD;
      }
    }
  }
}

function p3_tileWidth() { return 32; }
function p3_tileHeight() { return 16; }

let [tw, th] = [p3_tileWidth(), p3_tileHeight()];

function p3_tileClicked(i, j) {
    if (mouseX < 220 && mouseY < 100) {
        attemptBuyUpgrade();
        return;
    }
    
    if (i !== spaceship.currentTile.i || j !== spaceship.currentTile.j) {
        spaceship.targetTile = { i, j };
        spaceship.isMoving = true;
    }
}

function p3_drawBefore() {
    background(bgColor);
    frameCounter++;
  
    if (spaceship.miningCooldown > 0) {
        spaceship.miningCooldown -= deltaTime;
    } else if (!spaceship.isMoving) {
        // Only mine when not moving and cooldown is ready
        mineCurrentTile();
        spaceship.miningCooldown = spaceship.miningInterval;
    }

    if (spaceship.isMoving) {
        // Get target position in world coordinates
        const targetPos = tileToScreen(spaceship.targetTile.i, spaceship.targetTile.j);
        
        // Calculate movement vector
        const dx = targetPos.x - spaceship.worldX;
        const dy = targetPos.y - spaceship.worldY;
        const distance = sqrt(dx*dx + dy*dy);
        
        // Move at constant speed
        if (distance > 0) {
            spaceship.worldX += (dx/distance) * min(spaceship.speed, distance);
            spaceship.worldY += (dy/distance) * min(spaceship.speed, distance);
        }
        
        // Check if arrived
        if (distance < 1) {
            spaceship.currentTile = { ...spaceship.targetTile };
            spaceship.isMoving = false;
            // mineCurrentTile();
        }
    }
}


function getVisibleTiles() {
  const tiles = [];
  const padding = -2; // Extra tiles around edges
  
  // Get isometric camera position
  const camX = window._p3CameraX || 0;
  const camY = window._p3CameraY || 0;
  
  // Convert screen bounds to isometric tile coordinates
  const screenLeft = camX - width/2;
  const screenRight = camX + width/2;
  const screenTop = camY - height/2;
  const screenBottom = camY + height/2;
  
  // Convert to tile coordinates (accounting for isometric projection)
  const minI = floor((screenLeft - th) / tw) - padding;
  const maxI = ceil((screenRight + th) / tw) + padding;
  const minJ = floor((screenTop - th) / th) - padding;
  const maxJ = ceil((screenBottom + th) / th) + padding;
  
  for (let i = minI; i <= maxI; i++) {
    for (let j = minJ; j <= maxJ; j++) {
      // Convert back to screen coordinates to check visibility
      const screenX = i * tw - camX + width/2;
      const screenY = j * th - camY + height/2;
      
      // Only include tiles actually visible on screen
      if (screenX > -tw*2 && screenX < width+tw*2 && 
          screenY > -th*2 && screenY < height+th*2) {
        tiles.push({i, j});
      }
    }
  }
  return tiles;
}

function p3_drawTile(i, j) {
  noStroke();
  let key = [i, j];
  
  const hasAsteroid = XXH.h32("tile:" + key, worldSeed) % 20 == 0;
  
  if (hasAsteroid) {
    if ((clicks[key] || 0) < asteroidHealth) {
      push();
      fill(100, 100, 100);
      ellipse(0, 0, tw * 0.8, tw * 0.8);
      
      fill(70, 70, 70);
      ellipse(-5, -5, 5, 5); // Crater 1
      ellipse(8, 3, 7, 7);   // Crater 2
      pop();
    }
  }

  
  // Draw the ship if this tile is the ship's current tile
  const pos = tileToScreen(spaceship.currentTile.i, spaceship.currentTile.j);
  const targetPos = tileToScreen(spaceship.targetTile.i, spaceship.targetTile.j);

  // Compute current world position (with in-between movement)
  const shipWorldX = spaceship.worldX;
  const shipWorldY = spaceship.worldY;
  
  // Check if ship is close enough to this tile to draw it here
  const currentTilePos = tileToScreen(i, j);
  const dx = shipWorldX - currentTilePos.x;
  const dy = shipWorldY - currentTilePos.y;
  const tileRadius = 20;

  if (abs(dx) < tileRadius && abs(dy) < tileRadius) {
    push();
    translate(shipWorldX - currentTilePos.x, shipWorldY - currentTilePos.y);

    if (spaceship.isMoving) {
        rotate(atan2(
            targetPos.y - spaceship.worldY,
            targetPos.x - spaceship.worldX
        ));
    }

    // Draw ship
    fill(255, 200, 0);
    beginShape();
    vertex(10, 0);
    vertex(-5, -7);
    vertex(-5, 7);
    endShape(CLOSE);
    pop();
  }

}

function p3_drawSelectedTile(i, j) {
  noFill();
  stroke(0, 255, 0, 128);

  beginShape();
  vertex(-tw, 0);
  vertex(0, th);
  vertex(tw, 0);
  vertex(0, -th);
  endShape(CLOSE);

  noStroke();
  fill(255);
  text("tile " + [i, j], 0, 0);
}

function attemptBuyUpgrade() {
  const upgrade = upgrades.drillUpgrade;
  const cost = floor(upgrade.cost * pow(upgrade.costMultiplier, upgrade.level));
  
  if (coins >= cost) {
    coins -= cost;
    upgrade.level++;
  }
}

function p3_drawAfter() {
    // Draw UI
    drawCoinCounter();
    drawUpgradeMenu();
}


function tileToScreen(i, j) {
  return {
    x: (j - i) * tw,
    y: (i + j) * th
  };
}


function mineCurrentTile() {
  const key = `${spaceship.currentTile.i},${spaceship.currentTile.j}`;
  
  // Check if this is an asteroid tile
  if (XXH.h32("tile:" + key, worldSeed) % 20 == 0) {
    // Initialize asteroid data if not exists
    if (!asteroids[key]) {
      asteroids[key] = {
        health: asteroidHealth,
        destroyed: false
      };
    }
    
    // Only mine if not already destroyed
    if (!asteroids[key].destroyed) {
      // Apply mining (with upgrade bonus)
      const miningPower = 1 + upgrades.drillUpgrade.level;
      clicks[key] = (clicks[key] || 0) + miningPower;
      asteroids[key].health = max(0, asteroids[key].health - miningPower);
      
      // Check if destroyed
      if (asteroids[key].health <= 0) {
        asteroids[key].destroyed = true;
        coins += 1; // Only give coin when destroyed
        console.log(`Asteroid destroyed at (${key})`);
      }
      else {
        console.log(`Mined asteroid at (${key}), remaining health: ${asteroids[key].health}`);
      }
    }
  }
}

function drawUpgradeMenu() {
  push();
  fill(50, 150);
  rect(10, 10, 200, 80);
  
  fill(255);
  textSize(16);
  textAlign(LEFT, TOP);
  text("Drill Power (Lv " + upgrades.drillUpgrade.level + ")", 20, 20);
  
  // Calculate next cost
  const nextCost = floor(upgrades.drillUpgrade.cost * 
                        pow(upgrades.drillUpgrade.costMultiplier, upgrades.drillUpgrade.level));
  
  // Buy button
  fill(coins >= nextCost ? color(0, 200, 100) : color(100));
  rect(20, 45, 160, 30);
  fill(255);
  text("Buy (" + nextCost + " coins)", 30, 52);
  
  pop();
}

function drawCoinCounter() {
    push();
  
  // Set up drawing style for the coin counter
  textSize(24);
  textAlign(RIGHT, TOP);
  fill(150, 150, 150); // Gray color for ore
  stroke(0);
  strokeWeight(2);
  
  const coinX = width - 50;
  const coinY = 20;
  rect(coinX + 5, coinY, 15, 20);
  
  // Draw coin count
  text(coins, coinX, coinY);
  
  pop();
}