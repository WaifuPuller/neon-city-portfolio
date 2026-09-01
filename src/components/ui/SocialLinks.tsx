import React from 'react';
import {
  Github,
  Linkedin,
  Instagram,
  Youtube,
  Twitch,
  Mail,
  Globe,
  Link as LinkIcon,
  MessageCircle,
  BookOpen,
  Code2,
  Dribbble,
  Palette,
  Gamepad2,
  type LucideIcon,
} from 'lucide-react';
import { portfolio, SocialLink } from '../../config/portfolio';
import { audio } from '../../utils/audioSynth';

/* ---------------------------------------------------------------------------
 * Social links render from the `socials` array in the config.
 *
 * Adding a platform is one line. Anything without a known icon falls back to a
 * generic link glyph rather than erroring, so the config can never break the
 * site by containing something this file has not heard of.
 * ------------------------------------------------------------------------- */

const ICONS: Record<string, LucideIcon> = {
  github: Github,
  linkedin: Linkedin,
  instagram: Instagram,
  youtube: Youtube,
  twitch: Twitch,
  email: Mail,
  website: Globe,
  discord: MessageCircle,
  medium: BookOpen,
  devto: Code2,
  stackoverflow: Code2,
  dribbble: Dribbble,
  behance: Palette,
  artstation: Palette,
  itch: Gamepad2,
};

/** X has no Lucide glyph, so draw the wordmark. */
const XMark: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

/** "stackoverflow" -> "Stack Overflow"-ish. Good enough for unknown platforms. */
function prettify(platform: string): string {
  return platform
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function resolveSocial(link: SocialLink) {
  const key = link.platform.toLowerCase();
  const label = link.label ?? (key === 'x' ? 'X' : prettify(link.platform));
  return { key, label, url: link.url, Icon: ICONS[key] ?? null, isX: key === 'x' };
}

/** Only links with an actual URL, so half-filled entries never render. */
export const activeSocials = portfolio.socials.filter((s) => Boolean(s.url?.trim()));

interface IconProps {
  link: SocialLink;
  className?: string;
}

export const SocialIcon: React.FC<IconProps> = ({ link, className = 'h-[18px] w-[18px]' }) => {
  const { Icon, isX } = resolveSocial(link);
  if (isX) return <XMark className={className} />;
  const Resolved = Icon ?? LinkIcon;
  return <Resolved className={className} />;
};

interface RowProps {
  /** Include a mailto: entry built from links.email. */
  includeEmail?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

/** Compact icon row, used on the start screen and in the contact panel. */
export const SocialLinks: React.FC<RowProps> = ({
  includeEmail = false,
  size = 'md',
  className = '',
}) => {
  const items: SocialLink[] = [...activeSocials];
  if (includeEmail && portfolio.links.email) {
    items.push({ platform: 'email', url: `mailto:${portfolio.links.email}`, label: 'Email' });
  }
  if (items.length === 0) return null;

  const box = size === 'sm' ? 'h-9 w-9' : 'h-11 w-11';

  return (
    <div className={`flex flex-wrap items-center justify-center gap-3 ${className}`}>
      {items.map((link) => {
        const { label, url } = resolveSocial(link);
        return (
          <a
            key={`${link.platform}-${url}`}
            href={url}
            target={url.startsWith('mailto:') ? undefined : '_blank'}
            rel="noreferrer noopener"
            aria-label={label}
            title={label}
            onMouseEnter={() => audio.uiHover()}
            className={`glass flex ${box} items-center justify-center rounded-xl text-slate-400 transition hover:scale-110 hover:border-neon-cyan/50 hover:text-neon-cyan`}
          >
            <SocialIcon link={link} />
          </a>
        );
      })}
    </div>
  );
};

/** Detailed list with labels, used in the Data Terminal panel. */
export const SocialList: React.FC<{ accent?: string }> = ({ accent = '#60a5fa' }) => {
  const items: SocialLink[] = [...activeSocials];
  if (portfolio.links.email) {
    items.push({ platform: 'email', url: `mailto:${portfolio.links.email}`, label: 'Email' });
  }
  if (items.length === 0) return null;

  return (
    <div className={`grid gap-3 ${items.length === 1 ? '' : 'sm:grid-cols-2'}`}>
      {items.map((link) => {
        const { label, url } = resolveSocial(link);
        const display = url.replace(/^mailto:/, '').replace(/^https?:\/\/(www\.)?/, '');
        return (
          <a
            key={`${link.platform}-${url}`}
            href={url}
            target={url.startsWith('mailto:') ? undefined : '_blank'}
            rel="noreferrer noopener"
            className="clip-tag group flex items-center gap-3.5 border border-white/[0.08] bg-white/[0.025] p-4 transition hover:bg-white/[0.05]"
            style={{ borderColor: `${accent}25` }}
          >
            <span className="shrink-0 text-slate-400 transition group-hover:text-[var(--accent)]" style={{ ['--accent' as string]: accent }}>
              <SocialIcon link={link} className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block font-mono text-[9px] tracking-[0.24em] text-slate-500">
                {label.toUpperCase()}
              </span>
              <span className="block truncate text-[13px] font-bold text-slate-200">{display}</span>
            </span>
          </a>
        );
      })}
    </div>
  );
};
