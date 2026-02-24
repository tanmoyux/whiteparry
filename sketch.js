let player, enemies = [], score = 0, highscore = 20, health = 4, gameState = "MENU", startTime;
let assets = {}, assetsLoaded = 0;
let musicOn = true;
let currentComicPage = 0;
let isNewHS = false;
let storyVisited = localStorage.getItem("storySeen") === "true";
let tutorialVisited = localStorage.getItem("tutorialSeen") === "true";

// Tweaks & FX
let freezeTimer = 0, screenShake = 0, gameZoom = 1, redFlash = 0, globalVolume = 0.5;
let multikillAnim = 0, multikillType = 0;
let isDraggingVolume = false;
let parryCooldown = 0; 
let targetZoom = 1;
let runTimer = 0;

function preload() {
  const cb = () => assetsLoaded++;
  const imgLoad = (path) => loadImage(path, cb, () => { console.warn("Fehlt: " + path); cb(); });
  const sndLoad = (path) => loadSound(path, cb);

  assets.menuBg = imgLoad('keyvisual.png');
  assets.logo = imgLoad('title.svg');
  assets.hp = [imgLoad('hp0.png'), imgLoad('hp1.png'), imgLoad('hp2.png'), imgLoad('hp3.png'), imgLoad('hp4.png')];
  assets.loseImg = imgLoad('wp_lose.png');
  assets.highscoreImg = imgLoad('wp_highscore.png');
  assets.bg = imgLoad('background-tile.png');
  assets.tutorial = imgLoad('tutorial.png');
  
  assets.comic = [];
  for(let i=0; i<6; i++) assets.comic[i] = imgLoad(`wp${i+1}.png`);

  assets.p_walk = imgLoad('walkcycle_p.png'); assets.p_walkm = imgLoad('walkcycle_pm.png');
  assets.p_parry = imgLoad('parry.png'); assets.p_parrym = imgLoad('parrym.png');
  assets.p_hit = imgLoad('damaged.png'); assets.p_hitm = imgLoad('damagedm.png');
  assets.p_parryAtk = imgLoad('parryattack.png'); assets.p_parryAtkm = imgLoad('parryattackm.png');
  
  // Neue Assets für Gameover-Interaktion
  assets.p_ko = imgLoad('ko_p.png'); assets.p_idle = imgLoad('win_p.png');
  
  assets.e_walk = imgLoad('walkcycle_e.png'); assets.e_walkm = imgLoad('walkcycle_em.png');
  assets.e_atk = imgLoad('attack.png'); assets.e_atkm = imgLoad('attackm.png');
  assets.e_ko = imgLoad('ko_e.png');
  assets.e_parried = imgLoad('parried.png'); assets.e_parriedm = imgLoad('parriedm.png');
  
  assets.eg_walk = imgLoad('walkcycle_eg.png'); assets.eg_walkm = imgLoad('walkcycle_egm.png');
  assets.eg_atk = imgLoad('attack_g.png'); assets.eg_atkm = imgLoad('attack_gm.png');
  assets.eg_ko = imgLoad('ko_eg.png');
  assets.eg_parried = imgLoad('parried_g.png'); assets.eg_parriedm = imgLoad('parried_gm.png');

  soundFormats('mp3');
  assets.s_kill = sndLoad('kill.mp3'); assets.s_parry = sndLoad('parry.mp3');
  assets.s_parry_miss = sndLoad('parry_nohit.mp3'); assets.s_slash_miss = sndLoad('slash_nohit.mp3'); 
  assets.s_hit = sndLoad('slash_hit.mp3'); assets.s_win = sndLoad('win.mp3'); 
  assets.s_lose = sndLoad('lose.mp3'); assets.s_multikill = sndLoad('multikill.mp3'); 
  assets.bgm = sndLoad('gamemusic.mp3'); assets.s_charge = sndLoad('charge.mp3');
}

function setup() {
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.elt.style.imageRendering = 'pixelated';
  noSmooth(); 
  imageMode(CENTER);
  textFont('Rubik Mono One');
  outputVolume(globalVolume);
  let savedHS = localStorage.getItem("whiteParryHighscore");
  highscore = (savedHS !== null) ? parseInt(savedHS) : 20;
  resetGame();
}

function windowResized() { resizeCanvas(windowWidth, windowHeight); }

function resetGame() {
  player = { x: 0, y: 0, frame: 0, dir: 'r', state: 'walk', stateTimer: 0, animCounter: 0, isMoving: false, invul: 0 };
  enemies = []; score = 0; health = 4; startTime = millis();
  freezeTimer = 0; screenShake = 0; gameZoom = 1; redFlash = 0; multikillAnim = 0;
  parryCooldown = 0; targetZoom = 1; runTimer = 0;
}

function draw() { 
  let isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  if (isTouch && windowWidth < 1100) { 
    background('#D00000');
    fill(0);
    textAlign(CENTER, CENTER);
    textSize(22);
    text("Mobile is not supported.\nPlease open on a PC.", width/2, height/2);
    return;
  }

  if (gameState === "PLAY") { 
    background(15, 15, 27); 
    if (parryCooldown > 0) parryCooldown--; 
    if (player.invul > 0) player.invul--;
    updateDynamicZoom();

    if (multikillAnim > 0) { 
      let offset = map(multikillAnim, 30, 0, 20, 0); 
      let drawHalf = (s) => { 
        push(); clip(() => { 
          beginShape(); 
          if (multikillType === 0) { if (s===0){vertex(0,0);vertex(width,0);vertex(0,height);}else{vertex(width,0);vertex(width,height);vertex(0,height);}} 
          else if (multikillType === 1) { if (s===0){vertex(0,0);vertex(width,0);vertex(width,height);}else{vertex(0,0);vertex(0,height);vertex(width,height);}} 
          else if (multikillType === 2) { if (s===0)rect(0,0,width,height/2);else rect(0,height/2,width,height/2);} 
          else { if (s===0)rect(0,0,width/2,height);else rect(width/2,0,width/2,height);} 
          endShape(CLOSE); 
        }); applyScreenEffects(s === 0 ? -offset : offset); playGame(); pop(); 
      }; 
      drawHalf(0); drawHalf(1); multikillAnim--; 
    } else { push(); applyScreenEffects(0); playGame(); pop(); } 
    if (redFlash > 0) { noStroke(); fill(208, 0, 0, redFlash); rect(0, 0, width, height); redFlash -= 15; } 
    drawUI(); 
  } else { 
    if (gameState === "MENU") drawMenu(); 
    else if (gameState === "TUTORIAL") drawTutorial(); 
    else if (gameState === "COMIC") drawComic(); 
    else if (gameState === "CREDITS") drawCredits(); 
    else if (gameState === "GAMEOVER") drawGameOver(); 
    else if (gameState === "FINISHER") drawFinisher();
  } 
  drawRetroFilter();
}

function updateDynamicZoom() {
  if (freezeTimer > 0) { targetZoom = 1.3; } 
  else {
    if (player.isMoving) { runTimer++; } else { runTimer = 0; }
    if (runTimer > 16) targetZoom = 0.72; else targetZoom = 1.04;
  }
  gameZoom = lerp(gameZoom, targetZoom, 0.04);
}

function handleEnemies() {
  let spawnRate = max(25, 80 - floor(score/3.2));
  if (frameCount % spawnRate === 0 && enemies.length < 15) {
    let ang = random(TWO_PI); let isElite = ((millis() - startTime) / 1000) > 8 && random() < 0.35; 
    enemies.push({ x: player.x + cos(ang)*1400, y: player.y + sin(ang)*1400, state: 'walk', frame: 0, animCounter: random(8), cooldown: 0, speed: isElite ? random(4.2, 4.8) : random(2.8, 3.5), hp: isElite ? 2 : 1, isElite: isElite, isDashing: false, windupSpeed: random() > 0.5 ? 0.35 : 0.12 });
  }
  for (let i = enemies.length - 1; i >= 0; i--) {
    let e = enemies[i]; let d = dist(player.x, player.y, e.x, e.y); if (e.cooldown > 0) e.cooldown--;
    if (e.state === 'walk') { 
        if (freezeTimer <= 0) e.animCounter += 0.2; 
        let a = atan2(player.y - e.y, player.x - e.x); 
        if (d > 127) { e.x += cos(a) * e.speed; e.y += sin(a) * e.speed; } 
        if (e.cooldown <= 0) { 
            if (d < 155) { e.state = 'attack'; e.animCounter = 0; e.isDashing = false; } 
            else if (e.isElite && d > 440 && d < 800 && random() < 0.02) { e.state = 'attack'; e.animCounter = 0; e.isDashing = true; if (assets.s_charge) assets.s_charge.play(); } 
        } 
    } 
    else if (e.state === 'attack') { 
      if (freezeTimer <= 0) { 
        if (e.animCounter < 4) e.animCounter += e.windupSpeed; 
        else if (e.isDashing && e.animCounter < 5) { let a = atan2(player.y - e.y, player.x - e.x); e.x += cos(a) * 26; e.y += sin(a) * 26; if (d < 145) e.animCounter = 5; } 
        else e.animCounter += 0.35; 
      } 
      let f = floor(e.animCounter); 
      if ((f === 5 || f === 6) && player.state === 'parry') checkParrySuccess(e); 
      else if (f === 7 && e.animCounter < 7.4) { 
          if (d < 240 && player.invul <= 0 && player.state !== 'parryattack') { playerHit(); e.animCounter = 7.5; } 
          else { if (assets.s_slash_miss) assets.s_slash_miss.play(); e.animCounter = 7.5; } 
      } 
      if (e.animCounter >= 8) { e.state = 'walk'; e.cooldown = 40; e.isDashing = false; } 
    }
    else if (e.state === 'dead') { if (freezeTimer <= 0) e.animCounter += 0.2; if (e.animCounter >= 10) enemies.splice(i, 1); }
    else if (e.state === 'parried') { if (freezeTimer <= 0) e.animCounter += 0.22; if (e.animCounter >= 6) e.state = 'walk'; }
  }
}

function checkParrySuccess(e) { 
    let hits = enemies.filter(o => o.state === 'attack' && dist(player.x, player.y, o.x, o.y) < 345); 
    player.state = 'parryattack'; player.stateTimer = 30; player.invul = 40; 
    parryCooldown = 0; 
    if (hits.length >= 2) { 
        assets.s_multikill?.play(); screenShake = 45; freezeTimer = 45; multikillAnim = 30; multikillType = floor(random(4)); 
        for (let t of enemies) { if (dist(player.x, player.y, t.x, t.y) < 650 && t.state !== 'dead') { t.hp--; if (t.hp <= 0) { t.state = 'dead'; t.animCounter = 0; score++; } else { t.state = 'parried'; t.animCounter = 0; } } } 
    } else { 
        e.hp--; assets.s_parry?.play(); 
        if (e.hp > 0) { e.state = 'parried'; e.animCounter = 0; freezeTimer = 8; } 
        else { e.state = 'dead'; e.animCounter = 0; score += e.isElite ? 2 : 1; assets.s_kill?.play(); freezeTimer = 12; } 
    } 
}

function playerHit() { if (player.invul > 0) return; health--; redFlash = 220; player.state = 'hit'; player.stateTimer = 20; player.invul = 60; assets.s_hit?.play(); screenShake = 35; }
function triggerParry() { if (player.state === 'walk' && parryCooldown <= 0 && freezeTimer <= 0) { player.state = 'parry'; player.stateTimer = 14; player.animCounter = 0; parryCooldown = 45; let hitAny = enemies.some(e => e.state === 'attack' && dist(player.x, player.y, e.x, e.y) < 345); if (!hitAny && assets.s_parry_miss) assets.s_parry_miss.play(); } }

function drawPlayer() { 
    let img = getPlayerImg(); 
    let fCount = (player.state === 'parry') ? 3 : (player.state === 'hit') ? 6 : 8; 
    if (img) { 
        let sw = img.width / fCount; 
        if (freezeTimer <= 0) {
            if (player.state === 'parryattack' && multikillAnim > 0 && floor(player.animCounter) === 3) {
                player.animCounter += 0.05; 
            } else {
                player.animCounter += 0.22;
            }
        }
        player.frame = (!player.isMoving && player.state === 'walk') ? 0 : floor(player.animCounter) % fCount; 
        push(); 
        if (player.invul > 0 && frameCount % 4 < 2) tint(255, 150); 
        image(img, width/2, height/2, 414, 414, player.frame * sw, 0, sw, img.height); 
        pop(); 
    } 
}

function handlePlayer() { let s = (player.state === 'hit') ? 3.5 : 6.5; if (player.state === 'parryattack') s = 10; let mv = false; if (['walk', 'hit', 'parryattack'].includes(player.state)) { if (keyIsDown(65) || keyIsDown(LEFT_ARROW)) { player.x -= s; player.dir = 'l'; mv = true; } if (keyIsDown(68) || keyIsDown(RIGHT_ARROW)) { player.x += s; player.dir = 'r'; mv = true; } if (keyIsDown(87) || keyIsDown(UP_ARROW)) { player.y -= s; mv = true; } if (keyIsDown(83) || keyIsDown(DOWN_ARROW)) { player.y += s; mv = true; } } if (player.stateTimer > 0) player.stateTimer--; else player.state = 'walk'; player.isMoving = mv; }

function drawEnemy(e) { 
    let relX = (e.x - player.x) + width/2, relY = (e.y - player.y) + height/2; 
    let img, fCount = 8, isR = player.x > e.x; 
    if (e.state === 'dead') { img = e.isElite ? assets.eg_ko : assets.e_ko; fCount = 10; } 
    else if (e.state === 'parried') { img = isR ? (e.isElite ? assets.eg_parried : assets.e_parried) : (e.isElite ? assets.eg_parriedm : assets.e_parriedm); fCount = 6; } 
    else if (e.state === 'attack') { img = isR ? (e.isElite ? assets.eg_atk : assets.e_atk) : (e.isElite ? assets.eg_atkm : assets.e_atkm); fCount = 8; } 
    else { img = isR ? (e.isElite ? assets.eg_walk : assets.e_walk) : (e.isElite ? assets.eg_walkm : assets.e_walkm); fCount = 8; } 
    if (img) { 
        let sw = img.width/fCount; let f = (e.state === 'dead' || e.state === 'parried') ? min(floor(e.animCounter), fCount-1) : floor(e.animCounter) % fCount; 
        push(); if (e.state === 'attack' && (f === 5 || f === 6)) tint(255, 180); 
        image(img, relX, relY, 414, 414, f * sw, 0, sw, img.height); pop(); 
    } 
}

function drawInfiniteBackground() { 
    let tw = 144, th = 216; let sx = -(player.x % tw), sy = -(player.y % th); 
    for (let x = sx-tw*4; x < width+tw*4; x += tw) { 
        for (let y = sy-th*4; y < height+th*4; y += th) { image(assets.bg, x + tw/2, y + th/2, tw, th); } 
    } 
}

function playGame() { 
    if (assets.bg) drawInfiniteBackground(); 
    if (freezeTimer > 0) freezeTimer--; 
    handlePlayer(); 
    handleEnemies(); 
    let drawList = [{y: player.y, type: 'player'}]; 
    for (let e of enemies) drawList.push({y: e.y, type: 'enemy', data: e}); 
    drawList.sort((a, b) => a.y - b.y); 
    for (let obj of drawList) { if (obj.type === 'player') drawPlayer(); else drawEnemy(obj.data); } 
    
    if (health <= 0) { 
        if (score > highscore) { 
            isNewHS = true; highscore = score; 
            localStorage.setItem("whiteParryHighscore", highscore); 
        } else { 
            isNewHS = false; 
        } 
        gameState = "FINISHER";
        freezeTimer = 50; 
        targetZoom = 1.6;
    } 
}

function drawRetroFilter() { push(); stroke(0, 25); strokeWeight(1); for (let i = 0; i < height; i += 4) { line(0, i, width, i); } noFill(); for (let i = 0; i < 6; i++) { stroke(0, map(i, 0, 6, 45, 0)); strokeWeight(i * 15); rect(0, 0, width, height); } pop(); }

function drawUI() { 
  let hpScale = min(0.95, (width / 1200) * 0.95); 
  let hpW = 75 * hpScale; 
  let hpH = 187 * hpScale; 
  let margin = 40; 
  let topOffset = 130 * hpScale; 
  let recordSize = min(18, width * 0.04);

  if (assets.hp[constrain(4-health, 0, 4)]) {
    image(assets.hp[constrain(4-health, 0, 4)], width - hpW/2 - margin, topOffset, hpW, hpH); 
  }

  fill('#D00000'); 
  textAlign(RIGHT); 
  textSize(min(32, width * 0.08)); 
  text(score, width - hpW - margin - 20, topOffset - 60); 
  
  fill('#565a75'); 
  textSize(recordSize); 
  text("RECORD: " + highscore, width - hpW - margin - 20, topOffset - 20); 

  fill('#565A75'); 
  textAlign(LEFT, TOP); 
  textSize(recordSize); 
  text("MENU [ESC]\nRESTART [R]", 30, 30); 
}

function drawMenu() { 
  background(15, 15, 27); if (assets.menuBg) { push(); tint(255); drawCoverImage(assets.menuBg); pop(); } 
  if (musicOn && assets.bgm && !assets.bgm.isPlaying()) toggleMusic(true); 
  let panelW = min(400, width * 0.85); noStroke(); fill(15, 15, 27); rect(0, 0, panelW, height); 
  if (assets.logo) image(assets.logo, panelW/2, 100, 240, 120); 
  let gap = 55; let startY = (height / 2) - 100; let leftX = 40;

  drawGenericButton("[1] START GAME", leftX, startY, LEFT, () => { resetGame(); gameState = "PLAY"; }); 

  let storyCol = '#c6b7be'; 
  if (!storyVisited) {
    let blink = map(sin(frameCount * 0.1), -1, 1, 100, 255);
    storyCol = color(255, 255, 255, blink);
  }
  drawGenericButton("[2] READ STORY", leftX, startY + gap, LEFT, () => { 
    gameState = "COMIC"; currentComicPage = 0; 
    storyVisited = true; localStorage.setItem("storySeen", "true"); 
  }, storyCol); 

  let tutCol = '#c6b7be';
  if (!tutorialVisited) {
    let blink = map(sin(frameCount * 0.1), -1, 1, 100, 255);
    tutCol = color(255, 255, 255, blink);
  }
  drawGenericButton("[3] TUTORIAL", leftX, startY + gap*2, LEFT, () => { 
    gameState = "TUTORIAL"; 
    tutorialVisited = true; localStorage.setItem("tutorialSeen", "true");
  }, tutCol); 

  drawGenericButton("[4] CREDITS", leftX, startY + gap*3, LEFT, () => gameState = "CREDITS"); 
  drawGenericButton(musicOn ? "[M] MUSIC ON" : "[M] MUSIC OFF", leftX, startY + gap*4, LEFT, () => { musicOn = !musicOn; toggleMusic(musicOn); }); 
  drawVolumeControl(leftX, startY + gap * 5.2, 120);
}

function drawGameOver() { 
  background('#fafbf6'); 
  let img = isNewHS ? assets.highscoreImg : assets.loseImg; 
  drawResponsiveImage(img, width * 0.95, height * 0.75, -50); 
  
  let rowY = height - 50;
  let recordSize = min(18, width * 0.04);
  
  fill('#0f0f1b'); 
  textAlign(LEFT, CENTER);
  if (isNewHS) {
    textSize(24); 
    text("NEW KILL RECORD: " + score, 40, rowY);
  } else {
    textSize(20); 
    text("SCORE: " + score, 40, rowY);
    fill('#565A75');
    let offset = textWidth("SCORE: " + score) + 40;
    text("RECORD: " + highscore, max(offset, 250), rowY);
  }
  
  drawGenericButton("RESTART [R]", width - 260, rowY, RIGHT, () => { resetGame(); gameState = "PLAY"; }); 
  drawGenericButton("MENU [ESC]", width - 40, rowY, RIGHT, () => { gameState = "MENU"; }); 
}

function drawFinisher() {
  background(15, 15, 27);
  if (assets.bg) drawInfiniteBackground();
  freezeTimer--;
  screenShake = 6; 
  gameZoom = lerp(gameZoom, targetZoom, 0.1);

  push();
  applyScreenEffects(0);
  for (let e of enemies) {
    let oldFrame = e.animCounter;
    e.animCounter = 0; // Fixiere auf erstem Frame der aktuellen Animation
    drawEnemy(e);
    e.animCounter = oldFrame;
  }
  let finalImg = isNewHS ? assets.p_idle : assets.p_ko;
  if (finalImg) image(finalImg, width/2, height/2, 414, 414);
  pop();

  if (freezeTimer <= 0) {
    if (isNewHS) assets.s_win?.play(); else assets.s_lose?.play();
    gameState = "GAMEOVER";
  }
}

function getPlayerImg() { if (player.state === 'parry') return player.dir === 'r' ? assets.p_parry : assets.p_parrym; if (player.state === 'parryattack') return player.dir === 'r' ? assets.p_parryAtk : assets.p_parryAtkm; if (player.state === 'hit') return player.dir === 'r' ? assets.p_hit : assets.p_hitm; return player.dir === 'r' ? assets.p_walk : assets.p_walkm; }

function drawComic() { 
  background('#fafbf6'); 
  if (assets.comic[currentComicPage]) {
    drawResponsiveImage(assets.comic[currentComicPage], width * 0.95, height * 0.85, -40);
  }
  let btnY = height - 50; 
  drawGenericButton("< PREV", 60, btnY, LEFT, () => { if(currentComicPage > 0) currentComicPage--; }); 
  drawGenericButton("NEXT >", 220, btnY, LEFT, () => { if(currentComicPage < 5) currentComicPage++; }); 
  drawGenericButton("MENU [ESC]", width - 60, btnY, RIGHT, () => gameState = "MENU"); 
}

function drawCredits() { 
  background('#fafbf6'); 
  fill('#0f0f1b'); 
  textAlign(CENTER, CENTER); 
  textSize(26); 
  text("CREDITS", width/2, 60); 
  textSize(min(16, width * 0.035)); 
  let creditText = "A game by Tanmoy Roy\n\nIdea by Tanmoy Roy & Fatih Urfa\nDesign by Tanmoy Roy\nCoding by Google Gemini\nSound Effects from Pixabay & Sample Focus\n\nMusic\nSynthwave.wav by Wax_vibe\nhttps://freesound.org/s/550337/\nLicense: CC 0\n\nStarted in 2022, finished in 2026.\n©2026 Tanmoy Roy. All Rights Reserved."; 
  textLeading(25);
  text(creditText, width * 0.1, height * 0.15, width * 0.8, height * 0.7); 
  drawGenericButton("MENU [ESC]", width/2, height - 60, CENTER, () => gameState = "MENU"); 
}

function drawCoverImage(img) { if (!img) return; let r = img.width/img.height, sr = width/height, w, h; if (r > sr) { h = height; w = height * r; } else { w = width; h = width / r; } image(img, width/2, height/2, w, h); }
function drawResponsiveImage(img, tw, th, yO = 0) { if (!img || img.width <= 1) return; let r = img.width/img.height, tr = tw/th, w, h; if (r > tr) { w = tw; h = tw/r; } else { h = th; w = th*r; } image(img, width/2, height/2 + yO, w, h); }
function drawGenericButton(txt, x, y, align, callback, customCol) { 
  textAlign(align, CENTER); textSize(20); let tw = textWidth(txt); 
  let isHover = (align === CENTER) ? (mouseX > x - tw/2 && mouseX < x + tw/2 && mouseY > y - 20 && mouseY < y + 20) : (align === LEFT) ? (mouseX > x && mouseX < x + tw && mouseY > y - 20 && mouseY < y + 20) : (mouseX > x - tw && mouseX < x && mouseY > y - 20 && mouseY < y + 20); 
  let baseCol = customCol ? customCol : '#c6b7be';
  fill(isHover ? '#D00000' : baseCol); 
  text(txt, x, y); 
  if (isHover && mouseIsPressed) { mouseIsPressed = false; callback(); } 
}
function drawTutorial() { background('#fafbf6'); if (assets.tutorial) drawResponsiveImage(assets.tutorial, width * 0.9, height * 0.8, -30); drawGenericButton("MENU [ESC]", width/2, height - 50, CENTER, () => gameState = "MENU"); }
function toggleMusic(p) { if (assets.bgm) { if (p && !assets.bgm.isPlaying()) assets.bgm.loop(); else if (!p) assets.bgm.stop(); } }
function changeVolume(amt) { globalVolume = constrain(globalVolume + amt, 0, 1); outputVolume(globalVolume); }
function drawVolumeControl(x, y, w) { textAlign(LEFT, CENTER); textSize(16); fill('#c6b7be'); text("VOL", x, y); drawGenericButton("-", x + 60, y, CENTER, () => changeVolume(-0.1)); let sliderX = x + 80; let knobX = map(globalVolume, 0, 1, sliderX, sliderX + w); if (mouseIsPressed && dist(mouseX, mouseY, knobX, y) < 25) isDraggingVolume = true; if (!mouseIsPressed) isDraggingVolume = false; if (isDraggingVolume) { globalVolume = constrain(map(mouseX, sliderX, sliderX + w, 0, 1), 0, 1); outputVolume(globalVolume); } stroke('#565a75'); strokeWeight(4); line(sliderX, y, sliderX + w, y); noStroke(); fill('#D00000'); ellipse(knobX, y, 18, 18); drawGenericButton("+", x + 100 + w, y, CENTER, () => changeVolume(0.1)); }

function keyPressed() { 
  if (key === '+' || key === '=') changeVolume(0.1); 
  if (key === '-' || key === '_') changeVolume(-0.1); 
  if (key === 'm' || key === 'M') { musicOn = !musicOn; toggleMusic(musicOn); }
  if (keyCode === ESCAPE) { gameState = "MENU"; } 
  if ((key === 'r' || key === 'R')) { resetGame(); gameState = "PLAY"; } 
  if (gameState === "COMIC") {
    if (keyCode === RIGHT_ARROW) { if(currentComicPage < 5) currentComicPage++; }
    if (keyCode === LEFT_ARROW) { if(currentComicPage > 0) currentComicPage--; }
  }
  if (gameState === "PLAY" && (key === ' ' || keyCode === 32)) triggerParry(); 
  if (gameState === "MENU") { 
    if (key === '1') { resetGame(); gameState = "PLAY"; } 
    if (key === '2') { gameState = "COMIC"; currentComicPage = 0; } 
    if (key === '3') gameState = "TUTORIAL"; 
    if (key === '4') gameState = "CREDITS"; 
  } 
}
function applyScreenEffects(off) { 
  if (screenShake > 0) { translate(random(-screenShake, screenShake), random(-screenShake, screenShake)); screenShake *= 0.85; } 
  translate(width/2 + off, height/2 + off); scale(gameZoom); translate(-width/2, -height/2); 
}
function mousePressed() { if (gameState === "PLAY" && mouseButton === LEFT) triggerParry(); }
