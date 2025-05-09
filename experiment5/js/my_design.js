
/* exported p4_inspirations, p4_initialize, p4_render, p4_mutate */

function getInspirations() {
    return [
      {
        name: "Starry Night", 
        assetUrl: "https://cdn.glitch.global/dbeec8af-f567-4a87-8934-c0301aefa150/starry-night.jpg?v=123456789",
        credit: "https://en.wikipedia.org/wiki/File:Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg"
      },
      {
        name: "Women with the Peal Earring", 
        assetUrl: "https://cdn.glitch.global/dbeec8af-f567-4a87-8934-c0301aefa150/pearl_painting.jpg?v=123456789",
        credit: "Four-year-old Zoë Roth, 2005"
      },
      {
        name: "Statue of Liberty", 
        assetUrl: "https://cdn.glitch.global/dbeec8af-f567-4a87-8934-c0301aefa150/statue_of_liberty.jpg?v=123456789",
        credit: "https://www.istockphoto.com/photos/statue-of-liberty"
      },
    ];
  }
  
  /* Image Analysis Functions */
  
  function analyzeImage(img) {
    img.loadPixels();
    
    return {
      edgeDensity: calculateEdgeDensity(img),
      colorVariety: calculateColorVariety(img),
      saliencyMap: generateSaliencyMap(img),
      brightnessRange: calculateBrightnessRange(img)
    };
  }
  
  function calculateEdgeDensity(img) {
    let edgeCount = 0;
    const threshold = 50;
    const step = 5;
    
    for (let y = 1; y < img.height - 1; y += step) {
      for (let x = 1; x < img.width - 1; x += step) {
        const c = img.get(x, y);
        const r = img.get(x + 1, y);
        const b = img.get(x, y + 1);
        
        if (colorDiff(c, r) > threshold || colorDiff(c, b) > threshold) {
          edgeCount++;
        }
      }
    }
    
    const totalSamples = ((img.width - 2)/step) * ((img.height - 2)/step);
    return edgeCount / totalSamples;
  }
  
  function calculateColorVariety(img) {
    const colorMap = {};
    const step = 10;
    let uniqueColors = 0;
    
    for (let y = 0; y < img.height; y += step) {
      for (let x = 0; x < img.width; x += step) {
        const c = img.get(x, y);
        const qColor = [
          floor(red(c) / 16),
          floor(green(c) / 16),
          floor(blue(c) / 16)
        ].join(',');
        
        if (!colorMap[qColor]) {
          colorMap[qColor] = true;
          uniqueColors++;
        }
      }
    }
    
    return min(1, uniqueColors / 2000);
  }
  
  function generateSaliencyMap(img) {
    const map = [];
    let maxBrightness = 0;
    const smallW = img.width / 4;
    const smallH = img.height / 4;
    
    for (let y = 0; y < smallH; y++) {
      map[y] = [];
      for (let x = 0; x < smallW; x++) {
        const origX = floor(x * 4);
        const origY = floor(y * 4);
        const bright = brightness(img.get(origX, origY));
        map[y][x] = bright;
        maxBrightness = max(maxBrightness, bright);
      }
    }
    
    if (maxBrightness > 0) {
      for (let y = 0; y < smallH; y++) {
        for (let x = 0; x < smallW; x++) {
          map[y][x] /= maxBrightness;
        }
      }
    }
    
    return map;
  }
  
  function calculateBrightnessRange(img) {
    let minBright = 255;
    let maxBright = 0;
    const step = 5;
    
    for (let y = 0; y < img.height; y += step) {
      for (let x = 0; x < img.width; x += step) {
        const bright = brightness(img.get(x, y));
        minBright = min(minBright, bright);
        maxBright = max(maxBright, bright);
      }
    }
    
    return {
      min: minBright,
      max: maxBright,
      range: maxBright - minBright
    };
  }
  
  function colorDiff(c1, c2) {
    return abs(red(c1) - red(c2)) + 
           abs(green(c1) - green(c2)) + 
           abs(blue(c1) - blue(c2));
  }
  
  /* Style Selection */
  
  function selectStyles(analysis) {
    const styles = [];
    
    // Detail level
    if (analysis.edgeDensity > 0.3) styles.push('highDetail');
    else if (analysis.edgeDensity < 0.15) styles.push('lowDetail');
    else styles.push('mixedDetail');
    
    // Color treatment
    if (analysis.colorVariety < 0.3) styles.push('limitedPalette');
    else if (analysis.brightnessRange.range < 100) styles.push('highContrast');
    
    // Shape type
    if (analysis.edgeDensity < 0.45 && analysis.edgeDensity >= 0.35) styles.push('mixedShapes');
    else if (analysis.edgeDensity < 0.35) styles.push('roundShapes')
    
    // Layout
    if (analysis.saliencyMap.some(row => row.some(val => val > 0.8))) {
      styles.push('focalClustering');
    }
    
    return styles.length ? styles : ['default'];
  }
  
  /* Design Initialization */
  
  function initDesign(inspiration) {
  // Set canvas size based on container using jQuery
  let canvasContainer = $('.image-container');
  let canvasWidth = canvasContainer.width();
  let aspectRatio = inspiration.image.height / inspiration.image.width;
  let canvasHeight = canvasWidth * aspectRatio;
  resizeCanvas(canvasWidth, canvasHeight);
  
  // Add the original image to #original-container
  $('#original-container').empty();
  $('#original-container').append(`<img src="${inspiration.assetUrl}" style="width:${canvasWidth}px;">`);
  
  const analysis = analyzeImage(inspiration.image);
  console.log(`--- Analysis for ${inspiration.name} ---`);
  console.log('Detected Styles:', selectStyles(analysis));
  
  const styles = selectStyles(analysis);
  const bgColor = getAverageColor(inspiration.image);
  
  let design = {
    bg: [red(bgColor), green(bgColor), blue(bgColor)],
    rectangles: [],
    styles: styles,
    analysis: analysis
  };

  const params = getGenerationParameters(styles, analysis);
  
  for (let i = 0; i < params.shapeCount; i++) {
    const {x, y} = getPosition(design, params);
    const size = getSize(design, params);
    const shapeType = getShapeType(design);
    const col = getColor(inspiration.image, x, y, design);
    
    design.rectangles.push({
      x: x,
      y: y,
      w: size.w,
      h: size.h,
      color: [red(col), green(col), blue(col)],
      type: shapeType,
      origX: x,
      origY: y
    });
  }
  
  return design;
}
  
  function maxSaliency(saliencyMap) {
    let max = 0;
    for (let y = 0; y < saliencyMap.length; y++) {
      for (let x = 0; x < saliencyMap[y].length; x++) {
        max = Math.max(max, saliencyMap[y][x]);
      }
    }
    return max;
  }
  
  function getGenerationParameters(styles, analysis) {
    let shapeCount, minSize, maxSize;
    
    if (styles.includes('highDetail')) {
      shapeCount = 1500;
      minSize = 3;
      maxSize = 15;
    } else if (styles.includes('lowDetail')) {
      shapeCount = 100;
      minSize = 20;
      maxSize = 60;
    } else {
      shapeCount = 500;
      minSize = 5;
      maxSize = 40;
    }
    
    return { shapeCount, minSize, maxSize };
  }
  
  function getPosition(design, params) {
    if (design.styles.includes('focalClustering') && random() < 0.7) {
      const salientPoint = getWeightedRandomPoint(design.analysis.saliencyMap);
      return {
        x: map(salientPoint.x, 0, design.analysis.saliencyMap[0].length, 0, width),
        y: map(salientPoint.y, 0, design.analysis.saliencyMap.length, 0, height)
      };
    }
    return { x: random(width), y: random(height) };
  }
  
  function getSize(design, params) {
    if (design.styles.includes('mixedDetail')) {
      return random() < 0.7 ? 
        { w: random(params.minSize, params.minSize*2), h: random(params.minSize, params.minSize*2) } :
        { w: random(params.maxSize/2, params.maxSize), h: random(params.maxSize/2, params.maxSize) };
    }
    const size = random(params.minSize, params.maxSize);
    return { w: size, h: size };
  }
  
  function getShapeType(design) {
    if (design.styles.includes('mixedShapes')) {
      const r = random();
      return r < 0.4 ? 'rect' : 'circle'
    } else if (design.styles.includes('roundShapes')) {
      return 'circle';
    }
    return 'rect';
  }
  
  function getColor(img, x, y, design) {
    const imgX = floor(map(x, 0, width, 0, img.width));
    const imgY = floor(map(y, 0, height, 0, img.height));
    let col = img.get(imgX, imgY);
    
    if (design.styles.includes('limitedPalette')) {
      const q = 5;
      return color(
        floor(red(col)/q) * q,
        floor(green(col)/q) * q,
        floor(blue(col)/q) * q
      );
    }
    
    if (design.styles.includes('highContrast')) {
      const bright = brightness(col);
      const newBright = bright < 50 ? bright*0.7 : bright*1.3;
      return lerpColor(color(0), color(255), newBright/255);
    }
    
    return col;
  }
  
  function getWeightedRandomPoint(saliencyMap) {
    let total = 0;
    const weights = [];
    
    for (let y = 0; y < saliencyMap.length; y++) {
      weights[y] = [];
      for (let x = 0; x < saliencyMap[y].length; x++) {
        total += saliencyMap[y][x];
        weights[y][x] = total;
      }
    }
    
    const rand = random(total);
    for (let y = 0; y < weights.length; y++) {
      for (let x = 0; x < weights[y].length; x++) {
        if (rand <= weights[y][x]) {
          return { x: x, y: y };
        }
      }
    }
    
    return { x: 0, y: 0 };
  }
  
  /* Rendering */
  
  function renderDesign(design, inspiration) {
    background(color(design.bg[0], design.bg[1], design.bg[2]));
    noStroke();
    
    design.rectangles.forEach(r => {
      fill(color(r.color[0], r.color[1], r.color[2]));
      
      push(); // Save current drawing state
      translate(r.x + r.w/2, r.y + r.h/2); // Move to shape center
      
      switch(r.type || 'rect') { // Default to rect if type is missing
        case 'circle':
          ellipse(0, 0, r.w, r.h);
          break;
        case 'triangle':
          triangle(
            -r.w/2, r.h/2,  // Bottom left
            r.w/2, r.h/2,   // Bottom right
            0, -r.h/2       // Top center
          );
          break;
        default: // rectangle
          rectMode(CENTER);
          rect(0, 0, r.w, r.h);
      }
      
      pop(); // Restore drawing state
    });
  }
  
  /* Mutation */
  
  function mutateDesign(design, inspiration, rate) {
    design.rectangles.forEach(r => {
      // Position mutation
      const positionRange = design.styles.includes('focalClustering') ? 10 * rate : 20;
      r.x = mut(r.origX, r.origX - positionRange, r.origX + positionRange, rate);
      r.y = mut(r.origY, r.origY - positionRange, r.origY + positionRange, rate);
      
      // Size mutation
      const sizeRate = design.styles.includes('mixedDetail') ? rate * 1.5 : rate;
      r.w = mut(r.w, 3, 60, sizeRate);
      r.h = mut(r.h, 3, 60, sizeRate);
      
      // Color resampling
      if (random() < rate/10) {
        const imgX = floor(map(r.x, 0, width, 0, inspiration.image.width));
        const imgY = floor(map(r.y, 0, height, 0, inspiration.image.height));
        r.color = colorToArray(getColor(inspiration.image, r.x, r.y, design));
      }
    });
  
    // Shape addition/removal
    if (random() < rate/20) {
      if (random() < 0.5 && design.rectangles.length > 50) {
        design.rectangles.splice(floor(random(design.rectangles.length)), 1);
      } else if (design.rectangles.length < 2000) {
        const {x, y} = getPosition(design, getGenerationParameters(design.styles, design.analysis));
        const size = getSize(design, getGenerationParameters(design.styles, design.analysis));
        const shapeType = getShapeType(design);
        const col = getColor(inspiration.image, x, y, design);
        
        design.rectangles.push({
          x: x,
          y: y,
          w: size.w,
          h: size.h,
          color: colorToArray(col),
          type: shapeType,
          origX: x,
          origY: y
        });
      }
    }
  }
  
  /* Helper Functions */
  
  function getAverageColor(img) {
    const samples = [
      img.get(floor(img.width/4), floor(img.height/4)),
      img.get(floor(3*img.width/4), floor(img.height/4)),
      img.get(floor(img.width/4), floor(3*img.height/4)),
      img.get(floor(3*img.width/4), floor(3*img.height/4))
    ];
    
    let r = 0, g = 0, b = 0;
    samples.forEach(c => {
      r += red(c);
      g += green(c);
      b += blue(c);
    });
    
    return color(r/4, g/4, b/4);
  }
  
  function colorToArray(c) {
    return [red(c), green(c), blue(c)];
  }
  
  function mut(num, min, max, rate) {
    return constrain(randomGaussian(num, (rate * (max - min)) / 10), min, max);
  }