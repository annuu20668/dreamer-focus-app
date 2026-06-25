/**
 * ============================================================
 *  DREAMER — script.js
 *  Production-ready JavaScript for the DREAMER focus app
 * ============================================================
 *
 *  TABLE OF CONTENTS
 *  -----------------
 *  1.  Constants & State
 *  2.  Utility Helpers
 *  3.  Three.js Cosmic Background
 *  4.  Custom Galaxy Cursor
 *  5.  Hero Animations
 *  6.  Magnetic Buttons
 *  7.  Tilt Cards
 *  8.  Scroll Animations
 *  9.  Quotes System
 * 10.  Pomodoro Timer
 * 11.  Timer Visual Effects
 * 12.  Celebration System
 * 13.  Goals System
 * 14.  Statistics System
 * 15.  Weekly Chart
 * 16.  Init
 * ============================================================
 */

'use strict';

/* ============================================================
   1. CONSTANTS & STATE
   ============================================================ */

// ----- Pomodoro durations (in seconds) -----
const TIMER_MODES = {
  focus:      25 * 60,
  shortBreak:  5 * 60,
  longBreak:  15 * 60,
};

// ----- App state object (single source of truth) -----
const state = {
  // Timer
  timerMode:       'focus',   // 'focus' | 'shortBreak' | 'longBreak'
  timeRemaining:   TIMER_MODES.focus,
  timerRunning:    false,
  timerInterval:   null,
  sessionCount:    0,         // focus sessions since last long-break cycle

  // Stats (persisted to localStorage)
  stats: {
    totalSessions:   0,
    todaySessions:   0,
    focusStreak:     0,
    totalMinutes:    0,
    lastSessionDate: null,
    weeklyData:      [0, 0, 0, 0, 0, 0, 0], // Sun–Sat
  },

  // Goals (persisted to localStorage)
  goals: [],

  // Mouse position (used by Three.js & cursor)
  mouse: { x: 0, y: 0, normX: 0, normY: 0 },
};

// ----- LocalStorage keys -----
const LS_STATS = 'dreamer_stats';
const LS_GOALS = 'dreamer_goals';

/* ============================================================
   2. UTILITY HELPERS
   ============================================================ */

/**
 * Linearly interpolate between a and b by t (0–1).
 * Used for smooth cursor following and magnetic effects.
 */
const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Clamp a number between min and max.
 */
const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

/**
 * Format seconds as MM:SS string.
 */
const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

/**
 * Return today's date string in YYYY-MM-DD format.
 */
const todayStr = () => new Date().toISOString().split('T')[0];

/**
 * Return the day-of-week index (0=Sun … 6=Sat) for today.
 */
const todayDOW = () => new Date().getDay();

/**
 * Save stats to localStorage.
 */
const saveStats = () => {
  localStorage.setItem(LS_STATS, JSON.stringify(state.stats));
};

/**
 * Save goals to localStorage.
 */
const saveGoals = () => {
  localStorage.setItem(LS_GOALS, JSON.stringify(state.goals));
};

/**
 * Load stats from localStorage (with sane defaults).
 */
const loadStats = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_STATS));
    if (saved) {
      // Reset today's sessions if it's a new day
      if (saved.lastSessionDate !== todayStr()) {
        saved.todaySessions = 0;
      }
      state.stats = { ...state.stats, ...saved };
    }
  } catch (e) { /* ignore corrupt data */ }
};

/**
 * Load goals from localStorage.
 */
const loadGoals = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_GOALS));
    if (Array.isArray(saved)) state.goals = saved;
  } catch (e) { /* ignore corrupt data */ }
};

/* ============================================================
   3. THREE.JS COSMIC BACKGROUND
   ============================================================ */

/**
 * Sets up a Three.js scene with:
 *  - Hundreds of star points
 *  - Floating nebula particles
 *  - Subtle camera drift on mouse move
 */
function initCosmos() {
  const canvas = document.getElementById('cosmos-canvas');
  if (!canvas || typeof THREE === 'undefined') return;

  // --- Renderer ---
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // cap at 2× for perf
  renderer.setSize(window.innerWidth, window.innerHeight);

  // --- Scene & Camera ---
  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 5;

  // ---- Stars ----
  // Create 1 500 small star points scattered in 3D space
  const starCount   = 1500;
  const starGeo     = new THREE.BufferGeometry();
  const starPositions = new Float32Array(starCount * 3);
  const starSizes     = new Float32Array(starCount);

  for (let i = 0; i < starCount; i++) {
    starPositions[i * 3]     = (Math.random() - 0.5) * 200; // x
    starPositions[i * 3 + 1] = (Math.random() - 0.5) * 200; // y
    starPositions[i * 3 + 2] = (Math.random() - 0.5) * 200; // z
    starSizes[i]              = Math.random() * 1.5 + 0.5;
  }

  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  starGeo.setAttribute('size',     new THREE.BufferAttribute(starSizes,     1));

  const starMat = new THREE.PointsMaterial({
    color:       0xffffff,
    size:        0.15,
    transparent: true,
    opacity:     0.8,
    sizeAttenuation: true,
  });

  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // ---- Nebula / floating particles ----
  // Fewer, larger, coloured particles for atmosphere
  const nebulaCount = 300;
  const nebulaGeo   = new THREE.BufferGeometry();
  const nebulaPos   = new Float32Array(nebulaCount * 3);
  const nebulaCol   = new Float32Array(nebulaCount * 3); // RGB per vertex

  // Colour palette: purples, blues, magentas
  const palette = [
    [0.6, 0.2, 1.0],
    [0.2, 0.5, 1.0],
    [1.0, 0.2, 0.8],
    [0.4, 0.8, 1.0],
  ];

  for (let i = 0; i < nebulaCount; i++) {
    nebulaPos[i * 3]     = (Math.random() - 0.5) * 100;
    nebulaPos[i * 3 + 1] = (Math.random() - 0.5) * 100;
    nebulaPos[i * 3 + 2] = (Math.random() - 0.5) * 50;

    const col = palette[Math.floor(Math.random() * palette.length)];
    nebulaCol[i * 3]     = col[0];
    nebulaCol[i * 3 + 1] = col[1];
    nebulaCol[i * 3 + 2] = col[2];
  }

  nebulaGeo.setAttribute('position', new THREE.BufferAttribute(nebulaPos, 3));
  nebulaGeo.setAttribute('color',    new THREE.BufferAttribute(nebulaCol, 3));

  const nebulaMat = new THREE.PointsMaterial({
    size:            0.4,
    vertexColors:    true,
    transparent:     true,
    opacity:         0.5,
    sizeAttenuation: true,
    blending:        THREE.AdditiveBlending,
    depthWrite:      false,
  });

  const nebula = new THREE.Points(nebulaGeo, nebulaMat);
  scene.add(nebula);

  // ---- Camera target (smooth mouse drift) ----
  const camTarget = { x: 0, y: 0 };

  // ---- Animation loop ----
  let animFrameId;
  const clock = new THREE.Clock();

  function animate() {
    animFrameId = requestAnimationFrame(animate);
    const elapsed = clock.getElapsedTime();

    // Slowly rotate the starfield
    stars.rotation.y  = elapsed * 0.02;
    stars.rotation.x  = elapsed * 0.005;

    // Nebula drifts slightly
    nebula.rotation.y = elapsed * 0.01;
    nebula.rotation.z = elapsed * 0.005;

    // Smooth camera drift toward mouse position
    camTarget.x = lerp(camTarget.x, state.mouse.normX * 1.5,  0.03);
    camTarget.y = lerp(camTarget.y, -state.mouse.normY * 1.0, 0.03);
    camera.position.x = camTarget.x;
    camera.position.y = camTarget.y;
    camera.lookAt(scene.position);

    renderer.render(scene, camera);
  }

  animate();

  // ---- Resize handler ----
  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  window.addEventListener('resize', onResize);

  // ---- Clean up if needed (SPA navigation, etc.) ----
  // Store cancel fn on canvas for external cleanup
  canvas._destroyCosmos = () => {
    cancelAnimationFrame(animFrameId);
    window.removeEventListener('resize', onResize);
    renderer.dispose();
  };
}

/* ============================================================
   4. CUSTOM GALAXY CURSOR
   ============================================================ */

/**
 * Replaces the OS cursor with:
 *  - A small dot that snaps to the mouse
 *  - A larger ring that follows with elastic delay
 *  - A particle trail that fades out
 *  - Sparkle burst on click
 */
function initCursor() {
  const dot  = document.querySelector('.cursor-dot');
  const ring = document.querySelector('.cursor-ring');

  // Bail gracefully if elements are missing or on touch devices
  if (!dot || !ring || window.matchMedia('(pointer: coarse)').matches) return;

  let ringX = 0, ringY = 0;
  let mouseX = 0, mouseY = 0;
  let isHovering = false;

  // ---- Trail particles pool ----
  // We reuse a fixed pool instead of creating DOM nodes every frame
  const TRAIL_MAX   = 18;
  const trailPool   = [];

  for (let i = 0; i < TRAIL_MAX; i++) {
    const p = document.createElement('div');
    p.className = 'cursor-trail-particle';
    Object.assign(p.style, {
      position:       'fixed',
      pointerEvents:  'none',
      borderRadius:   '50%',
      zIndex:         '9998',
      opacity:        '0',
      transform:      'translate(-50%, -50%)',
    });
    document.body.appendChild(p);
    trailPool.push({ el: p, x: 0, y: 0, life: 0 });
  }

  let trailIndex = 0;
  let lastTrailX = 0, lastTrailY = 0;

  // ---- Mouse move ----
  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;

    // Snap dot immediately
    dot.style.left = mouseX + 'px';
    dot.style.top  = mouseY  + 'px';

    // Store normalised coords for Three.js camera drift
    state.mouse.x     = e.clientX;
    state.mouse.y     = e.clientY;
    state.mouse.normX = (e.clientX / window.innerWidth)  * 2 - 1;
    state.mouse.normY = (e.clientY / window.innerHeight) * 2 - 1;

    // Spawn trail particle if mouse moved enough
    const dx = mouseX - lastTrailX;
    const dy = mouseY - lastTrailY;
    if (Math.sqrt(dx * dx + dy * dy) > 8) {
      spawnTrailParticle(mouseX, mouseY);
      lastTrailX = mouseX;
      lastTrailY = mouseY;
    }
  });

  // ---- Spawn one trail particle from pool ----
  function spawnTrailParticle(x, y) {
    const p    = trailPool[trailIndex % TRAIL_MAX];
    trailIndex++;

    const size = Math.random() * 6 + 3;
    const hue  = Math.random() * 60 + 260; // purples / blues

    p.x    = x;
    p.y    = y;
    p.life = 1;

    Object.assign(p.el.style, {
      left:    x + 'px',
      top:     y + 'px',
      width:   size + 'px',
      height:  size + 'px',
      background: `hsla(${hue}, 100%, 70%, 1)`,
      boxShadow:  `0 0 ${size * 2}px hsla(${hue}, 100%, 70%, 0.6)`,
      opacity:    '1',
    });
  }

  // ---- Hover states for interactive elements ----
  const interactiveSelector = 'a, button, [data-magnetic], input, textarea, label, .goal-item';
  document.addEventListener('mouseover', (e) => {
    if (e.target.closest(interactiveSelector)) {
      isHovering = true;
      dot.classList.add('cursor-hover');
      ring.classList.add('cursor-hover');
    }
  });
  document.addEventListener('mouseout', (e) => {
    if (e.target.closest(interactiveSelector)) {
      isHovering = false;
      dot.classList.remove('cursor-hover');
      ring.classList.remove('cursor-hover');
    }
  });

  // ---- Sparkle on click ----
  document.addEventListener('click', (e) => {
    spawnSparkle(e.clientX, e.clientY);
  });

  function spawnSparkle(x, y) {
    const count = 8;
    for (let i = 0; i < count; i++) {
      const spark = document.createElement('div');
      const angle = (i / count) * Math.PI * 2;
      const dist  = Math.random() * 30 + 15;
      const size  = Math.random() * 5 + 3;
      const hue   = Math.random() * 80 + 240;

      Object.assign(spark.style, {
        position:      'fixed',
        pointerEvents: 'none',
        zIndex:        '9999',
        left:          x + 'px',
        top:           y + 'px',
        width:         size + 'px',
        height:        size + 'px',
        borderRadius:  '50%',
        background:    `hsl(${hue}, 100%, 70%)`,
        transform:     'translate(-50%, -50%)',
        transition:    'transform 0.5s ease-out, opacity 0.5s ease-out',
      });

      document.body.appendChild(spark);

      // Force reflow then animate outward
      requestAnimationFrame(() => {
        spark.style.transform  = `translate(calc(-50% + ${Math.cos(angle) * dist}px), calc(-50% + ${Math.sin(angle) * dist}px)) scale(0)`;
        spark.style.opacity    = '0';
      });

      setTimeout(() => spark.remove(), 600);
    }
  }

  // ---- RAF loop: ring follows mouse, trail fades ----
  function cursorLoop() {
    requestAnimationFrame(cursorLoop);

    // Elastic ring follow
    ringX = lerp(ringX, mouseX, 0.12);
    ringY = lerp(ringY, mouseY, 0.12);
    ring.style.left = ringX + 'px';
    ring.style.top  = ringY + 'px';

    // Scale ring on hover
    ring.style.transform = isHovering
      ? 'translate(-50%, -50%) scale(1.6)'
      : 'translate(-50%, -50%) scale(1)';

    // Fade trail particles
    for (const p of trailPool) {
      if (p.life > 0) {
        p.life -= 0.06;
        p.el.style.opacity = Math.max(0, p.life).toString();
      }
    }
  }

  cursorLoop();
}

/* ============================================================
   5. HERO ANIMATIONS
   ============================================================ */

/**
 * Animates the DREAMER letters, tagline and CTA buttons on page load.
 * Uses pure CSS class toggling + staggered timeouts — no GSAP required
 * for this section (keeping dependency footprint small).
 */
function initHeroAnimations() {
  // ---- Split DREAMER into individual letter spans ----
  const titleEl = document.querySelector('.dreamer-title, .hero-title, [data-dreamer-title]');

  if (titleEl) {
    const text = titleEl.textContent.trim();
    titleEl.innerHTML = text
      .split('')
      .map((ch, i) => `<span class="dreamer-letter" style="--i:${i}">${ch === ' ' ? '&nbsp;' : ch}</span>`)
      .join('');

    // Trigger letter animation after a short delay
    setTimeout(() => {
      document.querySelectorAll('.dreamer-letter').forEach((el, i) => {
        setTimeout(() => el.classList.add('visible'), i * 80);
      });
    }, 300);
  }

  // ---- Tagline fade in ----
  const tagline = document.querySelector('.hero-tagline, .tagline, [data-tagline]');
  if (tagline) {
    tagline.style.opacity   = '0';
    tagline.style.transform = 'translateY(20px)';
    tagline.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
    setTimeout(() => {
      tagline.style.opacity   = '1';
      tagline.style.transform = 'translateY(0)';
    }, 900);
  }

  // ---- Buttons fade in ----
  const heroBtns = document.querySelectorAll('.hero-buttons .btn, .hero-cta .btn, .hero .magnetic-btn');
  heroBtns.forEach((btn, i) => {
    btn.style.opacity   = '0';
    btn.style.transform = 'translateY(20px)';
    btn.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    setTimeout(() => {
      btn.style.opacity   = '1';
      btn.style.transform = 'translateY(0)';
    }, 1200 + i * 150);
  });

  // ---- Inject required CSS for letter animation if not already in stylesheet ----
  if (!document.getElementById('dreamer-letter-styles')) {
    const style = document.createElement('style');
    style.id = 'dreamer-letter-styles';
    style.textContent = `
      .dreamer-letter {
        display:         inline-block;
        opacity:         0;
        transform:       translateY(40px) rotateX(-90deg);
        transition:      opacity 0.5s ease calc(var(--i) * 0.05s),
                         transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) calc(var(--i) * 0.05s);
      }
      .dreamer-letter.visible {
        opacity:   1;
        transform: translateY(0) rotateX(0deg);
      }
    `;
    document.head.appendChild(style);
  }
}

/* ============================================================
   6. MAGNETIC BUTTONS
   ============================================================ */

/**
 * Gives buttons a subtle "magnetic pull" toward the cursor.
 * Works on any element with the class `.magnetic-btn` or `[data-magnetic]`.
 */
function initMagneticButtons() {
  const magnets = document.querySelectorAll('.magnetic-btn, [data-magnetic]');

  magnets.forEach((magnet) => {
    const STRENGTH = 0.35; // How strongly the button moves (0 = no movement, 1 = full follow)

    magnet.addEventListener('mousemove', (e) => {
      const rect    = magnet.getBoundingClientRect();
      const centerX = rect.left + rect.width  / 2;
      const centerY = rect.top  + rect.height / 2;
      const deltaX  = (e.clientX - centerX) * STRENGTH;
      const deltaY  = (e.clientY - centerY) * STRENGTH;

      magnet.style.transform    = `translate(${deltaX}px, ${deltaY}px)`;
      magnet.style.transition   = 'transform 0.1s ease';
    });

    magnet.addEventListener('mouseleave', () => {
      // Smoothly return to original position
      magnet.style.transform  = 'translate(0, 0)';
      magnet.style.transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    });
  });
}

/* ============================================================
   7. TILT CARDS
   ============================================================ */

/**
 * Adds a 3-D perspective tilt effect to `.tilt-card` elements.
 * The card tilts to follow the mouse while hovered.
 */
function initTiltCards() {
  const cards = document.querySelectorAll('.tilt-card, .stat-card, .stats-card');

  cards.forEach((card) => {
    const MAX_TILT = 15; // degrees

    card.addEventListener('mousemove', (e) => {
      const rect    = card.getBoundingClientRect();
      // Normalise mouse position within card to -1 … +1
      const nx = ((e.clientX - rect.left) / rect.width)  * 2 - 1;
      const ny = ((e.clientY - rect.top)  / rect.height) * 2 - 1;

      const rotateY =  nx * MAX_TILT;
      const rotateX = -ny * MAX_TILT;

      card.style.transform  = `perspective(600px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.04, 1.04, 1.04)`;
      card.style.transition = 'transform 0.05s ease';
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform  = 'perspective(600px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
      card.style.transition = 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    });
  });
}

/* ============================================================
   8. SCROLL ANIMATIONS
   ============================================================ */

/**
 * Reveals sections as the user scrolls using IntersectionObserver
 * (with optional GSAP ScrollTrigger enhancement when GSAP is loaded).
 */
function initScrollAnimations() {
  // ---- Apply initial hidden state ----
  const revealEls = document.querySelectorAll(
    '.section, .timer-section, .stats-section, .goals-section, .galaxy-section, section'
  );

  revealEls.forEach((el) => {
    // Don't hide the hero
    if (el.classList.contains('hero') || el.dataset.noReveal !== undefined) return;
    el.style.opacity   = '0';
    el.style.transform = 'translateY(40px)';
    el.style.transition = 'opacity 0.7s ease, transform 0.7s ease';
  });

  // ---- IntersectionObserver fallback (always works) ----
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.style.opacity   = '1';
        entry.target.style.transform = 'translateY(0)';
        observer.unobserve(entry.target); // Only animate once
      }
    });
  }, { threshold: 0.12 });

  revealEls.forEach((el) => {
    if (!el.classList.contains('hero')) observer.observe(el);
  });

  // ---- GSAP ScrollTrigger enhancement (if available) ----
  if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);

    // Stagger children inside each section
    document.querySelectorAll('.stat-card, .goal-item, .week-bar').forEach((el, i) => {
      gsap.fromTo(el,
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: el,
            start:   'top 90%',
            once:    true,
          },
        }
      );
    });
  }
}

/* ============================================================
   9. QUOTES SYSTEM
   ============================================================ */

const QUOTES = [
  "The cosmos is within us. We are made of star-stuff.",
  "Reach for the stars — they are closer than your doubts.",
  "Every second of focus is a step toward your galaxy.",
  "Stars don't compete with each other. They just shine.",
  "Your mind is the universe expanding.",
  "Small consistent actions create astronomical change.",
  "The universe rewards those who dare to begin.",
  "In the silence of focus, galaxies are born.",
  "You are the author of your own constellation.",
  "Dream bigger than the sky — then build a rocket.",
  "The brightest stars burn with purpose.",
  "One focused hour outlasts a scattered day.",
  "Your potential is as limitless as the universe itself.",
  "Momentum is the gravity of achievement.",
  "Every master was once a beginner staring at the stars.",
  "Create so fiercely that the universe takes notice.",
  "Rest is not surrender — it's refuelling for the journey.",
  "You don't find your path. You create it, star by star.",
  "The only limits that exist are the ones you believe.",
  "Today's focus is tomorrow's breakthrough.",
];

/**
 * Return a random quote string.
 */
function getRandomQuote() {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)];
}

/**
 * Update all quote display elements on the page.
 */
function updateQuoteDisplays(quote) {
  const targets = document.querySelectorAll(
    '.quote-text, .motivation-quote, [data-quote-display], .galaxy-quote'
  );
  targets.forEach((el) => {
    el.style.opacity   = '0';
    el.style.transition = 'opacity 0.4s ease';
    setTimeout(() => {
      el.textContent   = `"${quote}"`;
      el.style.opacity = '1';
    }, 400);
  });
}

/**
 * Rotate quotes in the Motivation Galaxy section every 8 seconds.
 */
function initQuoteRotation() {
  updateQuoteDisplays(getRandomQuote());
  setInterval(() => {
    updateQuoteDisplays(getRandomQuote());
  }, 8000);
}

/* ============================================================
   10. POMODORO TIMER
   ============================================================ */

/**
 * Initialises the full Pomodoro timer:
 *  - Mode switching (Focus / Short Break / Long Break)
 *  - Start / Pause / Reset / Skip buttons
 *  - SVG progress circle
 *  - Updates the document title
 */
function initTimer() {
  // ---- Grab DOM elements ----
  const displayEl  = document.querySelector('.timer-display, .time-display, [data-timer-display]');
  const startBtn = document.querySelector('[data-start], .start-btn, #start-btn, #btn-play');
  console.log("START BTN =", startBtn);
  const pauseBtn = document.querySelector('[data-pause], .pause-btn, #pause-btn');
  const resetBtn = document.querySelector('[data-reset], .reset-btn, #reset-btn, #btn-reset');
  const skipBtn  = document.querySelector('[data-skip], .skip-btn, #skip-btn, #btn-skip');
  const modeBtns   = document.querySelectorAll('[data-mode]');
  const progressEl = document.querySelector('.timer-progress, circle.progress, [data-progress-circle]');
  const modeLabel  = document.querySelector('.timer-mode-label, .mode-label, [data-mode-label]');
  const playIcon = document.querySelector('.icon-play');
  const pauseIcon = document.querySelector('.icon-pause');
  // SVG circle circumference (r=90 is common; adjust if your SVG differs)
  let circleCircumference = 0;
  if (progressEl) {
    const r = parseFloat(progressEl.getAttribute('r') || 90);
    circleCircumference   = 2 * Math.PI * r;
    progressEl.style.strokeDasharray  = circleCircumference;
    progressEl.style.strokeDashoffset = '0';
  }

  // ---- Helper: set progress circle ----
  function setProgress(fraction) {
    if (!progressEl) return;
    // fraction 1 = full circle, 0 = empty
    const offset = circleCircumference * (1 - fraction);
    progressEl.style.strokeDashoffset = offset;
  }

  // ---- Helper: render the current time ----
  function renderTime() {
    const display = formatTime(state.timeRemaining);
    if (displayEl) displayEl.textContent = display;

    // Update browser tab title during focus sessions
    if (state.timerMode === 'focus' && state.timerRunning) {
      document.title = `${display} — DREAMER`;
    } else {
      document.title = 'DREAMER';
    }

    // Update progress circle
    const total    = TIMER_MODES[state.timerMode];
    const fraction = state.timeRemaining / total;
    setProgress(fraction);
  }

  // ---- Helper: switch timer mode ----
  function switchMode(mode) {
    console.log("SWITCHING TO:", mode);
    stopTimer();
    state.timerMode      = mode;
    state.timeRemaining  = TIMER_MODES[mode];

    // Update active button style
    modeBtns.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    // Update label
    const labels = { focus: 'Focus', shortBreak: 'Short Break', longBreak: 'Long Break' };
    if (modeLabel) modeLabel.textContent = labels[mode] || mode;

    renderTime();
    setTimerVisualState(false);
  }

  // ---- Start timer ----
  function startTimer() {
     console.log("START CLICKED");
    if (state.timerRunning) return;
    state.timerRunning = true;
    if (playIcon) playIcon.classList.add('hidden');
    if (pauseIcon) pauseIcon.classList.remove('hidden'); 

    //if (startBtn) startBtn.disabled = true;
    if (pauseBtn) pauseBtn.disabled = false;

    setTimerVisualState(true);

    // Show a focus quote when session starts
    if (state.timerMode === 'focus') {
      updateQuoteDisplays(getRandomQuote());
    }

    state.timerInterval = setInterval(() => {
      state.timeRemaining--;

      if (state.timeRemaining <= 0) {
        onTimerComplete();
      } else {
        renderTime();
      }
    }, 1000);
  }

  // ---- Pause timer ----
  function pauseTimer() {
    if (!state.timerRunning) return;
    clearInterval(state.timerInterval);
    state.timerRunning = false;
    if (playIcon) playIcon.classList.remove('hidden');
    if (pauseIcon) pauseIcon.classList.add('hidden'); 

    if (startBtn) startBtn.disabled = false;
    if (pauseBtn) pauseBtn.disabled = true;

    setTimerVisualState(false);
  }

  // ---- Stop (internal, no UI changes) ----
  function stopTimer() {
    clearInterval(state.timerInterval);
    state.timerRunning = false;
    if (startBtn) startBtn.disabled = false;
    if (pauseBtn) pauseBtn.disabled = true;
  }

  // ---- Reset timer ----
  function resetTimer() {
    stopTimer();
    state.timeRemaining = TIMER_MODES[state.timerMode];
    renderTime();
    setProgress(1);
    setTimerVisualState(false);
  }

  // ---- Skip to next mode ----
  function skipTimer() {
    stopTimer();

    if (state.timerMode === 'focus') {
    switchMode('shortBreak');
   } else if (state.timerMode === 'shortBreak') {
    switchMode('longBreak');
   } else {
    switchMode('focus');
   }
}

  // ---- When a session completes ----
  function onTimerComplete() {
    clearInterval(state.timerInterval);
    state.timerRunning = false;
    state.timeRemaining = 0;
    renderTime();
    setTimerVisualState(false);

    if (state.timerMode === 'focus') {
      // Record the session
      recordSession();
      // Show celebration
      showCelebration();
      // After celebration, auto-skip to break
      setTimeout(() => skipTimer(), 5000);
    } else {
      // Break ended — switch back to focus
      setTimeout(() => switchMode('focus'), 1500);
    }
  }

  // ---- Wire up buttons ----
  if (startBtn) {
   startBtn.addEventListener('click', () => {

    if (state.timerRunning) {

      pauseTimer();

    } else {

      SFX.start.currentTime = 0;
      SFX.start.play().catch(() => {});

      startTimer();

    }

  });
}
  
  if (pauseBtn) {
    pauseBtn.disabled = true;
    pauseBtn.addEventListener('click', pauseTimer);
  }
  if (resetBtn) resetBtn.addEventListener('click', resetTimer);
  if (skipBtn)  skipBtn.addEventListener('click',  skipTimer);

  modeBtns.forEach((btn) => {
    btn.addEventListener('click', () => switchMode(btn.dataset.mode));
  });

  // ---- Initial render ----
  renderTime();
  setProgress(1);
}

/* ============================================================
   11. TIMER VISUAL EFFECTS
   ============================================================ */

/**
 * Enhances the timer orb visually when the timer is running.
 * Adds/removes a CSS class `.timer-active` that your CSS can hook into
 * for pulsing rings, glow effects, etc.
 */
function setTimerVisualState(isRunning) {
  const orb      = document.querySelector('.timer-orb, .orb, [data-orb]');
  const timerSec = document.querySelector('.timer-section, .timer-container');
  const rings    = document.querySelectorAll('.orb-ring, .timer-ring');

  if (orb)      orb.classList.toggle('timer-active', isRunning);
  if (timerSec) timerSec.classList.toggle('timer-active', isRunning);

  rings.forEach((ring) => ring.classList.toggle('pulse-fast', isRunning));

  // Inject dynamic CSS for the active timer glow (if not already present)
  if (!document.getElementById('timer-active-styles')) {
    const s = document.createElement('style');
    s.id = 'timer-active-styles';
    s.textContent = `
      .timer-active .timer-orb,
      .orb.timer-active {
        filter: brightness(1.3) drop-shadow(0 0 30px rgba(139, 92, 246, 0.9));
      }
      .orb-ring.pulse-fast,
      .timer-ring.pulse-fast {
        animation-duration: 1.2s !important;
      }
      .timer-section.timer-active {
        background: radial-gradient(ellipse at 50% 40%, rgba(139,92,246,0.12) 0%, transparent 70%);
        transition: background 1s ease;
      }
    `;
    document.head.appendChild(s);
  }
}

/* ============================================================
   12. CELEBRATION SYSTEM
   ============================================================ */

/**
 * Shows a full-screen celebration overlay with:
 *  - A motivational quote
 *  - Confetti particle burst
 *  - Auto-dismiss after a few seconds
 */
function showCelebration() {
  SFX.timerComplete.currentTime = 0;
  SFX.timerComplete.play().catch(() => {});
  const overlay  = document.querySelector('.celebration-overlay, [data-celebration]');
  const quoteEl  = document.querySelector('.celebration-quote, [data-celebration-quote]');

  const quote = getRandomQuote();

  if (quoteEl) quoteEl.textContent = `"${quote}"`;

  if (overlay) {
    overlay.classList.add('visible');
    overlay.style.display   = 'flex';
    overlay.style.opacity   = '0';
    overlay.style.transition = 'opacity 0.5s ease';
    requestAnimationFrame(() => { overlay.style.opacity = '1'; });

    // Hide after 4.5 seconds
    setTimeout(() => {
      overlay.style.opacity = '0';
      setTimeout(() => {
        overlay.style.display = 'none';
        overlay.classList.remove('visible');
      }, 500);
    }, 4500);
  }

  // Particle confetti burst
  launchConfetti();

  // Update quote in motivation section
  updateQuoteDisplays(quote);
}

/**
 * Launches a burst of coloured confetti particles.
 * Each particle is a small div that flies outward and fades.
 */
function launchConfetti() {
  const PARTICLE_COUNT = 60;
  const colors = ['#a855f7', '#6366f1', '#ec4899', '#06b6d4', '#f59e0b', '#10b981'];

  const container = document.body;
  const originX   = window.innerWidth  / 2;
  const originY   = window.innerHeight / 2;

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const el    = document.createElement('div');
    const color = colors[Math.floor(Math.random() * colors.length)];
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 200 + 80;
    const size  = Math.random() * 10 + 5;

    Object.assign(el.style, {
      position:      'fixed',
      pointerEvents: 'none',
      zIndex:        '10000',
      left:          originX + 'px',
      top:           originY + 'px',
      width:         size + 'px',
      height:        size + 'px',
      borderRadius:  Math.random() > 0.5 ? '50%' : '2px',
      background:    color,
      transform:     'translate(-50%, -50%)',
      transition:    `transform ${0.6 + Math.random() * 0.8}s ease-out, opacity ${0.6 + Math.random() * 0.8}s ease-out`,
    });

    container.appendChild(el);

    // Animate outward on next frame
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const tx = Math.cos(angle) * speed;
        const ty = Math.sin(angle) * speed + Math.random() * 80; // slight gravity
        el.style.transform = `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) rotate(${Math.random() * 360}deg) scale(0)`;
        el.style.opacity   = '0';
      });
    });

    // Remove from DOM after animation
    setTimeout(() => el.remove(), 1600);
  }
}

/* ============================================================
   13. GOALS SYSTEM
   ============================================================ */

/**
 * Full CRUD goals system backed by localStorage.
 */
function initGoals() {
  loadGoals();

  const input   = document.querySelector('.goal-input, #goal-input, [data-goal-input]');
  const addBtn = document.querySelector(
  '.btn-add-goal, #btn-add-goal, [data-add-goal]');

  const listEl = document.querySelector(
  '.goal-list, #goal-list, [data-goals-list]');

  if (!listEl) return;

  // ---- Render all goals ----
  function renderGoals() {
    listEl.innerHTML = '';

    if (state.goals.length === 0) {
      listEl.innerHTML = '<p class="goals-empty" style="opacity:0.5;text-align:center;padding:1rem;">No goals yet — add one above ✨</p>';
      return;
    }

    state.goals.forEach((goal, index) => {
      const item = document.createElement('div');
      item.className = `goal-item ${goal.completed ? 'completed' : ''}`;
      item.dataset.index = index;

      item.innerHTML = `
        <button class="goal-check" aria-label="Complete goal" title="Mark complete">
          ${goal.completed ? '✓' : '○'}
        </button>
        <span class="goal-text">${escapeHtml(goal.text)}</span>
        <button class="goal-delete" aria-label="Delete goal" title="Delete">✕</button>
      `;

      // Complete goal
      // Complete goal
item.querySelector('.goal-check').addEventListener('click', () => {

  state.goals[index].completed = !state.goals[index].completed;

  // Play sound only when completing a goal
  if (state.goals[index].completed) {
    SFX.goalComplete.currentTime = 0;
    SFX.goalComplete.play().catch(() => {});
  }

  saveGoals();
  renderGoals();

});

      // Delete goal
      item.querySelector('.goal-delete').addEventListener('click', () => {
        state.goals.splice(index, 1);
        saveGoals();
        renderGoals();
      });

      listEl.appendChild(item);
    });
  }

  // ---- Add a goal ----
  function addGoal() {
    const text = input ? input.value.trim() : '';
    if (!text) return;

    state.goals.push({ text, completed: false, createdAt: Date.now() });
    saveGoals();
    if (input) input.value = '';
    renderGoals();
  }

  if (addBtn)  addBtn.addEventListener('click', addGoal);
  if (input)   input.addEventListener('keydown', (e) => { if (e.key === 'Enter') addGoal(); });

  renderGoals();

  // ---- Goal input inline styles (safety net) ----
  if (!document.getElementById('goal-styles')) {
    const s = document.createElement('style');
    s.id = 'goal-styles';
    s.textContent = `
      .goal-item { display:flex; align-items:center; gap:0.75rem; padding:0.75rem 1rem;
                   border-radius:0.5rem; margin-bottom:0.5rem;
                   background:rgba(255,255,255,0.05); transition:background 0.2s; }
      .goal-item.completed .goal-text { text-decoration:line-through; opacity:0.5; }
      .goal-check, .goal-delete {
        background:none; border:none; cursor:pointer; color:inherit;
        font-size:1.1rem; flex-shrink:0; opacity:0.7; transition:opacity 0.2s; }
      .goal-check:hover, .goal-delete:hover { opacity:1; }
      .goal-text { flex:1; font-size:0.95rem; }
      .goal-delete { color: #f87171; }
    `;
    document.head.appendChild(s);
  }
}

/**
 * Escape HTML to prevent XSS in goal text.
 */
function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (ch) => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[ch]));
}

/* ============================================================
   14. STATISTICS SYSTEM
   ============================================================ */

/**
 * Records a completed focus session and updates all stat displays.
 */
function recordSession() {
  const today = todayStr();
  const dow   = todayDOW();

  // Update stats
  state.stats.totalSessions++;
  state.stats.totalMinutes += 25;

  // Today's sessions
  if (state.stats.lastSessionDate === today) {
    state.stats.todaySessions++;
    state.stats.focusStreak = Math.max(state.stats.focusStreak, state.stats.todaySessions);
  } else {
    state.stats.todaySessions    = 1;
    // Streak resets if a day was skipped (simple check)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().split('T')[0];
    if (state.stats.lastSessionDate !== yStr) {
      state.stats.focusStreak = 1;
    } else {
      state.stats.focusStreak++;
    }
  }

  state.stats.lastSessionDate = today;

  // Weekly data — accumulate minutes (or sessions, as you prefer)
  if (!Array.isArray(state.stats.weeklyData)) {
    state.stats.weeklyData = [0, 0, 0, 0, 0, 0, 0];
  }
  state.stats.weeklyData[dow]++;

  saveStats();
  renderStats();
  renderWeeklyChart();
}

/**
 * Render stat numbers into the DOM.
 */
function renderStats() {
  const map = {
    '[data-stat="total"]':   state.stats.totalSessions,
    '[data-stat="today"]':   state.stats.todaySessions,
    '[data-stat="streak"]':  state.stats.focusStreak,
    '[data-stat="minutes"]': state.stats.totalMinutes,
    '.stat-total-sessions':  state.stats.totalSessions,
    '.stat-today-sessions':  state.stats.todaySessions,
    '.stat-streak':          state.stats.focusStreak,
    '.stat-total-minutes':   state.stats.totalMinutes,
    '#stat-total':           state.stats.totalSessions,
    '#stat-today':           state.stats.todaySessions,
    '#stat-streak':          state.stats.focusStreak,
    '#stat-minutes':         state.stats.totalMinutes,
  };

  Object.entries(map).forEach(([selector, value]) => {
    document.querySelectorAll(selector).forEach((el) => {
      // Animate counter
      animateCounter(el, value);
    });
  });
}

/**
 * Smoothly animates a number from its current displayed value to `target`.
 */
function animateCounter(el, target) {
  const start    = parseInt(el.textContent) || 0;
  const duration = 600; // ms
  const startTime = performance.now();

  function step(now) {
    const elapsed  = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const ease     = 1 - Math.pow(1 - progress, 3); // cubic ease-out
    el.textContent = Math.round(start + (target - start) * ease);
    if (progress < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

/* ============================================================
   15. WEEKLY CHART
   ============================================================ */

/**
 * Generates or updates the weekly activity bar chart.
 * Looks for a `.weekly-chart` container and populates it with bars.
 */
function renderWeeklyChart() {
  const chartEl = document.querySelector('.weekly-chart, #weekly-chart, [data-weekly-chart]');
  if (!chartEl) return;

  const days   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const data   = state.stats.weeklyData || [0, 0, 0, 0, 0, 0, 0];
  const maxVal = Math.max(...data, 1); // avoid division by zero
  const today  = todayDOW();

  chartEl.innerHTML = '';
  chartEl.style.display        = 'flex';
  chartEl.style.alignItems     = 'flex-end';
  chartEl.style.gap            = '0.4rem';
  chartEl.style.height         = '100px';
  chartEl.style.padding        = '0 0.5rem';

  data.forEach((val, i) => {
    const col = document.createElement('div');
    col.style.display        = 'flex';
    col.style.flexDirection  = 'column';
    col.style.alignItems     = 'center';
    col.style.flex           = '1';
    col.style.gap            = '0.25rem';

    const bar = document.createElement('div');
    const pct = (val / maxVal) * 75; // max height in px
    bar.className = 'week-bar';
    Object.assign(bar.style, {
      width:        '100%',
      height:       Math.max(pct, 4) + 'px',
      borderRadius: '4px 4px 0 0',
      background:   i === today
        ? 'linear-gradient(180deg, #a855f7, #6366f1)'
        : 'rgba(255,255,255,0.15)',
      transition:   'height 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      cursor:       'default',
      title:        `${val} session${val !== 1 ? 's' : ''}`,
    });

    const label = document.createElement('span');
    label.textContent   = days[i];
    label.style.fontSize = '0.65rem';
    label.style.opacity  = i === today ? '1' : '0.5';
    label.style.color    = 'inherit';

    col.appendChild(bar);
    col.appendChild(label);
    chartEl.appendChild(col);
  });
}

/* ============================================================
   16. INIT — Wire everything together
   ============================================================ */

/**
 * Main entry point. Called when the DOM is ready.
 */
function init() {
  console.log("INIT TIMER RUNNING");
  // Load persisted data first
  loadStats();
  loadGoals();

  // ---- Boot sequence ----
  initCosmos();            // Three.js starfield
  //initCursor();            // Custom galaxy cursor
  initHeroAnimations();    // DREAMER letter reveal
  initMagneticButtons();   // Magnetic pull on buttons
  initTiltCards();         // 3-D tilt on stat cards
  initScrollAnimations();  // Scroll reveal
  initQuoteRotation();     // Rotating motivation quotes
  initTimer();             // Pomodoro timer
  initGoals();             // Goals CRUD
  renderStats();           // Initial stat render
  renderWeeklyChart();     // Weekly activity chart

  // ---- Global mouse tracker (used by Three.js camera) ----
  // initCursor already handles mouse tracking — this is a fallback
  // for pages that don't include cursor elements.
  if (!document.querySelector('.cursor-dot')) {
    document.addEventListener('mousemove', (e) => {
      state.mouse.normX = (e.clientX / window.innerWidth)  * 2 - 1;
      state.mouse.normY = (e.clientY / window.innerHeight) * 2 - 1;
    });
  }

  // ---- Smooth scroll for anchor links ----
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  console.log('%c DREAMER ✦ Initialised ', 'background:#6366f1;color:#fff;padding:4px 8px;border-radius:4px;font-weight:bold;');
}

// ---- DOMContentLoaded guard ----
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  // DOM already ready (script loaded with defer/async)
  init();
}