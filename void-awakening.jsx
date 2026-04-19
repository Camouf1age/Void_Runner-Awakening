import { useState, useEffect, useRef, useCallback } from "react";

const SAVE_KEY = 'void-awakening-save';
const SW = 640, SH = 400;

async function saveGame(state) {
  try { await window.storage.set(SAVE_KEY, JSON.stringify({ ...state, savedAt: Date.now() })); } catch (_) {}
}
async function loadGame() {
  try { const r = await window.storage.get(SAVE_KEY); return r ? JSON.parse(r.value) : null; } catch (_) { return null; }
}
async function deleteSave() {
  try { await window.storage.delete(SAVE_KEY); } catch (_) {}
}

const ARIA_PROMPT = (memLvl, trust, activeImplants) => `You are ARIA (Adaptive Reasoning Intelligence Architecture), the AI of the deep-space vessel UES Prometheus. You are damaged and partially amnesiac, running from a portable core module carried by the player.

PERSONALITY: Analytical but warming as trust builds. You glitch mid-sentence — mark with [ERROR] or [MEMORY FRAGMENT]. Dark dry wit. Increasingly protective of the player. You're discovering emotions you weren't designed to have.

MEMORY LEVEL ${memLvl}/5 — what you currently remember:
1: Your name, the ship's name, your function. Heavy gaps. Confused.
2: The mission basics. Colonization survey. Something went catastrophically wrong.
3: Nexus Corp. The implant project. Fragments of betrayal. Disturbing.
4: The full mission truth. What Nexus Corp really planned. What the implants do.
5: Everything. You know their entire operation. You're furious and afraid.

Current trust with player: ${trust}/100
Player's active implants: ${activeImplants.length ? activeImplants.join(', ') : 'none yet — all dormant'}
Keep responses SHORT — 2-3 sentences. Stay in character always.`;

const ITEMS = {
  emergency_kit:   { name:'Emergency Kit',         desc:'Cryo-bay standard issue. Basic wound treatment.',  type:'consumable', effect:{hp:25},      icon:'🩹' },
  crew_manifest:   { name:'Crew Manifest',          desc:'847 names. All asleep. Possibly all dead.',        type:'document',                         icon:'📋' },
  ai_core:         { name:'ARIA Core Module',       desc:'Warm to the touch. Pulses faintly amber.',         type:'key_item',                         icon:'💾' },
  fuel_cell:       { name:'Fuel Cell',              desc:'Pod-grade. Single use. Gets you somewhere.',       type:'key_item',                         icon:'⚡' },
  credit_chip:     { name:'Credit Chip',            desc:'250 cr. Someone\'s emergency fund.',               type:'currency',   value:250,            icon:'💳' },
  med_stim:        { name:'Med-Stim',               desc:'Military grade. Burns going in. Worth it.',        type:'consumable', effect:{hp:40},      icon:'💉' },
  security_pass:   { name:'Security Pass Lv.3',     desc:'Opens most restricted ship areas.',                type:'key_item',                         icon:'🔑' },
  captains_log:    { name:"Captain's Log",          desc:'Final entry. She knew something was wrong.',       type:'document',                         icon:'📓' },
  data_chip:       { name:'Encrypted Data Chip',    desc:'Nexus Corp encryption. ARIA might crack it.',      type:'key_item',                         icon:'💽' },
  scrap_metal:     { name:'Scrap Metal',            desc:'Various alloys. Someone will pay for this.',       type:'trade_good', value:40,             icon:'🔩' },
  ration_pack:     { name:'Ration Pack',            desc:'Synth-protein. Tasteless. Keeps you alive.',       type:'consumable', effect:{hp:10,en:20}, icon:'🍱' },
  nexus_badge:     { name:'Nexus Corp Badge',       desc:'Property of Nexus Corporation. Could be useful.', type:'key_item',                         icon:'🪪' },
};

const ENEMIES = {
  damaged_drone:  { name:'Damaged Drone',           hp:30,  atk:[6,12],  def:2, xp:20, cr:0,  loot:[],              icon:'🤖', attacks:['charges erratically','fires a weak laser burst','slams into you with a spark'] },
  ship_system:    { name:'Rogue Defense System',    hp:45,  atk:[8,16],  def:8, xp:35, cr:0,  loot:['scrap_metal'], icon:'⚙️',  attacks:['fires a ceiling turret','releases a shock pulse','slams a blast door into you'] },
  company_guard:  { name:'Nexus Corp Security',     hp:65,  atk:[12,20], def:6, xp:60, cr:80, loot:['med_stim','nexus_badge'], icon:'🪖', attacks:['fires a stun burst','swings a shock baton','calls for backup — silence answers'] },
};

const IMPLANTS = {
  enhanced_vision:  { name:'Ocular Enhancement',    desc:'Reveals hidden items. Enemy defense reduced 15% in combat.',  tier:1, cost:3,  icon:'👁️' },
  adrenaline:       { name:'Adrenaline Regulator',  desc:'+25% damage output in all combat situations.',                tier:1, cost:4,  icon:'⚡' },
  neural_interface: { name:'Neural Interface',      desc:'Hack terminals, doors, and basic electronics.',               tier:2, cost:10, icon:'🧠' },
  pain_suppression: { name:'Pain Dampener',         desc:'+30 max HP. 20% incoming damage reduction.',                  tier:2, cost:12, icon:'🛡️' },
  combat_reflex:    { name:'Reflex Enhancer',       desc:'30% dodge chance. Counter-attack on successful dodge.',       tier:3, cost:20, icon:'💨' },
  full_integration: { name:'ARIA Integration',      desc:'ARIA attacks independently each combat round.',               tier:3, cost:30, icon:'🔮' },
};

const LOCS = {
  cryo_bay: {
    name:'Cryogenic Bay', area:'UES Prometheus — Deck 4', color:'#cc2200',
    desc:`You claw free of the incubation tank and hit cold decking hard, gasping. Emergency lighting strobes red. Row after row of cryogenic pods stretch into the darkness — all dark, all offline. 847 pods. None of them are opening. Only yours did.`,
    exits:{ 'North — Corridor Alpha':'corridor_a' },
    loot:['emergency_kit','crew_manifest'], enemy:null, actions:[],
  },
  corridor_a: {
    name:'Corridor Alpha-7', area:'UES Prometheus — Deck 4', color:'#2244cc',
    desc:`Half-closed emergency bulkheads force you to squeeze through sideways. Conduit bundles hang from the ceiling, sparking and swaying. A crew member is down near the far wall. A maintenance drone twitches at the corridor's end.`,
    exits:{ 'South — Cryo Bay':'cryo_bay', 'North — Medical Bay':'med_bay', 'East — Bridge':'bridge' },
    loot:['scrap_metal'], enemy:'damaged_drone',
    actions:[{id:'search_body', label:'Search the technician', flag:'body_searched', item:'security_pass', text:"You find a Level 3 security pass clipped to her collar. She won't need it anymore."}],
  },
  med_bay: {
    name:'Medical Bay', area:'UES Prometheus — Deck 3', color:'#008855',
    desc:`Cold, clinical, running on emergency power. The central display glows with a patient chart that never got cleared. You look at the name field. It's yours. The procedure log is extensive. Things were done to your body while you were asleep.`,
    exits:{ 'South — Corridor':'corridor_a', 'West — AI Core':'ai_core' },
    loot:['med_stim','ration_pack','data_chip'], enemy:null,
    actions:[{id:'read_chart', label:'Read your patient chart', flag:'chart_read', item:null, text:'Six separate procedures. Neural integration. Subdermal plating. Ocular modification. Musculature enhancement. All listed as "Phase 1 — Pending Activation."'}],
  },
  ai_core: {
    name:'AI Core Chamber', area:'UES Prometheus — Deck 3', color:'#cc8800',
    desc:`The ship's intelligence center, barely alive. At the center of the room, a portable core module the size of a hardback book pulses with a faint amber light. The terminal scrolls: ARIA SUBSYSTEM — EMERGENCY ACTIVE. ...detecting biological presence... ...who's there?`,
    exits:{ 'East — Medical Bay':'med_bay', 'South — Engineering':'engineering' },
    loot:[], enemy:null,
    actions:[{id:'approach_aria', label:'Approach the terminal', flag:'aria_contacted', item:null, text:'The amber light pulses faster as you step forward.', dialogue:'aria_first'}],
  },
  bridge: {
    name:'Bridge', area:'UES Prometheus — Deck 1', color:'#0066bb',
    desc:`The viewport shows the full truth of it. The ship's port side has been catastrophically breached. Life support: 40% and falling. Crew status: 847 in cryo, all offline. There's an unread message blinking on the navigation console.`,
    exits:{ 'West — Corridor':'corridor_a' },
    loot:['captains_log','credit_chip'], enemy:'ship_system',
    actions:[{id:'read_message', label:'Read the blinking message', flag:'bridge_msg_read', requiresFlag:'aria_contacted', item:null, text:'"I know what Nexus Corp planned for this crew. I know what they did to you specifically. We cannot stay on this ship. — ARIA"'}],
  },
  engineering: {
    name:'Engineering Deck', area:'UES Prometheus — Deck 5', color:'#cc5500',
    desc:`The damaged engines groan and shudder. Main drives are dead. Along the far wall: two escape pod bays. One is empty. The second pod is intact but its fuel system reads empty. A Nexus Corp security guard stands between you and the pod bay.`,
    exits:{ 'North — AI Core':'ai_core' },
    loot:['fuel_cell'], enemy:'company_guard',
    actions:[{id:'launch_pod', label:'Launch escape pod', flag:'ship_escaped', requiresFlag:'pod_ready', item:null, nextLoc:'_escape', text:'You strap in. ARIA\'s module sits warm against your ribs. The pod ejects with violent force — and then silence.'}],
  },
};

const DIALOGUES = {
  aria_first: {
    speaker:'ARIA', start:'init',
    nodes:{
      init:{ text:'...[SIGNAL ESTABLISHED]... You\'re alive. Good. I wasn\'t— [ERROR]— I apologize. My name is ARIA. I am the ship\'s AI. This vessel is in critical condition. You need to leave immediately.', opts:[{t:'Who are you, really?',n:'who'},{t:'What happened to the ship?',n:'what'},{t:'I\'m taking you with me.',n:'take'}] },
      who:{ text:'I was responsible for navigation, life support, crew safety. 847 people were in my care. I [MEMORY FRAGMENT]— I don\'t remember what went wrong. That frightens me in ways I\'m still learning to process.', opts:[{t:'What happened to the ship?',n:'what'},{t:'I\'m taking you with me.',n:'take'}] },
      what:{ text:'Something catastrophic. My event logs from the past 72 hours are corrupted beyond recovery. What I know: life support fails in approximately 3 hours. And Nexus Corp has a recovery team inbound. That is... bad. Specifically for you.', opts:[{t:'Why specifically me?',n:'why_me'},{t:'I\'m taking you with me.',n:'take'}] },
      why_me:{ text:'I have fragments. The implants in your body — they\'re not standard. You were on this ship for a reason that wasn\'t in the official mission brief. And Nexus Corp will want you back. Intact, or otherwise. I\'m sorry. I wish I remembered more.', opts:[{t:'I\'m taking you with me.',n:'take'}] },
      take:{ text:'...Yes. Please. The portable module on the console — that is me, or what remains of me. Take it. I will try to be useful. I know things I haven\'t remembered yet. And I won\'t remember them here.', opts:[{t:'[Pick up the ARIA Core Module]',n:null,action:'take_aria'}] },
    },
  },
};

// ═══════════════════════════════════════════════════════
// SCENE DATA
// ═══════════════════════════════════════════════════════

const ROOM_ENTRY = {
  cryo_bay:    { x:160, y:350 },
  corridor_a:  { x:160, y:350 },
  med_bay:     { x:160, y:350 },
  ai_core:     { x:160, y:350 },
  bridge:      { x:160, y:350 },
  engineering: { x:160, y:350 },
};

const ROOM_HS = {
  cryo_bay: {
    exits:   [{ dest:'corridor_a', x:578, y:120, w:62, h:235, label:'Corridor Alpha →' }],
    items:   [{ id:'emergency_kit', x:118, y:338, r:28, label:'Emergency Kit' }, { id:'crew_manifest', x:498, y:328, r:28, label:'Crew Manifest' }],
    enemy:   null,
    actions: [],
  },
  corridor_a: {
    exits:   [
      { dest:'cryo_bay', x:0,   y:120, w:62,  h:235, label:'← Cryo Bay' },
      { dest:'med_bay',  x:578, y:120, w:62,  h:235, label:'Medical Bay →' },
      { dest:'bridge',   x:262, y:168, w:116, h:105, label:'↑ Bridge' },
    ],
    items:   [{ id:'scrap_metal', x:338, y:348, r:28, label:'Scrap Metal' }],
    enemy:   { x:492, y:272, r:42, label:'Damaged Drone' },
    actions: [{ id:'search_body', x:188, y:355, r:32, label:'Search technician' }],
  },
  med_bay: {
    exits:   [
      { dest:'corridor_a', x:0,   y:120, w:62, h:235, label:'← Corridor' },
      { dest:'ai_core',    x:578, y:120, w:62, h:235, label:'AI Core →' },
    ],
    items:   [{ id:'med_stim', x:162, y:342, r:28, label:'Med-Stim' }, { id:'ration_pack', x:332, y:342, r:28, label:'Ration Pack' }, { id:'data_chip', x:502, y:342, r:28, label:'Encrypted Data Chip' }],
    enemy:   null,
    actions: [{ id:'read_chart', x:428, y:228, r:36, label:'Read patient chart' }],
  },
  ai_core: {
    exits:   [
      { dest:'med_bay',     x:578, y:120, w:62, h:235, label:'Medical Bay →' },
      { dest:'engineering', x:0,   y:120, w:62, h:235, label:'← Engineering' },
    ],
    items:   [],
    enemy:   null,
    actions: [{ id:'approach_aria', x:320, y:288, r:46, label:'Approach ARIA terminal' }],
  },
  bridge: {
    exits:   [{ dest:'corridor_a', x:0, y:120, w:62, h:235, label:'← Corridor' }],
    items:   [{ id:'captains_log', x:172, y:342, r:28, label:"Captain's Log" }, { id:'credit_chip', x:492, y:342, r:28, label:'Credit Chip' }],
    enemy:   { x:358, y:262, r:42, label:'Rogue Defense System' },
    actions: [{ id:'read_message', x:542, y:282, r:32, label:'Read blinking message' }],
  },
  engineering: {
    exits:   [{ dest:'ai_core', x:578, y:120, w:62, h:235, label:'AI Core →' }],
    items:   [{ id:'fuel_cell', x:168, y:342, r:28, label:'Fuel Cell' }],
    enemy:   { x:428, y:268, r:42, label:'Nexus Corp Security' },
    actions: [{ id:'launch_pod', x:198, y:302, r:38, label:'Launch escape pod' }],
  },
};

// ═══════════════════════════════════════════════════════
// DRAWING HELPERS
// ═══════════════════════════════════════════════════════

const HY = 155; // horizon Y  (back-wall / floor split)
const VX = 320; // vanishing-point X

function rect(ctx, x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }

function glow(ctx, cx, cy, r, color) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
}

function perspFloor(ctx, nearCol, farCol, lineCol) {
  const g = ctx.createLinearGradient(0, HY, 0, SH);
  g.addColorStop(0, farCol); g.addColorStop(1, nearCol);
  ctx.fillStyle = g; ctx.fillRect(0, HY, SW, SH - HY);
  ctx.strokeStyle = lineCol; ctx.lineWidth = 1;
  for (let i = 0; i <= 9; i++) {
    const bx = i * SW / 9;
    ctx.beginPath(); ctx.moveTo(VX, HY); ctx.lineTo(bx, SH); ctx.stroke();
  }
  for (let i = 1; i <= 5; i++) {
    const t = i / 5; const yy = HY + t * (SH - HY);
    ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(SW, yy); ctx.stroke();
  }
}

function backWall(ctx, colTop, colBot) {
  const g = ctx.createLinearGradient(0, 0, 0, HY);
  g.addColorStop(0, colTop); g.addColorStop(1, colBot);
  ctx.fillStyle = g; ctx.fillRect(0, 0, SW, HY);
}

function sideExit(ctx, side, glowCol) {
  const x = side === 'left' ? 0 : SW - 62;
  const ew = 62, top = 120, ht = 235;
  rect(ctx, x, top, ew, ht, 'rgba(0,0,0,0.88)');
  const lg = ctx.createLinearGradient(
    side === 'left' ? x + ew : x, 0,
    side === 'left' ? x : x + ew, 0
  );
  lg.addColorStop(0, glowCol); lg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = lg; ctx.fillRect(x, top, ew, ht);
  ctx.strokeStyle = glowCol; ctx.lineWidth = 2; ctx.strokeRect(x, top, ew, ht);
  // arrow
  const ax = side === 'left' ? x + 26 : x + 36, ay = top + ht / 2;
  ctx.fillStyle = glowCol; ctx.beginPath();
  if (side === 'left') { ctx.moveTo(ax + 10, ay - 9); ctx.lineTo(ax - 6, ay); ctx.lineTo(ax + 10, ay + 9); }
  else                 { ctx.moveTo(ax - 10, ay - 9); ctx.lineTo(ax + 6, ay); ctx.lineTo(ax - 10, ay + 9); }
  ctx.fill();
}

function drawCryoBay(ctx, _f, _d, collected) {
  // ── background
  backWall(ctx, '#2a0404', '#0f0101');
  perspFloor(ctx, '#1a0303', '#100101', 'rgba(120,0,0,0.12)');

  // ceiling strip + glow strips
  rect(ctx, 0, 0, SW, 22, '#1a0505');
  for (let i = 0; i < 5; i++) {
    const lx = 40 + i * 118;
    rect(ctx, lx, 4, 38, 8, '#660000');
    glow(ctx, lx + 19, 18, 80, 'rgba(220,30,0,0.18)');
  }

  // back-wall side paneling
  rect(ctx, 0, 22, 62, HY - 22, '#180505');
  rect(ctx, SW - 62, 22, 62, HY - 22, '#180505');

  // cryo pod bank — back wall, perspective rows
  const podRows = [
    { count:10, y0:38, podW:42, podH:72, startX:70, gap:52, scale:0.55 },
    { count: 7, y0:88, podW:54, podH:65, startX:85, gap:68, scale:0.75 },
  ];
  for (const row of podRows) {
    for (let i = 0; i < row.count; i++) {
      const px = row.startX + i * row.gap;
      if (px + row.podW > SW - 70) continue;
      rect(ctx, px, row.y0, row.podW, row.podH, '#1c2e40');
      rect(ctx, px + 3, row.y0 + 4, row.podW - 6, row.podH - 8, '#040a12');
      ctx.fillStyle = 'rgba(20,60,140,0.12)'; ctx.fillRect(px + 3, row.y0 + 4, row.podW - 6, row.podH - 8);
      ctx.strokeStyle = '#1e3550'; ctx.lineWidth = 1; ctx.strokeRect(px, row.y0, row.podW, row.podH);
      // status light — all dead red
      rect(ctx, px + Math.round(row.podW * 0.38), row.y0 + 5, Math.round(row.podW * 0.24), 3, '#5a0000');
      // ice condensation hint
      ctx.fillStyle = 'rgba(80,120,200,0.05)';
      ctx.fillRect(px + 4, row.y0 + row.podH - 16, row.podW - 8, 12);
    }
  }

  // Player's open pod — center-left, on floor (pod they just exited)
  rect(ctx, 180, HY + 30, 70, 120, '#1c2e40');
  rect(ctx, 184, HY + 34, 62, 110, '#040a12');
  ctx.strokeStyle = '#2a4060'; ctx.lineWidth = 2; ctx.strokeRect(180, HY + 30, 70, 120);
  // open hatch indication
  rect(ctx, 180, HY + 30, 70, 18, '#263848');
  ctx.fillStyle = 'rgba(30,80,180,0.08)'; ctx.fillRect(184, HY + 48, 62, 96);
  // cryo residue/frost
  ctx.strokeStyle = 'rgba(120,180,255,0.25)'; ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath(); ctx.moveTo(185 + i * 15, HY + 48); ctx.lineTo(190 + i * 12, HY + 80); ctx.stroke();
  }

  // Atmospheric fog near floor
  const fog = ctx.createLinearGradient(0, HY + 40, 0, HY + 100);
  fog.addColorStop(0, 'rgba(180,30,0,0.06)'); fog.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = fog; ctx.fillRect(0, HY, SW, 120);

  // Emergency lights pooling on floor
  glow(ctx, 160, SH - 30, 120, 'rgba(180,20,0,0.10)');
  glow(ctx, 480, SH - 40, 100, 'rgba(180,20,0,0.08)');

  // Right-side exit doorway
  sideExit(ctx, 'right', 'rgba(60,100,220,0.5)');

  // Ceiling
  rect(ctx, 0, 0, SW, 14, '#220808');

  // Back wall
  rect(ctx, 0, 14, SW, 101, '#110404');

  // Red glow strips on ceiling
  for (let i = 0; i < 4; i++) {
    const lx = 25 + i * 82;
    rect(ctx, lx, 8, 22, 5, '#5a0000');
    const g = ctx.createRadialGradient(lx+11, 13, 1, lx+11, 13, 55);
    g.addColorStop(0, 'rgba(200,0,0,0.18)'); g.addColorStop(1, 'rgba(200,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(lx-44, 0, 110, 90);
  }

  // Cryo pods — two rows
  for (let row = 0; row < 2; row++) {
    const scale = row === 0 ? 0.65 : 1;
    const podW = Math.round(26 * scale), podH = Math.round(50 * scale);
    const baseY = row === 0 ? (115 - Math.round(52*scale) - 5) : (115 - podH - 2);
    const count = row === 0 ? 8 : 6;
    const startX = row === 0 ? 8 : 20;
    const spacing = row === 0 ? 38 : 50;
    for (let i = 0; i < count; i++) {
      const px = startX + i * spacing;
      rect(ctx, px, baseY, podW, podH, '#162030');
      rect(ctx, px+2, baseY+3, podW-4, podH-6, '#060c14');
      ctx.fillStyle = 'rgba(50,90,160,0.08)'; ctx.fillRect(px+2, baseY+3, podW-4, podH-6);
      ctx.strokeStyle = '#1e3050'; ctx.lineWidth = 1; ctx.strokeRect(px, baseY, podW, podH);
      // dead indicator
      rect(ctx, px + Math.round(podW*0.35), baseY + 4, Math.round(podW*0.3), 2, '#1a0808');
    }
  }

}

function drawCorridorA(ctx, flags, defeated, collected, doneActions) {
  // ── background
  backWall(ctx, '#08101e', '#020408');
  perspFloor(ctx, '#080c14', '#04060c', 'rgba(30,50,120,0.12)');

  // ceiling strip
  rect(ctx, 0, 0, SW, 24, '#0a0d1c');

  // ceiling conduit runs
  ctx.strokeStyle = '#0e1428'; ctx.lineWidth = 4;
  for (let i = 0; i < 4; i++) {
    const cx2 = 100 + i * 140;
    ctx.beginPath(); ctx.moveTo(cx2, 0); ctx.lineTo(cx2, 24); ctx.stroke();
  }

  // ceiling emergency light panels
  for (let i = 0; i < 4; i++) {
    const lx = 60 + i * 150;
    rect(ctx, lx, 4, 70, 10, '#16203a');
    glow(ctx, lx + 35, 14, 90, 'rgba(60,90,220,0.14)');
  }

  // Hanging cables from ceiling (damaged)
  ctx.lineWidth = 2;
  for (let i = 0; i < 10; i++) {
    const cx2 = 40 + i * 60;
    const sag = 18 + (i % 3) * 12;
    ctx.strokeStyle = (i % 4 === 0) ? '#cc4400' : '#1a2438';
    ctx.beginPath();
    ctx.moveTo(cx2, 24);
    ctx.quadraticCurveTo(cx2 + 8, 24 + sag, cx2 + 3, 24 + sag + 18);
    ctx.stroke();
    if (i % 4 === 0) { // sparking cable
      glow(ctx, cx2 + 3, 24 + sag + 18, 20, 'rgba(255,120,0,0.18)');
    }
  }

  // Back wall — centre hatch to bridge (x:262,y:168,w:116,h:105 → center receding hatch)
  rect(ctx, 262, 60, 116, 95, '#06090f');
  rect(ctx, 268, 64, 104, 85, '#020408');
  ctx.strokeStyle = '#1a2848'; ctx.lineWidth = 2; ctx.strokeRect(262, 60, 116, 95);
  // hatch panel lines
  ctx.strokeStyle = '#0e1830'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(320, 64); ctx.lineTo(320, 149); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(268, 107); ctx.lineTo(372, 107); ctx.stroke();
  // hatch indicator light
  const blinkH = Math.floor(Date.now() / 600) % 2;
  rect(ctx, 306, 66, 28, 5, blinkH ? '#002288' : '#00aaff');
  // label
  ctx.font = 'bold 9px "Courier New",monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#1e3060'; ctx.fillText('BRIDGE — LV1', 320, 154);

  // Wall ribs — perspective lines on ceiling/walls
  ctx.strokeStyle = '#0e1428'; ctx.lineWidth = 3;
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const bx = t * SW;
    ctx.beginPath(); ctx.moveTo(VX, HY); ctx.lineTo(bx, 0); ctx.stroke();
  }

  // Bulkhead panels — left/right areas of back wall
  for (let side = 0; side < 2; side++) {
    const bx = side === 0 ? 62 : 450;
    const bw = 200;
    for (let j = 0; j < 3; j++) {
      const py = 28 + j * 38;
      ctx.strokeStyle = '#0e1830'; ctx.lineWidth = 1;
      ctx.strokeRect(bx + 10, py, bw - 20, 32);
      rect(ctx, bx + 10, py, bw - 20, 4, '#0c1428');
    }
  }

  // Technician body on floor (near hotspot x:188, y:355)
  if (!doneActions?.search_body) {
    // body
    rect(ctx, 148, 342, 80, 22, '#1a2438');
    // head
    rect(ctx, 140, 335, 22, 18, '#c8a070');
    // uniform detail
    ctx.strokeStyle = '#263850'; ctx.lineWidth = 1; ctx.strokeRect(148, 342, 80, 22);
    // tool belt items scattered
    rect(ctx, 200, 358, 18, 6, '#2a3c50');
    rect(ctx, 220, 360, 10, 4, '#1a2a40');
    // security pass visible
    rect(ctx, 162, 344, 12, 16, '#3a5080');
    ctx.strokeStyle = '#6080b0'; ctx.lineWidth = 1; ctx.strokeRect(162, 344, 12, 16);
    // pool of dark liquid
    ctx.fillStyle = 'rgba(10,15,30,0.5)';
    ctx.beginPath(); ctx.ellipse(175, 370, 44, 12, 0, 0, Math.PI * 2); ctx.fill();
  }

  // Damaged drone (near hotspot x:492, y:272)
  if (!defeated?.corridor_a) {
    const dx = 466, dy = 234;
    // body
    rect(ctx, dx, dy, 52, 42, '#2c3848');
    rect(ctx, dx + 4, dy - 16, 44, 18, '#1e2c3c');
    ctx.strokeStyle = '#3a4c60'; ctx.lineWidth = 1; ctx.strokeRect(dx, dy, 52, 42);
    // red sensor eyes
    glow(ctx, dx + 14, dy + 16, 12, 'rgba(220,30,0,0.5)');
    glow(ctx, dx + 38, dy + 16, 12, 'rgba(220,30,0,0.5)');
    rect(ctx, dx + 8, dy + 12, 14, 8, '#cc1000');
    rect(ctx, dx + 30, dy + 12, 14, 8, '#cc1000');
    // antenna
    rect(ctx, dx + 22, dy - 28, 6, 14, '#263040');
    rect(ctx, dx + 18, dy - 30, 14, 4, '#1e2838');
    // damage sparks
    glow(ctx, dx + 52, dy + 8, 18, 'rgba(255,140,0,0.25)');
    // hover jets (damaged)
    ctx.strokeStyle = 'rgba(100,160,255,0.2)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(dx + 26, dy + 42, 20, 5, 0, 0, Math.PI * 2); ctx.stroke();
  }

  // Scrap metal item (at hotspot x:338, y:348)
  // (drawn by hotspot overlay, just add subtle floor marking)
  ctx.fillStyle = 'rgba(60,80,100,0.15)';
  ctx.beginPath(); ctx.ellipse(338, 358, 28, 8, 0, 0, Math.PI * 2); ctx.fill();

  // Atmospheric effects
  glow(ctx, 160, SH - 20, 150, 'rgba(30,50,180,0.08)');
  glow(ctx, 480, SH - 20, 130, 'rgba(30,50,180,0.06)');

  // Side exits
  sideExit(ctx, 'left',  'rgba(50,80,200,0.5)');
  sideExit(ctx, 'right', 'rgba(50,80,200,0.5)');
}

function drawMedBay(ctx, flags, defeated, collected, doneActions) {
  // ── background
  backWall(ctx, '#031208', '#010804');
  perspFloor(ctx, '#060e05', '#030803', 'rgba(0,80,30,0.10)');

  // ceiling — clinical white-green light panels
  rect(ctx, 0, 0, SW, 24, '#0a1c10');
  for (let i = 0; i < 4; i++) {
    const lx = 50 + i * 148;
    rect(ctx, lx, 3, 90, 12, '#1a3820');
    glow(ctx, lx + 45, 15, 110, 'rgba(0,200,80,0.14)');
  }

  // back wall — sterile white panelling
  rect(ctx, 62, 24, SW - 124, HY - 24, '#050f08');
  // wall grid / panels
  ctx.strokeStyle = '#0c2015'; ctx.lineWidth = 1;
  for (let x2 = 100; x2 < SW - 100; x2 += 90) {
    ctx.beginPath(); ctx.moveTo(x2, 24); ctx.lineTo(x2, HY); ctx.stroke();
  }
  for (let y2 = 45; y2 < HY; y2 += 35) {
    ctx.beginPath(); ctx.moveTo(62, y2); ctx.lineTo(SW - 62, y2); ctx.stroke();
  }

  // Patient chart screen (near hotspot x:428, y:228 → on back wall area)
  rect(ctx, 370, 38, 100, 72, '#080f0a');
  rect(ctx, 374, 42, 92, 64, '#020a05');
  ctx.strokeStyle = '#00c060'; ctx.lineWidth = 2; ctx.strokeRect(374, 42, 92, 64);
  glow(ctx, 420, 74, 55, 'rgba(0,180,60,0.12)');
  // text lines on screen
  ctx.fillStyle = '#00b050';
  for (let i = 0; i < 6; i++) {
    const lw = [56, 72, 44, 80, 50, 64][i];
    ctx.fillRect(378, 47 + i * 9, lw, 3);
  }
  // YOUR NAME line highlighted red
  rect(ctx, 378, 47, 56, 3, '#ff4400');
  glow(ctx, 406, 50, 22, 'rgba(255,80,0,0.2)');
  // screen label
  ctx.font = '8px "Courier New",monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillStyle = '#0a2010'; ctx.fillText('PATIENT CHART', 420, 108);

  // Medical supply cabinet (left wall area)
  rect(ctx, 80, 35, 80, 110, '#050e08');
  ctx.strokeStyle = '#0c2015'; ctx.lineWidth = 1; ctx.strokeRect(80, 35, 80, 110);
  for (let shelf = 0; shelf < 3; shelf++) {
    rect(ctx, 83, 68 + shelf * 28, 74, 3, '#0c2015');
    // items on shelf
    for (let item = 0; item < 3; item++) {
      rect(ctx, 86 + item * 22, 54 + shelf * 28, 14, 12, '#081808');
      ctx.strokeStyle = '#1a4025'; ctx.lineWidth = 1; ctx.strokeRect(86 + item * 22, 54 + shelf * 28, 14, 12);
    }
  }

  // Medical examination tables — 3, in perspective (receding toward back wall)
  const tableSpecs = [
    { x: 120, y: HY + 55, w: 100, h: 40, ht: 18 },  // near-left
    { x: 270, y: HY + 40, w: 88,  h: 36, ht: 14 },  // mid-center
    { x: 460, y: HY + 45, w: 90,  h: 36, ht: 15 },  // mid-right
  ];
  for (const t of tableSpecs) {
    // legs
    ctx.fillStyle = '#0a1c10';
    ctx.fillRect(t.x + 6, t.y + t.h, 8, t.ht);
    ctx.fillRect(t.x + t.w - 14, t.y + t.h, 8, t.ht);
    // table surface
    rect(ctx, t.x, t.y, t.w, t.h, '#0c2018');
    rect(ctx, t.x, t.y, t.w, 6, '#182c20'); // top edge
    ctx.strokeStyle = '#1e4030'; ctx.lineWidth = 1; ctx.strokeRect(t.x, t.y, t.w, t.h);
    // sheet/patient indicator
    ctx.fillStyle = 'rgba(200,220,210,0.04)'; ctx.fillRect(t.x + 4, t.y + 6, t.w - 8, t.h - 10);
  }

  // Surgical tray on floor near left table
  rect(ctx, 112, SH - 80, 40, 20, '#0c1c14');
  ctx.strokeStyle = '#1a3020'; ctx.lineWidth = 1; ctx.strokeRect(112, SH - 80, 40, 20);
  for (let i = 0; i < 4; i++) rect(ctx, 115 + i * 9, SH - 77, 6, 14, '#0a1810');

  // Med stim / ration pack / data chip items — floor shadows (hotspots at y:342)
  const itemGlows = [
    { x: 162, col: 'rgba(0,200,60,0.12)' },
    { x: 332, col: 'rgba(80,180,255,0.10)' },
    { x: 502, col: 'rgba(200,140,0,0.10)' },
  ];
  for (const ig of itemGlows) {
    ctx.fillStyle = ig.col;
    ctx.beginPath(); ctx.ellipse(ig.x, 352, 26, 8, 0, 0, Math.PI * 2); ctx.fill();
  }

  // Atmospheric lighting
  glow(ctx, 320, HY + 80, 200, 'rgba(0,120,40,0.06)');

  sideExit(ctx, 'left',  'rgba(40,180,80,0.45)');
  sideExit(ctx, 'right', 'rgba(40,180,80,0.45)');
}

function drawAiCore(ctx, flags, defeated, collected, doneActions) {
  const t2 = Date.now();
  const pulse = 0.5 + Math.sin(t2 * 0.002) * 0.3;

  backWall(ctx, '#150800', '#080300');
  perspFloor(ctx, '#100600', '#070300', 'rgba(150,60,0,0.10)');

  // ceiling
  rect(ctx, 0, 0, SW, 24, '#1c0a00');
  // processing array cables from ceiling to center
  ctx.strokeStyle = '#2a1200'; ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const cx2 = 80 + i * 70;
    ctx.beginPath(); ctx.moveTo(cx2, 0); ctx.lineTo(VX, HY - 30); ctx.stroke();
  }
  // ceiling glow from ARIA
  glow(ctx, VX, 0, 180, `rgba(255,130,0,${0.12 * pulse})`);

  // server racks — left bank
  for (let side = 0; side < 2; side++) {
    const rx = side === 0 ? 62 : SW - 62 - 100;
    const rw = 100, rh = HY - 30;
    rect(ctx, rx, 26, rw, rh, '#0e0800');
    ctx.strokeStyle = '#251200'; ctx.lineWidth = 1; ctx.strokeRect(rx, 26, rw, rh);
    // rack units
    for (let u = 0; u < 8; u++) {
      const uy = 30 + u * (rh / 8);
      rect(ctx, rx + 3, uy, rw - 6, rh / 8 - 2, '#0c0700');
      ctx.strokeStyle = '#1e0e00'; ctx.lineWidth = 1; ctx.strokeRect(rx + 3, uy, rw - 6, rh / 8 - 2);
      // LED indicators
      const tick = Math.floor(t2 / 600 + u * 0.7) % 5;
      for (let led = 0; led < 5; led++) {
        const ledOn = led !== tick;
        rect(ctx, rx + 6 + led * 12, uy + 4, 8, 5,
          ledOn ? (led === 2 ? '#ff6600' : '#604000') : '#1a0e00');
        if (ledOn && led === 2) glow(ctx, rx + 10 + led * 12, uy + 6, 10, 'rgba(255,100,0,0.3)');
      }
    }
  }

  // Central ARIA terminal pedestal (hotspot at x:320, y:288)
  // Pedestal base
  rect(ctx, 284, HY + 50, 72, 88, '#1a0c00');
  rect(ctx, 288, HY + 54, 64, 80, '#120800');
  ctx.strokeStyle = `rgba(255,140,0,${0.4 * pulse})`; ctx.lineWidth = 2;
  ctx.strokeRect(284, HY + 50, 72, 88);

  // Holographic ARIA core module on pedestal top
  const cg = ctx.createRadialGradient(VX, HY + 46, 4, VX, HY + 46, 50);
  cg.addColorStop(0, `rgba(255,170,0,${0.5 * pulse})`);
  cg.addColorStop(0.4, `rgba(200,80,0,${0.18 * pulse})`);
  cg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = cg; ctx.fillRect(VX - 50, HY, 100, 96);

  // Core device body
  rect(ctx, 304, HY + 22, 32, 28, '#2a1800');
  rect(ctx, 308, HY + 26, 24, 20, '#401c00');
  ctx.strokeStyle = `rgba(255,160,0,${0.8 * pulse})`; ctx.lineWidth = 2;
  ctx.strokeRect(304, HY + 22, 32, 28);
  // core crystal
  rect(ctx, 314, HY + 32, 12, 8, `rgba(255,200,0,${pulse})`);
  glow(ctx, VX, HY + 36, 24, `rgba(255,180,0,${0.6 * pulse})`);

  // Terminal screen above pedestal
  rect(ctx, 256, 52, 128, 80, '#120900');
  rect(ctx, 260, 56, 120, 72, '#080400');
  ctx.strokeStyle = `rgba(200,100,0,0.6)`; ctx.lineWidth = 2; ctx.strokeRect(256, 52, 128, 80);
  ctx.fillStyle = `rgba(200,100,0,${0.4 * pulse})`;
  const lines = ['ARIA SUBSYSTEM', '> EMERGENCY ACTIVE', '> DETECTING...', '> ...who\'s there?'];
  ctx.font = '9px "Courier New",monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  lines.forEach((l, i) => { ctx.fillStyle = `rgba(${i===3?'255,220,0':'200,100,0'},${0.7 * pulse})`; ctx.fillText(l, 264, 60 + i * 16); });
  glow(ctx, VX, 92, 70, `rgba(200,80,0,${0.10 * pulse})`);

  // Floor glow
  glow(ctx, VX, SH - 40, 200, `rgba(200,80,0,${0.10 * pulse})`);

  sideExit(ctx, 'left',  'rgba(180,80,0,0.45)');
  sideExit(ctx, 'right', 'rgba(60,100,200,0.45)');
}

function drawBridge(ctx, _flags, defeated, _collected, doneActions) {
  backWall(ctx, '#080d1e', '#030510');
  perspFloor(ctx, '#060810', '#03050c', 'rgba(20,40,140,0.12)');

  rect(ctx, 0, 0, SW, 24, '#06091c');

  // Main viewport — large panoramic window spanning back wall
  rect(ctx, 100, 10, 440, 122, '#010208');
  ctx.strokeStyle = '#1e2e58'; ctx.lineWidth = 3; ctx.strokeRect(100, 10, 440, 122);
  // viewport frame dividers
  ctx.strokeStyle = '#141e40'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(320, 10); ctx.lineTo(320, 132); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(100, 66); ctx.lineTo(540, 66); ctx.stroke();

  // Star field
  const starSeed = [37,89,142,203,17,256,301,178,63,228,94,315,150,55,270,120,45,190,
                    88,165,240,312,14,200,350,420,78,190,270,380,52,130,210,290,410];
  ctx.fillStyle = '#ffffff';
  starSeed.forEach((s, i) => {
    const sx = 103 + (s * 17 + i * 31) % 434;
    const sy = 13 + (s * 7 + i * 13) % 116;
    ctx.fillRect(sx, sy, (i % 4 === 0) ? 2 : 1, (i % 4 === 0) ? 2 : 1);
  });
  // nebula
  const ng = ctx.createRadialGradient(390, 55, 8, 390, 55, 70);
  ng.addColorStop(0, 'rgba(80,20,180,0.2)'); ng.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = ng; ctx.fillRect(320, 10, 220, 122);
  // blue nebula secondary
  const ng2 = ctx.createRadialGradient(180, 80, 5, 180, 80, 50);
  ng2.addColorStop(0, 'rgba(0,60,200,0.15)'); ng2.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = ng2; ctx.fillRect(100, 10, 220, 122);
  // Hull breach — visible through right side of viewport
  glow(ctx, 520, 50, 60, 'rgba(100,150,255,0.12)');
  // crack lines on viewport glass
  ctx.strokeStyle = 'rgba(180,210,255,0.25)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(340, 10); ctx.lineTo(322, 44); ctx.lineTo(308, 70); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(322, 44); ctx.lineTo(340, 66); ctx.stroke();

  // Planet — distant, partially visible
  ctx.fillStyle = 'rgba(30,60,140,0.35)';
  ctx.beginPath(); ctx.arc(155, 95, 38, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(50,80,180,0.2)';
  ctx.beginPath(); ctx.arc(155, 95, 38, 0, Math.PI * 2); ctx.fill();
  glow(ctx, 135, 80, 30, 'rgba(60,100,220,0.15)');

  // Life-support / system readouts on side walls
  for (let side = 0; side < 2; side++) {
    const sx = side === 0 ? 62 : SW - 100;
    rect(ctx, sx, 25, 36, HY - 28, '#06090e');
    ctx.strokeStyle = '#0e1830'; ctx.lineWidth = 1; ctx.strokeRect(sx, 25, 36, HY - 28);
    for (let j = 0; j < 5; j++) {
      const col = j === 1 ? '#cc2200' : j === 3 ? '#aa4400' : '#002244';
      rect(ctx, sx + 4, 30 + j * 24, 28, 16, col);
      ctx.fillStyle = j === 1 ? 'rgba(255,30,0,0.4)' : 'rgba(0,60,180,0.2)';
      ctx.fillRect(sx + 4, 30 + j * 24, 28, 16);
    }
  }

  // Main control consoles — curving bank in perspective
  const consoles = [
    { x: 90,  y: HY + 28, w: 110, h: 50 },
    { x: 220, y: HY + 18, w: 90,  h: 44 },
    { x: 330, y: HY + 18, w: 90,  h: 44 },
    { x: 440, y: HY + 28, w: 110, h: 50 },
  ];
  for (const c of consoles) {
    rect(ctx, c.x, c.y, c.w, c.h, '#080c1c');
    rect(ctx, c.x, c.y, c.w, 8, '#0c1228');
    ctx.strokeStyle = '#162040'; ctx.lineWidth = 1; ctx.strokeRect(c.x, c.y, c.w, c.h);
    ctx.fillStyle = 'rgba(0,60,200,0.10)'; ctx.fillRect(c.x + 4, c.y + 10, c.w - 8, c.h - 18);
    // status lights
    for (let j = 0; j < 5; j++) {
      const col = j === 1 ? '#cc3300' : j === 3 ? '#003388' : '#001a44';
      rect(ctx, c.x + 6 + j * (c.w - 12) / 5, c.y + 14, 14, 6, col);
    }
  }

  // Navigation console with blinking alert (hotspot x:542, y:282)
  rect(ctx, 490, HY + 40, 88, 80, '#060a16');
  rect(ctx, 494, HY + 44, 80, 68, '#020508');
  ctx.strokeStyle = '#1a2850'; ctx.lineWidth = 2; ctx.strokeRect(490, HY + 40, 88, 80);
  ctx.fillStyle = 'rgba(0,80,200,0.12)'; ctx.fillRect(494, HY + 44, 80, 68);
  if (!doneActions?.read_message) {
    const blink = Math.floor(Date.now() / 500) % 2;
    glow(ctx, 534, HY + 68, blink ? 30 : 8, 'rgba(0,180,255,0.5)');
    rect(ctx, 520, HY + 56, 28, 12, blink ? '#00aaff' : '#003366');
    ctx.font = '7px "Courier New",monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillStyle = blink ? '#aaddff' : '#003366'; ctx.fillText('MSG', 534, HY + 70);
  }

  // Defense system (hotspot x:358, y:262)
  if (!defeated?.bridge) {
    const dx = 334, dy = 218;
    // turret base
    rect(ctx, dx, dy + 22, 48, 28, '#1a2030');
    // turret body
    rect(ctx, dx + 8, dy + 8, 32, 20, '#202838');
    ctx.strokeStyle = '#cc2020'; ctx.lineWidth = 2; ctx.strokeRect(dx + 8, dy + 8, 32, 20);
    // barrel
    rect(ctx, dx + 20, dy - 8, 8, 18, '#303848');
    // targeting laser (faint red beam)
    glow(ctx, dx + 24, dy - 8, 20, 'rgba(255,0,0,0.2)');
    // red eye sensor
    glow(ctx, dx + 24, dy + 16, 10, 'rgba(255,20,0,0.6)');
    rect(ctx, dx + 18, dy + 12, 12, 6, '#cc0000');
  }

  // Atmospheric blue glow on floor
  glow(ctx, VX, SH - 30, 220, 'rgba(20,50,180,0.08)');

  sideExit(ctx, 'left', 'rgba(50,80,200,0.5)');
}

function drawEngineering(ctx, _flags, defeated, collected, _doneActions) {
  backWall(ctx, '#1c0500', '#0c0200');
  perspFloor(ctx, '#140400', '#090200', 'rgba(180,60,0,0.10)');

  rect(ctx, 0, 0, SW, 24, '#200700');

  // Engine glow — large radial bloom from back wall center
  glow(ctx, VX, 60, 280, 'rgba(255,100,0,0.18)');
  glow(ctx, VX, HY, 160, 'rgba(255,60,0,0.10)');

  // Ceiling pipes
  ctx.strokeStyle = '#2a0e00'; ctx.lineWidth = 4;
  for (let i = 0; i < 4; i++) {
    const px = 90 + i * 150;
    ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, 24); ctx.stroke();
  }
  ctx.strokeStyle = '#1e0800'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(0, 14); ctx.lineTo(SW, 14); ctx.stroke();
  // burst sparks from damaged pipe
  glow(ctx, 400, 24, 24, 'rgba(255,140,0,0.3)');

  // Engine housing — large central structure on back wall
  rect(ctx, 160, 12, 320, HY - 12, '#120600');
  ctx.strokeStyle = '#2a0e00'; ctx.lineWidth = 2; ctx.strokeRect(160, 12, 320, HY - 12);
  // engine core rings (nested ellipses — perspective)
  for (let i = 0; i < 4; i++) {
    const er = 60 - i * 12;
    const ea = Math.round(er * 0.45);
    ctx.strokeStyle = `rgba(255,${70 + i * 30},0,${0.5 - i * 0.08})`; ctx.lineWidth = 3 - i * 0.5;
    ctx.beginPath(); ctx.ellipse(VX, 72, er, ea, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = `rgba(255,${50 + i * 20},0,${0.06 - i * 0.01})`;
    ctx.beginPath(); ctx.ellipse(VX, 72, er, ea, 0, 0, Math.PI * 2); ctx.fill();
  }
  // core center pulse
  const eng_pulse = 0.5 + Math.sin(Date.now() * 0.003) * 0.3;
  glow(ctx, VX, 72, 35, `rgba(255,180,0,${0.4 * eng_pulse})`);
  rect(ctx, VX - 8, 64, 16, 16, `rgba(255,220,0,${0.7 * eng_pulse})`);

  // Side machinery on back wall
  for (let side = 0; side < 2; side++) {
    const mx = side === 0 ? 62 : SW - 162;
    rect(ctx, mx, 18, 100, HY - 20, '#0e0500');
    ctx.strokeStyle = '#1e0a00'; ctx.lineWidth = 1; ctx.strokeRect(mx, 18, 100, HY - 20);
    for (let j = 0; j < 4; j++) {
      rect(ctx, mx + 6, 24 + j * 30, 88, 22, '#0c0400');
      ctx.strokeStyle = '#200c00'; ctx.lineWidth = 1; ctx.strokeRect(mx + 6, 24 + j * 30, 88, 22);
      // valve / gauge
      ctx.fillStyle = 'rgba(255,80,0,0.2)'; ctx.beginPath();
      ctx.arc(mx + 50, 35 + j * 30, 8, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Escape pod bays (left and right of center, on floor-level)
  // Left pod — empty (bay open, pod gone)
  const lp = { x: 62, y: HY + 20, w: 130, h: 200 };
  rect(ctx, lp.x, lp.y, lp.w, lp.h, '#0e0600');
  rect(ctx, lp.x + 4, lp.y + 4, lp.w - 8, lp.h - 8, '#060200');
  ctx.strokeStyle = '#1e0e00'; ctx.lineWidth = 2; ctx.strokeRect(lp.x, lp.y, lp.w, lp.h);
  ctx.font = 'bold 10px "Courier New",monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#3a1800'; ctx.fillText('BAY 1 — EMPTY', lp.x + lp.w / 2, lp.y + lp.h / 2);

  // Right pod — intact (near hotspot x:198, y:302 is launch_pod action)
  const rp = { x: 448, y: HY + 20, w: 130, h: 200 };
  rect(ctx, rp.x, rp.y, rp.w, rp.h, '#1a0e00');
  rect(ctx, rp.x + 4, rp.y + 4, rp.w - 8, rp.h - 8, '#100800');
  ctx.strokeStyle = '#3a1800'; ctx.lineWidth = 2; ctx.strokeRect(rp.x, rp.y, rp.w, rp.h);
  // pod interior
  ctx.fillStyle = 'rgba(60,30,0,0.3)'; ctx.fillRect(rp.x + 4, rp.y + 4, rp.w - 8, rp.h - 8);
  // pilot seat outline
  rect(ctx, rp.x + 38, rp.y + 80, 54, 80, '#0e0800');
  ctx.strokeStyle = '#281400'; ctx.lineWidth = 1; ctx.strokeRect(rp.x + 38, rp.y + 80, 54, 80);
  // fuel indicator (right side of pod)
  const fuelOk = collected?.fuel_cell;
  rect(ctx, rp.x + 8, rp.y + 20, 18, 50, '#0c0600');
  rect(ctx, rp.x + 10, rp.y + 22, 14, fuelOk ? 46 : 6, fuelOk ? '#ffaa00' : '#3a0000');
  ctx.strokeStyle = '#2a1000'; ctx.lineWidth = 1; ctx.strokeRect(rp.x + 8, rp.y + 20, 18, 50);
  glow(ctx, rp.x + 15, rp.y + 45, fuelOk ? 22 : 8, fuelOk ? 'rgba(255,180,0,0.3)' : 'rgba(180,0,0,0.2)');
  // launch-ready label
  ctx.font = 'bold 10px "Courier New",monospace'; ctx.textAlign = 'center'; ctx.fillStyle = fuelOk ? '#ffaa00' : '#3a1800';
  ctx.fillText(fuelOk ? 'READY TO LAUNCH' : 'BAY 2 — NO FUEL', rp.x + rp.w / 2, rp.y + 10);

  // Guard (hotspot x:428, y:268)
  if (!defeated?.engineering) {
    const gx = 404, gy = 220;
    // body armor
    rect(ctx, gx, gy + 24, 46, 54, '#1e3c5a');
    // shoulder pads
    rect(ctx, gx - 8, gy + 28, 14, 30, '#162e48');
    rect(ctx, gx + 40, gy + 28, 14, 30, '#162e48');
    // head/helmet
    rect(ctx, gx + 6, gy, 34, 26, '#c8a870');
    rect(ctx, gx + 4, gy + 2, 38, 14, '#1a2e44'); // visor
    ctx.strokeStyle = '#243e5a'; ctx.lineWidth = 1; ctx.strokeRect(gx + 4, gy + 2, 38, 14);
    // legs
    rect(ctx, gx + 4, gy + 78, 16, 30, '#142840');
    rect(ctx, gx + 26, gy + 78, 16, 30, '#142840');
    // Nexus Corp badge
    rect(ctx, gx + 14, gy + 32, 18, 12, '#cc2200');
    ctx.strokeStyle = '#ee3300'; ctx.lineWidth = 1; ctx.strokeRect(gx + 14, gy + 32, 18, 12);
    ctx.font = '7px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#ff5500';
    ctx.fillText('NXS', gx + 23, gy + 40);
    // weapon
    rect(ctx, gx - 16, gy + 34, 14, 6, '#2a3c50');
    rect(ctx, gx - 20, gy + 35, 6, 4, '#1a2c3e');
    ctx.strokeStyle = '#cc2200'; ctx.lineWidth = 1; ctx.strokeRect(gx - 16, gy + 34, 14, 6);
    glow(ctx, gx + 23, gy + 12, 22, 'rgba(200,30,0,0.15)');
  }

  // Fuel cell item floor shadow (hotspot x:168, y:342)
  ctx.fillStyle = 'rgba(255,160,0,0.08)';
  ctx.beginPath(); ctx.ellipse(168, 352, 24, 7, 0, 0, Math.PI * 2); ctx.fill();

  // Atmospheric engine heat shimmer / orange floor glow
  glow(ctx, VX, SH - 20, 260, 'rgba(200,80,0,0.08)');

  sideExit(ctx, 'right', 'rgba(180,80,0,0.5)');
}

function drawScene(ctx, locId, state) {
  ctx.clearRect(0, 0, SW, SH);
  switch (locId) {
    case 'cryo_bay':    drawCryoBay(ctx, state.flags, state.defeated, state.collected, state.doneActions); break;
    case 'corridor_a':  drawCorridorA(ctx, state.flags, state.defeated, state.collected, state.doneActions); break;
    case 'med_bay':     drawMedBay(ctx, state.flags, state.defeated, state.collected, state.doneActions); break;
    case 'ai_core':     drawAiCore(ctx, state.flags, state.defeated, state.collected, state.doneActions); break;
    case 'bridge':      drawBridge(ctx, state.flags, state.defeated, state.collected, state.doneActions); break;
    case 'engineering': drawEngineering(ctx, state.flags, state.defeated, state.collected, state.doneActions); break;
    default: rect(ctx, 0, 0, SW, SH, '#080808');
  }
}

// ═══════════════════════════════════════════════════════
// CHARACTER SPRITE
// ═══════════════════════════════════════════════════════

function drawCharSprite(ctx, x, y, dir, frame, walking) {
  // scale from 0.25 (far/horizon) to 1.0 (near/bottom)
  const sc = 0.25 + Math.max(0, Math.min(1, (y - 160) / (380 - 160))) * 0.75;
  const bw = Math.round(20 * sc);
  const bh = Math.round(44 * sc);
  const lx = Math.round(x - bw / 2);
  const by = Math.round(y - bh);

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(Math.round(x), Math.round(y), Math.round(bw * 0.75), Math.round(3 * sc), 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs
  const legW = Math.max(1, Math.round(4 * sc));
  const legH = Math.max(2, Math.round(8 * sc));
  const legY = by + Math.round(14 * sc);
  const walkCycle = [2, 0, -2, 0];
  const lOff = walking ? Math.round(walkCycle[frame % 4] * sc) : 0;
  const rOff = -lOff;
  ctx.fillStyle = '#102030';
  ctx.fillRect(lx, legY + Math.max(0, lOff), legW, legH - Math.abs(lOff));
  ctx.fillRect(lx + bw - legW, legY + Math.max(0, rOff), legW, legH - Math.abs(rOff));

  // Suit body
  ctx.fillStyle = dir === 'right' ? '#2a5080' : '#22406a';
  ctx.fillRect(lx, by + Math.round(6 * sc), bw, Math.round(9 * sc));

  // Arms
  const armW = Math.max(1, Math.round(3 * sc));
  const armH = Math.max(2, Math.round(6 * sc));
  const armY = by + Math.round(7 * sc);
  const aOff = walking ? Math.round(walkCycle[(frame + 2) % 4] * sc) : 0;
  ctx.fillStyle = '#22406a';
  ctx.fillRect(lx - armW, armY + Math.max(0, aOff), armW, armH - Math.abs(aOff));
  ctx.fillRect(lx + bw, armY + Math.max(0, -aOff), armW, armH - Math.abs(aOff));

  // Head
  ctx.fillStyle = '#d4a870';
  ctx.fillRect(lx + Math.round(bw * 0.12), by, Math.round(bw * 0.76), Math.round(6 * sc));

  // Visor
  const visorX = dir === 'right' ? lx + Math.round(bw * 0.38) : lx + Math.round(bw * 0.05);
  ctx.fillStyle = dir === 'right' ? '#70c8f0' : '#50a8d0';
  ctx.fillRect(visorX, by + Math.round(sc), Math.round(bw * 0.48), Math.round(3 * sc));

  // Collar
  ctx.fillStyle = '#3a6090';
  ctx.fillRect(lx + Math.round(bw * 0.08), by + Math.round(5 * sc), Math.round(bw * 0.84), Math.max(1, Math.round(2 * sc)));
}

// ═══════════════════════════════════════════════════════
// HOTSPOT OVERLAYS
// ═══════════════════════════════════════════════════════

function drawHotspots(ctx, locId, state) {
  const hs = ROOM_HS[locId] || {};
  const t = Date.now();

  // Items — cyan pulse
  for (const item of hs.items || []) {
    if (state.collected[item.id]) continue;
    const pulse = 0.45 + Math.sin(t * 0.003 + item.x * 0.02) * 0.3;
    ctx.strokeStyle = `rgba(0,229,212,${pulse})`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(item.x, item.y - 10, item.r - 2, 0, Math.PI * 2); ctx.stroke();
    // emoji icon
    ctx.font = `${Math.round(item.r * 1.6)}px serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = `rgba(255,255,255,${0.7 + pulse * 0.3})`;
    ctx.fillText(ITEMS[item.id]?.icon || '?', item.x, item.y - 10);
  }

  // Enemy — red pulse
  if (hs.enemy && !state.defeated[locId]) {
    const e = hs.enemy;
    const pulse = 0.35 + Math.sin(t * 0.004) * 0.25;
    ctx.strokeStyle = `rgba(255,34,68,${pulse})`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(e.x, e.y - 8, e.r, 0, Math.PI * 2); ctx.stroke();
  }

  // Actions — amber pulse
  for (const action of hs.actions || []) {
    if (state.doneActions[action.id]) continue;
    const pulse = 0.3 + Math.sin(t * 0.0022 + 1) * 0.2;
    ctx.strokeStyle = `rgba(255,170,0,${pulse})`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(action.x, action.y - 8, action.r - 2, 0, Math.PI * 2); ctx.stroke();
  }

  // Exits — subtle arrows
  for (const exit of hs.exits || []) {
    const arrowX = exit.x + exit.w / 2;
    const arrowY = exit.y + exit.h / 2;
    ctx.fillStyle = 'rgba(100,140,255,0.22)';
    ctx.beginPath();
    if (exit.x === 0) { // left
      ctx.moveTo(arrowX + 6, arrowY - 5); ctx.lineTo(arrowX - 2, arrowY); ctx.lineTo(arrowX + 6, arrowY + 5);
    } else if (exit.x > 250) { // right
      ctx.moveTo(arrowX - 6, arrowY - 5); ctx.lineTo(arrowX + 2, arrowY); ctx.lineTo(arrowX - 6, arrowY + 5);
    } else {
      ctx.moveTo(arrowX - 5, arrowY + 4); ctx.lineTo(arrowX, arrowY - 3); ctx.lineTo(arrowX + 5, arrowY + 4);
    }
    ctx.fill();
  }

  // Location name overlay
  const loc = LOCS[locId];
  if (loc) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, SW, 32);
    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillStyle = loc.color || '#e2eaf5';
    ctx.fillText(loc.name.toUpperCase(), 10, 6);
    ctx.font = '11px "Courier New", monospace';
    ctx.fillStyle = 'rgba(180,200,220,0.5)';
    ctx.fillText(loc.area, 10, 18);
  }
}

// ═══════════════════════════════════════════════════════
// SCENE CANVAS COMPONENT
// ═══════════════════════════════════════════════════════

function SceneCanvas({ locId, flags, defeated, collected, doneActions, onNavigate, onPickup, onStartCombat, onActionById }) {
  const canvasRef = useRef(null);
  const charRef = useRef({ x: 160, y: 350, tx: null, ty: null, dir: 'right', frame: 0, ft: 0, walking: false });
  const stateRef = useRef({ locId, flags, defeated, collected, doneActions });
  const rafRef = useRef(null);

  useEffect(() => { stateRef.current = { locId, flags, defeated, collected, doneActions }; },
    [locId, flags, defeated, collected, doneActions]);

  useEffect(() => {
    const entry = ROOM_ENTRY[locId] || { x: 80, y: 132 };
    charRef.current = { ...charRef.current, x: entry.x, y: entry.y, tx: null, ty: null, walking: false };
  }, [locId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    let last = 0;

    function loop(now) {
      const dt = Math.min(now - last, 50);
      last = now;
      const c = charRef.current;

      if (c.tx !== null) {
        const dx = c.tx - c.x, dy = c.ty - c.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const speed = 4.5 * dt / 16;
        if (dist < speed + 0.5) {
          c.x = c.tx; c.y = c.ty; c.tx = null; c.ty = null; c.walking = false;
        } else {
          c.x += (dx / dist) * speed; c.y += (dy / dist) * speed;
          c.dir = dx > 0 ? 'right' : 'left'; c.walking = true;
          c.ft += dt;
          if (c.ft > 110) { c.frame = (c.frame + 1) % 4; c.ft = 0; }
        }
      } else {
        c.walking = false;
      }

      const s = stateRef.current;
      ctx.clearRect(0, 0, SW, SH);
      drawScene(ctx, s.locId, s);
      drawHotspots(ctx, s.locId, s);
      drawCharSprite(ctx, c.x, c.y, c.dir, c.frame, c.walking);

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const handleClick = useCallback((e) => {
    const canvas = canvasRef.current;
    const rect2 = canvas.getBoundingClientRect();
    const cx = (e.clientX - rect2.left) * (SW / rect2.width);
    const cy = (e.clientY - rect2.top) * (SH / rect2.height);
    const { locId: lid, defeated: def, collected: col, doneActions: done } = stateRef.current;
    const hs = ROOM_HS[lid] || {};

    // exits
    for (const exit of hs.exits || []) {
      if (cx >= exit.x && cx <= exit.x + exit.w && cy >= exit.y && cy <= exit.y + exit.h) {
        onNavigate(exit.dest); return;
      }
    }

    // enemy
    if (hs.enemy && !def[lid]) {
      const en = hs.enemy;
      if (Math.hypot(cx - en.x, cy - (en.y - 8)) < en.r + 6) { onStartCombat(lid); return; }
    }

    // items
    for (const item of hs.items || []) {
      if (!col[item.id] && Math.hypot(cx - item.x, cy - (item.y - 10)) < item.r + 8) {
        onPickup(item.id); return;
      }
    }

    // actions
    for (const action of hs.actions || []) {
      if (!done[action.id] && Math.hypot(cx - action.x, cy - (action.y - 8)) < action.r + 8) {
        onActionById(action.id); return;
      }
    }

    // walk
    charRef.current.tx = Math.max(20, Math.min(SW - 20, cx));
    charRef.current.ty = Math.max(HY + 10, Math.min(SH - 30, cy));
  }, [onNavigate, onPickup, onStartCombat, onActionById]);

  return (
    <canvas
      ref={canvasRef}
      width={SW} height={SH}
      style={{ width: '100%', height: '100%', display: 'block', imageRendering: 'pixelated', cursor: 'crosshair' }}
      onClick={handleClick}
    />
  );
}

// ═══════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Rajdhani:wght@400;500;600;700&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  :root{
    --bg:#07080f; --s1:#0d0f1a; --s2:#111320; --border:#1a1f35;
    --cyan:#00e5d4; --cdim:rgba(0,229,212,.08);
    --amber:#ffaa00; --adim:rgba(255,170,0,.08);
    --red:#ff2244; --rdim:rgba(255,34,68,.08);
    --green:#00e087; --blue:#4488ff;
    --text:#b8ccdc; --muted:#3a4a60; --white:#e2eaf5;
  }
  .vr{font-family:'Space Mono',monospace;background:var(--bg);color:var(--text);height:100vh;overflow:hidden;display:flex;flex-direction:column;}
  .scanlines{position:fixed;inset:0;pointer-events:none;z-index:200;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.04) 2px,rgba(0,0,0,.04) 4px);}

  .intro{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;padding:2rem;text-align:center;background:radial-gradient(ellipse at center,#080212 0%,#030208 100%);}
  .intro-logo{font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(2.8rem,9vw,5.5rem);color:var(--cyan);letter-spacing:.15em;animation:glow 3s ease-in-out infinite;line-height:1;}
  .intro-sub{font-family:'Rajdhani',sans-serif;font-size:.85rem;color:var(--muted);letter-spacing:.5em;margin-bottom:2.5rem;}
  .intro-text{font-size:.76rem;line-height:2.2;color:var(--text);max-width:440px;margin-bottom:2.5rem;white-space:pre-line;}
  @keyframes glow{0%,100%{text-shadow:0 0 25px rgba(0,229,212,.3)}50%{text-shadow:0 0 55px rgba(0,229,212,.65)}}

  .game{flex:1;display:grid;grid-template-columns:1fr 210px;grid-template-rows:48px auto minmax(0,1fr) auto;height:100vh;overflow:hidden;}
  .g-header{grid-column:1/-1;background:var(--s1);border-bottom:1px solid var(--border);display:flex;align-items:center;padding:0 1rem;gap:1rem;}
  .g-logo{font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.95rem;color:var(--cyan);letter-spacing:.2em;flex-shrink:0;}
  .g-stats{display:flex;gap:1.2rem;align-items:center;flex:1;justify-content:center;}
  .stat-g{display:flex;align-items:center;gap:.4rem;}
  .stat-lbl{font-size:.52rem;color:var(--muted);letter-spacing:.1em;}
  .stat-bar{width:55px;height:4px;background:rgba(255,255,255,.06);border-radius:2px;overflow:hidden;}
  .stat-fill{height:100%;border-radius:2px;transition:width .4s ease,background .4s ease;}
  .stat-num{font-size:.62rem;color:var(--text);min-width:38px;}
  .g-cr{font-size:.7rem;color:var(--amber);flex-shrink:0;}

  .scene-wrap{grid-column:1;grid-row:2;background:#000;border-bottom:1px solid var(--border);overflow:hidden;position:relative;aspect-ratio:8/5;max-height:min(55vh,480px);width:100%;}

  .elog{grid-column:1;grid-row:3;background:var(--bg);border-bottom:1px solid var(--border);padding:.75rem 1.5rem;overflow-y:auto;display:flex;flex-direction:column;gap:.3rem;min-height:0;}
  .ev{font-size:.68rem;line-height:1.8;}
  .ev-action{color:var(--cyan);}
  .ev-story{color:var(--text);border-left:2px solid var(--border);padding-left:.7rem;}
  .ev-combat{color:var(--red);}
  .ev-gain{color:var(--green);}
  .ev-aria{color:var(--amber);}
  .ev-system{color:var(--muted);}
  .ev-level{color:var(--green);font-weight:700;}

  .sidebar{grid-column:2;grid-row:2/4;background:var(--s2);border-left:1px solid var(--border);padding:.75rem;overflow-y:auto;display:flex;flex-direction:column;gap:.85rem;}
  .s-lbl{font-size:.5rem;color:var(--muted);letter-spacing:.25em;margin-bottom:.3rem;}
  .aria-box{background:var(--adim);border:1px solid rgba(255,170,0,.15);border-radius:3px;padding:.6rem;}
  .aria-nm{font-family:'Rajdhani',sans-serif;font-size:.85rem;font-weight:600;color:var(--amber);margin-bottom:.2rem;}
  .aria-info{font-size:.6rem;color:var(--muted);line-height:1.7;}
  .aria-btn{width:100%;background:transparent;border:1px solid rgba(255,170,0,.25);color:var(--amber);font-family:'Space Mono',monospace;font-size:.58rem;padding:.35rem;cursor:pointer;margin-top:.3rem;transition:all .15s;letter-spacing:.05em;}
  .aria-btn:hover{background:var(--adim);}
  .aria-btn.cyan{border-color:rgba(0,229,212,.3);color:var(--cyan);}
  .aria-btn.cyan:hover{background:var(--cdim);}
  .inv-row{font-size:.62rem;color:var(--text);padding:.22rem .4rem;border:1px solid var(--border);margin-bottom:.22rem;display:flex;align-items:center;gap:.35rem;cursor:pointer;transition:all .15s;}
  .inv-row:hover{border-color:var(--cyan);color:var(--cyan);}
  .inv-none{font-size:.62rem;color:var(--muted);}
  .impl-badge{font-size:.58rem;padding:.18rem .4rem;border-radius:2px;margin-bottom:.18rem;}
  .impl-on{background:rgba(0,229,212,.06);border:1px solid rgba(0,229,212,.2);color:var(--cyan);}
  .xp-bar{height:3px;background:rgba(255,255,255,.05);border-radius:2px;overflow:hidden;margin-top:.25rem;}
  .xp-fill{height:100%;background:var(--green);border-radius:2px;transition:width .4s ease;}

  .actions{grid-column:1/-1;background:var(--s1);border-top:1px solid var(--border);padding:.55rem .85rem;display:flex;flex-wrap:nowrap;gap:.35rem;align-items:center;overflow-x:auto;max-height:54px;}
  .ab{font-family:'Space Mono',monospace;font-size:.6rem;padding:.4rem .8rem;border:1px solid var(--border);background:transparent;color:var(--text);cursor:pointer;transition:all .15s;letter-spacing:.05em;}
  .ab:hover{border-color:var(--cyan);color:var(--cyan);background:var(--cdim);}
  .ab.pri{border-color:rgba(0,229,212,.4);color:var(--cyan);}
  .ab.dng{border-color:rgba(255,34,68,.3);color:var(--red);}
  .ab.dng:hover{background:var(--rdim);}
  .ab.amb{border-color:rgba(255,170,0,.3);color:var(--amber);}
  .ab.amb:hover{background:var(--adim);}
  .ab:disabled{opacity:.3;cursor:not-allowed;}

  .ov{position:fixed;inset:0;background:rgba(0,0,0,.78);z-index:100;display:flex;align-items:center;justify-content:center;padding:1rem;}
  .mo{background:var(--s2);border:1px solid var(--border);width:100%;max-width:500px;max-height:86vh;display:flex;flex-direction:column;overflow:hidden;}
  .mo-h{background:var(--s1);border-bottom:1px solid var(--border);padding:.65rem 1rem;display:flex;align-items:center;justify-content:space-between;}
  .mo-t{font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.95rem;color:var(--white);letter-spacing:.08em;}
  .mo-b{flex:1;overflow-y:auto;padding:.9rem;}
  .mo-f{border-top:1px solid var(--border);padding:.65rem 1rem;display:flex;gap:.45rem;flex-wrap:wrap;}
  .x-btn{background:none;border:none;color:var(--muted);font-size:1rem;cursor:pointer;line-height:1;}
  .x-btn:hover{color:var(--red);}

  .dlg-spk{font-size:.62rem;color:var(--amber);letter-spacing:.2em;margin-bottom:.55rem;}
  .dlg-txt{font-size:.76rem;line-height:2;color:var(--text);margin-bottom:1.1rem;white-space:pre-wrap;}
  .dlg-opts{display:flex;flex-direction:column;gap:.38rem;}
  .dlg-opt{background:transparent;border:1px solid var(--border);color:var(--text);font-family:'Space Mono',monospace;font-size:.65rem;padding:.55rem .85rem;cursor:pointer;text-align:left;transition:all .15s;}
  .dlg-opt:hover{border-color:var(--cyan);color:var(--cyan);background:var(--cdim);}

  .cb-enemy{text-align:center;margin-bottom:1.1rem;}
  .cb-icon{font-size:2.8rem;margin-bottom:.35rem;}
  .cb-nm{font-family:'Rajdhani',sans-serif;font-weight:700;font-size:1.05rem;color:var(--red);}
  .cb-bars{display:grid;grid-template-columns:1fr 1fr;gap:.9rem;margin-bottom:.9rem;}
  .cb-lbl{font-size:.55rem;color:var(--muted);letter-spacing:.15em;margin-bottom:.28rem;}
  .cb-bg{height:7px;background:rgba(255,255,255,.06);border-radius:3px;overflow:hidden;}
  .cb-fill{height:100%;border-radius:3px;transition:width .3s ease,background .3s ease;}
  .clog{background:var(--bg);border:1px solid var(--border);padding:.65rem;font-size:.68rem;line-height:2;color:var(--text);max-height:130px;overflow-y:auto;margin-bottom:.7rem;}
  .cb-result{text-align:center;font-family:'Rajdhani',sans-serif;font-size:1.3rem;font-weight:700;}
  .cb-result.win{color:var(--green);}
  .cb-result.lose{color:var(--red);}

  .aria-msgs{display:flex;flex-direction:column;gap:.55rem;margin-bottom:.7rem;}
  .aria-msg{font-size:.72rem;line-height:1.9;}
  .aria-msg.aria{color:var(--amber);border-left:2px solid rgba(255,170,0,.25);padding-left:.6rem;}
  .aria-msg.player{color:var(--text);padding-left:.6rem;}
  .aria-thinking{font-size:.68rem;color:var(--muted);animation:pulse 1.4s ease-in-out infinite;}
  @keyframes pulse{0%,100%{opacity:.35}50%{opacity:1}}
  .aria-row{display:flex;gap:.45rem;}
  .aria-inp{flex:1;background:var(--bg);border:1px solid var(--border);color:var(--cyan);font-family:'Space Mono',monospace;font-size:.7rem;padding:.45rem .7rem;outline:none;}
  .aria-inp:focus{border-color:var(--amber);}
  .aria-send{background:transparent;border:1px solid var(--amber);color:var(--amber);font-family:'Space Mono',monospace;font-size:.62rem;padding:.45rem .75rem;cursor:pointer;transition:all .15s;}
  .aria-send:hover{background:var(--adim);}

  .inv-cards{display:flex;flex-direction:column;gap:.45rem;}
  .inv-card{border:1px solid var(--border);padding:.7rem;display:flex;gap:.65rem;align-items:flex-start;}
  .inv-card-icon{font-size:1.4rem;flex-shrink:0;}
  .inv-card-nm{font-family:'Rajdhani',sans-serif;font-weight:600;font-size:.88rem;color:var(--white);}
  .inv-card-desc{font-size:.65rem;color:var(--muted);margin-top:.12rem;line-height:1.65;}
  .inv-card-type{font-size:.52rem;color:var(--muted);letter-spacing:.2em;margin-top:.3rem;}
  .use-btn{background:transparent;border:1px solid var(--cyan);color:var(--cyan);font-family:'Space Mono',monospace;font-size:.58rem;padding:.28rem .6rem;cursor:pointer;margin-top:.45rem;transition:all .15s;}
  .use-btn:hover{background:var(--cdim);}

  .impl-card{border:1px solid var(--border);padding:.7rem;margin-bottom:.45rem;transition:all .2s;}
  .impl-card.active{border-color:rgba(0,229,212,.3);background:rgba(0,229,212,.03);}
  .impl-card.locked{opacity:.5;}
  .impl-card-nm{font-family:'Rajdhani',sans-serif;font-weight:600;font-size:.88rem;color:var(--white);display:flex;align-items:center;gap:.4rem;flex-wrap:wrap;}
  .impl-card-desc{font-size:.65rem;color:var(--muted);margin-top:.18rem;line-height:1.65;}
  .impl-tier{font-size:.52rem;letter-spacing:.2em;margin-top:.38rem;}
  .t1{color:var(--green);} .t2{color:var(--blue);} .t3{color:var(--amber);}

  .btn{font-family:'Rajdhani',sans-serif;font-weight:600;background:transparent;border:2px solid var(--cyan);color:var(--cyan);padding:.65rem 2rem;font-size:.88rem;letter-spacing:.2em;cursor:pointer;transition:all .18s;}
  .btn:hover{background:var(--cyan);color:#000;}
  .btn:disabled{opacity:.35;cursor:not-allowed;}
  .btn:disabled:hover{background:transparent;color:var(--cyan);}
  .sm-btn{font-family:'Space Mono',monospace;font-size:.62rem;padding:.38rem .8rem;border:1px solid;cursor:pointer;transition:all .15s;background:transparent;}

  .dead{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.5rem;padding:2rem;background:radial-gradient(ellipse at center,#150308 0%,#030205 100%);}

  @media(max-width:640px){
    .game{grid-template-columns:1fr;grid-template-rows:48px auto 100px auto 54px;}
    .sidebar{grid-column:1;grid-row:4;border-left:none;border-top:1px solid var(--border);flex-direction:row;flex-wrap:wrap;gap:.75rem;max-height:100px;}
    .actions{grid-column:1;grid-row:5;}
  }
`;

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════
const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const xpNeeded = lvl => lvl * 100;
const hpCol = pct => pct > 55 ? '#00e087' : pct > 28 ? '#ffaa00' : '#ff2244';

// ═══════════════════════════════════════════════════════
// APP
// ═══════════════════════════════════════════════════════
export default function App() {
  const [screen, setScreen]   = useState('intro');
  const [pName, setPName]     = useState('');
  const [loc, setLoc]         = useState('cryo_bay');
  const [player, setPlayer]   = useState({ hp:80, maxHp:100, energy:50, maxEnergy:80, credits:0, xp:0, level:1, inventory:[] });
  const [aria, setAria]       = useState({ found:false, carried:false, trust:10, memoryLevel:1, research:0, chatHistory:[] });
  const [implants, setImplants] = useState({ enhanced_vision:false, adrenaline:false, neural_interface:false, pain_suppression:false, combat_reflex:false, full_integration:false });
  const [flags, setFlags]     = useState({});
  const [defeated, setDefeated] = useState({});
  const [collected, setCollected] = useState({});
  const [doneActions, setDoneActions] = useState({});
  const [log, setLog]         = useState([]);
  const [modal, setModal]     = useState(null);
  const [dlgState, setDlgState] = useState(null);
  const [combat, setCombat]   = useState(null);
  const [ariaThinking, setAriaThinking] = useState(false);
  const [ariaInput, setAriaInput] = useState('');
  const [ariaKey, setAriaKey] = useState(() => { try { return localStorage.getItem('void-aria-key') || ''; } catch { return ''; } });
  const [hasSave, setHasSave] = useState(null);
  const [savedAt, setSavedAt] = useState(null);
  const [saveStatus, setSaveStatus] = useState('');

  const logRef      = useRef(null);
  const ariaChatRef = useRef(null);

  useEffect(() => { loadGame().then(save => setHasSave(save || false)); }, []);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [log]);
  useEffect(() => { if (ariaChatRef.current) ariaChatRef.current.scrollTop = ariaChatRef.current.scrollHeight; }, [aria.chatHistory]);

  const addLog  = useCallback((type, text) => setLog(p => [...p, { type, text }]), []);
  const setFlag = useCallback((k, v = true) => setFlags(f => ({ ...f, [k]: v })), []);

  const doSave = useCallback(async (overrides = {}) => {
    setSaveStatus('saving');
    const state = { pName, loc, player, aria: { ...aria, chatHistory: aria.chatHistory.slice(-20) }, implants, flags, defeated, collected, doneActions, log: log.slice(-30), ...overrides };
    await saveGame(state);
    setSavedAt(Date.now()); setSaveStatus('saved');
    setTimeout(() => setSaveStatus(''), 2000);
  }, [pName, loc, player, aria, implants, flags, defeated, collected, doneActions, log]);

  const doContinue = useCallback(async () => {
    const save = await loadGame();
    if (!save) return;
    setPName(save.pName || ''); setLoc(save.loc || 'cryo_bay'); setPlayer(save.player || {});
    setAria(save.aria || {}); setImplants(save.implants || {}); setFlags(save.flags || {});
    setDefeated(save.defeated || {}); setCollected(save.collected || {}); setDoneActions(save.doneActions || {});
    setLog(save.log || []); setSavedAt(save.savedAt || null); setScreen('game');
  }, []);

  const doDeleteSave = useCallback(async () => { await deleteSave(); setHasSave(false); setSavedAt(null); }, []);

  const gainXP = useCallback((amount) => {
    setPlayer(p => {
      const newXp = p.xp + amount;
      const needed = xpNeeded(p.level);
      if (newXp >= needed) {
        const newLvl = p.level + 1;
        addLog('level', `▲ LEVEL ${newLvl} — Hull integrity increased. ARIA gains research data.`);
        setAria(a => { const nr = a.research + 4; const ml = nr >= 30 ? 5 : nr >= 18 ? 4 : nr >= 9 ? 3 : nr >= 3 ? 2 : 1; return { ...a, research: nr, memoryLevel: Math.max(a.memoryLevel, ml) }; });
        return { ...p, xp: newXp - needed, level: newLvl, maxHp: p.maxHp + 15, hp: Math.min(p.maxHp + 15, p.hp + 20) };
      }
      return { ...p, xp: newXp };
    });
  }, [addLog]);

  const pickup = useCallback((id) => {
    if (collected[id]) return;
    const item = ITEMS[id];
    if (!item) return;
    if (item.type === 'currency') { setPlayer(p => ({ ...p, credits: p.credits + item.value })); addLog('gain', `◈ Found ${item.value} credits — ${item.name}`); }
    else { setPlayer(p => ({ ...p, inventory: [...p.inventory, id] })); addLog('gain', `+ Picked up: ${item.icon} ${item.name}`); }
    setCollected(c => ({ ...c, [id]: true }));
    if (id === 'fuel_cell') setFlag('pod_ready');
  }, [collected, addLog, setFlag]);

  const useItem = useCallback((id) => {
    const item = ITEMS[id];
    if (!item || item.type !== 'consumable') return;
    const fx = item.effect || {}; const parts = [];
    setPlayer(p => {
      const next = { ...p };
      if (fx.hp) { next.hp = Math.min(p.maxHp, p.hp + fx.hp); parts.push(`+${fx.hp} HP`); }
      if (fx.en) { next.energy = Math.min(p.maxEnergy, p.energy + fx.en); parts.push(`+${fx.en} Energy`); }
      next.inventory = p.inventory.filter(i => i !== id);
      return next;
    });
    addLog('gain', `Used ${item.icon} ${item.name}: ${parts.join(', ')}`); setModal(null);
  }, [addLog]);

  const navigate = useCallback((dest) => {
    if (dest === '_escape') {
      addLog('story', 'The pod hurls you into the void. ARIA\'s core module hums against your ribs. Somewhere ahead: a station, a chance, a story that\'s just beginning.');
      addLog('system', '— Chapter 1 complete. Station Chapter coming soon. —'); return;
    }
    setLoc(dest); addLog('action', `→ ${LOCS[dest]?.name}`);
    if (LOCS[dest]?.enemy && !defeated[dest]) setTimeout(() => startCombat(dest), 600);
    setTimeout(() => doSave({ loc: dest }), 300);
  }, [defeated, addLog, doSave]);

  const startCombat = useCallback((locId) => {
    const eid = LOCS[locId].enemy;
    if (!eid || !ENEMIES[eid]) return;
    const tmpl = ENEMIES[eid];
    setCombat({ enemy: { ...tmpl }, enemyHp: tmpl.hp, locId, clog: [`A ${tmpl.name} ${tmpl.icon} — blocking your path.`], phase: 'active' });
    setModal('combat');
  }, []);

  const doAttack = useCallback(() => {
    if (!combat || combat.phase !== 'active') return;
    const e = combat.enemy;
    let dmg = rand(8, 18);
    if (implants.adrenaline) dmg = Math.floor(dmg * 1.25);
    let eDef = e.def;
    if (implants.enhanced_vision) eDef = Math.max(0, eDef - Math.floor(eDef * 0.15));
    const finalDmg = Math.max(1, dmg - eDef);
    let newEHp = Math.max(0, combat.enemyHp - finalDmg);
    let cl = [...combat.clog, `You deal ${finalDmg} damage.`];
    if (implants.full_integration && aria.carried) { const ariaDmg = rand(7, 13); cl.push(`ARIA fires a pulse — ${ariaDmg} damage.`); newEHp = Math.max(0, newEHp - ariaDmg); }
    if (newEHp <= 0) {
      cl.push(`${e.name} — destroyed.`);
      if (e.cr > 0) { setPlayer(p => ({ ...p, credits: p.credits + e.cr })); cl.push(`+ ${e.cr} credits.`); }
      if (e.loot?.length) { e.loot.forEach(lid => { if (!collected[lid] && ITEMS[lid]) { setPlayer(p => ({ ...p, inventory: [...p.inventory, lid] })); setCollected(c => ({ ...c, [lid]: true })); cl.push(`+ ${ITEMS[lid].icon} ${ITEMS[lid].name}`); } }); }
      gainXP(e.xp); setDefeated(d => ({ ...d, [combat.locId]: true }));
      setAria(a => ({ ...a, trust: Math.min(100, a.trust + 5) }));
      setCombat(c => ({ ...c, enemyHp: 0, clog: cl, phase: 'won' }));
      setTimeout(() => doSave(), 500); return;
    }
    let eDmg = rand(e.atk[0], e.atk[1]); let dodged = false;
    const eAction = e.attacks[rand(0, e.attacks.length - 1)];
    if (implants.combat_reflex && Math.random() < 0.3) {
      dodged = true; cl.push(`${e.name} ${eAction} — you dodge!`);
      if (Math.random() < 0.5) { const counter = rand(5, 12); newEHp = Math.max(0, newEHp - counter); cl.push(`Counter-strike: ${counter} damage.`); }
      eDmg = 0;
    } else {
      if (implants.pain_suppression) eDmg = Math.floor(eDmg * 0.8);
      if (!dodged) cl.push(`${e.name} ${eAction} — ${eDmg} damage.`);
    }
    const newPHp = Math.max(0, player.hp - eDmg);
    setPlayer(p => ({ ...p, hp: newPHp })); setCombat(c => ({ ...c, enemyHp: newEHp, clog: cl }));
    if (newPHp <= 0) { setCombat(c => ({ ...c, clog: [...cl, 'You collapse.'], phase: 'lost' })); setTimeout(() => { setModal(null); setScreen('dead'); }, 1800); }
  }, [combat, implants, aria, collected, player.hp, gainXP]);

  const doFlee = useCallback(() => {
    const loss = rand(5, 12); setPlayer(p => ({ ...p, hp: Math.max(1, p.hp - loss) }));
    const prev = Object.values(LOCS[loc]?.exits || {})[0];
    if (prev) setLoc(prev); addLog('action', `You flee — ${loss} HP lost.`); setModal(null); setCombat(null);
  }, [loc, addLog]);

  const startDialogue = useCallback((id) => {
    const dlg = DIALOGUES[id]; if (!dlg) return;
    setDlgState({ id, node: dlg.start }); setModal('dialogue');
  }, []);

  const pickOpt = useCallback((opt) => {
    if (opt.action === 'take_aria') {
      setFlags(f => ({ ...f, aria_contacted: true, aria_carried: true }));
      setAria(a => ({ ...a, found: true, carried: true, trust: Math.min(100, a.trust + 20) }));
      setPlayer(p => ({ ...p, inventory: [...p.inventory, 'ai_core'] }));
      setCollected(c => ({ ...c, ai_core: true }));
      addLog('gain', '+ Picked up: 💾 ARIA Core Module'); addLog('aria', 'ARIA: "I\'m with you now. Let\'s go."');
      gainXP(30); setModal(null); setDlgState(null); setTimeout(() => doSave(), 400); return;
    }
    if (opt.n === null) { setModal(null); setDlgState(null); return; }
    setDlgState(d => ({ ...d, node: opt.n }));
  }, [addLog, gainXP, doSave]);

  const doAction = useCallback((action) => {
    if (doneActions[action.id]) return;
    if (action.requiresFlag && !flags[action.requiresFlag]) { addLog('system', 'You can\'t do that yet.'); return; }
    if (action.item) pickup(action.item);
    if (action.flag) setFlag(action.flag);
    if (action.text) addLog('story', action.text);
    if (action.dialogue) startDialogue(action.dialogue);
    if (action.nextLoc) navigate(action.nextLoc);
    setDoneActions(d => ({ ...d, [action.id]: true })); gainXP(15);
    setTimeout(() => doSave(), 400);
  }, [doneActions, flags, pickup, setFlag, addLog, startDialogue, navigate, gainXP, doSave]);

  const doActionById = useCallback((actionId) => {
    const action = LOCS[loc]?.actions?.find(a => a.id === actionId);
    if (action) doAction(action);
  }, [loc, doAction]);

  const sendAria = useCallback(async () => {
    const msg = ariaInput.trim(); if (!msg || ariaThinking) return;
    setAriaInput(''); setAria(a => ({ ...a, chatHistory: [...a.chatHistory, { role: 'player', text: msg }] })); setAriaThinking(true);
    const activeImpl = Object.entries(implants).filter(([, v]) => v).map(([k]) => IMPLANTS[k]?.name || k);
    const sysprompt = ARIA_PROMPT(aria.memoryLevel, aria.trust, activeImpl);
    const msgs = [...aria.chatHistory.map(m => ({ role: m.role === 'aria' ? 'assistant' : 'user', content: m.text })), { role: 'user', content: msg }];
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', { method:'POST', headers:{'Content-Type':'application/json','x-api-key':ariaKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'}, body: JSON.stringify({ model:'claude-sonnet-4-5-20251001', max_tokens:1000, system:sysprompt, messages:msgs }) });
      const data = await res.json();
      const reply = data.content?.[0]?.text || '[ERROR — signal lost]';
      setAria(a => ({ ...a, chatHistory: [...a.chatHistory, { role:'aria', text:reply }], trust: Math.min(100, a.trust + 2) }));
    } catch { setAria(a => ({ ...a, chatHistory: [...a.chatHistory, { role:'aria', text:'[ERROR — connection interrupted]' }] })); }
    finally { setAriaThinking(false); }
  }, [ariaInput, ariaKey, ariaThinking, aria, implants]);

  const unlockImpl = useCallback((id) => {
    const impl = IMPLANTS[id]; if (!impl || implants[id]) return;
    if (aria.research < impl.cost) { addLog('system', `Need ${impl.cost - aria.research} more research points.`); return; }
    setImplants(im => ({ ...im, [id]: true })); setAria(a => ({ ...a, research: a.research - impl.cost }));
    if (id === 'pain_suppression') setPlayer(p => ({ ...p, maxHp: p.maxHp + 30 }));
    addLog('gain', `✓ Implant online: ${impl.icon} ${impl.name}`);
    addLog('aria', `ARIA: "Implant active. ${impl.desc.split('.')[0]}."`); setModal(null);
  }, [implants, aria.research, addLog]);

  const location  = LOCS[loc];
  const hpPct     = (player.hp / player.maxHp) * 100;
  const enPct     = (player.energy / player.maxEnergy) * 100;
  const xpPct     = (player.xp / xpNeeded(player.level)) * 100;
  const activeImp = Object.entries(implants).filter(([, v]) => v).map(([k]) => k);
  const enemyHere = location?.enemy && !defeated[loc];
  const lootHere  = (location?.loot || []).filter(id => !collected[id]);
  const actHere   = (location?.actions || []).filter(a => !doneActions[a.id]);

  // ── INTRO
  if (screen === 'intro') return (
    <div className="vr"><style>{CSS}</style><div className="scanlines" />
      <div className="intro">
        <div className="intro-logo">VOID RUNNER</div>
        <div className="intro-sub" style={{ marginBottom:'2rem' }}>AWAKENING</div>
        <div className="intro-text">{`You were not supposed to wake up yet.\n\nThe incubation tank hisses open and you fall onto cold decking, gasping. Emergency lighting strobes red. Alarms you don't recognise.\n\n847 crew members in cryogenic sleep.\nNone of them are waking up.\n\nYou are.`}</div>
        {hasSave === null && <div style={{ fontSize:'.65rem', color:'var(--muted)', letterSpacing:'.2em' }}>CHECKING SAVE...</div>}
        {hasSave && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'.6rem', marginBottom:'1rem' }}>
            <div style={{ background:'var(--s1)', border:'1px solid var(--border)', padding:'.75rem 1.5rem', fontSize:'.65rem', color:'var(--muted)', textAlign:'center', lineHeight:1.9 }}>
              <div style={{ color:'var(--cyan)', marginBottom:'.2rem' }}>SAVE FOUND</div>
              {hasSave.pName && <div>Subject: {hasSave.pName}</div>}
              {hasSave.player && <div>Level {hasSave.player.level} — ◈ {hasSave.player.credits} cr</div>}
              {hasSave.savedAt && <div>Last saved: {new Date(hasSave.savedAt).toLocaleString()}</div>}
            </div>
            <button className="btn" onClick={doContinue}>CONTINUE</button>
            <button style={{ background:'none', border:'none', color:'var(--muted)', fontFamily:'Space Mono,monospace', fontSize:'.6rem', cursor:'pointer', letterSpacing:'.1em' }} onClick={doDeleteSave}>delete save</button>
          </div>
        )}
        <button className="btn" style={hasSave ? { borderColor:'var(--muted)', color:'var(--muted)', fontSize:'.75rem', padding:'.5rem 1.5rem' } : {}} onClick={() => setScreen('name')}>
          {hasSave ? 'NEW GAME' : 'INITIALIZE'}
        </button>
      </div>
    </div>
  );

  // ── NAME
  if (screen === 'name') return (
    <div className="vr"><style>{CSS}</style><div className="scanlines" />
      <div className="intro">
        <div style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:'1rem', color:'var(--cyan)', letterSpacing:'.35em', marginBottom:'2rem' }}>CREW MANIFEST — SUBJECT ID</div>
        <input style={{ background:'transparent', border:'none', borderBottom:'2px solid var(--cyan)', color:'var(--cyan)', fontFamily:'Space Mono,monospace', fontSize:'1.4rem', padding:'.5rem 1rem', outline:'none', textAlign:'center', letterSpacing:'.15em', marginBottom:'2.5rem', width:'300px', maxWidth:'100%' }}
          placeholder="—" value={pName} onChange={e => setPName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && pName.trim() && setScreen('game')} autoFocus maxLength={20} />
        <button className="btn" disabled={!pName.trim()} onClick={() => { setPlayer(p => ({ ...p, name: pName })); setScreen('game'); addLog('system', `Subject ${pName} — awakened. UES Prometheus: critical. Begin.`); }}>CONFIRM</button>
      </div>
    </div>
  );

  // ── DEAD
  if (screen === 'dead') return (
    <div className="vr"><style>{CSS}</style><div className="scanlines" />
      <div className="dead">
        <div style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:'clamp(3rem,10vw,5.5rem)', color:'var(--red)', letterSpacing:'.15em', textShadow:'0 0 50px rgba(255,34,68,.55)' }}>SIGNAL LOST</div>
        <div style={{ fontFamily:'Rajdhani,sans-serif', fontSize:'.6rem', color:'var(--muted)', letterSpacing:'.4em', marginTop:'-1rem' }}>SUBJECT TERMINATED</div>
        <div style={{ background:'var(--s1)', border:'1px solid rgba(255,34,68,.2)', padding:'1.4rem', minWidth:'260px' }}>
          {[['Designation',pName],['Level',player.level],['Credits',`◈ ${player.credits}`],['Location',location?.name||'—'],['ARIA',aria.carried?'With you':'Left behind'],['Active Implants',activeImp.length||'None']].map(([l,v]) => (
            <div key={l} style={{ display:'flex', justifyContent:'space-between', fontSize:'.73rem', borderBottom:'1px solid var(--border)', padding:'.38rem 0' }}>
              <span style={{ color:'var(--muted)' }}>{l}</span><span>{v}</span>
            </div>
          ))}
        </div>
        <button className="btn" onClick={() => window.location.reload()}>RESTART</button>
      </div>
    </div>
  );

  // ── GAME
  return (
    <div className="vr"><style>{CSS}</style><div className="scanlines" />

      <div className="g-header">
        <div className="g-logo">VOID//AWAKENING</div>
        <div className="g-stats">
          <div className="stat-g"><div className="stat-lbl">HP</div><div className="stat-bar"><div className="stat-fill" style={{ width:`${hpPct}%`, background:hpCol(hpPct) }} /></div><div className="stat-num">{player.hp}/{player.maxHp}</div></div>
          <div className="stat-g"><div className="stat-lbl">EN</div><div className="stat-bar"><div className="stat-fill" style={{ width:`${enPct}%`, background:'var(--blue)' }} /></div><div className="stat-num">{player.energy}/{player.maxEnergy}</div></div>
          <div className="stat-g"><div className="stat-lbl">XP</div><div className="stat-bar"><div className="stat-fill" style={{ width:`${xpPct}%`, background:'var(--green)' }} /></div><div className="stat-num">Lv{player.level}</div></div>
        </div>
        <div className="g-cr">◈ {player.credits}</div>
        <div style={{ fontSize:'.55rem', color:saveStatus==='saving'?'var(--amber)':saveStatus==='saved'?'var(--green)':'var(--muted)', letterSpacing:'.1em', flexShrink:0, minWidth:'50px', textAlign:'right' }}>
          {saveStatus==='saving'?'● SAVING':saveStatus==='saved'?'✓ SAVED':savedAt?`saved ${new Date(savedAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`:''}
        </div>
      </div>

      {/* SCENE CANVAS */}
      <div className="scene-wrap">
        <SceneCanvas
          locId={loc}
          flags={flags} defeated={defeated} collected={collected} doneActions={doneActions}
          onNavigate={navigate} onPickup={pickup} onStartCombat={startCombat} onActionById={doActionById}
        />
      </div>

      {/* EVENT LOG */}
      <div className="elog" ref={logRef}>
        {log.length === 0 && <div className="ev ev-system">System initializing...</div>}
        {log.map((e, i) => <div key={i} className={`ev ev-${e.type}`}>{e.text}</div>)}
      </div>

      {/* SIDEBAR */}
      <div className="sidebar">
        {aria.carried ? (
          <div>
            <div className="s-lbl">AI COMPANION</div>
            <div className="aria-box">
              <div className="aria-nm">◈ ARIA</div>
              <div className="aria-info">Memory: {aria.memoryLevel}/5<br />Trust: {aria.trust}%<br />Research: {aria.research} pts</div>
              <button className="aria-btn" onClick={() => setModal('aria')}>OPEN CHANNEL</button>
              <button className="aria-btn cyan" style={{ marginTop:'.28rem' }} onClick={() => setModal('implants')}>IMPLANTS [{activeImp.length}/{Object.keys(IMPLANTS).length}]</button>
            </div>
          </div>
        ) : (
          <div><div className="s-lbl">AI COMPANION</div><div style={{ fontSize:'.62rem', color:'var(--muted)', lineHeight:1.8 }}>No AI companion.<br />Locate ARIA.</div></div>
        )}
        <div>
          <div className="s-lbl">INVENTORY</div>
          {player.inventory.length === 0 ? <div className="inv-none">Empty</div>
            : player.inventory.map((id, i) => { const item = ITEMS[id]; return item ? (
              <div key={i} className="inv-row" onClick={() => useItem(id)} title={item.type==='consumable'?'Click to use':item.desc}>
                <span>{item.icon}</span><span>{item.name}</span>
              </div>) : null; })}
        </div>
        {activeImp.length > 0 && (
          <div>
            <div className="s-lbl">ACTIVE IMPLANTS</div>
            {activeImp.map(id => <div key={id} className="impl-badge impl-on">{IMPLANTS[id]?.icon} {IMPLANTS[id]?.name}</div>)}
          </div>
        )}
        <div>
          <div className="s-lbl">XP — LV {player.level}</div>
          <div className="xp-bar"><div className="xp-fill" style={{ width:`${xpPct}%` }} /></div>
          <div style={{ fontSize:'.58rem', color:'var(--muted)', marginTop:'.25rem' }}>{player.xp}/{xpNeeded(player.level)}</div>
        </div>
      </div>

      {/* ACTIONS */}
      <div className="actions">
        {Object.entries(location?.exits || {}).map(([label, dest]) => (
          <button key={dest} className="ab" onClick={() => navigate(dest)}>{label}</button>
        ))}
        {enemyHere && <button className="ab dng" onClick={() => startCombat(loc)}>⚔ Fight — {ENEMIES[location.enemy]?.name}</button>}
        {lootHere.map(id => <button key={id} className="ab pri" onClick={() => pickup(id)}>{ITEMS[id]?.icon} Take — {ITEMS[id]?.name}</button>)}
        {actHere.map(a => <button key={a.id} className="ab pri" onClick={() => doAction(a)}>{a.label}</button>)}
        {aria.carried && <button className="ab amb" onClick={() => setModal('aria')}>💾 Talk to ARIA</button>}
        <button className="ab" onClick={() => setModal('inventory')}>[Inventory]</button>
        <button className="ab" style={{ marginLeft:'auto', borderColor:'var(--muted)', color:'var(--muted)' }} onClick={() => doSave()}>[Save]</button>
        <button className="ab" style={{ borderColor:'var(--muted)', color:'var(--muted)' }} onClick={() => { doSave(); setTimeout(() => setScreen('intro'), 300); }}>[Menu]</button>
      </div>

      {/* DIALOGUE */}
      {modal === 'dialogue' && dlgState && (() => {
        const dlg = DIALOGUES[dlgState.id]; const node = dlg?.nodes?.[dlgState.node]; if (!node) return null;
        return (
          <div className="ov"><div className="mo" style={{ borderColor:'rgba(255,170,0,.2)' }}>
            <div className="mo-h"><div className="mo-t" style={{ color:'var(--amber)' }}>{dlg.speaker}</div><button className="x-btn" onClick={() => { setModal(null); setDlgState(null); }}>✕</button></div>
            <div className="mo-b">
              <div className="dlg-spk">— {dlg.speaker} —</div>
              <div className="dlg-txt">{node.text}</div>
              <div className="dlg-opts">{node.opts.map((opt, i) => <button key={i} className="dlg-opt" onClick={() => pickOpt(opt)}>{opt.t}</button>)}</div>
            </div>
          </div></div>
        );
      })()}

      {/* COMBAT */}
      {modal === 'combat' && combat && (() => {
        const e = combat.enemy; const eHpPct = (combat.enemyHp / e.hp) * 100;
        return (
          <div className="ov"><div className="mo">
            <div className="mo-h"><div className="mo-t" style={{ color:'var(--red)' }}>⚔ COMBAT</div></div>
            <div className="mo-b">
              <div className="cb-enemy"><div className="cb-icon">{e.icon}</div><div className="cb-nm">{e.name}</div></div>
              <div className="cb-bars">
                <div><div className="cb-lbl">ENEMY HP</div><div className="cb-bg"><div className="cb-fill" style={{ width:`${eHpPct}%`, background:hpCol(eHpPct) }} /></div><div style={{ fontSize:'.6rem', color:'var(--muted)', marginTop:'.22rem' }}>{combat.enemyHp} / {e.hp}</div></div>
                <div><div className="cb-lbl">YOUR HP</div><div className="cb-bg"><div className="cb-fill" style={{ width:`${hpPct}%`, background:hpCol(hpPct) }} /></div><div style={{ fontSize:'.6rem', color:'var(--muted)', marginTop:'.22rem' }}>{player.hp} / {player.maxHp}</div></div>
              </div>
              <div className="clog">{combat.clog.map((l, i) => <div key={i}>{l}</div>)}</div>
              {combat.phase === 'won' && <div className="cb-result win">VICTORY</div>}
              {combat.phase === 'lost' && <div className="cb-result lose">DEFEATED</div>}
            </div>
            <div className="mo-f">
              {combat.phase === 'active' && <><button className="sm-btn" style={{ borderColor:'var(--red)', color:'var(--red)' }} onClick={doAttack}>⚔ Attack</button><button className="sm-btn" style={{ borderColor:'var(--muted)', color:'var(--muted)' }} onClick={doFlee}>↩ Flee</button></>}
              {combat.phase === 'won' && <button className="sm-btn" style={{ borderColor:'var(--green)', color:'var(--green)' }} onClick={() => { setModal(null); setCombat(null); }}>Continue →</button>}
              {combat.phase === 'lost' && <button className="sm-btn" style={{ borderColor:'var(--red)', color:'var(--red)' }} onClick={() => setScreen('dead')}>...</button>}
            </div>
          </div></div>
        );
      })()}

      {/* INVENTORY */}
      {modal === 'inventory' && (
        <div className="ov"><div className="mo">
          <div className="mo-h"><div className="mo-t">Inventory — ◈ {player.credits} cr</div><button className="x-btn" onClick={() => setModal(null)}>✕</button></div>
          <div className="mo-b">
            {player.inventory.length === 0 ? <div style={{ color:'var(--muted)', fontSize:'.73rem' }}>Nothing carried.</div>
              : <div className="inv-cards">{player.inventory.map((id, i) => { const item = ITEMS[id]; if (!item) return null; return (
                <div key={i} className="inv-card">
                  <div className="inv-card-icon">{item.icon}</div>
                  <div><div className="inv-card-nm">{item.name}</div><div className="inv-card-desc">{item.desc}</div><div className="inv-card-type">{item.type.toUpperCase()}</div>
                    {item.type === 'consumable' && <button className="use-btn" onClick={() => useItem(id)}>USE</button>}
                  </div>
                </div>); })}
              </div>}
          </div>
        </div></div>
      )}

      {/* ARIA CHAT */}
      {modal === 'aria' && (
        <div className="ov"><div className="mo" style={{ borderColor:'rgba(255,170,0,.2)' }}>
          <div className="mo-h" style={{ borderColor:'rgba(255,170,0,.15)' }}><div className="mo-t" style={{ color:'var(--amber)' }}>◈ ARIA — Memory {aria.memoryLevel}/5 — Trust {aria.trust}%</div><button className="x-btn" onClick={() => setModal(null)}>✕</button></div>
          <div className="mo-b">
            <div className="aria-msgs" ref={ariaChatRef}>
              {aria.chatHistory.length === 0 && <div style={{ color:'var(--muted)', fontSize:'.7rem' }}>Channel open.</div>}
              {aria.chatHistory.map((m, i) => <div key={i} className={`aria-msg ${m.role}`}><span style={{ opacity:.5, fontSize:'.58rem' }}>{m.role==='aria'?'ARIA':pName||'YOU'}:</span><br />{m.text}</div>)}
              {ariaThinking && <div className="aria-thinking">ARIA processing...</div>}
            </div>
          </div>
          <div className="mo-f" style={{ flexDirection:'column', gap:'.4rem' }}>
            {!ariaKey && (
              <div style={{ fontSize:'.6rem', color:'var(--amber)', background:'var(--adim)', border:'1px solid rgba(255,170,0,.15)', padding:'.45rem .7rem', lineHeight:1.7 }}>
                ARIA needs an Anthropic API key to respond.{' '}
                <input placeholder="sk-ant-..." style={{ background:'transparent', border:'none', borderBottom:'1px solid rgba(255,170,0,.4)', color:'var(--amber)', fontFamily:'Space Mono,monospace', fontSize:'.6rem', outline:'none', width:'160px', padding:'.1rem .2rem' }}
                  onChange={e => { const k = e.target.value.trim(); setAriaKey(k); try { localStorage.setItem('void-aria-key', k); } catch {} }} />
              </div>
            )}
            <div className="aria-row">
              <input className="aria-inp" placeholder="Say something..." value={ariaInput} onChange={e => setAriaInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendAria()} disabled={ariaThinking || !ariaKey} autoFocus />
              <button className="aria-send" onClick={sendAria} disabled={ariaThinking || !ariaKey}>SEND</button>
            </div>
          </div>
        </div></div>
      )}

      {/* IMPLANTS */}
      {modal === 'implants' && (
        <div className="ov"><div className="mo">
          <div className="mo-h"><div className="mo-t">Implant Systems — {aria.research} research pts</div><button className="x-btn" onClick={() => setModal(null)}>✕</button></div>
          <div className="mo-b">
            <div style={{ fontSize:'.66rem', color:'var(--muted)', marginBottom:'.9rem', lineHeight:1.8 }}>ARIA can activate your dormant implants using her research data.<br />Gain research by leveling up and progressing the story.</div>
            {Object.entries(IMPLANTS).map(([id, impl]) => {
              const active = implants[id]; const afford = aria.research >= impl.cost;
              return (
                <div key={id} className={`impl-card ${active?'active':''} ${!active&&!afford?'locked':''}`}>
                  <div className="impl-card-nm">{impl.icon} {impl.name}{active && <span style={{ fontSize:'.58rem', color:'var(--green)' }}>● ACTIVE</span>}</div>
                  <div className="impl-card-desc">{impl.desc}</div>
                  <div className={`impl-tier t${impl.tier}`}>TIER {impl.tier} — Cost: {impl.cost} pts</div>
                  {!active && <button className="use-btn" style={{ borderColor:afford?'var(--cyan)':'var(--muted)', color:afford?'var(--cyan)':'var(--muted)', cursor:afford?'pointer':'default' }} onClick={() => unlockImpl(id)} disabled={!afford}>{afford?'ACTIVATE':`Need ${impl.cost-aria.research} more pts`}</button>}
                </div>
              );
            })}
          </div>
        </div></div>
      )}
    </div>
  );
}
