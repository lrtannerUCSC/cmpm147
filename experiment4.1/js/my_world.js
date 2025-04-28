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
const WATER_THRESHOLD = 0.65; // Adjust for more/less water
const WATER_NOISE_SCALE = 0.1; // Adjust for larger/smaller water features

let bgColor;
let worldSeed;
let frameCounter = 0;
let clicks = {};

let maxPlantGrowth = 5;
let plots = {}; // Track asteroid states
let upgrades = {
  wateringCanUpgrade: {
    level: 0,
    cost: 10, // Base cost
    costMultiplier: 1.5, // Cost increases by 50% each level
  }
};

let farmer = {
    worldX: 0,
    worldY: 0,
    currentTile: { i: 0, j: 0 },
    targetTile: { i: 0, j: 0 },
    speed: 2,
    isMoving: false,
    growingCooldown: 0,        // Current cooldown timer
    growingInterval: 1000,      // 1 second between mines (in milliseconds)
    wateringCan: 0,
    maxWateringCan: upgrades.wateringCanUpgrade.level*2+10,
};


let coins = 0;

function p3_preload() {
  bgColor = color(34, 139, 34); // Green
}

function p3_setup() {
    frameCounter = 0;
    // Initialize ship at center of tile (0,0)
    const pos = tileToScreen(0, 0);
    farmer.worldX = pos.x;
    farmer.worldY = pos.y;
}

function p3_worldKeyChanged(key) {
  worldSeed = XXH.h32(key, 0);
  noiseSeed(worldSeed);
  randomSeed(worldSeed);
  frameCounter = 0;
  coins = 0;
  plots = {};
  farmer.wateringCan = 0;
  farmer.maxWateringCan = upgrades.wateringCanUpgrade.level*2+10;
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
    
    if (i !== farmer.currentTile.i || j !== farmer.currentTile.j) {
        farmer.targetTile = { i, j };
        farmer.isMoving = true;
    }
}

function p3_drawBefore() {
    background(bgColor);
    frameCounter++;
    
    // Check if on water tile and can collect water
    const currentKey = `${farmer.currentTile.i},${farmer.currentTile.j}`;
    const waterNoise = noise(farmer.currentTile.i * WATER_NOISE_SCALE, 
                           farmer.currentTile.j * WATER_NOISE_SCALE);
    const isOnWater = waterNoise > WATER_THRESHOLD;
    
    if (isOnWater && farmer.growingCooldown <= 0 && farmer.wateringCan < farmer.maxWateringCan) {
        farmer.wateringCan = min(farmer.wateringCan + 1, farmer.maxWateringCan);
        farmer.growingCooldown = farmer.growingInterval;
        console.log(`Collected water! Now have ${farmer.wateringCan}/${farmer.maxWateringCan}`);
    }
    else if (farmer.growingCooldown > 0) {
        farmer.growingCooldown -= deltaTime;
    }
    else if (!farmer.isMoving) {
        farmCurrentTile();
    }
  
    if (farmer.growingCooldown > 0) {
        farmer.growingCooldown -= deltaTime;
    } else if (!farmer.isMoving) {
        // Only mine when not moving and cooldown is ready
        farmCurrentTile();
        farmer.growingCooldown = farmer.growingInterval;
    }

    if (farmer.isMoving) {
        // Get target position in world coordinates
        const targetPos = tileToScreen(farmer.targetTile.i, farmer.targetTile.j);
        
        // Calculate movement vector
        const dx = targetPos.x - farmer.worldX;
        const dy = targetPos.y - farmer.worldY;
        const distance = sqrt(dx*dx + dy*dy);
        
        // Move at constant speed
        if (distance > 0) {
            farmer.worldX += (dx/distance) * min(farmer.speed, distance);
            farmer.worldY += (dy/distance) * min(farmer.speed, distance);
        }
        
        // Check if arrived
        if (distance < 1) {
            farmer.currentTile = { ...farmer.targetTile };
            farmer.isMoving = false;
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
  
  // Generate noise value for water (range 0-1)
  const waterNoise = noise(i * WATER_NOISE_SCALE, j * WATER_NOISE_SCALE);
  const hasWater = waterNoise > WATER_THRESHOLD;
  
  const hasPlot = XXH.h32("tile:" + key, worldSeed) % 20 == 0 && !hasWater;
  
  // Draw water first (so plots appear on top)
  if (hasWater) {
    push();
    // Create water color variation
    fill(30, 90, 150); // Deeper water is darker
    stroke(30, 90, 150);
    beginShape();
    vertex(-tw, 0);
    vertex(0, th);
    vertex(tw, 0);
    vertex(0, -th);
    endShape(CLOSE);
    pop();
  }
  if (hasPlot) {
    // Draw tile border
    push();
    fill(101, 67, 33);  // Dark, nutrient-rich soil
    stroke(101, 67, 33); 
    beginShape();
    vertex(-tw, 0);
    vertex(0, th);
    vertex(tw, 0);
    vertex(0, -th);
    endShape(CLOSE);
    pop();
    
    push();
    fill(34, 100, 0);
    ellipse(0, 0, tw * clicks[key]*.3, th * clicks[key]*.3);
    pop();
    
    if (plots[key] && plots[key].fullyGrown && millis() - plots[key].timeGrown >= plots[key].growTime) {
      push();
      fill(242, 63, 236);
      ellipse(0, 0, tw * .8, th * .8);
      pop();
      plots[key].harvestable = true;
    }
  }

  
  // Draw the ship if this tile is the ship's current tile
  const pos = tileToScreen(farmer.currentTile.i, farmer.currentTile.j);
  const targetPos = tileToScreen(farmer.targetTile.i, farmer.targetTile.j);

  // Compute current world position (with in-between movement)
  const shipWorldX = farmer.worldX;
  const shipWorldY = farmer.worldY;
  
  // Check if ship is close enough to this tile to draw it here
  const currentTilePos = tileToScreen(i, j);
  const dx = shipWorldX - currentTilePos.x;
  const dy = shipWorldY - currentTilePos.y;
  const tileRadius = 20;

  if (abs(dx) < tileRadius && abs(dy) < tileRadius) {
    push();
    translate(shipWorldX - currentTilePos.x, shipWorldY - currentTilePos.y);

    if (farmer.isMoving) {
        rotate(atan2(
            targetPos.y - farmer.worldY,
            targetPos.x - farmer.worldX
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
  const upgrade = upgrades.wateringCanUpgrade;
  const cost = floor(upgrade.cost * pow(upgrade.costMultiplier, upgrade.level));
  
  if (coins >= cost) {
    coins -= cost;
    upgrade.level++;
    if (upgrade == upgrades.wateringCanUpgrade) {
      farmer.maxWateringCan = upgrade.level*2+10;
    }
  }
}

function p3_drawAfter() {
    // Draw UI
    drawCoinCounter();
    drawUpgradeMenu();
    drawWateringCan();
}


function tileToScreen(i, j) {
  return {
    x: (j - i) * tw,
    y: (i + j) * th
  };
}


function farmCurrentTile() {
    const key = `${farmer.currentTile.i},${farmer.currentTile.j}`;
    const waterNoise = noise(farmer.currentTile.i * WATER_NOISE_SCALE, 
                           farmer.currentTile.j * WATER_NOISE_SCALE);
    const isOnWater = waterNoise > WATER_THRESHOLD;

    if (isOnWater) return; // Don't farm on water tiles

    if (XXH.h32("tile:" + key, worldSeed) % 20 == 0) {
        if (!plots[key]) {
            plots[key] = {
                health: maxPlantGrowth,
                fullyGrown: false,
                timeGrown: 0,
                growTime: 5000,
                harvestable: false
            };
        }
        
        if (!plots[key].fullyGrown && farmer.wateringCan > 0) {
            farmer.wateringCan--; // Use water from can
            const growPower = 1 + upgrades.wateringCanUpgrade.level;
            clicks[key] = (clicks[key] || 0) + growPower;
            plots[key].health = max(0, plots[key].health - growPower);
            
            if (plots[key].health <= 0) {
                plots[key].fullyGrown = true;
                coins += 1;
                plots[key].timeGrown = millis();
            }
        }
        
        if (plots[key].harvestable) {
            plots[key].health = maxPlantGrowth;
            plots[key].fullyGrown = false;
            plots[key].timeGrown = 0;
            plots[key].harvestable = false;
            clicks[key] = 0;
            coins += 5;
        }
    }
}

function drawWateringCan() {
    push();
    const canX = width - 50;
    const canY = height - 50;
    const canWidth = 40;
    const canHeight = 60;
    
    // Draw can outline
    fill(200, 200, 200);
    rect(canX, canY, canWidth, canHeight, 5);
    
    // Draw water level
    const waterHeight = map(farmer.wateringCan, 0, farmer.maxWateringCan, 0, canHeight);
    fill(30, 120, 200, 200);
    rect(canX, canY + canHeight - waterHeight, canWidth, waterHeight, 0, 0, 5, 5);
    
    // Draw can details
    fill(150);
    rect(canX + 10, canY - 10, 20, 10, 3);
    
    // Draw text
    fill(0);
    textSize(12);
    textAlign(CENTER);
    text(`${farmer.wateringCan}/${farmer.maxWateringCan}`, canX + canWidth/2, canY - 15);
    
    pop();
}

function drawUpgradeMenu() {
  push();
  fill(50, 150);
  rect(10, 10, 200, 80);
  
  fill(255);
  textSize(16);
  textAlign(LEFT, TOP);
  text("Watering Can (Lv " + upgrades.wateringCanUpgrade.level + ")", 20, 20);
  
  // Calculate next cost
  const nextCost = floor(upgrades.wateringCanUpgrade.cost * 
                        pow(upgrades.wateringCanUpgrade.costMultiplier, upgrades.wateringCanUpgrade.level));
  
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
  fill(255, 215, 0); // Gold color for coins
  stroke(0);
  strokeWeight(2);
  
  // Draw coin icon (simple circle)
  const coinX = width - 50;
  const coinY = 20;
  ellipse(coinX + 18, coinY + 12, 20, 20);
  
  // Draw coin count
  text(coins, coinX, coinY);
  
  pop();
}