import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  User,
  Code2,
  Box,
  Brain,
  Server,
  Wrench,
  Briefcase,
  Award,
  FileText,
  Download,
  ExternalLink,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { ModalShell, SectionLabel, Tag } from './ModalShell';
import { portfolio } from '../../config/portfolio';
import { SocialList } from '../ui/SocialLinks';
import { gridCols } from '../../utils/grid';

/* ============================================================ ABOUT / PROFILE */

export const AboutModal: React.FC = () => {
  const { about, identity } = portfolio;
  const [revealed, setRevealed] = useState(0);

  // Type the log lines out one at a time, like a terminal readout.
  useEffect(() => {
    if (revealed >= about.logLines.length) return;
    const t = setTimeout(() => setRevealed((r) => r + 1), 420);
    return () => clearTimeout(t);
  }, [revealed, about.logLines.length]);

  return (
    <ModalShell
      accent="#38bdf8"
      icon={<User className="h-5 w-5" />}
      title={about.heading}
      subtitle={identity.callsign}
      width="max-w-3xl"
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        {/* Avatar plate */}
        <div className="mx-auto shrink-0 sm:mx-0">
          <div
            className="clip-cyber flex h-28 w-28 items-center justify-center font-display text-3xl font-black text-void-950"
            style={{ background: 'linear-gradient(135deg,#38bdf8,#a855f7)' }}
          >
            {identity.avatarInitials}
          </div>
          <div className="mt-3 text-center font-mono text-[10px] tracking-[0.2em] text-slate-500 sm:text-left">
            {identity.location}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="font-display text-2xl font-black text-white">{identity.name}</h3>
          <p className="mt-1 font-display text-xs font-bold tracking-[0.2em] text-neon-cyan/85">
            {identity.title.toUpperCase()}
          </p>

          {about.paragraphs.map((p, i) => (
            <p key={i} className="mt-4 text-sm leading-relaxed text-slate-300">
              {p}
            </p>
          ))}
        </div>
      </div>

      {/* Fact grid — hidden entirely when there are no facts */}
      {about.facts.length > 0 && (
      <div className={`mt-7 grid gap-3 ${gridCols(about.facts.length, 4)}`}>
        {about.facts.map((f) => (
          <div key={f.label} className="clip-tag border border-white/[0.08] bg-white/[0.03] p-3.5">
            <div className="font-mono text-[9px] tracking-[0.22em] text-slate-500">
              {f.label.toUpperCase()}
            </div>
            <div className="mt-1 font-display text-sm font-bold text-white">{f.value}</div>
          </div>
        ))}
      </div>
      )}

      {/* Terminal readout — only when there are log lines to type out */}
      {about.logLines.length > 0 && (
      <div className="clip-cyber mt-7 border border-neon-cyan/20 bg-black/50 p-4 font-mono text-xs">
        <div className="mb-2 text-[10px] tracking-[0.2em] text-slate-600">
          {'>'} cat operator.log
        </div>
        {about.logLines.slice(0, revealed).map((line, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-neon-cyan/80"
          >
            <span className="text-slate-600">{String(i + 1).padStart(2, '0')} </span>
            {line}
          </motion.div>
        ))}
        {revealed < about.logLines.length && (
          <span className="inline-block h-3.5 w-2 animate-pulse bg-neon-cyan align-middle" />
        )}
      </div>
      )}
    </ModalShell>
  );
};

/* ==================================================================== SKILLS */

const SKILL_ICONS: Record<string, LucideIcon> = {
  code: Code2,
  cube: Box,
  brain: Brain,
  server: Server,
  wrench: Wrench,
};

export const SkillsModal: React.FC = () => (
  <ModalShell
    accent="#a855f7"
    icon={<Box className="h-5 w-5" />}
    title="SKILL MATRIX"
    subtitle={`${portfolio.skills.length} ${portfolio.skills.length === 1 ? 'DOMAIN' : 'DOMAINS'} SCANNED`}
    width={portfolio.skills.length === 1 ? 'max-w-xl' : 'max-w-4xl'}
  >
    <div className={`grid gap-6 ${gridCols(portfolio.skills.length, 2)}`}>
      {portfolio.skills.map((group, gi) => {
        const Icon = SKILL_ICONS[group.icon] ?? Code2;
        return (
          <motion.div
            key={group.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: gi * 0.08 }}
            className="clip-cyber border border-white/[0.08] bg-white/[0.025] p-5"
          >
            <div className="mb-4 flex items-center gap-2.5">
              <Icon className="h-4 w-4" style={{ color: group.accent }} />
              <span
                className="font-display text-[10px] font-bold tracking-[0.2em]"
                style={{ color: group.accent }}
              >
                {group.label}
              </span>
            </div>

            <div className="space-y-3.5">
              {group.skills.map((s, i) => (
                <div key={s.name}>
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <span className="text-[13px] font-bold text-slate-200">{s.name}</span>
                    <span className="font-mono text-[10px] tabular-nums text-slate-500">
                      {s.level}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${s.level}%` }}
                      transition={{ delay: gi * 0.08 + i * 0.06, duration: 0.7, ease: 'easeOut' }}
                      className="h-full rounded-full"
                      style={{
                        background: `linear-gradient(90deg, ${group.accent}88, ${group.accent})`,
                        boxShadow: `0 0 10px ${group.accent}66`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        );
      })}
    </div>
  </ModalShell>
);

/* ================================================================ EXPERIENCE */

export const ExperienceModal: React.FC = () => (
  <ModalShell
    accent="#34d399"
    icon={<Briefcase className="h-5 w-5" />}
    title="CAREER TIMELINE"
    subtitle={`${portfolio.experience.length} ${portfolio.experience.length === 1 ? 'POSITION' : 'POSITIONS'} LOGGED`}
    width="max-w-3xl"
  >
    <div className="relative pl-7">
      {/* Spine */}
      <div className="absolute bottom-2 left-[9px] top-2 w-px bg-gradient-to-b from-neon-mint via-neon-mint/40 to-transparent" />

      {portfolio.experience.map((entry, i) => (
        <motion.div
          key={entry.id}
          initial={{ opacity: 0, x: -14 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.1 }}
          className="relative pb-8 last:pb-0"
        >
          <div className="absolute -left-7 top-1.5 flex h-[19px] w-[19px] items-center justify-center rounded-full border-2 border-neon-mint bg-void-950">
            <div className="h-1.5 w-1.5 rounded-full bg-neon-mint" />
          </div>

          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="font-display text-lg font-black text-white">{entry.role}</h3>
            <span className="font-mono text-[11px] tracking-wide text-neon-mint">
              {entry.company}
            </span>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 font-mono text-[10px] tracking-[0.14em] text-slate-500">
            <span>{entry.period}</span>
            {entry.location && <span>· {entry.location}</span>}
          </div>

          <p className="mt-2.5 text-sm leading-relaxed text-slate-300">{entry.summary}</p>

          <ul className="mt-3 space-y-2">
            {entry.bullets.map((b, bi) => (
              <li key={bi} className="flex gap-2.5 text-[13px] leading-relaxed text-slate-400">
                <span className="mt-[7px] h-1 w-1 shrink-0 rotate-45 bg-neon-mint" />
                {b}
              </li>
            ))}
          </ul>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {entry.stack.map((s) => (
              <Tag key={s} color="#34d399">
                {s}
              </Tag>
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  </ModalShell>
);

/* =============================================================== CREDENTIALS */

export const CredentialsModal: React.FC = () => (
  <ModalShell
    accent="#fbbf24"
    icon={<Award className="h-5 w-5" />}
    title="ACHIEVEMENT HALL"
    subtitle="VERIFIED CREDENTIALS"
    width={portfolio.credentials.length === 1 ? 'max-w-xl' : 'max-w-3xl'}
  >
    <div className={`grid gap-3.5 ${gridCols(portfolio.credentials.length, 2)}`}>
      {portfolio.credentials.map((cert, i) => (
        <motion.div
          key={cert.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.07 }}
          className="clip-cyber group relative border border-neon-amber/20 bg-gradient-to-br from-neon-amber/[0.07] to-transparent p-5"
        >
          <div className="flex items-start gap-3.5">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-neon-amber" />
            <div className="min-w-0 flex-1">
              <h3 className="font-display text-sm font-black leading-tight text-white">
                {cert.title}
              </h3>
              <p className="mt-1 text-xs text-slate-400">{cert.issuer}</p>

              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] tracking-[0.18em] text-neon-amber/80">
                  {cert.year}
                </span>
                {cert.url ? (
                  <a
                    href={cert.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 font-mono text-[10px] text-slate-400 transition hover:text-neon-amber"
                  >
                    VERIFY <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  cert.credentialId && (
                    <span className="truncate font-mono text-[10px] text-slate-600">
                      {cert.credentialId}
                    </span>
                  )
                )}
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  </ModalShell>
);

/* ==================================================================== RESUME */

export const ResumeModal: React.FC = () => {
  const { links, identity } = portfolio;

  return (
    <ModalShell
      accent="#60a5fa"
      icon={<FileText className="h-5 w-5" />}
      title="DATA TERMINAL"
      subtitle="RESUME & EXTERNAL LINKS"
      width="max-w-2xl"
    >
      {/* Resume download — hidden entirely if no resumeUrl is configured */}
      {links.resumeUrl && (
        <div className="clip-cyber border border-neon-blue/25 bg-gradient-to-br from-neon-blue/10 to-transparent p-6 text-center">
          <FileText className="mx-auto h-10 w-10 text-neon-blue" />
          <h3 className="mt-3 font-display text-lg font-black text-white">
            {identity.name.toUpperCase()} — RESUME
          </h3>
          <p className="mx-auto mt-2 max-w-sm text-sm text-slate-400">
            Full work history, education and technical detail in a single PDF.
          </p>

          <a
            href={links.resumeUrl}
            target="_blank"
            rel="noreferrer noopener"
            download
            className="clip-tag mt-5 inline-flex items-center gap-2 bg-neon-blue px-6 py-3.5 font-display text-xs font-black tracking-[0.14em] text-void-950 transition hover:brightness-110"
          >
            <Download className="h-4 w-4" /> DOWNLOAD PDF
          </a>
        </div>
      )}

      <SectionLabel color="#60a5fa">
        <span className={links.resumeUrl ? 'mt-7 inline-block' : 'inline-block'}>
          EXTERNAL CHANNELS
        </span>
      </SectionLabel>

      <SocialList accent="#60a5fa" />
    </ModalShell>
  );
};
