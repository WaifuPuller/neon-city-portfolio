import { Project } from '../config/portfolio';

/**
 * Accent colour for a project.
 *
 * `accent` is optional in the config so you never have to think about colour
 * when adding a project. When it is absent one is assigned from the neon
 * palette by position, which keeps a list of projects visually distinct
 * without any configuration.
 */
const PALETTE = ['#22d3ee', '#f472b6', '#a855f7', '#fbbf24', '#34d399', '#60a5fa'];

export function projectAccent(project: Pick<Project, 'accent'>, index: number): string {
  return project.accent || PALETTE[index % PALETTE.length];
}

export { PALETTE as ACCENT_PALETTE };
