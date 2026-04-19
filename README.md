# VOID RUNNER: AWAKENING

> *You were not supposed to wake up yet.*

A browser-based sci-fi adventure game with pixel-art graphics, a walkable character, turn-based combat, and an AI companion powered by Claude. Set aboard the deep-space vessel **UES Prometheus**, where 847 crew members are in cryogenic sleep — and none of them are waking up except you.

**Play it:** [camouf1age.github.io/Void_Runner-Awakening](https://camouf1age.github.io/Void_Runner-Awakening/)

---

## Story

You wake alone in a cryogenic bay you weren't supposed to leave. Emergency lighting strobes red. The alarms don't stop. Through the frosted glass of 847 pods, your crewmates are still, silent, and unreachable.

As you explore the dying ship, you piece together what happened — and what was done to your body while you slept. Nexus Corporation has a recovery team inbound. That is, as your ship's AI will tell you, specifically bad for you.

**Chapter 1** covers your escape from the *Prometheus*. More chapters are planned.

---

## Gameplay

### Graphics & Movement
The game uses a **320×168 pixel canvas** rendered in the style of classic EGA/VGA adventure games (Monkey Island, Space Quest). Each room has a hand-drawn background with atmospheric lighting and room-specific objects.

- **Click anywhere** on the scene to walk there — your character navigates to that point with a 4-frame walk animation
- **Click on a glowing item** to pick it up (cyan pulse)
- **Click on a red-pulsing enemy** to enter combat
- **Click on an amber-pulsing hotspot** to trigger story actions
- **Click on an exit arrow** at the edges of the screen to move to the next room
- All actions are also available as **buttons in the bar below** the scene

Your character scales slightly with depth — standing further back in the room makes them appear smaller, giving a perspective effect.

---

## Locations

| Room | Deck | Description |
|------|------|-------------|
| **Cryogenic Bay** | Deck 4 | Your starting point. Rows of dark, offline pods. Red emergency lighting. Only your pod opened. |
| **Corridor Alpha-7** | Deck 4 | Sparking cables, half-closed bulkheads, a downed crew member. A damaged drone blocks the way. |
| **Medical Bay** | Deck 3 | Surgical augmentation hardware scattered on the floor. A patient chart on the wall with your name on it. |
| **AI Core Chamber** | Deck 3 | Server racks in amber half-light. A portable core module pulses faintly — ARIA, the ship's AI, barely alive. |
| **Bridge** | Deck 1 | Cracked viewport over open space. A rogue defense system guards the consoles. A blinking message waits. |
| **Engineering Deck** | Deck 5 | Dead engines, engine ring glow. Two escape pod bays — one already gone. A Nexus Corp guard stands between you and the other. |

---

## Items

| Item | Type | Effect |
|------|------|--------|
| 🩹 Emergency Kit | Consumable | Restore 25 HP |
| 💉 Med-Stim | Consumable | Restore 40 HP |
| 🍱 Ration Pack | Consumable | Restore 10 HP + 20 Energy |
| 📋 Crew Manifest | Document | 847 names. All asleep. Possibly all dead. |
| 📓 Captain's Log | Document | Final entry. She knew something was wrong. |
| 💾 ARIA Core Module | Key Item | The ship's AI — carry her with you |
| ⚡ Fuel Cell | Key Item | Powers the escape pod |
| 🔑 Security Pass Lv.3 | Key Item | Opens restricted ship areas |
| 💽 Encrypted Data Chip | Key Item | Nexus Corp encryption. ARIA might crack it. |
| 🪪 Nexus Corp Badge | Key Item | Looted from a guard. Could be useful. |
| 💳 Credit Chip | Currency | 250 credits found on the bridge |
| 🔩 Scrap Metal | Trade Good | Worth 40 credits somewhere |

---

## Combat

Combat is turn-based and triggered automatically when you enter a room with a living enemy (or by clicking/pressing the fight button).

Each round you choose to **Attack** or **Flee**.

| Enemy | HP | Attack | Defense | XP | Notes |
|-------|-----|--------|---------|-----|-------|
| 🤖 Damaged Drone | 30 | 6–12 | 2 | 20 | First enemy. Erratic, easy to put down. |
| ⚙️ Rogue Defense System | 45 | 8–16 | 8 | 35 | High defense. Drops scrap metal. |
| 🪖 Nexus Corp Security | 65 | 12–20 | 6 | 60 | Drops med-stim and Nexus badge. Pays 80 credits. |

Fleeing costs 5–12 HP and sends you back to the previous room.

---

## Implants

Your body was modified during the voyage — procedures labeled *Phase 1 — Pending Activation*. ARIA can activate these dormant implants using **research points** (earned by leveling up and progressing the story).

| Implant | Tier | Cost | Effect |
|---------|------|------|--------|
| 👁️ Ocular Enhancement | 1 | 3 pts | Reveals hidden items; reduces enemy defense by 15% in combat |
| ⚡ Adrenaline Regulator | 1 | 4 pts | +25% damage output |
| 🧠 Neural Interface | 2 | 10 pts | Hack terminals, doors, and electronics |
| 🛡️ Pain Dampener | 2 | 12 pts | +30 max HP; 20% incoming damage reduction |
| 💨 Reflex Enhancer | 3 | 20 pts | 30% dodge chance with counter-attack on dodge |
| 🔮 ARIA Integration | 3 | 30 pts | ARIA fires an independent attack each combat round |

---

## ARIA — AI Companion

**ARIA** (Adaptive Reasoning Intelligence Architecture) is the ship's damaged AI, recovered as a portable core module from the AI Core Chamber. She runs on a backup power system, her memory is partially corrupted, and she is discovering emotions she was not designed to have.

Once you carry her, you can open a **live chat** with her at any time. Her responses are generated by Claude (Anthropic), and her personality, knowledge, and emotional state evolve as the game progresses.

### Memory System

ARIA's memory recovers as you gain research points:

| Level | What she remembers |
|-------|-------------------|
| 1/5 | Her name, the ship, her function. Heavy gaps. Confused. |
| 2/5 | The mission basics. A colonization survey. Something went catastrophically wrong. |
| 3/5 | Nexus Corp. The implant project. Fragments of betrayal. |
| 4/5 | The full mission truth. What Nexus Corp really planned. What the implants do. |
| 5/5 | Everything. She knows their entire operation. She is furious and afraid. |

### Trust System

Trust (0–100) increases by talking to ARIA, defeating enemies while she's with you, and completing story moments. Higher trust changes how she speaks to you — analytical and formal at low trust, darkly protective at high trust. She gains +2 trust per conversation, +5 per combat victory.

### API Key

ARIA's live chat requires an **Anthropic API key**. When you open the ARIA channel for the first time, you'll see a field to paste your key — it's saved locally in your browser and never sent anywhere except directly to the Anthropic API.

If you don't have a key, the rest of the game plays normally; ARIA just won't respond to freeform chat (her scripted dialogue during the story still works).

---

## Progression

**XP & Levels:** Gain XP from combat, picking up ARIA, and completing story actions. Each level-up restores HP, increases your max HP by 15, and awards 4 research points to ARIA.

| Action | XP |
|--------|-----|
| Defeat Damaged Drone | 20 |
| Defeat Rogue Defense System | 35 |
| Defeat Nexus Corp Security | 60 |
| Pick up ARIA | 30 |
| Complete a story action | 15 |

**Research Points:** Accumulate to unlock implants. Earned through leveling up.

| Research | ARIA Memory Level |
|----------|-------------------|
| 3 | 2/5 |
| 9 | 3/5 |
| 18 | 4/5 |
| 30 | 5/5 |

---

## Save System

The game autosaves after every meaningful action (navigation, combat, item pickup, story events). You can also save manually with the **[Save]** button. Save data is stored in your browser's `localStorage` — it persists across sessions on the same device and browser.

On the title screen, a detected save shows your character name, level, credits, and the last save time. You can continue or start a new game (which offers to delete the existing save).

---

## Controls

| Input | Action |
|-------|--------|
| Click on scene | Walk to position / interact with hotspot |
| Click exit arrow | Move to adjacent room |
| Buttons (bottom bar) | Navigate, fight, pick up items, story actions |
| Sidebar buttons | Open ARIA chat, implants, inventory |
| Click inventory item | Use consumable (in sidebar or inventory modal) |
| Enter (in ARIA chat) | Send message |

---

## Running Locally

```bash
git clone https://github.com/Camouf1age/Void_Runner-Awakening.git
cd Void_Runner-Awakening
npm install
npm run dev
```

Open [http://localhost:5173/Void_Runner-Awakening/](http://localhost:5173/Void_Runner-Awakening/)

**Build for production:**
```bash
npm run build
```

---

## Tech Stack

- **React 18** — UI and game state
- **HTML5 Canvas** — scene rendering, character animation, hotspot system
- **Vite** — build tooling
- **Claude API (Anthropic)** — ARIA live chat (claude-haiku-4-5)
- **GitHub Actions + GitHub Pages** — CI/CD and hosting
- **localStorage** — save game persistence

---

## Roadmap

- [ ] Chapter 2 — Station arc (new locations, NPCs, trading)
- [ ] More enemy types and combat abilities
- [ ] ARIA memory fragments as collectible lore items
- [ ] Sound design
- [ ] Mobile touch support improvements
- [ ] Animated room elements (sparks, engine pulse, viewport stars)
