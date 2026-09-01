# Neon City — a playable portfolio

A 3D portfolio you explore like a game. Visitors walk a neon city, and each
landmark opens a section of your portfolio.

**Everything you need to change lives in one file: [`src/config/portfolio.ts`](src/config/portfolio.ts).**

---

## Running it

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Type-check, then build to `dist/` |
| `npm run preview` | Serve the production build locally |

---

## The golden rule: empty means invisible

The city is generated from your content. **Anything you leave empty disappears** —
no placeholders, no empty grids, no landmarks to nowhere.

- One project → one full-width card, not one card and three gaps
- No `experience` entries → the Career Timeline tower is never built, and the
  city fills that plot with ordinary buildings instead
- Add your first job a year from now → the tower appears, the quest chain grows
  by one step, and the minimap updates. No other edits needed.

The quest chain, the filter chips, the minimap and the floating holograms in
the AI Lab all derive from the same config.

---

## How to…

### Add a project

Append to `projects` in the config. Only `id`, `title`, `category`, `tagline`,
`description`, `highlights` and `stack` are required.

```ts
{
  id: 'p3',
  title: 'Realtime Chat Engine',
  category: 'Fullstack',          // free text — new categories get their own filter chip
  tagline: 'One line that makes someone want to click.',
  description: 'What it does, who it is for, what made it hard.',
  highlights: ['Impact.', 'A number.', 'Something you learned.'],
  stack: ['Node.js', 'WebSockets', 'Postgres'],
  featured: true,                 // optional — featured projects orbit the AI Lab
  liveUrl: 'https://…',           // optional — button only appears if set
  repoUrl: 'https://…',           // optional
}
```

Colours are assigned automatically. Set `accent: '#22d3ee'` only if you want to
override one.

### Add a social link

`socials` is an ordered list. Add a line, get an icon.

```ts
socials: [
  { platform: 'github',    url: 'https://github.com/you' },
  { platform: 'linkedin',  url: 'https://linkedin.com/in/you' },
  { platform: 'instagram', url: 'https://instagram.com/you' },
  { platform: 'x',         url: 'https://x.com/you' },
]
```

Built-in icons: `github`, `linkedin`, `x`, `instagram`, `youtube`, `twitch`,
`discord`, `medium`, `devto`, `stackoverflow`, `dribbble`, `behance`,
`artstation`, `itch`, `website`, `email`.

**Anything else still works** — it gets a generic link icon and a tidy label, so
you can never break the site by adding a platform this list has not heard of:

```ts
{ platform: 'mastodon', url: 'https://mastodon.social/@you', label: 'Mastodon' }
```

Links appear on the start screen, in the Data Terminal panel and in the contact
panel. Remove a line and it vanishes from all three.

### Add a job, skill group or certification

Same pattern — append to `experience`, `skills` or `credentials`. Empty the
array and the matching landmark disappears from the city.

### Wire up the contact form

Two options, in `contact.formEndpoint`:

- **Leave it `''`** — the form opens the visitor's mail client with the message
  pre-filled. Zero setup, works immediately.
- **Paste an endpoint** from Formspree, Getform or Basin — the form POSTs there.

### Add your resume

Drop `resume.pdf` into `public/` and leave `links.resumeUrl` as `/resume.pdf`.
Set it to `''` to remove the download button entirely.

---

## The character model

The avatar is configured in the same `portfolio.ts` file as everything else, so
you can swap it whenever you like without touching any code.

Currently [KayKit "PrototypePete"](https://kaylousberg.itch.io/kaykit-animations) —
**CC0 (public domain), free for commercial use, no attribution required.**

```ts
character: {
  modelUrl: '/models/character.glb',
  animationUrls: [],
  height: 1.85,
  yawOffset: 0,
  clips: { idle: '', walk: '', run: '', jump: '', fall: '' },
}
```

**`.glb`, `.gltf` and `.fbx` all load directly.** No Blender, no conversion.

### Swapping in a Mixamo character

Mixamo can auto-rig a model that has no animations at all, then give you
animations for it. It gives you **one file per animation**, which is what
`animationUrls` is for.

1. Upload your model to [mixamo.com](https://www.mixamo.com) and let it auto-rig
2. Download **Idle** with **Skin: With Skin** — this file *is* your character
3. Download **Walking**, **Running**, **Jump** with **Skin: Without Skin**
   - tick **"In Place"** on Walking and Running, or the character drifts away
     from where the game thinks it is
   - FBX Binary, 30 fps, keyframe reduction: none
4. Drop them all in `public/models/` with the model's texture PNGs
5. Point the config at them:

```ts
character: {
  modelUrl: '/models/Idle.fbx',
  animationUrls: [
    '/models/Walking.fbx',
    '/models/Running.fbx',
    '/models/Jump.fbx',
    '/models/Falling Idle.fbx',   // optional but nice
  ],
}
```

### How clips are matched

Mixamo names the clip in **every** export `mixamo.com`, so matching by clip name
alone falls apart the moment you have more than one file. Clips with a
meaningless name are therefore renamed after the **file** they came from — which
is why `Running.fbx` maps itself to the run state. Keep filenames descriptive
and it configures itself.

Names are matched loosely, so `Armature|Run_01` still matches `run`. Reload and
check the browser console to see exactly what happened:

```
[portfolio] character loaded with 30 clips: [Idle, Walk, Run, Jump, ...]
[portfolio] mapped to motion states: {idle: Idle, walk: Walk, run: Run, jump: Jump}
[portfolio] model bounds 1.18 x 1.90 x 1.12, scaled by 0.974 to reach 1.85m
```

Only if a guess is wrong do you need to name a clip explicitly:

```ts
clips: { idle: 'Idle_A', walk: 'WalkFwd', run: 'Sprint', jump: '', fall: '' }
```

### Other notes

- **Scale is automatic.** Mixamo exports in centimetres, most GLB packs in
  metres; the model is fitted to `height` by its bounding box either way.
- **`yawOffset: 180`** if your character walks backwards.
- **Missing clips degrade gracefully** — no run falls back to walk, no walk falls
  back to idle.
- **If the file is missing or fails to load, a built-in blocky avatar is used
  instead.** The site never breaks.

### Where to find models

Free and clearly licensed: [KayKit](https://kaylousberg.itch.io/kaykit),
[Quaternius](https://quaternius.itch.io/), [Kenney](https://kenney.nl/assets),
or Sketchfab filtered to CC0 / CC-BY.

**Check the licence before you ship.** This page is your professional shop
window — a model ripped from a commercial game is a poor thing to have at the
centre of it, however good it looks. CC0 needs nothing; CC-BY needs visible
credit.

---

## Deploying to Vercel

It is a static Vite build, so there is no configuration to write.

1. Push the repo to GitHub.
2. On [vercel.com](https://vercel.com) → **Add New → Project** → import the repo.
3. Vercel auto-detects Vite. Confirm the defaults and deploy:
   - Build command: `npm run build`
   - Output directory: `dist`

Every push to `main` redeploys. The free tier is plenty.

Netlify, Cloudflare Pages and GitHub Pages work the same way with those two
settings.

### Performance

Measured from the actual production build, gzipped:

| | Gzipped |
| --- | --- |
| HTML + CSS + app + Framer Motion | ~89 KB |
| Three.js + R3F + postprocessing | ~293 KB |
| Character model | ~449 KB |

The start screen only needs the first row, so **your name paints in well under a
second** while the 3D engine streams in behind it. The ENTER button enables when
the engine is ready. Rough time-to-playable: ~2s on desktop broadband, ~4–6s on
a mid-range phone over 4G.

Vercel serves Brotli automatically, which trims another ~15%.

---

## Controls

| Desktop | |
| --- | --- |
| `W A S D` / arrows | Move |
| Mouse | Look (click the view to capture the pointer) |
| `Shift` | Sprint |
| `Space` | Jump |
| `E` | Interact |
| `Esc` | Pause / close a panel |
| `` ` `` | Terminal |

On touch devices a virtual stick, look pad and action buttons appear instead.

### Terminal commands

Press `` ` `` in game. `help` lists everything; `goto <zone>` warps, `open <panel>`
jumps straight to a section, `theme` and `quality` change settings, `stats` shows
progression.

---

## Project structure

```
src/
  config/portfolio.ts     ← the only file you need to edit
  systems/
    world.ts              city + landmark generation (content-driven, seeded)
    collision.ts          swept circle-vs-AABB collision, spatial grid
    input.ts              keyboard / mouse / touch, pointer lock
  components/
    canvas/               3D scene: city, player, character, landmarks, intro
    modals/               portfolio panels
    ui/                   HUD, minimap, start screen, pause, terminal
  store/useGameStore.ts   game state: XP, quests, achievements, settings
  utils/                  procedural audio, device/quality detection
```

The 3D scene is a lazy-loaded chunk, so the DOM shell renders before Three.js
arrives. There are no texture or audio files — the city, the shaders and every
sound are generated at runtime.

---

## Credits

- Character: [KayKit Character Animations](https://kaylousberg.itch.io/kaykit-animations)
  by Kay Lousberg — CC0
- Built with React, Three.js / React Three Fiber, Framer Motion, Zustand, Tailwind
