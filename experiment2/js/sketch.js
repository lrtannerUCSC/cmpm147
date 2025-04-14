// GLOBALS
let pillars = [];
const pillarCount = 5;
const maxPillarHeight = 400;
const pillarBaseY = 600;

// Background settings
let cellScale = 4;
let speed = 200;
let looping = true;
let prevTime = 0;
let z = 1000;
let rez1 = 0.005;

// Star settings
let stars = [];
const starCount = 500;

function setup() {
  let canvas = createCanvas(windowWidth*0.8, windowHeight*0.6);
  canvas.parent('canvas-container');
  colorMode(HSB, 360, 100, 100, 255);
  noStroke();
  
  generateStars();
  generatePillars();
  generateContours();
  
  if (!looping) {
    noLoop();
  }
}

function generateStars() {
  for (let i = 0; i < starCount; i++) {
    stars.push({
      x: random(width),
      y: random(height * 0.8),
      size: random(0.5, 3),
      brightness: random(70, 100),
      color: random(45, 60),
      twinkle: random(0.01, 0.05)
    });
  }
}

function generatePillars() {
  for (let i = 0; i < pillarCount; i++) {
    let pillar = {
      baseX: width / 2 + random(-200, 200),
      baseY: pillarBaseY,
      height: random(maxPillarHeight * 0.5, maxPillarHeight),
      spine: [],
      hue: random(200, 240), // Blueish nebula colors
      saturation: random(50, 80)
    };
    
    // Generate spine points (bottom to top)
    for (let y = 0; y < pillar.height; y += 5) {
      let xOff = noise(i * 10, y * 0.02) * 60 - 30;
      let spineY = pillar.baseY - y;
      pillar.spine.push(createVector(pillar.baseX + xOff, spineY));
    }
    pillars.push(pillar);
  }
}

function generateContours() {
  for (let pillar of pillars) {
    pillar.contours = [];
    for (let i = 0; i < pillar.spine.length; i++) {
      let spine = pillar.spine[i];
      let contour = [];
      // Taper from base to top with noise variation
      let radius = map(i, 0, pillar.spine.length, 
                       random(25, 40), 
                       random(5, 15));
      
      for (let angle = 0; angle < TWO_PI; angle += TWO_PI / 12) {
        let rNoise = noise(angle * 0.5, i * 0.1) * radius * 0.4;
        let r = radius + rNoise;
        contour.push(createVector(
          spine.x + cos(angle) * r,
          spine.y + sin(angle) * r
        ));
      }
      pillar.contours.push(contour);
    }
  }
}

function draw() {
  // Draw the space background first
  drawSpaceBackground();
  
  // Draw stars
  drawStars();
  
  // Then draw the pillars on top
  drawPillars();
  
  // Animation control
  let currTime = millis();
  if (currTime - prevTime > speed) {
    z += 2;
    prevTime = currTime;
  }
}

function drawSpaceBackground() {
  for (let x = 0; x * cellScale < width; x++) {
    for (let y = 0; y * cellScale < height; y++) {
      let n1 = noise(x * rez1, y * rez1, z * rez1) + 0.033;
      n1 = map(n1, 0.3, 0.7, 0, 1); 
      
      if (n1 < 0.25) {        // 25% - Deep voids
        fill(240, 50, 10);    // Near-black indigo
      } else if (n1 < 0.50) { // 25% - Dark nebula
        fill(220, 50, 15);    // Cosmic dust
      } else if (n1 < 0.70) { // 20% - Midtones
        fill(200, 55, 25);    // Faint gas clouds
      } else if (n1 < 0.85) { // 15% - Subtle glow
        fill(180, 60, 40);    // Distant nebula
      } else if (n1 < 0.93) { // 8% - Rare highlights
        fill(45, 70, 70);     // Faint stellar light
      } else if (n1 < 0.97) { // 4% - Brighter accents
        fill(330, 50, 60);    // Occasional gas pocket
      } else {                // 3% - Rarest bright spots
        fill(45, 80, 85);     // Single star highlights
      }

      rect(x * cellScale, y * cellScale, cellScale, cellScale);
    }
  }
}

function drawStars() {
  for (let star of stars) {
    // Twinkle effect
    let twinkleFactor = sin(frameCount * star.twinkle) * 0.5 + 0.5;
    let currentBrightness = star.brightness * (0.7 + twinkleFactor * 0.3);
    
    // Lens flare effect for brightest stars
    if (star.brightness > 90) {
      fill(star.color, 30, currentBrightness, 30);
      ellipse(star.x, star.y, star.size * 8);
      fill(star.color, 20, currentBrightness, 20);
      ellipse(star.x, star.y, star.size * 15);
    }
    
    // Star core
    fill(star.color, 20, currentBrightness);
    ellipse(star.x, star.y, star.size);
    fill(star.color, 10, 100);
    ellipse(star.x, star.y, star.size * 0.5);
  }
}

function drawPillars() {
  for (let pillar of pillars) {
    for (let i = 0; i < pillar.contours.length - 1; i++) {
      let curr = pillar.contours[i];
      let next = pillar.contours[i + 1];
      
      // Vary color with height (darker at base)
      let brightness = map(i, 0, pillar.contours.length, 20, 50);
      let alpha = map(i, 0, pillar.contours.length, 200, 100);
      
      fill(pillar.hue, pillar.saturation, brightness, alpha);
      
      for (let j = 0; j < curr.length; j++) {
        let a = curr[j];
        let b = curr[(j + 1) % curr.length];
        let c = next[(j + 1) % next.length];
        let d = next[j];
        
        beginShape();
        vertex(a.x, a.y);
        vertex(b.x, b.y);
        vertex(c.x, c.y);
        vertex(d.x, d.y);
        endShape(CLOSE);
      }
    }
    
    // Add glowing tips to pillars
    let tip = pillar.contours[0];
    fill(pillar.hue, pillar.saturation * 0.7, 70, 50);
    beginShape();
    for (let pt of tip) {
      vertex(pt.x, pt.y);
    }
    endShape(CLOSE);
  }
}

// CONTROLS
function keyPressed() {
  if (key == " ") {
    looping = !looping;
    if (looping) {
      loop();
    } else {
      noLoop();
    }
  }
  
  if (key == "=") speed = max(50, speed - 50);
  if (key == "-") speed += 50;
  if (key == "[") cellScale = max(1, cellScale - 1);
  if (key == "]") cellScale += 1;
  
  if (key == "r") {
    // Randomize everything
    clear();
    noiseSeed(random(1000));
    stars = [];
    generateStars();
    pillars = [];
    generatePillars();
    generateContours();
    redraw();
  }
  
  print("Speed:", speed, "Cell scale:", cellScale);
}