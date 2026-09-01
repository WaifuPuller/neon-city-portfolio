/* ============================================================================
 *  EDIT THIS FILE — IT IS THE ONLY FILE YOU NEED TO CHANGE
 * ----------------------------------------------------------------------------
 *  Everything in the game reads from this object: the 3D city, the panels, the
 *  terminal, the start screen. It is designed to grow with you.
 *
 *  THE RULE: anything you leave empty simply disappears.
 *    - One project?  You get one card, not one card and three placeholders.
 *    - No experience yet? The Career Timeline tower never spawns, and the city
 *      fills that plot with buildings instead.
 *    - Add your third job in a year's time and it comes back automatically.
 *
 *  Nothing here is positional or index-based, so you can add, remove and
 *  reorder entries freely without touching any other file.
 * ========================================================================== */

/* --------------------------------------------------------------- SOCIAL LINKS */

/**
 * Platforms with a built-in icon. Anything NOT on this list still works — it
 * just gets a generic link icon, so you can never break the site by adding
 * something unexpected.
 */
export type SocialPlatform =
  | 'github'
  | 'linkedin'
  | 'x'
  | 'instagram'
  | 'youtube'
  | 'twitch'
  | 'discord'
  | 'medium'
  | 'devto'
  | 'stackoverflow'
  | 'dribbble'
  | 'behance'
  | 'artstation'
  | 'itch'
  | 'website'
  | 'email';

export interface SocialLink {
  /** Any string. Known values above get a matching icon. */
  platform: SocialPlatform | (string & {});
  url: string;
  /** Optional. Defaults to a tidy version of `platform`. */
  label?: string;
}

/* -------------------------------------------------------------------- TYPES */

export interface Project {
  id: string;
  title: string;
  /** Free text. The filter chips build themselves from whatever you use. */
  category: string;
  tagline: string;
  description: string;
  highlights: string[];
  stack: string[];
  featured?: boolean;
  liveUrl?: string;
  repoUrl?: string;
  /** Accent colour for this project's hologram in the AI Lab. */
  accent?: string;
}

export interface ExperienceEntry {
  id: string;
  role: string;
  company: string;
  period: string;
  location?: string;
  summary?: string;
  bullets: string[];
  stack: string[];
}

export interface SkillGroup {
  id: string;
  label: string;
  icon: 'code' | 'cube' | 'brain' | 'server' | 'wrench';
  accent: string;
  skills: { name: string; level: number }[];
}

export interface Credential {
  id: string;
  title: string;
  issuer: string;
  year: string;
  credentialId?: string;
  url?: string;
}

/* ========================================================================== */

export const portfolio = {
  /* ---------------------------------------------------------------- IDENTITY */
  identity: {
    name: 'YOUR NAME',
    callsign: 'CYBER_ARCHITECT', // your in-game handle, shown on the HUD
    title: 'Full-Stack & 3D Web Developer',
    tagline: 'I build immersive interfaces where the web feels like a world.',
    location: 'Your City, Country',
    availability: 'Open to opportunities',
    avatarInitials: 'YN',
  },

  /* ------------------------------------------------------------------- ABOUT */
  // Leave `paragraphs` empty to remove the Operator Profile landmark entirely.
  about: {
    heading: 'OPERATOR PROFILE',
    paragraphs: [
      'Write two or three sentences about who you are, what you love building, and what problem you like solving. Keep it human, this is the first thing a recruiter reads.',
      'Mention the kind of work you want next: the stack, the team size, the domain. Specificity is what makes a portfolio memorable.',
    ],
    // Add or remove freely — the grid reflows to fit.
    facts: [
      { label: 'Focus', value: '3D Web / AI Interfaces' },
      { label: 'Experience', value: 'X+ years' },
      { label: 'Timezone', value: 'GMT+0' },
      { label: 'Status', value: 'Available' },
    ],
    // Optional flavour, typed out one line at a time. Empty array hides it.
    logLines: [
      'Started coding at age __.',
      'Favourite tool: __.',
      'Currently learning: __.',
      'Ask me about: __.',
    ],
  },

  /* ------------------------------------------------------------------- LINKS */
  links: {
    email: 'you@example.com',
    /** Put resume.pdf in the /public folder. Set to '' to hide the download. */
    resumeUrl: '/resume.pdf',
  },

  /**
   * Add a line, get an icon. Remove a line, it disappears. Order here is the
   * order on screen. Unknown platforms get a generic link icon rather than
   * breaking, so future-you can add anything.
   */
  socials: [
    { platform: 'github', url: 'https://github.com/yourhandle' },
    { platform: 'linkedin', url: 'https://linkedin.com/in/yourhandle' },

    // ---- Uncomment (or add) any of these whenever you want them ----
    // { platform: 'instagram', url: 'https://instagram.com/yourhandle' },
    // { platform: 'x',         url: 'https://x.com/yourhandle' },
    // { platform: 'youtube',   url: 'https://youtube.com/@yourhandle' },
    // { platform: 'itch',      url: 'https://yourhandle.itch.io' },
    // { platform: 'website',   url: 'https://yourdomain.com' },
    // Anything unlisted works too — it just gets a generic icon:
    // { platform: 'mastodon',  url: 'https://mastodon.social/@you', label: 'Mastodon' },
  ] as SocialLink[],

  /* ------------------------------------------------------------------ SKILLS */
  // Empty array removes the Skill Matrix landmark from the city.
  skills: [
    {
      id: 'frontend',
      label: 'FRONTEND ENGINEERING',
      icon: 'code',
      accent: '#22d3ee',
      skills: [
        { name: 'React / Next.js', level: 92 },
        { name: 'TypeScript', level: 88 },
        { name: 'Tailwind CSS', level: 90 },
        { name: 'Framer Motion', level: 84 },
      ],
    },
    {
      id: 'threed',
      label: '3D & REAL-TIME GRAPHICS',
      icon: 'cube',
      accent: '#a855f7',
      skills: [
        { name: 'Three.js / R3F', level: 86 },
        { name: 'GLSL Shaders', level: 70 },
        { name: 'Blender', level: 64 },
        { name: 'Game Physics', level: 72 },
      ],
    },
    {
      id: 'ai',
      label: 'AI & AUTOMATION',
      icon: 'brain',
      accent: '#f472b6',
      skills: [
        { name: 'LLM Integration', level: 82 },
        { name: 'Agentic Workflows', level: 76 },
        { name: 'Python', level: 80 },
        { name: 'Vector Search', level: 68 },
      ],
    },
    {
      id: 'backend',
      label: 'BACKEND & INFRA',
      icon: 'server',
      accent: '#34d399',
      skills: [
        { name: 'Node.js', level: 85 },
        { name: 'PostgreSQL', level: 78 },
        { name: 'REST / GraphQL', level: 82 },
        { name: 'Docker / CI', level: 70 },
      ],
    },
  ] as SkillGroup[],

  /* ---------------------------------------------------------------- PROJECTS */
  // Start with one. Add more whenever you ship them — the grid, the filter
  // chips and the floating holograms in the AI Lab all adapt automatically.
  projects: [
    {
      id: 'p1',
      title: 'Project One',
      category: '3D / WebGL',
      tagline: 'One line that makes someone want to click.',
      description:
        'What it does, who it is for, and what made it hard. Two sentences is plenty, the highlights below carry the detail.',
      highlights: [
        'The single most impressive thing you achieved.',
        'A number if you have one: users, latency, scale.',
        'Something you learned or invented along the way.',
      ],
      stack: ['React', 'Three.js', 'TypeScript'],
      featured: true,
      liveUrl: '',
      repoUrl: '',
    },
    {
      id: 'p2',
      title: 'Project Two',
      category: 'AI / Agents',
      tagline: 'One line that makes someone want to click.',
      description:
        'What it does, who it is for, and what made it hard. Keep it concrete and avoid buzzwords.',
      highlights: [
        'The single most impressive thing you achieved.',
        'A number if you have one.',
        'A tradeoff you made deliberately.',
      ],
      stack: ['Python', 'LangChain', 'Next.js'],
      featured: true,
      liveUrl: '',
      repoUrl: '',
    },
  ] as Project[],

  /* -------------------------------------------------------------- EXPERIENCE */
  // Empty array removes the Career Timeline landmark. Add your first job and
  // it reappears, no other changes needed.
  experience: [
    {
      id: 'e1',
      role: 'Your Role',
      company: 'Company Name',
      period: '2024 — Present',
      location: 'Remote',
      summary: 'One sentence on your remit and the team you worked with.',
      bullets: [
        'An achievement with a measurable outcome.',
        'A system you owned end to end.',
        'Something you improved for the people around you.',
      ],
      stack: ['React', 'TypeScript', 'Node.js'],
    },
  ] as ExperienceEntry[],

  /* ------------------------------------------------------------- CREDENTIALS */
  // Empty array removes the Achievement Hall landmark.
  credentials: [
    { id: 'c1', title: 'Certification Name', issuer: 'Issuing Body', year: '2025', credentialId: '', url: '' },
  ] as Credential[],

  /* ----------------------------------------------------------------- CONTACT */
  contact: {
    heading: 'OPEN A CHANNEL',
    blurb:
      'Tell me about the role, the product, or the problem. I read everything and reply within a couple of days.',
    /**
     * Where the form sends.
     *  '' → opens the visitor's mail client with the message pre-filled (zero setup)
     *  URL → POSTs there instead (Formspree / Getform / Basin all work)
     */
    formEndpoint: '',
  },

  /* ------------------------------------------------- SECRET AREA (EASTER EGG) */
  secret: {
    title: 'THE VAULT',
    body: 'Write whatever you like here: a personal note, an unreleased project, a thank-you to whoever explored the whole map. This only unlocks after all five Data Cores are found.',
    signoff: 'Thanks for exploring the whole city.',
  },

  /* ------------------------------------------------------------------- INTRO */
  /**
   * The short cinematic camera fly-in shown after pressing ENTER.
   *
   *   enabled: false      -> skip it entirely, spawn straight into the city
   *   durationSeconds: 3  -> how long it lasts, start to finish
   *
   * It is timed against the wall clock, so it takes the same real-world time
   * on a slow machine as a fast one. Visitors can always skip it with a click
   * or any key.
   */
  intro: {
    enabled: true,
    durationSeconds: 3,
  },

  /* --------------------------------------------------------------- CHARACTER */
  /**
   * The avatar you walk around as. Swap it whenever you like — this works the
   * same way as everything else in this file: change the values, drop the
   * files in /public/models, done. No other file needs touching.
   *
   * SUPPORTED FORMATS: .glb, .gltf and .fbx all load directly. No Blender,
   * no conversion.
   *
   * ---------------------------------------------------------------------------
   * SWAPPING IN A MIXAMO CHARACTER
   * ---------------------------------------------------------------------------
   *  1. Upload a model to mixamo.com and let it auto-rig.
   *  2. Download "Idle" with Skin: With Skin      → this IS your character
   *     Download Walking / Running / Jump         → Skin: Without Skin
   *     (tick "In Place" on Walking and Running)
   *  3. Drop them all in /public/models/ along with the model's texture PNGs.
   *  4. Point modelUrl at the With Skin file and list the rest in animationUrls.
   *
   * Mixamo names every single clip "mixamo.com", so clips from extra files are
   * named after their FILENAME instead: Running.fbx becomes the "run" state.
   * Keep the filenames descriptive and it maps itself.
   * ------------------------------------------------------------------------- */
  character: {
    /**
     * The character mesh. Leave as '' to use the built-in blocky avatar.
     * If this file also contains animations (like the current one), they are
     * picked up automatically and animationUrls can stay empty.
     */
    modelUrl: '/models/character.glb',

    /**
     * Optional extra animation files, for when the clips live separately from
     * the mesh — which is exactly what Mixamo gives you.
     *
     * Example once you have a Mixamo character:
     *   modelUrl: '/models/Idle.fbx',
     *   animationUrls: [
     *     '/models/Walking.fbx',
     *     '/models/Running.fbx',
     *     '/models/Jump.fbx',
     *     '/models/Falling Idle.fbx',
     *   ],
     */
    animationUrls: [] as string[],

    /** The model is auto-scaled to this height in world units (~metres). */
    height: 1.85,

    /** Set to 180 if your character walks backwards. */
    yawOffset: 0,

    /**
     * Clip names are matched loosely, so most packs need nothing here. Open the
     * browser console — the loader prints every clip it found and how it mapped
     * them. Only fill these in if a guess came out wrong.
     */
    clips: {
      idle: '',
      walk: '',
      run: '',
      jump: '',
      /** Optional. Played while airborne and falling, if your pack has one. */
      fall: '',
    },
  },
} as const;

export type Portfolio = typeof portfolio;

/* --------------------------------------------------------------- DERIVED ---
 * Convenience flags used to decide which landmarks exist in the city.
 * ------------------------------------------------------------------------- */

export const has = {
  about: portfolio.about.paragraphs.length > 0,
  skills: portfolio.skills.length > 0,
  projects: portfolio.projects.length > 0,
  experience: portfolio.experience.length > 0,
  credentials: portfolio.credentials.length > 0,
  contact: Boolean(portfolio.links.email) || Boolean(portfolio.contact.formEndpoint),
  resume: Boolean(portfolio.links.resumeUrl) || portfolio.socials.length > 0,
};
