/**
 * ============================================================
 *  DREAMER — enhancements.js
 *  All 10 immersive feature additions.
 *  Loaded AFTER script.js — never modifies existing timer/goals logic.
 * ============================================================
 *
 *  1.  Living Moon System        (phase + parallax + dust)
 *  2.  Immersive Cosmic BG       (nebula clouds + aurora + extra stars)
 *  3.  Dream Constellation       (canvas, stars from completed goals)
 *  4.  Rocket Celebration        (launches on session/goal complete)
 *  5.  Cosmic Companion          (space whale, follows cursor, sleeps)
 *  6.  Cosmic Rank System        (rank badge, progress, localStorage)
 *  7.  Enhanced Stats            (animated counters + float particles)
 *  8.  Shooting Star Events      (random, clickable, bonus points)
 *  9.  Ambient Sound System      (Web Audio API, toggleable)
 * 10.  Dream Journal             (textarea, localStorage, past entries)
 * ============================================================
 */

'use strict';

/* ============================================================
   SHARED ENHANCEMENT STATE
   (separate from script.js `state` to avoid collisions)
============================================================ */
const EXT = {
  totalSessions: 0,       // Synced from localStorage on boot
  cosmicPoints:  0,       // Bonus points from shooting stars
  rank:          0,       // 0-5 index
  soundEnabled:  false,
  audioCtx:      null,
  companion: {
    x: 0, y: 0,           // current rendered position
    targetX: 0, targetY: 0,
    sleeping: false,
    sleepTimer: null,
  },
  constellationStars: [], // { x, y, label, twinkle }
  inactivityTimer: null,
};

// Rank definitions
const RANKS = [
  { name: 'Stargazer',       icon: '🔭', sessions: 0  },
  { name: 'Explorer',        icon: '🚀', sessions: 5  },
  { name: 'Astronaut',       icon: '👨‍🚀', sessions: 10 },
  { name: 'Captain',         icon: '🛸', sessions: 20 },
  { name: 'Cosmic Dreamer',  icon: '🌌', sessions: 30 },
  { name: 'Galaxy Architect',icon: '🏛️', sessions: 50 },
];
const ACHIEVEMENTS = [
  { icon:'🌙', title:'First Focus', sessions:1 },
  { icon:'⭐', title:'Star Seeker', sessions:5 },
  { icon:'🚀', title:'Deep Voyager', sessions:10 },
  { icon:'☄️', title:'Cosmic Explorer', sessions:25 },
  { icon:'🌌', title:'Galaxy Master', sessions:50 }
];
const SFX = {
  click: new Audio("sounds/click.mp3"),
  start: new Audio("sounds/start.mp3"),
  complete: new Audio("sounds/complete.mp3"),
  goal: new Audio("sounds/goal.mp3"),
  goalComplete: new Audio("sounds/goal-complete.mp3"),
  achievement: new Audio("sounds/achievement.mp3"),
  theme: new Audio("sounds/theme.mp3"),
  timerComplete: new Audio("sounds/timer-complete.mp3")
};

// Set volume for all sounds
Object.values(SFX).forEach(sound => {
  sound.volume = 0.35;
});
const LS_EXT = 'dreamer_ext';

/* ---- Persist & restore enhancement state ---- */
function saveExt() {
  localStorage.setItem(LS_EXT, JSON.stringify({
    cosmicPoints: EXT.cosmicPoints,
    rank:         EXT.rank,
  }));
}

function loadExt() {
  try {
    const d = JSON.parse(localStorage.getItem(LS_EXT));
    if (d) {
      EXT.cosmicPoints = d.cosmicPoints || 0;
    }
    // Sync session count from main stats
    const stats = JSON.parse(localStorage.getItem('dreamer_stats'));
    if (stats) EXT.totalSessions = stats.totalSessions || 0;
  } catch (err) {
  console.error('Journal Save Error:', err);
}
  // Derive rank from sessions
  EXT.rank = deriveRank(EXT.totalSessions);
}

function deriveRank(sessions) {
  let r = 0;
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (sessions >= RANKS[i].sessions) { r = i; break; }
  }
  return r;
}
function initPortal(){

    const portal = document.getElementById("dreamer-portal");

    const button = document.getElementById("enter-dreamer");

    if(!portal || !button) return;

    button.addEventListener("click",()=>{

        button.textContent = "✨ The stars are listening...";

         portal.classList.add("portal-hide");

        setTimeout(()=>{

            portal.remove();

        },900);

    });

}
/* ============================================================
   1. LIVING MOON SYSTEM
============================================================ */
function initMoon() {
  const moonSystem = document.getElementById('moon-system');
  const moonShadow = document.getElementById('moon-shadow');
  const moonBody   = document.getElementById('moon-body');
  const phaseLabel = document.getElementById('moon-phase-label');
  const dustField  = document.getElementById('moon-dust-field');
  if (!moonSystem) return;

  /* --- Create dust particles --- */
  for (let i = 0; i < 22; i++) {
    const d = document.createElement('div');
    d.className = 'moon-dust';
    const size   = Math.random() * 3 + 1;
    const angle  = Math.random() * 360;
    const radius = 130 + Math.random() * 70;
    const rad    = (angle * Math.PI) / 180;
    const startX = Math.cos(rad) * radius + 180;
    const startY = Math.sin(rad) * radius + 180;
    const dx     = (Math.random() - 0.5) * 60;
    const dy     = (Math.random() - 0.5) * 60;

    Object.assign(d.style, {
      width:   size + 'px',
      height:  size + 'px',
      left:    startX + 'px',
      top:     startY + 'px',
      '--dx':  dx + 'px',
      '--dy':  dy + 'px',
      animationDuration:  (Math.random() * 6 + 5) + 's',
      animationDelay:     (Math.random() * 8) + 's',
    });
    dustField.appendChild(d);
  }

  /* --- Moon phases (clip-path on shadow layer) --- */
  // Each phase description: [label, clip-path of the SHADOW]
  // New Moon = full shadow, Full Moon = no shadow
  const phases = [
    { label: '🌑 New Moon',     clip: 'ellipse(52% 52% at 50% 50%)' },
    { label: '🌒 Waxing Crescent', clip: 'ellipse(52% 52% at 20% 50%)' },
    { label: '🌓 Half Moon',    clip: 'ellipse(52% 52% at 5% 50%)'  },
    { label: '🌔 Gibbous Moon', clip: 'ellipse(52% 52% at -10% 50%)'},
    { label: '🌕 Full Moon',    clip: 'ellipse(0% 0% at 50% 50%)'   },
  ];

  function setMoonPhase(totalSessions) {
    let phaseIdx = +4;
    if (totalSessions >= 30) phaseIdx = 4;
    else if (totalSessions >= 20) phaseIdx = 3;
    else if (totalSessions >= 10) phaseIdx = 2;
    else if (totalSessions >= 5)  phaseIdx = 1;
    else phaseIdx = 0;

    const phase = phases[phaseIdx];
    if (moonShadow) moonShadow.style.clipPath = phase.clip;
    if (phaseLabel) phaseLabel.textContent    = phase.label;

    // Full moon gets extra glow
    if (moonBody) {
      moonBody.style.boxShadow = phaseIdx === 4
        ? '0 0 120px rgba(200,180,255,0.6), 0 0 240px rgba(108,53,222,0.3), inset -30px -20px 60px rgba(0,0,0,0.35)'
        : '';
    }
  }

  setMoonPhase(EXT.totalSessions);

  // Expose so recordSession can call it
  window._setMoonPhase = setMoonPhase;

  /* --- Parallax: moon reacts to mouse --- */
  document.addEventListener('mousemove', (e) => {
    const nx = (e.clientX / window.innerWidth  - 0.5) * 2;
    const ny = (e.clientY / window.innerHeight - 0.5) * 2;
    // Hero orbs parallax
    document.querySelectorAll('.orb[data-depth]').forEach(orb => {
      const depth = parseFloat(orb.dataset.depth) || 0.3;
      orb.style.transform = `translate(${nx * depth * 30}px, ${ny * depth * 30}px)`;
    });
    // Moon parallax (subtle)
    if (moonSystem) {
      moonSystem.style.transform =
        `translate(calc(-50% + ${nx * 18}px), calc(-62% + ${ny * 12}px))`;
    }
  });
}

/* ============================================================
   2. IMMERSIVE COSMIC BACKGROUND — nebula clouds + aurora
============================================================ */
function initCosmicBackground() {
  // Aurora layer
  const aurora = document.createElement('div');
  aurora.className = 'aurora-layer';
  document.body.prepend(aurora);

  // Nebula clouds (pure CSS animated divs)
  const nebulas = [
    { w: 600, h: 400, top: '10%',  left: '5%',   color: 'rgba(108,53,222,0.10)', nx: '40px',  ny: '-25px', dur: '18s', opacity: 0.12 },
    { w: 500, h: 350, top: '60%',  left: '60%',  color: 'rgba(199,106,220,0.09)', nx: '-30px', ny: '20px',  dur: '22s', opacity: 0.10 },
    { w: 700, h: 450, top: '40%',  left: '-10%', color: 'rgba(77,217,240,0.07)',  nx: '50px',  ny: '30px',  dur: '28s', opacity: 0.08 },
    { w: 400, h: 300, top: '80%',  left: '30%',  color: 'rgba(108,53,222,0.08)', nx: '-20px', ny: '-40px', dur: '20s', opacity: 0.09 },
    { w: 550, h: 380, top: '20%',  left: '70%',  color: 'rgba(199,106,220,0.07)', nx: '25px',  ny: '-35px', dur: '25s', opacity: 0.08 },
  ];

  nebulas.forEach((n, i) => {
    const el = document.createElement('div');
    el.className = 'nebula-cloud';
    Object.assign(el.style, {
      width:    n.w + 'px',
      height:   n.h + 'px',
      top:      n.top,
      left:     n.left,
      background: `radial-gradient(ellipse, ${n.color} 0%, transparent 70%)`,
      '--nx':   n.nx,
      '--ny':   n.ny,
      '--base-opacity': n.opacity,
      animationDuration: n.dur,
      animationDelay:    (i * -4) + 's',
    });
    document.body.appendChild(el);
  });

  /* --- Extra twinkling star overlay (CSS canvas-free) --- */
  const starLayer = document.createElement('div');
  Object.assign(starLayer.style, {
    position: 'fixed', inset: '0',
    pointerEvents: 'none', zIndex: '0', overflow: 'hidden',
  });
  document.body.appendChild(starLayer);

  for (let i = 0; i < 120; i++) {
    const s = document.createElement('div');
    const size = Math.random() * 2.5 + 0.5;
    Object.assign(s.style, {
      position:  'absolute',
      width:     size + 'px',
      height:    size + 'px',
      borderRadius: '50%',
      background: `rgba(${200+Math.random()*55},${200+Math.random()*55},255,${0.4+Math.random()*0.6})`,
      top:       (Math.random() * 100) + '%',
      left:      (Math.random() * 100) + '%',
      animation: `star-twinkle ${2 + Math.random() * 4}s ${Math.random() * 5}s ease-in-out infinite`,
    });
    starLayer.appendChild(s);
  }

  // Inject twinkle keyframes
  if (!document.getElementById('twinkle-kf')) {
    const s = document.createElement('style');
    s.id = 'twinkle-kf';
    s.textContent = `
      @keyframes star-twinkle {
        0%,100%{ opacity:0.2; transform:scale(1);   }
        50%    { opacity:1;   transform:scale(1.6); }
      }
    `;
    document.head.appendChild(s);
  }
}
/* ============================================================
   3. DREAM CONSTELLATION SYSTEM
============================================================ */
function initConstellation() {
  const canvas   = document.getElementById('constellation-canvas');
  const emptyMsg = document.getElementById('constellation-empty');
  if (!canvas) return;

  const ctx  = canvas.getContext('2d');
  let tooltip = null;

  // Load saved stars
  function loadStars() {
    try {
      const d = JSON.parse(localStorage.getItem('dreamer_constellation'));
      if (Array.isArray(d)) EXT.constellationStars = d;
    } catch (_) {}
  }

  function saveStars() {
    localStorage.setItem('dreamer_constellation', JSON.stringify(EXT.constellationStars));
  }

  // Add a new star when a goal is completed
  window._addConstellationStar = function(label) {
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    // Distribute stars in clusters across the canvas
    EXT.constellationStars.push({
      x:       0.1 + Math.random() * 0.8,   // normalized 0-1
      y:       0.1 + Math.random() * 0.8,
      label:   label,
      twinkle: Math.random() * Math.PI * 2,  // phase offset
      size:    Math.random() * 2 + 2,
    });
    saveStars();
    emptyMsg && emptyMsg.classList.add('hidden');
  };

  loadStars();
  if (EXT.constellationStars.length > 0) emptyMsg && emptyMsg.classList.add('hidden');

  // Resize canvas to its CSS size
  function resizeCanvas() {
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  let hoveredStar = null;
  let time = 0;

  // Tooltip element
  tooltip = document.createElement('div');
  tooltip.className = 'star-tooltip';
  document.body.appendChild(tooltip);

  // Draw loop
  function drawConstellation() {
    requestAnimationFrame(drawConstellation);
    time += 0.012;

    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    // Background deep space
    ctx.fillStyle = 'rgba(5,8,24,0.55)';
    ctx.fillRect(0, 0, W, H);

    const stars = EXT.constellationStars;
    if (stars.length === 0) return;

    // --- Draw constellation lines between stars ---
    // Connect each star to nearest 2 neighbours
    stars.forEach((star, i) => {
      const sx = star.x * W;
      const sy = star.y * H;

      // Find up to 2 nearest
      const dists = stars
        .map((other, j) => ({ j, d: Math.hypot((other.x - star.x) * W, (other.y - star.y) * H) }))
        .filter(({j}) => j !== i)
        .sort((a, b) => a.d - b.d)
        .slice(0, 2);

      dists.forEach(({j, d}) => {
        if (d > 300) return; // Only connect nearby stars
        const other = stars[j];
        const alpha = 0.12 + 0.05 * Math.sin(time + i * 0.5);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(other.x * W, other.y * H);
        const grad = ctx.createLinearGradient(sx, sy, other.x * W, other.y * H);
        grad.addColorStop(0, `rgba(108,53,222,${alpha})`);
        grad.addColorStop(1, `rgba(77,217,240,${alpha})`);
        ctx.strokeStyle = grad;
        ctx.lineWidth   = 0.8;
        ctx.stroke();
      });
    });

    // --- Draw stars ---
    stars.forEach((star, i) => {
      const sx = star.x * W;
      const sy = star.y * H;
      const twinkle = 0.6 + 0.4 * Math.sin(time * 1.5 + star.twinkle);
      const isHovered = hoveredStar === i;
      const radius = (isHovered ? star.size * 2.5 : star.size) * twinkle;

      // Outer glow
      const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius * 6);
      glow.addColorStop(0, `rgba(200,180,255,${0.4 * twinkle})`);
      glow.addColorStop(1, 'rgba(200,180,255,0)');
      ctx.beginPath();
      ctx.arc(sx, sy, radius * 6, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      // Core star
      const core = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius);
      core.addColorStop(0, '#ffffff');
      core.addColorStop(0.4, isHovered ? '#4dd9f0' : '#c8c0ff');
      core.addColorStop(1, 'rgba(108,53,222,0)');
      ctx.beginPath();
      ctx.arc(sx, sy, radius, 0, Math.PI * 2);
      ctx.fillStyle = core;
      ctx.fill();

      // Star cross sparkle
      const spk = radius * 2.5 * twinkle;
      ctx.strokeStyle = `rgba(255,255,255,${0.3 * twinkle})`;
      ctx.lineWidth   = 0.6;
      ctx.beginPath();
      ctx.moveTo(sx - spk, sy); ctx.lineTo(sx + spk, sy);
      ctx.moveTo(sx, sy - spk); ctx.lineTo(sx, sy + spk);
      ctx.stroke();
    });
  }

  drawConstellation();

  // Hover detection
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx   = e.clientX - rect.left;
    const my   = e.clientY - rect.top;
    const W    = canvas.width;
    const H    = canvas.height;

    hoveredStar = null;
    EXT.constellationStars.forEach((star, i) => {
      const dx = star.x * W - mx;
      const dy = star.y * H - my;
      if (Math.hypot(dx, dy) < 16) hoveredStar = i;
    });

    if (hoveredStar !== null) {
      tooltip.textContent = EXT.constellationStars[hoveredStar].label;
      tooltip.style.left    = (e.clientX + 14) + 'px';
      tooltip.style.top     = (e.clientY - 10) + 'px';
      tooltip.style.opacity = '1';
    } else {
      tooltip.style.opacity = '0';
    }
  });

  canvas.addEventListener('mouseleave', () => { tooltip.style.opacity = '0'; });
}

/* ============================================================
   4. ROCKET CELEBRATION
============================================================ */
function launchRocket(fromGoal = false) {
  const rocket = document.getElementById('rocket-layer');
  if (!rocket) return;

  // Starting position: bottom-center or bottom-left
  const startX = fromGoal
    ? window.innerWidth * 0.25
    : window.innerWidth * 0.5;
  const startY = window.innerHeight + 60;

  // End position: upper-right sky
  const endX = startX + (Math.random() * 300 + 200);
  const endY = -100;
  const angle = Math.atan2(endX - startX, startY - endY) * (180 / Math.PI);

  Object.assign(rocket.style, {
    left:      startX + 'px',
    top:       startY + 'px',
    opacity:   '1',
    transform: `rotate(${angle}deg)`,
    transition: 'none',
  });

  const trailContainer = document.getElementById('rocket-trail');
  const trailInterval  = setInterval(() => {
    if (!trailContainer) return;
    const puff = document.createElement('div');
    puff.className = 'trail-puff';
    const sz = Math.random() * 12 + 6;
    Object.assign(puff.style, {
      width: sz + 'px', height: sz + 'px',
      marginBottom: '2px',
    });
    trailContainer.prepend(puff);
    if (trailContainer.children.length > 8) {
      trailContainer.lastChild.remove();
    }
  }, 60);

  // Also spawn floating star-dust particles
  const dustInterval = setInterval(() => {
    spawnStarDust(
      parseFloat(rocket.style.left),
      parseFloat(rocket.style.top)
    );
  }, 80);

  // Animate rocket across screen
  requestAnimationFrame(() => {
    Object.assign(rocket.style, {
      transition: 'left 2.2s cubic-bezier(0.2,0,0.4,1), top 2.2s cubic-bezier(0.2,0,0.4,1), opacity 0.4s 1.8s',
      left:  endX + 'px',
      top:   endY + 'px',
    });
  });

  setTimeout(() => {
    rocket.style.opacity = '0';
    clearInterval(trailInterval);
    clearInterval(dustInterval);
    if (trailContainer) trailContainer.innerHTML = '';
  }, 2400);
}

function spawnStarDust(x, y) {
  for (let i = 0; i < 3; i++) {
    const p = document.createElement('div');
    const sz = Math.random() * 5 + 2;
    const hue = Math.random() * 60 + 240;
    Object.assign(p.style, {
      position: 'fixed',
      left: x + 'px',
      top:  y + 'px',
      width: sz + 'px', height: sz + 'px',
      borderRadius: '50%',
      background: `hsl(${hue},100%,75%)`,
      boxShadow: `0 0 ${sz*2}px hsl(${hue},100%,70%)`,
      pointerEvents: 'none',
      zIndex: '3999',
      transition: `transform ${0.4+Math.random()*0.5}s ease-out, opacity ${0.5}s ease-out`,
      transform: 'translate(-50%,-50%)',
    });
    document.body.appendChild(p);
    requestAnimationFrame(() => {
      const dx = (Math.random() - 0.5) * 60;
      const dy = (Math.random() - 0.5) * 60;
      p.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0)`;
      p.style.opacity   = '0';
    });
    setTimeout(() => p.remove(), 600);
  }
}

/* ============================================================
   5. COSMIC COMPANION (Space Whale)
============================================================ */
function initCompanion() {
  
  const companion = document.getElementById('companion');
  const eyelid = document.querySelector('.whale-eyelid');
  const zzz       = document.getElementById('companion-zzz');
  const particles = document.getElementById('companion-particles');
  const message = document.getElementById("companion-message");
  if (!companion) return;

  // Initial position
  EXT.companion.x = window.innerWidth  - 180;
  EXT.companion.y = window.innerHeight - 200;
  EXT.companion.targetX = EXT.companion.x;
  EXT.companion.targetY = EXT.companion.y;

  // Follow cursor (lagged)
  document.addEventListener('mousemove', (e) => {
    // Follow toward cursor but stay near right/bottom area
    const tx = e.clientX * 0.3 + window.innerWidth  * 0.55;
    const ty = e.clientY * 0.25 + window.innerHeight * 0.55;
   const margin = window.innerWidth < 768 ? 50 : 80;

   EXT.companion.targetX = Math.min(
    Math.max(tx, margin),
    window.innerWidth - 120
);

   EXT.companion.targetY = Math.min(
    Math.max(ty, margin),
    window.innerHeight - 120
);
    wakeCompanion();
  });

  // Inactivity → sleep after 15s
  function wakeCompanion() {
    if (EXT.companion.sleeping) {
      EXT.companion.sleeping = false;
      companion.classList.remove('sleeping');
    }
    clearTimeout(EXT.inactivityTimer);
    EXT.inactivityTimer = setTimeout(() => {
      EXT.companion.sleeping = true;
      companion.classList.add('sleeping');
    }, 15000);
  }
  wakeCompanion(); // start timer immediately

  // Smooth movement loop
  function companionLoop() {
    requestAnimationFrame(companionLoop);
    const lerpSpeed = EXT.companion.sleeping ? 0.005 : 0.018;
    EXT.companion.x += (EXT.companion.targetX - EXT.companion.x) * lerpSpeed;
    EXT.companion.y += (EXT.companion.targetY - EXT.companion.y) * lerpSpeed;

    companion.style.left   = EXT.companion.x + 'px';
    companion.style.bottom = 'auto';
    companion.style.top    = EXT.companion.y + 'px';
    companion.style.right  = 'auto';
  }
  companionLoop();

  // Emit particles periodically
  setInterval(() => {
    if (!particles) return;
    for (let i = 0; i < 2; i++) {
      const p = document.createElement('div');
      p.className = 'companion-spark';
      const sz = Math.random() * 5 + 2;

      const accent = getComputedStyle(document.documentElement)
      .getPropertyValue('--accent')
      .trim();

      const cx = (Math.random() - 0.5) * 80;
      const cy = (Math.random() - 0.5) * 50 - 30;

      Object.assign(p.style, {
      width: sz + 'px',
      height: sz + 'px',
      left: (40 + Math.random() * 60) + 'px',
      top: (20 + Math.random() * 40) + 'px',

      background: accent,
      boxShadow: `0 0 ${sz * 2}px ${accent}`,

      '--cx': cx + 'px',
      '--cy': cy + 'px',
   });
      particles.appendChild(p);
      setTimeout(() => p.remove(), 1400);
    }
  }, 1200);
  // Welcome message
setTimeout(() => {

    message?.classList.add("show");

    setTimeout(() => {

        message?.classList.remove("show");

    }, 7000);

}, 1200);
function whaleBlink(){

    if(!eyelid) return;

    eyelid.setAttribute("height","10");

    setTimeout(()=>{

        eyelid.setAttribute("height","0");

    },150);

}

function scheduleBlink(){

    const nextBlink = 8000 + Math.random() * 12000;

    setTimeout(()=>{

        whaleBlink();

        scheduleBlink();

    }, nextBlink);

}

scheduleBlink();
}

/* ============================================================
   6. COSMIC RANK SYSTEM
============================================================ */
function initRankSystem() {
  updateRankDisplay();
}

function updateRankDisplay() {
  const badge  = document.getElementById('rank-badge');
  const icon   = document.getElementById('rank-icon');
  const title  = document.getElementById('rank-title');
  const bar    = document.getElementById('rank-bar-fill');
  const next   = document.getElementById('rank-next');
  if (!badge) return;

  const r    = EXT.rank;
  const rank = RANKS[r];
  const nextRank = RANKS[r + 1];

  if (icon)  icon.textContent  = rank.icon;
  if (title) title.textContent = rank.name;
  if (next)  next.textContent  = nextRank ? `Next: ${nextRank.name} (${nextRank.sessions} sessions)` : '★ Max Rank Achieved';

  // Progress bar
  if (bar && nextRank) {
    const sessionsInRange  = nextRank.sessions - rank.sessions;
    const sessionsProgress = EXT.totalSessions - rank.sessions;
    const pct = Math.min((sessionsProgress / sessionsInRange) * 100, 100);
    setTimeout(() => { bar.style.width = pct + '%'; }, 300);
  } else if (bar) {
    bar.style.width = '100%';
  }

  // Show rank-up toast if rank changed
  saveExt();
}

function checkRankUp() {
  const newRank = deriveRank(EXT.totalSessions);
  if (newRank > EXT.rank) {
    EXT.rank = newRank;
    showRankUpToast(RANKS[newRank]);
    updateRankDisplay();
  }
}

function showRankUpToast(rank) {
  const toast = document.createElement('div');
  Object.assign(toast.style, {
    position: 'fixed', bottom: '120px', left: '50%',
    transform: 'translateX(-50%) translateY(20px)',
    background: 'linear-gradient(135deg, rgba(108,53,222,0.95), rgba(199,106,220,0.95))',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '16px', padding: '1rem 2rem',
    color: '#e8eaf6', fontFamily: "'Inter',sans-serif",
    fontSize: '0.9rem', fontWeight: '600',
    textAlign: 'center', zIndex: '6000',
    boxShadow: '0 0 40px rgba(108,53,222,0.6)',
    transition: 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1), opacity 0.5s',
    opacity: '0',
  });
  toast.innerHTML = `${rank.icon} Rank Up! You are now a <strong>${rank.name}</strong>`;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity   = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
  });

  setTimeout(() => {
    toast.style.opacity   = '0';
    toast.style.transform = 'translateX(-50%) translateY(-20px)';
    setTimeout(() => toast.remove(), 600);
  }, 4000);
}
function showAchievement(title, icon) {
  SFX.achievement.currentTime = 0;
  SFX.achievement.play().catch(() => {});

  const popup = document.getElementById('achievement-popup');
  const name  = document.getElementById('achievement-popup-name');

  if (!popup || !name) return;

  popup.querySelector('.achievement-popup-icon').textContent = icon;
  name.textContent = title;

  popup.classList.add('show');

  setTimeout(() => {
    popup.classList.remove('show');
  }, 3000);
}
function initAchievements() {
  const grid = document.getElementById('achievement-grid');
  if (!grid) return;

  let totalSessions = 0;

  try {
    const stats = JSON.parse(
      localStorage.getItem('dreamer_stats')
    );

    totalSessions = stats?.totalSessions || 0;
  } catch {}

  grid.innerHTML = '';

  ACHIEVEMENTS.forEach(a => {
    const unlocked = totalSessions >= a.sessions;
    const key = `achievement_${a.sessions}`;

  if (
  unlocked &&
  !localStorage.getItem(key)
 ) {
  localStorage.setItem(key, 'true');

  setTimeout(() => {
    showAchievement(a.title, a.icon);
  }, 1000);
}

    const card = document.createElement('div');
    card.className =
      `achievement-card ${unlocked ? 'unlocked' : 'locked'}`;

    card.innerHTML = `
      <div class="achievement-icon">${a.icon}</div>
      <div class="achievement-title">${a.title}</div>
      <div class="achievement-desc">
        Complete ${a.sessions} focus session${a.sessions > 1 ? 's' : ''}
      </div>
    `;

    grid.appendChild(card);
  });
}

/* ============================================================
   7. ENHANCED STATS EXPERIENCE
============================================================ */
function enhanceStats() {
  // Floating particles from stat cards on page load
  function emitStatParticles(card) {
    const rect = card.getBoundingClientRect();
    for (let i = 0; i < 4; i++) {
      const p   = document.createElement('div');
      p.className = 'stat-float-particle';
      const sz  = Math.random() * 5 + 2;
      const hue = 260 + Math.random() * 80;
      Object.assign(p.style, {
        width:  sz + 'px', height: sz + 'px',
        background: `hsl(${hue},100%,72%)`,
        boxShadow: `0 0 ${sz*2}px hsl(${hue},100%,65%)`,
        left: (Math.random() * rect.width) + 'px',
        bottom: '0px',
      });
      card.appendChild(p);
      setTimeout(() => p.remove(), 2000);
    }
    card.classList.add('glow-pulse');
    setTimeout(() => card.classList.remove('glow-pulse'), 700);
  }

  // Attach hover spark to every stat card
  document.querySelectorAll('.stat-card').forEach(card => {
    card.addEventListener('mouseenter', () => emitStatParticles(card));
  });

  // Also call on session complete — hook via custom event
  document.addEventListener('dreamer:session-complete', () => {
    document.querySelectorAll('.stat-card').forEach((card, i) => {
      setTimeout(() => emitStatParticles(card), i * 150);
    });
  });

  // Stat bar progress widths (animate from 0 on scroll-into-view)
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const bars = entry.target.querySelectorAll('.stat-bar-fill');
      bars.forEach(bar => {
        // Set width based on data-driven % (max at 10 sessions = 100%)
        const parentStat = bar.closest('.stat-card');
        const valueEl = parentStat && parentStat.querySelector('.stat-value');
        const val = parseInt(valueEl?.textContent) || 0;
        const pct = Math.min(val * 10, 100);
        setTimeout(() => { bar.style.width = pct + '%'; }, 400);
      });
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.3 });

  document.querySelectorAll('.stat-card').forEach(c => observer.observe(c));
}

/* ============================================================
   8. SHOOTING STAR EVENTS
============================================================ */
function initShootingStars() {
  console.log("SHOOTING STARS INITIALIZED");
  const layer = document.getElementById('shooting-star-layer');
  if (!layer) return;

  let cosmicPointsDisplay = 0;

  function spawnShootingStar() {
    console.log("STAR SPAWNED");
    const star   = document.createElement('div');
    star.className = 'shooting-star';

    // Random starting point across top 60% of screen
    const startX  = Math.random() * window.innerWidth;
    const startY  = Math.random() * window.innerHeight * 0.5;
    // Travel distance & angle
    const angle   = 20 + Math.random() * 30;  // degrees downward
    const dist    = 300 + Math.random() * 400;
    const rad     = (angle * Math.PI) / 180;
    const dx      = Math.cos(rad) * dist;
    const dy      = Math.sin(rad) * dist;
    const dur     = (dist / 400) * 1.2; // seconds
    const length  = 80 + Math.random() * 120;

    Object.assign(star.style, {
      left:    startX + 'px',
      top:     startY + 'px',
      width:   length + 'px',
      transform: `rotate(${angle}deg)`,
      transformOrigin: 'left center',
      '--sx':  dx + 'px',
      '--sy':  dy + 'px',
      animationDuration: dur + 's',
    });

    layer.appendChild(star);

    // Click handler — grant bonus points
    star.addEventListener('click', (e) => {
      e.stopPropagation();
      EXT.cosmicPoints += 10;
      saveExt();
      showBonusBurst(e.clientX, e.clientY, '+10 Cosmic Points ✦');
      star.remove();
    });

    // Auto-remove after animation
    setTimeout(() => star.remove(), dur * 1000 + 200);

    // Schedule next
    const nextIn = 30000; // 20-60s
    setTimeout(spawnShootingStar, nextIn);
  }

  // First star after 8 seconds
  setTimeout(spawnShootingStar, 1000);
}

function showBonusBurst(x, y, text) {
  const el = document.createElement('div');
  el.className   = 'bonus-burst';
  el.textContent = text;
  Object.assign(el.style, {
    left: x + 'px',
    top:  y + 'px',
  });
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1400);
}

/* ============================================================
   9. AMBIENT SOUND SYSTEM (Web Audio API)
============================================================ */
function initSound() {
  document.addEventListener('click', (e) => {
  if (e.target.closest('button')) {
    SFX.click.currentTime = 0;
    SFX.click.play().catch(() => {});
  }
});
  const btn     = document.getElementById('sound-toggle');
  const onIcon  = btn && btn.querySelector('.sound-on');
  const offIcon = btn && btn.querySelector('.sound-off');
  
  document.querySelectorAll('button').forEach(button => {
  button.addEventListener('click', () => {
    SFX.click.currentTime = 0;
    SFX.click.play().catch(() => {});
  });
});

  let oscillators = [];
  let gainNode    = null;

  function buildAudioGraph() {
    if (EXT.audioCtx) return;
    EXT.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    gainNode = EXT.audioCtx.createGain();
    gainNode.gain.setValueAtTime(0, EXT.audioCtx.currentTime);
    gainNode.connect(EXT.audioCtx.destination);
  }

  function createDrone(freq, vol) {
    const osc = EXT.audioCtx.createOscillator();
    const g   = EXT.audioCtx.createGain();
    osc.type  = 'sine';
    osc.frequency.setValueAtTime(freq, EXT.audioCtx.currentTime);
    g.gain.setValueAtTime(vol, EXT.audioCtx.currentTime);
    osc.connect(g);
    g.connect(gainNode);
    osc.start();
    return { osc, g };
  }

  function createChime() {
    // Random chime every 4-10 seconds
    function chimeOnce() {
      if (!EXT.soundEnabled || !EXT.audioCtx) return;
      const notes  = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25];
      const freq   = notes[Math.floor(Math.random() * notes.length)];
      const osc    = EXT.audioCtx.createOscillator();
      const g      = EXT.audioCtx.createGain();
      osc.type     = 'sine';
      osc.frequency.setValueAtTime(freq, EXT.audioCtx.currentTime);
      g.gain.setValueAtTime(0.08, EXT.audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, EXT.audioCtx.currentTime + 3);
      osc.connect(g);
      g.connect(gainNode);
      osc.start();
      osc.stop(EXT.audioCtx.currentTime + 3);
      setTimeout(chimeOnce, 4000 + Math.random() * 6000);
    }
    setTimeout(chimeOnce, 3000);
  }

  function startSound() {
    buildAudioGraph();
    if (EXT.audioCtx.state === 'suspended') EXT.audioCtx.resume();

    // Soft space drones (low frequencies, very quiet)
    oscillators = [
      createDrone(55,   0.06),  // Sub bass
      createDrone(110,  0.04),  // Deep drone
      createDrone(165,  0.025), // Harmony
      createDrone(220,  0.015), // Overtone
    ];

    // Fade in
    gainNode.gain.linearRampToValueAtTime(1, EXT.audioCtx.currentTime + 2);

    createChime();
    EXT.soundEnabled = true;
  }

  function stopSound() {
    if (!EXT.audioCtx) return;
    gainNode.gain.linearRampToValueAtTime(0, EXT.audioCtx.currentTime + 1.5);
    setTimeout(() => {
      oscillators.forEach(({ osc }) => { try { osc.stop(); } catch (_) {} });
      oscillators = [];
      EXT.soundEnabled = false;
    }, 1600);
  }
  console.log('btn =', btn);
  console.log('onIcon =', onIcon);
  console.log('offIcon =', offIcon);

  if (!btn) {
  console.warn('Sound button not found');
  return;
}

btn.addEventListener('click', () => {
    if (!EXT.soundEnabled) {
      startSound();
      btn.classList.add('active');
      onIcon  && onIcon.classList.add('hidden');
      offIcon && offIcon.classList.remove('hidden');
    } else {
      stopSound();
      btn.classList.remove('active');
      onIcon  && onIcon.classList.remove('hidden');
      offIcon && offIcon.classList.add('hidden');
    }
  });
}
function initGalaxy(){

    const quotes = [

        "Every star was once a distant possibility.",

        "Dreams grow brightest in patient hearts.",

        "Small steps become constellations.",

        "Even the moon reaches fullness one night at a time.",

        "You are becoming who you once wished to be.",

        "The universe whispers to those who keep moving.",

        "Every sunrise remembers yesterday's effort.",

        "Your future self is cheering for you."

    ];

    const quote = document.getElementById("fq-text");
    const button = document.getElementById("btn-new-quote");

    if(!quote || !button) return;

    let current = 0;

    button.addEventListener("click", ()=>{

        let next;

        do{

            next = Math.floor(Math.random()*quotes.length);

        }while(next===current);

        current = next;

        quote.style.opacity = "0";

        setTimeout(()=>{

            quote.textContent = quotes[current];

            quote.style.opacity = "1";

        },300);

    });

}

/* ============================================================
   10. DREAM JOURNAL
============================================================ */
function initJournal() {
  const textarea = document.getElementById('journal-textarea');
  const saveBtn = document.getElementById('btn-journal-save');
  const clearBtn = document.getElementById('btn-journal-clear');
  const count = document.getElementById('journal-char-count');
  const entries = document.getElementById('journal-entries');

  if (!textarea || !saveBtn) return;

  function updateCount() {
    if (count) {
  count.textContent = `${textarea.value.length} / 1000`;
}
  }

 function loadEntries() {
  console.log("LOAD ENTRIES RUNNING");

  const data = JSON.parse(
    localStorage.getItem('dreamer_journal')
  ) || {};

  console.log("DATA =", data);

  const saved = data.entries || [];

  console.log("SAVED =", saved);

  entries.innerHTML = '';

  saved.slice().reverse().forEach((entry, index) => {
     console.log("ENTRY =", entry);

    const card = document.createElement('div');
    card.className = 'journal-entry-card journal-reveal';
    card.style.animationDelay = `${index * 0.08}s`;

    card.innerHTML = `
      <div class="journal-entry-date">${entry.date}</div>
      <div class="journal-entry-text">${entry.text}</div>
    `;

    entries.appendChild(card);
  });
}
  saveBtn.addEventListener('click', () => {
    const text = textarea.value.trim();

    if (!text) return;

    const data = JSON.parse(localStorage.getItem('dreamer_journal')) || {};
    const saved = data.entries || [];

saved.push({
  date: new Date().toLocaleDateString(),
  text
});


data.entries = saved;

localStorage.setItem(
  'dreamer_journal',
  JSON.stringify(data)
);

    textarea.value = '';
    updateCount();
    loadEntries();
  });

  textarea.addEventListener('input', updateCount);

  updateCount();
  loadEntries();
  // 👇 ADD THIS HERE
  if (clearBtn) {

    clearBtn.addEventListener('click', () => {

        textarea.value = "";

        updateCount();

        textarea.focus();

    });

}


 textarea.addEventListener('input', updateCount);

updateCount();

loadEntries();
}

/* ============================================================
   HOOK INTO EXISTING TIMER — patch session completion
   We listen for the existing `showCelebration` side-effects
   by observing the celebration overlay becoming visible.
   This way we NEVER touch script.js.
============================================================ */
function hookIntoTimer() {
  const celebrationEl = document.getElementById('celebration');
  if (!celebrationEl) return;

  const observer = new MutationObserver(() => {
    if (celebrationEl.classList.contains('show')) {
       SFX.timerComplete.currentTime = 0;
       SFX.timerComplete.play().catch(() => {});
      // Session completed!
      EXT.totalSessions++;

      // Sync from localStorage (most accurate)
      try {
        const s = JSON.parse(localStorage.getItem('dreamer_stats'));
        if (s) EXT.totalSessions = s.totalSessions || EXT.totalSessions;
      } catch (_) {}

      // Update moon phase
      if (window._setMoonPhase) window._setMoonPhase(EXT.totalSessions);

      // Rank check
      checkRankUp();
      updateRankDisplay();

      // Fire rocket
      setTimeout(() => launchRocket(false), 600);

      // Dispatch for enhanced stats
      document.dispatchEvent(new CustomEvent('dreamer:session-complete'));
    }
  });

  observer.observe(celebrationEl, { attributes: true, attributeFilter: ['class'] });
}

/* ============================================================
   HOOK INTO GOALS — patch goal completion
   MutationObserver on goal list — when a .completed class appears,
   add a constellation star.
============================================================ */
function hookIntoGoals() {
  const goalList = document.getElementById('goal-list');
  if (!goalList) return;

  const observer = new MutationObserver(() => {
    // Check all goals for newly completed ones
    document.querySelectorAll('.goal-item.completed').forEach(item => {
      if (item.dataset.starred) return;
      item.dataset.starred = '1';
      const textEl = item.querySelector('.goal-text-content, .goal-text');
      const label  = textEl ? textEl.textContent.trim() : 'A dream achieved';

      // Add star to constellation
      if (window._addConstellationStar) window._addConstellationStar(label);

      // Launch rocket (from goal side)
      setTimeout(() => launchRocket(true), 300);

      // Bonus points
      EXT.cosmicPoints += 5;
      saveExt();
    });
  });

  observer.observe(goalList, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
}

/* ============================================================
   UPDATE NAV — add Constellation + Journal links
============================================================ */
function updateNav() {
  const navLinks = document.querySelector('.nav-links');
  if (!navLinks) return;
  const links = [
    { href: '#constellation', text: 'Constellation' },
    { href: '#journal',       text: 'Journal'        },
  ];
  links.forEach(({ href, text }) => {
    if (navLinks.querySelector(`a[href="${href}"]`)) return;
    const li = document.createElement('li');
    const a  = document.createElement('a');
    a.href        = href;
    a.textContent = text;
    li.appendChild(a);
    navLinks.appendChild(li);
  });
}

/* ============================================================
   CELEBRATION OVERLAY — wire up close button (if not wired by script.js)
============================================================ */
function wireCelebrationClose() {
  const closeBtn = document.getElementById('btn-celebration-close');
  const overlay  = document.getElementById('celebration');
  if (closeBtn && overlay) {
    closeBtn.addEventListener('click', () => {
      overlay.classList.remove('show');
    });
  }

  // Also hook existing showCelebration if needed
  // We patch the quote into celebration-quote
  const celebQuote = document.getElementById('celebration-quote');
  if (celebQuote && !celebQuote.textContent) {
    celebQuote.textContent = '"Every session brings you closer to your stars."';
  }
}
function applyTheme(theme, playSound = true){
  SFX.theme.currentTime = 0;
  SFX.theme.play().catch(() => {});

  const root = document.documentElement;

  const themes = {

    blue:{
      a:'#4dd9f0',
      b:'#8ffff8'
    },

    purple:{
      a:'#b05cff',
      b:'#ff79ff'
    },

    gold:{
      a:'#ffcf4d',
      b:'#ff8f4d'
    },

    void:{
      a:'#7a5cff',
      b:'#4b2d7f'
    }

  };

  root.style.setProperty('--accent', themes[theme].a);
  root.style.setProperty('--accent2', themes[theme].b);

  localStorage.setItem('dreamer_theme', theme);
}
function initThemes() {

  const panel =
    document.getElementById('theme-panel');

  const toggle =
    document.getElementById('theme-toggle');

  toggle?.addEventListener('click', () => {
    panel?.classList.toggle('show');
  });

  document.querySelectorAll('.theme-btn')
    .forEach(btn => {

      btn.addEventListener('click', () => {

        const theme =
          btn.dataset.theme;

        applyTheme(theme);

      });

    });

  const saved =
    localStorage.getItem('dreamer_theme');

  if(saved){
    applyTheme(saved);
  }
}

/* ============================================================
   MAGICAL STARDUST CURSOR
============================================================ */
function initStardust() {

  const layer = document.getElementById("stardust-layer");
  if (!layer) return;

  let lastSpawn = 0;

  document.addEventListener("mousemove", (e) => {

    const now = performance.now();

    if (now - lastSpawn < 18) return;
    lastSpawn = now;

    const count = 2 + Math.floor(Math.random() * 3);

    for (let i = 0; i < count; i++) {

      const dust = document.createElement("div");
      dust.className = "stardust";

      // Orbit around cursor
      const orbitAngle = Math.random() * Math.PI * 2;
      const radius = 4 + Math.random() * 16;

      const x = e.clientX + Math.cos(orbitAngle) * radius;
      const y = e.clientY + Math.sin(orbitAngle) * radius;

      dust.style.left = x + "px";
      dust.style.top = y + "px";

      dust.style.setProperty(
        "--orbitX",
        Math.cos(orbitAngle) * 30 + "px"
      );

      dust.style.setProperty(
        "--orbitY",
        Math.sin(orbitAngle) * 30 + "px"
      );

      // Symbols
      const shapes = [
        "✦",
        "✧",
        "✶",
        "❋",
        "✷",
        "✨",
        "•",
        "✹"
      ];

      dust.textContent =
        shapes[Math.floor(Math.random() * shapes.length)];

      // Colors
      const colors = [
        "#ffffff",
        "#dff9ff",
        "#9ee7ff",
        "#c77dff",
        "#f5b8ff",
        "#ffe8a3"
      ];

      const color =
        colors[Math.floor(Math.random() * colors.length)];

      dust.style.background = "transparent";
      dust.style.color = color;

      dust.style.fontSize =
        (6 + Math.random() * 10) + "px";

      dust.style.opacity =
        0.5 + Math.random() * 0.5;

      dust.style.display = "flex";
      dust.style.alignItems = "center";
      dust.style.justifyContent = "center";

      dust.style.textShadow = `
        0 0 4px ${color},
        0 0 10px ${color},
        0 0 18px ${color},
        0 0 30px white
      `;

      dust.style.animationDuration =
        (0.7 + Math.random() * 1.3) + "s";

      layer.appendChild(dust);

      setTimeout(() => dust.remove(), 2200);

    }

  });

}
/* ============================================================
   ENHANCEMENT INIT — boot all features
============================================================ */
function initEnhancements() {
  loadExt();
  
  
  initMoon();
  initCosmicBackground();
  initConstellation();
  initCompanion();
  initRankSystem();
  enhanceStats();
  initAchievements();
  console.log("CALLING SHOOTING STARS");
  initShootingStars();
  initSound();
  initJournal();
  initPortal();
  initThemes();
  initGalaxy();
  hookIntoTimer();
  hookIntoGoals();
  updateNav();
  wireCelebrationClose();
  initStardust();

  console.log('%c DREAMER ✦ Enhancements Loaded ', 'background:#4dd9f0;color:#050818;padding:4px 8px;border-radius:4px;font-weight:bold;');
}
const navToggle = document.getElementById("nav-toggle");
const navLinks = document.querySelector(".nav-links");

if (navToggle && navLinks) {

    navToggle.addEventListener("click", () => {

        navLinks.classList.toggle("open");

        navToggle.textContent = navLinks.classList.contains("open")
            ? "✕"
            : "☰";

    });

}
document.querySelectorAll(".nav-links a").forEach(link => {

    link.addEventListener("click", () => {

        navLinks.classList.remove("open");

        navToggle.textContent = "☰";

    });

});

/* Boot after DOM is ready */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initEnhancements);
} else {
  initEnhancements();
}
// Move floating theme button outside the panel
document.addEventListener("DOMContentLoaded", () => {

    const btn = document.getElementById("theme-toggle");

    if (btn) {
        document.body.append(btn);
    }

});
