// render.js — Deterministic Canvas 2D renderer for "粒子数反转 (Population Inversion)"
// Visual, Camera & Transition Reference: 《脑内擂台》你不用打赢它们，你可以改规则。
// Refined:
// 1. Strict non-overlapping typography zoning & high-contrast large text / dark pill badges (no tiny unreadable text on background)
// 2. Seamless organic tapered plasma laser emitter fused into the character's energy core (zero rectangular seams)
// 3. Realistic Newtonian kinematics for sliding, falling, bouncing, and friction deceleration on inclined/curved tracks

(function (global) {
  const PI = Math.PI;
  const TAU = Math.PI * 2;

  function clamp(x, a, b) {
    return x < a ? a : x > b ? b : x;
  }
  function lerp(a, b, u) {
    return a + (b - a) * clamp(u, 0, 1);
  }
  function invLerp(a, b, v) {
    return clamp((v - a) / (b - a + 1e-9), 0, 1);
  }
  function smoothstep(a, b, v) {
    const u = invLerp(a, b, v);
    return u * u * (3 - 2 * u);
  }
  function easeInOutCubic(u) {
    u = clamp(u, 0, 1);
    return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
  }
  function easeOutBack(u) {
    u = clamp(u, 0, 1);
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2);
  }
  function spring(t, t0, freq, damping) {
    const dt = t - t0;
    if (dt <= 0) return 0;
    const w = (freq || 6.0) * TAU;
    const z = damping || 0.48;
    const wd = w * Math.sqrt(Math.max(0.01, 1 - z * z));
    return 1 - Math.exp(-z * w * dt) * (Math.cos(wd * dt) + (z * w / wd) * Math.sin(wd * dt));
  }
  function hash(n) {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
    return s - Math.floor(s);
  }
  function hexToRgb(str) {
    if (!str) return [255, 255, 255];
    if (str.indexOf("rgb") === 0) {
      const m = str.match(/(\d+)/g);
      if (m && m.length >= 3) {
        return [parseInt(m[0], 10), parseInt(m[1], 10), parseInt(m[2], 10)];
      }
    }
    const h = str.replace("#", "");
    return [
      parseInt(h.substring(0, 2), 16) || 0,
      parseInt(h.substring(2, 4), 16) || 0,
      parseInt(h.substring(4, 6), 16) || 0
    ];
  }
  function lerpColor(hex1, hex2, u) {
    u = clamp(u, 0, 1);
    const c1 = hexToRgb(hex1);
    const c2 = hexToRgb(hex2);
    return (
      "rgb(" +
      Math.round(lerp(c1[0], c2[0], u)) +
      "," +
      Math.round(lerp(c1[1], c2[1], u)) +
      "," +
      Math.round(lerp(c1[2], c2[2], u)) +
      ")"
    );
  }
  function rgba(hex, a) {
    const c = hexToRgb(hex);
    return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + clamp(a, 0, 1).toFixed(3) + ")";
  }

  function drawRoundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // ==================== VISUAL & TYPOGRAPHY PRIMITIVES ====================

  // High-Contrast Pill Badge: guarantees any stage label is large, crisp, and never lost in the background
  function drawStagePillBadge(ctx, cx, cy, text, accentHex, alpha, fontSize) {
    alpha = alpha === undefined ? 1.0 : alpha;
    if (alpha <= 0.01) return;
    fontSize = fontSize || 26;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = "bold " + fontSize + "px 'PingFang SC', 'Songti SC', serif";
    const m = ctx.measureText(text);
    const textW = m && m.width ? m.width : text.length * fontSize;
    const padX = 26;
    const w = textW + padX * 2;
    const h = fontSize + 24;
    const x = cx - w * 0.5;
    const y = cy - h * 0.5;

    // Solid dark obsidian-glass backing so background lines never interfere
    ctx.fillStyle = "rgba(10, 8, 6, 0.92)";
    drawRoundRect(ctx, x, y, w, h, h * 0.5);
    ctx.fill();

    // Glowing colored border
    ctx.strokeStyle = rgba(accentHex, 0.85);
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Crisp bright text
    ctx.fillStyle = accentHex;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, cx, cy);
    ctx.restore();
  }

  // Additive Neon Glow Orb
  function drawGlowOrb(ctx, x, y, coreR, glowR, colorHex, intensity) {
    intensity = intensity === undefined ? 1.0 : intensity;
    if (intensity <= 0.01) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const grad = ctx.createRadialGradient(x, y, coreR * 0.2, x, y, glowR);
    grad.addColorStop(0, rgba("#FFFDF5", 0.95 * intensity));
    grad.addColorStop(0.24, rgba(colorHex, 0.78 * intensity));
    grad.addColorStop(0.58, rgba(colorHex, 0.24 * intensity));
    grad.addColorStop(1, rgba(colorHex, 0.0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, glowR, 0, TAU);
    ctx.fill();

    ctx.fillStyle = rgba("#FFFDF7", 0.96 * intensity);
    ctx.beginPath();
    ctx.arc(x, y, coreR, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // Glowing Neon Stroke Helper
  function strokeNeonPath(ctx, colorHex, coreWidth, glowWidth, alpha) {
    alpha = alpha === undefined ? 1.0 : alpha;
    if (alpha <= 0.01) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.strokeStyle = rgba(colorHex, 0.22 * alpha);
    ctx.lineWidth = glowWidth;
    ctx.stroke();

    ctx.strokeStyle = rgba(colorHex, 0.58 * alpha);
    ctx.lineWidth = (coreWidth + glowWidth) * 0.45;
    ctx.stroke();

    ctx.strokeStyle = rgba("#FFFDF5", 0.92 * alpha);
    ctx.lineWidth = coreWidth;
    ctx.stroke();
    ctx.restore();
  }

  // Seamless Tapered Organic Laser Beam (NO rectangular hard-cut edge!)
  // Originates at a point (x0, y0) with radius 0 inside an energy muzzle orb, and flares smoothly via Bezier curves to half-height beamH at x1
  function drawSeamlessLaserBeam(ctx, x0, y0, x1, beamH, t, P, alpha) {
    alpha = alpha === undefined ? 1.0 : alpha;
    if (alpha <= 0.01 || x1 <= x0 + 5) return;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = "lighter";

    const span = x1 - x0;
    const taperLen = Math.min(260, span * 0.45);

    // Helper to build a smooth tapered plasma cone path from (x0, y0)
    function traceTaperedCone(mult) {
      const h = beamH * mult;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.bezierCurveTo(
        x0 + taperLen * 0.35, y0 - h * 0.85,
        x0 + taperLen * 0.75, y0 - h,
        x0 + taperLen, y0 - h
      );
      ctx.lineTo(x1, y0 - h);
      ctx.lineTo(x1, y0 + h);
      ctx.lineTo(x0 + taperLen, y0 + h);
      ctx.bezierCurveTo(
        x0 + taperLen * 0.75, y0 + h,
        x0 + taperLen * 0.35, y0 + h * 0.85,
        x0, y0
      );
      ctx.closePath();
    }

    // 1. Wide outer crimson-coral plasma aura cone
    traceTaperedCone(2.2);
    const outerGrad = ctx.createLinearGradient(0, y0 - beamH * 2.2, 0, y0 + beamH * 2.2);
    outerGrad.addColorStop(0, rgba(P.coralRed, 0));
    outerGrad.addColorStop(0.28, rgba(P.coralRed, 0.45));
    outerGrad.addColorStop(0.5, rgba(P.amberGold, 0.75));
    outerGrad.addColorStop(0.72, rgba(P.coralRed, 0.45));
    outerGrad.addColorStop(1, rgba(P.coralRed, 0));
    ctx.fillStyle = outerGrad;
    ctx.fill();

    // 2. Mid golden-amber high-energy cone
    traceTaperedCone(0.95);
    const midGrad = ctx.createLinearGradient(0, y0 - beamH, 0, y0 + beamH);
    midGrad.addColorStop(0, rgba(P.amberGold, 0));
    midGrad.addColorStop(0.25, rgba(P.amberGold, 0.85));
    midGrad.addColorStop(0.5, "#FFFDF7");
    midGrad.addColorStop(0.75, rgba(P.amberGold, 0.85));
    midGrad.addColorStop(1, rgba(P.amberGold, 0));
    ctx.fillStyle = midGrad;
    ctx.fill();

    // 3. White-hot coherent core filament
    traceTaperedCone(0.32);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();

    // 4. Helical phase-locked light waves spiraling out from (x0, y0)
    for (let waveIdx of [-1, 1]) {
      ctx.beginPath();
      const steps = 60;
      for (let s = 0; s <= steps; s++) {
        const u = s / steps;
        const wx = x0 + u * span;
        const env = smoothstep(0, 0.22, u);
        const wy = y0 + waveIdx * Math.sin(u * TAU * 5 - t * 28) * (beamH * 0.65 * env);
        if (s === 0) ctx.moveTo(wx, wy);
        else ctx.lineTo(wx, wy);
      }
      ctx.strokeStyle = waveIdx === 1 ? rgba(P.amberGold, 0.85) : rgba(P.cyanShield, 0.75);
      ctx.lineWidth = 3.0;
      ctx.stroke();
    }

    // 5. Streaming photons accelerating along the beam
    for (let i = 0; i < 32; i++) {
      const u = ((i / 32) + t * 2.1) % 1.0;
      const env = smoothstep(0, 0.2, u);
      const px = x0 + u * span;
      const py = y0 + Math.sin(u * TAU * 6 - t * 30 + i) * (beamH * 0.55 * env);
      drawGlowOrb(ctx, px, py, 3.5 * env + 1.5, 18 * env + 6, i % 2 === 0 ? P.amberGold : P.coralRed, 0.9);
    }

    // 6. Intense Radial Muzzle Source Orb at (x0, y0) that fuses the character's hands and the beam!
    const pulse = 1.0 + 0.15 * Math.sin(t * 35);
    drawGlowOrb(ctx, x0, y0, 22 * pulse, 115 * pulse, P.amberGold, 1.0);
    drawGlowOrb(ctx, x0, y0, 14 * pulse, 70 * pulse, P.coralRed, 0.95);

    // Concentric energy compression rings right at the emitter point (x0, y0)
    for (let rIdx = 0; rIdx < 3; rIdx++) {
      const ringPhase = ((t * 3.5 + rIdx * 0.33) % 1.0);
      const rx = x0 + ringPhase * 45;
      const ryR = (16 + ringPhase * beamH * 1.3);
      ctx.strokeStyle = rgba("#FFFDF7", (1 - ringPhase) * 0.85);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(rx, y0, ryR * 0.55, -PI * 0.48, PI * 0.48);
      ctx.stroke();
    }

    ctx.restore();
  }

  // RGB Chromatic Aberration Shockwave + Radial Speed Lines
  function drawChromaticShockwave(ctx, cx, cy, progress, maxRadius, intensity) {
    if (progress <= 0.001 || progress >= 0.999) return;
    const u = easeInOutCubic(progress);
    const fade = Math.pow(1 - progress, 1.35) * (intensity || 1.0);
    const r = lerp(30, maxRadius, Math.pow(progress, 0.65));

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    const offsets = [
      { color: "#FF2A18", dr: 14 * (1 - u * 0.3), lw: 16 },
      { color: "#2AFF68", dr: 0, lw: 14 },
      { color: "#2A78FF", dr: -14 * (1 - u * 0.3), lw: 16 }
    ];
    for (let o of offsets) {
      const rr = Math.max(5, r + o.dr);
      ctx.strokeStyle = rgba(o.color, 0.65 * fade);
      ctx.lineWidth = o.lw * (1 - progress * 0.5);
      ctx.beginPath();
      ctx.arc(cx, cy, rr, 0, TAU);
      ctx.stroke();
    }

    ctx.strokeStyle = rgba("#FFFDF2", 0.9 * fade);
    ctx.lineWidth = 6 * (1 - progress * 0.6);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.stroke();

    const nStreaks = 36;
    for (let i = 0; i < nStreaks; i++) {
      const ang = (i / nStreaks) * TAU + hash(i) * 0.12;
      const rIn = lerp(25, maxRadius * 0.42, Math.pow(progress, 0.8)) * (0.65 + 0.5 * hash(i + 5));
      const rOut = rIn + (60 + 130 * hash(i + 19)) * (1 - progress * 0.45);
      ctx.strokeStyle = i % 3 === 0 ? rgba("#FFD154", 0.8 * fade) : rgba("#FFFDF7", 0.85 * fade);
      ctx.lineWidth = 2.2 + (i % 3) * 1.4;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * rIn, cy + Math.sin(ang) * rIn);
      ctx.lineTo(cx + Math.cos(ang) * rOut, cy + Math.sin(ang) * rOut);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Expressive Glowing Halo-Headed Energy Being with Physical Body Rotation & Squash/Stretch
  // opts: { rot: radians, squashX: 1.0, squashY: 1.0, ghostCount: 0 }
  function drawGlowingBeing(ctx, x, y, scale, colorHex, pose, t, id, opts) {
    opts = opts || {};
    const ghostCount = opts.ghostCount || 0;
    const bodyRot = opts.rot || 0;
    const squashX = opts.squashX || 1.0;
    const squashY = opts.squashY || 1.0;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(bodyRot);
    ctx.scale(scale * squashX, scale * squashY);

    const passes = ghostCount + 1;
    for (let g = passes - 1; g >= 0; g--) {
      const isGhost = g > 0;
      const gx = -g * 12 * (opts.ghostDirX !== undefined ? opts.ghostDirX : 1);
      const gy = -g * 12 * (opts.ghostDirY !== undefined ? opts.ghostDirY : 0);
      const alpha = isGhost ? 0.22 / g : 1.0;

      ctx.save();
      ctx.translate(gx, gy);

      if (!isGhost) {
        drawGlowOrb(ctx, 0, -25, 4, 48, colorHex, 0.55);
      }

      let headX = 0, headY = -82;
      let neckX = 0, neckY = -62;
      let hipX = 0, hipY = -30;
      let lHandX = -22, lHandY = -42, rHandX = 22, rHandY = -42;
      let lFootX = -14, lFootY = 0, rFootX = 14, rFootY = 0;

      if (pose === "slouch" || pose === "sleep") {
        const breath = Math.sin(t * 2.2 + id) * 2.5;
        headX = 12; headY = -64 + breath;
        neckX = 6; neckY = -50 + breath;
        hipX = -6; hipY = -26;
        lHandX = 10; lHandY = -24 + breath;
        rHandX = 16; rHandY = -22 + breath;
        lFootX = -12; lFootY = 0;
        rFootX = 8; rFootY = 0;
      } else if (pose === "spiky_hot") {
        const jx = Math.sin(t * 26 + id * 3) * 7;
        const jy = Math.cos(t * 22 + id * 2) * 5;
        headX = jx; headY = -86 + jy;
        neckX = jx * 0.6; neckY = -64;
        hipX = -jx * 0.4; hipY = -32;
        lHandX = -26 + jx; lHandY = -74 - jy;
        rHandX = 26 + jx; rHandY = -76 + jy;
        lFootX = -16; lFootY = 0;
        rFootX = 16; rFootY = 0;
      } else if (pose === "meditate_shield") {
        const floatY = Math.sin(t * 3 + id) * 2.5;
        headX = 0; headY = -66 + floatY;
        neckX = 0; neckY = -48 + floatY;
        hipX = -2; hipY = -12 + floatY;
        lHandX = -16; lHandY = -24 + floatY;
        rHandX = 16; rHandY = -24 + floatY;
        lFootX = -18; lFootY = 0;
        rFootX = 18; rFootY = 0;
      } else if (pose === "walk_uphill") {
        // Leaning forward into the slope while climbing
        const cycle = t * 10 + id * 1.5;
        const s = Math.sin(cycle);
        headX = 16; headY = -76 + Math.abs(s) * 3;
        neckX = 10; neckY = -58;
        hipX = -4; hipY = -28;
        lHandX = 24 + s * 8; lHandY = -48 - s * 6;
        rHandX = 4 - s * 8; rHandY = -42 + s * 6;
        lFootX = 14 * s; lFootY = -Math.max(0, s * 8);
        rFootX = -14 * s; rFootY = -Math.max(0, -s * 8);
      } else if (pose === "slide_down") {
        // Seated/leaning back on a chute sliding down with legs forward and arms raised for balance!
        const wave = Math.sin(t * 12 + id) * 4;
        headX = -10; headY = -56 + wave * 0.4;
        neckX = -6; neckY = -40;
        hipX = 0; hipY = -10;
        lHandX = -24; lHandY = -48 + wave;
        rHandX = 14; rHandY = -44 - wave;
        lFootX = 24; lFootY = -6;
        rFootX = 30; rFootY = -2;
      } else if (pose === "freefall") {
        // Realistic falling posture: limbs trailing upward against air resistance
        const flail = Math.sin(t * 18 + id) * 6;
        headX = 4; headY = -72;
        neckX = 2; neckY = -54;
        hipX = 0; hipY = -26;
        lHandX = -24; lHandY = -78 + flail;
        rHandX = 24; rHandY = -76 - flail;
        lFootX = -14; lFootY = -6 + flail * 0.5;
        rFootX = 14; rFootY = -4 - flail * 0.5;
      } else if (pose === "land_recover") {
        // Crouched impact absorption posture on landing
        headX = 8; headY = -58;
        neckX = 4; neckY = -42;
        hipX = -6; hipY = -18;
        lHandX = 18; lHandY = -12;
        rHandX = -14; rHandY = -22;
        lFootX = -16; lFootY = 0;
        rFootX = 14; rFootY = 0;
      } else if (pose === "hero_beam") {
        // Braced martial stance with BOTH hands extended forward to point (42, -56) where the laser core ignites!
        headX = 8; headY = -82;
        neckX = 2; neckY = -62;
        hipX = -6; hipY = -30;
        lHandX = 42; lHandY = -56;
        rHandX = 42; rHandY = -56;
        lFootX = -24; lFootY = 0;
        rFootX = 20; rFootY = 0;
      } else if (pose === "dive_laser") {
        headX = 0; headY = -36;
        neckX = 0; neckY = -52;
        hipX = 0; hipY = -78;
        lHandX = -16; lHandY = -20;
        rHandX = 16; rHandY = -20;
        lFootX = -12; lFootY = -102;
        rFootX = 12; rFootY = -102;
      }

      ctx.beginPath();
      ctx.moveTo(neckX, neckY);
      ctx.lineTo(hipX, hipY);
      ctx.moveTo(lHandX, lHandY);
      ctx.lineTo(neckX, neckY);
      ctx.lineTo(rHandX, rHandY);
      ctx.moveTo(lFootX, lFootY);
      ctx.lineTo(hipX, hipY);
      ctx.lineTo(rFootX, rFootY);
      strokeNeonPath(ctx, colorHex, 4.5, 16, alpha);

      if (pose === "spiky_hot" && !isGhost) {
        ctx.beginPath();
        for (let s = 0; s < 10; s++) {
          const u = s / 9;
          const bx = lerp(neckX, hipX, u);
          const by = lerp(neckY, hipY, u);
          const side = s % 2 === 0 ? 1 : -1;
          ctx.moveTo(bx, by);
          ctx.lineTo(bx + side * (14 + 7 * hash(s + id)), by - 6);
        }
        strokeNeonPath(ctx, "#FF5838", 2.0, 8, 0.9);
      }

      ctx.beginPath();
      ctx.arc(headX, headY, 11.5, 0, TAU);
      strokeNeonPath(ctx, colorHex, 2.5, 10, alpha);
      drawGlowOrb(ctx, headX, headY, 5.5, 22, colorHex, alpha);

      ctx.restore();
    }

    ctx.restore();
  }

  // Bioluminescent Wavy Energy Shield Dome
  function drawCyanShieldDome(ctx, cx, cy, rx, ry, t, alpha, colorHex) {
    if (alpha <= 0.01) return;
    colorHex = colorHex || "#58F2D8";
    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    const maxR = Math.max(rx, ry);
    const grad = ctx.createRadialGradient(cx, cy, maxR * 0.1, cx, cy, maxR * 1.1);
    grad.addColorStop(0, rgba(colorHex, 0.06 * alpha));
    grad.addColorStop(0.75, rgba(colorHex, 0.18 * alpha));
    grad.addColorStop(1, rgba(colorHex, 0.0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, maxR * 1.1, 0, TAU);
    ctx.fill();

    ctx.beginPath();
    const steps = 72;
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * TAU;
      const wave =
        Math.sin(a * 6 + t * 4.5) * 6 +
        Math.cos(a * 9 - t * 3.2) * 3.5;
      const px = cx + Math.cos(a) * (rx + wave);
      const py = cy + Math.sin(a) * (ry + wave * 0.7);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    strokeNeonPath(ctx, colorHex, 3.5, 18, alpha);
    ctx.restore();
  }

  // Helper to get exact Y on the curved Arena Floor at any X coordinate
  function getArenaFloorY(x, cx, floorY, spanW, archH) {
    const u = (x - cx) / spanW;
    const normU = u / 0.55;
    return floorY - archH * (1 - 2 * normU * normU);
  }

  // Curved Arena Ring Floor & Overhead Spotlight Canopy
  function drawArenaRing(ctx, cx, floorY, canopyY, spanW, archH, P, alpha) {
    if (alpha <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = alpha;

    if (floorY !== null) {
      const floorGrad = ctx.createRadialGradient(cx, floorY + 240, 40, cx, floorY + 240, spanW * 0.65);
      floorGrad.addColorStop(0, rgba(P.amberGold, 0.15 * alpha));
      floorGrad.addColorStop(0.6, rgba(P.latticeLine, 0.10 * alpha));
      floorGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = floorGrad;
      ctx.fillRect(cx - spanW * 0.6, floorY - 110, spanW * 1.2, 260);

      for (let dy of [0, 10]) {
        ctx.beginPath();
        ctx.moveTo(cx - spanW * 0.55, floorY + archH + dy);
        ctx.quadraticCurveTo(cx, floorY - archH + dy, cx + spanW * 0.55, floorY + archH + dy);
        ctx.strokeStyle = dy === 0 ? rgba(P.amberGold, 0.60 * alpha) : rgba(P.arenaRim, 0.35 * alpha);
        ctx.lineWidth = dy === 0 ? 3.2 : 1.5;
        ctx.stroke();
      }

      const pillarUs = [-0.42, -0.20, 0.20, 0.42];
      for (let u of pillarUs) {
        const px = cx + u * spanW;
        const py = getArenaFloorY(px, cx, floorY, spanW, archH);
        for (let dx of [-10, 10]) {
          ctx.fillStyle = rgba("#1A140E", 0.92 * alpha);
          ctx.strokeStyle = rgba(P.arenaRim, 0.65 * alpha);
          ctx.lineWidth = 2;
          drawRoundRect(ctx, px + dx - 5, py - 40, 10, 52, 4);
          ctx.fill();
          ctx.stroke();
        }
      }
    }

    if (canopyY !== null) {
      for (let dy of [0, -9]) {
        ctx.beginPath();
        ctx.moveTo(cx - spanW * 0.52, canopyY - archH + dy);
        ctx.quadraticCurveTo(cx, canopyY + archH + dy, cx + spanW * 0.52, canopyY - archH + dy);
        ctx.strokeStyle = dy === 0 ? rgba(P.amberGold, 0.45 * alpha) : rgba(P.arenaRim, 0.28 * alpha);
        ctx.lineWidth = dy === 0 ? 2.5 : 1.5;
        ctx.stroke();
      }

      for (let i = -3; i <= 3; i++) {
        const u = i * 0.11;
        const lx = cx + u * spanW;
        const normU = u / 0.52;
        const ly = canopyY + archH * (1 - 2 * normU * normU) - 18;
        drawGlowOrb(ctx, lx, ly, 4.5, 22, P.amberGold, 0.65 * alpha);
      }
    }

    ctx.restore();
  }

  // High-Contrast Top HUD Card (Large, readable typography, solid dark backing, zero overlap!)
  function drawScientificHUD(ctx, x, y, w, h, titleLeft, badgeRight, badgeColor, alpha) {
    if (alpha <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = alpha;

    // Solid dark glass backing (94% opacity) so background lattice never clutters HUD text
    ctx.fillStyle = "rgba(12, 10, 8, 0.94)";
    drawRoundRect(ctx, x, y, w, h, 16);
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 209, 84, 0.38)";
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // Header divider line
    ctx.strokeStyle = "rgba(255, 209, 84, 0.15)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 24, y + 62);
    ctx.lineTo(x + w - 24, y + 62);
    ctx.stroke();

    // Large, crisp Left Title (26px bold)
    ctx.fillStyle = "#FFFDF7";
    ctx.font = "bold 26px 'PingFang SC', 'Songti SC', serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(titleLeft, x + 30, y + 33);

    // High-contrast Right Formula/Status Badge (22px bold)
    if (badgeRight) {
      ctx.fillStyle = badgeColor || "#FFD154";
      ctx.font = "bold 22px 'Georgia', 'PingFang SC', serif";
      ctx.textAlign = "right";
      ctx.fillText(badgeRight, x + w - 30, y + 33);
    }

    ctx.restore();
  }

  // Background Organic Branching Neural/Atomic Lattice & Bokeh
  function drawObsidianLatticeBackground(ctx, t, W, H, P, camX, camY, camZoom, latticeEnergy) {
    ctx.fillStyle = P.obsidianBg;
    ctx.fillRect(0, 0, W, H);

    const bgGrad = ctx.createRadialGradient(W * 0.5, H * 0.5, 80, W * 0.5, H * 0.5, W * 0.65);
    bgGrad.addColorStop(0, "rgba(40, 28, 15, 0.38)");
    bgGrad.addColorStop(0.6, "rgba(16, 12, 8, 0.20)");
    bgGrad.addColorStop(1, "rgba(6, 4, 3, 0.96)");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 12; i++) {
      const bx = ((hash(i * 7 + 1) * W * 1.2 - W * 0.1) - camX * 0.15 + Math.sin(t * 0.5 + i) * 20);
      const by = ((hash(i * 7 + 2) * H * 1.2 - H * 0.1) - camY * 0.15 + Math.cos(t * 0.4 + i) * 20);
      const br = 45 + (i % 4) * 35;
      const bColor = i % 3 === 0 ? P.cyanShield : P.amberGold;
      const g = ctx.createRadialGradient(bx, by, 5, bx, by, br);
      g.addColorStop(0, rgba(bColor, 0.06));
      g.addColorStop(1, rgba(bColor, 0.0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    ctx.save();
    ctx.translate(W * 0.5 - camX * 0.25, H * 0.5 - camY * 0.25);
    ctx.scale(1 + (camZoom - 1) * 0.25, 1 + (camZoom - 1) * 0.25);
    ctx.strokeStyle = rgba("#7A5E3D", 0.12 + 0.16 * (latticeEnergy || 0));
    ctx.lineWidth = 1.4;
    for (let b = 0; b < 24; b++) {
      const ang = (b / 24) * TAU + hash(b) * 0.2;
      let x0 = Math.cos(ang) * 90;
      let y0 = Math.sin(ang) * 50;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      for (let seg = 1; seg <= 5; seg++) {
        const r = seg * 165;
        const a2 = ang + (hash(b * 13 + seg) - 0.5) * 0.45;
        const x1 = Math.cos(a2) * r;
        const y1 = Math.sin(a2) * r * 0.68;
        ctx.lineTo(x1, y1);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // ==================== CAMERA & SCENE CONTROLLERS ====================

  function getCameraState(t) {
    let camX = 0;
    let camY = 0;
    let camZoom = 1.0;
    let camRot = 0.0;

    if (t < 2.45) {
      camZoom = lerp(1.22, 1.04, smoothstep(0.0, 2.4, t));
      camRot = Math.sin(t * 1.5) * 0.012;
    } else if (t < 7.55) {
      const shake1 = Math.exp(-Math.max(0, t - 2.45) * 6.0) * Math.sin((t - 2.45) * 45) * 16 * (t >= 2.45 ? 1 : 0);
      const shake2 = Math.exp(-Math.max(0, t - 5.62) * 5.0) * Math.cos((t - 5.62) * 38) * 12 * (t >= 5.62 ? 1 : 0);
      const diveU = easeInOutCubic(smoothstep(6.75, 7.55, t));
      camX = shake1 + shake2;
      camY = shake1 * 0.5 + lerp(0, 80, diveU);
      camZoom = lerp(1.0, 1.04, diveU);
    } else if (t < 15.85) {
      const settle = 1 - smoothstep(7.55, 8.2, t);
      camY = settle * -50 + Math.sin(t * 0.8) * 4;
      camZoom = lerp(1.04, 1.0, smoothstep(7.55, 8.5, t));
    } else if (t < 20.05) {
      const heatTremor = Math.sin(t * 32) * 3.0 * smoothstep(16.1, 17.5, t) * (1 - smoothstep(19.2, 19.6, t));
      const trackSun = easeInOutCubic(smoothstep(19.30, 20.05, t));
      camX = heatTremor;
      camY = lerp(0, -35, trackSun);
      camZoom = lerp(1.0, 1.05, trackSun);
    } else if (t < 24.45) {
      const diveDown = smoothstep(20.05, 21.35, t);
      const zoomCore = smoothstep(23.5, 24.45, t);
      camY = lerp(-35, 20, diveDown) * (1 - zoomCore);
      camZoom = lerp(1.05, 1.0, diveDown) + zoomCore * 0.08;
    } else if (t < 30.25) {
      const flipShock = Math.exp(-Math.max(0, t - 28.20) * 5.0) * Math.sin((t - 28.20) * 35) * 10 * (t >= 28.20 ? 1 : 0);
      camX = flipShock;
      camRot = Math.sin(smoothstep(27.9, 29.0, t) * PI) * 0.03;
    } else if (t < 35.80) {
      const slam = Math.exp(-Math.max(0, t - 34.8) * 6.0) * Math.sin((t - 34.8) * 40) * 12 * (t >= 34.8 ? 1 : 0);
      camY = slam;
    } else if (t < 47.55) {
      const winShock = Math.exp(-Math.max(0, t - 46.18) * 5.5) * Math.sin((t - 46.18) * 42) * 14 * (t >= 46.18 ? 1 : 0);
      camX = winShock;
      camY = winShock * 0.5;
    } else {
      const laserShake = Math.exp(-Math.max(0, t - 50.45) * 3.5) * Math.sin((t - 50.45) * 50) * 16 * (t >= 50.45 && t < 53.5 ? 1 : 0);
      camX = laserShake;
      camY = laserShake * 0.5;
    }

    return { camX: camX, camY: camY, camZoom: camZoom, camRot: camRot };
  }

  // S1 (0.00 - 2.42s) & S2 (2.42 - 7.55s):
  // Seamless Laser Emission from Character's Hands + Clean Non-Overlapping Hero Typography
  function renderS1AndS2(ctx, t, W, H, P) {
    const cx = W * 0.5;
    const cy = H * 0.50;

    const morphToLaser = smoothstep(1.85, 2.45, t);
    const morphToArena = smoothstep(6.75, 7.55, t);

    // 1. Cracked Neural Lattice around center (fades cleanly before title)
    if (t < 5.5) {
      const crackFade = 1 - smoothstep(4.2, 5.2, t);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let c = 0; c < 32; c++) {
        const ang = (c / 32) * TAU + hash(c) * 0.25;
        const r1 = 40 + hash(c + 3) * 80;
        const r2 = r1 + 90 + hash(c + 9) * 150;
        const aMid = ang + (hash(c + 15) - 0.5) * 0.35;
        ctx.strokeStyle = rgba(P.amberGold, (0.16 + 0.22 * morphToLaser) * crackFade);
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * r1, cy - 30 + Math.sin(ang) * r1);
        ctx.lineTo(cx + Math.cos(aMid) * ((r1 + r2) * 0.5), cy - 30 + Math.sin(aMid) * ((r1 + r2) * 0.5));
        ctx.lineTo(cx + Math.cos(ang) * r2, cy - 30 + Math.sin(ang) * r2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Hero Figure Position: moves smoothly from center (cx) to left launcher stance (cx - 320) during morphToLaser!
    const heroX = lerp(cx, cx - 320, easeInOutCubic(morphToLaser));
    const heroFootY = cy + 85;
    const heroScale = 1.45;
    // In "hero_beam" pose, both hands converge at local (+42, -56), so in world coords:
    const handWorldX = heroX + 42 * heroScale;
    const handWorldY = heroFootY - 56 * heroScale;

    // 2. S1: Scattered weak photons in dark -> pulled directly into the character's hands at (handWorldX, handWorldY)!
    if (t < 2.60) {
      for (let i = 0; i < 44; i++) {
        const a = (i / 44) * TAU + Math.sin(t * 1.5 + i) * 0.5;
        const life = (t * 0.75 + hash(i)) % 1.0;
        const rad = 55 + life * 280;
        const sx = cx + Math.cos(a) * rad;
        const sy = (cy - 20) + Math.sin(a) * rad * 0.75;
        const px = lerp(sx, handWorldX, easeInOutCubic(morphToLaser));
        const py = lerp(sy, handWorldY, easeInOutCubic(morphToLaser));
        drawGlowOrb(ctx, px, py, 4, 20, P.amberGold, (1 - life * 0.6) * (1 - morphToLaser * 0.3));
      }

      // Charging energy sphere in the character's hands
      if (morphToLaser > 0.05) {
        drawGlowOrb(ctx, handWorldX, handWorldY, 18 * morphToLaser, 85 * morphToLaser, P.amberGold, morphToLaser);
      }

      drawGlowingBeing(
        ctx,
        heroX,
        heroFootY,
        heroScale,
        P.amberGold,
        morphToLaser > 0.25 ? "hero_beam" : "walk_uphill",
        t,
        1,
        { ghostCount: 2 }
      );

      // Clean Top Pill Badge (large 28px bold text on solid dark pill, zero overlap!)
      const tagAlpha = smoothstep(0.30, 0.75, t) * (1 - morphToLaser);
      drawStagePillBadge(ctx, cx, 115, "普通灯光 · 自发辐射光子四散微弱", P.amberGold, tagAlpha, 28);
    }

    // 3. S2 (2.42s+): Seamless Tapered Laser Beam Eruption from Character's Hands!
    if (t >= 2.42) {
      const titleAppear = smoothstep(5.40, 5.80, t);
      const beamFade = 1 - titleAppear;

      if (beamFade > 0.01) {
        ctx.save();
        ctx.globalAlpha = beamFade;

        // Draw character standing on the arena rim
        drawGlowingBeing(ctx, heroX, heroFootY, heroScale, P.amberGold, "hero_beam", t, 1, { ghostCount: 2 });

        // Seamless Tapered Laser Beam originating EXACTLY at (handWorldX, handWorldY)!
        const beamEndX = lerp(handWorldX + 60, W + 80, smoothstep(2.42, 2.82, t));
        const beamHalfH = 54 * (0.9 + 0.1 * Math.sin(t * 25));
        drawSeamlessLaserBeam(ctx, handWorldX, handWorldY, beamEndX, beamHalfH, t, P, 1.0);

        // Clean Top Pill Badge
        drawStagePillBadge(ctx, cx, 115, "受激辐射激光 · 方向一致、相位同步、高能汇聚", P.coralRed, smoothstep(2.6, 3.0, t), 28);
        ctx.restore();
      }

      // RGB Chromatic Shockwave centered right on the hand emitter at 2.45s!
      const sw1 = clamp((t - 2.45) / 1.35, 0, 1);
      drawChromaticShockwave(ctx, handWorldX, handWorldY, sw1, 720, 1.0);

      // 4. Clean Hero Title Reveal at 5.50s ("粒子数反转") — Big Title + 1 Clean Pill Badge, NO overlapping small text!
      if (t >= 5.45) {
        const sw2 = clamp((t - 5.58) / 1.30, 0, 1);
        drawChromaticShockwave(ctx, cx, cy - 40, sw2, 760, 0.85);

        const tScale = spring(t, 5.52, 5.5, 0.48);
        const textFade = 1 - smoothstep(6.75, 7.35, t);

        if (textFade > 0.01) {
          ctx.save();
          ctx.translate(cx, cy - 45);
          ctx.scale(tScale, tScale);
          ctx.globalAlpha = textFade;

          // Dark protective radial halo behind title so shockwave lines never make text hard to read
          const halo = ctx.createRadialGradient(0, 0, 40, 0, 0, 420);
          halo.addColorStop(0, "rgba(8, 6, 4, 0.88)");
          halo.addColorStop(0.7, "rgba(8, 6, 4, 0.55)");
          halo.addColorStop(1, "rgba(8, 6, 4, 0.0)");
          ctx.fillStyle = halo;
          ctx.beginPath();
          ctx.arc(0, 0, 420, 0, TAU);
          ctx.fill();

          // Hero Calligraphic Title (116px bold)
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = rgba(P.amberGold, 0.45);
          ctx.font = "bold 118px 'Songti SC', 'PingFang SC', serif";
          ctx.fillText("粒子数反转", 0, -15);
          ctx.fillStyle = "#FFFDF7";
          ctx.font = "bold 114px 'Songti SC', 'PingFang SC', serif";
          ctx.fillText("粒子数反转", 0, -15);
          ctx.restore();

          // Single high-contrast pill badge below the big title (30px bold)
          drawStagePillBadge(ctx, 0, 88, "高能级粒子数 N₂  ≫  低能级粒子数 N₁", P.amberGold, 1.0, 30);

          ctx.restore();
        }

        // Seamless Morph (6.75 -> 7.55s): The horizontal energy line expands into the S3 Curved Arena Floor!
        const lineY = lerp(cy + 140, 800, easeInOutCubic(morphToArena));
        const spanW = lerp(700, 1680, easeInOutCubic(morphToArena));
        const archH = lerp(0, 36, easeInOutCubic(morphToArena));
        drawArenaRing(ctx, cx, lineY, morphToArena > 0.2 ? lerp(-80, 65, morphToArena) : null, spanW, archH, P, smoothstep(5.6, 6.2, t));
      }
    }
  }

  // S3 (7.55 - 15.85s): Lazy 1st Floor Arena (E1) + High-Contrast Boltzmann HUD Card
  function renderS3(ctx, t, W, H, P) {
    const cx = W * 0.5;
    const morphToFire = smoothstep(15.05, 15.85, t);

    drawArenaRing(ctx, cx, 800, 65, 1680, 36, P, 1.0);

    // Second Floor (E2) Platform Curve at y = 520
    ctx.beginPath();
    ctx.moveTo(cx - 560, 530);
    ctx.quadraticCurveTo(cx, 505, cx + 560, 530);
    strokeNeonPath(ctx, P.cyanShield, 2.5, 12, 0.55);

    // High-contrast Pill Badges on the LEFT margin (never overlapping characters or lines!)
    drawStagePillBadge(ctx, 250, 485, "二楼高能级 E₂ · 空无一人", P.cyanShield, 1 - morphToFire, 25);
    drawStagePillBadge(ctx, 250, 675, "一楼低能级 E₁ · 全挤在底层", P.amberGold, 1 - morphToFire, 25);

    // 13 Slouching/Sleepy Golden Beings standing physically on the curved 1st Floor Arena (E1)
    for (let i = 0; i < 13; i++) {
      const x = cx - 420 + (i / 12) * 980;
      const y = getArenaFloorY(x, cx, 800, 1680, 36);
      drawGlowingBeing(ctx, x, y, 0.80, P.amberGold, "slouch", t, i);
    }

    // Top HUD Card: Large, clean layout with Boltzmann Curve on Left & Comparison Bars on Right
    const hudAppear = spring(t, 10.60, 5.0, 0.55);
    if (hudAppear > 0.01) {
      const hx = cx - 560;
      const hy = 58;
      const hw = 1120;
      const hh = 310;

      drawScientificHUD(
        ctx,
        hx,
        hy,
        hw,
        hh,
        "玻尔兹曼分布 · 自然热平衡能级占比",
        "N₂ / N₁ = exp(−(E₂−E₁)/kT) ≪ 1",
        P.amberGold,
        hudAppear * (1 - morphToFire * 0.8)
      );

      const axX = hx + 90;
      const axY = hy + hh - 38;
      const axW = 360;
      const axH = 175;

      ctx.save();
      ctx.globalAlpha = hudAppear * (1 - morphToFire * 0.85);
      ctx.strokeStyle = "rgba(255, 253, 247, 0.55)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(axX, axY - axH);
      ctx.lineTo(axX, axY);
      ctx.lineTo(axX + axW, axY);
      ctx.stroke();

      ctx.fillStyle = P.textWhite;
      ctx.font = "bold 22px 'Georgia', serif";
      ctx.textAlign = "right";
      ctx.fillText("E₁", axX - 14, axY - 4);
      ctx.fillText("E₂", axX - 14, axY - 95);
      ctx.fillText("E₃", axX - 14, axY - 148);

      const levels = [
        { y: axY - 6, dots: 14, color: P.amberGold },
        { y: axY - 95, dots: 2, color: P.cyanShield },
        { y: axY - 148, dots: 1, color: P.coralRed }
      ];
      for (let lv of levels) {
        for (let d = 0; d < lv.dots; d++) {
          const dAlpha = smoothstep(11.2 + d * 0.05, 11.5 + d * 0.05, t);
          drawGlowOrb(ctx, axX + 16 + d * 22, lv.y, 4.5 * dAlpha, 13 * dAlpha, lv.color, dAlpha);
        }
      }

      // Right side of HUD: Large 24px Comparison Bars
      const barX = hx + 530;
      ctx.textAlign = "left";
      ctx.font = "bold 24px 'PingFang SC', serif";
      ctx.fillStyle = P.amberGold;
      ctx.fillText("一楼基态粒子数 N₁ (99.9%)", barX, hy + 118);

      ctx.beginPath();
      ctx.moveTo(barX, hy + 154);
      ctx.lineTo(barX + 510 * smoothstep(12.2, 13.4, t), hy + 154);
      strokeNeonPath(ctx, P.amberGold, 14, 30, 0.95);

      ctx.fillStyle = P.cyanShield;
      ctx.fillText("二楼高能级粒子数 N₂ (≈ 0%)", barX, hy + 222);

      ctx.strokeStyle = "rgba(88, 242, 216, 0.22)";
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.moveTo(barX, hy + 258);
      ctx.lineTo(barX + 510, hy + 258);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(barX, hy + 258);
      ctx.lineTo(barX + 14, hy + 258);
      strokeNeonPath(ctx, P.coralRed, 14, 26, 0.95);
      ctx.restore();

      // Exponential Boltzmann Curve — morphs down to ignite the 3000K arena floor at 15.05->15.85s
      const curveDraw = smoothstep(10.85, 12.10, t);
      ctx.beginPath();
      const steps = 36;
      const maxS = Math.floor(steps * curveDraw);
      for (let s = 0; s <= maxS; s++) {
        const u = s / steps;
        const x0 = axX + 14 + Math.pow(u, 2.2) * (axW - 40);
        const y0 = (axY - axH + 15) + u * (axH - 21);
        const x1 = lerp(cx - 580, cx + 580, u);
        const y1 = getArenaFloorY(x1, cx, 800, 1680, 36);
        const px = lerp(x0, x1, easeInOutCubic(morphToFire));
        const py = lerp(y0, y1, easeInOutCubic(morphToFire));
        if (s === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      strokeNeonPath(ctx, lerpColor(P.amberGold, P.coralRed, morphToFire), 4.0, 16, hudAppear);
    }
  }

  // S4 (15.85 - 20.05s): 3000K Thermal Agitation -> Physical Parabolic Fireball Bounce to Golden Sun-Photon
  function renderS4(ctx, t, W, H, P) {
    const cx = W * 0.5;
    const heatU = smoothstep(15.85, 17.20, t);
    const morphToSun = smoothstep(19.30, 20.05, t);

    drawArenaRing(ctx, cx, 800, 65, 1680, 36, P, 1.0);

    // Second Floor (E2) Platform Curve
    ctx.beginPath();
    ctx.moveTo(cx - 560, 530);
    ctx.quadraticCurveTo(cx, 505, cx + 560, 530);
    strokeNeonPath(ctx, P.cyanShield, 2.5, 12, 0.50);

    // Top HUD Card with large 26px text
    drawScientificHUD(
      ctx,
      cx - 560,
      58,
      1120,
      220,
      "3000 K 热辐射光源 (λ = 500 nm)",
      "N₂ / N₁ 依然远小于 1 · 受激辐射可忽略",
      P.coralRed,
      1 - morphToSun * 0.85
    );

    if (morphToSun < 0.95) {
      ctx.save();
      ctx.beginPath();
      for (let i = 0; i <= 70; i++) {
        const u = i / 70;
        const wx = (cx - 500) + u * 1000;
        const spike = Math.sin(u * 45 - t * 28) * Math.exp(-Math.pow((u - 0.28) * 6, 2)) * 55 * heatU;
        const wy = 205 - spike + Math.sin(u * 90 + t * 20) * 6 * heatU;
        if (i === 0) ctx.moveTo(wx, wy);
        else ctx.lineTo(wx, wy);
      }
      strokeNeonPath(ctx, P.coralRed, 3.2, 14, 1 - morphToSun);
      ctx.restore();
    }

    // 3000K Coral-Red Fire Pillars along the 1st Floor Arena
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let k = 0; k < 36; k++) {
      const fx = cx - 560 + (k / 35) * 1120;
      const fy = getArenaFloorY(fx, cx, 800, 1680, 36);
      const fh = (28 + 60 * hash(k * 3) + 32 * Math.sin(t * 18 + k)) * heatU * (1 - morphToSun * 0.7);
      ctx.strokeStyle = k % 2 === 0 ? rgba(P.coralRed, 0.65) : rgba(P.amberGold, 0.65);
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx, fy - fh);
      ctx.stroke();
    }
    ctx.restore();

    // 12 Spiky Agitated Coral-Red Beings on E1, and ONLY 1 lonely particle hopping up to E2 under gravity
    for (let i = 0; i < 12; i++) {
      if (i === 6 && t >= 17.3) {
        const hopU = clamp((t - 17.3) / 0.65, 0, 1);
        // Parabolic ballistic hop onto E2 platform at y=505
        const py = lerp(764, 505, hopU) - 4 * hopU * (1 - hopU) * 65;
        drawGlowingBeing(ctx, cx, py, 0.80, P.amberGold, "spiky_hot", t, i, { ghostCount: 1 });
      } else {
        const x = cx - 520 + (i / 11) * 1040;
        const y = getArenaFloorY(x, cx, 800, 1680, 36);
        drawGlowingBeing(ctx, x, y, 0.80, P.coralRed, "spiky_hot", t, i);
      }
    }

    drawStagePillBadge(ctx, 250, 465, "二楼 E₂ · 仅极个别粒子跃上", P.amberGold, smoothstep(17.5, 17.9, t) * (1 - morphToSun), 25);

    // Seamless Match-Cut Morph (19.30 -> 20.05s): Fireball launches on a Newtonian parabolic trajectory to become the Sun-Photon!
    if (morphToSun > 0.01) {
      const u = morphToSun;
      const sx = lerp(cx, cx + 380, u);
      // Exact projectile parabola peaking at u=0.65
      const sy = lerp(755, 290, u) - 4 * u * (1 - u) * 185;
      const sunR = lerp(18, 44, u);
      drawGlowOrb(ctx, sx, sy, sunR, sunR * 3.8, P.amberGold, 1.0);

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let r = 0; r < 16; r++) {
        const a = (r / 16) * TAU + t * 2.2;
        const len = sunR * (1.6 + 0.8 * (r % 2)) * u;
        ctx.strokeStyle = rgba("#FFFDF5", 0.85 * u);
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + Math.cos(a) * len, sy + Math.sin(a) * len);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // S5 (20.05 - 24.45s): Golden Sun-Photon Swallowed by E1 Particles -> Morphs to S6 Concentric Balance
  function renderS5(ctx, t, W, H, P) {
    const cx = W * 0.5;
    const flyU = clamp((t - 20.05) / 1.27, 0, 1);
    const eaten = t >= 21.32;
    const morphToOrbit = smoothstep(23.65, 24.45, t);

    const roomDim = eaten ? smoothstep(21.32, 21.9, t) * (1 - morphToOrbit) : 0;
    drawArenaRing(ctx, cx, 800, 65, 1680, 36, P, (1 - roomDim * 0.72) * (1 - morphToOrbit));

    const devourX = cx;
    const devourY = getArenaFloorY(cx, cx, 800, 1680, 36);

    if (!eaten) {
      // Projectile trajectory into the devourer particle
      const px = lerp(cx + 380, devourX + 25, flyU);
      const py = lerp(290, devourY - 55, flyU * flyU);
      const r = lerp(44, 24, flyU * 0.6);

      drawGlowOrb(ctx, px, py, r, r * 3.8, P.amberGold, 1.0);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * TAU + t * 3.0;
        const len = r * (1.8 + 0.7 * (k % 2));
        ctx.strokeStyle = rgba("#FFFDF7", 0.9);
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len);
        ctx.stroke();
      }
      ctx.restore();

      drawStagePillBadge(ctx, px, py - 78, "入射光子 hν", P.amberGold, 1 - flyU * 0.5, 24);
    }

    if (morphToOrbit < 0.95) {
      ctx.save();
      ctx.globalAlpha = 1 - morphToOrbit;
      for (let i = 0; i < 11; i++) {
        if (i === 5) continue;
        const x = cx - 500 + (i / 10) * 1000;
        const y = getArenaFloorY(x, cx, 800, 1680, 36);
        drawGlowingBeing(ctx, x, y, 0.78, P.amberGold, "slouch", t, i);
      }

      drawGlowingBeing(
        ctx,
        devourX,
        devourY,
        eaten ? 0.95 : 1.12,
        eaten ? "#6E5A4F" : P.coralRed,
        eaten ? "slouch" : "hero_beam",
        t,
        99
      );
      ctx.restore();
    }

    if (eaten) {
      const swallowU = clamp((t - 21.32) / 1.4, 0, 1);
      const ringX = lerp(devourX, cx, easeInOutCubic(morphToOrbit));
      const ringY = lerp(devourY - 45, H * 0.46, easeInOutCubic(morphToOrbit));
      const ringR = lerp(45 + swallowU * 140, 235, easeInOutCubic(morphToOrbit));

      ctx.beginPath();
      ctx.arc(ringX, ringY, ringR, 0, TAU);
      strokeNeonPath(ctx, lerpColor(P.coralRed, P.amberGold, morphToOrbit), 3.5, 18, 0.85);

      drawStagePillBadge(
        ctx,
        cx,
        140,
        "受激吸收 · 底层粒子吞噬光子，光无法放大",
        P.coralRed,
        (1 - morphToOrbit) * smoothstep(21.4, 21.8, t),
        28
      );
    }
  }

  // S6 (24.45 - 30.25s): Concentric Dual-Ring Energy Orbit & 180° Inversion
  function renderS6(ctx, t, W, H, P) {
    const cx = W * 0.5;
    const cy = H * 0.46;

    const flipU = easeInOutCubic(smoothstep(27.95, 28.95, t));
    const rot = flipU * PI;
    const morphToSlope = smoothstep(29.40, 30.25, t);

    if (t >= 28.15) {
      drawChromaticShockwave(ctx, cx, cy, clamp((t - 28.15) / 1.2, 0, 1), 620, 0.85);
    }

    ctx.save();
    ctx.translate(cx, cy);

    ctx.beginPath();
    ctx.arc(0, 0, 250, 0, TAU);
    strokeNeonPath(ctx, P.amberGold, 2.5, 14, 0.65 * (1 - morphToSlope));

    ctx.beginPath();
    ctx.arc(0, 0, 190, 0, TAU);
    strokeNeonPath(ctx, P.cyanShield, 2.0, 12, 0.45 * (1 - morphToSlope));

    ctx.save();
    ctx.rotate(rot * (1 - morphToSlope));

    const fillE2 = smoothstep(25.2, 27.6, t);
    const nE2 = Math.floor(lerp(3, 18, fillE2));

    for (let side of [-1, 1]) {
      const isE2 = side === 1;
      const py = side * 145;

      ctx.save();
      ctx.translate(0, py);
      ctx.rotate(-rot * (1 - morphToSlope));

      if (isE2 && morphToSlope > 0.01) {
        ctx.rotate(-0.32 * morphToSlope);
      }

      ctx.beginPath();
      ctx.moveTo(-290, 0);
      ctx.lineTo(290, 0);
      strokeNeonPath(ctx, isE2 ? P.cyanShield : P.amberGold, 4.5, 18, 0.95);

      const count = isE2 ? nE2 : 3;
      for (let i = 0; i < count; i++) {
        const ux = count === 1 ? 0 : (i / (count - 1)) - 0.5;
        const bx = ux * 460;
        if (i % 3 === 0) {
          drawGlowingBeing(ctx, bx, 0, 0.64, isE2 ? P.cyanShield : P.amberGold, isE2 ? "meditate_shield" : "slouch", t, i);
        } else {
          drawGlowOrb(ctx, bx, -16, 7.5, 26, isE2 ? P.cyanShield : P.amberGold, 0.95);
        }
      }

      drawStagePillBadge(
        ctx,
        0,
        46,
        isE2 ? "二楼高能级 E₂  (N₂ 远多于 N₁)" : "一楼低能级 E₁  (N₁ 极少)",
        isE2 ? P.cyanShield : P.amberGold,
        1 - morphToSlope,
        24
      );

      ctx.restore();
    }

    ctx.restore();
    ctx.restore();
  }

  // S7 (30.25 - 35.80s): REALISTIC PHYSICS for Climbing, Slipping, Gravity Acceleration & Elastic Bouncing!
  // ("但直接把粒子推上二楼，它们根本待不住，瞬间就会掉回一楼")
  function renderS7(ctx, t, W, H, P) {
    const cx = W * 0.5;
    const morphToPump = smoothstep(34.90, 35.80, t);

    drawArenaRing(ctx, cx, 800, 65, 1680, 36, P, 1.0);

    // Physical Geometry of the Steep Ramp & Unstable 2nd Floor Ledge:
    // Ramp starts on 1st Floor E1 at (x0=420, y0=772) and rises at angle θ = 30° to 2nd Floor E2 ledge at (x1=960, y1=455),
    // followed by a narrow unstable ledge from (960, 455) to (1340, 468) that tilts downward when overloaded!
    const rampX0 = 420, rampY0 = 772;
    const ledgeX0 = 960, ledgeY0 = 455;
    const ledgeX1 = 1360;
    const tiltProgress = smoothstep(32.35, 33.15, t);
    // At t >= 32.35s, the unstable E2 ledge tips downward by 18 degrees under the particles' weight!
    const ledgeY1 = 455 + tiltProgress * 95;
    const rampAngle = Math.atan2(ledgeY0 - rampY0, ledgeX0 - rampX0); // -0.53 rad (-30 deg)

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(rampX0, rampY0);
    ctx.lineTo(ledgeX0, ledgeY0);
    ctx.lineTo(ledgeX1, ledgeY1);
    const unstableColor = t >= 32.3 ? P.coralRed : P.amberGold;
    strokeNeonPath(ctx, unstableColor, 4.5, 18, 1 - morphToPump * 0.5);

    // Fulcrum triangle under (ledgeX0, ledgeY0) showing why E2 is mechanically unstable
    ctx.strokeStyle = rgba(P.coralRed, 0.7 * (1 - morphToPump));
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(ledgeX0, ledgeY0 + 4);
    ctx.lineTo(ledgeX0 - 22, ledgeY0 + 44);
    ctx.lineTo(ledgeX0 + 22, ledgeY0 + 44);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // Top HUD Card (large 26px text, zero overlap)
    drawScientificHUD(
      ctx,
      cx - 560,
      58,
      1120,
      110,
      "二能级直接抽运困境 · E₂ 激发态寿命极短 (~10⁻⁸ 秒)",
      "抽运与受激辐射瞬间抵消 · 无法留住粒子",
      P.coralRed,
      1 - morphToPump
    );

    // Simulate 8 glowing little beings climbing up the incline, losing balance on the tipping E2 ledge,
    // and either sliding back down the incline with a = g*sin(θ) OR falling off the right edge under gravity g = 1800 px/s² with elastic floor bounce!
    const nBeings = 8;
    for (let i = 0; i < nBeings; i++) {
      // Staggered climb timing
      const tClimbStart = 30.30 + i * 0.08;
      const dtClimb = clamp((t - tClimbStart) / 1.75, 0, 1);
      // Decelerating climb under gravity: s = 1 - (1 - u)^1.8
      const climbU = 1 - Math.pow(1 - dtClimb, 1.8);

      // Position at top of climb (on upper ramp / unstable ledge)
      const topX = ledgeX0 - 40 + i * 48;
      const topU = clamp((topX - ledgeX0) / (ledgeX1 - ledgeX0), 0, 1);
      const topY = lerp(ledgeY0, ledgeY1, topU);

      // Slip start time (around 32.85s -> 33.25s)
      const tSlipStart = 32.85 + (nBeings - 1 - i) * 0.06;

      let bx, by, brot = 0, bpose = "walk_uphill", sqX = 1.0, sqY = 1.0, gCount = 0, gDirX = 1, gDirY = 0;

      if (t < tSlipStart) {
        // Phase 1: Climbing up the physical ramp surface from (rampX0, rampY0) to (topX, topY)
        if (climbU < 0.82) {
          const rU = climbU / 0.82;
          bx = lerp(rampX0 + 40, ledgeX0, rU);
          by = lerp(rampY0, ledgeY0, rU);
          brot = rampAngle * 0.45; // Leaning naturally into the slope
          bpose = "walk_uphill";
        } else {
          const lU = (climbU - 0.82) / 0.18;
          bx = lerp(ledgeX0, topX, lU);
          by = lerp(ledgeY0, topY, lU);
          // Wobbling as the ledge tips!
          brot = tiltProgress * 0.25 + Math.sin(t * 28 + i * 2) * 0.12 * tiltProgress;
          bpose = tiltProgress > 0.3 ? "spiky_hot" : "walk_uphill";
        }
      } else {
        // Phase 2: Realistic Newtonian Slip, Free-Fall & Elastic Ground Bounce!
        const dtFall = t - tSlipStart;
        if (i < 4) {
          // Left group (i=0..3) slides back down the 30° ramp with constant acceleration a = g*sin(30°) = 680 px/s²!
          const accel = 680.0;
          const dist = 0.5 * accel * dtFall * dtFall;
          const rampLen = Math.hypot(ledgeX0 - rampX0, ledgeY0 - rampY0); // ~625 px
          if (dist < rampLen) {
            const sU = dist / rampLen;
            bx = lerp(ledgeX0, rampX0, sU);
            by = lerp(ledgeY0, rampY0, sU);
            brot = rampAngle * 0.6;
            bpose = "slide_down";
            gCount = 2; gDirX = -1; gDirY = 0.5;
          } else {
            // Reached the bottom of the ramp at (rampX0, rampY0) and slides to a stop with friction on the 1st Floor E1!
            const tBottom = Math.sqrt((2 * rampLen) / accel);
            const vBottom = accel * tBottom * 0.55;
            const dtFloor = dtFall - tBottom;
            const slideDist = vBottom * dtFloor * Math.exp(-dtFloor * 2.5);
            bx = rampX0 - slideDist;
            by = getArenaFloorY(bx, cx, 800, 1680, 36);
            brot = 0;
            bpose = "land_recover";
            // Impact squash right when hitting the bottom of the ramp
            const impact = Math.exp(-dtFloor * 8.0);
            sqX = 1 + 0.25 * impact;
            sqY = 1 - 0.22 * impact;
          }
        } else {
          // Right group (i=4..7) slides off the tilted right ledge with horizontal velocity vx and falls under gravity g = 1550 px/s²!
          const vx = 160 + (i - 4) * 45;
          const g = 1550.0;
          bx = topX + vx * dtFall;
          const floorYAtX = getArenaFloorY(bx, cx, 800, 1680, 36);
          const fallH = Math.max(10, floorYAtX - topY);
          const tHit1 = Math.sqrt((2 * fallH) / g);

          if (dtFall < tHit1) {
            // Free-fall parabola: y = y0 + 0.5 * g * t²
            by = topY + 0.5 * g * dtFall * dtFall;
            brot = dtFall * 0.45;
            bpose = "freefall";
            gCount = 2; gDirX = 0.2; gDirY = 1;
          } else {
            // First elastic bounce on the 1st Floor E1 (restitution e = 0.38)
            const vImpact = g * tHit1;
            const vBounce1 = vImpact * 0.38;
            const tBounceDur = (2 * vBounce1) / g;
            const dtB = dtFall - tHit1;

            if (dtB < tBounceDur) {
              by = floorYAtX - (vBounce1 * dtB - 0.5 * g * dtB * dtB);
              bpose = "freefall";
              const impact = Math.exp(-dtB * 12.0);
              sqX = 1 + 0.28 * impact;
              sqY = 1 - 0.25 * impact;
            } else {
              // Settled on 1st Floor E1
              by = floorYAtX;
              bpose = "land_recover";
            }
          }
        }
      }

      // Seamless Morph (34.90 -> 35.80s): The leftmost landed particle at ~x=340 compresses the floor to ignite the Cyan Energy Pump!
      if (i === 0 && morphToPump > 0.01) {
        bx = lerp(bx, 340, easeInOutCubic(morphToPump));
        by = lerp(by, 780, easeInOutCubic(morphToPump));
        drawGlowOrb(ctx, bx, by - 20, lerp(10, 26, morphToPump), lerp(35, 95, morphToPump), P.cyanShield, 1.0);
      }

      drawGlowingBeing(
        ctx,
        bx,
        by,
        0.78,
        t >= tSlipStart ? P.coralRed : P.amberGold,
        bpose,
        t,
        i,
        { rot: brot, squashX: sqX, squashY: sqY, ghostCount: gCount, ghostDirX: gDirX, ghostDirY: gDirY }
      );
    }
  }

  // S8 (35.80 - 47.55s): REALISTIC PHYSICS for 3-Level Pumping & Sliding (E1 -> E3 -> E2 Chute Track & Floor Stacking)
  // ("于是，激光器用能量泵，先把一楼粒子一口气抽到三楼，再让它们悄悄滑落到二楼。二楼粒子越攒越多，终于反超一楼！")
  function renderS8(ctx, t, W, H, P) {
    const cx = W * 0.5;
    const morphToResonator = smoothstep(46.70, 47.55, t);

    if (t >= 46.15) {
      drawChromaticShockwave(ctx, cx + 120, 540, clamp((t - 46.15) / 1.25, 0, 1), 680, 0.9);
    }

    drawArenaRing(ctx, cx, 820, 65, 1680, 34, P, 1.0);

    // Physical Coordinates of the 3-Level System:
    // 1st Floor (E1): y = 795
    // 3rd Floor Pump Apex (E3): x = 320, y = 295
    // 2nd Floor Metastable Platform Floor (E2): horizontal glowing floor at y = 575, spanning x = 760 to x = 1480
    const pumpX = 320;
    const yE1 = 795;
    const yE3 = 295;
    const yE2Floor = 575;
    const slideEndX = 820;
    const shieldCenterX = 1120;

    // Helper: Physical Slide Chute Profile from E3 (pumpX+24, yE3) down to E2 Floor (slideEndX, yE2Floor)
    // Uses a smooth cosine-S chute where slope is 0 at top, steep in middle, and 0 (tangent to horizontal floor!) at bottom
    function getChutePoint(s) {
      s = clamp(s, 0, 1);
      const x = lerp(pumpX + 24, slideEndX, s);
      const y = lerp(yE3, yE2Floor, 0.5 * (1 - Math.cos(s * PI)));
      const dy_dx = (0.5 * PI * Math.sin(s * PI) * (yE2Floor - yE3)) / (slideEndX - (pumpX + 24));
      const angle = Math.atan(dy_dx);
      return { x: x, y: y, angle: angle };
    }

    const totalP = 24;
    let countE1 = 0;
    let countE2 = 0;
    for (let i = 0; i < totalP; i++) {
      const launchT = 38.20 + (i / totalP) * 6.4;
      const dt = t - launchT;
      if (dt < 0) countE1++;
      else if (dt >= 1.55) countE2++;
    }

    // 1. Top Scientific HUD with Large 24px Comparison Bars (zero overlap!)
    drawScientificHUD(
      ctx,
      cx - 560,
      52,
      1120,
      165,
      "三能级激励抽运 · E₁→E₃ 能量泵浦 + E₃→E₂ 无辐射滑落",
      countE2 > countE1 ? "★ N₂ ≫ N₁ 粒子数反转达成！" : "正在向二楼亚稳态 E₂ 积累粒子...",
      countE2 > countE1 ? P.amberGold : P.cyanShield,
      1 - morphToResonator * 0.6
    );

    if (morphToResonator < 0.95) {
      ctx.save();
      ctx.globalAlpha = 1 - morphToResonator * 0.6;
      const bx = cx - 520;
      ctx.font = "bold 22px 'PingFang SC', serif";
      ctx.textAlign = "left";

      ctx.fillStyle = P.amberGold;
      ctx.fillText("一楼 E₁ 粒子数 : " + countE1, bx, 144);
      const wE1 = Math.max(16, (countE1 / totalP) * 620);
      ctx.beginPath();
      ctx.moveTo(bx + 230, 138);
      ctx.lineTo(bx + 230 + wE1, 138);
      strokeNeonPath(ctx, P.amberGold, 12, 26, 0.9);

      ctx.fillStyle = P.cyanShield;
      ctx.fillText("二楼 E₂ 粒子数 : " + countE2, bx, 190);
      const wE2 = Math.max(16, (countE2 / totalP) * 760);
      ctx.beginPath();
      ctx.moveTo(bx + 230, 184);
      ctx.lineTo(bx + 230 + wE2, 184);
      strokeNeonPath(ctx, P.cyanShield, 14, 30, 1.0);
      ctx.restore();
    }

    // 2. Left Vertical Energy Pump Conduit (E1 -> E3)
    const pumpAppear = smoothstep(35.80, 36.60, t);
    ctx.save();
    ctx.globalAlpha = pumpAppear * (1 - morphToResonator);
    ctx.beginPath();
    ctx.moveTo(pumpX - 30, yE1);
    ctx.lineTo(pumpX - 30, yE3);
    ctx.moveTo(pumpX + 30, yE1);
    ctx.lineTo(pumpX + 30, yE3);
    strokeNeonPath(ctx, P.cyanShield, 3.0, 16, 0.8);

    // Upward energy rings inside the pump column
    if (t >= 38.0) {
      for (let r = 0; r < 5; r++) {
        const u = ((t * 2.0 + r * 0.2) % 1.0);
        const ry = lerp(yE1 - 15, yE3 + 15, u);
        ctx.beginPath();
        ctx.moveTo(pumpX - 22, ry);
        ctx.lineTo(pumpX + 22, ry);
        strokeNeonPath(ctx, P.amberGold, 2.5, 10, 0.85);
      }
    }

    drawStagePillBadge(ctx, pumpX, yE3 - 42, "三楼 E₃ (高能抽运顶层)", P.amberGold, 1.0, 24);
    drawStagePillBadge(ctx, pumpX, yE1 + 48, "能量泵浦 (E₁ → E₃)", P.cyanShield, 1.0, 24);
    ctx.restore();

    // 3. Physical Slide Chute from E3 down to E2 Platform Floor + Horizontal E2 Platform Floor!
    const slideAppear = smoothstep(40.2, 41.0, t);
    ctx.save();
    ctx.beginPath();
    const chuteSteps = 40;
    for (let s = 0; s <= chuteSteps; s++) {
      const pt = getChutePoint((s / chuteSteps) * slideAppear);
      if (s === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    // Continue seamlessly into the horizontal 2nd Floor E2 Platform Floor (x: 820 -> 1460, y: 575)!
    if (slideAppear > 0.95) {
      ctx.lineTo(1460, yE2Floor);
    }
    strokeNeonPath(ctx, P.cyanShield, 4.5, 20, 0.92);

    // 2nd Floor E2 Platform Floor & Wavy Metastable Shield Dome
    drawCyanShieldDome(ctx, shieldCenterX, yE2Floor - 65, 340, 135, t, smoothstep(36.2, 37.5, t), P.cyanShield);
    drawStagePillBadge(ctx, shieldCenterX, yE2Floor + 54, "二楼亚稳态 E₂ · 滑落聚集，反超一楼", P.cyanShield, 1 - morphToResonator, 26);
    ctx.restore();

    // 4. Physically Accurate Particle & Little-Being Motion:
    // - Wait on E1 floor (y = 795)
    // - Upward pneumatic acceleration from yE1 to yE3 inside pumpX
    // - Gravity-accelerated slide down the physical chute track (s(u) = u^1.65 during steep drop, then smooth friction deceleration onto yE2Floor!)
    // - Settle standing/sitting directly ON the 2nd Floor surface (y = yE2Floor, or stacked cleanly on a 2nd tier at y = yE2Floor - 52), NEVER floating or snapping!
    for (let i = 0; i < totalP; i++) {
      const launchT = 38.20 + (i / totalP) * 6.4;
      const dt = t - launchT;

      // Assigned resting slot on the 2nd Floor E2 platform (2 neat rows of 12 standing on the platform!)
      const col = i % 12;
      const row = Math.floor(i / 12);
      const restX = 870 + col * 48;
      const restY = yE2Floor - row * 54;

      if (dt < 0) {
        // Standing on 1st Floor E1 waiting to be pumped
        const waitX = 520 + i * 38;
        const waitY = getArenaFloorY(waitX, cx, 820, 1680, 34);
        if (i % 3 === 0) {
          drawGlowingBeing(ctx, waitX, waitY, 0.72, P.amberGold, "slouch", t, i);
        } else {
          drawGlowOrb(ctx, waitX, waitY - 16, 7.5, 26, P.amberGold, 0.9);
        }
      } else if (dt < 0.65) {
        // Blasted upward inside the vertical pneumatic pump tube (accelerating upward)
        const u = Math.pow(dt / 0.65, 1.4);
        const px = pumpX;
        const py = lerp(yE1, yE3, u);
        if (i % 3 === 0) {
          drawGlowingBeing(ctx, px, py, 0.72, P.amberGold, "freefall", t, i, { ghostCount: 2, ghostDirX: 0, ghostDirY: -1 });
        } else {
          drawGlowOrb(ctx, px, py - 14, 9, 34, P.amberGold, 1.0);
        }
      } else if (dt < 1.55) {
        // Sliding down the physical E3 -> E2 chute under gravity and decelerating onto the horizontal E2 floor to restX!
        const uSlide = (dt - 0.65) / 0.90; // 0 -> 1
        if (uSlide < 0.72) {
          // Gravity acceleration down the curved chute (uChute goes 0 -> 1 with gravity curve)
          const uChute = easeInOutCubic(uSlide / 0.72);
          const pt = getChutePoint(uChute);
          if (i % 3 === 0) {
            // Physically seated on the chute, rotated to match the exact tangent angle of the chute!
            drawGlowingBeing(ctx, pt.x, pt.y, 0.72, P.cyanShield, "slide_down", t, i, {
              rot: pt.angle * 0.65,
              ghostCount: 1,
              ghostDirX: 1,
              ghostDirY: 0.5
            });
          } else {
            drawGlowOrb(ctx, pt.x, pt.y - 12, 8.5, 30, P.cyanShield, 1.0);
          }
        } else {
          // Smooth kinetic friction deceleration along the horizontal E2 platform floor from slideEndX (820) to restX!
          const uRunout = (uSlide - 0.72) / 0.28;
          // Friction deceleration: 1 - (1 - u)^2
          const decel = 1 - Math.pow(1 - uRunout, 2.2);
          const px = lerp(slideEndX, restX, decel);
          const py = lerp(yE2Floor, restY, smoothstep(0.3, 1.0, uRunout));
          if (i % 3 === 0) {
            drawGlowingBeing(ctx, px, py, 0.72, P.cyanShield, "meditate_shield", t, i);
          } else {
            drawGlowOrb(ctx, px, py - 16, 8, 28, i % 2 === 0 ? P.amberGold : P.cyanShield, 0.95);
          }
        }
      } else {
        // Resting stably on the 2nd Floor E2 platform inside the cyan shield dome!
        if (i % 3 === 0) {
          drawGlowingBeing(ctx, restX, restY, 0.72, i % 2 === 0 ? P.cyanShield : P.amberGold, "meditate_shield", t, i);
        } else {
          drawGlowOrb(ctx, restX, restY - 16, 8, 28, i % 2 === 0 ? P.amberGold : P.cyanShield, 0.95);
        }
      }
    }
  }

  // S9 (47.55 - 56.00s): Gravity-Accelerated Collective Downward Leap & Seamless Laser Avalanche -> Clean Stardust Finale
  function renderS9(ctx, t, W, H, P) {
    const cx = W * 0.5;
    const cy = H * 0.46;

    const laserPhase = smoothstep(50.35, 51.80, t);
    const stardustPhase = smoothstep(53.45, 54.60, t);

    if (t >= 50.40) {
      drawChromaticShockwave(ctx, 260, cy, clamp((t - 50.40) / 1.35, 0, 1), 880, 1.0);
    }

    if (stardustPhase < 0.98) {
      ctx.save();
      ctx.globalAlpha = 1 - stardustPhase;

      const yE2 = 330;
      const yE1 = 780;

      // Upper E2 & Lower E1 Energy Rings
      ctx.beginPath();
      ctx.moveTo(220, yE2);
      ctx.lineTo(W - 220, yE2);
      strokeNeonPath(ctx, P.cyanShield, 3.0, 14, 0.65);

      drawArenaRing(ctx, cx, yE1, 65, 1680, 34, P, 0.9);

      // Collective Synchronous Downward Leap with Newtonian Gravity Acceleration! ("当高处粒子集体跃迁而下")
      const nLeapers = 24;
      for (let i = 0; i < nLeapers; i++) {
        const u = i / (nLeapers - 1);
        const lx = 280 + u * (W - 560);
        const floorY = getArenaFloorY(lx, cx, yE1, 1680, 34);
        const startT = 47.85 + u * 1.55;
        const dt = t - startT;
        const jumpDur = 0.68;

        let ly = yE2;
        let pose = "meditate_shield";
        let gCount = 0;

        if (dt > 0 && dt < jumpDur) {
          const ju = dt / jumpDur;
          // Initial upward hop (-35px) followed by gravity acceleration (+0.5 * g * u²) onto floorY!
          ly = yE2 - 35 * Math.sin(ju * PI * 0.5) + (floorY - yE2 + 35) * (ju * ju);
          pose = "dive_laser";
          gCount = 2;

          // Vertical golden-cyan stimulated emission lightning trail
          ctx.beginPath();
          ctx.moveTo(lx, yE2);
          ctx.lineTo(lx, ly);
          strokeNeonPath(ctx, P.amberGold, 3.0, 16, 0.9);

          // Emitted coherent photon flying horizontally into the laser axis
          const phX = lx + dt * 680;
          const phY = (yE2 + yE1) * 0.5 + Math.sin(i + t * 16) * 28;
          if (phX < W) {
            drawGlowOrb(ctx, phX, phY, 9, 36, P.amberGold, 1.0);
          }
        } else if (dt >= jumpDur) {
          ly = floorY;
          pose = "land_recover";
        }

        if (i % 3 === 0) {
          drawGlowingBeing(ctx, lx, ly, 0.74, dt < jumpDur * 0.5 ? P.cyanShield : P.amberGold, pose, t, i, {
            ghostCount: gCount,
            ghostDirX: 0,
            ghostDirY: 1
          });
        } else {
          drawGlowOrb(ctx, lx, ly - 16, 7.5, 26, dt < jumpDur * 0.5 ? P.cyanShield : P.amberGold, 0.9);
        }
      }

      // Seamless Tapered Coherent Laser Avalanche (t >= 50.30s) — originates from a glowing resonator focal orb at x=220, NO hard rectangular seam!
      if (t >= 50.30) {
        const beamY = (yE2 + yE1) * 0.5;
        const beamHalfH = lerp(14, 135, easeOutBack(laserPhase));
        const beamEndX = lerp(280, W + 100, smoothstep(50.30, 50.95, t));
        drawSeamlessLaserBeam(ctx, 220, beamY, beamEndX, beamHalfH, t, P, 1.0);
      }

      ctx.restore();
    }

    // 2. Clean Stardust Particle Cloud Finale (53.45s -> 56.00s) — ZERO overlapping small text on particles!
    if (stardustPhase > 0.01) {
      ctx.save();
      ctx.globalAlpha = stardustPhase;

      // Stardust ring centered slightly higher (cy - 45)
      const ringY = cy - 45;
      ctx.beginPath();
      ctx.arc(cx, ringY, 210, 0, TAU);
      strokeNeonPath(ctx, "#FFFDF5", 3.5, 22, stardustPhase);

      for (let p = 0; p < 220; p++) {
        const a = p * 2.39996 + t * 0.18;
        const r = Math.sqrt((p + 0.5) / 220) * 200;
        const px = cx + Math.cos(a) * r + Math.sin(t * 2 + p) * 3;
        const py = ringY + Math.sin(a) * r + Math.cos(t * 2.3 + p) * 3;
        const col = p % 5 === 0 ? P.cyanShield : p % 7 === 0 ? P.coralRed : P.amberGold;
        const sz = 1.8 + (p % 3) * 1.4;
        drawGlowOrb(ctx, px, py, sz, sz * 4.0, col, 0.5 + 0.4 * Math.sin(t * 4 + p));
      }

      // Dark radial backdrop inside the ring center so the Big Hero Title is 100% crisp
      const centerHalo = ctx.createRadialGradient(cx, ringY, 20, cx, ringY, 195);
      centerHalo.addColorStop(0, "rgba(8, 6, 4, 0.86)");
      centerHalo.addColorStop(0.75, "rgba(8, 6, 4, 0.52)");
      centerHalo.addColorStop(1, "rgba(8, 6, 4, 0.0)");
      ctx.fillStyle = centerHalo;
      ctx.beginPath();
      ctx.arc(cx, ringY, 195, 0, TAU);
      ctx.fill();

      // Big Hero Title inside ring (92px bold)
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#FFFDF7";
      ctx.font = "bold 92px 'Songti SC', 'PingFang SC', serif";
      ctx.fillText("粒子数反转", cx, ringY);
      ctx.restore();

      // Clean High-Contrast Pill Badge BELOW the stardust ring (never overlapping the stardust particles!)
      drawStagePillBadge(
        ctx,
        cx,
        ringY + 265,
        "三能级抽运 (E₁ → E₃ → E₂)  ·  N₂ ≫ N₁  ·  受激辐射光放大",
        P.amberGold,
        stardustPhase,
        28
      );

      ctx.restore();
    }
  }

  // ==================== DEDICATED BOTTOM SUBTITLE BAND ====================
  function drawArenaSubtitles(ctx, t, W, H, P, subtitles) {
    let active = null;
    for (let i = 0; i < subtitles.length; i++) {
      if (t >= subtitles[i].start && t <= subtitles[i].end) {
        active = subtitles[i];
        break;
      }
    }
    if (!active || !active.segments) return;

    const fadeIn = smoothstep(active.start, active.start + 0.12, t);
    const fadeOut = 1 - smoothstep(active.end - 0.12, active.end, t);
    const alpha = clamp(fadeIn * fadeOut, 0, 1);
    if (alpha <= 0.01) return;

    ctx.save();
    ctx.globalAlpha = alpha;

    const fontStr = "bold 44px 'Songti SC', 'PingFang SC', serif";
    ctx.font = fontStr;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";

    let totalW = 0;
    const widths = [];
    for (let seg of active.segments) {
      const m = ctx.measureText(seg.text);
      const w = m && m.width ? m.width : seg.text.length * 44;
      widths.push(w);
      totalW += w;
    }

    const startX = (W - totalW) * 0.5;
    const subY = H - 78;

    // Dedicated high-contrast bottom dark pill backdrop so subtitles never clash with any scene line
    ctx.fillStyle = "rgba(8, 6, 4, 0.88)";
    drawRoundRect(ctx, startX - 36, subY - 36, totalW + 72, 72, 36);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 209, 84, 0.22)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    let curX = startX;
    for (let i = 0; i < active.segments.length; i++) {
      const seg = active.segments[i];
      let hex = P.textWhite;
      if (seg.color === "gold") hex = P.amberGold;
      else if (seg.color === "coral") hex = P.coralRed;
      else if (seg.color === "cyan") hex = P.cyanShield;

      if (seg.color !== "white") {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = rgba(hex, 0.35 * alpha);
        ctx.fillText(seg.text, curX - 1, subY + 1);
        ctx.fillText(seg.text, curX + 1, subY - 1);
        ctx.restore();
      }

      ctx.fillStyle = hex;
      ctx.fillText(seg.text, curX, subY);
      curX += widths[i];
    }

    ctx.restore();
  }

  // ==================== MAIN DETERMINISTIC ENTRY POINT ====================
  function renderFrame(ctx, t, width, height) {
    const TL = global.TIMELINE;
    const W = width || TL.width;
    const H = height || TL.height;
    const P = TL.palette;

    t = clamp(t, 0, TL.duration);

    const cam = getCameraState(t);
    const latticeEnergy =
      (t >= 2.4 && t < 3.5) || (t >= 16.0 && t < 19.5) || t >= 50.0 ? 0.85 : 0.22;

    ctx.save();

    drawObsidianLatticeBackground(ctx, t, W, H, P, cam.camX, cam.camY, cam.camZoom, latticeEnergy);

    ctx.save();
    ctx.translate(W * 0.5 + cam.camX, H * 0.5 + cam.camY);
    ctx.scale(cam.camZoom, cam.camZoom);
    ctx.rotate(cam.camRot);
    ctx.translate(-W * 0.5, -H * 0.5);

    if (t < 7.55) {
      renderS1AndS2(ctx, t, W, H, P);
    } else if (t < 15.85) {
      renderS3(ctx, t, W, H, P);
    } else if (t < 20.05) {
      renderS4(ctx, t, W, H, P);
    } else if (t < 24.45) {
      renderS5(ctx, t, W, H, P);
    } else if (t < 30.25) {
      renderS6(ctx, t, W, H, P);
    } else if (t < 35.80) {
      renderS7(ctx, t, W, H, P);
    } else if (t < 47.55) {
      renderS8(ctx, t, W, H, P);
    } else {
      renderS9(ctx, t, W, H, P);
    }

    ctx.restore();

    drawArenaSubtitles(ctx, t, W, H, P, TL.subtitles);

    ctx.restore();
  }

  global.renderFrame = renderFrame;
})(typeof window !== "undefined" ? window : globalThis);
