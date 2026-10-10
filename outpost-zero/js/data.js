'use strict';
/* data.js
   World settings, stations, events and tasks.
   Change the numbers in WORLDS to make the game easier or harder. */

const VW = 1100, VH = 540, WORLD_W = 2500, GROUND = 410;
const DAY_START = 7;       // wake up time
const DAY_END = 22;        // lights out
const PX_PER_HOUR = 1000;  // walking this far costs one game hour
const SPEED = 240;         // walking speed in pixels per second

let S = null; // current game state
let W = null; // current world settings

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);
const rint = (a, b) => Math.floor(rnd(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
function shuffle(a) {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}
function fmtTime(h) {
  const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
  return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
}

const LABELS = { o2: 'Oxygen', water: 'Water', food: 'Food', power: 'Power', health: 'Health' };

/* ---------- worlds ---------- */
const WORLDS = {
  mars: {
    id: 'mars', code: 'ARES-IV', place: 'Mars', dayName: 'Sol', maxDay: 14,
    intro: 'An emergency evacuation left you alone at the ARES-IV outpost. The rescue ship needs 20 sols to reach you. A sol is one Martian day, about 24 hours and 37 minutes. Keep your air, water, food and power going until it arrives.',
    start: { o2: 80, water: 75, food: 85, power: 80, health: 100 },
    solarMax: 26, rtg: 0, load: 20,
    o2Gen: 3.2, o2Use: 5, waterUse: 6, reclaimMax: 4.4, foodUse: 6,
    farmGrow: 14, farmIdle: 4, harvest: 35, dustRate: 4, pods: 0, iceGain: 20
  },
  moon: {
    id: 'moon', code: 'LUNA-II', place: 'the Moon', dayName: 'Day', maxDay: 14,
    intro: 'The LUNA-II outpost is entering the lunar night. There is no sunlight for about 14 Earth days, the surface gets extremely cold and the solar panels make no power. A small radioisotope power unit keeps the base alive. Survive until sunrise.',
    start: { o2: 85, water: 80, food: 90, power: 100, health: 100 },
    solarMax: 0, rtg: 9, load: 13,
    o2Gen: 3.4, o2Use: 5, waterUse: 5.5, reclaimMax: 4.2, foodUse: 5.5,
    farmGrow: 9, farmIdle: 3, harvest: 30, dustRate: 0, pods: 3, iceGain: 0
  }
};

const NAMES = {
  mars: { solar: 'Solar Array', antenna: 'Comms Antenna', rover: 'Rover Bay', airlock: 'Airlock', life: 'Life Support', farm: 'Greenhouse', command: 'Command Room', quarters: 'Crew Quarters' },
  moon: { solar: 'Power Bay', antenna: 'Comms Antenna', rover: 'Rover Bay', airlock: 'Airlock', life: 'Life Support', farm: 'Grow Room', command: 'Command Room', quarters: 'Crew Quarters' }
};
const stName = id => NAMES[W.id][id];

/* Walkable stations. zone 'out' is outside (suit needed), 'in' is inside the habitat. */
const STATIONS = [
  { id: 'solar', x: 240, zone: 'out' },
  { id: 'antenna', x: 560, zone: 'out' },
  { id: 'rover', x: 830, zone: 'out' },
  { id: 'airlock', x: 962, zone: 'out' },
  { id: 'airlock', x: 1080, zone: 'in' },
  { id: 'life', x: 1320, zone: 'in' },
  { id: 'farm', x: 1670, zone: 'in' },
  { id: 'command', x: 2000, zone: 'in' },
  { id: 'quarters', x: 2320, zone: 'in' }
];

const TIPS = [
  'Check your suit air before every trip.',
  'Keep a reserve. Never plan to use every last bit of suit air.',
  'Small problems grow. Fix leaks early.',
  'Power is life support. Protect the battery.',
  'Tired crews make mistakes. Finish the day on time.',
  'Walking between stations costs time too. Plan your route.'
];

/* ---------- events ---------- */
const EVENTS = {
  dustStorm: {
    title: 'Dust storm', warn: 2,
    forecast: 'A dust storm is building. Expect weak solar power and poor visibility.',
    text: 'A dust storm hit overnight. Solar power is weak for about 3 sols and outside work uses more suit air.',
    apply() { S.storm = 3; S.sys.dust = clamp(S.sys.dust + 20, 0, 100); },
    lesson: 'Dust storms cut solar power and cover panels with dust. Switch to power saver mode and clean the panels when the sky clears.'
  },
  waterLeak: {
    title: 'Water line leak',
    text: 'A fitting in the water line is leaking. You lose extra water every night until it is sealed.',
    apply() { S.sys.waterLeak = true; },
    lesson: 'Isolate a leaking line first, then repair it. Small leaks add up over many days.'
  },
  hullLeak: {
    title: 'Micrometeoroid leak',
    text: 'A tiny impact punched a slow leak in the hull. Air escapes every night until it is patched.',
    apply() { S.sys.hullLeak = true; },
    lesson: 'Slow leaks are dangerous because they are easy to miss. Check pressure often and patch early.'
  },
  scrubClog: {
    title: 'CO2 filter clogged',
    text: 'The CO2 scrubber filter clogged and is almost full.',
    moon: 'Fine lunar dust clogged the CO2 scrubber filter. It is almost full.',
    apply() { S.sys.scrub = Math.min(S.sys.scrub, 18); },
    lesson: 'CO2 builds up faster than most people expect. Swap filters on schedule and before they clog.'
  },
  pumpFail: {
    title: 'Greenhouse pump failure',
    text: 'The irrigation pump stopped. The crops will not grow until it is restarted.',
    apply() { S.sys.pump = false; },
    lesson: 'Food systems are life support too. Check pumps and lights every day.'
  },
  commsLoss: {
    title: 'Antenna out of alignment',
    text: 'Strong wind knocked the antenna out of alignment. You have no signal to Earth.',
    moon: 'The antenna lost its lock on Earth. You have no signal.',
    apply() { S.sys.comms = false; },
    lesson: 'Without comms you get no forecasts and no help from the ground. Fix the antenna early, with the right safety steps.'
  },
  panelDamage: {
    title: 'Solar panel damage',
    text: 'Wind blown rocks cracked part of the solar array. Power output is down.',
    apply() { S.sys.panel = Math.max(30, S.sys.panel - 35); },
    lesson: 'Damaged panels lose power quickly. Always disconnect the circuit before repairing it.'
  },
  powerFault: {
    title: 'Power controller fault',
    text: 'The power controller shows a fault. The radioisotope unit is delivering less power.',
    apply() { S.sys.panel = Math.max(30, S.sys.panel - 40); },
    lesson: 'Shed load first, then reset. Do not reset a power system under full load.'
  },
  heaterFault: {
    title: 'Heater fault',
    text: 'A heater controller tripped. The habitat is getting cold and uses extra power until it is fixed.',
    apply() { S.sys.heaterFault = true; },
    lesson: 'In the lunar night, heat is life support. Find the cause before restarting a tripped heater.'
  },
  dustAirlock: {
    title: 'Lunar dust in the airlock',
    text: 'Sharp lunar dust is stuck to your suit seals. Dirty seals use more suit air.',
    apply() { S.sys.seal = Math.max(20, S.sys.seal - 45); },
    lesson: 'Lunar dust is sharp and sticks to everything. Apollo crews saw it wear down gear. Clean seals after every trip.'
  },
  quake: {
    title: 'Moonquake',
    text: 'A moonquake shook the habitat.',
    apply() {
      const r = rint(0, 2);
      if (r === 0) { S.sys.reclaim = Math.max(0, S.sys.reclaim - 45); return 'A moonquake shook the habitat and damaged the water reclaimer.'; }
      if (r === 1) { S.sys.pump = false; return 'A moonquake shook the habitat and the irrigation pump stopped.'; }
      S.sys.comms = false; return 'A moonquake shook the habitat and the antenna lost its lock on Earth.';
    },
    lesson: 'Check every system after a shake. Damage is not always obvious.'
  },
  flare: {
    title: 'Solar flare', warn: 1,
    forecast: 'A solar flare is expected. Plan to stay inside that day.',
    text: 'A solar flare is sending radiation toward the outpost. Stay inside today. Being outside will hurt you.',
    apply() { S.flare = true; },
    lesson: 'Radiation from a solar flare is dangerous outside. Stay in the shielded habitat until the alert ends.'
  }
};
const evText = ev => (W.id === 'moon' && ev.moon) ? ev.moon : ev.text;

function buildSchedule(windows) {
  return windows.map(([e, a, b]) => ({ id: e, day: rint(a, b), fired: false }));
}
function forecastList() {
  const out = [];
  S.schedule.forEach(it => {
    const ev = EVENTS[it.id];
    if (it.fired || !ev.warn) return;
    const d = it.day - S.day;
    if (d >= 1 && d <= ev.warn) out.push(ev.forecast + ' Expected in ' + d + ' ' + W.dayName.toLowerCase() + (d > 1 ? 's' : '') + '.');
  });
  return out;
}

/* ---------- tasks ----------
   Each task: key, label, desc, hours, off (reason it is blocked, or null),
   run() returns a message, optional check (safety question), why, instant, confirm. */
function tasksFor(st) {
  const sy = S.sys, mars = W.id === 'mars', t = [];
  const add = o => t.push(o);
  const unit = W.dayName.toLowerCase();

  switch (st.id) {
    case 'solar':
      if (mars) {
        add({ key: 'solar.clean', label: 'Clean the panels', desc: 'Brush off the dust. Dust now: ' + Math.round(sy.dust) + '%.', hours: 2,
          off: sy.dust < 8 ? 'The panels are already clean.' : null,
          run() { sy.dust = 0; return 'The panels are clean. Solar output is back up.'; },
          why: 'Dust blocks sunlight. NASA rovers on Mars have lost power to dust, so clean panels matter.' });
        add({ key: 'solar.repair', label: 'Replace damaged cells', desc: 'Panel health: ' + Math.round(sy.panel) + '%.', hours: 2.5,
          off: sy.panel >= 95 ? 'No damage found.' : null,
          check: { q: 'You found a damaged solar string. What do you do first?', opts: ['Disconnect the string from the power bus', 'Touch the wires to see if they are live', 'Keep working. Panels are safe in daylight'], ans: 0,
            explain: 'Solar cells make power whenever light hits them. Isolate the circuit before you touch it.' },
          run() { sy.panel = 100; return 'New cells are installed. The array is back to full strength.'; },
          why: 'Always isolate a circuit before repairs, even a small one.' });
      } else {
        add({ key: 'solar.reset', label: 'Reset the power controller', desc: 'Controller health: ' + Math.round(sy.panel) + '%.', hours: 1.5,
          off: sy.panel >= 95 ? 'No fault found.' : null,
          check: { q: 'The power controller shows a fault. What do you do first?', opts: ['Switch off non-essential loads, then reset it', 'Reset it while everything runs at full load', 'Unplug the battery bank'], ans: 0,
            explain: 'Reduce the load first so the system restarts gently. A reset under full load can trip it again.' },
          run() { sy.panel = 100; return 'The controller is reset. The power unit is back to full output.'; },
          why: 'Shed load first, then reset. This is standard practice for power faults.' });
        add({ key: 'solar.blanket', label: 'Add a thermal blanket', desc: 'One time job. Cuts the heat the batteries lose.', hours: 2,
          off: S.blanket ? 'Already installed.' : null,
          run() { S.blanket = true; return 'The thermal blanket is on. The batteries lose less heat.'; },
          why: 'The lunar night is extremely cold, so insulation saves power.' });
      }
      break;

    case 'antenna':
      add({ key: 'antenna.align', label: 'Realign the antenna', desc: sy.comms ? 'The antenna is locked on Earth.' : 'No signal. The dish is out of alignment.', hours: 1.5,
        off: sy.comms ? 'The antenna is already aligned.' : null,
        check: { q: 'Before you move the dish by hand, what do you do?', opts: ['Disable the motor drive so it cannot move while you work', 'Stand in front of the dish to watch it', 'Leave the motor on. It is faster'], ans: 0,
          explain: 'Lock out the drive so it cannot move unexpectedly and trap or hit you.' },
        run() { sy.comms = true; return 'The antenna is locked on Earth. Signal is back.'; },
        why: 'Lock out moving equipment before touching it. This is called lockout and tagout.' });
      break;

    case 'rover':
      if (mars) {
        add({ key: 'rover.ice', label: 'Drive out and drill for ice', desc: 'About 3 hours. Gives water and costs some power.', hours: 3,
          off: S.storm > 0 ? 'Visibility is too low to drive in the storm.' : (S.suit < 55 ? 'Not enough suit air for a 3 hour trip. Go back and refill.' : null),
          check: { q: 'The ice site is far from the habitat. What is your suit air plan?', opts: ['Make sure suit air covers the round trip plus a reserve', 'Go fast and decide when you get there', 'Turn off the radio to save power'], ans: 0,
            explain: 'Plan for the round trip plus a safety reserve, and turn back early if air runs low.' },
          run() { S.res.water = clamp(S.res.water + W.iceGain, 0, 100); S.res.power = clamp(S.res.power - 5, 0, 100); return 'You drilled ice and melted it. Water +' + W.iceGain + '. Rover charging cost 5% power.'; },
          why: 'Water ice under Martian soil can be melted and cleaned for drinking.' });
      } else {
        add({ key: 'rover.pod', label: 'Fetch a supply pod (' + S.pods + ' left)', desc: 'About 3 hours. Gives water, food and oxygen.', hours: 3,
          off: S.pods <= 0 ? 'All supply pods are collected.' : (S.suit < 55 ? 'Not enough suit air for a 3 hour trip. Go back and refill.' : null),
          check: { q: 'The supply pod is far from the habitat. What is your suit air plan?', opts: ['Make sure suit air covers the round trip plus a reserve', 'Go fast and decide when you get there', 'Turn off the radio to save power'], ans: 0,
            explain: 'Plan for the round trip plus a safety reserve, and turn back early if air runs low.' },
          run() { S.pods--; S.res.water = clamp(S.res.water + 14, 0, 100); S.res.food = clamp(S.res.food + 10, 0, 100); S.res.o2 = clamp(S.res.o2 + 8, 0, 100); return 'You brought back a supply pod. Water +14, food +10, oxygen +8.'; },
          why: 'Missions often pre-position supplies on the surface before the crew arrives.' });
      }
      break;

    case 'airlock':
      if (st.zone === 'in') {
        add({ key: 'airlock.exit', label: 'Suit up and go outside', desc: 'Takes 30 minutes and about 2% habitat oxygen.', hours: 0.5, off: null,
          check: { q: 'Before you open the outer hatch, what do you check?', opts: ['Suit seals, suit oxygen and radio, then depressurize', 'Only the radio. The suit looks after the rest', 'Nothing. Go quickly to save time'], ans: 0,
            explain: 'Always run a full suit check before going outside. A small seal fault can become life threatening fast.' },
          run() {
            S.res.o2 = clamp(S.res.o2 - 2, 0, 100); S.zone = 'out'; S.suit = 100; S.warnedSuit = false;
            P.x = 962; P.target = null; S.stats.eva++; Sfx.hiss();
            return 'You are outside. Suit air is 100%. Every minute outside uses suit air.';
          },
          why: 'The airlock keeps habitat air inside when you leave.' });
        if (!mars) add({ key: 'airlock.brush', label: 'Brush dust off suit seals', desc: 'Seal condition: ' + Math.round(sy.seal) + '%.', hours: 1,
          off: sy.seal > 85 ? 'The seals are clean.' : null,
          run() { sy.seal = 100; return 'The seals are clean. Your suit holds air well again.'; },
          why: 'Lunar dust is sharp and sticks to everything. Apollo crews reported it wearing down gear and irritating their eyes and throats.' });
      } else {
        add({ key: 'airlock.enter', label: 'Go inside and repressurize', desc: 'Takes 30 minutes. Your suit gets refilled when you go out again.', hours: 0.5, off: null,
          run() { S.zone = 'in'; P.x = 1080; P.target = null; Sfx.hiss(); return 'You are back inside. The airlock is repressurized.'; },
          why: 'Never rush the airlock cycle.' });
      }
      break;

    case 'life':
      add({ key: 'life.scrub', label: 'Swap the CO2 filter', desc: 'Filter: ' + Math.round(sy.scrub) + '%. It wears down about 12% every night.', hours: 1,
        off: sy.scrub > 85 ? 'The filter is fresh.' : null,
        check: { q: 'What happens if the CO2 filter is full?', opts: ['CO2 builds up and causes headaches and confusion', 'Oxygen levels rise', 'Nothing. CO2 is harmless in a sealed room'], ans: 0,
          explain: 'CO2 buildup was a real danger on Apollo 13, where the crew had to adapt their filters.' },
        run() { sy.scrub = 100; return 'A fresh filter is in. CO2 levels are dropping.'; },
        why: 'Check filters on a schedule. CO2 buildup is slow and easy to ignore.' });
      add({ key: 'life.reclaim', label: 'Service the water reclaimer', desc: 'Efficiency: ' + Math.round(sy.reclaim) + '%. It recycles used water when healthy.', hours: 1.5,
        off: sy.reclaim > 85 ? 'It is running well.' : null,
        run() { sy.reclaim = 100; return 'The reclaimer is serviced and recycling water well.'; },
        why: 'The space station recycles most of its water. A working reclaimer saves a huge amount of supply.' });
      if (sy.waterLeak) add({ key: 'life.waterleak', label: 'Seal the water leak', desc: 'Water is escaping every night.', hours: 1, off: null,
        check: { q: 'You found a leaking water line. What do you do first?', opts: ['Close the isolation valve upstream of the leak', 'Wait until the tank is empty', 'Tape it and leave'], ans: 0,
          explain: 'Isolate the section first so the leak stops and you can repair it safely.' },
        run() { sy.waterLeak = false; return 'The leak is sealed. Water loss is back to normal.'; },
        why: 'Isolate, then repair. It is the same idea for any leaking line.' });
      if (sy.hullLeak) add({ key: 'life.hullleak', label: 'Patch the hull leak', desc: 'Air is escaping every night.', hours: 1.5, off: null,
        check: { q: 'You hear a slow hiss and cabin pressure is dropping. What first?', opts: ['Isolate the module, locate the leak, then patch it', 'Ignore it. There is plenty of oxygen', 'Open the airlock to balance the pressure'], ans: 0,
          explain: 'Isolate the module to protect the rest of the habitat, find the leak, then patch it.' },
        run() { sy.hullLeak = false; return 'The hull is patched. Pressure is holding.'; },
        why: 'Pressure loss is one of the most serious emergencies in space.' });
      if (sy.heaterFault) add({ key: 'life.heater', label: 'Reset the heater controller', desc: 'The habitat is getting cold.', hours: 1, off: null,
        check: { q: 'A heater controller tripped. What do you do before restarting it?', opts: ['Check for a short or damage, then restart', 'Restart it again and again until it works', 'Ignore the warning lights'], ans: 0,
          explain: 'A tripped heater usually means a fault. Find the cause before you restart it.' },
        run() { sy.heaterFault = false; return 'The heater is back. The habitat is warming up.'; },
        why: 'Heat is life support on the Moon.' });
      break;

    case 'farm':
      if (!sy.pump) add({ key: 'farm.pump', label: 'Restart the irrigation pump', desc: 'The pump has stopped.', hours: 1, off: null,
        run() { sy.pump = true; return 'The pump is running again.'; },
        why: 'Plants need steady water. Check pumps often.' });
      add({ key: 'farm.tend', label: 'Water and tend the crops', desc: 'Tended crops grow much faster. Uses about 2% water.', hours: 1.5,
        off: !sy.pump ? 'The pump is down. Restart it first.' : (S.tended ? 'Already tended today.' : null),
        run() { S.tended = true; S.res.water = clamp(S.res.water - 2, 0, 100); return 'The crops are watered. Growth is on track.'; },
        why: 'Growing food saves supplies on long missions.' });
      add({ key: 'farm.harvest', label: 'Harvest the crops', desc: 'Growth: ' + Math.round(sy.growth) + '%. Ready at 100%.', hours: 1,
        off: sy.growth < 100 ? 'Not ready yet.' : null,
        run() { S.res.food = clamp(S.res.food + W.harvest, 0, 100); sy.growth = 0; return 'Harvest done. Food +' + W.harvest + '.'; },
        why: 'Fresh food also helps morale on long missions.' });
      break;

    case 'command':
      add({ key: 'command.call', label: 'Daily call to Mission Control', desc: 'Get the forecast and advice. Needs the antenna.', hours: 0.5,
        off: !sy.comms ? 'No signal. Realign the antenna outside first.' : (S.reported ? 'You already called today.' : null),
        run() {
          S.reported = true; S.res.health = clamp(S.res.health + 2, 0, 100); S.forecast = forecastList();
          const f = S.forecast.length ? S.forecast.join(' ') : 'No storms or radiation alerts in the next few ' + unit + 's.';
          return 'Mission Control: ' + f + ' ' + pick(TIPS);
        } });
      add({ key: 'command.saver', label: S.saver ? 'Turn power saver off' : 'Turn power saver on',
        desc: S.saver ? 'Back to normal power use. Crops grow at full speed.' : 'Cuts power use by 25%. Crops grow slower.', hours: 0.1, instant: true, off: null,
        run() { S.saver = !S.saver; return S.saver ? 'Power saver is on. Non-essential systems are off.' : 'Power saver is off.'; },
        why: 'Turning off non-essential systems to protect the battery is called load shedding. Real crews do it in emergencies.' });
      break;

    case 'quarters':
      add({ key: 'quarters.sleep', label: 'Sleep and end the day', desc: 'Resources change overnight. Systems wear down.', hours: 0, instant: true, off: null,
        confirm: S.hour < 20 ? 'You still have about ' + Math.round(DAY_END - S.hour) + ' hours left today. End the day anyway?' : null,
        run() { endDay(''); return null; } });
      add({ key: 'quarters.med', label: 'Use a medical kit (' + S.kits + ' left)', desc: 'Restores 20 health.', hours: 0.5,
        off: S.kits <= 0 ? 'No medical kits left.' : (S.res.health > 85 ? 'You are in good health.' : null),
        run() { S.kits--; S.res.health = clamp(S.res.health + 20, 0, 100); return 'You treated yourself. Health +20.'; },
        why: 'Medical kits are limited. Prevent injuries first.' });
      break;
  }
  return t;
}


/* ---------- missions (scenarios) ----------
   windows = [event, earliest day, latest day]. start / sys change the starting state. */
const SCENARIOS = {
  mars_duty: {
    world: 'mars', title: 'Mars: Base Duty', tag: 'Good first mission',
    blurb: 'Keep the Mars base running for 14 sols. Clean panels, grow food, find ice.',
    facts: ['14 sols', 'Solar panels and greenhouse', 'A few small surprises'],
    brief: 'You are on duty at the ARES-IV base on Mars. Do your chores: clean the solar panels, grow food and fix small problems. Stay safe for 14 sols.',
    start: { o2: 90, water: 85, food: 90, power: 90 }, sys: {},
    windows: [['waterLeak', 4, 6], ['dustStorm', 7, 9], ['pumpFail', 10, 12], ['commsLoss', 11, 13]]
  },
  mars_left: {
    world: 'mars', title: 'Mars: Left Behind', tag: 'Survival mission',
    blurb: 'A storm forced the crew to leave. You are alone. Rescue comes in 14 sols. Inspired by the movie The Martian.',
    facts: ['Antenna is broken at the start', 'Less food and water', 'Big storms and leaks'],
    brief: 'A fierce storm made the crew leave in a hurry, and you were left behind. Your antenna is broken, so nobody can hear you. Fix it, make food, find water and survive until the rescue ship arrives.',
    start: { o2: 75, water: 60, food: 60, power: 80 }, sys: { comms: false, dust: 30, growth: 5 },
    windows: [['waterLeak', 2, 4], ['dustStorm', 4, 6], ['pumpFail', 6, 8], ['scrubClog', 7, 9], ['panelDamage', 8, 10], ['hullLeak', 10, 12], ['flare', 12, 13]]
  },
  moon_duty: {
    world: 'moon', title: 'Moon: Base Duty', tag: 'Good first mission',
    blurb: 'Keep the Moon base warm and breathing for 14 days.',
    facts: ['14 days', 'Power unit and heater', 'A few small surprises'],
    brief: 'You are on duty at the LUNA-II base on the Moon. The sun is down, so a small power unit runs the base. Do your chores and fix small problems.',
    start: { o2: 90, water: 85, food: 90, power: 100 }, sys: {},
    windows: [['scrubClog', 3, 5], ['dustAirlock', 5, 7], ['commsLoss', 7, 9], ['flare', 10, 12]]
  },
  moon_night: {
    world: 'moon', title: 'Moon: The Long Night', tag: 'Survival mission',
    blurb: 'About 14 Earth days of darkness. Extreme cold, sharp dust and radiation.',
    facts: ['No solar power', 'Heat and battery care', 'Supply pods and solar flares'],
    brief: 'The lunar night has begun. It lasts about 14 Earth days. It is freezing, the solar panels make no power and sharp dust is everywhere. Protect your power and survive until sunrise.',
    start: {}, sys: {},
    windows: [['scrubClog', 2, 4], ['heaterFault', 3, 5], ['dustAirlock', 4, 6], ['commsLoss', 5, 7], ['quake', 6, 8], ['hullLeak', 8, 10], ['powerFault', 9, 11], ['flare', 10, 12], ['quake', 12, 13]]
  }
};

/* ---------- NASA sources ----------
   Facts are simplified from public NASA pages. No live data is downloaded by the game. */
const SOURCES = {
  mars:  { short: 'NASA Mars Exploration', name: 'NASA Mars Exploration Program (science.nasa.gov/mars)', fact: 'A sol (Mars day) is about 24 hours 39 minutes. Mars has thin air, cold weather and dust storms.' },
  mer:   { short: 'NASA/JPL Mars rovers', name: 'NASA/JPL Mars rovers: Spirit, Opportunity, Curiosity, Perseverance', fact: 'Dust builds up on rover solar panels. A huge dust storm in 2018 knocked Opportunity into low power mode.' },
  ice:   { short: 'NASA Phoenix and LCROSS', name: 'NASA Phoenix lander (Mars) and LCROSS mission (Moon)', fact: 'Phoenix found water ice under Martian soil. LCROSS found water in a dark Moon crater.' },
  moon:  { short: 'NASA Moon and Artemis', name: 'NASA Moon facts and Artemis program (science.nasa.gov/moon)', fact: 'A lunar night lasts about 14 Earth days and gets extremely cold. Moonquakes were recorded by Apollo instruments.' },
  apollo:{ short: 'NASA Apollo reports', name: 'NASA Apollo mission reports and Lunar Surface Journal', fact: 'Apollo crews found lunar dust sharp and sticky. It wore down gear and irritated their eyes and throats.' },
  iss:   { short: 'NASA ISS life support', name: 'NASA International Space Station life support (ECLSS)', fact: 'The ISS recycles most of its water and uses scrubbers to remove CO2 from the air.' },
  a13:   { short: 'NASA Apollo 13', name: 'NASA Apollo 13 mission history', fact: 'On Apollo 13 the crew built an adapter so square filters could clean the air in the round fittings.' },
  rtg:   { short: 'NASA Radioisotope Power', name: 'NASA Radioisotope Power Systems (rps.nasa.gov)', fact: 'Rovers like Curiosity and Perseverance use a radioisotope power system. It makes steady power with no sunlight.' },
  veggie:{ short: 'NASA Veggie on the ISS', name: 'NASA Veggie plant growth system on the ISS', fact: 'Astronauts grew and ate lettuce in space. Plants need steady water and light.' },
  dsn:   { short: 'NASA Deep Space Network', name: 'NASA Deep Space Network (DSN)', fact: 'Giant dishes in California, Spain and Australia talk to spacecraft. Signals take minutes to reach Mars.' },
  sw:    { short: 'NASA Space Weather', name: 'NASA Heliophysics: solar flares and space weather', fact: 'Solar flares send out radiation. Astronauts shelter in shielded areas when a strong one is expected.' },
  safety:{ short: 'NASA EVA safety', name: 'NASA spacewalk (EVA) and safety training', fact: 'Astronauts practice spacewalks in a giant pool and always follow checklists, including lockout steps.' },
  hrp:   { short: 'NASA Human Research', name: 'NASA Human Research Program', fact: 'NASA studies sleep, health and stress so crews can stay well on long missions.' }
};
const TASK_SRC = {
  'solar.clean': 'mer', 'solar.repair': 'safety', 'solar.reset': 'rtg', 'solar.blanket': 'moon', 'antenna.align': 'safety',
  'rover.ice': 'ice', 'rover.pod': 'moon', 'airlock.exit': 'safety', 'airlock.enter': 'safety', 'airlock.brush': 'apollo',
  'life.scrub': 'a13', 'life.reclaim': 'iss', 'life.waterleak': 'iss', 'life.hullleak': 'iss', 'life.heater': 'moon',
  'farm.pump': 'veggie', 'farm.tend': 'veggie', 'farm.harvest': 'veggie', 'command.call': 'dsn', 'command.saver': 'mer',
  'quarters.sleep': 'hrp', 'quarters.med': 'hrp'
};
const EVENT_SRC = {
  dustStorm: 'mer', waterLeak: 'iss', hullLeak: 'iss', scrubClog: 'a13', pumpFail: 'veggie', commsLoss: 'dsn',
  panelDamage: 'mer', powerFault: 'rtg', heaterFault: 'moon', dustAirlock: 'apollo', quake: 'moon', flare: 'sw'
};
