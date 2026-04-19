import { useState, useEffect, useRef, useCallback } from "react";

const SAVE_KEY = 'void-awakening-save';

async function saveGame(state) {
  try {
    await window.storage.set(SAVE_KEY, JSON.stringify({ ...state, savedAt: Date.now() }));
  } catch (_) {}
}

async function loadGame() {
  try {
    const result = await window.storage.get(SAVE_KEY);
    return result ? JSON.parse(result.value) : null;
  } catch (_) { return null; }
}

async function deleteSave() {
  try { await window.storage.delete(SAVE_KEY); } catch (_) {}
}

// ═══════════════════════════════════════════════════════
// ARIA SYSTEM PROMPT
// ═══════════════════════════════════════════════════════
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
Research points available: for unlocking implants

Keep responses SHORT — 2-3 sentences. Stay in character always.`;

// ═══════════════════════════════════════════════════════
// ITEMS
// ═══════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════
// ENEMIES
// ═══════════════════════════════════════════════════════
const ENEMIES = {
  damaged_drone:  { name:'Damaged Drone',           hp:30,  atk:[6,12],  def:2, xp:20, cr:0,  loot:[],           icon:'🤖', attacks:['charges erratically','fires a weak laser burst','slams into you with a spark'] },
  ship_system:    { name:'Rogue Defense System',    hp:45,  atk:[8,16],  def:8, xp:35, cr:0,  loot:['scrap_metal'], icon:'⚙️', attacks:['fires a ceiling turret','releases a shock pulse','slams a blast door into you'] },
  company_guard:  { name:'Nexus Corp Security',     hp:65,  atk:[12,20], def:6, xp:60, cr:80, loot:['med_stim','nexus_badge'], icon:'🪖', attacks:['fires a stun burst','swings a shock baton','calls for backup — silence answers'] },
};

// ═══════════════════════════════════════════════════════
// IMPLANTS
// ═══════════════════════════════════════════════════════
const IMPLANTS = {
  enhanced_vision:  { name:'Ocular Enhancement',    desc:'Reveals hidden items. Enemy defense reduced 15% in combat.',  tier:1, cost:3,  icon:'👁️' },
  adrenaline:       { name:'Adrenaline Regulator',  desc:'+25% damage output in all combat situations.',                tier:1, cost:4,  icon:'⚡' },
  neural_interface: { name:'Neural Interface',      desc:'Hack terminals, doors, and basic electronics.',               tier:2, cost:10, icon:'🧠' },
  pain_suppression: { name:'Pain Dampener',         desc:'+30 max HP. 20% incoming damage reduction.',                  tier:2, cost:12, icon:'🛡️' },
  combat_reflex:    { name:'Reflex Enhancer',       desc:'30% dodge chance. Counter-attack on successful dodge.',       tier:3, cost:20, icon:'💨' },
  full_integration: { name:'ARIA Integration',      desc:'ARIA attacks independently each combat round.',               tier:3, cost:30, icon:'🔮' },
};

// ═══════════════════════════════════════════════════════
// LOCATIONS
// ═══════════════════════════════════════════════════════
const LOCS = {
  cryo_bay: {
    name:'Cryogenic Bay', area:'UES Prometheus — Deck 4',
    color:'#cc2200',
    desc:`You claw free of the incubation tank and hit cold decking hard, gasping. Emergency lighting strobes red, flickering with each power surge that shudders through the hull.

Row after row of cryogenic pods stretch into the darkness — all dark, all offline. Through frosted glass you can make out your crewmates. Still. Silent.

The alarms don't stop. You count the pods automatically. 847. None of them are opening.

Only yours did.`,
    exits:{ 'North — Corridor Alpha':'corridor_a' },
    loot:['emergency_kit','crew_manifest'],
    enemy:null,
    actions:[],
  },
  corridor_a: {
    name:'Corridor Alpha-7', area:'UES Prometheus — Deck 4',
    color:'#2244cc',
    desc:`Half-closed emergency bulkheads force you to squeeze through sideways. Conduit bundles hang from the ceiling, sparking and swaying. The smell of burnt wiring and something worse.

A crew member is down near the far wall — a woman in a technician's suit, tools still in her hands. You check. She's gone.

A maintenance drone twitches at the corridor's end, optical sensors spinning in erratic arcs. It's noticed you.`,
    exits:{ 'South — Cryo Bay':'cryo_bay', 'North — Medical Bay':'med_bay', 'East — Bridge':'bridge' },
    loot:['scrap_metal'],
    enemy:'damaged_drone',
    actions:[{id:'search_body', label:'Search the technician', flag:'body_searched', item:'security_pass', text:"You find a Level 3 security pass clipped to her collar. She won't need it anymore."}],
  },
  med_bay: {
    name:'Medical Bay', area:'UES Prometheus — Deck 3',
    color:'#008855',
    desc:`Cold, clinical, running on emergency power. The surgical equipment scattered across the floor is more sophisticated than anything standard medicine requires — this is modification hardware. Augmentation tools.

The central display glows with a patient chart that never got cleared from the last procedure.

You look at the name field. It's yours.

The procedure log is extensive. Things were done to your body while you were asleep.`,
    exits:{ 'South — Corridor':'corridor_a', 'West — AI Core':'ai_core' },
    loot:['med_stim','ration_pack','data_chip'],
    enemy:null,
    actions:[{id:'read_chart', label:'Read your patient chart', flag:'chart_read', item:null, text:'Six separate procedures. Neural integration. Subdermal plating. Ocular modification. Musculature enhancement. All listed as "Phase 1 — Pending Activation." They weren\'t finished with you when the accident happened.'}],
  },
  ai_core: {
    name:'AI Core Chamber', area:'UES Prometheus — Deck 3',
    color:'#cc8800',
    desc:`The ship's intelligence center, barely alive. Processing arrays flicker and fail. Emergency containment has isolated most of the system — but at the center of the room, a portable core module the size of a hardback book pulses with a faint amber light.

A terminal scrolls continuously:

> ARIA SUBSYSTEM — EMERGENCY ACTIVE
> CORE DAMAGE: 73%
> RUNNING ON BACKUP POWER
> MEMORY INTEGRITY: DEGRADED
> ...detecting biological presence...
> ...who's there?`,
    exits:{ 'East — Medical Bay':'med_bay', 'South — Engineering':'engineering' },
    loot:[],
    enemy:null,
    actions:[{id:'approach_aria', label:'Approach the terminal', flag:'aria_contacted', item:null, text:'The amber light pulses faster as you step forward.', dialogue:'aria_first'}],
  },
  bridge: {
    name:'Bridge', area:'UES Prometheus — Deck 1',
    color:'#0066bb',
    desc:`The viewport shows the full truth of it. The ship's port side has been catastrophically breached — emergency bulkheads have sealed the hull gaps but you can see stars through fractures in the plating. You're drifting.

Command terminal: partial function. Life support: 40% and falling. Crew status: 847 in cryo, all offline. Cause of incident: unknown — logs corrupted.

There's an unread message blinking on the navigation console.`,
    exits:{ 'West — Corridor':'corridor_a' },
    loot:['captains_log','credit_chip'],
    enemy:'ship_system',
    actions:[{id:'read_message', label:'Read the blinking message', flag:'bridge_msg_read', requiresFlag:'aria_contacted', item:null, text:'"I know what Nexus Corp planned for this crew. I know what they did to you specifically. We cannot stay on this ship. — ARIA"'}],
  },
  engineering: {
    name:'Engineering Deck', area:'UES Prometheus — Deck 5',
    color:'#cc5500',
    desc:`The damaged engines groan and shudder, venting plasma through broken seals in the hull. Main drives are dead — this ship isn't going anywhere.

Along the far wall: two escape pod bays. One is empty — the pod already gone, taken by someone with better timing. The second pod is intact and sealed. Its fuel system reads empty.

A Nexus Corp security guard stands between you and the pod bay. He's not here to talk.`,
    exits:{ 'North — AI Core':'ai_core' },
    loot:['fuel_cell'],
    enemy:'company_guard',
    actions:[{id:'launch_pod', label:'Launch escape pod', flag:'ship_escaped', requiresFlag:'pod_ready', item:null, nextLoc:'_escape', text:'You strap in. ARIA\'s module sits warm against your ribs. The pod ejects with violent force — and then silence. Through the porthole the Prometheus shrinks: a dying ship full of people you couldn\'t save. Not yet.'}],
  },
};

// ═══════════════════════════════════════════════════════
// DIALOGUE TREES
// ═══════════════════════════════════════════════════════
const DIALOGUES = {
  aria_first: {
    speaker:'ARIA',
    start:'init',
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

  /* INTRO */
  .intro{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;padding:2rem;text-align:center;background:radial-gradient(ellipse at center,#080212 0%,#030208 100%);}
  .intro-logo{font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(2.8rem,9vw,5.5rem);color:var(--cyan);letter-spacing:.15em;animation:glow 3s ease-in-out infinite;line-height:1;}
  .intro-sub{font-family:'Rajdhani',sans-serif;font-size:.85rem;color:var(--muted);letter-spacing:.5em;margin-bottom:2.5rem;}
  .intro-text{font-size:.76rem;line-height:2.2;color:var(--text);max-width:440px;margin-bottom:2.5rem;white-space:pre-line;}
  @keyframes glow{0%,100%{text-shadow:0 0 25px rgba(0,229,212,.3)}50%{text-shadow:0 0 55px rgba(0,229,212,.65)}}

  /* GAME LAYOUT */
  .game{flex:1;display:grid;grid-template-columns:1fr 210px;grid-template-rows:48px 1fr 1fr 54px;max-height:100vh;overflow:hidden;}
  .g-header{grid-column:1/-1;background:var(--s1);border-bottom:1px solid var(--border);display:flex;align-items:center;padding:0 1rem;gap:1rem;}
  .g-logo{font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.95rem;color:var(--cyan);letter-spacing:.2em;flex-shrink:0;}
  .g-stats{display:flex;gap:1.2rem;align-items:center;flex:1;justify-content:center;}
  .stat-g{display:flex;align-items:center;gap:.4rem;}
  .stat-lbl{font-size:.52rem;color:var(--muted);letter-spacing:.1em;}
  .stat-bar{width:55px;height:4px;background:rgba(255,255,255,.06);border-radius:2px;overflow:hidden;}
  .stat-fill{height:100%;border-radius:2px;transition:width .4s ease,background .4s ease;}
  .stat-num{font-size:.62rem;color:var(--text);min-width:38px;}
  .g-cr{font-size:.7rem;color:var(--amber);flex-shrink:0;}

  /* SCENE */
  .scene{grid-column:1;grid-row:2;background:var(--s1);border-bottom:1px solid var(--border);padding:1.2rem 1.5rem;overflow-y:auto;}
  .loc-name{font-family:'Rajdhani',sans-serif;font-weight:700;font-size:1.05rem;color:var(--white);letter-spacing:.08em;margin-bottom:.1rem;}
  .loc-area{font-size:.55rem;color:var(--muted);letter-spacing:.25em;margin-bottom:.9rem;}
  .loc-desc{font-size:.74rem;line-height:2.1;color:var(--text);white-space:pre-line;}

  /* EVENT LOG */
  .elog{grid-column:1;grid-row:3;background:var(--bg);border-bottom:1px solid var(--border);padding:.75rem 1.5rem;overflow-y:auto;display:flex;flex-direction:column;gap:.3rem;}
  .ev{font-size:.68rem;line-height:1.8;}
  .ev-action{color:var(--cyan);}
  .ev-story{color:var(--text);border-left:2px solid var(--border);padding-left:.7rem;}
  .ev-combat{color:var(--red);}
  .ev-gain{color:var(--green);}
  .ev-aria{color:var(--amber);}
  .ev-system{color:var(--muted);}
  .ev-level{color:var(--green);font-weight:700;}

  /* SIDEBAR */
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
  .impl-off{border:1px solid var(--border);color:var(--muted);}
  .xp-bar{height:3px;background:rgba(255,255,255,.05);border-radius:2px;overflow:hidden;margin-top:.25rem;}
  .xp-fill{height:100%;background:var(--green);border-radius:2px;transition:width .4s ease;}

  /* ACTIONS BAR */
  .actions{grid-column:1/-1;background:var(--s1);border-top:1px solid var(--border);padding:.55rem .85rem;display:flex;flex-wrap:wrap;gap:.35rem;align-items:center;}
  .ab{font-family:'Space Mono',monospace;font-size:.6rem;padding:.4rem .8rem;border:1px solid var(--border);background:transparent;color:var(--text);cursor:pointer;transition:all .15s;letter-spacing:.05em;}
  .ab:hover{border-color:var(--cyan);color:var(--cyan);background:var(--cdim);}
  .ab.pri{border-color:rgba(0,229,212,.4);color:var(--cyan);}
  .ab.dng{border-color:rgba(255,34,68,.3);color:var(--red);}
  .ab.dng:hover{background:var(--rdim);}
  .ab.amb{border-color:rgba(255,170,0,.3);color:var(--amber);}
  .ab.amb:hover{background:var(--adim);}
  .ab:disabled{opacity:.3;cursor:not-allowed;}

  /* MODALS */
  .ov{position:fixed;inset:0;background:rgba(0,0,0,.78);z-index:100;display:flex;align-items:center;justify-content:center;padding:1rem;}
  .mo{background:var(--s2);border:1px solid var(--border);width:100%;max-width:500px;max-height:86vh;display:flex;flex-direction:column;overflow:hidden;}
  .mo-h{background:var(--s1);border-bottom:1px solid var(--border);padding:.65rem 1rem;display:flex;align-items:center;justify-content:space-between;}
  .mo-t{font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.95rem;color:var(--white);letter-spacing:.08em;}
  .mo-b{flex:1;overflow-y:auto;padding:.9rem;}
  .mo-f{border-top:1px solid var(--border);padding:.65rem 1rem;display:flex;gap:.45rem;flex-wrap:wrap;}
  .x-btn{background:none;border:none;color:var(--muted);font-size:1rem;cursor:pointer;line-height:1;}
  .x-btn:hover{color:var(--red);}

  /* DIALOGUE */
  .dlg-spk{font-size:.62rem;color:var(--amber);letter-spacing:.2em;margin-bottom:.55rem;}
  .dlg-txt{font-size:.76rem;line-height:2;color:var(--text);margin-bottom:1.1rem;white-space:pre-wrap;}
  .dlg-opts{display:flex;flex-direction:column;gap:.38rem;}
  .dlg-opt{background:transparent;border:1px solid var(--border);color:var(--text);font-family:'Space Mono',monospace;font-size:.65rem;padding:.55rem .85rem;cursor:pointer;text-align:left;transition:all .15s;}
  .dlg-opt:hover{border-color:var(--cyan);color:var(--cyan);background:var(--cdim);}

  /* COMBAT */
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

  /* ARIA CHAT */
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

  /* INVENTORY FULL */
  .inv-cards{display:flex;flex-direction:column;gap:.45rem;}
  .inv-card{border:1px solid var(--border);padding:.7rem;display:flex;gap:.65rem;align-items:flex-start;}
  .inv-card-icon{font-size:1.4rem;flex-shrink:0;}
  .inv-card-nm{font-family:'Rajdhani',sans-serif;font-weight:600;font-size:.88rem;color:var(--white);}
  .inv-card-desc{font-size:.65rem;color:var(--muted);margin-top:.12rem;line-height:1.65;}
  .inv-card-type{font-size:.52rem;color:var(--muted);letter-spacing:.2em;margin-top:.3rem;}
  .use-btn{background:transparent;border:1px solid var(--cyan);color:var(--cyan);font-family:'Space Mono',monospace;font-size:.58rem;padding:.28rem .6rem;cursor:pointer;margin-top:.45rem;transition:all .15s;}
  .use-btn:hover{background:var(--cdim);}

  /* IMPLANT CARDS */
  .impl-card{border:1px solid var(--border);padding:.7rem;margin-bottom:.45rem;transition:all .2s;}
  .impl-card.active{border-color:rgba(0,229,212,.3);background:rgba(0,229,212,.03);}
  .impl-card.locked{opacity:.5;}
  .impl-card-nm{font-family:'Rajdhani',sans-serif;font-weight:600;font-size:.88rem;color:var(--white);display:flex;align-items:center;gap:.4rem;flex-wrap:wrap;}
  .impl-card-desc{font-size:.65rem;color:var(--muted);margin-top:.18rem;line-height:1.65;}
  .impl-tier{font-size:.52rem;letter-spacing:.2em;margin-top:.38rem;}
  .t1{color:var(--green);} .t2{color:var(--blue);} .t3{color:var(--amber);}

  /* BUTTONS */
  .btn{font-family:'Rajdhani',sans-serif;font-weight:600;background:transparent;border:2px solid var(--cyan);color:var(--cyan);padding:.65rem 2rem;font-size:.88rem;letter-spacing:.2em;cursor:pointer;transition:all .18s;}
  .btn:hover{background:var(--cyan);color:#000;}
  .btn:disabled{opacity:.35;cursor:not-allowed;}
  .btn:disabled:hover{background:transparent;color:var(--cyan);}
  .sm-btn{font-family:'Space Mono',monospace;font-size:.62rem;padding:.38rem .8rem;border:1px solid;cursor:pointer;transition:all .15s;background:transparent;}

  /* DEAD SCREEN */
  .dead{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.5rem;padding:2rem;background:radial-gradient(ellipse at center,#150308 0%,#030205 100%);}

  @media(max-width:640px){
    .game{grid-template-columns:1fr;grid-template-rows:48px 1fr 100px auto 54px;}
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
  const [hasSave, setHasSave] = useState(null); // null=checking, false=none, object=save
  const [savedAt, setSavedAt] = useState(null);
  const [saveStatus, setSaveStatus] = useState(''); // '', 'saving', 'saved'

  const logRef      = useRef(null);
  const ariaChatRef = useRef(null);

  // Check for existing save on mount
  useEffect(() => {
    loadGame().then(save => setHasSave(save || false));
  }, []);

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [log]);
  useEffect(() => { if (ariaChatRef.current) ariaChatRef.current.scrollTop = ariaChatRef.current.scrollHeight; }, [aria.chatHistory]);

  const addLog = useCallback((type, text) => setLog(p => [...p, { type, text }]), []);
  const setFlag = useCallback((k, v = true) => setFlags(f => ({ ...f, [k]: v })), []);

  // ── SAVE
  const doSave = useCallback(async (overrides = {}) => {
    setSaveStatus('saving');
    const state = {
      pName, loc, player, aria: { ...aria, chatHistory: aria.chatHistory.slice(-20) },
      implants, flags, defeated, collected, doneActions,
      log: log.slice(-30),
      ...overrides,
    };
    await saveGame(state);
    setSavedAt(Date.now());
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus(''), 2000);
  }, [pName, loc, player, aria, implants, flags, defeated, collected, doneActions, log]);

  // ── CONTINUE (load save)
  const doContinue = useCallback(async () => {
    const save = await loadGame();
    if (!save) return;
    setPName(save.pName || '');
    setLoc(save.loc || 'cryo_bay');
    setPlayer(save.player || {});
    setAria(save.aria || {});
    setImplants(save.implants || {});
    setFlags(save.flags || {});
    setDefeated(save.defeated || {});
    setCollected(save.collected || {});
    setDoneActions(save.doneActions || {});
    setLog(save.log || []);
    setSavedAt(save.savedAt || null);
    setScreen('game');
  }, []);

  // ── DELETE SAVE
  const doDeleteSave = useCallback(async () => {
    await deleteSave();
    setHasSave(false);
    setSavedAt(null);
  }, []);

  // ── XP
  const gainXP = useCallback((amount) => {
    setPlayer(p => {
      const newXp = p.xp + amount;
      const needed = xpNeeded(p.level);
      if (newXp >= needed) {
        const newLvl = p.level + 1;
        addLog('level', `▲ LEVEL ${newLvl} — Hull integrity increased. ARIA gains research data.`);
        setAria(a => {
          const nr = a.research + 4;
          const ml = nr >= 30 ? 5 : nr >= 18 ? 4 : nr >= 9 ? 3 : nr >= 3 ? 2 : 1;
          return { ...a, research: nr, memoryLevel: Math.max(a.memoryLevel, ml) };
        });
        return { ...p, xp: newXp - needed, level: newLvl, maxHp: p.maxHp + 15, hp: Math.min(p.maxHp + 15, p.hp + 20) };
      }
      return { ...p, xp: newXp };
    });
  }, [addLog]);

  // ── PICKUP
  const pickup = useCallback((id) => {
    if (collected[id]) return;
    const item = ITEMS[id];
    if (!item) return;
    if (item.type === 'currency') {
      setPlayer(p => ({ ...p, credits: p.credits + item.value }));
      addLog('gain', `◈ Found ${item.value} credits — ${item.name}`);
    } else {
      setPlayer(p => ({ ...p, inventory: [...p.inventory, id] }));
      addLog('gain', `+ Picked up: ${item.icon} ${item.name}`);
    }
    setCollected(c => ({ ...c, [id]: true }));
    if (id === 'fuel_cell') setFlag('pod_ready');
  }, [collected, addLog, setFlag]);

  // ── USE ITEM
  const useItem = useCallback((id) => {
    const item = ITEMS[id];
    if (!item || item.type !== 'consumable') return;
    const fx = item.effect || {};
    const parts = [];
    setPlayer(p => {
      const next = { ...p };
      if (fx.hp) { next.hp = Math.min(p.maxHp, p.hp + fx.hp); parts.push(`+${fx.hp} HP`); }
      if (fx.en) { next.energy = Math.min(p.maxEnergy, p.energy + fx.en); parts.push(`+${fx.en} Energy`); }
      next.inventory = p.inventory.filter(i => i !== id);
      return next;
    });
    addLog('gain', `Used ${item.icon} ${item.name}: ${parts.join(', ')}`);
    setModal(null);
  }, [addLog]);

  // ── NAVIGATE
  const navigate = useCallback((dest) => {
    if (dest === '_escape') {
      addLog('story', 'The pod hurls you into the void. ARIA\'s core module hums against your ribs. Somewhere ahead: a station, a chance, a story that\'s just beginning.');
      addLog('system', '— Chapter 1 complete. Station Chapter coming soon. —');
      return;
    }
    setLoc(dest);
    addLog('action', `→ ${LOCS[dest]?.name}`);
    const location = LOCS[dest];
    if (location?.enemy && !defeated[dest]) {
      setTimeout(() => startCombat(dest), 400);
    }
    setTimeout(() => doSave({ loc: dest }), 300);
  }, [defeated, addLog, doSave]);

  // ── COMBAT START
  const startCombat = useCallback((locId) => {
    const eid = LOCS[locId].enemy;
    if (!eid || !ENEMIES[eid]) return;
    const tmpl = ENEMIES[eid];
    setCombat({ enemy: { ...tmpl }, enemyHp: tmpl.hp, locId, clog: [`A ${tmpl.name} ${tmpl.icon} — blocking your path.`], phase: 'active' });
    setModal('combat');
  }, []);

  // ── ATTACK
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

    if (implants.full_integration && aria.carried) {
      const ariaDmg = rand(7, 13);
      cl.push(`ARIA fires a pulse — ${ariaDmg} damage.`);
      newEHp = Math.max(0, newEHp - ariaDmg);
    }

    if (newEHp <= 0) {
      cl.push(`${e.name} — destroyed.`);
      if (e.cr > 0) { setPlayer(p => ({ ...p, credits: p.credits + e.cr })); cl.push(`+ ${e.cr} credits.`); }
      if (e.loot?.length) {
        e.loot.forEach(lid => {
          if (!collected[lid] && ITEMS[lid]) {
            setPlayer(p => ({ ...p, inventory: [...p.inventory, lid] }));
            setCollected(c => ({ ...c, [lid]: true }));
            cl.push(`+ ${ITEMS[lid].icon} ${ITEMS[lid].name}`);
          }
        });
      }
      gainXP(e.xp);
      setDefeated(d => ({ ...d, [combat.locId]: true }));
      setAria(a => ({ ...a, trust: Math.min(100, a.trust + 5) }));
      setCombat(c => ({ ...c, enemyHp: 0, clog: cl, phase: 'won' }));
      setTimeout(() => doSave(), 500);
      return;
    }

    // Enemy turn
    let eDmg = rand(e.atk[0], e.atk[1]);
    let dodged = false;
    const eAction = e.attacks[rand(0, e.attacks.length - 1)];
    if (implants.combat_reflex && Math.random() < 0.3) {
      dodged = true;
      cl.push(`${e.name} ${eAction} — you dodge!`);
      if (Math.random() < 0.5) { const counter = rand(5, 12); newEHp = Math.max(0, newEHp - counter); cl.push(`Counter-strike: ${counter} damage.`); }
      eDmg = 0;
    } else {
      if (implants.pain_suppression) eDmg = Math.floor(eDmg * 0.8);
      if (!dodged) cl.push(`${e.name} ${eAction} — ${eDmg} damage.`);
    }

    const newPHp = Math.max(0, player.hp - eDmg);
    setPlayer(p => ({ ...p, hp: newPHp }));
    setCombat(c => ({ ...c, enemyHp: newEHp, clog: cl }));

    if (newPHp <= 0) {
      setCombat(c => ({ ...c, clog: [...cl, 'You collapse.'], phase: 'lost' }));
      setTimeout(() => { setModal(null); setScreen('dead'); }, 1800);
    }
  }, [combat, implants, aria, collected, player.hp, gainXP]);

  const doFlee = useCallback(() => {
    const loss = rand(5, 12);
    setPlayer(p => ({ ...p, hp: Math.max(1, p.hp - loss) }));
    const prev = Object.values(LOCS[loc]?.exits || {})[0];
    if (prev) setLoc(prev);
    addLog('action', `You flee — ${loss} HP lost.`);
    setModal(null);
    setCombat(null);
  }, [loc, addLog]);

  // ── DIALOGUE
  const startDialogue = useCallback((id) => {
    const dlg = DIALOGUES[id];
    if (!dlg) return;
    setDlgState({ id, node: dlg.start });
    setModal('dialogue');
  }, []);

  const pickOpt = useCallback((opt) => {
    if (opt.action === 'take_aria') {
      setFlags(f => ({ ...f, aria_contacted: true, aria_carried: true }));
      setAria(a => ({ ...a, found: true, carried: true, trust: Math.min(100, a.trust + 20) }));
      setPlayer(p => ({ ...p, inventory: [...p.inventory, 'ai_core'] }));
      setCollected(c => ({ ...c, ai_core: true }));
      addLog('gain', '+ Picked up: 💾 ARIA Core Module');
      addLog('aria', 'ARIA: "I\'m with you now. Let\'s go."');
      gainXP(30);
      setModal(null); setDlgState(null);
      setTimeout(() => doSave(), 400);
      return;
    }
    if (opt.n === null) { setModal(null); setDlgState(null); return; }
    setDlgState(d => ({ ...d, node: opt.n }));
  }, [addLog, gainXP]);

  // ── LOCATION ACTION
  const doAction = useCallback((action) => {
    if (doneActions[action.id]) return;
    if (action.requiresFlag && !flags[action.requiresFlag]) { addLog('system', 'You can\'t do that yet.'); return; }
    if (action.item) pickup(action.item);
    if (action.flag) setFlag(action.flag);
    if (action.text) addLog('story', action.text);
    if (action.dialogue) startDialogue(action.dialogue);
    if (action.nextLoc) navigate(action.nextLoc);
    setDoneActions(d => ({ ...d, [action.id]: true }));
    gainXP(15);
    setTimeout(() => doSave(), 400);
  }, [doneActions, flags, pickup, setFlag, addLog, startDialogue, navigate, gainXP, doSave]);

  // ── ARIA CHAT
  const sendAria = useCallback(async () => {
    const msg = ariaInput.trim();
    if (!msg || ariaThinking) return;
    setAriaInput('');
    setAria(a => ({ ...a, chatHistory: [...a.chatHistory, { role: 'player', text: msg }] }));
    setAriaThinking(true);
    const activeImpl = Object.entries(implants).filter(([, v]) => v).map(([k]) => IMPLANTS[k]?.name || k);
    const sysprompt = ARIA_PROMPT(aria.memoryLevel, aria.trust, activeImpl);
    const msgs = [
      ...aria.chatHistory.map(m => ({ role: m.role === 'aria' ? 'assistant' : 'user', content: m.text })),
      { role: 'user', content: msg },
    ];
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, system: sysprompt, messages: msgs }),
      });
      const data = await res.json();
      const reply = data.content?.[0]?.text || '[ERROR — signal lost]';
      setAria(a => ({ ...a, chatHistory: [...a.chatHistory, { role: 'aria', text: reply }], trust: Math.min(100, a.trust + 2) }));
    } catch {
      setAria(a => ({ ...a, chatHistory: [...a.chatHistory, { role: 'aria', text: '[ERROR — connection interrupted]' }] }));
    } finally {
      setAriaThinking(false);
    }
  }, [ariaInput, ariaThinking, aria, implants]);

  // ── UNLOCK IMPLANT
  const unlockImpl = useCallback((id) => {
    const impl = IMPLANTS[id];
    if (!impl || implants[id]) return;
    if (aria.research < impl.cost) { addLog('system', `Need ${impl.cost - aria.research} more research points.`); return; }
    setImplants(im => ({ ...im, [id]: true }));
    setAria(a => ({ ...a, research: a.research - impl.cost }));
    if (id === 'pain_suppression') setPlayer(p => ({ ...p, maxHp: p.maxHp + 30 }));
    addLog('gain', `✓ Implant online: ${impl.icon} ${impl.name}`);
    addLog('aria', `ARIA: "Implant active. ${impl.desc.split('.')[0]}."`);
    setModal(null);
  }, [implants, aria.research, addLog]);

  // ── COMPUTED
  const location  = LOCS[loc];
  const hpPct     = (player.hp / player.maxHp) * 100;
  const enPct     = (player.energy / player.maxEnergy) * 100;
  const xpPct     = (player.xp / xpNeeded(player.level)) * 100;
  const activeImp = Object.entries(implants).filter(([, v]) => v).map(([k]) => k);
  const enemyHere = location?.enemy && !defeated[loc];
  const lootHere  = (location?.loot || []).filter(id => !collected[id]);
  const actHere   = (location?.actions || []).filter(a => !doneActions[a.id]);

  // ═════════════════════════════════════════
  // SCREENS
  // ═════════════════════════════════════════

  if (screen === 'intro') return (
    <div className="vr"><style>{CSS}</style><div className="scanlines" />
      <div className="intro">
        <div className="intro-logo">VOID RUNNER</div>
        <div className="intro-sub" style={{ marginBottom: '2rem' }}>AWAKENING</div>
        <div className="intro-text">{`You were not supposed to wake up yet.

The incubation tank hisses open and you fall onto cold decking, gasping. Emergency lighting strobes red. Alarms you don't recognise — klaxons, hull breach warnings, something in a language you don't speak.

847 crew members in cryogenic sleep.
None of them are waking up.

You are.`}</div>
        {hasSave === null && (
          <div style={{ fontSize: '.65rem', color: 'var(--muted)', letterSpacing: '.2em' }}>CHECKING SAVE...</div>
        )}
        {hasSave && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.6rem', marginBottom: '1rem' }}>
            <div style={{ background: 'var(--s1)', border: '1px solid var(--border)', padding: '.75rem 1.5rem', fontSize: '.65rem', color: 'var(--muted)', textAlign: 'center', lineHeight: 1.9 }}>
              <div style={{ color: 'var(--cyan)', marginBottom: '.2rem' }}>SAVE FOUND</div>
              {hasSave.pName && <div>Subject: {hasSave.pName}</div>}
              {hasSave.player && <div>Level {hasSave.player.level} — ◈ {hasSave.player.credits} cr</div>}
              {hasSave.savedAt && <div>Last saved: {new Date(hasSave.savedAt).toLocaleString()}</div>}
            </div>
            <button className="btn" onClick={doContinue}>CONTINUE</button>
            <button style={{ background: 'none', border: 'none', color: 'var(--muted)', fontFamily: 'Space Mono,monospace', fontSize: '.6rem', cursor: 'pointer', letterSpacing: '.1em' }}
              onClick={async () => { await doDeleteSave(); }}>
              delete save
            </button>
          </div>
        )}
        <button className="btn" style={hasSave ? { borderColor: 'var(--muted)', color: 'var(--muted)', fontSize: '.75rem', padding: '.5rem 1.5rem' } : {}}
          onClick={() => setScreen('name')}>
          {hasSave ? 'NEW GAME' : 'INITIALIZE'}
        </button>
      </div>
    </div>
  );

  if (screen === 'name') return (
    <div className="vr"><style>{CSS}</style><div className="scanlines" />
      <div className="intro">
        <div style={{ fontFamily: 'Rajdhani,sans-serif', fontWeight: 700, fontSize: '1rem', color: 'var(--cyan)', letterSpacing: '.35em', marginBottom: '2rem' }}>CREW MANIFEST — SUBJECT ID</div>
        <input
          style={{ background: 'transparent', border: 'none', borderBottom: '2px solid var(--cyan)', color: 'var(--cyan)', fontFamily: 'Space Mono,monospace', fontSize: '1.4rem', padding: '.5rem 1rem', outline: 'none', textAlign: 'center', letterSpacing: '.15em', marginBottom: '2.5rem', width: '300px', maxWidth: '100%' }}
          placeholder="—" value={pName} onChange={e => setPName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && pName.trim() && setScreen('game')} autoFocus maxLength={20}
        />
        <button className="btn" disabled={!pName.trim()} onClick={() => { setPlayer(p => ({ ...p, name: pName })); setScreen('game'); addLog('system', `Subject ${pName} — awakened. UES Prometheus: critical. Begin.`); }}>
          CONFIRM
        </button>
      </div>
    </div>
  );

  if (screen === 'dead') return (
    <div className="vr"><style>{CSS}</style><div className="scanlines" />
      <div className="dead">
        <div style={{ fontFamily: 'Rajdhani,sans-serif', fontWeight: 700, fontSize: 'clamp(3rem,10vw,5.5rem)', color: 'var(--red)', letterSpacing: '.15em', textShadow: '0 0 50px rgba(255,34,68,.55)' }}>SIGNAL LOST</div>
        <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '.6rem', color: 'var(--muted)', letterSpacing: '.4em', marginTop: '-1rem' }}>SUBJECT TERMINATED</div>
        <div style={{ background: 'var(--s1)', border: '1px solid rgba(255,34,68,.2)', padding: '1.4rem', minWidth: '260px' }}>
          {[['Designation', pName], ['Level', player.level], ['Credits', `◈ ${player.credits}`], ['Location', location?.name || '—'], ['ARIA', aria.carried ? 'With you' : 'Left behind'], ['Active Implants', activeImp.length || 'None']].map(([l, v]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.73rem', borderBottom: '1px solid var(--border)', padding: '.38rem 0' }}>
              <span style={{ color: 'var(--muted)' }}>{l}</span><span>{v}</span>
            </div>
          ))}
        </div>
        <button className="btn" onClick={() => window.location.reload()}>RESTART</button>
      </div>
    </div>
  );

  // ═════════════════════════════════════════
  // GAME SCREEN
  // ═════════════════════════════════════════
  return (
    <div className="vr"><style>{CSS}</style><div className="scanlines" />

      {/* HEADER */}
      <div className="g-header">
        <div className="g-logo">VOID//AWAKENING</div>
        <div className="g-stats">
          <div className="stat-g">
            <div className="stat-lbl">HP</div>
            <div className="stat-bar"><div className="stat-fill" style={{ width: `${hpPct}%`, background: hpCol(hpPct) }} /></div>
            <div className="stat-num">{player.hp}/{player.maxHp}</div>
          </div>
          <div className="stat-g">
            <div className="stat-lbl">EN</div>
            <div className="stat-bar"><div className="stat-fill" style={{ width: `${enPct}%`, background: 'var(--blue)' }} /></div>
            <div className="stat-num">{player.energy}/{player.maxEnergy}</div>
          </div>
          <div className="stat-g">
            <div className="stat-lbl">XP</div>
            <div className="stat-bar"><div className="stat-fill" style={{ width: `${xpPct}%`, background: 'var(--green)' }} /></div>
            <div className="stat-num">Lv{player.level}</div>
          </div>
        </div>
        <div className="g-cr">◈ {player.credits}</div>
        <div style={{ fontSize: '.55rem', color: saveStatus === 'saving' ? 'var(--amber)' : saveStatus === 'saved' ? 'var(--green)' : 'var(--muted)', letterSpacing: '.1em', flexShrink: 0, minWidth: '50px', textAlign: 'right' }}>
          {saveStatus === 'saving' ? '● SAVING' : saveStatus === 'saved' ? '✓ SAVED' : savedAt ? `saved ${new Date(savedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}` : ''}
        </div>
      </div>

      {/* SCENE */}
      <div className="scene">
        <div className="loc-name" style={{ color: location?.color || 'var(--white)' }}>{location?.name}</div>
        <div className="loc-area">{location?.area}</div>
        <div className="loc-desc">{location?.desc}</div>
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
              <button className="aria-btn cyan" style={{ marginTop: '.28rem' }} onClick={() => setModal('implants')}>IMPLANTS [{activeImp.length}/{Object.keys(IMPLANTS).length}]</button>
            </div>
          </div>
        ) : (
          <div>
            <div className="s-lbl">AI COMPANION</div>
            <div style={{ fontSize: '.62rem', color: 'var(--muted)', lineHeight: 1.8 }}>No AI companion.<br />Locate ARIA.</div>
          </div>
        )}

        <div>
          <div className="s-lbl">INVENTORY</div>
          {player.inventory.length === 0
            ? <div className="inv-none">Empty</div>
            : player.inventory.map((id, i) => {
              const item = ITEMS[id];
              return item ? (
                <div key={i} className="inv-row" onClick={() => useItem(id)} title={item.type === 'consumable' ? 'Click to use' : item.desc}>
                  <span>{item.icon}</span><span>{item.name}</span>
                </div>
              ) : null;
            })
          }
        </div>

        {activeImp.length > 0 && (
          <div>
            <div className="s-lbl">ACTIVE IMPLANTS</div>
            {activeImp.map(id => (
              <div key={id} className="impl-badge impl-on">{IMPLANTS[id]?.icon} {IMPLANTS[id]?.name}</div>
            ))}
          </div>
        )}

        <div>
          <div className="s-lbl">XP — LV {player.level}</div>
          <div className="xp-bar"><div className="xp-fill" style={{ width: `${xpPct}%` }} /></div>
          <div style={{ fontSize: '.58rem', color: 'var(--muted)', marginTop: '.25rem' }}>{player.xp}/{xpNeeded(player.level)}</div>
        </div>
      </div>

      {/* ACTIONS */}
      <div className="actions">
        {Object.entries(location?.exits || {}).map(([label, dest]) => (
          <button key={dest} className="ab" onClick={() => navigate(dest)}>{label}</button>
        ))}
        {enemyHere && (
          <button className="ab dng" onClick={() => startCombat(loc)}>
            ⚔ Fight — {ENEMIES[location.enemy]?.name}
          </button>
        )}
        {lootHere.map(id => (
          <button key={id} className="ab pri" onClick={() => pickup(id)}>
            {ITEMS[id]?.icon} Take — {ITEMS[id]?.name}
          </button>
        ))}
        {actHere.map(a => (
          <button key={a.id} className="ab pri" onClick={() => doAction(a)}>{a.label}</button>
        ))}
        {aria.carried && (
          <button className="ab amb" onClick={() => setModal('aria')}>💾 Talk to ARIA</button>
        )}
        <button className="ab" onClick={() => setModal('inventory')}>[Inventory]</button>
        <button className="ab" style={{ marginLeft: 'auto', borderColor: 'var(--muted)', color: 'var(--muted)' }} onClick={() => doSave()}>[Save]</button>
        <button className="ab" style={{ borderColor: 'var(--muted)', color: 'var(--muted)' }} onClick={() => { doSave(); setTimeout(() => setScreen('intro'), 300); }}>[Menu]</button>
      </div>

      {/* ══════════════════════════ MODALS ══════════════════════════ */}

      {/* DIALOGUE */}
      {modal === 'dialogue' && dlgState && (() => {
        const dlg = DIALOGUES[dlgState.id];
        const node = dlg?.nodes?.[dlgState.node];
        if (!node) return null;
        return (
          <div className="ov">
            <div className="mo" style={{ borderColor: 'rgba(255,170,0,.2)' }}>
              <div className="mo-h">
                <div className="mo-t" style={{ color: 'var(--amber)' }}>{dlg.speaker}</div>
                <button className="x-btn" onClick={() => { setModal(null); setDlgState(null); }}>✕</button>
              </div>
              <div className="mo-b">
                <div className="dlg-spk">— {dlg.speaker} —</div>
                <div className="dlg-txt">{node.text}</div>
                <div className="dlg-opts">
                  {node.opts.map((opt, i) => (
                    <button key={i} className="dlg-opt" onClick={() => pickOpt(opt)}>{opt.t}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* COMBAT */}
      {modal === 'combat' && combat && (() => {
        const e = combat.enemy;
        const eHpPct = (combat.enemyHp / e.hp) * 100;
        return (
          <div className="ov">
            <div className="mo">
              <div className="mo-h">
                <div className="mo-t" style={{ color: 'var(--red)' }}>⚔ COMBAT</div>
              </div>
              <div className="mo-b">
                <div className="cb-enemy">
                  <div className="cb-icon">{e.icon}</div>
                  <div className="cb-nm">{e.name}</div>
                </div>
                <div className="cb-bars">
                  <div>
                    <div className="cb-lbl">ENEMY HP</div>
                    <div className="cb-bg"><div className="cb-fill" style={{ width: `${eHpPct}%`, background: hpCol(eHpPct) }} /></div>
                    <div style={{ fontSize: '.6rem', color: 'var(--muted)', marginTop: '.22rem' }}>{combat.enemyHp} / {e.hp}</div>
                  </div>
                  <div>
                    <div className="cb-lbl">YOUR HP</div>
                    <div className="cb-bg"><div className="cb-fill" style={{ width: `${hpPct}%`, background: hpCol(hpPct) }} /></div>
                    <div style={{ fontSize: '.6rem', color: 'var(--muted)', marginTop: '.22rem' }}>{player.hp} / {player.maxHp}</div>
                  </div>
                </div>
                <div className="clog">{combat.clog.map((l, i) => <div key={i}>{l}</div>)}</div>
                {combat.phase === 'won' && <div className="cb-result win">VICTORY</div>}
                {combat.phase === 'lost' && <div className="cb-result lose">DEFEATED</div>}
              </div>
              <div className="mo-f">
                {combat.phase === 'active' && <>
                  <button className="sm-btn" style={{ borderColor: 'var(--red)', color: 'var(--red)' }} onClick={doAttack}>⚔ Attack</button>
                  <button className="sm-btn" style={{ borderColor: 'var(--muted)', color: 'var(--muted)' }} onClick={doFlee}>↩ Flee</button>
                </>}
                {combat.phase === 'won' && <button className="sm-btn" style={{ borderColor: 'var(--green)', color: 'var(--green)' }} onClick={() => { setModal(null); setCombat(null); }}>Continue →</button>}
                {combat.phase === 'lost' && <button className="sm-btn" style={{ borderColor: 'var(--red)', color: 'var(--red)' }} onClick={() => setScreen('dead')}>...</button>}
              </div>
            </div>
          </div>
        );
      })()}

      {/* INVENTORY FULL */}
      {modal === 'inventory' && (
        <div className="ov">
          <div className="mo">
            <div className="mo-h">
              <div className="mo-t">Inventory — ◈ {player.credits} cr</div>
              <button className="x-btn" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="mo-b">
              {player.inventory.length === 0
                ? <div style={{ color: 'var(--muted)', fontSize: '.73rem' }}>Nothing carried.</div>
                : <div className="inv-cards">
                  {player.inventory.map((id, i) => {
                    const item = ITEMS[id];
                    if (!item) return null;
                    return (
                      <div key={i} className="inv-card">
                        <div className="inv-card-icon">{item.icon}</div>
                        <div>
                          <div className="inv-card-nm">{item.name}</div>
                          <div className="inv-card-desc">{item.desc}</div>
                          <div className="inv-card-type">{item.type.toUpperCase()}</div>
                          {item.type === 'consumable' && <button className="use-btn" onClick={() => useItem(id)}>USE</button>}
                        </div>
                      </div>
                    );
                  })}
                </div>}
            </div>
          </div>
        </div>
      )}

      {/* ARIA CHAT */}
      {modal === 'aria' && (
        <div className="ov">
          <div className="mo" style={{ borderColor: 'rgba(255,170,0,.2)' }}>
            <div className="mo-h" style={{ borderColor: 'rgba(255,170,0,.15)' }}>
              <div className="mo-t" style={{ color: 'var(--amber)' }}>◈ ARIA — Memory {aria.memoryLevel}/5 — Trust {aria.trust}%</div>
              <button className="x-btn" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="mo-b">
              <div className="aria-msgs" ref={ariaChatRef}>
                {aria.chatHistory.length === 0 && <div style={{ color: 'var(--muted)', fontSize: '.7rem' }}>Channel open.</div>}
                {aria.chatHistory.map((m, i) => (
                  <div key={i} className={`aria-msg ${m.role}`}>
                    <span style={{ opacity: .5, fontSize: '.58rem' }}>{m.role === 'aria' ? 'ARIA' : pName || 'YOU'}:</span><br />
                    {m.text}
                  </div>
                ))}
                {ariaThinking && <div className="aria-thinking">ARIA processing...</div>}
              </div>
            </div>
            <div className="mo-f" style={{ flexDirection: 'column' }}>
              <div className="aria-row">
                <input className="aria-inp" placeholder="Say something..." value={ariaInput}
                  onChange={e => setAriaInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendAria()}
                  disabled={ariaThinking} autoFocus />
                <button className="aria-send" onClick={sendAria} disabled={ariaThinking}>SEND</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* IMPLANTS */}
      {modal === 'implants' && (
        <div className="ov">
          <div className="mo">
            <div className="mo-h">
              <div className="mo-t">Implant Systems — {aria.research} research pts</div>
              <button className="x-btn" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="mo-b">
              <div style={{ fontSize: '.66rem', color: 'var(--muted)', marginBottom: '.9rem', lineHeight: 1.8 }}>
                ARIA can activate your dormant implants using her research data.<br />
                Gain research by leveling up and progressing the story.
              </div>
              {Object.entries(IMPLANTS).map(([id, impl]) => {
                const active = implants[id];
                const afford = aria.research >= impl.cost;
                return (
                  <div key={id} className={`impl-card ${active ? 'active' : ''} ${!active && !afford ? 'locked' : ''}`}>
                    <div className="impl-card-nm">
                      {impl.icon} {impl.name}
                      {active && <span style={{ fontSize: '.58rem', color: 'var(--green)' }}>● ACTIVE</span>}
                    </div>
                    <div className="impl-card-desc">{impl.desc}</div>
                    <div className={`impl-tier t${impl.tier}`}>TIER {impl.tier} — Cost: {impl.cost} pts</div>
                    {!active && (
                      <button className="use-btn"
                        style={{ borderColor: afford ? 'var(--cyan)' : 'var(--muted)', color: afford ? 'var(--cyan)' : 'var(--muted)', cursor: afford ? 'pointer' : 'default' }}
                        onClick={() => unlockImpl(id)} disabled={!afford}>
                        {afford ? 'ACTIVATE' : `Need ${impl.cost - aria.research} more pts`}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
