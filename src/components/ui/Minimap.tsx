import React, { useEffect, useRef } from 'react';
import { Maximize2 } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { playerState } from '../../systems/input';
import { buildings, WORLD_BOUNDS } from '../../systems/world';
import { headingAngle, LabelLayout, makeProjection, screenAngle } from '../../systems/mapProjection';
import { navState } from '../../systems/navState';
import { audio } from '../../utils/audioSynth';

const PAD = 11;

/**
 * Corner radar, drawn on a 2D canvas rather than in React so it can update
 * every frame from the shared player snapshot without re-rendering the HUD.
 *
 * Orientation comes from the shared projection in systems/mapProjection, which
 * is where the left/right mirroring bug was fixed — see the note there.
 */
export const Minimap: React.FC<{ size?: number; onExpand?: () => void }> = ({
  size = 148,
  onExpand,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const zones = useGameStore((s) => s.zones);
  const collectibles = useGameStore((s) => s.collectibles);
  const visited = useGameStore((s) => s.visitedZones);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const { project, scale } = makeProjection(size, size, PAD);
    const compact = size < 130;
    const labels = new LabelLayout();

    let raf = 0;

    /* ----------------------------------------------------------------------
     * The city never moves, so it is drawn ONCE to an offscreen canvas and
     * blitted each frame. Re-filling sixty building rectangles every frame on
     * a second rAF loop was pure waste running alongside the 3D render.
     * -------------------------------------------------------------------- */
    const base = document.createElement('canvas');
    base.width = size * dpr;
    base.height = size * dpr;
    const bctx = base.getContext('2d');
    if (!bctx) return;
    bctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    bctx.fillStyle = 'rgba(5, 8, 18, 0.82)';
    bctx.fillRect(0, 0, size, size);

    bctx.fillStyle = 'rgba(148, 163, 184, 0.16)';
    for (const b of buildings) {
      const [mx, my] = project(b.position[0], b.position[2]);
      const w = b.size[0] * scale;
      const h = b.size[2] * scale;
      bctx.fillRect(mx - w / 2, my - h / 2, w, h);
    }

    // Boulevard
    bctx.strokeStyle = 'rgba(34, 211, 238, 0.22)';
    bctx.lineWidth = 5 * scale;
    bctx.beginPath();
    const [bx0, bz0] = project(0, WORLD_BOUNDS.minZ);
    const [, bz1] = project(0, WORLD_BOUNDS.maxZ);
    bctx.moveTo(bx0, bz0);
    bctx.lineTo(bx0, bz1);
    bctx.stroke();

    const draw = () => {
      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(base, 0, 0, size, size);

      /* ------------------------------------------------------------- route */
      const route = navState.route;
      if (route && route.points.length > 1) {
        ctx.strokeStyle = navState.target?.color ?? '#22d3ee';
        ctx.lineWidth = 1.6;
        ctx.setLineDash([4, 3]);
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        route.points.forEach(([wx, wz], i) => {
          const [mx, my] = project(wx, wz);
          if (i === 0) ctx.moveTo(mx, my);
          else ctx.lineTo(mx, my);
        });
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }

      // Data cores
      for (const c of collectibles) {
        if (c.collected) continue;
        const [mx, my] = project(c.position[0], c.position[2]);
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(mx, my, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }

      /* --------------------------------------------------------- landmarks */
      labels.reset();
      ctx.font = `600 ${compact ? 6.5 : 7.5}px "JetBrains Mono", ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.lineJoin = 'round';

      // Unvisited landmarks and the current destination get first claim on the
      // label space, since they are the ones you are actually looking for.
      const ordered = [...zones].sort((a, b) => {
        const rank = (id: string) =>
          navState.target?.id === id ? 0 : visited.includes(id) ? 2 : 1;
        return rank(a.id) - rank(b.id);
      });

      for (const zone of ordered) {
        const [mx, my] = project(zone.position[0], zone.position[2]);
        const seen = visited.includes(zone.id);
        const isTarget = navState.target?.id === zone.id;

        ctx.fillStyle = zone.color;
        ctx.globalAlpha = seen ? 1 : 0.55;
        ctx.beginPath();
        ctx.arc(mx, my, isTarget ? 4 : 3.4, 0, Math.PI * 2);
        ctx.fill();

        if (!seen || isTarget) {
          ctx.globalAlpha = isTarget ? 1 : 0.85;
          ctx.strokeStyle = zone.color;
          ctx.lineWidth = isTarget ? 1.5 : 1;
          ctx.beginPath();
          ctx.arc(mx, my, isTarget ? 7.5 : 6, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // Name underneath, skipped when it would land on top of another one.
        const text = zone.short;
        const w = ctx.measureText(text).width;
        const ly = my + (isTarget ? 9 : 6);
        const box = { x: mx - w / 2 - 1, y: ly - 1, w: w + 2, h: 10 };
        // Keep the text inside the frame rather than clipped at the edge.
        if (box.x < 1 || box.x + box.w > size - 1 || box.y + box.h > size - 1) continue;
        if (!labels.place(box)) continue;

        ctx.strokeStyle = 'rgba(3, 5, 12, 0.95)';
        ctx.lineWidth = 2.5;
        ctx.strokeText(text, mx, ly);
        ctx.fillStyle = isTarget ? zone.color : seen ? 'rgba(226,232,240,0.9)' : 'rgba(148,163,184,0.85)';
        ctx.fillText(text, mx, ly);
      }

      /* ------------------------------------------------------------ player */
      const [px, py] = project(playerState.x, playerState.z);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(headingAngle(playerState.yaw));
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#22d3ee';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(4.2, 5);
      ctx.lineTo(0, 2.6);
      ctx.lineTo(-4.2, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      /* -------------------------------------------- off-radar destination */
      // Everything fits on the radar, so this only fires if the target has
      // somehow been placed outside the world bounds. Cheap insurance.
      if (navState.target) {
        const [tx, ty] = project(navState.target.position[0], navState.target.position[2]);
        if (tx < 0 || ty < 0 || tx > size || ty > size) {
          const angle = screenAngle(
            navState.target.position[0] - playerState.x,
            navState.target.position[2] - playerState.z,
          );
          ctx.save();
          ctx.translate(size / 2, size / 2);
          ctx.rotate(angle);
          ctx.translate(0, -size / 2 + 8);
          ctx.fillStyle = navState.target.color;
          ctx.beginPath();
          ctx.moveTo(0, -4);
          ctx.lineTo(3.5, 3);
          ctx.lineTo(-3.5, 3);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [zones, collectibles, visited, size]);

  const body = (
    <>
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size }}
        className="block rounded-sm"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-1.5 border border-neon-cyan/20" />
      <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 font-mono text-[8px] tracking-[0.3em] text-neon-cyan/60">
        N
      </div>
    </>
  );

  if (!onExpand) {
    return <div className="glass clip-cyber relative overflow-hidden p-1.5">{body}</div>;
  }

  return (
    <button
      type="button"
      onClick={() => {
        audio.uiClick();
        onExpand();
      }}
      onMouseEnter={() => audio.uiHover()}
      aria-label="Open the city map"
      title="City map (M)"
      className="glass clip-cyber group relative block overflow-hidden p-1.5 transition hover:border-neon-cyan/50"
    >
      {body}
      <span className="pointer-events-none absolute bottom-2 right-2 flex items-center gap-1 rounded bg-void-950/70 px-1.5 py-0.5 font-mono text-[8px] tracking-[0.18em] text-neon-cyan/80 transition group-hover:text-neon-cyan">
        <Maximize2 className="h-2.5 w-2.5" />
        MAP
      </span>
    </button>
  );
};
