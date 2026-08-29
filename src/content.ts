/**
 * ★ EDIT THIS FILE — everything below is site copy.
 *
 * Real values are already filled in for name, email and GitHub. Everything
 * marked `// TODO: replace` is a placeholder.
 */

export const site = {
  name: 'Suchit Basineni',
  tagline: 'Atmospheric-scale software, launched from the ground up.', // TODO: replace
  flight: 'SB-01', // TODO: replace — mission designator shown in the header
};

export const about = {
  paragraphs: [
    'Placeholder: one paragraph on who you are and the kind of problems you like to work on.', // TODO: replace
    'Placeholder: a second paragraph on how you work — tools, disciplines, what you are chasing next.', // TODO: replace
  ],
};

export interface Project {
  title: string;
  description: string;
  tech: string[];
  link?: string;
  repo?: string;
}

export const projects: Project[] = [
  {
    title: 'Project One', // TODO: replace
    description: 'Placeholder: one or two sentences on what it does and why it exists.', // TODO: replace
    tech: ['TypeScript', 'Canvas'], // TODO: replace
    repo: 'https://github.com/suchitbasineni', // TODO: replace
  },
  {
    title: 'Project Two', // TODO: replace
    description: 'Placeholder: one or two sentences on what it does and why it exists.', // TODO: replace
    tech: ['Python', 'Data'], // TODO: replace
    link: 'https://example.com', // TODO: replace
  },
  {
    title: 'Project Three', // TODO: replace
    description: 'Placeholder: one or two sentences on what it does and why it exists.', // TODO: replace
    tech: ['Embedded', 'Telemetry'], // TODO: replace
  },
];

export interface ExperienceEntry {
  role: string;
  org: string;
  dates: string;
  bullets: string[];
}

export const experience: ExperienceEntry[] = [
  {
    role: 'Role Title', // TODO: replace
    org: 'Organisation', // TODO: replace
    dates: '2024 — Present', // TODO: replace
    bullets: [
      'Placeholder: what you shipped and the measurable result.', // TODO: replace
      'Placeholder: a second contribution worth naming.', // TODO: replace
    ],
  },
  {
    role: 'Earlier Role', // TODO: replace
    org: 'Organisation', // TODO: replace
    dates: '2023 — 2024', // TODO: replace
    bullets: ['Placeholder: what you owned and what changed because of it.'], // TODO: replace
  },
];

export interface EducationEntry {
  school: string;
  degree: string;
  dates: string;
  notes?: string;
}

export const education: EducationEntry[] = [
  {
    school: 'University Name', // TODO: replace
    degree: 'B.S. in Something', // TODO: replace
    dates: '2022 — 2026', // TODO: replace
    notes: 'Placeholder: coursework, research group, or an award worth listing.', // TODO: replace
  },
];

export const contact = {
  email: 'basineni.suchit@gmail.com',
  github: 'suchitbasineni',
  linkedin: '', // TODO: replace with a LinkedIn handle, or leave empty to hide
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
  { id: 'contact', label: 'Contact', altitude: 34600, from: 30000, to: 35000, layer: 'Near space' },
];
