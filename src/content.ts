/**
 * ★ EDIT THIS FILE — everything below is site copy.
 */

export const site = {
  name: 'Suchit Basineni',
  heroName: "Hi, I'm Suchit",
  tagline:
    "I'm a computer science student at Cornell University minoring in atmospheric science, building full stack systems for climate and weather data.",
  ledes: {
    projects: 'Weather models, markets, and AI agents, turned into tools you can open and use.',
    experience: 'Internships at NOAA and Commvault, and two project teams at Cornell.',
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

/**
 * About: one lede sentence set large, then body paragraphs, then a short
 * "at a glance" list. Keep the lede to one or two sentences; facts read best
 * as 3–5 short rows (leave `facts` empty to hide the list).
 */
export const about = {
  lede: "I'm a Computer Science student at Cornell minoring in Atmospheric Science, originally from Marlboro, NJ. I like building full stack apps and data pipelines that make weather data easier to use.",
  paragraphs: [
    "Lately I've been spending most of my time on forecast verification, from scoring hurricane rainfall forecasts at NOAA this past summer to EdgeCast, a model blend that prices Kalshi temperature markets. I'm also building Saffral, a tool that catches AI agents wasting tokens. At Cornell I lead a team at Cornell Data Journal and help build a water-quality buoy for Cayuga Lake with Cornell GeoData. I'm always looking for ways to use what I learn in class on real weather problems.",
    "Outside of code, I'm an Eagle Scout. For my Eagle project I built a weather education kiosk, complete with its own weather station, and I've put in over 400 hours of community service along the way. I got into weather research in high school, with projects on tornado formation and North Atlantic hurricanes, and these days I'm building a 3D-printed weather station that logs its readings to a Raspberry Pi.",
  ],
  facts: [
    { label: 'Studying', value: 'Computer Science, Cornell University' },
    { label: 'Currently', value: 'Building EdgeCast and Saffral' },
    { label: 'Based in', value: 'Ithaca, NY' },
  ],
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
  title: string;
  description: string;
  tech: string[];
  link?: string;
  repo?: string;
  cover?: string;
  accent?: string;
  year?: string;
}

export const projects: Project[] = [
  {
    title: 'EdgeCast',
    year: '2026',
    description:
      'Blends the HRRR, GFS, and NBM weather models to price Kalshi temperature markets in 20 U.S. cities. Bias correction and a LightGBM layer bring average forecast error down from 2.07°F to 1.67°F.',
    tech: ['Python', 'FastAPI', 'LightGBM', 'SQLite', 'React'],
    link: 'https://edge-cast-iota.vercel.app',
    repo: 'https://github.com/SBasineni1/EdgeCast',
  },
  {
    title: 'NWS Forecast Graphics',
    year: '2026',
    description:
      "3-day temperature, wind, rain, and severe-risk maps for all 121 National Weather Service offices, drawn on canvas from gridpoint data. A scheduled GitHub Actions job precomputes every office's forecast to Cloudflare R2, so pages load without waiting on live API calls.",
    tech: ['TypeScript', 'Next.js', 'Python', 'Cloudflare R2'],
    link: 'https://nws-graphics.vercel.app',
    repo: 'https://github.com/SBasineni1/NWSGraphics',
  },
  {
    title: 'Saffral',
    year: '2026',
    description:
      'Local-first monitoring that flags stuck or wasteful AI-agent runs before they burn through tokens and money. A pass-through proxy feeds agent HTTP/SSE traffic to a failure-prediction model without exposing prompts, code, or keys.',
    tech: ['Python', 'Rust', 'NumPy', 'pytest'],
    repo: 'https://github.com/saffral-ai/core',
  },
  {
    title: 'Helicity',
    year: '2026',
    description:
      'Scores stablecoin reserve risk from financial, banking, geographic, and weather data. Coins, issuers, and banks live in a NetworkX graph, so one failing bank flags every exposed coin, and Claude and Gemini audit the scores over MCP.',
    tech: ['Python', 'FastAPI', 'React', 'NetworkX', 'Claude API'],
    repo: 'https://github.com/AI-HackathonNYC/helicity',
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
