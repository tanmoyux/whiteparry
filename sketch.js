let player, enemies = [], score = 0, highscore = 30, health = 4, gameState = "MENU", startTime;
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

// Listen für bleibende Effekte
let bloodStains = [];
let floatingTexts = [];

// --- NEU: ASPECT RATIO LIMITER FÜR ULTRA-WIDE ---
function getClampedCanvasSize() {
  let w = windowWidth;
  let h = windowHeight;
  let maxRatio = 21 / 9; // Ultra-Wide Limit
  if (w / h > maxRatio) {
    w = h * maxRatio;
  }
  return { w, h };
}

// --- OPTIMIERUNG: AUDIO SAFETY & POOLING ---
function safeStop(snd) {
    if (snd && snd.isPlaying()) {
        snd.stop();
    }
}

function safeLoop(snd) {
    if (!musicOn) return;
    if (snd && !snd.isPlaying()) {
        snd.loop();
    }
}

function toggleMusic(p) {
  if (assets.bgm) {
    if (getAudioContext().state !== 'running') {
        getAudioContext().resume();
    }
    if (p && musicOn) {
      if (!assets.bgm.isPlaying()) {
        assets.bgm.stop(); 
        assets.bgm.setVolume(1.0);
        assets.bgm.loop();
      }
    } else {
      assets.bgm.stop();
    }
  }
}

function injectFonts() {
  let link = document.createElement('link');
  link.href = 'https://fonts.googleapis.com/css2?family=Rubik+Mono+One&display=swap';
  link.rel = 'stylesheet';
  document.head.appendChild(link);
}

function preload() {
  injectFonts();
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
  assets.p_dodge = imgLoad('dodge.png'); assets.p_dodgem = imgLoad('dodgem.png');
  assets.p_ko = imgLoad('ko_p.png'); assets.p_win = imgLoad('win_p.png'); 
  assets.p_idle = imgLoad('idle_p.png'); assets.p_idlem = imgLoad('idle_pm.png');

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
  assets.s_dash = sndLoad('dash.mp3'); assets.s_steps = sndLoad('steps.mp3'); 
  assets.s_e_steps = sndLoad('steps.mp3'); assets.s_attack_vocal = sndLoad('attack.mp3');
}

function setup() {
  let size = getClampedCanvasSize();
  let canvas = createCanvas(size.w, size.h);
  
  // OPTIMIERUNG FÜR SAFARI & PERFORMANCE
  pixelDensity(1); 
  
  canvas.elt.style.imageRendering = 'pixelated';
  canvas.elt.style.position = 'absolute';
  canvas.elt.style.left = '50%';
  canvas.elt.style.top = '50%';
  canvas.elt.style.transform = 'translate(-50%, -50%)';
  document.body.style.backgroundColor = '#0f0f1b';
  document.body.style.margin = '0';
  document.body.style.overflow = 'hidden';

  noSmooth(); 
  imageMode(CENTER);
  textFont('Rubik Mono One');
  outputVolume(globalVolume);
  
  if(assets.s_steps) assets.s_steps.setVolume(0.3);
  if(assets.s_e_steps) assets.s_e_steps.setVolume(0.2);
  
  let savedHS = localStorage.getItem("whiteParryHighscore");
  highscore = (savedHS !== null) ? parseInt(savedHS) : 50; 
  resetGame();
  changeVolume(0);
}

function windowResized() { 
  let size = getClampedCanvasSize();
  resizeCanvas(size.w, size.h); 
}

function stopAllGameSounds() {
  safeStop(assets.s_steps);
  safeStop(assets.s_e_steps);
  safeStop(assets.s_dash);
  safeStop(assets.s_charge);
}

function resetGame() {
  stopAllGameSounds();
  player = { x: 0, y: 0, frame: 0, dir: 'r', state: 'walk', stateTimer: 0, animCounter: 0, isMoving: false, invul: 0, moveDir: createVector(0,0) };
  enemies = []; score = 0; health = 4; startTime = millis();
  freezeTimer = 0; screenShake = 0; gameZoom = 1; redFlash = 0; multikillAnim = 0;
  parryCooldown = 0; targetZoom = 1; runTimer = 0;
  bloodStains = []; floatingTexts = [];
}

function draw() { 
  if (getAudioContext().state !== 'running') {
    getAudioContext().resume();
  }

  let isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  if (isTouch && windowWidth < 1100) { 
    background('#D00000'); fill(0); textAlign(CENTER, CENTER); 
    textSize(constrain(windowWidth * 0.05, 16, 22));
    text("Mobile is not supported.\nPlease open on a PC.", width/2, height/2);
    return;
  }
  if (gameState === "PLAY") { 
    background(15, 15, 27); 
    if (parryCooldown > 0) parryCooldown--; 
    if (player.invul > 0) player.invul--;
    updateDynamicZoom();
    
    if (multikillAnim > 0) { 
      let offset = map(multikillAnim, 30, 0, 40, 0); 
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
  if (freezeTimer > 0) { targetZoom = 1.35; } 
  else {
    if (player.isMoving) { runTimer++; } else { runTimer = 0; }
    if (runTimer > 16) targetZoom = 0.72; else targetZoom = 1.04;
  }
  gameZoom = lerp(gameZoom, targetZoom, 0.04);
}

function handleEnemies() {
  let spawnRate = max(25, 80 - floor(score/3.2));
  if (frameCount % spawnRate === 0 && enemies.length < 15) {
    spawnEnemy();
  }

  let anyEnemyMovingNearby = false;
  let pX = player.x, pY = player.y;

  for (let i = enemies.length - 1; i >= 0; i--) {
    let e = enemies[i]; 
    let dx = pX - e.x;
    let dy = pY - e.y;
    let dSq = dx*dx + dy*dy;
    
    if (e.cooldown > 0) e.cooldown--;
    
    if (dSq > 4840000 && e.state !== 'dead') {
        let savedElite = e.isElite;
        enemies.splice(i, 1);
        spawnEnemy(savedElite);
        continue;
    }

    if (e.state === 'walk') { 
        if (freezeTimer <= 0) e.animCounter += 0.2;
        if (dSq < 640000) anyEnemyMovingNearby = true;
        
        let a = atan2(dy, dx); 
        let nextX = e.x + cos(a) * e.speed;
        let nextY = e.y + sin(a) * e.speed;

        for (let other of enemies) {
          if (other !== e && other.state !== 'dead') {
            let odx = nextX - other.x;
            let ody = nextY - other.y;
            let odSq = odx*odx + ody*ody;
            if (odSq < 7225) {
              let pushA = atan2(ody, odx);
              nextX += cos(pushA) * 2;
              nextY += sin(pushA) * 2;
            }
          }
        }
        
        if (dSq > 16129) { e.x = nextX; e.y = nextY; }
        if (e.cooldown <= 0) { 
            if (dSq < 36100) {
                e.state = 'attack'; e.animCounter = 0; e.isDashing = false; 
                if(assets.s_attack_vocal && dSq < 810000) assets.s_attack_vocal.play();
            } 
            else if (e.isElite && dSq > 193600 && dSq < 640000 && random() < 0.02) { 
                e.state = 'attack'; e.animCounter = 0; e.isDashing = true; 
                if (assets.s_charge) assets.s_charge.play(); 
            } 
        } 
    } 
    else if (e.state === 'attack') { 
      if (freezeTimer <= 0) { 
        let oldAnim = e.animCounter;
        if (e.animCounter < 4) {
            e.animCounter += e.windupSpeed; 
            if (e.isDashing && oldAnim < 4 && e.animCounter >= 4) {
                if(assets.s_dash) assets.s_dash.play();
            }
        }
        else if (e.isDashing && e.animCounter < 5) { 
            let a = atan2(dy, dx); 
            e.x += cos(a) * 26; e.y += sin(a) * 26; 
            if (dSq < 32400) e.animCounter = 5;
        } 
        else e.animCounter += 0.35; 
      } 
      let f = floor(e.animCounter); 
      if ((f === 5 || f === 6) && player.state === 'parry' && dSq < 57600) checkParrySuccess(e);
      else if (f === 7 && e.animCounter < 7.4) { 
          if (dSq < 78400 && player.invul <= 0 && player.state !== 'parryattack') { playerHit(); e.animCounter = 7.5; }
          else { if (assets.s_slash_miss) assets.s_slash_miss.play(); e.animCounter = 7.5; } 
      } 
      if (e.animCounter >= 8) { e.state = 'walk'; e.cooldown = 40; e.isDashing = false; } 
    }
    else if (e.state === 'dead') { 
      if (freezeTimer <= 0) e.animCounter += 0.2; 
      if (e.animCounter >= 10) {
        bloodStains.push({ x: e.x, y: e.y, img: e.isElite ? assets.eg_ko : assets.e_ko, f: random() > 0.5 ? 8 : 9, dir: pX > e.x ? 1 : -1 });
        if (bloodStains.length > 100) bloodStains.shift(); 
        enemies.splice(i, 1); 
      }
    }
    else if (e.state === 'parried') { 
      if (freezeTimer <= 0) e.animCounter += 0.22; 
      if (e.animCounter >= 6) { e.state = 'walk'; e.animCounter = 0; }
    }
  }

  if (anyEnemyMovingNearby && freezeTimer <= 0 && gameState === "PLAY") {
      if (assets.s_e_steps && !assets.s_e_steps.isPlaying()) assets.s_e_steps.loop();
  } else {
      if (assets.s_e_steps && assets.s_e_steps.isPlaying()) assets.s_e_steps.stop();
  }
}

function spawnEnemy(forcedElite = null) {
    let ang;
    if (player.isMoving && player.moveDir.mag() > 0.1) {
        let baseAng = player.moveDir.heading();
        ang = baseAng + random(-HALF_PI, HALF_PI);
    } else {
        ang = random(TWO_PI);
    }
    let isElite = forcedElite !== null ? forcedElite : (((millis() - startTime) / 1000) > 8 && random() < 0.35); 
    enemies.push({ 
        x: player.x + cos(ang)*1400, 
        y: player.y + sin(ang)*1400, 
        state: 'walk', 
        frame: 0, 
        animCounter: random(8), 
        cooldown: 0, 
        speed: isElite ? random(4.2, 4.8) : random(2.8, 3.5), 
        hp: isElite ? 2 : 1, 
        isElite: isElite, 
        isDashing: false, 
        windupSpeed: random() > 0.5 ? 0.35 : 0.12 
    });
}

function checkParrySuccess(e) { 
    let hits = enemies.filter(o => o.state === 'attack' && (pow(player.x - o.x, 2) + pow(player.y - o.y, 2)) < 57600); 
    player.state = 'parryattack'; 
    player.stateTimer = 45; 
    player.animCounter = 0; 
    player.invul = 60; 
    parryCooldown = 0; 
    
    if (hits.length >= 2) { 
        if (assets.s_multikill) assets.s_multikill.play(); 
        screenShake = 100; 
        freezeTimer = 85;  
        multikillAnim = 45; 
        multikillType = floor(random(4)); 
        
        let totalGain = 0;
        let killedAnyone = false; 

        for (let t of enemies) { 
            let tdx = player.x - t.x;
            let tdy = player.y - t.y;
            if ((tdx*tdx + tdy*tdy) < 562500 && t.state !== 'dead') {
                let pVal = t.isElite ? 2 : 1;
                t.hp--; 
                if (t.hp <= 0) { 
                    t.state = 'dead'; t.animCounter = 0; score += pVal; totalGain += pVal;
                    killedAnyone = true; 
                    floatingTexts.push({ x: t.x, y: t.y - 100, txt: "+" + pVal, life: 70, size: 30, speed: 2 });
                } else { t.state = 'parried'; t.animCounter = 0; } 
            } 
        } 
        if (killedAnyone && assets.s_kill) assets.s_kill.play();
        floatingTexts.push({ x: player.x, y: player.y - 160, txt: "+" + totalGain, life: 120, size: 60, speed: 1.2 });
    } else { 
        e.hp--; 
        if (assets.s_parry) assets.s_parry.play(); 
        if (e.hp > 0) { e.state = 'parried'; e.animCounter = 0; freezeTimer = 18; } 
        else { 
            let pVal = e.isElite ? 2 : 1;
            e.state = 'dead'; e.animCounter = 0; score += pVal; 
            if (assets.s_kill) assets.s_kill.play(); 
            freezeTimer = 22; 
            screenShake = 25;
            floatingTexts.push({ x: e.x, y: e.y - 120, txt: "+" + pVal, life: 80, size: 34, speed: 1.8 });
        }
    } 
}

function playerHit() { if (player.invul > 0) return; health--; redFlash = 220; player.state = 'hit'; player.stateTimer = 28; player.animCounter = 0; player.invul = 60; if (assets.s_hit) assets.s_hit.play(); screenShake = 35; }

function triggerParry() { 
  if ((player.state === 'walk' || player.state === 'parryattack') && parryCooldown <= 0 && freezeTimer <= 0) { 
    player.state = 'parry'; 
    player.stateTimer = 14; 
    player.animCounter = 0; 
    parryCooldown = 45; 
    let hitAny = enemies.some(e => e.state === 'attack' && dist(player.x, player.y, e.x, e.y) < 240); 
    if (!hitAny && assets.s_parry_miss) assets.s_parry_miss.play(); 
  } 
}

function drawBlood() {
  for (let b of bloodStains) {
    let relX = (b.x - player.x) + width/2, relY = (b.y - player.y) + height/2;
    if (relX > -300 && relX < width+300) {
      let sw = b.img.width / 10;
      push(); translate(relX, relY); if (b.dir === -1) scale(-1, 1);
      image(b.img, 0, 0, 414, 414, b.f * sw, 0, sw, b.img.height); pop();
    }
  }
}

function handleFloatingTexts() {
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    let ft = floatingTexts[i];
    let relX = (ft.x - player.x) + width/2, relY = (ft.y - player.y) + height/2;
    ft.y -= ft.speed; ft.life--;
    push(); textAlign(CENTER); textSize(ft.size); 
    stroke(0, ft.life * 5); strokeWeight(5); fill(208, 0, 0, ft.life * 5);
    text(ft.txt, relX, relY); pop();
    if (ft.life <= 0) floatingTexts.splice(i, 1);
  }
}

function drawPlayer() { 
    let img = getPlayerImg(); 
    if (!img || img.width <= 0) return; 
    let isDodge = (player.state === 'parryattack' && player.isMoving);
    let fCount = (player.state === 'parry') ? 3 : 
                 (player.state === 'hit') ? 6 : 
                 (player.state === 'parryattack' && !player.isMoving) ? 3 : 
                 isDodge ? 3 : 
                 (player.state === 'walk' && !player.isMoving) ? 1 : 8; 
    
    let sw = img.width / fCount; 
    if (freezeTimer <= 0) {
        player.animCounter += isDodge ? 0.25 : 0.22;
    } else {
        if (player.state === 'parryattack' && !player.isMoving) {
            if (multikillAnim > 0) {
                player.animCounter = map(freezeTimer, 85, 0, 0, 2.9);
            } else {
                player.animCounter = map(freezeTimer, 22, 0, 0, 1.5);
            }
        }
    }
    
    if (player.state === 'hit' || player.state === 'parryattack') {
        player.frame = min(floor(player.animCounter), fCount - 1);
    } else {
        player.frame = (!player.isMoving && player.state === 'walk') ? 0 : floor(player.animCounter) % fCount; 
    }

    push(); 
    if (player.invul > 0 && frameCount % 4 < 2) tint(255, 150); 
    image(img, width/2, height/2, 414, 414, player.frame * sw, 0, sw, img.height); 
    pop(); 
}

function handlePlayer() { 
    let s = (player.state === 'hit') ? 3.5 : 6.5; 
    let wasNotMoving = !player.isMoving;
    if (player.state === 'parryattack') s = 10; 
    let mv = false; 
    let moveX = 0, moveY = 0;

    if (keyIsDown(65) || keyIsDown(LEFT_ARROW)) { moveX = -1; player.dir = 'l'; mv = true; } 
    if (keyIsDown(68) || keyIsDown(RIGHT_ARROW)) { moveX = 1; player.dir = 'r'; mv = true; } 
    if (keyIsDown(87) || keyIsDown(UP_ARROW)) { moveY = -1; mv = true; } 
    if (keyIsDown(83) || keyIsDown(DOWN_ARROW)) { moveY = 1; mv = true; } 

    player.moveDir.set(moveX, moveY);
    player.x += moveX * s;
    player.y += moveY * s;

    if (player.state === 'parryattack' && wasNotMoving && mv) {
        player.animCounter = 0; 
    }
    if (player.stateTimer > 0) player.stateTimer--; 
    else if (player.state !== 'walk' && freezeTimer <= 0) player.state = 'walk';
    player.isMoving = mv; 
    
    if (mv && player.state === 'walk' && freezeTimer <= 0 && gameState === "PLAY") { 
        if (assets.s_steps && !assets.s_steps.isPlaying()) assets.s_steps.loop(); 
    } else { 
        if (assets.s_steps && assets.s_steps.isPlaying()) assets.s_steps.stop(); 
    }
}

function drawEnemy(e) { 
    let relX = (e.x - player.x) + width/2, relY = (e.y - player.y) + height/2; 
    let img, fCount = 8, isR = player.x > e.x; 
    if (e.state === 'dead') { img = e.isElite ? assets.eg_ko : assets.e_ko; fCount = 10; } 
    else if (e.state === 'parried') { img = isR ? (e.isElite ? assets.eg_parried : assets.e_parried) : (e.isElite ? assets.eg_parriedm : assets.e_parriedm); fCount = 6; } 
    else if (e.state === 'attack') { img = isR ? (e.isElite ? assets.eg_atk : assets.e_atk) : (e.isElite ? assets.eg_atkm : assets.e_atkm); fCount = 8; } 
    else { img = isR ? (e.isElite ? assets.eg_walk : assets.e_walk) : (e.isElite ? assets.eg_walkm : assets.e_walkm); fCount = 8; } 
    if (img && img.width > 0) { 
        let sw = img.width/fCount; let f = (e.state === 'dead' || e.state === 'parried') ? min(floor(e.animCounter), fCount-1) : floor(e.animCounter) % fCount; 
        push(); if (e.state === 'attack' && (f === 5 || f === 6)) tint(255, 180); 
        image(img, relX, relY, 414, 414, f * sw, 0, sw, img.height); pop(); 
    } 
}

function drawInfiniteBackground() { 
    let tw = 144, th = 216; let sx = -(player.x % tw), sy = -(player.y % th); 
    for (let x = sx-tw*4; x < width+tw*4; x += tw) { for (let y = sy-th*4; y < height+th*4; y += th) { if(assets.bg) image(assets.bg, x + tw/2, y + th/2, tw, th); } }
}

function playGame() { 
    if (assets.bg) drawInfiniteBackground(); if (freezeTimer > 0) freezeTimer--; 
    drawBlood();
    handlePlayer(); handleEnemies(); 
    let drawList = [{y: player.y, type: 'player'}]; for (let e of enemies) if(e) drawList.push({y: e.y, type: 'enemy', data: e}); 
    drawList.sort((a, b) => a.y - b.y); for (let obj of drawList) { if (obj.type === 'player') drawPlayer(); else if(obj.data) drawEnemy(obj.data); } 
    handleFloatingTexts();
    if (health <= 0) { 
        stopAllGameSounds(); if (score > highscore) { isNewHS = true; highscore = score; localStorage.setItem("whiteParryHighscore", highscore); } else { isNewHS = false; } 
        gameState = "FINISHER"; freezeTimer = 50; targetZoom = 1.6;
    } 
}

function drawRetroFilter() { push(); stroke(0, 25); strokeWeight(1); for (let i = 0; i < height; i += 4) { line(0, i, width, i); } noFill(); for (let i = 0; i < 6; i++) { stroke(0, map(i, 0, 6, 45, 0)); strokeWeight(i * 15); rect(0, 0, width, height); } pop(); }

function drawUI() { 
  let hpScale = min(0.95, (width / 1200) * 0.95); let hpW = 75 * hpScale; let hpH = 187 * hpScale; let margin = 40; let topOffset = 130 * hpScale; let recordSize = min(18, width * 0.04);
  if (assets.hp && assets.hp[constrain(4-health, 0, 4)]) image(assets.hp[constrain(4-health, 0, 4)], width - hpW/2 - margin, topOffset, hpW, hpH);
  fill('#D00000'); textAlign(RIGHT); textSize(min(32, width * 0.08)); text(score, width - hpW - margin - 20, topOffset - 60); 
  fill('#565a75'); textSize(recordSize); text("RECORD: " + highscore, width - hpW - margin - 20, topOffset - 20); 
  fill('#565A75'); textAlign(LEFT, TOP); textSize(recordSize); text("MENU [ESC]\nRESTART [R]", 30, 30); 
}

function drawMenu() { 
  background(15, 15, 27); 
  if (assets.menuBg) { push(); tint(255); drawCoverImage(assets.menuBg); pop(); } 
  let panelW = min(400, width * 0.85); 
  noStroke(); fill(15, 15, 27); rect(0, 0, panelW, height); 
  let gap = 55, startY = (height / 2) - 100, leftX = 40;
  if (assets.logo && assets.logo.width > 0) {
    let logoW = 280; let ratio = assets.logo.height / assets.logo.width; let logoH = logoW * ratio;
    push(); imageMode(CORNER); image(assets.logo, leftX, 60, logoW, logoH); pop();
  }
  drawGenericButton("[1] START GAME", leftX, startY, LEFT, () => { resetGame(); gameState = "PLAY"; toggleMusic(true); }); 
  let storyCol = storyVisited ? '#c6b7be' : color(255, 255, 255, map(sin(frameCount * 0.1), -1, 1, 100, 255));
  drawGenericButton("[2] READ STORY", leftX, startY + gap, LEFT, () => { gameState = "COMIC"; currentComicPage = 0; storyVisited = true; localStorage.setItem("storySeen", "true"); }, storyCol); 
  let tutCol = tutorialVisited ? '#c6b7be' : color(255, 255, 255, map(sin(frameCount * 0.1), -1, 1, 100, 255));
  drawGenericButton("[3] TUTORIAL", leftX, startY + gap*2, LEFT, () => { gameState = "TUTORIAL"; tutorialVisited = true; localStorage.setItem("tutorialSeen", "true"); }, tutCol); 
  drawGenericButton("[4] CREDITS", leftX, startY + gap*3, LEFT, () => gameState = "CREDITS"); 
  drawGenericButton(musicOn ? "[M] MUSIC ON" : "[M] MUSIC OFF", leftX, startY + gap*4, LEFT, () => { musicOn = !musicOn; toggleMusic(musicOn); }); 
  drawVolumeControl(leftX, startY + gap * 5.2, 120);
}

function drawGameOver() { 
  background('#fafbf6'); let img = isNewHS ? assets.highscoreImg : assets.loseImg; drawResponsiveImage(img, width * 0.95, height * 0.75, -50); 
  let rowY = height - 50; let recordSize = min(18, width * 0.04);
  fill('#0f0f1b'); textAlign(LEFT, CENTER);
  if (isNewHS) { textSize(24); text("NEW KILL RECORD: " + score, 40, rowY); } 
  else { textSize(20); text("SCORE: " + score, 40, rowY); fill('#565A75'); let offset = textWidth("SCORE: " + score) + 40; text("RECORD: " + highscore, max(offset, 250), rowY); }
  drawGenericButton("RESTART [R]", width - 260, rowY, RIGHT, () => { resetGame(); gameState = "PLAY"; toggleMusic(true); }); 
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

  // Zuerst das Blut zeichnen, damit es unter den Körpern liegt
  drawBlood();

  let drawList = [{y: player.y, type: 'player'}];
  for (let e of enemies) { 
    if (e.state === 'dead') e.animCounter = 9; 
    drawList.push({y: e.y, type: 'enemy', data: e}); 
  }

  // Y-Sortierung, damit die Tiefe stimmt
  drawList.sort((a, b) => a.y - b.y);

  for (let obj of drawList) {
      if (obj.type === 'player') {
          let finalImg = isNewHS ? assets.p_win : assets.p_ko; 
          if (finalImg && finalImg.width > 0) image(finalImg, width/2, height/2, 414, 414);
      } else if(obj.data) {
          drawEnemy(obj.data);
      }
  }
  pop();

  if (freezeTimer <= 0) { 
    stopAllGameSounds(); 
    if (isNewHS) assets.s_win?.play(); else assets.s_lose?.play(); 
    gameState = "GAMEOVER"; 
  }
}

function getPlayerImg() { 
  if (player.state === 'parry') return player.dir === 'r' ? assets.p_parry : assets.p_parrym; 
  if (player.state === 'parryattack') {
      if (player.isMoving) return player.dir === 'r' ? assets.p_dodge : assets.p_dodgem;
      return player.dir === 'r' ? assets.p_parryAtk : assets.p_parryAtkm; 
  }
  if (player.state === 'hit') return player.dir === 'r' ? assets.p_hit : assets.p_hitm; 
  if (player.state === 'walk' && !player.isMoving) return player.dir === 'r' ? assets.p_idle : assets.p_idlem;
  return player.dir === 'r' ? assets.p_walk : assets.p_walkm; 
}

function drawComic() { 
  background('#fafbf6'); if (assets.comic[currentComicPage]) drawResponsiveImage(assets.comic[currentComicPage], width * 0.95, height * 0.85, -40);
  let btnY = height - 50; drawGenericButton("< PREV", 60, btnY, LEFT, () => { if(currentComicPage > 0) currentComicPage--; }); 
  drawGenericButton("NEXT >", 220, btnY, LEFT, () => { if(currentComicPage < 5) currentComicPage++; }); 
  drawGenericButton("MENU [ESC]", width - 60, btnY, RIGHT, () => gameState = "MENU"); 
}

function drawCredits() { 
  background('#fafbf6'); fill('#0f0f1b'); textAlign(CENTER, CENTER); textSize(26); text("CREDITS", width/2, 60); 
  textSize(min(16, width * 0.035)); 
  let creditText = "A game by Tanmoy Roy\n\nIdea by Tanmoy Roy & Fatih Urfa\nAnimation, Art, Design & Story by Tanmoy Roy\nVibe Coding via Google Gemini\nSound Effects from Pixabay & Sample Focus\n\nMusic\nSynthwave.wav by Wax_vibe\nhttps://freesound.org/s/550337/\nLicense: CC 0\n\nStarted in 2022, finished in 2026.\n©2026 Tanmoy Roy. All Rights Reserved."; 
  textLeading(25); text(creditText, width * 0.1, height * 0.15, width * 0.8, height * 0.7); 
  drawGenericButton("MENU [ESC]", width/2, height - 60, CENTER, () => gameState = "MENU"); 
}

function drawCoverImage(img) { if (!img || img.width <= 0) return; let r = img.width/img.height, sr = width/height, w, h; if (r > sr) { h = height; w = height * r; } else { w = width; h = width / r; } image(img, width/2, height/2, w, h); }
function drawResponsiveImage(img, tw, th, yO = 0) { if (!img || img.width <= 0) return; let r = img.width/img.height, tr = tw/th, w, h; if (r > tr) { w = tw; h = tw/r; } else { h = th; w = th*r; } image(img, width/2, height/2 + yO, w, h); }
function drawGenericButton(txt, x, y, align, callback, customCol) { 
  textAlign(align, CENTER); textSize(20); let tw = textWidth(txt); 
  let isHover = (align === CENTER) ? (mouseX > x - tw/2 && mouseX < x + tw/2 && mouseY > y - 20 && mouseY < y + 20) : (align === LEFT) ? (mouseX > x && mouseX < x + tw && mouseY > y - 20 && mouseY < y + 20) : (mouseX > x - tw && mouseX < x && mouseY > y - 20 && mouseY < y + 20) ; 
  fill(isHover ? '#D00000' : (customCol || '#c6b7be')); text(txt, x, y); if (isHover && mouseIsPressed) { mouseIsPressed = false; callback(); } 
}
function drawTutorial() { background('#fafbf6'); if (assets.tutorial) drawResponsiveImage(assets.tutorial, width * 0.9, height * 0.8, -30); drawGenericButton("MENU [ESC]", width/2, height - 50, CENTER, () => gameState = "MENU"); }

function changeVolume(amt) {
  globalVolume = constrain(globalVolume + amt, 0, 1);
  outputVolume(globalVolume); 
  const sfxVol = 1; 
  if(assets.s_kill) assets.s_kill.setVolume(sfxVol);
  if(assets.s_parry) assets.s_parry.setVolume(sfxVol);
  if(assets.s_hit) assets.s_hit.setVolume(sfxVol);
  if(assets.s_dash) assets.s_dash.setVolume(sfxVol);
  if(assets.s_charge) assets.s_charge.setVolume(sfxVol);
  if(assets.s_multikill) assets.s_multikill.setVolume(sfxVol);
  if(assets.s_slash_miss) assets.s_slash_miss.setVolume(sfxVol);
  if(assets.s_attack_vocal) assets.s_attack_vocal.setVolume(sfxVol);
}

function drawVolumeControl(x, y, w) {
  textAlign(LEFT, CENTER); textSize(16); fill('#c6b7be'); text("VOL", x, y);
  drawGenericButton("-", x + 60, y, CENTER, () => changeVolume(-0.1));
  let sliderX = x + 80;
  let knobX = map(globalVolume, 0, 1, sliderX, sliderX + w);
  if (mouseIsPressed && dist(mouseX, mouseY, knobX, y) < 25) isDraggingVolume = true;
  if (!mouseIsPressed) isDraggingVolume = false;
  if (isDraggingVolume) {
    globalVolume = constrain(map(mouseX, sliderX, sliderX + w, 0, 1), 0, 1);
    outputVolume(globalVolume);
  }
  stroke('#565a75'); strokeWeight(4); line(sliderX, y, sliderX + w, y);
  noStroke(); fill('#D00000'); ellipse(knobX, y, 18, 18);
  drawGenericButton("+", x + 100 + w, y, CENTER, () => changeVolume(0.1));
}

function keyPressed() { 
  userStartAudio();
  if (key === '+' || key === '=') changeVolume(0.1); if (key === '-' || key === '_') changeVolume(-0.1); 
  if (key === 'm' || key === 'M') { musicOn = !musicOn; toggleMusic(musicOn); }
  if (keyCode === ESCAPE) { gameState = "MENU"; stopAllGameSounds(); } 
  if ((key === 'r' || key === 'R')) { resetGame(); gameState = "PLAY"; toggleMusic(true); } 
  if (gameState === "PLAY" && (key === ' ' || keyCode === 32)) triggerParry(); 
  if (gameState === "MENU") { 
    if (key === '1') { resetGame(); gameState = "PLAY"; toggleMusic(true); } 
    if (key === '2') { gameState = "COMIC"; currentComicPage = 0; storyVisited = true; localStorage.setItem("storySeen", "true"); } 
    if (key === '3') { gameState = "TUTORIAL"; tutorialVisited = true; localStorage.setItem("tutorialSeen", "true"); } 
    if (key === '4') gameState = "CREDITS"; 
  } 
  if (gameState === "COMIC") { if (keyCode === RIGHT_ARROW) { if(currentComicPage < 5) currentComicPage++; } if (keyCode === LEFT_ARROW) { if(currentComicPage > 0) currentComicPage--; } }
}
function applyScreenEffects(off) { if (screenShake > 0) { translate(random(-screenShake, screenShake), random(-screenShake, screenShake)); screenShake *= 0.85; } translate(width/2 + off, height/2 + off); scale(gameZoom); translate(-width/2, -height/2); }
function mousePressed() { 
  userStartAudio(); 
  if (musicOn && assets.bgm && !assets.bgm.isPlaying() && (gameState === "MENU" || gameState === "PLAY")) toggleMusic(true);
  if (gameState === "PLAY" && mouseButton === LEFT) triggerParry(); 
}