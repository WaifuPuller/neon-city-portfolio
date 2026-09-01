import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cpu, ExternalLink, Github, ArrowLeft, Star, ChevronRight } from 'lucide-react';
import { ModalShell, SectionLabel, Tag } from './ModalShell';
import { portfolio, Project } from '../../config/portfolio';
import { audio } from '../../utils/audioSynth';
import { projectAccent } from '../../utils/accent';
import { gridCols } from '../../utils/grid';

const ProjectDetail: React.FC<{ project: Project; accent: string; onBack: () => void }> = ({
  project,
  accent,
  onBack,
}) => (
  <motion.div
    key={project.id}
    initial={{ opacity: 0, x: 30 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -20 }}
    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
  >
    <button
      onClick={onBack}
      className="mb-5 inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.16em] text-slate-400 transition hover:text-neon-cyan"
    >
      <ArrowLeft className="h-3.5 w-3.5" /> ALL PROJECTS
    </button>

    {/* Hero band */}
    <div
      className="clip-cyber relative overflow-hidden p-6 sm:p-8"
      style={{
        background: `linear-gradient(135deg, ${accent}22, transparent 65%)`,
        border: `1px solid ${accent}33`,
      }}
    >
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-25 blur-3xl"
        style={{ background: accent }}
      />

      <div className="relative">
        <Tag color={accent}>{project.category.toUpperCase()}</Tag>
        <h3 className="mt-3 font-display text-2xl font-black leading-tight text-white sm:text-3xl">
          {project.title}
        </h3>
        <p className="mt-2 text-base text-slate-300">{project.tagline}</p>
      </div>
    </div>

    <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
      <div>
        <SectionLabel color={accent}>OVERVIEW</SectionLabel>
        <p className="text-sm leading-relaxed text-slate-300">{project.description}</p>

        <SectionLabel color={accent}>
          <span className="mt-6 inline-block">KEY HIGHLIGHTS</span>
        </SectionLabel>
        <ul className="space-y-2.5">
          {project.highlights.map((h, i) => (
            <li key={i} className="flex gap-3 text-sm leading-relaxed text-slate-300">
              <span
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rotate-45"
                style={{ background: accent }}
              />
              {h}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <SectionLabel color={accent}>STACK</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {project.stack.map((s) => (
            <Tag key={s} color={accent}>
              {s}
            </Tag>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-2.5">
          {project.liveUrl && (
            <a
              href={project.liveUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="clip-tag flex items-center justify-center gap-2 px-4 py-3 font-display text-xs font-black tracking-wider text-void-950 transition hover:brightness-110"
              style={{ background: accent }}
            >
              <ExternalLink className="h-4 w-4" /> VIEW LIVE
            </a>
          )}
          {project.repoUrl && (
            <a
              href={project.repoUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="clip-tag flex items-center justify-center gap-2 border border-white/15 px-4 py-3 font-display text-xs font-bold tracking-wider text-slate-200 transition hover:border-white/40 hover:text-white"
            >
              <Github className="h-4 w-4" /> SOURCE CODE
            </a>
          )}
          {!project.liveUrl && !project.repoUrl && (
            <p className="font-mono text-[11px] leading-relaxed text-slate-500">
              Add a liveUrl or repoUrl for this project in src/config/portfolio.ts to show links
              here.
            </p>
          )}
        </div>
      </div>
    </div>
  </motion.div>
);

export const ProjectsModal: React.FC = () => {
  const [filter, setFilter] = useState<string>('ALL');
  const [selected, setSelected] = useState<{ project: Project; accent: string } | null>(null);

  const filtered = useMemo(
    () =>
      filter === 'ALL'
        ? portfolio.projects
        : portfolio.projects.filter((p) => p.category === filter),
    [filter],
  );

  /**
   * Filter chips are built from the categories actually in use, so adding a
   * project with a brand-new category makes its chip appear on its own. With
   * only one category there is nothing to filter, so the row is hidden.
   */
  const available = useMemo(() => {
    const used = Array.from(new Set(portfolio.projects.map((p) => p.category)));
    return used.length > 1 ? ['ALL', ...used] : [];
  }, []);

  return (
    <ModalShell
      accent="#22d3ee"
      icon={<Cpu className="h-5 w-5" />}
      title="AI RESEARCH LAB"
      subtitle={`${portfolio.projects.length} ${portfolio.projects.length === 1 ? 'PROJECT' : 'PROJECTS'} ARCHIVED`}
      width="max-w-5xl"
    >
      <AnimatePresence mode="wait">
        {selected ? (
          <ProjectDetail
            project={selected.project}
            accent={selected.accent}
            onBack={() => setSelected(null)}
          />
        ) : (
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.25 }}
          >
            {/* Filters */}
            <div className="mb-5 flex flex-wrap gap-2">
              {available.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    audio.uiClick();
                    setFilter(c);
                  }}
                  onMouseEnter={() => audio.uiHover()}
                  className={`clip-tag px-3.5 py-2 font-display text-[10px] font-bold tracking-[0.14em] transition ${
                    filter === c
                      ? 'bg-neon-cyan text-void-950'
                      : 'border border-white/12 text-slate-400 hover:border-neon-cyan/50 hover:text-neon-cyan'
                  }`}
                >
                  {c.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Grid — a single project gets the full width rather than
                sitting alone in a two-column layout. */}
            <div className={`grid gap-4 ${gridCols(filtered.length, 2)}`}>
              {filtered.map((project, i) => {
                const accent = projectAccent(project, i);
                return (
                <motion.button
                  key={project.id}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.4 }}
                  onClick={() => {
                    audio.uiClick();
                    setSelected({ project, accent });
                  }}
                  onMouseEnter={() => audio.uiHover()}
                  className="clip-cyber group relative overflow-hidden border border-white/[0.08] bg-white/[0.025] p-5 text-left transition hover:border-white/25 hover:bg-white/[0.05]"
                >
                  {/* Hover wash */}
                  <div
                    className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    style={{
                      background: `radial-gradient(circle at 100% 0%, ${accent}26, transparent 60%)`,
                    }}
                  />

                  <div className="relative">
                    <div className="flex items-start justify-between gap-3">
                      <Tag color={accent}>{project.category.toUpperCase()}</Tag>
                      {project.featured && (
                        <Star
                          className="h-4 w-4 shrink-0"
                          style={{ color: accent, fill: accent }}
                        />
                      )}
                    </div>

                    <h3 className="mt-3 font-display text-lg font-black leading-tight text-white">
                      {project.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-snug text-slate-400">{project.tagline}</p>

                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {project.stack.slice(0, 3).map((s) => (
                        <span
                          key={s}
                          className="rounded bg-white/[0.06] px-2 py-0.5 font-mono text-[10px] text-slate-400"
                        >
                          {s}
                        </span>
                      ))}
                      {project.stack.length > 3 && (
                        <span className="px-1 font-mono text-[10px] text-slate-600">
                          +{project.stack.length - 3}
                        </span>
                      )}
                    </div>

                    <div
                      className="mt-4 flex items-center gap-1 font-display text-[10px] font-bold tracking-[0.18em] opacity-70 transition-all group-hover:gap-2 group-hover:opacity-100"
                      style={{ color: accent }}
                    >
                      OPEN PROJECT <ChevronRight className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </motion.button>
                );
              })}
            </div>

            {filtered.length === 0 && (
              <p className="py-12 text-center font-mono text-sm text-slate-500">
                No projects in this category yet.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </ModalShell>
  );
};
