/**
 * ★ EDIT THIS FILE — everything below is site copy.
 */

export const site = {
  name: 'Suchit Basineni',
  heroName: "Hi, I'm Suchit",
  tagline:
    "I'm a computer science student at Cornell University minoring in atmospheric science, building full stack systems for climate and weather data.",
  ledes: {
    projects: "Building usable tools, websites, and researching things I'm passionate about!",
    experience: 'Internships at NOAA and Commvault, and clubs at Cornell!',
    education: 'Pursuing a B.S. in Computer Science with a minor in Atmospheric Science at Cornell University.',
  },
};

export function asset(path: string): string {
  return import.meta.env.BASE_URL + path;
}

export const profile = {
  headshot: asset('profile/headshot.jpg'),
  // Temporary reverse image: replace this path when the GitHub logo is ready.
  reverseImage: asset('profile/github-avatar.png'),
  reverseAlt: 'Suchit Basineni’s GitHub avatar',
};

export interface AboutPhoto {
  src: string;
  alt: string;
  caption?: string;
}

export interface AboutFact {
  label: string;
  value: string;
}

const noFacts: AboutFact[] = [];

/**
 * About: one lede sentence set large, then body paragraphs, then a short
 * "at a glance" list. Keep the lede to one or two sentences; facts read best
 * as 3–5 short rows (leave `facts` empty to hide the list).
 */
export const about = {
  lede: 'I’m a Computer Science student at Cornell, minoring in Atmospheric Science, and I’m originally from New Jersey. I like building full-stack apps and data pipelines that make weather data easier to use.',
  paragraphs: [
    'This past summer, I did research at NOAA, evaluating how well hurricane models forecast rainfall at landfall. From this research, I’ve grown interested in optimization by reducing runtime for HPC workflows and faster live-image rendering. Lately, I’ve been spending most of my time on machine learning and AI agents. I’m especially interested in AI weather models, like GraphCast’s graph neural networks and diffusion models like GenCast, and how they are making forecasts more accurate.',
    'Outside of coding, I’m an Eagle Scout and received the Congressional Award Gold Medal for over 400 hours of service. For my previous research work, I was named a Regeneron Science Talent Search Scholar, specifically researching the impact that climate oscillations have on the intensity and frequency of North Atlantic Hurricanes. In my free time, I like to hike, hang out with friends, cook, paint, and photograph and track storms, whether they’re in my backyard or across the country.',
  ],
  facts: noFacts,
  /**
   * The throwable photo stack beside About, top print first. Photos are 4:3
   * (960×720 WebP in public/about/). `caption` shows on the print's bottom
   * strip on hover or focus; leave it empty for a plain strip.
   */
  photos: [
    {
      src: asset('about/noaa-aoml.webp'),
      alt: 'Suchit with mentors Dr. Gopal and Dr. Hazelton outside NOAA’s Atlantic Oceanographic and Meteorological Laboratory',
      caption: 'My Mentors Dr. Gopal and Dr. Hazelton while interning at NOAA/AOML this summer!',
    },
    {
      src: asset('about/tropical-briefing.webp'),
      alt: 'Suchit presenting a satellite view of the Atlantic to a room of NOAA staff',
      caption: 'Leading a Tropical Weather Map Discussion!',
    },
    {
      src: asset('about/data-journal-poster.webp'),
      alt: 'Suchit and a teammate beside their FindMyNuclearWaste research poster',
      caption: 'Cornell Data Journal Symposium!',
    },
    {
      src: asset('about/geodata.webp'),
      alt: 'Suchit with the Cornell University GeoData team on a campus staircase, in matching CU GeoData fleeces',
      caption: 'Cornell University GeoData',
    },
    {
      src: asset('about/weather-kiosk.webp'),
      alt: 'Suchit beside a finished weather education kiosk with a weather station on top',
      caption: 'Completed Informational Weather Kiosk!',
    },
    {
      src: asset('about/kiosk-build.webp'),
      alt: 'Suchit in a scout uniform holding a weather display in front of the kiosk frame',
      caption: 'Eagle Scout Project Construction!',
    },
    {
      src: asset('about/eagle-scout.webp'),
      alt: 'Suchit in a scout uniform and merit badge sash, standing beside an American flag',
      caption: 'Officially Becoming an Eagle Scout!',
    },
  ] satisfies AboutPhoto[],
};

export interface Project {
  group: 'software' | 'research';
  title: string;
  description: string;
  tech: string[];
  link?: string;
  repo?: string;
  /** A deck about the project, e.g. hackathon slides. */
  slides?: string;
  cover?: string;
  /** A screenshot that rises into the cover on hover (16:10, in public/projects/). */
  preview?: string;
  accent?: string;
  year?: string;
}

// SAFETY: Preserve literal labels while checking that every project group is covered.
export const projectGroups = {
  software: 'Software',
  research: 'Research',
} as const satisfies Record<Project['group'], string>;

// Keep each group together: a label is drawn wherever the group changes.
export const projects: Project[] = [
  {
    group: 'software',
    title: 'Forecast Graphics',
    year: '2026',
    accent: '#1f5fbf',
    preview: asset('projects/nws-graphics.webp'),
    description:
      "Forecast maps for every National Weather Service office and each region. Each office features live conditions and alerts, the next three days of temperature, wind, rain, and severe weather risk, and current atmospheric conditions.",
    tech: ['TypeScript', 'Next.js', 'Python', 'Cloudflare R2'],
    link: 'https://nws-graphics.vercel.app',
    repo: 'https://github.com/SBasineni1/NWSGraphics',
  },
  {
    group: 'software',
    title: 'EdgeCast',
    year: '2026',
    accent: '#0f7a4a',
    preview: asset('projects/edgecast.webp'),
    description:
      "A forecasting tool for Kalshi's daily temperature markets. It blends the HRRR, GFS, and NBM weather models into one forecast for each of 20 U.S. cities, which then determines the most likely high or low temperature range.",
    tech: ['Python', 'FastAPI', 'LightGBM', 'SQLite', 'React'],
    link: 'https://edge-cast-iota.vercel.app',
    repo: 'https://github.com/SBasineni1/EdgeCast',
  },
  {
    group: 'software',
    title: 'Helicity',
    year: '2026',
    accent: '#6a3fb5',
    preview: asset('projects/helicity.webp'),
    description:
      "A risk tool that scores how safe each stablecoin's reserves are, using financial, banking, geographic, and weather data. It tracks which banks hold each coin's reserves, so an issue at one bank will impact all stablecoins attached to it.",
    tech: ['Python', 'FastAPI', 'React', 'NetworkX', 'Claude API'],
    repo: 'https://github.com/AI-HackathonNYC/helicity',
    slides: 'https://ai-hackathonnyc.github.io/helicity/',
    link: 'https://helicity-theta.vercel.app',
  },
  {
    group: 'software',
    title: 'Saffral',
    year: '2026',
    accent: '#c8641a',
    description:
      "A monitor that watches AI agents as they run and warns you when one gets stuck or starts wasting tokens. It sits locally between the agent and its API, so prompts, code, and keys are never vulnerable.",
    tech: ['Python', 'Rust', 'NumPy', 'pytest'],
    repo: 'https://github.com/saffral-ai/core',
  },
];

export interface ExperienceEntry {
  group: 'work' | 'club';
  role: string;
  org: string;
  dates: string;
  bullets: string[];
  summary: string;
  tech?: string[];
  /** Photograph behind the whole card. */
  cover?: string;
  /** The organisation's mark, shown on a white tile beside its name. */
  logo?: string;
  /** Something to read, e.g. a published article. */
  link?: { href: string; label: string };
  accent?: string;
  location?: string;
}

// SAFETY: Preserve literal labels while checking that every experience group is covered.
export const experienceGroups = {
  work: 'Work',
  club: 'Clubs',
} as const satisfies Record<ExperienceEntry['group'], string>;

export const experience: ExperienceEntry[] = [
  {
    group: 'work',
    role: 'Software Engineering Intern',
    org: 'NOAA AOML',
    cover: asset('experience/noaa-aoml.webp'),
    logo: asset('experience/logos/noaa.svg'),
    dates: 'May 2026 — Aug 2026',
    location: 'Virginia Key, FL',
    summary:
      'Per-storm framework verifying HAFS rainfall forecasts against observational data',
    bullets: [
      'Built a configuration-based Python framework (xarray, NumPy, SciPy) that ingests HAFS hurricane model output, regrids it to radar observations, and scores rainfall accuracy across 20 landfalling storms.',
      'Parallelized scoring with worker pools and caching on the HPC, saving ~30 minutes per storm, and trained a SnapBoost model relating forecast cycle to accuracy across HAFS-A, HAFS-B, and HAFS-Multistorm.',
      'Briefed 50 staff on active storm guidance at the Tropical Map Discussion.',
    ],
    tech: ['Python', 'Linux', 'SciPy', 'HPC'],
  },
  {
    group: 'work',
    role: 'Software Engineering Intern',
    org: 'Commvault',
    cover: asset('experience/commvault.webp'),
    logo: asset('experience/logos/commvault.svg'),
    dates: 'Sep 2024 — Jan 2025',
    location: 'Tinton Falls, NJ',
    summary:
      'Secure credential storage and automated data recovery workflows',
    bullets: [
      'Redesigned user credential workflows to store data securely in Commvault Cloud instead of text files, restructuring SQL queries to cut runtime by 30%.',
      'Built and owned an automated data recovery workflow end to end, reducing average recovery time from 2 hours to 10 minutes and eliminating ~15 customer support tickets weekly.',
    ],
    tech: ['SQL', 'Java'],
  },
  {
    group: 'club',
    role: 'Team Lead',
    org: 'Cornell Data Journal',
    cover: asset('experience/data-journal.webp'),
    logo: asset('experience/logos/data-journal.png'),
    link: { href: 'https://cornelldatajournal.org/articles/nuclear-waste', label: 'Read Articles' },
    dates: 'Sep 2025 — Present',
    location: 'Ithaca, NY',
    summary:
      'Mapping nuclear waste sites and severe weather warning false alarm rates',
    bullets: [
      'Built a full-stack REST API web app that processes ~200K NWS severe weather reports (2008–2025) and maps false alarm rates in 114 areas.',
      'Led a geospatial regression analysis of ~90 U.S. nuclear waste sites against census income data, published with an interactive map.',
    ],
    tech: ['Python', 'HTML/CSS'],
  },
  {
    group: 'club',
    role: 'Team Member',
    org: 'Cornell GeoData',
    cover: asset('experience/geodata.webp'),
    logo: asset('experience/logos/geodata.png'),
    dates: 'Nov 2025 — Present',
    location: 'Ithaca, NY',
    summary:
      'Building a Cayuga Lake-effect snow ML model & building custom data loggers',
    bullets: [
      'Engineered a modular Raspberry Pi data-logging system that streams live sensor data to a dashboard and cut data collection costs 75%.',
      'Integrated a 5-sensor probe (turbidity, TDS, pressure, temperature, pH) to monitor Cayuga Lake for algal blooms, now deploying on a buoy.',
      'Contributed to an ML classification pipeline that detects lake-effect snow events from 9 winters (2015–2024) of airport and HRRR data.',
    ],
    tech: ['Python', 'Raspberry Pi', 'Machine Learning'],
  },
];

export interface EducationEntry {
  school: string;
  degree?: string;
  /** A second line under the degree, e.g. the minor. */
  minor?: string;
  dates?: string;
  notes?: string;
  location?: string;
  description?: string;
  /** Set as one comma-separated line, like a transcript. */
  courses?: string[];
  cover?: string;
  /** Several photographs for the cover, crossfaded in turn (the first entry only). */
  photos?: AboutPhoto[];
  /** Title set over those photographs; each photo's `caption` sits under it. */
  photosTitle?: string;
  logo?: string;
  accent?: string;
}

export const education: EducationEntry[] = [
  {
    school: 'Cornell University',
    degree: 'B.S. Computer Science',
    minor: 'Minor in Atmospheric Science',
    dates: 'Expected May 2028',
    location: 'Ithaca, NY',
    description: 'David A. Duffield College of Engineering and Ann S. Bowers College of Computing and Information Science.',
    courses: [
      'Intro to Machine Learning',
      'Functional Programming & Data Structures',
      'Discrete Math',
      'Object-Oriented Programming & Data Structures',
      'Linear Algebra',
      'Python Design & Development',
      'Atmospheric Thermodynamics & Hydrostatics',
    ],
    photosTitle: 'Scenes around Cornell!',
    photos: [
      { src: asset('education/cayuga-sunset.webp'), alt: 'Sunset over Cornell and Cayuga Lake', caption: 'Scenes over Cornell & Cayuga Lake' },
      { src: asset('education/mcgraw-storm.webp'), alt: 'A shelf cloud moving over McGraw Tower and Central Campus', caption: 'Shelf Cloud moving through Central Campus' },
      { src: asset('education/aurora.webp'), alt: 'The aurora glowing pink and green over campus at night', caption: 'Aurora!' },
      { src: asset('education/quad-sunset.webp'), alt: 'Pink and orange clouds at sunset over North Campus', caption: 'A Tropical Sunset over North Campus' },
      { src: asset('education/campus-storm.webp'), alt: 'A night thunderstorm lighting up the clouds over the Slope', caption: 'Thunderstorm Rolling through the Slope' },
      { src: asset('education/frozen-gorge.webp'), alt: 'A frozen lake and icy waterfall in a snowy gorge', caption: 'A Frozen Lake and Icy Waterfall' },
      { src: asset('education/winter-sunset.webp'), alt: 'A winter sunset over West Campus', caption: 'Sunset over West Campus' },
      { src: asset('education/snowy-slope-sunset.webp'), alt: 'An orange winter sunset over the snowy Slope', caption: 'A Wintery Sunset over the Slope' },
      { src: asset('education/forest-home-storm.webp'), alt: 'Dark rain clouds over North Campus', caption: 'A Brief Shower over North Campus' },
      { src: asset('education/gorge-falls.webp'), alt: 'A small waterfall over layered shale in Robert H. Treman State Park', caption: 'A Small Waterfall in Robert H. Treman State Park' },
    ],
  },
  {
    school: 'High Technology High School',
    location: 'Lincroft, NJ',
  },
];

export const contact = {
  email: 'basineni.suchit@gmail.com',
  schoolEmail: 'ssb278@cornell.edu',
  github: 'SBasineni1',
  linkedin: 'suchit-basineni',
  x: 'suchit_wx',
};

/** Altitude band for each section, in metres. Drives layout and the tape. */
export interface Band {
  id: string;
  label: string;
  altitude: number;
  from: number;
  to: number;
  layer: string;
}

export const bands: Band[] = [
  { id: 'about', label: 'About', altitude: 260, from: 0, to: 900, layer: 'Surface' },
  { id: 'projects', label: 'Projects', altitude: 8000, from: 6000, to: 10000, layer: 'Troposphere' },
  { id: 'experience', label: 'Experience', altitude: 15000, from: 12000, to: 18000, layer: 'Tropopause' },
  { id: 'education', label: 'Education', altitude: 23000, from: 20000, to: 26000, layer: 'Stratosphere' },
  { id: 'contact', label: 'Contact', altitude: 34600, from: 30000, to: 35000, layer: 'Space' },
];
