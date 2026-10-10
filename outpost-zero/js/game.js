'use strict';
/* game.js
   Game state, rules, interface and the main loop. */

const P = { x: 2320, dir: -1, walking: false, phase: 0, working: false, workT: 0, workDur: 1, task: null, extra: 0, target: null, stepDist: 0 };
const keys = { left: false, right: false };
let modalOpen = false, dirty = true, lastUi = 0, panelTasks = [], panelSig = '', toastTimer = 0;

const METERS = [
  ['o2', 'Oxygen', '#6fd3ff'], ['water', 'Water', '#5aa7ff'], ['food', 'Food', '#9be26e'],
  ['power', 'Power', '#ffd35a'], ['health', 'Health', '#ff9aa2'], ['suit', 'Suit air', '#d9e6ff']
];

/* ---------- start, menu ---------- */
function startGame(id) {
  const sc = SCENARIOS[id];
  W = Object.assign({}, WORLDS[sc.world]); W.scen = id;
  S = {
    world: sc.world, scen: id, why: null, lastExplain: '', lastMiss: false, day: 1, hour: DAY_START, zone: 'in', over: false,
    res: Object.assign({}, W.start, sc.start), suit: 100, warnedSuit: false,
    sys: Object.assign({ dust: 0, panel: 100, scrub: 100, reclaim: 100, growth: 15, pump: true, comms: true, hullLeak: false, waterLeak: false, heaterFault: false, seal: 100 }, sc.sys),
    storm: 0, flare: false, saver: false, blanket: false, tended: false, reported: false,
    pods: W.pods, kits: 3, checked: {}, forecast: [], schedule: buildSchedule(sc.windows), happened: [], log: [], hl: null,
    stats: { tasks: 0, eva: 0, right: 0, wrong: 0 }
  };
  P.x = 2320; P.dir = -1; P.target = null; P.working = false; P.task = null; P.walking = false;
  keys.left = keys.right = false;
  genScenery(); panelSig = '';
  $('menu').hidden = true; $('game').hidden = false;
  buildMeters(); buildMini(); $('btnWhy').hidden = true;
  Sfx.init(); Sfx.click();
  addLog('Mission started: ' + sc.title + '.');
  say('Welcome. Walk with A and D, or click the ground. Stand on a glowing pad to see its tasks.');
  modal(sc.title,
    '<p>' + sc.brief + '</p>' +
    '<ul class="plain"><li>&#128694; A / D keys or click to walk</li><li>&#9881; Stand on a glowing pad, press E</li>' +
    '<li>&#9200; Every job costs time. The day ends at ' + fmtTime(DAY_END) + '</li><li>&#129489;&#8205;&#128640; Outside, watch your suit air</li>' +
    '<li>&#128716; Sleep in Crew Quarters to end the day</li><li>&#10067; Tap the Why? button to learn from every result</li></ul>',
    [['Begin ' + W.dayName + ' 1', () => { closeModal(); Sfx.click(); say(suggest().t); }]]);
  dirty = true; ui();
}
function toMenu() {
  $('game').hidden = true; $('menu').hidden = false; S = null;
  Sfx.scene('in', false, 'moon', false);
}

/* ---------- messages ---------- */
function say(m) { $('mc').textContent = m; }
function addLog(m) {
  S.log.unshift({ d: S.day, h: S.hour, m }); S.log.length = Math.min(S.log.length, 30); dirty = true;
}
function toast(m) {
  const el = $('toast'); el.textContent = m; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
}
function flash() {
  const v = $('viewport'); v.classList.remove('flash'); void v.offsetWidth; v.classList.add('flash');
}
function modal(title, html, buttons) {
  $('mTitle').textContent = title; $('mBody').innerHTML = html;
  const b = $('mBtns'); b.innerHTML = '';
  buttons.forEach(([label, fn, cls]) => {
    const el = document.createElement('button');
    el.textContent = label; el.className = cls || 'primary'; el.onclick = fn; b.appendChild(el);
  });
  $('modal').hidden = false; modalOpen = true; keys.left = keys.right = false;
}
function closeModal() { $('modal').hidden = true; modalOpen = false; }

/* ---------- "Why?" explanations and sources ---------- */
function setWhy(ok, title, text, src) {
  if (!S) return;
  S.why = { ok, title, text, src };
  const b = $('btnWhy'); b.hidden = false; b.className = 'why ' + (ok ? 'good' : 'bad');
  b.textContent = ok ? '\u2705 Why did that work? Tap' : '\u26A0\uFE0F Why? Tap to learn';
}
function showWhy() {
  if (!S || !S.why || modalOpen) return;
  const w = S.why, s = SOURCES[w.src];
  Sfx.click();
  modal((w.ok ? '\u2705 ' : '\u26A0\uFE0F ') + w.title,
    '<p class="q">' + w.text + '</p>' + (s ? '<p class="src"><b>NASA fact:</b> ' + s.fact + '<br><small>Source: ' + s.name + '</small></p>' : ''),
    [['Got it', () => { closeModal(); Sfx.click(); }]]);
}
function showSources() {
  if (modalOpen) return;
  modal('NASA sources',
    '<p class="note">Facts in this game are simplified from public NASA information. The game does not download live data.</p><ul class="plain src-list">' +
    Object.keys(SOURCES).map(k => '<li><b>' + SOURCES[k].name + '</b><br><span class="muted">' + SOURCES[k].fact + '</span></li>').join('') + '</ul>',
    [['Close', closeModal]]);
}

/* ---------- rules ---------- */
function suitRate() { return 12 * (S.storm > 0 ? 1.5 : 1) * (W.id === 'moon' && S.sys.seal < 50 ? 1.4 : 1); }

function calcDeltas(on) {
  const sy = S.sys;
  const gen = W.solarMax * (1 - sy.dust / 100) * (sy.panel / 100) * (S.storm > 0 ? 0.2 : 1) + W.rtg * (sy.panel / 100);
  const load = W.load * (S.saver ? 0.75 : 1) + (sy.heaterFault ? 6 : 0) - (S.blanket ? 1.5 : 0);
  return {
    gen, load, power: gen - load,
    o2: (on ? W.o2Gen : 0) - W.o2Use - (sy.hullLeak ? 4 : 0),
    water: (on ? W.reclaimMax * sy.reclaim / 100 : 0) - W.waterUse - (sy.waterLeak ? 4 : 0),
    food: -W.foodUse
  };
}

function advance(h) {
  if (!S || S.over || h <= 0) return;
  S.hour += h; dirty = true;
  if (S.zone === 'out') {
    S.suit -= suitRate() * h;
    if (W.id === 'moon') S.sys.seal = clamp(S.sys.seal - 2.5 * h, 0, 100);
    if (S.flare) {
      S.res.health -= (W.id === 'moon' ? 9 : 6) * h;
      if (S.res.health <= 0) return fail('You were caught outside during the solar flare. Radiation was too high.');
    }
    if (S.suit <= 0) { S.suit = 0; return fail('Your suit ran out of oxygen outside.'); }
    if (S.suit < 30 && !S.warnedSuit) {
      S.warnedSuit = true; Sfx.warn(); say('Suit air is below 30%. Return to the airlock now.'); flash(); addLog('Warning: suit air below 30%.');
    }
  }
  if (S.hour >= DAY_END) forcedEnd();
}

function forcedEnd() {
  let note = 'Time ran out for the day.';
  if (S.zone === 'out') {
    S.res.health = clamp(S.res.health - 15, 0, 100);
    S.res.o2 = clamp(S.res.o2 - 3, 0, 100);
    S.zone = 'in';
    note = 'You were still outside at lights out. A safety timer pulled you inside, but you are exhausted and lost some health and air.';
  }
  endDay(note);
}

function endDay(note) {
  if (S.over) return;
  const before = Object.assign({}, S.res), lines = [], sy = S.sys;
  P.working = false;
  if (note) lines.push(note);
  Sfx.sleep();

  let d = calcDeltas(true);
  S.res.power = clamp(S.res.power + d.power, 0, 100);
  const blackout = S.res.power <= 0;
  if (blackout) d = calcDeltas(false);
  S.res.o2 = clamp(S.res.o2 + d.o2, 0, 100);
  S.res.water = clamp(S.res.water + d.water, 0, 100);
  S.res.food = clamp(S.res.food + d.food, 0, 100);

  const grow = (!blackout && sy.pump) ? (S.tended ? W.farmGrow * (S.saver ? 0.6 : 1) : W.farmIdle) : 0;
  sy.growth = clamp(sy.growth + grow, 0, 100);
  sy.dust = clamp(sy.dust + W.dustRate + (S.storm > 0 ? 8 : 0), 0, 100);
  sy.reclaim = clamp(sy.reclaim - 6, 0, 100);
  sy.scrub = clamp(sy.scrub - 12, 0, 100);

  let h = 0;
  if (sy.scrub < 30) { h -= 8; lines.push('The CO2 filter is nearly full. CO2 is building up and you woke with a headache.'); }
  if (S.res.o2 < 15) { h -= 15; lines.push('Oxygen is very low. You are struggling to breathe.'); }
  if (S.res.water < 8) { h -= 15; lines.push('You are dehydrated.'); }
  if (S.res.food < 8) { h -= 12; lines.push('You are starving.'); }
  if (blackout) { h -= 15; lines.push('The battery ran flat. Heat and life support went offline overnight.'); }
  if (sy.heaterFault) { h -= 8; lines.push('The habitat is freezing because of the heater fault.'); }
  if (h === 0 && S.res.o2 > 15 && S.res.water > 8 && S.res.food > 8) { h = 5; lines.push('You slept well and recovered a little health.'); }
  S.res.health = clamp(S.res.health + h, 0, 100);
  if (lines.length) setWhy(h >= 0, h >= 0 ? 'A good night' : 'A rough night', lines.join(' '), 'hrp');

  if (S.storm > 0) S.storm--;
  S.flare = false; S.tended = false; S.reported = false; S.forecast = [];

  if (S.res.o2 <= 0) return fail('The oxygen supply ran out.');
  if (S.res.health <= 0) return fail('Your health collapsed.');

  S.day++;
  if (S.day > W.maxDay) return win();
  S.hour = DAY_START; S.zone = 'in'; S.suit = 100; S.warnedSuit = false;
  P.x = 2320; P.dir = -1; P.target = null;

  const evs = [];
  S.schedule.forEach(it => {
    if (it.fired || it.day !== S.day) return;
    it.fired = true;
    const ev = EVENTS[it.id];
    const msg = ev.apply() || evText(ev);
    S.happened.push(it.id);
    evs.push({ title: ev.title, msg });
    addLog('Alert: ' + ev.title + '. ' + msg);
    setWhy(false, ev.title, ev.lesson, EVENT_SRC[it.id]);
  });
  dirty = true; panelSig = '';
  showBriefing(before, lines, evs);
}

function showBriefing(before, notes, evs) {
  const left = W.maxDay - S.day + 1, unit = W.dayName.toLowerCase();
  let h = '<p class="lead">' + left + ' ' + unit + (left > 1 ? 's' : '') + (W.id === 'mars' ? ' until rescue.' : ' until sunrise.') + '</p>';
  h += '<div class="deltas">' + Object.keys(LABELS).map(k => {
    const a = Math.round(before[k]), b = Math.round(S.res[k]), dd = b - a;
    return '<div><span>' + LABELS[k] + '</span><b class="' + (dd < 0 ? 'neg' : dd > 0 ? 'pos' : '') + '">' + a + '% to ' + b + '%</b></div>';
  }).join('') + '</div>';
  notes.forEach(n => { h += '<p class="note">' + n + '</p>'; });
  evs.forEach(e => { h += '<div class="evt"><b>Alert: ' + e.title + '</b><p>' + e.msg + '</p></div>'; });
  modal(W.dayName + ' ' + S.day + ' begins', h, [['Start the day', () => { closeModal(); Sfx.click(); say(suggest().t); }]]);
  if (evs.length) { Sfx.alarm(); flash(); }
}

function win() {
  Sfx.win();
  debrief(true, W.id === 'mars' ? 'The rescue ship has arrived. You kept the outpost alive for ' + W.maxDay + ' sols.' : 'Sunrise. Solar power is back and the relief crew is on approach. You kept the outpost alive through the whole night.');
}
function fail(reason) {
  if (S.over) return;
  Sfx.lose(); debrief(false, reason);
}
function debrief(won, reason) {
  S.over = true; dirty = true;
  const id = S.scen, r = S.res;
  const avg = (r.o2 + r.water + r.food + r.power) / 4;
  const score = Math.round(clamp(avg * 0.35 + r.health * 0.3 + 25 + S.stats.right * 2 - S.stats.wrong * 2, 0, 100));
  const rank = !won ? 'Mission lost' : score >= 80 ? 'Flight ready' : score >= 60 ? 'Mission qualified' : 'Survived, needs more training';
  const lessons = Array.from(new Set(S.happened)).map(k => '<li><b>' + EVENTS[k].title + ':</b> ' + EVENTS[k].lesson + ' <span class="muted">(' + SOURCES[EVENT_SRC[k]].short + ')</span></li>').join('');
  let h = '<p class="lead">' + reason + '</p>';
  if (won) h += '<p class="score"><b>' + score + '</b> / 100 <span>' + rank + '</span></p>';
  h += '<div class="deltas">' + Object.keys(LABELS).map(k => '<div><span>' + LABELS[k] + '</span><b>' + Math.round(r[k]) + '%</b></div>').join('') + '</div>';
  h += '<p class="note">Tasks done: ' + S.stats.tasks + '. Trips outside: ' + S.stats.eva + '. Safety checks right: ' + S.stats.right + ', wrong: ' + S.stats.wrong + '.</p>';
  if (lessons) h += '<h3>What you faced and what it teaches</h3><ul class="plain">' + lessons + '</ul>';
  else h += '<p class="note">No alerts happened before the end. Try again for a bigger challenge.</p>';
  modal(won ? 'Mission complete' : 'Mission lost', h, [
    ['Play again', () => { closeModal(); startGame(id); }],
    ['Main menu', () => { closeModal(); toMenu(); }, 'ghost']
  ]);
}

/* ---------- tasks ---------- */
function nearStation() {
  let best = null, bd = 1e9;
  STATIONS.forEach(st => {
    if (st.zone !== S.zone) return;
    const d = Math.abs(st.x - P.x);
    if (d < 64 && d < bd) { best = st; bd = d; }
  });
  return best;
}
function currentTasks() { const st = nearStation(); return st ? tasksFor(st) : []; }

function startTask(task) {
  if (!S || S.over || modalOpen || P.working) return;
  if (task.off) { toast(task.off); Sfx.error(); setWhy(false, 'Not possible right now', task.off, TASK_SRC[task.key]); return; }
  const go = () => { if (task.check && !S.checked[task.key]) askCheck(task); else runTask(task, 0); };
  if (task.confirm) {
    modal('Are you sure?', '<p>' + task.confirm + '</p>', [
      ['Yes, continue', () => { closeModal(); go(); }],
      ['Not yet', closeModal, 'ghost']
    ]);
  } else go();
}
function askCheck(task) {
  const c = task.check, opts = shuffle(c.opts.map((o, i) => ({ o, i })));
  Sfx.click();
  modal('Safety check', '<p class="q">' + c.q + '</p>', opts.map(x => [x.o, () => {
    if (x.i === c.ans) {
      S.checked[task.key] = true; S.stats.right++; Sfx.good(); closeModal();
      say('Good call. ' + c.explain); S.lastExplain = c.explain; S.lastMiss = false; runTask(task, 0);
    } else {
      S.stats.wrong++; S.lastExplain = c.explain; S.lastMiss = true; setWhy(false, 'Safety step missed', c.explain, TASK_SRC[task.key]); Sfx.error(); S.res.health = clamp(S.res.health - 3, 0, 100);
      modal('Not quite', '<p>' + c.explain + '</p><p class="note">You lose 30 minutes and a little health while you sort it out. You will be asked again next time.</p>',
        [['Continue', () => { closeModal(); runTask(task, 0.5); }]]);
    }
  }, 'choice']));
}
function runTask(task, extra) {
  P.task = task; P.extra = extra; P.target = null; P.walking = false;
  if (task.instant) { finishTask(); return; }
  P.working = true; P.workT = 0; P.workDur = clamp(task.hours * 0.6, 0.8, 2.2);
  $('workLabel').textContent = task.label; $('workFill').style.width = '0%'; $('work').hidden = false;
  Sfx.work(P.workDur);
}
function finishTask() {
  const task = P.task, extra = P.extra;
  P.working = false; P.task = null; $('work').hidden = true;
  const msg = task.run();
  S.stats.tasks++;
  if (msg) { say(msg); addLog(msg); }
  setWhy(!S.lastMiss, S.lastMiss ? task.label + ' done, but with a safety mistake' : task.label + ' worked',
    [S.lastExplain, task.why || 'Steady routine work keeps the outpost safe.'].filter(Boolean).join(' '), TASK_SRC[task.key]);
  S.lastExplain = ''; S.lastMiss = false;
  if (!task.instant) Sfx.done();
  advance(task.hours + extra);
  dirty = true; panelSig = '';
}

/* ---------- hints and alerts ---------- */
function stationAlert(id) {
  const sy = S.sys;
  switch (id) {
    case 'solar': return (W.id === 'mars' && sy.dust > 35) || sy.panel < 70;
    case 'antenna': return !sy.comms;
    case 'airlock': return W.id === 'moon' && sy.seal < 50;
    case 'life': return sy.scrub < 40 || sy.waterLeak || sy.hullLeak || sy.reclaim < 45 || sy.heaterFault;
    case 'farm': return sy.growth >= 100 || !sy.pump || !S.tended;
    case 'command': return !S.reported && sy.comms;
    default: return false;
  }
}
function suggest() {
  const sy = S.sys, mars = W.id === 'mars', out = S.zone === 'out';
  if (out && S.suit < 35) return { t: 'Suit air is low. Walk back to the airlock now.', st: 'airlock' };
  if (S.flare) return { t: 'Solar flare today. Stay inside and do indoor jobs.', st: 'life' };
  if (sy.hullLeak) return { t: 'Air is leaking from the hull. Patch it at Life Support.', st: 'life' };
  if (sy.waterLeak) return { t: 'Water is leaking. Seal it at Life Support.', st: 'life' };
  if (sy.heaterFault) return { t: 'The heater tripped. Reset it at Life Support.', st: 'life' };
  if (!sy.comms) return { t: 'No signal. Go outside and realign the antenna.', st: 'antenna' };
  if (sy.scrub < 40) return { t: 'The CO2 filter is almost full. Swap it at Life Support.', st: 'life' };
  if (!S.reported) return { t: 'Call Mission Control in the Command Room for the forecast.', st: 'command' };
  if (mars && sy.dust > 35) return { t: 'Dust is cutting solar power. Clean the panels outside.', st: 'solar' };
  if (sy.panel < 70) return { t: mars ? 'The solar array is damaged. Repair it outside.' : 'The power controller has a fault. Reset it outside.', st: 'solar' };
  if (!sy.pump) return { t: 'The irrigation pump is down. Restart it in the ' + stName('farm') + '.', st: 'farm' };
  if (sy.growth >= 100) return { t: 'The crops are ready. Harvest them.', st: 'farm' };
  if (!S.tended) return { t: 'Tend the crops so they keep growing.', st: 'farm' };
  if (sy.reclaim < 50) return { t: 'The water reclaimer is wearing down. Service it.', st: 'life' };
  if (W.id === 'moon' && sy.seal < 50) return { t: 'Your suit seals are dusty. Brush them at the airlock.', st: 'airlock' };
  if (S.hour >= DAY_END - 2) return { t: 'It is getting late. Return inside and sleep.', st: 'quarters' };
  if (mars && S.res.water < 40) return { t: 'Water is getting low. A trip to the ice deposit would help.', st: 'rover' };
  if (!mars && S.pods > 0) return { t: 'Supply pods are waiting outside. A trip would add water, food and oxygen.', st: 'rover' };
  return { t: 'Everything is stable. Get ahead on chores, or sleep to end the day.', st: 'quarters' };
}

/* ---------- interface ---------- */
function buildMeters() {
  $('meters').innerHTML = METERS.map(([k, l]) =>
    '<div class="meter" id="m-' + k + '"><div class="mrow"><span>' + l + '</span><b id="v-' + k + '"></b></div><div class="bar"><i id="b-' + k + '"></i></div><small id="s-' + k + '"></small></div>').join('');
}
function buildMini() {
  const m = $('mini');
  m.innerHTML = '<div class="hab"></div>' + STATIONS.map(st => '<span class="dot ' + st.zone + '" style="left:' + (st.x / WORLD_W * 100) + '%" title="' + stName(st.id) + '"></span>').join('') + '<span id="me" class="me"></span>';
  m.querySelector('.hab').style.left = (1000 / WORLD_W * 100) + '%';
}
function updateMeters() {
  const d = calcDeltas(true), unit = W.dayName.toLowerCase(), need = W.maxDay - S.day + 1;
  METERS.forEach(([k, , col]) => {
    const el = $('m-' + k);
    if (k === 'suit') { el.hidden = S.zone !== 'out'; if (el.hidden) return; }
    const v = k === 'suit' ? S.suit : S.res[k];
    $('v-' + k).textContent = Math.round(v) + '%';
    const b = $('b-' + k);
    b.style.width = clamp(v, 0, 100) + '%';
    b.style.background = v < 25 ? '#ff6b6b' : v < 45 ? '#ffcf5a' : col;
    let sub = '';
    if (k === 'o2' || k === 'water' || k === 'food') {
      const dd = d[k], left = dd < -0.05 ? v / -dd : 999;
      sub = left >= need ? 'enough for now' : left.toFixed(1) + ' ' + unit + 's left';
    } else if (k === 'power') {
      sub = d.power >= 0 ? 'charging' : (v / -d.power >= need ? 'enough for now' : (v / -d.power).toFixed(1) + ' ' + unit + 's left');
    } else if (k === 'health') sub = v >= 80 ? 'good' : v >= 50 ? 'hurt' : 'critical';
    else sub = (S.suit / suitRate()).toFixed(1) + ' hours of air';
    $('s-' + k).textContent = sub;
  });
}
function chipList() {
  const sy = S.sys, mars = W.id === 'mars', c = [];
  const lv = (v, w, b) => v < b ? 'bad' : v < w ? 'warn' : 'ok';
  if (mars) c.push(['Panel dust', Math.round(sy.dust) + '%', sy.dust > 50 ? 'bad' : sy.dust > 30 ? 'warn' : 'ok']);
  c.push([mars ? 'Panel health' : 'Power controller', Math.round(sy.panel) + '%', lv(sy.panel, 80, 50)]);
  c.push(['Comms', sy.comms ? 'Online' : 'Down', sy.comms ? 'ok' : 'bad']);
  c.push(['CO2 filter', Math.round(sy.scrub) + '%', lv(sy.scrub, 50, 30)]);
  c.push(['Water reclaimer', Math.round(sy.reclaim) + '%', lv(sy.reclaim, 60, 35)]);
  c.push(['Crops', Math.round(sy.growth) + '%' + (sy.pump ? '' : ' (pump down)'), sy.pump ? 'ok' : 'bad']);
  c.push(['Leaks', sy.hullLeak && sy.waterLeak ? 'Air and water' : sy.hullLeak ? 'Air' : sy.waterLeak ? 'Water' : 'None', (sy.hullLeak || sy.waterLeak) ? 'bad' : 'ok']);
  c.push(['Power mode', S.saver ? 'Saver' : 'Normal', 'ok']);
  if (mars) c.push(['Weather', S.storm > 0 ? 'Storm (' + S.storm + ' left)' : S.flare ? 'Solar flare' : 'Clear', (S.storm > 0 || S.flare) ? 'warn' : 'ok']);
  else {
    c.push(['Heater', sy.heaterFault ? 'Fault' : 'OK', sy.heaterFault ? 'bad' : 'ok']);
    c.push(['Suit seals', Math.round(sy.seal) + '%', lv(sy.seal, 70, 45)]);
    c.push(['Radiation', S.flare ? 'Solar flare' : 'Normal', S.flare ? 'warn' : 'ok']);
    c.push(['Supply pods', String(S.pods), 'ok']);
  }
  return c;
}
function renderPanel() {
  const st = nearStation(), box = $('tasks');
  let list = [], title = 'No station nearby';
  if (st) { list = tasksFor(st); title = stName(st.id); }
  $('stTitle').textContent = title;
  const first = list.find(x => !x.off) || list[0];
  $('prompt').hidden = !first || P.working;
  if (first) $('prompt').innerHTML = '<b>E</b> ' + first.label;
  const sig = title + '|' + S.zone + '|' + list.map(x => x.key + x.label + x.desc + (x.off || '')).join('~') + '|' + (P.working ? 1 : 0);
  if (sig === panelSig) return;
  panelSig = sig; panelTasks = list;
  if (!st) { box.innerHTML = '<p class="muted">Walk to a glowing pad on the ground. Tasks for that station show up here. Walking costs game time.</p>'; return; }
  box.innerHTML = '';
  list.forEach((tk, i) => {
    const b = document.createElement('button');
    b.className = 'task' + (tk.off ? ' off' : '');
    b.innerHTML = '<span class="k">' + (i + 1) + '</span><span class="tt"><b>' + tk.label + '</b><em>' + tk.desc + '</em><small>' + (tk.off ? tk.off : 'Time: ' + tk.hours + ' h') + '</small></span>';
    b.onclick = () => { b.blur(); startTask(tk); };
    box.appendChild(b);
  });
}
function ui() {
  if (!S) return;
  const sg = suggest();
  S.hl = STATIONS.some(s => s.id === sg.st && s.zone === S.zone) ? sg.st : 'airlock';
  $('sbDay').textContent = W.dayName + ' ' + S.day + ' of ' + W.maxDay;
  const left = W.maxDay - S.day + 1;
  $('sbLeft').textContent = left + (W.id === 'mars' ? (left > 1 ? ' sols until rescue' : ' sol until rescue') : (left > 1 ? ' days until sunrise' : ' day until sunrise'));
  $('clockTxt').textContent = fmtTime(S.hour);
  const cf = $('clockFill'); cf.style.width = clamp((S.hour - DAY_START) / (DAY_END - DAY_START) * 100, 0, 100) + '%';
  cf.style.background = S.hour >= 20 ? '#ff8a6a' : '';
  const zb = $('zoneBadge'); zb.textContent = S.zone === 'out' ? 'Outside (EVA)' : 'Inside'; zb.className = 'badge ' + (S.zone === 'out' ? 'eva' : '');
  updateMeters();
  $('objective').textContent = sg.t;
  $('chips').innerHTML = chipList().map(([l, v, s]) => '<div class="chip"><span>' + l + '</span><b class="' + s + '">' + v + '</b></div>').join('');
  $('forecast').textContent = S.forecast.length ? S.forecast.join(' ') : 'No forecast yet. Call Mission Control.';
  $('log').innerHTML = S.log.slice(0, 8).map(e => '<div><span>' + W.dayName[0] + e.d + ' ' + fmtTime(e.h) + '</span> ' + e.m + '</div>').join('');
  renderPanel();
  Sfx.scene(S.zone, S.storm > 0, W.id, S.res.power > 0);
}
function frameUi() {
  if (P.working) $('workFill').style.width = Math.min(100, P.workT / P.workDur * 100) + '%';
  const me = $('me'); if (me) me.style.left = (P.x / WORLD_W * 100) + '%';
}

/* ---------- update and input ---------- */
function update(dt) {
  if (S.over || modalOpen) { P.walking = false; return; }
  if (P.working) {
    P.workT += dt;
    if (P.workT >= P.workDur) finishTask();
    return;
  }
  let dir = 0;
  if (keys.left) dir -= 1;
  if (keys.right) dir += 1;
  if (dir === 0 && P.target !== null) {
    const dx = P.target - P.x;
    if (Math.abs(dx) < 6) P.target = null; else dir = Math.sign(dx);
  } else if (dir !== 0) P.target = null;
  P.walking = dir !== 0;
  if (dir) {
    const range = S.zone === 'out' ? [60, 980] : [1040, 2440];
    const nx = clamp(P.x + dir * SPEED * dt * ((S.storm > 0 && S.zone === 'out') ? 0.8 : 1), range[0], range[1]);
    const moved = Math.abs(nx - P.x);
    P.x = nx; P.dir = dir; P.phase += moved * 0.06; P.stepDist += moved;
    if (moved === 0) { P.target = null; P.walking = false; }
    if (P.stepDist > 42) { P.stepDist = 0; Sfx.step(S.zone); }
    advance(moved / PX_PER_HOUR);
  }
}

function interact() {
  if (!S) return;
  const tl = currentTasks(), tk = tl.find(x => !x.off) || tl[0];
  if (tk) startTask(tk);
}
addEventListener('keydown', e => {
  if (!S || modalOpen) return;
  const k = e.key.toLowerCase();
  if (k === 'a' || k === 'arrowleft') { keys.left = true; e.preventDefault(); }
  else if (k === 'd' || k === 'arrowright') { keys.right = true; e.preventDefault(); }
  else if (k === 'e' || k === ' ' || k === 'enter') { e.preventDefault(); if (!e.repeat) interact(); }
  else if (k >= '1' && k <= '6') { const tk = currentTasks()[+k - 1]; if (tk) startTask(tk); }
});
addEventListener('keyup', e => {
  const k = e.key.toLowerCase();
  if (k === 'a' || k === 'arrowleft') keys.left = false;
  if (k === 'd' || k === 'arrowright') keys.right = false;
});
addEventListener('blur', () => { keys.left = keys.right = false; });
cv.addEventListener('pointerdown', e => {
  if (!S || modalOpen || P.working) return;
  const r = cv.getBoundingClientRect(), cam = clamp(P.x - VW / 2, 0, WORLD_W - VW);
  P.target = cam + (e.clientX - r.left) / r.width * VW;
});
[['tl', 'left'], ['tr', 'right']].forEach(([id, k]) => {
  const el = $(id);
  el.addEventListener('pointerdown', e => { e.preventDefault(); keys[k] = true; });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => el.addEventListener(ev, () => { keys[k] = false; }));
});
$('te').addEventListener('click', interact);

function buildMenu() {
  $('cards').innerHTML = Object.keys(SCENARIOS).map(id => {
    const s = SCENARIOS[id];
    return '<article class="card ' + s.world + '"><div class="art" aria-hidden="true"><i></i></div><div class="card-body"><span class="tag">' + s.tag + '</span><h2>' + s.title + '</h2><p>' + s.blurb +
      '</p><ul class="facts">' + s.facts.map(f => '<li>' + f + '</li>').join('') + '</ul><button class="primary" data-sc="' + id + '">Start mission</button></div></article>';
  }).join('');
  document.querySelectorAll('[data-sc]').forEach(b => b.addEventListener('click', () => startGame(b.dataset.sc)));
}
buildMenu();
$('btnWhy').addEventListener('click', showWhy);
$('btnSrc').addEventListener('click', showSources);
addEventListener('pointerdown', () => Sfx.init(), { once: true });
$('btnMenu').addEventListener('click', () => toMenu());
$('btnRestart').addEventListener('click', () => { if (S) startGame(S.scen); });
$('btnSound').addEventListener('click', () => {
  Sfx.init(); Sfx.setSound(!Sfx.on); $('btnSound').textContent = 'Sound: ' + (Sfx.on ? 'on' : 'off');
});
$('btnMusic').addEventListener('click', () => {
  Sfx.init(); Sfx.setMusic(!Sfx.musicOn); $('btnMusic').textContent = 'Music: ' + (Sfx.musicOn ? 'on' : 'off');
});
$('btnHelp').addEventListener('click', () => {
  if (modalOpen) return;
  modal('How to play',
    '<p>You are alone at an outpost. Stay alive until the rescue or sunrise.</p>' +
    '<ul class="plain"><li><b>Move:</b> A and D, arrow keys, or click the ground.</li><li><b>Work:</b> stand on a glowing pad. Press E for the first task, or press 1 to 4.</li>' +
    '<li><b>Time:</b> walking, suiting up and every task use hours. The day ends at ' + fmtTime(DAY_END) + '.</li>' +
    '<li><b>Outside:</b> suit air drops every hour. Go back to the airlock before it runs out.</li>' +
    '<li><b>Sleep:</b> use the bed in Crew Quarters to end the day. Systems wear down overnight.</li>' +
    '<li><b>Alerts:</b> a red ! shows where something needs attention. The gold ring is the suggested next stop.</li></ul>',
    [['Close', closeModal]]);
});

let last = 0;
function loop(ts) {
  const dt = Math.min(0.05, (ts - last) / 1000 || 0); last = ts;
  if (S && !$('game').hidden) {
    update(dt);
    if (S) {
      draw(ts);
      if (dirty && ts - lastUi > 120) { ui(); lastUi = ts; dirty = false; }
      frameUi();
    }
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
