/**
 * ============================================================
 *  DREAMER — moon.js
 *  Living Moon System — completely standalone.
 *  Reads dreamer_stats from localStorage (read-only).
 *  Never touches timer, goals, state, or any existing code.
 * ============================================================
 */

'use strict';

(function MoonSystem() {

  /* ----------------------------------------------------------
     CONFIGURATION
     Tweak these numbers to adjust moon behaviour.
  ---------------------------------------------------------- */
  const CONFIG = {
    dustParticleCount: 24,      // Number of floating dust particles
    dustMinSize:        1,      // px — smallest dust particle
    dustMaxSize:        3.5,    // px — largest dust particle
    dustOrbitRadius:  140,      // px — how far from centre dust spawns
    dustOrbitSpread:   70,      // px — randomness in orbit radius
    parallaxStrength:  22,      // px — how far moon shifts on mouse move
    parallaxDamping:    0.06,   // 0-1 — lower = more lag (smoother)
  };

  /* ----------------------------------------------------------
     PHASE DEFINITIONS
     Each phase maps to:
       label    — shown below the moon
       clip     — clip-path on the shadow overlay
                  (controls how much dark shadow covers the face)
       sessions — minimum sessions required to reach this phase
  ---------------------------------------------------------- */
  const PHASES = [
    {
      label:    '🌑 New Moon',
      // Shadow covers entire face
      clip:     'ellipse(52% 52% at 50% 50%)',
      sessions: 0,
    },
    {
      label:    '🌒 Waxing Crescent',
      // Shadow shifted right — thin crescent visible on left
      clip:     'ellipse(52% 52% at 78% 50%)',
      sessions: 5,
    },
    {
      label:    '🌓 Half Moon',
      // Shadow covers right half only
      clip:     'ellipse(52% 52% at 100% 50%)',
      sessions: 10,
    },
    {
      label:    '🌔 Gibbous Moon',
      // Shadow is a thin sliver on the right
      clip:     'ellipse(20% 52% at 110% 50%)',
      sessions: 20,
    },
    {
      label:    '🌕 Full Moon',
      // No shadow — fully lit
      clip:     'ellipse(0% 0% at 50% 50%)',
      sessions: 30,
    },
  ];

  /* ----------------------------------------------------------
     STATE
  ---------------------------------------------------------- */
  // Current parallax target and rendered position
  const parallax = { targetX: 0, targetY: 0, currentX: 0, currentY: 0 };

  // Whether the RAF loop is already running
  let loopRunning = false;

  /* ----------------------------------------------------------
     DOM REFERENCES
  ---------------------------------------------------------- */
  let moonSystem, moonBody, moonShadow, phaseLabel, dustField;

  /* ----------------------------------------------------------
     INIT — entry point
  ---------------------------------------------------------- */
  function init() {
    moonSystem  = document.getElementById('moon-system');
    moonBody    = document.getElementById('moon-body');
    moonShadow  = document.getElementById('moon-shadow');
    phaseLabel  = document.getElementById('moon-phase-label');
    dustField   = document.getElementById('moon-dust-field');

    // Bail silently if the HTML hasn't been added yet
    if (!moonSystem) {
      console.warn('[Moon] #moon-system not found. Add the HTML snippet to #hero.');
      return;
    }

    buildDustParticles();
    applyPhaseFromStorage();
    bindMouseParallax();
    startParallaxLoop();
    watchForSessionUpdates();

    console.log('%c 🌙 Moon System ready ', 'background:#3a2480;color:#f4f0ff;padding:2px 6px;border-radius:4px;');
  }

  /* ----------------------------------------------------------
     1. BUILD DUST PARTICLES
     Creates CONFIG.dustParticleCount small divs, each positioned
     around the moon at random angles and given random travel
     distances via CSS custom properties.
  ---------------------------------------------------------- */
  function buildDustParticles() {
    if (!dustField) return;
    dustField.innerHTML = ''; // Clear any previous particles

    for (let i = 0; i < CONFIG.dustParticleCount; i++) {
      const particle = document.createElement('div');
      particle.className = 'moon-dust';

      // Random size
      const size = CONFIG.dustMinSize + Math.random() * (CONFIG.dustMaxSize - CONFIG.dustMinSize);

      // Random starting angle around the moon centre
      const angle  = Math.random() * 360;
      const rad    = (angle * Math.PI) / 180;

      // Starting position: on a circle around the moon centre
      // dustField is inset -60px so moon centre is at (dustField.size/2)
      const centre = (CONFIG.dustOrbitRadius + 60); // offset by inset
      const r      = CONFIG.dustOrbitRadius + Math.random() * CONFIG.dustOrbitSpread;
      const startX = centre + Math.cos(rad) * r;
      const startY = centre + Math.sin(rad) * r;

      // Travel direction: drift outward + slight perpendicular float
      const driftAngle = angle + (Math.random() - 0.5) * 60;
      const driftRad   = (driftAngle * Math.PI) / 180;
      const driftDist  = 30 + Math.random() * 50;
      const dx = Math.cos(driftRad) * driftDist;
      const dy = Math.sin(driftRad) * driftDist;

      Object.assign(particle.style, {
        width:              size + 'px',
        height:             size + 'px',
        left:               startX + 'px',
        top:                startY + 'px',
        '--dx':             dx + 'px',
        '--dy':             dy + 'px',
        animationDuration:  (5 + Math.random() * 8) + 's',
        animationDelay:     '-' + (Math.random() * 10) + 's', // stagger by negative delay
        opacity:            '0', // animation handles opacity
      });

      dustField.appendChild(particle);
    }
  }

  /* ----------------------------------------------------------
     2. APPLY PHASE FROM LOCALSTORAGE
     Reads dreamer_stats.totalSessions (read-only).
     Falls back to 0 if not found.
  ---------------------------------------------------------- */
  function applyPhaseFromStorage() {
    const sessions = readSessionCount();
    applyPhase(sessions);
  }

  function readSessionCount() {
    try {
      const raw  = localStorage.getItem('dreamer_stats');
      if (!raw) return 0;
      const data = JSON.parse(raw);
      return (data && typeof data.totalSessions === 'number')
        ? data.totalSessions
        : 0;
    } catch (_) {
      return 0;
    }
  }

  /* ----------------------------------------------------------
     APPLY PHASE
     Given a session count, finds the correct phase and updates:
       - moon-shadow clip-path  (animated by CSS transition)
       - phase label text
       - full-moon bonus glow class on moon-body
  ---------------------------------------------------------- */
  function applyPhase(sessionCount) {
    // Find the highest phase the user has unlocked
    let phase = PHASES[0];
    for (let i = PHASES.length - 1; i >= 0; i--) {
      if (sessionCount >= PHASES[i].sessions) {
        phase = PHASES[i];
        break;
      }
    }

    // Update shadow clip-path (CSS transition animates this)
    if (moonShadow) {
      moonShadow.style.clipPath = phase.clip;
    }

    // Update label
    if (phaseLabel) {
      phaseLabel.textContent = phase.label;
    }

    // Full moon gets extra glow class
    if (moonBody) {
      moonBody.classList.toggle('full-moon', sessionCount >= 30);
    }
  }

  /* ----------------------------------------------------------
     3. MOUSE PARALLAX — binding
     Records the target offset. The RAF loop smoothly
     interpolates toward it each frame.
  ---------------------------------------------------------- */
  function bindMouseParallax() {
    document.addEventListener('mousemove', (e) => {
      // Normalise mouse to -1 … +1 relative to viewport centre
      const nx = (e.clientX / window.innerWidth  - 0.5) * 2;
      const ny = (e.clientY / window.innerHeight - 0.5) * 2;

      parallax.targetX = nx * CONFIG.parallaxStrength;
      parallax.targetY = ny * CONFIG.parallaxStrength;
    });

    // On mobile: use device orientation as parallax source
    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', (e) => {
        if (e.gamma === null || e.beta === null) return;
        // gamma = left/right tilt (-90 to 90), beta = front/back tilt (-180 to 180)
        parallax.targetX = (e.gamma / 45) * CONFIG.parallaxStrength;
        parallax.targetY = ((e.beta - 45) / 45) * CONFIG.parallaxStrength;
      });
    }
  }

  /* ----------------------------------------------------------
     4. RAF PARALLAX LOOP
     Runs every frame. Lerps current position toward target
     using CONFIG.parallaxDamping as the interpolation factor.
  ---------------------------------------------------------- */
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function startParallaxLoop() {
    if (loopRunning) return;
    loopRunning = true;

    function tick() {
      requestAnimationFrame(tick);

      if (!moonSystem) return;

      // Smooth interpolation
      parallax.currentX = lerp(parallax.currentX, parallax.targetX, CONFIG.parallaxDamping);
      parallax.currentY = lerp(parallax.currentY, parallax.targetY, CONFIG.parallaxDamping);

      // Apply — base position kept via CSS, parallax added on top
      moonSystem.style.transform =
        `translate(calc(-50% + ${parallax.currentX}px), calc(-58% + ${parallax.currentY}px))`;
    }

    tick();
  }

  /* ----------------------------------------------------------
     5. WATCH FOR SESSION UPDATES
     Polls localStorage every 5 seconds so the moon phase
     updates automatically after a focus session completes
     without needing any changes to script.js.

     Also listens for the storage event (fires when another
     tab writes to localStorage).
  ---------------------------------------------------------- */
  function watchForSessionUpdates() {
    // Poll — catches updates from the same tab
    let lastCount = readSessionCount();
    setInterval(() => {
      const current = readSessionCount();
      if (current !== lastCount) {
        lastCount = current;
        applyPhase(current);
      }
    }, 5000);

    // Storage event — catches updates from other tabs
    window.addEventListener('storage', (e) => {
      if (e.key === 'dreamer_stats') {
        const current = readSessionCount();
        applyPhase(current);
      }
    });
  }

  /* ----------------------------------------------------------
     BOOT
  ---------------------------------------------------------- */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(); // End of IIFE — nothing leaks to global scope