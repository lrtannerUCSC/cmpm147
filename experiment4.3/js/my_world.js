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
let moleSpeed = 120; // 2 seconds
let moleSpawnRate = 20; // 20%

let holeRate = 20; // 20%

let upgrades = {
  autoWhacker: {
    level: 0,
    cost: 10, // Base cost
    costMultiplier: 1.5, // Cost increases by 50% each level
    cooldown: 2000, // 2 second cooldown
    baseCD: 2000,
  },
  moreHoles: {
    level: 0,
    cost: 50,          // Initial cost
    costMultiplier: 1.5 // Cost increase multiplier
  },
  moreMoles: {  // New upgrade
    level: 0,
    cost: 25,
    costMultiplier: 1.8
  }
};
let coins = 100;

function p3_preload() {
  bgColor = color(34, 139, 34); // Green
}

function p3_setup() {
  frameCounter = 0;
}

function p3_worldKeyChanged(key) {
  worldSeed = XXH.h32(key, 0);
  noiseSeed(worldSeed);
  randomSeed(worldSeed);
  frameCounter = 0;
  coins = 0;
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
  // Upgrade menu click check
  if (mouseX < 220) {
    if (mouseY < 100) {
      attemptBuyUpgrade(1);
      return;
    } else if (mouseY < 200) {
      attemptBuyUpgrade(2);
      return;
    } else if (mouseY < 300) {
      attemptBuyUpgrade(3);
      return;
    }
  }
  
  
  let key = [i, j];
  
  // Check if tile has a hole
  const hasHole = XXH.h32("tile:" + key, worldSeed) % holeRate == 0;
  if (!hasHole) return;
  
  // Check if mole is currently visible
  const moleVisible = (XXH.h32("mole:" + key + ":" + floor(frameCounter/moleSpeed), worldSeed) % 100) < moleSpawnRate;
  if (moleVisible) {
    // Whack the mole
    // Increment clicks to not draw mole in drawTile
    clicks[key] = (clicks[key] || 0) + 1;
    coins += 1; // Gain one coin for each mole whacked
  }
}

let lastTime = 0;
function p3_drawBefore() {
  background(bgColor);
  frameCounter++;
  if (millis() - lastTime >= upgrades.autoWhacker.cooldown) {
    lastTime = millis();
    if (upgrades.autoWhacker.level > 0) {
      autoWhackMoles();
    }
  }
}

function autoWhackMoles() {
  const visibleTiles = getVisibleTiles();
  let whacked = false; // Track if we whacked anything

  for (let {i, j} of visibleTiles) {
    const key = [i, j];
    const hasHole = XXH.h32("tile:" + key, worldSeed) % holeRate == 0;
    if (!hasHole) continue;
    
    // Initialize clicks if undefined
    if (clicks[key] === undefined) {
      clicks[key] = 0;
    }
    
    // Get current animation cycle
    const moleVisible = (XXH.h32("mole:" + key + ":" + floor(frameCounter/moleSpeed), worldSeed) % 100) < moleSpawnRate;
    const isWhacked = clicks[key] % 2 == 1;
    
    if (moleVisible && !isWhacked) {
      clicks[key] = (clicks[key] || 0) + 1;
      coins += 1;
      whacked = true;
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
  
  const hasHole = XXH.h32("tile:" + key, worldSeed) % holeRate == 0;
  
  if (hasHole) {
    push();
    fill(0);
    ellipse(0, 0, tw * 0.8, th * 0.8);

    const moleVisible = (XXH.h32("mole:" + key + ":" + floor(frameCounter/moleSpeed), worldSeed) % 100) < moleSpawnRate;
    const isWhacked = clicks[key] % 2 == 1;
    
    // Reset hole so more moles can spawn after one has been whacked.
    if (!moleVisible && isWhacked) {
      clicks[key]+=1;
    }
    
    // Only draw mole if it is time to draw and not whacked
    if (moleVisible && !isWhacked) {
      fill(255);
      const animPhase = (frameCounter % moleSpeed) / moleSpeed;
      let popHeight;

      // Mole rises out of hole
      if (animPhase < 0.25) {
        popHeight = th * 0.8 * (animPhase * 4);
      }
      // Mole sits at top of hole for a bit
      else if (animPhase < 0.75) {
        popHeight = th * 0.8; // Full height
      }
      // Mole goes back into hole
      else {
        popHeight = th * 0.8 * (1 - (animPhase-0.75)*4);
      }

      ellipse(0, -popHeight/2, tw * 0.6, popHeight);
    }
    if (moleVisible && isWhacked) {
      push();
      fill(255, 0, 0, 150);
      ellipse(0, -th/2, tw * 0.8, th * 0.8);
      pop();
    }
    pop();
  }

  // Draw tile border
  push();
  fill(0, 0);
  beginShape();
  vertex(-tw, 0);
  vertex(0, th);
  vertex(tw, 0);
  vertex(0, -th);
  endShape(CLOSE);
  pop();

  // let n = clicks[key] | 0;
  // if (n % 2 == 1) {
  //   push();
  //   fill(0, 0, 0, 32);
  //   ellipse(0, 0, 10, 5);
  //   translate(0, -10);
  //   fill(255, 255, 100, 128);
  //   ellipse(0, 0, 10, 10);
  //   pop();
  // }
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
  fill(0);
  text("tile " + [i, j], 0, 0);
}

function attemptBuyUpgrade(num) {
  let upgrade;
  if (num == 1) {
    upgrade = upgrades.autoWhacker;
  } else if (num == 2) {
    upgrade = upgrades.moreHoles;
  } else {
    upgrade = upgrades.moreMoles;
  }
  
  const cost = floor(upgrade.cost * pow(upgrade.costMultiplier, upgrade.level));
  
  if (coins >= cost) {
    coins -= cost;
    upgrade.level++;
    if (num == 1) {
      upgrade.cooldown *= 0.5;
    } else if (num == 2) {
      holeRate = max(holeRate * 0.5, 1);
    } else {
      moleSpeed = max(moleSpeed * .75, 1);
      moleSpawnRate *= 1.25;
    }
  }
}

function p3_drawAfter() {
  drawCoinCounter();
  drawUpgradeMenu();
}

function drawUpgradeMenu() {
  push();
  fill(50, 150);
  rect(10, 10, 200, 250);  // Increased height for third upgrade
  
  fill(255);
  textSize(16);
  textAlign(LEFT, TOP);
  
  // Auto-Whacker
  text("Auto-Whacker (Lv " + upgrades.autoWhacker.level + ")", 20, 20);
  const nextAutoCost = floor(upgrades.autoWhacker.cost * 
                           pow(upgrades.autoWhacker.costMultiplier, upgrades.autoWhacker.level));
  fill(coins >= nextAutoCost ? color(0, 200, 100) : color(100));
  rect(20, 45, 160, 30);
  fill(255);
  text("Buy (" + nextAutoCost + " coins)", 30, 52);
  
  // More Holes
  text("More Holes (Lv " + upgrades.moreHoles.level + ")", 20, 90);
  const nextHoleCost = floor(upgrades.moreHoles.cost * 
                           pow(upgrades.moreHoles.costMultiplier, upgrades.moreHoles.level));
  fill(coins >= nextHoleCost ? color(0, 200, 100) : color(100));
  rect(20, 115, 160, 30);
  fill(255);
  text("Buy (" + nextHoleCost + " coins)", 30, 122);
  
  // More Moles (new)
  text("More Moles (Lv " + upgrades.moreMoles.level + ")", 20, 160);
  const nextMoleCost = floor(upgrades.moreMoles.cost * 
                           pow(upgrades.moreMoles.costMultiplier, upgrades.moreMoles.level));
  fill(coins >= nextMoleCost ? color(0, 200, 100) : color(100));
  rect(20, 185, 160, 30);
  fill(255);
  text("Buy (" + nextMoleCost + " coins)", 30, 192);
  
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
