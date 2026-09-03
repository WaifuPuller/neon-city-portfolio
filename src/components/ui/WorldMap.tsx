import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Gem, MapPin, Navigation, X, Lock, Check } from 'lucide-react';

import { useGameStore, THEMES } from '../../store/useGameStore';
import { playerState } from '../../systems/input';
import { buildings, WORLD_BOUNDS } from '../../systems/world';
import { headingAngle, makeProjection } from '../../systems/mapProjection';
import { findRoute } from '../../systems/navigation';
import { navState } from '../../systems/navState';
import { audio } from '../../utils/audioSynth';
import type { NavTarget, Vec3 } from '../../types/game';

/* The map is drawn in its own coordinate space and scaled to fit by the
   viewBox, so it is identically sharp on a phone and a 4K monitor. */
const UNIT = 8;
const PAD = 52;
const VIEW_W = (WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX) * UNIT + PAD * 2;
const VIEW_H = (WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ) * UNIT + PAD * 2;

const { project, scale } = makeProjection(VIEW_W, VIEW_H, PAD);

interface Destination extends NavTarget {
  subtitle: string;
  kind: 'landmark' | 'core';
  visited: boolean;
  locked: boolean;
}

const distanceTo = (p: Vec3) => Math.hypot(p[0] - playerState.x, p[2] - playerState.z);

export const WorldMap: React.FC = () => {
  const zones = useGameStore((s) => s.zones);
  const collectibles = useGameStore((s) => s.collectibles);
  const visited = useGameStore((s) => s.visitedZones);
  const theme = useGameStore((s) => s.theme);
  const navTarget = useGameStore((s) => s.navTarget);
  const setNavTarget = useGameStore((s) => s.setNavTarget);
  const closeModal = useGameStore((s) => s.closeModal);

  const palette = THEMES[theme];
  const coresLeft = collectibles.filter((c) => !c.collected).length;

  const [selectedId, setSelectedId] = useState<string | null>(navTarget?.id ?? null);

  /* The player keeps walking while the map is open, so nudge a re-render a few
     times a second to keep the distances honest. The marker itself is moved
     directly below, without React. */
  const [, tick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 400);
    return () => window.clearInterval(id);
  }, []);

  const destinations = useMemo<Destination[]>(() => {
    const landmarks: Destination[] = zones.map((z) => ({
      id: z.id,
      name: z.name,
      subtitle: z.subtitle,
      position: z.position,
      color: z.color,
      kind: 'landmark',
      visited: visited.includes(z.id),
      // The vault stays shut until every core is in, so say so rather than
      // sending someone across the city to a locked door.
      locked: Boolean(z.locked) && coresLeft > 0,
    }));

    const cores: Destination[] = collectibles
      .filter((c) => !c.collected)
      .map((c) => ({
        id: c.id,
        name: c.name,
        subtitle: 'Data Core',
        position: c.position,
        color: '#fbbf24',
        kind: 'core',
        visited: false,
        locked: false,
      }));

    return [...landmarks, ...cores];
  }, [zones, collectibles, visited, coresLeft]);

  const selected = destinations.find((d) => d.id === selectedId) ?? null;

  /* Route drawn under the selection. Computed here rather than waiting for the
     3D layer's next tick, so picking a destination previews the walk instantly. */
  const preview = useMemo(() => {
    if (!selected) return navState.route;
    return findRoute(playerState.x, playerState.z, selected.position[0], selected.position[2]);
  }, [selected]);

  /* Live player marker, moved by writing the transform directly. Putting the
     position through React would re-render the whole map sixty times a second
     for the sake of one triangle. */
  const markerRef = useRef<SVGGElement>(null);
  useEffect(() => {
    let raf = 0;
    const follow = () => {
      const g = markerRef.current;
      if (g) {
        const [mx, my] = project(playerState.x, playerState.z);
        const deg = (headingAngle(playerState.yaw) * 180) / Math.PI;
        g.setAttribute('transform', `translate(${mx} ${my}) rotate(${deg})`);
      }
      raf = requestAnimationFrame(follow);
    };
    raf = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(raf);
  }, []);

  const startNavigation = (dest: Destination) => {
    setNavTarget({
      id: dest.id,
      name: dest.name,
      position: dest.position,
      color: dest.color,
    });
    closeModal();
  };

  const routePoints = preview?.points
    .map(([wx, wz]) => project(wx, wz).join(','))
    .join(' ');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="safe-area absolute z-50 flex flex-col bg-void-950/95 backdrop-blur-xl"
    >
      {/* ------------------------------------------------------------ header */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <MapPin className="h-4 w-4" style={{ color: palette.primary }} />
          <div>
            <div className="font-display text-sm font-black tracking-[0.18em] text-white">
              CITY MAP
            </div>
            <div className="font-mono text-[10px] tracking-[0.2em] text-slate-500">
              SELECT A DESTINATION TO PLOT A ROUTE
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            audio.uiClick();
            closeModal();
          }}
          aria-label="Close map"
          className="glass flex h-10 w-10 items-center justify-center rounded-xl text-slate-300 transition hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* ---------------------------------------------------------- map */}
        <div className="relative min-h-0 flex-1 p-3 sm:p-5">
          <svg
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            preserveAspectRatio="xMidYMid meet"
            className="h-full w-full"
            role="img"
            aria-label="Top-down map of the city"
          >
            <defs>
              <pattern id="map-grid" width={UNIT * 8} height={UNIT * 8} patternUnits="userSpaceOnUse">
                <path
                  d={`M ${UNIT * 8} 0 L 0 0 0 ${UNIT * 8}`}
                  fill="none"
                  stroke="rgba(148,163,184,0.07)"
                  strokeWidth="1"
                />
              </pattern>
            </defs>

            <rect width={VIEW_W} height={VIEW_H} fill="rgba(4,6,14,0.9)" />
            <rect width={VIEW_W} height={VIEW_H} fill="url(#map-grid)" />

            {/* Boulevard */}
            <line
              x1={project(0, WORLD_BOUNDS.minZ)[0]}
              y1={project(0, WORLD_BOUNDS.minZ)[1]}
              x2={project(0, WORLD_BOUNDS.maxZ)[0]}
              y2={project(0, WORLD_BOUNDS.maxZ)[1]}
              stroke={palette.primary}
              strokeOpacity={0.18}
              strokeWidth={5 * scale}
            />

            {/* Buildings */}
            {buildings.map((b) => {
              const [mx, my] = project(b.position[0], b.position[2]);
              const w = b.size[0] * scale;
              const h = b.size[2] * scale;
              return (
                <rect
                  key={b.id}
                  x={mx - w / 2}
                  y={my - h / 2}
                  width={w}
                  height={h}
                  rx={2}
                  fill="rgba(148,163,184,0.15)"
                  stroke="rgba(148,163,184,0.22)"
                  strokeWidth={1}
                />
              );
            })}

            {/* Planned route */}
            {routePoints && (
              <polyline
                points={routePoints}
                fill="none"
                stroke={selected?.color ?? palette.primary}
                strokeWidth={3}
                strokeDasharray="14 10"
                strokeLinecap="round"
                strokeOpacity={0.95}
              >
                <animate
                  attributeName="stroke-dashoffset"
                  from="24"
                  to="0"
                  dur="0.9s"
                  repeatCount="indefinite"
                />
              </polyline>
            )}

            {/* Destinations */}
            {destinations.map((d) => {
              const [mx, my] = project(d.position[0], d.position[2]);
              const isSel = d.id === selectedId;
              const r = d.kind === 'core' ? 6 : 11;

              return (
                <g
                  key={d.id}
                  onClick={() => {
                    audio.uiClick();
                    setSelectedId(d.id);
                  }}
                  className="cursor-pointer"
                  role="button"
                  aria-label={d.name}
                >
                  {/* Generous invisible hit area, so this is tappable. */}
                  <circle cx={mx} cy={my} r={34} fill="transparent" />
                  {isSel && (
                    <circle cx={mx} cy={my} r={r + 12} fill="none" stroke={d.color} strokeWidth={2}>
                      <animate
                        attributeName="r"
                        values={`${r + 8};${r + 18};${r + 8}`}
                        dur="1.6s"
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="stroke-opacity"
                        values="0.9;0.1;0.9"
                        dur="1.6s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  )}
                  <circle
                    cx={mx}
                    cy={my}
                    r={r}
                    fill={d.color}
                    fillOpacity={d.visited || d.kind === 'core' ? 1 : 0.55}
                    stroke={d.color}
                    strokeWidth={2}
                  />
                  {d.kind === 'landmark' && (
                    <text
                      x={mx}
                      y={my + 30}
                      textAnchor="middle"
                      fontSize={17}
                      fontFamily='"JetBrains Mono", ui-monospace, monospace'
                      fontWeight={700}
                      letterSpacing={1.2}
                      fill={isSel ? d.color : 'rgba(226,232,240,0.92)'}
                      stroke="rgba(3,5,12,0.95)"
                      strokeWidth={4}
                      paintOrder="stroke"
                    >
                      {d.name}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Player */}
            <g ref={markerRef}>
              <circle r={17} fill={palette.primary} fillOpacity={0.18} />
              <path
                d="M 0 -15 L 10 12 L 0 6 L -10 12 Z"
                fill="#ffffff"
                stroke={palette.primary}
                strokeWidth={2}
              />
            </g>

            {/* Compass */}
            <text
              x={VIEW_W / 2}
              y={30}
              textAnchor="middle"
              fontSize={20}
              fontFamily='"JetBrains Mono", ui-monospace, monospace'
              letterSpacing={6}
              fill={palette.primary}
              fillOpacity={0.55}
            >
              N
            </text>
          </svg>
        </div>

        {/* --------------------------------------------------------- list */}
        <div className="flex max-h-[42vh] min-h-0 shrink-0 flex-col border-t border-white/10 lg:max-h-none lg:w-80 lg:border-l lg:border-t-0">
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <div className="mb-2 px-1 font-mono text-[10px] tracking-[0.24em] text-slate-500">
              DESTINATIONS
            </div>

            <div className="flex flex-col gap-1.5">
              {destinations.map((d) => {
                const isSel = d.id === selectedId;
                const dist = Math.round(distanceTo(d.position));
                return (
                  <button
                    key={d.id}
                    onClick={() => {
                      audio.uiClick();
                      setSelectedId(d.id);
                    }}
                    onMouseEnter={() => audio.uiHover()}
                    className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
                      isSel
                        ? 'border-white/25 bg-white/[0.08]'
                        : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.05]'
                    }`}
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                      style={{ background: `${d.color}22`, color: d.color }}
                    >
                      {d.kind === 'core' ? (
                        <Gem className="h-3.5 w-3.5" />
                      ) : d.locked ? (
                        <Lock className="h-3.5 w-3.5" />
                      ) : (
                        <MapPin className="h-3.5 w-3.5" />
                      )}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate font-display text-[12px] font-bold text-white">
                          {d.name}
                        </span>
                        {d.visited && <Check className="h-3 w-3 shrink-0 text-neon-mint" />}
                      </span>
                      <span className="block truncate font-mono text-[10px] text-slate-500">
                        {d.locked ? `Locked — ${coresLeft} core(s) missing` : d.subtitle}
                      </span>
                    </span>

                    <span className="shrink-0 font-mono text-[10px] tabular-nums text-slate-400">
                      {dist}m
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ------------------------------------------------------- footer */}
          <div className="shrink-0 border-t border-white/10 p-3">
            {selected ? (
              <>
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <span className="truncate font-display text-[13px] font-black text-white">
                    {selected.name}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-slate-400">
                    {preview
                      ? `${Math.round(preview.distance)}m on foot`
                      : 'no route'}
                  </span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => startNavigation(selected)}
                    disabled={!preview}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-3 font-display text-[11px] font-black tracking-[0.16em] text-void-950 transition disabled:cursor-not-allowed disabled:opacity-40"
                    style={{ background: selected.color, boxShadow: `0 0 24px ${selected.color}55` }}
                  >
                    <Navigation className="h-3.5 w-3.5" />
                    NAVIGATE
                  </button>

                  {navTarget && (
                    <button
                      onClick={() => {
                        audio.uiClick();
                        setNavTarget(null);
                        setSelectedId(null);
                      }}
                      className="glass rounded-lg px-4 py-3 font-display text-[11px] font-black tracking-[0.16em] text-slate-300 transition hover:text-white"
                    >
                      STOP
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="py-1 text-center font-mono text-[10px] leading-relaxed tracking-[0.14em] text-slate-500">
                PICK A DESTINATION ABOVE
                <br />
                ARROWS WILL APPEAR ON THE STREET
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default WorldMap;
