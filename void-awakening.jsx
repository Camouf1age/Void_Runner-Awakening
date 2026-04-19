import { useState, useEffect, useRef, useCallback } from "react";

const SAVE_KEY = 'void-awakening-save';
const SW = 320, SH = 168;

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
  cryo_bay:    { x:60,  y:132 },
  corridor_a:  { x:55,  y:132 },
  med_bay:     { x:55,  y:132 },
  ai_core:     { x:55,  y:132 },
  bridge:      { x:55,  y:132 },
  engineering: { x:55,  y:132 },
};

// exit zones: {dest, x,y,w,h}  item spots: {id,x,y,r}  enemy: {x,y,r}  actions: {id,x,y,r}
const ROOM_HS = {
  cryo_bay: {
    exits:   [{ dest:'corridor_a', x:295, y:68, w:25, h:82 }],
    items:   [{ id:'emergency_kit', x:52, y:128, r:13 }, { id:'crew_manifest', x:235, y:122, r:13 }],
    enemy:   null,
    actions: [],
  },
  corridor_a: {
    exits:   [{ dest:'cryo_bay', x:0, y:68, w:22, h:82 }, { dest:'med_bay', x:295, y:68, w:25, h:82 }, { dest:'bridge', x:230, y:95, w:35, h:55 }],
    items:   [{ id:'scrap_metal', x:175, y:128, r:13 }],
    enemy:   { x:255, y:118, r:20 },
    actions: [{ id:'search_body', x:108, y:130, r:14 }],
  },
  med_bay: {
    exits:   [{ dest:'corridor_a', x:0, y:68, w:22, h:82 }, { dest:'ai_core', x:295, y:68, w:25, h:82 }],
    items:   [{ id:'med_stim', x:75, y:126, r:13 }, { id:'ration_pack', x:150, y:126, r:13 }, { id:'data_chip', x:240, y:126, r:13 }],
    enemy:   null,
    actions: [{ id:'read_chart', x:195, y:108, r:17 }],
  },
  ai_core: {
    exits:   [{ dest:'med_bay', x:295, y:68, w:25, h:82 }, { dest:'engineering', x:0, y:68, w:22, h:82 }],
    items:   [],
    enemy:   null,
    actions: [{ id:'approach_aria', x:160, y:112, r:20 }],
  },
  bridge: {
    exits:   [{ dest:'corridor_a', x:0, y:68, w:22, h:82 }],
    items:   [{ id:'captains_log', x:85, y:128, r:13 }, { id:'credit_chip', x:225, y:128, r:13 }],
    enemy:   { x:180, y:112, r:20 },
    actions: [{ id:'read_message', x:255, y:118, r:15 }],
  },
  engineering: {
    exits:   [{ dest:'ai_core', x:295, y:68, w:25, h:82 }],
    items:   [{ id:'fuel_cell', x:68, y:128, r:13 }],
    enemy:   { x:200, y:112, r:20 },
    actions: [{ id:'launch_pod', x:95, y:115, r:18 }],
  },
};

// ═══════════════════════════════════════════════════════
// DRAWING HELPERS
// ═══════════════════════════════════════════════════════

function rect(ctx, x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }

function drawFloor(ctx, near, far) {
  const g = ctx.createLinearGradient(0, 115, 0, SH);
  g.addColorStop(0, far); g.addColorStop(1, near);
  ctx.fillStyle = g; ctx.fillRect(0, 115, SW, SH - 115);
  ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1;
  for (let i = 1; i < 7; i++) {
    ctx.beginPath(); ctx.moveTo(i * SW / 7, SH);
    ctx.lineTo(160, 115); ctx.stroke();
  }
}

function drawExit(ctx, x, y, w, h, color) {
  ctx.fillStyle = color || 'rgba(80,100,180,0.12)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = color ? color.replace('0.12','0.4') : 'rgba(80,100,180,0.4)';
  ctx.lineWidth = 1; ctx.strokeRect(x, y, w, h);
}

function drawCryoBay(ctx, _f, _d, collected) {
  // Deep red background
  const bg = ctx.createLinearGradient(0, 0, 0, SH);
  bg.addColorStop(0, '#150303'); bg.addColorStop(1, '#0d0101');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, SW, SH);

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

  drawFloor(ctx, '#180808', '#0e0404');

  // Exit right
  drawExit(ctx, 295, 68, 25, 82);
}

function drawCorridorA(ctx, flags, defeated, collected, doneActions) {
  const bg = ctx.createLinearGradient(0, 0, 0, SH);
  bg.addColorStop(0, '#020510'); bg.addColorStop(1, '#010208');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, SW, SH);

  rect(ctx, 0, 0, SW, 12, '#0a0c18');

  // Ceiling lights (flickering dim blue-white)
  for (let i = 0; i < 3; i++) {
    const lx = 50 + i * 105;
    rect(ctx, lx, 5, 30, 5, '#1c2240');
    const g = ctx.createRadialGradient(lx+15, 10, 1, lx+15, 10, 50);
    g.addColorStop(0, 'rgba(60,80,180,0.12)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(lx-35, 0, 100, 80);
  }

  // Hanging cables
  ctx.strokeStyle = '#1a2030'; ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const cx2 = 30 + i * 38;
    ctx.beginPath(); ctx.moveTo(cx2, 12);
    ctx.quadraticCurveTo(cx2 + 6, 28 + (i%3)*8, cx2 + 2, 40 + (i%2)*12);
    ctx.stroke();
  }

  // Emergency bulkheads (half-closed doors)
  rect(ctx, 0, 68, 22, 47, '#0e1220'); rect(ctx, 0, 68, 22, 25, '#141828');
  rect(ctx, 295, 68, 25, 47, '#0e1220'); rect(ctx, 295, 68, 25, 22, '#141828');

  // East door to bridge
  rect(ctx, 230, 95, 35, 20, '#080e1a');
  ctx.strokeStyle = '#1e2840'; ctx.lineWidth = 1; ctx.strokeRect(230, 95, 35, 20);
  rect(ctx, 230, 95, 35, 3, '#1a2238');

  // Technician body on floor
  if (!doneActions?.search_body) {
    rect(ctx, 88, 128, 38, 9, '#1a2035');
    rect(ctx, 86, 126, 10, 7, '#c8a060'); // head
    rect(ctx, 112, 130, 8, 4, '#2a3855'); // tools
  }

  // Drone (if not defeated)
  if (!defeated?.corridor_a) {
    rect(ctx, 243, 103, 24, 20, '#2a3040');
    rect(ctx, 248, 97, 14, 8, '#1a2232');
    rect(ctx, 253, 92, 4, 7, '#303850'); // antenna
    rect(ctx, 246, 107, 7, 5, '#c03000'); // eye
    rect(ctx, 258, 107, 7, 5, '#c03000');
  }

  drawFloor(ctx, '#0c0e18', '#06080e');

  drawExit(ctx, 0, 68, 22, 82);
  drawExit(ctx, 295, 68, 25, 82);
  drawExit(ctx, 230, 95, 35, 20, 'rgba(60,80,180,0.1)');
}

function drawMedBay(ctx, flags, defeated, collected, doneActions) {
  const bg = ctx.createLinearGradient(0, 0, 0, SH);
  bg.addColorStop(0, '#020c08'); bg.addColorStop(1, '#010804');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, SW, SH);

  rect(ctx, 0, 0, SW, 12, '#0a1810');

  // Ceiling light panels
  for (let i = 0; i < 3; i++) {
    const lx = 40 + i * 100;
    rect(ctx, lx, 4, 60, 7, '#1a3020');
    const g = ctx.createRadialGradient(lx+30, 11, 2, lx+30, 11, 55);
    g.addColorStop(0, 'rgba(0,180,80,0.12)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(lx-25, 0, 110, 80);
  }

  // Medical tables
  for (let i = 0; i < 3; i++) {
    const tx = 40 + i * 90;
    rect(ctx, tx, 88, 60, 28, '#0d2018');
    rect(ctx, tx+3, 85, 54, 5, '#1a3828'); // surface
    ctx.strokeStyle = '#1e4030'; ctx.lineWidth = 1; ctx.strokeRect(tx, 88, 60, 28);
  }

  // Patient chart screen (on wall)
  rect(ctx, 175, 55, 65, 45, '#0a1810');
  rect(ctx, 177, 57, 61, 41, '#03140a');
  ctx.strokeStyle = '#00c060'; ctx.lineWidth = 1; ctx.strokeRect(177, 57, 61, 41);
  // Text lines on screen
  ctx.fillStyle = '#00c060';
  for (let i = 0; i < 5; i++) {
    const lw = [35, 45, 28, 50, 32][i];
    ctx.fillRect(180, 62 + i*7, lw, 2);
  }
  // Chart highlight (player name line)
  rect(ctx, 180, 62, 40, 2, '#ff4400');

  // Surgical equipment on floor
  rect(ctx, 55, 118, 16, 12, '#1c3028');
  rect(ctx, 130, 120, 24, 8, '#1a2c22');
  rect(ctx, 215, 118, 18, 10, '#1c3028');

  drawFloor(ctx, '#081408', '#040c04');

  drawExit(ctx, 0, 68, 22, 82);
  drawExit(ctx, 295, 68, 25, 82, 'rgba(0,180,80,0.12)');
}

function drawAiCore(ctx, flags, defeated, collected, doneActions) {
  const bg = ctx.createLinearGradient(0, 0, 0, SH);
  bg.addColorStop(0, '#0c0500'); bg.addColorStop(1, '#060200');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, SW, SH);

  rect(ctx, 0, 0, SW, 12, '#180a00');

  // Server racks on sides
  for (let side = 0; side < 2; side++) {
    const rx = side === 0 ? 15 : 225;
    const rw = 60;
    rect(ctx, rx, 20, rw, 95, '#0e0800');
    ctx.strokeStyle = '#201000'; ctx.lineWidth = 1; ctx.strokeRect(rx, 20, rw, 95);
    // LED strips
    for (let i = 0; i < 8; i++) {
      const ly = 25 + i * 11;
      const on = (i + Math.floor(Date.now()/800)) % 5 !== 0;
      rect(ctx, rx+4, ly, rw-8, 3, on ? '#403000' : '#1a1000');
      if (on) {
        ctx.fillStyle = 'rgba(200,120,0,0.2)';
        ctx.fillRect(rx+4, ly-1, rw-8, 5);
      }
    }
  }

  // Processing arrays — ceiling
  ctx.strokeStyle = '#2a1400'; ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath(); ctx.moveTo(70 + i*32, 12); ctx.lineTo(160, 50); ctx.stroke();
  }

  // ARIA core module — center glow
  const t2 = Date.now();
  const pulse = 0.5 + Math.sin(t2 * 0.002) * 0.3;
  const cg = ctx.createRadialGradient(160, 100, 5, 160, 100, 45);
  cg.addColorStop(0, `rgba(255,160,0,${0.35 * pulse})`);
  cg.addColorStop(0.5, `rgba(200,80,0,${0.12 * pulse})`);
  cg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = cg; ctx.fillRect(115, 55, 90, 90);

  // Core device
  rect(ctx, 148, 90, 24, 18, '#2a1800');
  rect(ctx, 150, 92, 20, 14, '#401c00');
  ctx.strokeStyle = `rgba(255,150,0,${0.6 * pulse})`; ctx.lineWidth = 1;
  ctx.strokeRect(148, 90, 24, 18);
  rect(ctx, 156, 96, 8, 6, `rgba(255,180,0,${0.8 * pulse})`);

  // Terminal
  rect(ctx, 132, 68, 56, 22, '#100800');
  rect(ctx, 134, 70, 52, 18, '#060300');
  ctx.strokeStyle = `rgba(200,100,0,${0.5})`; ctx.lineWidth = 1; ctx.strokeRect(132, 68, 56, 22);
  ctx.fillStyle = `rgba(200,100,0,0.4)`;
  for (let i = 0; i < 3; i++) ctx.fillRect(137, 73 + i*5, 25 + (i*8)%18, 2);

  drawFloor(ctx, '#100800', '#080400');

  drawExit(ctx, 295, 68, 25, 82, 'rgba(200,80,0,0.1)');
  drawExit(ctx, 0, 68, 22, 82);
}

function drawBridge(ctx, flags, defeated, collected, doneActions) {
  const bg = ctx.createLinearGradient(0, 0, 0, SH);
  bg.addColorStop(0, '#010510'); bg.addColorStop(1, '#010308');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, SW, SH);

  rect(ctx, 0, 0, SW, 12, '#060c1e');

  // Main viewport — stars
  rect(ctx, 55, 14, 210, 80, '#010208');
  ctx.strokeStyle = '#1a2440'; ctx.lineWidth = 2; ctx.strokeRect(55, 14, 210, 80);
  // Star field
  const starSeed = [37,89,142,203,17,256,301,178,63,228,94,315,150,55,270,120,45,190];
  ctx.fillStyle = '#ffffff';
  starSeed.forEach((s, i) => {
    const sx = 58 + (s * 17 + i * 31) % 204;
    const sy = 16 + (s * 7 + i * 13) % 76;
    ctx.fillRect(sx, sy, (i % 3 === 0) ? 2 : 1, (i % 3 === 0) ? 2 : 1);
  });
  // Hull breach glow through viewport
  ctx.fillStyle = 'rgba(80,120,255,0.06)'; ctx.fillRect(55, 14, 210, 80);
  // Distant nebula
  const ng = ctx.createRadialGradient(200, 55, 5, 200, 55, 40);
  ng.addColorStop(0, 'rgba(80,20,120,0.15)'); ng.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = ng; ctx.fillRect(160, 15, 100, 78);

  // Damage cracks on viewport
  ctx.strokeStyle = 'rgba(200,220,255,0.2)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(185, 14); ctx.lineTo(175, 38); ctx.lineTo(168, 55); ctx.stroke();

  // Control consoles
  for (let i = 0; i < 3; i++) {
    const cx2 = 30 + i * 100;
    rect(ctx, cx2, 98, 70, 20, '#080e1e');
    rect(ctx, cx2+3, 96, 64, 5, '#0e1828');
    ctx.strokeStyle = '#162238'; ctx.lineWidth = 1; ctx.strokeRect(cx2, 98, 70, 20);
    // Screen glow
    ctx.fillStyle = 'rgba(0,80,200,0.12)'; ctx.fillRect(cx2+5, 100, 60, 12);
    // Status lights
    for (let j = 0; j < 4; j++) {
      rect(ctx, cx2+7+j*12, 103, 6, 4, j===1?'#cc4400':'#002244');
    }
  }

  // Blinking message indicator
  if (!doneActions?.read_message) {
    const blink = Math.floor(Date.now() / 500) % 2;
    rect(ctx, 248, 113, 10, 6, blink ? '#00aaff' : '#002244');
  }

  // Defense system (if not defeated)
  if (!defeated?.bridge) {
    rect(ctx, 170, 95, 20, 18, '#1a2030');
    rect(ctx, 174, 92, 12, 6, '#202838');
    rect(ctx, 178, 88, 4, 6, '#303848'); // barrel
    ctx.strokeStyle = '#cc2020'; ctx.lineWidth = 1; ctx.strokeRect(170, 95, 20, 18);
  }

  drawFloor(ctx, '#06080e', '#03040a');

  drawExit(ctx, 0, 68, 22, 82);
}

function drawEngineering(ctx, flags, defeated, collected, doneActions) {
  const bg = ctx.createLinearGradient(0, 0, 0, SH);
  bg.addColorStop(0, '#100300'); bg.addColorStop(1, '#060100');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, SW, SH);

  rect(ctx, 0, 0, SW, 12, '#1e0800');

  // Engine glow at back wall
  const eg = ctx.createRadialGradient(160, 85, 10, 160, 85, 120);
  eg.addColorStop(0, 'rgba(255,100,0,0.22)'); eg.addColorStop(0.4, 'rgba(200,50,0,0.10)'); eg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = eg; ctx.fillRect(0, 0, SW, SH);

  // Engine housing back wall
  rect(ctx, 80, 25, 160, 90, '#120600');
  ctx.strokeStyle = '#2a0e00'; ctx.lineWidth = 1; ctx.strokeRect(80, 25, 160, 90);

  // Engine rings
  for (let i = 0; i < 3; i++) {
    const ey = 35 + i * 25;
    const er = 25 - i * 3;
    ctx.strokeStyle = `rgba(255,${80+i*30},0,0.4)`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(160, ey+5, er, Math.round(er*0.4), 0, 0, Math.PI*2); ctx.stroke();
    ctx.fillStyle = `rgba(255,${60+i*20},0,0.08)`;
    ctx.beginPath(); ctx.ellipse(160, ey+5, er, Math.round(er*0.4), 0, 0, Math.PI*2); ctx.fill();
  }

  // Escape pod doors
  // Left pod (empty — gone)
  rect(ctx, 18, 62, 48, 55, '#100800');
  ctx.strokeStyle = '#1e1000'; ctx.lineWidth = 1; ctx.strokeRect(18, 62, 48, 55);
  rect(ctx, 25, 68, 34, 43, '#080400'); // open/empty
  ctx.fillStyle = '#402000'; ctx.font = '7px monospace'; ctx.textAlign = 'center'; ctx.fillText('EMPTY', 42, 95);

  // Right pod (intact, sealed)
  rect(ctx, 255, 62, 48, 55, '#1a1000');
  rect(ctx, 257, 64, 44, 51, '#120a00');
  ctx.strokeStyle = '#402000'; ctx.lineWidth = 1; ctx.strokeRect(255, 62, 48, 55);
  rect(ctx, 278, 66, 6, 12, '#ffaa00'); // fuel indicator (empty/red if no fuel)
  if (!collected?.fuel_cell) rect(ctx, 278, 66, 6, 12, '#3a0000');

  // Broken pipes / sparks on ceiling
  ctx.strokeStyle = '#2a1400'; ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath(); ctx.moveTo(45 + i*55, 12); ctx.lineTo(38+i*55, 35+i%2*10); ctx.stroke();
  }

  // Guard (if not defeated)
  if (!defeated?.engineering) {
    // Simple guard silhouette
    rect(ctx, 192, 97, 14, 22, '#1e3855'); // body
    rect(ctx, 193, 92, 12, 7, '#c8a060'); // head
    rect(ctx, 190, 100, 4, 10, '#1e3855'); // left arm
    rect(ctx, 206, 100, 4, 10, '#1e3855'); // right arm
    rect(ctx, 193, 119, 5, 10, '#142840'); // legs
    rect(ctx, 200, 119, 5, 10, '#142840');
    // Nexus Corp badge
    rect(ctx, 194, 104, 5, 4, '#cc3300');
    ctx.strokeStyle = '#cc3300'; ctx.lineWidth = 1; ctx.strokeRect(192, 97, 14, 22);
  }

  drawFloor(ctx, '#120500', '#080200');

  drawExit(ctx, 295, 68, 25, 82, 'rgba(180,80,0,0.12)');
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
  const sc = 0.58 + (y - 100) / (145 - 100) * 0.48;
  const bw = Math.round(10 * sc);
  const bh = Math.round(22 * sc);
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
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, SW, 18);
    ctx.font = 'bold 8px "Courier New", monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillStyle = loc.color || '#e2eaf5';
    ctx.fillText(loc.name.toUpperCase(), 6, 5);
    ctx.font = '6px "Courier New", monospace';
    ctx.fillStyle = 'rgba(180,200,220,0.5)';
    ctx.fillText(loc.area, 6, 11);
  }
}

// ═══════════════════════════════════════════════════════
// SCENE CANVAS COMPONENT
// ═══════════════════════════════════════════════════════

function SceneCanvas({ locId, flags, defeated, collected, doneActions, onNavigate, onPickup, onStartCombat, onActionById }) {
  const canvasRef = useRef(null);
  const charRef = useRef({ x: 80, y: 132, tx: null, ty: null, dir: 'right', frame: 0, ft: 0, walking: false });
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
        const speed = 2.2 * dt / 16;
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
    charRef.current.tx = Math.max(14, Math.min(SW - 14, cx));
    charRef.current.ty = Math.max(105, Math.min(SH - 22, cy));
  }, [onNavigate, onPickup, onStartCombat, onActionById]);

  return (
    <canvas
      ref={canvasRef}
      width={SW} height={SH}
      style={{ width: '100%', height: 'auto', display: 'block', imageRendering: 'pixelated', cursor: 'crosshair' }}
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

  .game{flex:1;display:grid;grid-template-columns:1fr 210px;grid-template-rows:48px auto 1fr 54px;max-height:100vh;overflow:hidden;}
  .g-header{grid-column:1/-1;background:var(--s1);border-bottom:1px solid var(--border);display:flex;align-items:center;padding:0 1rem;gap:1rem;}
  .g-logo{font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.95rem;color:var(--cyan);letter-spacing:.2em;flex-shrink:0;}
  .g-stats{display:flex;gap:1.2rem;align-items:center;flex:1;justify-content:center;}
  .stat-g{display:flex;align-items:center;gap:.4rem;}
  .stat-lbl{font-size:.52rem;color:var(--muted);letter-spacing:.1em;}
  .stat-bar{width:55px;height:4px;background:rgba(255,255,255,.06);border-radius:2px;overflow:hidden;}
  .stat-fill{height:100%;border-radius:2px;transition:width .4s ease,background .4s ease;}
  .stat-num{font-size:.62rem;color:var(--text);min-width:38px;}
  .g-cr{font-size:.7rem;color:var(--amber);flex-shrink:0;}

  .scene-wrap{grid-column:1;grid-row:2;background:#000;border-bottom:1px solid var(--border);overflow:hidden;position:relative;}

  .elog{grid-column:1;grid-row:3;background:var(--bg);border-bottom:1px solid var(--border);padding:.75rem 1.5rem;overflow-y:auto;display:flex;flex-direction:column;gap:.3rem;}
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

  .actions{grid-column:1/-1;background:var(--s1);border-top:1px solid var(--border);padding:.55rem .85rem;display:flex;flex-wrap:wrap;gap:.35rem;align-items:center;}
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
      const res = await fetch('https://api.anthropic.com/v1/messages', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:1000, system:sysprompt, messages:msgs }) });
      const data = await res.json();
      const reply = data.content?.[0]?.text || '[ERROR — signal lost]';
      setAria(a => ({ ...a, chatHistory: [...a.chatHistory, { role:'aria', text:reply }], trust: Math.min(100, a.trust + 2) }));
    } catch { setAria(a => ({ ...a, chatHistory: [...a.chatHistory, { role:'aria', text:'[ERROR — connection interrupted]' }] })); }
    finally { setAriaThinking(false); }
  }, [ariaInput, ariaThinking, aria, implants]);

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
          <div className="mo-f" style={{ flexDirection:'column' }}>
            <div className="aria-row">
              <input className="aria-inp" placeholder="Say something..." value={ariaInput} onChange={e => setAriaInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendAria()} disabled={ariaThinking} autoFocus />
              <button className="aria-send" onClick={sendAria} disabled={ariaThinking}>SEND</button>
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
