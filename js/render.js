'use strict';
/* render.js
   Everything drawn on the canvas: sky, ground, outside equipment, the habitat rooms,
   the astronaut and the weather. */

const cv = $('cv'), ctx = cv.getContext('2d');
let STARS = [], ROCKS = [], vignette = null;
const TOP = 232; // ceiling height of the habitat
const ROOMS = [['airlock', 1000, 1150], ['life', 1150, 1500], ['farm', 1500, 1850], ['command', 1850, 2170], ['quarters', 2170, 2450]];

/* ---------- small helpers ---------- */
function rr(x, y, w, h, r, fill, stroke, lw) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.stroke(); }
}
function circ(x, y, r, fill, stroke, lw) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.stroke(); }
}
function line(x1, y1, x2, y2, col, lw) {
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  ctx.strokeStyle = col; ctx.lineWidth = lw || 2; ctx.stroke();
}
function txt(s, x, y, col, font, align) {
  ctx.fillStyle = col; ctx.font = font || '12px system-ui, sans-serif'; ctx.textAlign = align || 'center';
  ctx.fillText(s, x, y);
}
const hexToRgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const toHex = n => Math.round(n).toString(16).padStart(2, '0');
function mixHex(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return '#' + toHex(lerp(A[0], B[0], t)) + toHex(lerp(A[1], B[1], t)) + toHex(lerp(A[2], B[2], t));
}

/* Mars sky colours through the day: [hour, [top, middle, horizon]] */
const SKY_KEYS = [
  [5, ['#0b0b1f', '#1d1a33', '#3a2a3c']],
  [7, ['#5a4660', '#c47f68', '#efb98c']],
  [12, ['#a97c66', '#d4a27a', '#ecc89d']],
  [17.5, ['#7d5e72', '#d58a6b', '#efb98c']],
  [19.5, ['#1f2b4d', '#4a4a73', '#8a6f84']],
  [22, ['#05060f', '#0a0c1c', '#171a2e']]
];
function skyAt(h) {
  let i = 0;
  while (i < SKY_KEYS.length - 2 && h > SKY_KEYS[i + 1][0]) i++;
  const [h0, c0] = SKY_KEYS[i], [h1, c1] = SKY_KEYS[i + 1];
  const t = clamp((h - h0) / (h1 - h0), 0, 1);
  return c0.map((c, k) => mixHex(c, c1[k], t));
}
function lightAt(h) {
  if (h < 5 || h > 21) return 0.05;
  if (h < 7) return lerp(0.05, 0.6, (h - 5) / 2);
  if (h < 12) return lerp(0.6, 1, (h - 7) / 5);
  if (h < 17.5) return lerp(1, 0.8, (h - 12) / 5.5);
  if (h < 19.5) return lerp(0.8, 0.2, (h - 17.5) / 2);
  return lerp(0.2, 0.05, (h - 19.5) / 1.5);
}

function genScenery() {
  STARS = [];
  for (let i = 0; i < 140; i++) STARS.push({ x: Math.random() * VW, y: Math.random() * 300, r: Math.random() < 0.15 ? 2 : 1, p: Math.random() * 6 });
  ROCKS = [];
  const cols = W.id === 'mars' ? ['#8a4a40', '#a25a48', '#7a3f3c', '#c0705a'] : ['#5b6272', '#6c7384', '#4a505f', '#7d8596'];
  for (let i = 0; i < 170; i++) {
    ROCKS.push({ x: Math.random() * WORLD_W, y: GROUND + 6 + Math.random() * (VH - GROUND - 16), w: 3 + Math.random() * (i % 7 === 0 ? 24 : 12), h: 2 + Math.random() * 6, c: pick(cols) });
  }
}

/* ---------- sky, mountains, ground ---------- */
function drawSky(cam, t, mars) {
  let cols;
  if (mars) {
    cols = skyAt(S.hour);
    if (S.storm > 0) cols = cols.map(c => mixHex(c, '#8a5a48', 0.55));
  } else cols = ['#02030a', '#060a18', '#10172b'];
  const g = ctx.createLinearGradient(0, 0, 0, GROUND);
  g.addColorStop(0, cols[0]); g.addColorStop(0.6, cols[1]); g.addColorStop(1, cols[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);

  let starA = mars ? 1 - lightAt(S.hour) : 1;
  if (mars && S.storm > 0) starA *= 0.2;
  STARS.forEach(s => {
    ctx.globalAlpha = clamp(starA, 0, 1) * (0.6 + 0.4 * Math.sin(t * 0.002 + s.p));
    ctx.fillStyle = '#fff';
    ctx.fillRect(((s.x - cam * 0.03) % VW + VW) % VW, s.y, s.r, s.r);
  });
  ctx.globalAlpha = 1;

  if (mars) {
    const f = clamp((S.hour - 6) / 14, 0, 1);
    if (S.hour > 5.5 && S.hour < 20.5) {
      const sx = lerp(120, VW - 120, f), sy = GROUND - 50 - Math.sin(f * Math.PI) * 280;
      const low = 1 - Math.sin(f * Math.PI);
      const gl = ctx.createRadialGradient(sx, sy, 4, sx, sy, 110);
      gl.addColorStop(0, 'rgba(255,230,190,' + (S.storm > 0 ? 0.25 : 0.7) + ')'); gl.addColorStop(1, 'rgba(255,200,150,0)');
      ctx.fillStyle = gl; ctx.fillRect(sx - 120, sy - 120, 240, 240);
      circ(sx, sy, 16, mixHex('#fff4dc', '#ffb070', low), null);
    }
  } else {
    const ex = 880 - cam * 0.02, ey = 110;
    const gl = ctx.createRadialGradient(ex, ey, 20, ex, ey, 90);
    gl.addColorStop(0, 'rgba(120,180,255,.35)'); gl.addColorStop(1, 'rgba(120,180,255,0)');
    ctx.fillStyle = gl; ctx.fillRect(ex - 100, ey - 100, 200, 200);
    circ(ex, ey, 32, '#2f6fb5', null);
    ctx.fillStyle = '#4c9a63';
    ctx.beginPath(); ctx.ellipse(ex - 8, ey - 6, 11, 8, 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(ex + 12, ey + 10, 8, 6, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.beginPath(); ctx.ellipse(ex + 2, ey - 14, 14, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,10,30,.35)';
    ctx.beginPath(); ctx.arc(ex, ey, 32, -Math.PI * 0.5, Math.PI * 0.5); ctx.arc(ex + 14, ey, 32, Math.PI * 0.5, -Math.PI * 0.5, true); ctx.fill();
  }
}
function drawRange(cam, f, base, amp, col, seed) {
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, GROUND);
  for (let x = 0; x <= VW + 20; x += 20) {
    const wx = x + cam * f;
    const y = base - (Math.sin(wx * 0.004 + seed) * amp + Math.sin(wx * 0.011 + seed * 2) * amp * 0.45 + Math.sin(wx * 0.027 + seed) * amp * 0.15);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(VW, GROUND); ctx.closePath(); ctx.fill();
}
function drawGround(cam, mars) {
  const g = ctx.createLinearGradient(0, GROUND - 6, 0, VH);
  g.addColorStop(0, mars ? '#b0624c' : '#7a8190'); g.addColorStop(1, mars ? '#6d3a37' : '#3d4352');
  ctx.fillStyle = g; ctx.fillRect(0, GROUND - 6, VW, VH - GROUND + 6);
  ctx.save(); ctx.translate(-cam, 0);
  ROCKS.forEach(r => {
    if (r.x < cam - 40 || r.x > cam + VW + 40) return;
    ctx.fillStyle = r.c; ctx.beginPath(); ctx.ellipse(r.x, r.y, r.w, r.h, 0, 0, Math.PI * 2); ctx.fill();
  });
  ctx.restore();
}

/* ---------- outside equipment ---------- */
function drawSolar(x, t, mars) {
  const sy = S.sys;
  if (mars) {
    [-135, 0, 135].forEach((dx, i) => {
      const cx = x + dx, w = 112, h = 62, y0 = GROUND - 62 - h;
      line(cx, GROUND, cx, y0 + h, '#aab7c8', 6);
      line(cx - 30, GROUND, cx, y0 + h + 4, '#8c9bb0', 3); line(cx + 30, GROUND, cx, y0 + h + 4, '#8c9bb0', 3);
      const poly = () => { ctx.beginPath(); ctx.moveTo(cx - w / 2, y0 + 10); ctx.lineTo(cx + w / 2, y0); ctx.lineTo(cx + w / 2, y0 + h); ctx.lineTo(cx - w / 2, y0 + h + 10); ctx.closePath(); };
      poly(); ctx.fillStyle = '#1d3b6b'; ctx.fill(); ctx.strokeStyle = '#b7dcff'; ctx.lineWidth = 2; ctx.stroke();
      for (let k = 1; k < 4; k++) line(cx - w / 2 + k * w / 4, y0 + 10 - k * 2.5, cx - w / 2 + k * w / 4, y0 + h + 10 - k * 2.5, '#4f78b0', 1);
      for (let k = 1; k < 3; k++) line(cx - w / 2, y0 + 10 + k * h / 3, cx + w / 2, y0 + k * h / 3, '#4f78b0', 1);
      poly(); ctx.fillStyle = 'rgba(200,140,95,' + (sy.dust / 100 * 0.8).toFixed(2) + ')'; ctx.fill();
      if (sy.panel < 95 && i === 1) {
        ctx.strokeStyle = '#d9ecff'; ctx.lineWidth = 1.5; ctx.beginPath();
        ctx.moveTo(cx - 20, y0 + 6); ctx.lineTo(cx - 5, y0 + 26); ctx.lineTo(cx - 18, y0 + 40); ctx.lineTo(cx + 6, y0 + 58);
        ctx.moveTo(cx + 16, y0 + 4); ctx.lineTo(cx + 24, y0 + 30); ctx.stroke();
        if (Math.sin(t * 0.008) > 0) circ(cx, y0 - 8, 4, '#ff5a5a');
      }
    });
    txt(stName('solar'), x, GROUND - 150, '#f2e6dc', 'bold 13px system-ui, sans-serif');
  } else {
    [0, 1, 2].forEach(i => {
      const bx = x - 110 + i * 74;
      rr(bx, GROUND - 84, 64, 76, 6, S.blanket ? '#c9a24a' : '#6b7487', '#cfd7e6', 2);
      if (S.blanket) { line(bx + 8, GROUND - 70, bx + 56, GROUND - 30, 'rgba(255,240,180,.5)', 1); line(bx + 12, GROUND - 30, bx + 50, GROUND - 76, 'rgba(120,80,20,.4)', 1); }
      rr(bx + 10, GROUND - 24, 44, 8, 3, '#2a3142');
      circ(bx + 54, GROUND - 76, 3, sy.panel < 70 ? '#ff5a5a' : '#6fe3a1');
    });
    rr(x + 130, GROUND - 60, 92, 52, 10, '#4b5565', '#9aa7bb', 2);
    for (let i = 0; i < 5; i++) ctx.fillStyle = '#7e8aa0', ctx.fillRect(x + 138 + i * 16, GROUND - 72, 6, 14);
    rr(x + 150, GROUND - 46, 52, 10, 5, 'rgba(255,150,60,' + (0.6 + 0.25 * Math.sin(t * 0.004)).toFixed(2) + ')');
    txt('RTG', x + 176, GROUND - 22, '#dfe6f2', 'bold 11px system-ui, sans-serif');
    line(x + 100, GROUND - 20, x + 130, GROUND - 24, '#222a38', 4);
    if (sy.panel < 70 && Math.sin(t * 0.01) > 0.3) { circ(x + 176, GROUND - 82, 4, '#ffd36a'); circ(x + 184, GROUND - 90, 2, '#fff'); }
    txt(stName('solar'), x + 20, GROUND - 106, '#e4ecf7', 'bold 13px system-ui, sans-serif');
  }
}
function drawAntenna(x, t) {
  const ok = S.sys.comms;
  line(x, GROUND, x, GROUND - 90, '#b7c3d4', 7);
  line(x - 26, GROUND, x, GROUND - 60, '#8e9db3', 4); line(x + 26, GROUND, x, GROUND - 60, '#8e9db3', 4);
  ctx.save(); ctx.translate(x, GROUND - 100); ctx.rotate(ok ? -0.7 : 0.45);
  ctx.fillStyle = '#e8eef7'; ctx.strokeStyle = '#9fb0c8'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(0, 0, 46, 16, 0, 0, Math.PI); ctx.fill(); ctx.stroke();
  line(0, 0, 0, -30, '#9fb0c8', 3); circ(0, -32, 4, '#ffd36a');
  ctx.restore();
  if (ok) {
    for (let k = 0; k < 3; k++) {
      const r = 24 + ((t * 0.03 + k * 14) % 42);
      ctx.strokeStyle = 'rgba(127,216,255,' + (1 - (r - 24) / 42).toFixed(2) + ')'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x + 8, GROUND - 128, r, -1.3, -0.2); ctx.stroke();
    }
  } else if (Math.sin(t * 0.008) > 0) circ(x, GROUND - 92, 5, '#ff5a5a');
  txt(stName('antenna'), x, GROUND - 168, '#e4ecf7', 'bold 13px system-ui, sans-serif');
}
function drawRover(x, t, mars) {
  rr(x - 50, GROUND - 46, 100, 26, 8, mars ? '#d8c8a0' : '#cfd6e2', '#f4ecd6', 2);
  rr(x - 34, GROUND - 76, 50, 32, 8, '#cdd9e8', '#f4f8ff', 2);
  rr(x - 28, GROUND - 70, 38, 20, 5, '#27456b');
  line(x + 34, GROUND - 46, x + 34, GROUND - 88, '#aab7c8', 3); circ(x + 34, GROUND - 90, 6, '#e8eef7', '#9fb0c8', 2);
  [-34, 34].forEach(dx => {
    circ(x + dx, GROUND - 12, 15, '#2a3142', '#aab6c8', 3);
    line(x + dx - 9, GROUND - 12, x + dx + 9, GROUND - 12, '#58657d', 2); line(x + dx, GROUND - 21, x + dx, GROUND - 3, '#58657d', 2);
  });
  circ(x + 50, GROUND - 34, 4, '#fff6c8');
  txt('Rover', x, GROUND - 106, '#e4ecf7', 'bold 13px system-ui, sans-serif');
}

/* ---------- habitat ---------- */
function drawHabitat(t) {
  const lit = S.res.power <= 0 ? 0.18 : (S.res.power < 12 ? 0.55 + 0.25 * Math.sin(t * 0.02) : 1);
  rr(992, TOP - 18, 1466, GROUND - TOP + 36, 30, '#7f90a6', '#c9d6e6', 3);
  ROOMS.forEach(([id, a, b]) => {
    const g = ctx.createLinearGradient(0, TOP, 0, GROUND);
    g.addColorStop(0, '#33445f'); g.addColorStop(1, '#1d2a40');
    ctx.fillStyle = g; ctx.fillRect(a, TOP, b - a, GROUND - TOP);
    ctx.fillStyle = 'rgba(255,246,208,' + (0.85 * lit).toFixed(2) + ')'; ctx.fillRect(a + (b - a) / 2 - 45, TOP + 6, 90, 5);
    const lg = ctx.createRadialGradient((a + b) / 2, TOP + 10, 5, (a + b) / 2, TOP + 10, 170);
    lg.addColorStop(0, 'rgba(255,240,200,' + (0.2 * lit).toFixed(2) + ')'); lg.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = lg; ctx.fillRect(a, TOP, b - a, GROUND - TOP);
    if (id === 'airlock') roomAirlock(a, t);
    else if (id === 'life') roomLife(a, t);
    else if (id === 'farm') roomFarm(a, t);
    else if (id === 'command') roomCommand(a, t);
    else roomQuarters(a, t);
    txt(NAMES[W.id][id], (a + b) / 2, TOP - 4, '#dbe6f5', 'bold 12px system-ui, sans-serif');
  });
  ctx.fillStyle = '#55657e'; ctx.fillRect(1000, GROUND - 8, 1450, 8);
  for (let i = 1; i < ROOMS.length; i++) {
    const x = ROOMS[i][1];
    ctx.fillStyle = '#4a5b76'; ctx.fillRect(x - 4, TOP, 8, GROUND - TOP - 108);
    ctx.fillStyle = '#e0b84a'; ctx.fillRect(x - 4, GROUND - 112, 8, 4);
  }
  line(1000, TOP + 22, 2450, TOP + 22, '#5d708c', 3);
  line(1000, TOP + 30, 2450, TOP + 30, '#4a5d7a', 2);
  if (lit < 1) { ctx.fillStyle = 'rgba(2,4,12,' + ((1 - lit) * 0.7).toFixed(2) + ')'; ctx.fillRect(1000, TOP, 1450, GROUND - TOP); }
}
function roomAirlock(a, t) {
  for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? '#e0b84a' : '#262e3c'; ctx.fillRect(a, GROUND - 130 + i * 20, 10, 20); }
  rr(a + 10, GROUND - 130, 8, 122, 3, '#3b4962');
  circ(a + 40, TOP + 40, 5, '#6fe3a1');
  // suit on the rack
  const suitHere = S.zone === 'in';
  if (suitHere) {
    rr(a + 85, GROUND - 120, 36, 56, 10, '#eef3fa', '#a9bad0', 2);
    circ(a + 103, GROUND - 136, 15, '#f4f7fc', '#a9bad0', 2);
    rr(a + 96, GROUND - 144, 20, 14, 6, '#17314d');
    line(a + 92, GROUND - 66, a + 92, GROUND - 24, '#e8eef7', 8); line(a + 114, GROUND - 66, a + 114, GROUND - 24, '#e8eef7', 8);
  }
  rr(a + 40, GROUND - 68, 34, 40, 4, '#46566f', '#7d8fa9', 2);
  txt('O2', a + 57, GROUND - 44, '#cfe3ff', 'bold 11px system-ui, sans-serif');
}
function roomLife(a, t) {
  const sy = S.sys;
  // CO2 scrubber
  rr(a + 15, GROUND - 150, 66, 142, 8, '#51627c', '#8fa3bf', 2);
  const sc = sy.scrub, col = sc < 30 ? '#ff5a5a' : sc < 55 ? '#ffcf5a' : '#5ae08a';
  [-110, -62].forEach(dy => {
    circ(a + 48, GROUND + dy, 19, '#26354c', '#8fa3bf', 2);
    for (let i = 0; i < 4; i++) { const ang = t * 0.012 + i * Math.PI / 2; line(a + 48, GROUND + dy, a + 48 + Math.cos(ang) * 15, GROUND + dy + Math.sin(ang) * 15, '#a9bcd6', 2); }
  });
  circ(a + 70, GROUND - 138, 4, col);
  txt('CO2', a + 48, GROUND - 156, '#cfe3ff', 'bold 11px system-ui, sans-serif');
  // water reclaimer
  rr(a + 95, GROUND - 110, 60, 102, 8, '#46566f', '#8fa3bf', 2);
  const rc = sy.reclaim, rcol = rc < 35 ? '#ff5a5a' : rc < 60 ? '#ffcf5a' : '#5ae08a';
  circ(a + 142, GROUND - 98, 4, rcol);
  for (let i = 0; i < 4; i++) line(a + 105, GROUND - 90 + i * 16, a + 145, GROUND - 90 + i * 16, '#5d708c', 2);
  txt('RECLAIM', a + 125, GROUND - 116, '#cfe3ff', 'bold 10px system-ui, sans-serif');
  // water tank
  rr(a + 170, GROUND - 160, 70, 150, 14, '#2a3a52', '#9fb7d4', 2);
  const wl = S.res.water / 100 * 130;
  rr(a + 176, GROUND - 16 - wl, 58, wl, 8, 'rgba(61,143,224,.75)');
  txt('H2O', a + 205, GROUND - 168, '#cfe3ff', 'bold 11px system-ui, sans-serif');
  if (sy.waterLeak) {
    for (let i = 0; i < 3; i++) { const y = (t * 0.12 + i * 30) % 90; circ(a + 245, GROUND - 100 + y, 3, '#5ab0ff'); }
    ctx.fillStyle = 'rgba(61,143,224,.5)'; ctx.beginPath(); ctx.ellipse(a + 245, GROUND - 6, 22, 4, 0, 0, Math.PI * 2); ctx.fill();
  }
  // oxygen generator
  rr(a + 262, GROUND - 120, 66, 112, 8, '#4a5a70', '#9fb3cc', 2);
  for (let i = 0; i < 3; i++) { const by = GROUND - 30 - ((t * 0.03 + i * 20) % 70); circ(a + 295 + Math.sin(by * 0.2) * 10, by, 3, 'rgba(180,230,255,.7)'); }
  txt('O2 GEN', a + 295, GROUND - 126, '#cfe3ff', 'bold 10px system-ui, sans-serif');
  if (sy.hullLeak) {
    for (let i = 0; i < 6; i++) { const y = (t * 0.05 + i * 11) % 66; ctx.fillStyle = 'rgba(255,255,255,' + (0.55 - y / 130).toFixed(2) + ')'; circ(a + 335 + Math.sin(i + t * 0.01) * 8 + y * 0.3, TOP + 36 + y, 3 + y * 0.05, ctx.fillStyle); }
  }
  if (W.id === 'moon') {
    rr(a + 330, GROUND - 60, 16, 50, 3, sy.heaterFault ? '#27506b' : '#6b3a2a', '#9fb3cc', 2);
    if (!sy.heaterFault) { ctx.fillStyle = 'rgba(255,140,60,.35)'; ctx.fillRect(a + 332, GROUND - 56, 12, 42); }
  }
}
function roomFarm(a, t) {
  const gr = S.sys.growth / 100, on = S.res.power > 0;
  [GROUND - 62, GROUND - 126, GROUND - 190].forEach(y => {
    if (on) {
      const g = ctx.createLinearGradient(0, y - 40, 0, y);
      g.addColorStop(0, 'rgba(255,90,200,.0)'); g.addColorStop(1, 'rgba(255,90,200,.28)');
      ctx.fillStyle = g; ctx.fillRect(a + 24, y - 40, 296, 40);
      ctx.fillStyle = '#ff7ad8'; ctx.fillRect(a + 24, y - 42, 296, 3);
    }
    rr(a + 20, y, 304, 8, 3, '#6c7d96');
    for (let k = 0; k < 8; k++) {
      const px = a + 42 + k * 36, h = 8 + gr * 30 + (k % 3) * 3;
      line(px, y, px, y - h, '#4fbf63', 3);
      ctx.fillStyle = '#58cf70';
      ctx.beginPath(); ctx.ellipse(px - 6, y - h * 0.6, 7, 3, -0.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(px + 6, y - h, 7, 3, 0.5, 0, Math.PI * 2); ctx.fill();
      if (gr >= 1) circ(px, y - h - 4, 4, '#e0a64e');
    }
  });
  rr(a + 330, GROUND - 100, 16, 90, 4, '#46566f', '#8fa3bf', 2);
  circ(a + 338, GROUND - 90, 4, S.sys.pump ? '#5ae08a' : '#ff5a5a');
  if (S.tended) for (let i = 0; i < 4; i++) circ(a + 338 + Math.sin(i) * 3, GROUND - 60 + ((t * 0.1 + i * 20) % 50), 2, '#5ab0ff');
}
function roomCommand(a, t) {
  const ok = S.sys.comms;
  rr(a + 20, GROUND - 76, 280, 14, 4, '#5b6b84', '#8fa3bf', 2);
  ctx.fillStyle = '#3d4b63'; ctx.fillRect(a + 40, GROUND - 62, 10, 54); ctx.fillRect(a + 270, GROUND - 62, 10, 54);
  rr(a + 30, GROUND - 166, 80, 58, 5, '#0d1626', '#8aa0c0', 2);
  ctx.strokeStyle = '#59d0c0'; ctx.lineWidth = 2; ctx.beginPath();
  for (let i = 0; i <= 14; i++) { const px = a + 36 + i * 5, py = GROUND - 136 + Math.sin(i * 0.8 + t * 0.004) * 14; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
  ctx.stroke();
  rr(a + 120, GROUND - 182, 100, 74, 5, '#0d1626', '#8aa0c0', 2);
  if (ok) {
    circ(a + 170, GROUND - 146, 24, '#2a72c8');
    ctx.fillStyle = '#4c9a63'; ctx.beginPath(); ctx.ellipse(a + 162, GROUND - 150, 9, 7, 0.4, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 4; i++) rr(a + 196 + i * 5, GROUND - 124 - i * 4, 3, 4 + i * 4, 1, '#6fe3a1');
  } else if (Math.sin(t * 0.008) > 0) txt('NO SIGNAL', a + 170, GROUND - 142, '#ff6a6a', 'bold 13px system-ui, sans-serif');
  rr(a + 230, GROUND - 166, 62, 58, 5, '#0d1626', '#8aa0c0', 2);
  for (let i = 0; i < 4; i++) rr(a + 238, GROUND - 158 + i * 13, 6 + (S.res[['o2', 'water', 'food', 'power'][i]] / 100) * 40, 7, 2, ['#6fd3ff', '#5aa7ff', '#9be26e', '#ffd35a'][i]);
  rr(a + 130, GROUND - 52, 46, 12, 5, '#2c3a52'); line(a + 153, GROUND - 40, a + 153, GROUND - 8, '#3d4b63', 5);
}
function roomQuarters(a, t) {
  rr(a + 20, GROUND - 86, 150, 78, 4, '#46566f', '#8fa3bf', 2);
  rr(a + 28, GROUND - 56, 134, 18, 6, '#3a6ea5');
  rr(a + 28, GROUND - 62, 36, 12, 5, '#e8f0ff');
  rr(a + 28, GROUND - 148, 134, 18, 6, '#3a6ea5'); rr(a + 28, GROUND - 154, 36, 12, 5, '#e8f0ff');
  line(a + 24, GROUND - 150, a + 24, GROUND - 86, '#8fa3bf', 4);
  rr(a + 195, GROUND - 160, 64, 52, 26, '#0d1626', '#8fa3bf', 3);
  STARS.slice(0, 10).forEach(s => ctx.fillRect(a + 205 + (s.x % 44), GROUND - 150 + (s.y % 32), 1.5, 1.5));
  rr(a + 270, GROUND - 130, 40, 120, 5, '#4a5a70', '#9fb3cc', 2);
  rr(a + 278, GROUND - 120, 24, 24, 4, '#e8eef7'); line(a + 290, GROUND - 116, a + 290, GROUND - 100, '#e8453c', 5); line(a + 282, GROUND - 108, a + 298, GROUND - 108, '#e8453c', 5);
  txt('Medical', a + 290, GROUND - 134, '#cfe3ff', 'bold 10px system-ui, sans-serif');
}

/* ---------- markers, player ---------- */
function drawMarkers(t) {
  const pulse = 0.5 + 0.5 * Math.sin(t * 0.005);
  STATIONS.forEach(st => {
    if (st.zone !== S.zone) return;
    const near = Math.abs(st.x - P.x) < 64;
    ctx.lineWidth = near ? 3 : 2;
    ctx.strokeStyle = st.id === S.hl ? 'rgba(255,226,122,' + (0.5 + 0.5 * pulse).toFixed(2) + ')' : near ? 'rgba(127,216,255,.95)' : 'rgba(127,216,255,.28)';
    ctx.beginPath(); ctx.ellipse(st.x, GROUND + 8, 38, 8, 0, 0, Math.PI * 2); ctx.stroke();
    if (stationAlert(st.id)) {
      const y = GROUND - 196 + Math.sin(t * 0.006 + st.x) * 4;
      circ(st.x, y, 11, '#e8453c', '#fff', 2); txt('!', st.x, y + 5, '#fff', 'bold 15px system-ui, sans-serif');
    }
  });
}
function drawPlayer(t) {
  const eva = S.zone === 'out';
  ctx.save(); ctx.translate(P.x, GROUND); ctx.scale(P.dir >= 0 ? 1 : -1, 1); ctx.lineCap = 'round';
  const sw = P.walking ? Math.sin(P.phase) * 10 : 0, wk = P.working ? Math.sin(t * 0.02) * 14 : 0;
  const body = eva ? '#eef3fa' : '#3a6ea5', trim = eva ? '#a9bad0' : '#27496f';
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(0, 2, 26, 6, 0, 0, Math.PI * 2); ctx.fill();
  line(-2, -58, 8 + (P.working ? 10 : -sw * 0.6), -40 + (P.working ? -10 + wk : 4), trim, 8);
  line(-5, -26, -5 + sw, -3, body, 10); line(5, -26, 5 - sw, -3, body, 10);
  ctx.fillStyle = eva ? '#7f8da3' : '#1d2b42'; ctx.fillRect(-10 + sw, -7, 14, 7); ctx.fillRect(-sw, -7, 14, 7);
  if (eva) rr(-25, -70, 13, 32, 4, '#c9d5e6', '#8fa1ba', 2);
  rr(-13, -68, 26, 44, 9, body, trim, 2);
  if (eva) { rr(-6, -58, 12, 10, 2, '#2a3f5d'); circ(0, -52, 2, '#ff6b6b'); }
  else { ctx.fillStyle = '#e8f0ff'; ctx.fillRect(-13, -46, 26, 4); }
  line(2, -60, 10 + (P.working ? 16 : sw * 0.6), -44 + (P.working ? -16 - wk : 6), body, 8);
  if (eva) {
    circ(2, -82, 17, '#f4f7fc', '#a9bad0', 2); rr(-4, -90, 20, 15, 7, '#17314d');
    ctx.fillStyle = 'rgba(120,200,255,.5)'; ctx.fillRect(1, -87, 9, 3);
  } else {
    circ(2, -80, 13, '#d9a679', '#a97c52', 2);
    ctx.fillStyle = '#2b1f1a'; ctx.beginPath(); ctx.arc(2, -83, 13, Math.PI, 0); ctx.fill();
    circ(8, -80, 1.6, '#222');
  }
  ctx.restore();
  if (P.working) for (let i = 0; i < 4; i++) circ(P.x + P.dir * (26 + Math.random() * 14), GROUND - 45 + (Math.random() - 0.5) * 20, 2, '#ffd36a');
}

/* ---------- main draw ---------- */
function draw(t) {
  const mars = W.id === 'mars';
  const cam = clamp(P.x - VW / 2, 0, WORLD_W - VW);
  ctx.clearRect(0, 0, VW, VH);
  drawSky(cam, t, mars);
  drawRange(cam, 0.12, 330, 46, mars ? '#6e4150' : '#2a3042', 1);
  drawRange(cam, 0.3, 365, 34, mars ? '#8a4f4c' : '#363d50', 4);
  drawGround(cam, mars);
  ctx.save(); ctx.translate(-cam, 0);
  drawSolar(240, t, mars); drawAntenna(560, t); drawRover(830, t, mars);
  ctx.restore();

  // outside light level
  const dark = mars ? (1 - lightAt(S.hour)) * 0.55 : 0.28;
  ctx.fillStyle = 'rgba(5,8,28,' + dark.toFixed(2) + ')'; ctx.fillRect(0, 0, VW, VH);
  if (S.storm > 0 && mars) { ctx.fillStyle = 'rgba(150,90,60,.3)'; ctx.fillRect(0, 0, VW, VH); }

  ctx.save(); ctx.translate(-cam, 0);
  drawHabitat(t); drawMarkers(t); drawPlayer(t);
  ctx.restore();

  if (S.storm > 0 && mars) {
    ctx.strokeStyle = 'rgba(240,190,150,.3)'; ctx.lineWidth = 1.5; ctx.beginPath();
    for (let i = 0; i < 110; i++) {
      const x = (i * 97 + t * 0.9 * (1 + (i % 5) * 0.2)) % VW, y = (i * 53 + t * 0.1 * (i % 3)) % VH;
      ctx.moveTo(x, y); ctx.lineTo(x - 16, y + 3);
    }
    ctx.stroke();
  }
  if (S.flare) { ctx.fillStyle = 'rgba(255,120,40,' + (0.07 + 0.05 * Math.sin(t * 0.004)).toFixed(3) + ')'; ctx.fillRect(0, 0, VW, VH); }
  if (!vignette) {
    vignette = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.45, VW / 2, VH / 2, VW * 0.65);
    vignette.addColorStop(0, 'rgba(0,0,0,0)'); vignette.addColorStop(1, 'rgba(0,0,0,.5)');
  }
  ctx.fillStyle = vignette; ctx.fillRect(0, 0, VW, VH);
}
