// render.js — Deterministic Canvas 2D renderer for "粒子数反转 (Population Inversion)"
// Version 1: Wes Anderson's "The Grand Budapest Hotel" + Seamless Match-Cut Object Morphing
// Exposes renderFrame(ctx, t, W, H)

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
    const w = (freq || 6.5) * TAU;
    const z = damping || 0.45;
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
    const r = Math.round(lerp(c1[0], c2[0], u));
    const g = Math.round(lerp(c1[1], c2[1], u));
    const b = Math.round(lerp(c1[2], c2[2], u));
    return "rgb(" + r + "," + g + "," + b + ")";
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

  function drawStarburst(ctx, cx, cy, rOuter, rInner, points, rot, fillStyle, strokeStyle) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? rOuter : rInner;
      const a = (i * PI) / points;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    if (fillStyle) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
    if (strokeStyle) {
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawParticle(ctx, x, y, radius, colorHex, state, t, id) {
    ctx.save();
    ctx.translate(x, y);

    if (state === "excited" || state === "pumped" || state === "laser") {
      const glowR = radius * (1.8 + 0.25 * Math.sin(t * 8 + id));
      const grad = ctx.createRadialGradient(0, 0, radius * 0.3, 0, 0, glowR);
      grad.addColorStop(0, rgba(colorHex, 0.55));
      grad.addColorStop(1, rgba(colorHex, 0.0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, glowR, 0, TAU);
      ctx.fill();
    }

    ctx.fillStyle = colorHex;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TAU);
    ctx.fill();

    ctx.lineWidth = Math.max(1.8, radius * 0.11);
    ctx.strokeStyle = state === "sleepy" ? "#2A1528" : "#FDF6EC";
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.beginPath();
    ctx.arc(-radius * 0.32, -radius * 0.32, radius * 0.26, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = "#2A1528";
    ctx.fillStyle = "#2A1528";
    ctx.lineWidth = Math.max(1.5, radius * 0.1);
    ctx.lineCap = "round";

    if (state === "sleepy") {
      for (let side of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(side * radius * 0.32, radius * 0.05, radius * 0.18, 0.15 * PI, 0.85 * PI);
        ctx.stroke();
      }
      const zPhase = (t * 0.8 + hash(id) * 3) % 1;
      ctx.fillStyle = rgba("#4A2545", 1 - zPhase);
      ctx.font = "bold " + Math.round(radius * (0.65 + 0.3 * zPhase)) + "px Georgia, serif";
      ctx.textAlign = "center";
      ctx.fillText("z", radius * (0.6 + zPhase * 0.7), -radius * (0.7 + zPhase * 1.1));
    } else if (state === "hungry") {
      ctx.beginPath();
      ctx.arc(0, radius * 0.1, radius * 0.45, 0, TAU);
      ctx.fillStyle = "#231326";
      ctx.fill();
    } else {
      for (let side of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(side * radius * 0.3, -radius * 0.05, radius * 0.13, 0, TAU);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  function drawGrandBudapestStage(ctx, t, W, H, P, shot) {
    let bgHex = P.mendlsPink;
    if (t < 2.55) {
      bgHex = lerpColor(P.nightViolet, "#351A38", smoothstep(0, 2.4, t));
    } else if (t < 7.55) {
      const u = smoothstep(2.42, 3.2, t);
      bgHex = lerpColor("#351A38", P.mendlsPink, u);
    } else if (t >= 21.3 && t < 24.6) {
      const dimIn = smoothstep(21.3, 21.8, t);
      const dimOut = smoothstep(23.8, 24.5, t);
      bgHex = lerpColor(P.mendlsPink, "#2A162D", dimIn * (1 - dimOut));
    } else if (t >= 48.0) {
      const toDark = smoothstep(47.8, 48.6, t);
      const toCrest = smoothstep(53.4, 54.3, t);
      const mid = lerpColor(P.mendlsPink, "#261329", toDark);
      bgHex = lerpColor(mid, P.mendlsPink, toCrest);
    }

    ctx.fillStyle = bgHex;
    ctx.fillRect(0, 0, W, H);

    const radGrad = ctx.createRadialGradient(W * 0.5, H * 0.46, 80, W * 0.5, H * 0.46, W * 0.65);
    radGrad.addColorStop(0, "rgba(255, 248, 240, 0.22)");
    radGrad.addColorStop(1, "rgba(35, 19, 38, 0.18)");
    ctx.fillStyle = radGrad;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.strokeStyle = "rgba(74, 37, 69, 0.045)";
    ctx.lineWidth = 14;
    for (let x = 80; x < W - 60; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 48);
      ctx.lineTo(x, H - 48);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    for (let i = 0; i < 36; i++) {
      const px = ((hash(i * 3 + 1) * W) + t * (12 + (i % 5) * 4)) % W;
      const py = ((hash(i * 3 + 2) * H) - t * (8 + (i % 4) * 3) + H * 10) % H;
      const pr = 1.5 + (i % 3) * 1.1;
      const alpha = 0.18 + 0.15 * Math.sin(t * 2 + i);
      ctx.fillStyle = rgba(P.sunGold, alpha);
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    const m = 34;
    ctx.save();
    ctx.strokeStyle = P.brassGold;
    ctx.lineWidth = 3.5;
    drawRoundRect(ctx, m, m, W - m * 2, H - m * 2, 16);
    ctx.stroke();

    ctx.strokeStyle = rgba(P.lobbyPlum, 0.45);
    ctx.lineWidth = 1.5;
    drawRoundRect(ctx, m + 10, m + 10, W - (m + 10) * 2, H - (m + 10) * 2, 10);
    ctx.stroke();

    const corners = [
      [m + 16, m + 16],
      [W - m - 16, m + 16],
      [m + 16, H - m - 16],
      [W - m - 16, H - m - 16]
    ];
    for (let c of corners) {
      ctx.fillStyle = P.brassGold;
      ctx.beginPath();
      ctx.arc(c[0], c[1], 5, 0, TAU);
      ctx.fill();
    }

    const bannerW = 620;
    const bannerH = 38;
    const bx = (W - bannerW) / 2;
    const by = m - 19;
    ctx.fillStyle = P.lobbyPlum;
    drawRoundRect(ctx, bx, by, bannerW, bannerH, 8);
    ctx.fill();
    ctx.strokeStyle = P.brassGold;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = P.sunGold;
    ctx.font = "bold 15px 'Georgia', 'Songti SC', serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(shot ? shot.chapter : "THE GRAND BUDAPEST LASER", W / 2, by + bannerH / 2);
    ctx.restore();
  }

  function drawHotelCrossSection(ctx, x, y, w, h, floors, P, opts) {
    opts = opts || {};
    ctx.save();

    const roofH = opts.roofH !== undefined ? opts.roofH : 58;
    if (roofH > 2) {
      ctx.fillStyle = P.lobbyPlum;
      ctx.beginPath();
      ctx.moveTo(x - 18, y);
      ctx.lineTo(x + 40, y - roofH);
      ctx.lineTo(x + w - 40, y - roofH);
      ctx.lineTo(x + w + 18, y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = P.brassGold;
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = P.carpetRed;
      drawRoundRect(ctx, x + w / 2 - 140, y - roofH + 12, 280, 32, 6);
      ctx.fill();
      ctx.strokeStyle = P.brassGold;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = P.mendlsLight;
      ctx.font = "bold 15px 'Georgia', 'Songti SC', serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("HOTEL BOLTZMANN · 微观粒子大饭店", x + w / 2, y - roofH + 28);
    }

    ctx.fillStyle = opts.darkInterior ? "#1E1022" : P.mendlsLight;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = P.lobbyPlum;
    ctx.lineWidth = 5;
    ctx.strokeRect(x, y, w, h);

    const floorCount = floors.length;
    const floorH = h / floorCount;

    for (let i = 0; i < floorCount; i++) {
      const fy = y + i * floorH;
      const fInfo = floors[i];

      ctx.fillStyle = fInfo.bg || "rgba(244, 214, 204, 0.35)";
      ctx.fillRect(x + 3, fy + 3, w - 6, floorH - 6);

      const winCount = 5;
      const winSpan = (w - 160) / winCount;
      for (let k = 0; k < winCount; k++) {
        const wx = x + 95 + k * winSpan + winSpan * 0.2;
        const ww = winSpan * 0.6;
        const wh = floorH * 0.58;
        const wy = fy + floorH * 0.22;
        ctx.fillStyle = opts.darkInterior ? "rgba(107, 154, 196, 0.08)" : "rgba(74, 37, 69, 0.07)";
        drawRoundRect(ctx, wx, wy, ww, wh, ww / 2);
        ctx.fill();
        ctx.strokeStyle = rgba(P.brassGold, 0.35);
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.fillStyle = P.lobbyPlum;
      ctx.fillRect(x, fy + floorH - 12, w, 12);
      ctx.fillStyle = P.brassGold;
      ctx.fillRect(x, fy + floorH - 12, w, 4);

      ctx.fillStyle = fInfo.badgeColor || P.lobbyPlum;
      drawRoundRect(ctx, x + 14, fy + 16, 118, 42, 8);
      ctx.fill();
      ctx.strokeStyle = P.brassGold;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = P.mendlsLight;
      ctx.font = "bold 20px 'Georgia', 'PingFang SC', serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(fInfo.label, x + 73, fy + 37);
    }

    ctx.restore();
  }

  function renderS1AndS2(ctx, t, W, H, P) {
    const cx = W * 0.5;
    const cy = H * 0.45;
    const morph1 = smoothstep(1.85, 2.52, t);
    const morph2 = smoothstep(6.75, 7.55, t);

    if (t < 2.65) {
      const sway = Math.sin(t * 3.2) * 0.09 * (1 - morph1);
      ctx.save();
      ctx.translate(cx, 60);
      ctx.rotate(sway);

      const cordLen = lerp(190, cy - 60, morph1);
      ctx.strokeStyle = P.brassGold;
      ctx.lineWidth = 5 * (1 - morph1 * 0.7);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, cordLen);
      ctx.stroke();

      const armScale = 1 - morph1;
      if (armScale > 0.02) {
        ctx.save();
        ctx.translate(0, cordLen);
        ctx.scale(armScale, armScale);
        ctx.strokeStyle = P.brassGold;
        ctx.lineWidth = 6;
        for (let side of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(0, -20);
          ctx.bezierCurveTo(side * 60, -10, side * 110, 40, side * 130, 10);
          ctx.stroke();
          ctx.fillStyle = rgba(P.sunGold, 0.55);
          ctx.beginPath();
          ctx.arc(side * 130, 0, 16, 0, TAU);
          ctx.fill();
        }
        ctx.restore();
      }

      const bulbR = lerp(42, 16, morph1);
      const bulbColor = lerpColor(P.sunGold, P.carpetRed, morph1);
      const glow = ctx.createRadialGradient(0, cordLen, 5, 0, cordLen, bulbR * 3.5);
      glow.addColorStop(0, rgba(bulbColor, 0.75));
      glow.addColorStop(1, rgba(bulbColor, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, cordLen, bulbR * 3.5, 0, TAU);
      ctx.fill();

      ctx.fillStyle = bulbColor;
      ctx.beginPath();
      ctx.arc(0, cordLen, bulbR, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = P.mendlsLight;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();

      const nPhotons = 44;
      for (let i = 0; i < nPhotons; i++) {
        const angle = (i / nPhotons) * TAU + hash(i) * 0.5;
        const speed = 75 + hash(i + 10) * 140;
        const life = ((t * 0.9 + hash(i + 20)) % 1.0);
        const rad = 45 + life * speed * 1.4;
        const sx = cx + Math.cos(angle + Math.sin(t * 2 + i) * 0.4) * rad;
        const sy = (60 + 190) + Math.sin(angle + Math.cos(t * 2 + i) * 0.4) * rad;
        const tx = lerp(160, W - 160, i / nPhotons);
        const ty = cy;

        const px = lerp(sx, tx, easeInOutCubic(morph1));
        const py = lerp(sy, ty, easeInOutCubic(morph1));
        const pColor = lerpColor(P.sunGold, P.carpetRed, morph1);
        const pr = lerp(5 + (i % 3) * 2, 7, morph1);

        if (morph1 < 0.8) {
          ctx.strokeStyle = rgba(pColor, (1 - life * 0.7) * (1 - morph1));
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px - Math.cos(angle) * 22, py - Math.sin(angle) * 22);
          ctx.stroke();
        }

        ctx.fillStyle = rgba(pColor, lerp(0.55 + 0.4 * (1 - life), 0.95, morph1));
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, TAU);
        ctx.fill();
      }

      const lblAlpha = smoothstep(0.35, 0.75, t) * (1 - morph1);
      if (lblAlpha > 0.01) {
        ctx.save();
        ctx.globalAlpha = lblAlpha;
        ctx.fillStyle = P.mendlsLight;
        ctx.font = "bold 30px 'Georgia', 'PingFang SC', serif";
        ctx.textAlign = "center";
        ctx.fillText("普通热辐射光源 · 自发辐射（方向散乱、相位随机）", cx, H * 0.74);
        ctx.restore();
      }
    }

    if (t >= 2.35) {
      const beamIgnite = smoothstep(2.40, 2.85, t);
      const plaqueOpen = spring(t, 5.50, 5.5, 0.48);

      const beamHalfH = lerp(4, 34, beamIgnite) * (1 - plaqueOpen * 0.65) * (1 - morph2);
      if (beamHalfH > 0.5) {
        const halo = ctx.createLinearGradient(0, cy - beamHalfH * 3.5, 0, cy + beamHalfH * 3.5);
        halo.addColorStop(0, rgba(P.carpetRed, 0));
        halo.addColorStop(0.5, rgba(P.carpetRed, 0.65));
        halo.addColorStop(1, rgba(P.carpetRed, 0));
        ctx.fillStyle = halo;
        ctx.fillRect(60, cy - beamHalfH * 3.5, W - 120, beamHalfH * 7);

        ctx.fillStyle = P.carpetRed;
        ctx.fillRect(60, cy - beamHalfH, W - 120, beamHalfH * 2);
        ctx.fillStyle = P.sunGold;
        ctx.fillRect(60, cy - beamHalfH * 0.38, W - 120, beamHalfH * 0.76);

        ctx.save();
        for (let i = 0; i < 48; i++) {
          const ux = ((i / 48) + t * 1.65) % 1.0;
          const lx = 80 + ux * (W - 160);
          const ly = cy + Math.sin(ux * TAU * 8 - t * 25) * (beamHalfH * 0.75);
          ctx.fillStyle = i % 2 === 0 ? P.sunGold : "#FFFFFF";
          ctx.beginPath();
          ctx.arc(lx, ly, 5.5, 0, TAU);
          ctx.fill();
        }
        ctx.restore();
      }

      if (t >= 4.40 && t < 5.75) {
        const secScale = spring(t, 4.42, 6.0, 0.5);
        ctx.save();
        ctx.translate(cx, cy - 110);
        ctx.scale(secScale, secScale);
        ctx.fillStyle = P.lobbyPlum;
        drawRoundRect(ctx, -180, -32, 360, 64, 12);
        ctx.fill();
        ctx.strokeStyle = P.brassGold;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = P.sunGold;
        ctx.font = "bold 28px 'PingFang SC', 'Georgia', serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("✦ 秘密就在于 · THE SECRET ✦", 0, 0);
        ctx.restore();
      }

      if (t >= 5.50) {
        const pW = lerp(760, 860, easeInOutCubic(morph2));
        const pH = lerp(240, 560, easeInOutCubic(morph2));
        const px = lerp(cx - pW / 2, 140, easeInOutCubic(morph2));
        const py = lerp(cy - pH / 2, 195, easeInOutCubic(morph2));
        const scaleIn = clamp(plaqueOpen, 0, 1.15);

        ctx.save();
        if (morph2 < 0.01) {
          ctx.translate(cx, cy);
          ctx.scale(scaleIn, scaleIn);
          ctx.translate(-cx, -cy);
        }

        ctx.fillStyle = lerpColor(P.carpetRed, P.mendlsLight, morph2);
        drawRoundRect(ctx, px, py, pW, pH, lerp(18, 4, morph2));
        ctx.fill();
        ctx.strokeStyle = lerpColor(P.brassGold, P.lobbyPlum, morph2);
        ctx.lineWidth = 6;
        ctx.stroke();

        const topBeamY = lerp(py + 18, py + pH * 0.5 - 12, easeInOutCubic(morph2));
        const botBeamY = py + pH - 16;
        ctx.fillStyle = P.brassGold;
        ctx.fillRect(px + 6, topBeamY, pW - 12, 8);
        ctx.fillRect(px + 6, botBeamY, pW - 12, 8);

        const textAlpha = 1 - smoothstep(6.75, 7.25, t);
        if (textAlpha > 0.01) {
          ctx.save();
          ctx.globalAlpha = textAlpha;
          ctx.fillStyle = P.sunGold;
          ctx.font = "bold 20px 'Georgia', serif";
          ctx.textAlign = "center";
          ctx.fillText("GRAND BUDAPEST PHYSICS SOCIETY PRESENTS", px + pW / 2, py + 55);

          ctx.fillStyle = P.mendlsLight;
          ctx.font = "bold 84px 'Songti SC', 'PingFang SC', serif";
          ctx.fillText("粒子数反转", px + pW / 2, py + 135);

          ctx.fillStyle = P.sunGold;
          ctx.font = "bold 24px 'Georgia', serif";
          ctx.fillText("POPULATION INVERSION · N₂ ≫ N₁", px + pW / 2, py + 195);
          ctx.restore();
        }
        ctx.restore();
      }
    }
  }

  function renderS3(ctx, t, W, H, P) {
    const morphToS4 = smoothstep(15.05, 15.85, t);
    const hx = 140, hy = 195, hw = 860, hh = 560;

    drawHotelCrossSection(
      ctx, hx, hy, hw, hh,
      [
        { label: "二楼 E₂", badgeColor: P.roseRed, bg: "rgba(232, 180, 184, 0.25)" },
        { label: "一楼 E₁", badgeColor: P.lobbyPlum, bg: "rgba(244, 214, 204, 0.55)" }
      ],
      P
    );

    ctx.save();
    ctx.fillStyle = rgba(P.lobbyPlum, 0.55);
    ctx.font = "bold 22px 'PingFang SC', serif";
    ctx.textAlign = "right";
    ctx.fillText("激发态高能级 · 几乎空无一人 (N₂ ≈ 0)", hx + hw - 24, hy + 42);
    ctx.fillText("基态低能级 · 粒子全挤在一楼 (N₁ 极大)", hx + hw - 24, hy + hh * 0.5 + 42);
    ctx.restore();

    const e1FloorY = hy + hh - 34;
    for (let i = 0; i < 28; i++) {
      const row = i < 16 ? 0 : 1;
      const col = row === 0 ? i : i - 16;
      const maxCols = row === 0 ? 16 : 12;
      const baseX = hx + 165 + (col / (maxCols - 1)) * (hw - 210);
      const baseY = e1FloorY - row * 38;
      const bobX = Math.sin(t * 1.8 + i) * 3;
      const bobY = Math.cos(t * 2.2 + i * 0.7) * 2.5;
      drawParticle(ctx, baseX + bobX, baseY + bobY, 18, P.carpetRed, "sleepy", t, i);
    }

    const cardAppear = spring(t, 10.50, 5.0, 0.55);
    if (cardAppear > 0.01) {
      const rx = 1060, ry = 195, rw = 720, rh = 560;
      const axX = rx + 110, axY = ry + rh - 55, axW = rw - 170, axH = 310;

      ctx.save();
      ctx.globalAlpha = clamp(cardAppear * (1 - morphToS4 * 0.85), 0, 1);
      ctx.fillStyle = P.mendlsLight;
      drawRoundRect(ctx, rx, ry, rw, rh, 14);
      ctx.fill();
      ctx.strokeStyle = P.lobbyPlum;
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.fillStyle = P.lobbyPlum;
      drawRoundRect(ctx, rx + 24, ry + 20, rw - 48, 52, 8);
      ctx.fill();
      ctx.fillStyle = P.sunGold;
      ctx.font = "bold 24px 'Georgia', 'PingFang SC', serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("BOLTZMANN 玻尔兹曼分布", rx + rw / 2, ry + 46);

      ctx.fillStyle = P.inkDark;
      ctx.font = "italic bold 32px 'Georgia', serif";
      ctx.fillText("N₂ / N₁ = e", rx + rw * 0.37, ry + 135);
      ctx.font = "italic bold 20px 'Georgia', serif";
      ctx.fillText("−(E₂ − E₁) / kT", rx + rw * 0.55, ry + 116);
      ctx.font = "bold 34px 'Georgia', serif";
      ctx.fillStyle = P.carpetRed;
      ctx.fillText("≪ 1", rx + rw * 0.77, ry + 135);

      ctx.strokeStyle = P.inkDark;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(axX, axY - axH);
      ctx.lineTo(axX, axY);
      ctx.lineTo(axX + axW, axY);
      ctx.stroke();

      ctx.fillStyle = P.inkDark;
      ctx.font = "italic bold 26px 'Georgia', serif";
      ctx.fillText("E", axX - 28, axY - axH + 10);
      ctx.fillText("N", axX + axW - 10, axY + 32);

      const levels = [
        { name: "E₁", y: axY - 6, dots: 18 },
        { name: "E₂", y: axY - 165, dots: 4 },
        { name: "E₃", y: axY - 235, dots: 2 }
      ];
      for (let lv of levels) {
        ctx.fillStyle = P.inkDark;
        ctx.font = "italic bold 22px 'Georgia', serif";
        ctx.textAlign = "right";
        ctx.fillText(lv.name, axX - 16, lv.y + 4);

        for (let d = 0; d < lv.dots; d++) {
          const dotAppear = smoothstep(11.2 + d * 0.06, 11.5 + d * 0.06, t);
          if (dotAppear > 0) {
            ctx.fillStyle = P.carpetRed;
            ctx.beginPath();
            ctx.arc(axX + 14 + d * 24, lv.y, 7 * dotAppear, 0, TAU);
            ctx.fill();
          }
        }
      }
      ctx.restore();

      const curveProgress = smoothstep(10.85, 12.10, t);
      const thermX = 1420, thermTopY = 230, thermBotY = 670;

      ctx.save();
      ctx.strokeStyle = lerpColor(P.inkDark, P.brassGold, morphToS4);
      ctx.lineWidth = lerp(5, 18, morphToS4);
      ctx.lineCap = "round";
      ctx.beginPath();
      const steps = 40;
      const maxSteps = Math.floor(steps * curveProgress);
      for (let s = 0; s <= maxSteps; s++) {
        const u = s / steps;
        const cx0 = axX + 18 + Math.pow(u, 2.3) * (axW - 60);
        const cy0 = (axY - axH + 25) + u * (axH - 31);
        const cx1 = thermX;
        const cy1 = lerp(thermTopY, thermBotY, u);
        const px = lerp(cx0, cx1, easeInOutCubic(morphToS4));
        const py = lerp(cy0, cy1, easeInOutCubic(morphToS4));
        if (s === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      if (morphToS4 > 0.05) {
        ctx.fillStyle = P.carpetRed;
        ctx.beginPath();
        ctx.arc(thermX, thermBotY + 15, 34 * morphToS4, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = P.brassGold;
        ctx.lineWidth = 4;
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function renderS4(ctx, t, W, H, P) {
    const morphToSun = smoothstep(19.30, 20.05, t);
    const heatLevel = smoothstep(16.0, 17.6, t);
    const hx = 140, hy = 195, hw = 860, hh = 560;

    drawHotelCrossSection(
      ctx, hx, hy, hw, hh,
      [
        { label: "二楼 E₂", badgeColor: P.roseRed, bg: "rgba(232, 180, 184, 0.28)" },
        { label: "一楼 E₁", badgeColor: P.lobbyPlum, bg: "rgba(232, 168, 56, 0.32)" }
      ],
      P
    );

    ctx.save();
    for (let k = 0; k < 18; k++) {
      const fx = hx + 60 + (k / 17) * (hw - 120);
      const fy = hy + hh + 12;
      const flameH = (18 + 14 * Math.sin(t * 14 + k)) * heatLevel * (1 - morphToSun);
      if (flameH > 1) {
        ctx.fillStyle = k % 2 === 0 ? P.carpetRed : P.sunGold;
        ctx.beginPath();
        ctx.moveTo(fx - 18, fy);
        ctx.quadraticCurveTo(fx, fy - flameH * 1.8, fx + 18, fy);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();

    const e1FloorY = hy + hh - 34;
    const e2FloorY = hy + hh * 0.5 - 34;
    for (let i = 0; i < 26; i++) {
      if (i < 2 && t >= 17.2) {
        const hop = smoothstep(17.2 + i * 0.25, 17.7 + i * 0.25, t);
        const px = hx + 360 + i * 180 + Math.sin(t * 12 + i) * 6;
        const py = lerp(e1FloorY, e2FloorY, hop) - Math.sin(hop * PI) * 50;
        drawParticle(ctx, px, py, 18, P.roseRed, "hot", t, i);
      } else {
        const row = i < 15 ? 0 : 1;
        const col = row === 0 ? i : i - 15;
        const maxCols = row === 0 ? 15 : 11;
        const baseX = hx + 165 + (col / Math.max(1, maxCols - 1)) * (hw - 210);
        const baseY = e1FloorY - row * 38;
        const jitterX = Math.sin(t * 28 + i * 3.1) * 8 * heatLevel;
        const jitterY = -Math.abs(Math.cos(t * 24 + i * 2.3)) * 18 * heatLevel;
        drawParticle(ctx, baseX + jitterX, baseY + jitterY, 18, P.carpetRed, "hot", t, i);
      }
    }

    if (t >= 17.5) {
      const aAlpha = smoothstep(17.5, 17.9, t) * (1 - morphToSun);
      ctx.save();
      ctx.globalAlpha = aAlpha;
      ctx.fillStyle = P.carpetRed;
      ctx.font = "bold 24px 'PingFang SC', 'Georgia', serif";
      ctx.textAlign = "center";
      ctx.fillText("T = 3000 K (λ = 500 nm) 热辐射光源：N₂ / N₁ 依然远小于 1！", hx + hw * 0.54, hy + 88);
      ctx.restore();
    }

    const thermX = 1420, thermTopY = 230, thermBotY = 670;
    ctx.save();
    ctx.globalAlpha = 1 - morphToSun;
    ctx.fillStyle = P.mendlsLight;
    drawRoundRect(ctx, thermX - 180, thermTopY - 45, 360, 520, 20);
    ctx.fill();
    ctx.strokeStyle = P.lobbyPlum;
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = "#2A1528";
    drawRoundRect(ctx, thermX - 22, thermTopY, 44, thermBotY - thermTopY, 22);
    ctx.fill();
    ctx.strokeStyle = P.brassGold;
    ctx.lineWidth = 5;
    ctx.stroke();

    const mercTop = lerp(thermBotY - 40, thermTopY + 35, easeInOutCubic(heatLevel));
    ctx.fillStyle = P.carpetRed;
    drawRoundRect(ctx, thermX - 14, mercTop, 28, thermBotY - mercTop + 10, 14);
    ctx.fill();

    ctx.fillStyle = P.inkDark;
    ctx.font = "bold 20px 'Georgia', serif";
    ctx.textAlign = "left";
    const temps = ["3000 K", "2000 K", "1000 K", "300 K"];
    for (let ti = 0; ti < 4; ti++) {
      const ty = thermTopY + 40 + ti * 115;
      ctx.fillRect(thermX + 28, ty - 2, 18, 4);
      ctx.fillText(temps[ti], thermX + 54, ty + 6);
    }

    const curK = Math.round(lerp(300, 3000, easeInOutCubic(heatLevel)));
    ctx.fillStyle = P.carpetRed;
    drawRoundRect(ctx, thermX - 160, mercTop - 22, 125, 44, 8);
    ctx.fill();
    ctx.fillStyle = P.mendlsLight;
    ctx.font = "bold 22px 'Georgia', serif";
    ctx.textAlign = "center";
    ctx.fillText(curK + " K", thermX - 97, mercTop + 6);
    ctx.restore();

    const bulbStartX = thermX, bulbStartY = thermBotY + 15;
    const sunTargetX = 1140, sunTargetY = 300;
    const bx = lerp(bulbStartX, sunTargetX, easeInOutCubic(morphToSun));
    const bounceArc = Math.sin(morphToSun * PI) * 190;
    const by = lerp(bulbStartY, sunTargetY, easeInOutCubic(morphToSun)) - bounceArc;
    const bRadius = lerp(38, 52, morphToSun);
    const bColor = lerpColor(P.carpetRed, P.sunGold, morphToSun);

    if (morphToSun > 0.15) {
      drawStarburst(
        ctx, bx, by,
        bRadius * (1.45 + 0.25 * morphToSun),
        bRadius * 1.05, 12, t * 2.5,
        rgba(P.sunGold, morphToSun * 0.85), P.brassGold
      );
    }

    ctx.fillStyle = bColor;
    ctx.beginPath();
    ctx.arc(bx, by, bRadius, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = P.brassGold;
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  function renderS5(ctx, t, W, H, P) {
    const morphToScale = smoothstep(23.65, 24.45, t);
    const darkInterior = t >= 21.35 && t < 24.2;
    const hx = 140, hy = 195, hw = 860, hh = 560;

    ctx.save();
    ctx.globalAlpha = 1 - morphToScale;
    drawHotelCrossSection(
      ctx, hx, hy, hw, hh,
      [
        { label: "二楼 E₂", badgeColor: P.roseRed },
        { label: "一楼 E₁", badgeColor: P.lobbyPlum }
      ],
      P, { darkInterior: darkInterior }
    );
    ctx.restore();

    const flyU = smoothstep(20.05, 21.32, t);
    const eatMoment = t >= 21.32;
    const targetParticleX = 580, targetParticleY = hy + hh - 42;

    if (!eatMoment) {
      const sx = lerp(1140, targetParticleX, easeInOutCubic(flyU));
      const sy = lerp(300, targetParticleY - 25, easeInOutCubic(flyU)) - Math.sin(flyU * PI) * 110;
      const sr = lerp(52, 28, flyU * 0.7);

      drawStarburst(ctx, sx, sy, sr * 1.6, sr * 1.1, 12, t * 3.0, P.sunGold, P.brassGold);
      ctx.fillStyle = "#FFF5CC";
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, TAU);
      ctx.fill();
      ctx.fillStyle = P.inkDark;
      ctx.font = "bold 20px 'Georgia', serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("hν 光子", sx, sy);
    }

    const e1FloorY = hy + hh - 34;
    if (morphToScale < 0.95) {
      ctx.save();
      ctx.globalAlpha = 1 - morphToScale;
      for (let i = 0; i < 20; i++) {
        if (i === 10) continue;
        const px = hx + 165 + (i / 19) * (hw - 210);
        drawParticle(ctx, px, e1FloorY, 18, P.carpetRed, "sleepy", t, i);
      }
      ctx.restore();
    }

    const swallowPulse = eatMoment ? Math.exp(-(t - 21.32) * 3.5) * Math.sin((t - 21.32) * 22) * 16 : 0;
    const heroX = lerp(targetParticleX, W * 0.5, easeInOutCubic(morphToScale));
    const heroY = lerp(targetParticleY, H * 0.48, easeInOutCubic(morphToScale));
    const heroR = lerp(26 + swallowPulse, 44, easeInOutCubic(morphToScale));
    const heroColor = eatMoment ? lerpColor(P.sunGold, P.brassGold, smoothstep(21.32, 22.2, t)) : P.carpetRed;

    if (eatMoment && morphToScale < 0.8) {
      const puffT = clamp((t - 21.35) / 2.2, 0, 1);
      ctx.save();
      ctx.globalAlpha = (1 - puffT) * (1 - morphToScale);
      ctx.strokeStyle = P.sunGold;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(targetParticleX, targetParticleY - 30 - puffT * 90, 20 + puffT * 55, 0, TAU);
      ctx.stroke();

      ctx.fillStyle = P.sunGold;
      ctx.font = "bold 28px 'PingFang SC', serif";
      ctx.textAlign = "center";
      ctx.fillText("受激吸收：底层粒子吞噬光子，光无法放大！", hx + hw / 2, hy + hh * 0.32);
      ctx.restore();
    }

    drawParticle(ctx, heroX, heroY, heroR, heroColor, !eatMoment && flyU > 0.55 ? "hungry" : "excited", t, 99);

    if (morphToScale > 0.05) {
      const armHalfW = 420 * easeInOutCubic(morphToScale);
      ctx.save();
      ctx.strokeStyle = P.brassGold;
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(heroX, heroY - 260 * morphToScale);
      ctx.lineTo(heroX, heroY + 260 * morphToScale);
      ctx.moveTo(heroX - armHalfW, heroY);
      ctx.lineTo(heroX + armHalfW, heroY);
      ctx.stroke();
      ctx.restore();
    }
  }

  function renderS6(ctx, t, W, H, P) {
    const cx = W * 0.5, cy = H * 0.47;
    const flipU = easeInOutCubic(smoothstep(27.95, 28.95, t));
    const rotAngle = flipU * PI;
    const morphToRamp = smoothstep(29.40, 30.25, t);

    ctx.save();
    ctx.translate(cx, cy);

    ctx.save();
    ctx.globalAlpha = 1 - morphToRamp;
    ctx.strokeStyle = rgba(P.brassGold, 0.55);
    ctx.lineWidth = 4;
    ctx.setLineDash([14, 10]);
    ctx.beginPath();
    ctx.arc(0, 0, 330, 0, TAU);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.rotate(rotAngle * (1 - morphToRamp));

    const trayW = 760, trayH = 150;
    const fillE2 = smoothstep(25.4, 27.6, t);
    const nE2 = Math.floor(lerp(4, 34, fillE2));

    for (let chamber of [-1, 1]) {
      const isInvertedE2 = chamber === 1;
      const boxY = chamber * 155 - trayH / 2;

      ctx.save();
      if (morphToRamp > 0.01 && isInvertedE2) {
        ctx.rotate(-0.22 * morphToRamp);
      }

      ctx.fillStyle = isInvertedE2 ? "#3B1B38" : P.mendlsLight;
      drawRoundRect(ctx, -trayW / 2, boxY, trayW, trayH, 14);
      ctx.fill();
      ctx.strokeStyle = isInvertedE2 ? P.brassGold : P.lobbyPlum;
      ctx.lineWidth = 5;
      ctx.stroke();

      const count = isInvertedE2 ? nE2 : 5;
      for (let i = 0; i < count; i++) {
        const col = i % 12;
        const row = Math.floor(i / 12);
        const px = -trayW / 2 + 135 + col * 48;
        const py = boxY + trayH * 0.68 - row * 36;
        drawParticle(ctx, px, py, 16, isInvertedE2 ? P.sunGold : P.carpetRed, isInvertedE2 ? "excited" : "sleepy", t, i);
      }

      ctx.save();
      ctx.translate(-trayW / 2 + 65, boxY + trayH / 2);
      ctx.rotate(-rotAngle * (1 - morphToRamp));
      ctx.fillStyle = isInvertedE2 ? P.carpetRed : P.lobbyPlum;
      drawRoundRect(ctx, -48, -24, 96, 48, 8);
      ctx.fill();
      ctx.fillStyle = P.mendlsLight;
      ctx.font = "bold 20px 'Georgia', 'PingFang SC', serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(isInvertedE2 ? "二楼 E₂" : "一楼 E₁", 0, 0);
      ctx.restore();

      ctx.restore();
    }

    ctx.fillStyle = P.brassGold;
    ctx.beginPath();
    ctx.arc(0, 0, 36, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = P.lobbyPlum;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.restore();

    const badgeScale = spring(t, 28.25, 6.0, 0.45) * (1 - morphToRamp);
    if (badgeScale > 0.01) {
      ctx.save();
      ctx.translate(580, 0);
      ctx.scale(badgeScale, badgeScale);
      ctx.fillStyle = P.carpetRed;
      drawRoundRect(ctx, -165, -75, 330, 150, 16);
      ctx.fill();
      ctx.strokeStyle = P.brassGold;
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.fillStyle = P.sunGold;
      ctx.font = "bold 40px 'Georgia', serif";
      ctx.textAlign = "center";
      ctx.fillText("N₂ ≫ N₁", 0, -14);
      ctx.fillStyle = P.mendlsLight;
      ctx.font = "bold 24px 'PingFang SC', serif";
      ctx.fillText("粒子数反转达成！", 0, 36);
      ctx.restore();
    }

    ctx.restore();
  }

  function renderS7(ctx, t, W, H, P) {
    const morphToPump = smoothstep(34.90, 35.80, t);
    const hx = 220, hy = 195, hw = 1480, hh = 560;

    drawHotelCrossSection(
      ctx, hx, hy, hw, hh,
      [
        { label: "二楼 E₂", badgeColor: P.roseRed, bg: "rgba(232, 180, 184, 0.30)" },
        { label: "一楼 E₁", badgeColor: P.lobbyPlum, bg: "rgba(244, 214, 204, 0.55)" }
      ],
      P
    );

    const e1Y = hy + hh - 34;
    const e2Y = hy + hh * 0.5 - 34;

    ctx.save();
    ctx.fillStyle = P.carpetRed;
    drawRoundRect(ctx, hx + hw / 2 - 230, hy + 28, 460, 44, 8);
    ctx.fill();
    ctx.fillStyle = P.mendlsLight;
    ctx.font = "bold 20px 'PingFang SC', serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("⚠ 二能级直接抽运：E₂ 激发态极不稳定，很快辐射跃迁掉回 E₁", hx + hw / 2, hy + 50);
    ctx.restore();

    for (let i = 0; i < 16; i++) {
      const delay = i * 0.045;
      const uUp = clamp((t - (30.5 + delay)) / 1.5, 0, 1);
      const uFall = clamp((t - (33.1 + delay)) / 1.2, 0, 1);

      let px = hx + 260 + i * 68;
      let py = e1Y;

      if (uFall <= 0) {
        py = lerp(e1Y, e2Y, easeOutBack(uUp));
        if (uUp >= 0.95) {
          px += Math.sin(t * 45 + i * 2) * 7;
          py += Math.cos(t * 40 + i) * 4;
        }
      } else {
        px += uFall * 95;
        py = lerp(e2Y, e1Y, uFall * uFall) - Math.sin(uFall * PI) * 35;
      }

      if (i === 0 && morphToPump > 0.01) {
        px = lerp(px, hx + 215, easeInOutCubic(morphToPump));
        py = lerp(py, e1Y - 40, easeInOutCubic(morphToPump));
      }

      drawParticle(ctx, px, py, 19, uUp > 0.5 && uFall < 0.5 ? P.sunGold : P.carpetRed, "hot", t, i);
    }

    if (morphToPump > 0.05) {
      const pumpH = 380 * easeOutBack(morphToPump);
      const pumpX = hx + 160;
      const pumpY = hy + hh - 12 - pumpH;
      ctx.save();
      ctx.fillStyle = P.brassGold;
      drawRoundRect(ctx, pumpX, pumpY, 110, pumpH, 12);
      ctx.fill();
      ctx.strokeStyle = P.lobbyPlum;
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.restore();
    }
  }

  function renderS8(ctx, t, W, H, P) {
    const morphToResonator = smoothstep(46.70, 47.55, t);
    const hx = 220, hy = 185, hw = 1480, hh = 570;

    drawHotelCrossSection(
      ctx, hx, hy, hw, hh,
      [
        { label: "三楼 E₃", badgeColor: P.alpineMint, bg: "rgba(107, 154, 196, 0.22)" },
        { label: "二楼 E₂", badgeColor: P.carpetRed, bg: "rgba(217, 56, 58, 0.16)" },
        { label: "一楼 E₁", badgeColor: P.lobbyPlum, bg: "rgba(244, 214, 204, 0.45)" }
      ],
      P
    );

    const floorH = hh / 3;
    const yE3 = hy + floorH * 0.65;
    const yE2 = hy + floorH * 1.65;
    const yE1 = hy + floorH * 2.65;

    const pumpX = hx + 215;
    ctx.save();
    ctx.globalAlpha = 1 - morphToResonator;

    ctx.fillStyle = "rgba(232, 168, 56, 0.18)";
    ctx.fillRect(pumpX - 36, hy + 24, 72, hh - 40);
    ctx.strokeStyle = P.brassGold;
    ctx.lineWidth = 5;
    ctx.strokeRect(pumpX - 36, hy + 24, 72, hh - 40);

    const pistonCycle = t >= 36.5 ? Math.sin((t - 36.5) * 8) * 18 : 0;
    ctx.fillStyle = P.carpetRed;
    drawRoundRect(ctx, pumpX - 48, yE1 - 20 + pistonCycle, 96, 54, 10);
    ctx.fill();
    ctx.strokeStyle = P.brassGold;
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = P.mendlsLight;
    ctx.font = "bold 17px 'PingFang SC', serif";
    ctx.textAlign = "center";
    ctx.fillText("能量泵浦", pumpX, yE1 + 8 + pistonCycle);

    if (t >= 38.0) {
      for (let a = 0; a < 6; a++) {
        const ay = yE1 - 40 - (((t * 2.2 + a * 0.16) % 1.0) * (yE1 - yE3));
        ctx.fillStyle = P.sunGold;
        ctx.beginPath();
        ctx.moveTo(pumpX, ay - 14);
        ctx.lineTo(pumpX - 14, ay + 6);
        ctx.lineTo(pumpX + 14, ay + 6);
        ctx.closePath();
        ctx.fill();
      }
    }

    const slideAppear = smoothstep(40.5, 41.3, t);
    if (slideAppear > 0.01) {
      ctx.save();
      ctx.globalAlpha = slideAppear * (1 - morphToResonator);
      ctx.strokeStyle = P.alpineMint;
      ctx.lineWidth = 22;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(pumpX + 55, yE3 + 10);
      ctx.bezierCurveTo(pumpX + 205, yE3 + 10, pumpX + 150, yE2 - 10, pumpX + 295, yE2 + 4);
      ctx.stroke();

      ctx.strokeStyle = P.brassGold;
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.fillStyle = P.lobbyPlum;
      ctx.font = "bold 18px 'PingFang SC', serif";
      ctx.textAlign = "left";
      ctx.fillText("无辐射跃迁滑梯 (E₃ → E₂ 快速弛豫)", pumpX + 105, yE3 - 26);
      ctx.restore();
    }
    ctx.restore();

    const totalParticles = 36;
    let e2Count = 0;
    let e1Count = 0;

    for (let i = 0; i < totalParticles; i++) {
      const launchT = 38.2 + (i / totalParticles) * 6.8;
      const dt = t - launchT;

      let px, py, pState, pColor;

      if (dt < 0) {
        e1Count++;
        const col = i % 14;
        const row = Math.floor(i / 14);
        px = hx + 585 + col * 46;
        py = yE1 + 10 - row * 34;
        pState = "sleepy";
        pColor = P.lobbyPlum;
      } else if (dt < 0.75) {
        const u = dt / 0.75;
        px = pumpX + Math.sin(u * PI * 4) * 8;
        py = lerp(yE1, yE3, easeInOutCubic(u));
        pState = "pumped";
        pColor = P.sunGold;
      } else if (dt < 1.55) {
        const u = (dt - 0.75) / 0.80;
        const p0x = pumpX + 40, p0y = yE3 + 6;
        const p1x = pumpX + 200, p1y = yE3 + 10;
        const p2x = pumpX + 150, p2y = yE2 - 10;
        const p3x = pumpX + 295, p3y = yE2 + 4;
        const iu = 1 - u;
        px = iu*iu*iu*p0x + 3*iu*iu*u*p1x + 3*iu*u*u*p2x + u*u*u*p3x;
        py = iu*iu*iu*p0y + 3*iu*iu*u*p1y + 3*iu*u*u*p2y + u*u*u*p3y;
        pState = "excited";
        pColor = P.alpineMint;
      } else {
        e2Count++;
        const settleU = clamp((dt - 1.55) / 0.5, 0, 1);
        const col = i % 12;
        const row = Math.floor(i / 12);
        const targetX = hx + 585 + col * 58;
        const targetY = yE2 + 14 - row * 36;
        px = lerp(pumpX + 295, targetX, easeOutBack(settleU)) + Math.sin(t * 4 + i) * 2.5;
        py = lerp(yE2 + 4, targetY, easeOutBack(settleU)) + Math.cos(t * 3.5 + i) * 2.5;
        pState = "excited";
        pColor = i % 2 === 0 ? P.carpetRed : P.sunGold;
      }

      drawParticle(ctx, px, py, 16.5, pColor, pState, t, i);
    }

    ctx.save();
    ctx.globalAlpha = 1 - morphToResonator;
    const boardX = hx + hw - 320;
    const boardY = hy + 22;
    ctx.fillStyle = P.lobbyPlum;
    drawRoundRect(ctx, boardX, boardY, 295, 130, 12);
    ctx.fill();
    ctx.strokeStyle = P.brassGold;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = P.sunGold;
    ctx.font = "bold 20px 'PingFang SC', 'Georgia', serif";
    ctx.textAlign = "left";
    ctx.fillText("二楼粒子 N₂ : " + e2Count, boardX + 24, boardY + 42);
    ctx.fillStyle = P.mendlsPink;
    ctx.fillText("一楼粒子 N₁ : " + e1Count, boardX + 24, boardY + 78);

    const inverted = e2Count > e1Count;
    ctx.fillStyle = inverted ? P.sunGold : P.blushPink;
    ctx.font = "bold 19px 'PingFang SC', serif";
    ctx.fillText(inverted ? "★ N₂ > N₁ 粒子数反转达成！" : "正在抽运积累中...", boardX + 24, boardY + 112);
    ctx.restore();

    if (morphToResonator > 0.01) {
      const mLeftX = lerp(hx, 340, easeInOutCubic(morphToResonator));
      const mRightX = lerp(hx + hw, W - 340, easeInOutCubic(morphToResonator));
      ctx.save();
      ctx.fillStyle = P.alpineMint;
      ctx.strokeStyle = P.brassGold;
      ctx.lineWidth = 5;
      drawRoundRect(ctx, mLeftX - 18, hy + 90, 24, hh - 140, 8);
      ctx.fill();
      ctx.stroke();
      drawRoundRect(ctx, mRightX - 6, hy + 90, 24, hh - 140, 8);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  function renderS9(ctx, t, W, H, P) {
    const morphToCrest = smoothstep(53.55, 54.45, t);
    const cx = W * 0.5, cy = H * 0.46;

    if (morphToCrest < 0.98) {
      ctx.save();
      ctx.globalAlpha = 1 - morphToCrest;

      const chX = 280, chY = 185, chW = W - 560, chH = 560;
      ctx.fillStyle = "#1B0E1E";
      drawRoundRect(ctx, chX, chY, chW, chH, 16);
      ctx.fill();
      ctx.strokeStyle = P.brassGold;
      ctx.lineWidth = 4;
      ctx.stroke();

      const yE2 = chY + 165;
      const yE1 = chY + chH - 95;

      ctx.strokeStyle = rgba(P.roseRed, 0.6);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(chX + 30, yE2);
      ctx.lineTo(chX + chW - 30, yE2);
      ctx.stroke();

      ctx.strokeStyle = rgba(P.mendlsPink, 0.4);
      ctx.beginPath();
      ctx.moveTo(chX + 30, yE1);
      ctx.lineTo(chX + chW - 30, yE1);
      ctx.stroke();

      ctx.fillStyle = P.sunGold;
      ctx.font = "bold 20px 'Georgia', 'PingFang SC', serif";
      ctx.textAlign = "left";
      ctx.fillText("E₂ 亚稳态高能级（反转粒子群）", chX + 45, yE2 - 22);
      ctx.fillStyle = P.mendlsPink;
      ctx.fillText("E₁ 基态低能级", chX + 45, yE1 + 36);

      ctx.fillStyle = P.alpineMint;
      drawRoundRect(ctx, chX - 16, chY + 40, 26, chH - 80, 8);
      ctx.fill();
      ctx.strokeStyle = P.brassGold;
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.fillStyle = rgba(P.alpineMint, 0.75);
      drawRoundRect(ctx, chX + chW - 10, chY + 40, 26, chH - 80, 8);
      ctx.fill();
      ctx.stroke();

      const nParticles = 40;
      for (let i = 0; i < nParticles; i++) {
        const col = i % 20;
        const row = Math.floor(i / 20);
        const px = chX + 110 + (col / 19) * (chW - 220);
        const jumpStart = 48.0 + (col / 19) * 1.85;
        const jumpU = smoothstep(jumpStart, jumpStart + 0.55, t);
        const py = lerp(yE2 - row * 34, yE1 - row * 24, easeInOutCubic(jumpU));

        if (jumpU > 0.05 && jumpU < 0.98) {
          ctx.strokeStyle = P.sunGold;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(px, yE2 - row * 34);
          ctx.lineTo(px, py);
          ctx.stroke();

          const phX = px + (t - jumpStart) * 520;
          const phY = (yE2 + yE1) * 0.5 + (row - 0.5) * 36;
          if (phX < W - 40) {
            drawStarburst(ctx, phX, phY, 18, 8, 8, t * 6, P.sunGold, P.carpetRed);
          }
        }

        drawParticle(ctx, px, py, 14.5, jumpU < 0.5 ? P.sunGold : P.carpetRed, jumpU < 0.9 ? "laser" : "excited", t, i);
      }

      if (t >= 50.25) {
        const beamU = smoothstep(50.25, 51.60, t);
        const beamY = (yE2 + yE1) * 0.5;
        const beamH = lerp(12, 175, easeOutBack(beamU));
        const beamEndX = lerp(chX + 120, W, smoothstep(50.25, 51.10, t));

        const outerGrad = ctx.createLinearGradient(0, beamY - beamH * 1.9, 0, beamY + beamH * 1.9);
        outerGrad.addColorStop(0, rgba(P.carpetRed, 0));
        outerGrad.addColorStop(0.5, rgba(P.carpetRed, 0.85));
        outerGrad.addColorStop(1, rgba(P.carpetRed, 0));
        ctx.fillStyle = outerGrad;
        ctx.fillRect(chX + 10, beamY - beamH * 1.9, beamEndX - chX, beamH * 3.8);

        ctx.fillStyle = P.carpetRed;
        ctx.fillRect(chX + 10, beamY - beamH * 0.55, beamEndX - chX, beamH * 1.1);

        ctx.fillStyle = P.sunGold;
        ctx.fillRect(chX + 10, beamY - beamH * 0.25, beamEndX - chX, beamH * 0.5);

        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(chX + 10, beamY - beamH * 0.08, beamEndX - chX, beamH * 0.16);

        for (let k = 0; k < 65; k++) {
          const prog = ((k / 65) + t * 2.2) % 1.0;
          const kx = chX + 20 + prog * (beamEndX - chX - 20);
          const ky = beamY + Math.sin(prog * TAU * 6 - t * 30 + (k % 3)) * (beamH * 0.42);
          ctx.fillStyle = k % 2 === 0 ? "#FFFFFF" : P.sunGold;
          ctx.beginPath();
          ctx.arc(kx, ky, 4 + (k % 3) * 2, 0, TAU);
          ctx.fill();
        }
      }

      ctx.restore();
    }

    if (morphToCrest > 0.01) {
      ctx.save();
      ctx.translate(cx, cy);
      const s = easeOutBack(morphToCrest);
      ctx.scale(s, s);

      drawStarburst(ctx, 0, 0, 290, 230, 24, t * 0.25, rgba(P.sunGold, 0.35), P.brassGold);

      ctx.fillStyle = P.lobbyPlum;
      drawRoundRect(ctx, -420, -190, 840, 380, 28);
      ctx.fill();
      ctx.strokeStyle = P.brassGold;
      ctx.lineWidth = 6;
      ctx.stroke();

      ctx.fillStyle = P.carpetRed;
      drawRoundRect(ctx, -396, -166, 792, 332, 20);
      ctx.fill();
      ctx.strokeStyle = P.sunGold;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.fillStyle = P.sunGold;
      ctx.font = "bold 20px 'Georgia', serif";
      ctx.textAlign = "center";
      ctx.fillText("★ THE GRAND BUDAPEST LASER SOCIETY ★", 0, -115);

      ctx.fillStyle = P.mendlsLight;
      ctx.font = "bold 68px 'Songti SC', 'PingFang SC', serif";
      ctx.fillText("粒子数反转 · 激光之源", 0, -25);

      ctx.fillStyle = P.sunGold;
      ctx.font = "bold 26px 'PingFang SC', 'Georgia', serif";
      ctx.fillText("三能级抽运 (E₁ → E₃ → E₂)  ·  N₂ ≫ N₁  ·  受激辐射光放大", 0, 52);

      ctx.fillStyle = P.mendlsPink;
      ctx.font = "italic 20px 'Georgia', serif";
      ctx.fillText("Light Amplification by Stimulated Emission of Radiation", 0, 112);

      ctx.restore();
    }
  }

  function drawSubtitleBar(ctx, t, W, H, P, subtitles) {
    let activeSub = null;
    for (let i = 0; i < subtitles.length; i++) {
      const s = subtitles[i];
      if (t >= s.start && t <= s.end) {
        activeSub = s;
        break;
      }
    }
    if (!activeSub) return;

    const fadeIn = smoothstep(activeSub.start, activeSub.start + 0.14, t);
    const fadeOut = 1 - smoothstep(activeSub.end - 0.14, activeSub.end, t);
    const alpha = clamp(fadeIn * fadeOut, 0, 1);

    ctx.save();
    ctx.globalAlpha = alpha;

    const barW = 1220, barH = 104;
    const bx = (W - barW) / 2, by = H - 156;

    ctx.fillStyle = "rgba(35, 19, 38, 0.90)";
    drawRoundRect(ctx, bx, by, barW, barH, 14);
    ctx.fill();
    ctx.strokeStyle = P.brassGold;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.strokeStyle = rgba(P.mendlsPink, 0.35);
    ctx.lineWidth = 1;
    drawRoundRect(ctx, bx + 6, by + 6, barW - 12, barH - 12, 10);
    ctx.stroke();

    ctx.fillStyle = P.mendlsLight;
    ctx.font = "bold 34px 'Songti SC', 'PingFang SC', 'Heiti SC', serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(activeSub.zh, W / 2, by + 38);

    ctx.fillStyle = P.sunGold;
    ctx.font = "italic 19px 'Georgia', 'Times New Roman', serif";
    ctx.fillText(activeSub.en, W / 2, by + 78);

    ctx.restore();
  }

  function renderFrame(ctx, t, width, height) {
    const TL = global.TIMELINE;
    const W = width || TL.width;
    const H = height || TL.height;
    const P = TL.palette;

    t = clamp(t, 0, TL.duration);

    let currentShot = TL.shots[0];
    for (let i = 0; i < TL.shots.length; i++) {
      if (t >= TL.shots[i].start && t <= TL.shots[i].end) {
        currentShot = TL.shots[i];
        break;
      }
    }

    ctx.save();
    drawGrandBudapestStage(ctx, t, W, H, P, currentShot);

    if (t < 7.55) renderS1AndS2(ctx, t, W, H, P);
    else if (t < 15.85) renderS3(ctx, t, W, H, P);
    else if (t < 20.05) renderS4(ctx, t, W, H, P);
    else if (t < 24.45) renderS5(ctx, t, W, H, P);
    else if (t < 30.25) renderS6(ctx, t, W, H, P);
    else if (t < 35.80) renderS7(ctx, t, W, H, P);
    else if (t < 47.55) renderS8(ctx, t, W, H, P);
    else renderS9(ctx, t, W, H, P);

    drawSubtitleBar(ctx, t, W, H, P, TL.subtitles);
    ctx.restore();
  }

  global.renderFrame = renderFrame;
})(typeof window !== "undefined" ? window : globalThis);
