import React, { useEffect, useRef } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { playerState } from '../../systems/input';
import { buildings, WORLD_BOUNDS } from '../../systems/world';

const SIZE = 148;
const PAD = 6;

const spanX = WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX;
const spanZ = WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ;
const scale = (SIZE - PAD * 2) / Math.max(spanX, spanZ);

/** World +Z is north, so it maps to the *top* of the radar. */
const toMap = (x: number, z: number): [number, number] => [
  PAD + (x - WORLD_BOUNDS.minX) * scale,
  PAD + (WORLD_BOUNDS.maxZ - z) * scale,
];

/**
 * Radar drawn on a 2D canvas rather than in React, so it can update every
 * frame from the shared player snapshot without re-rendering the HUD.
 */
export const Minimap: React.FC = () => {
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
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    ctx.scale(dpr, dpr);

    let raf = 0;

    /* ----------------------------------------------------------------------
     * The city never moves, so it is drawn ONCE to an offscreen canvas and
     * blitted each frame. Re-filling sixty building rectangles every frame on
     * a second rAF loop was pure waste running alongside the 3D render.
     * -------------------------------------------------------------------- */
    const base = document.createElement('canvas');
    base.width = SIZE * dpr;
    base.height = SIZE * dpr;
    const bctx = base.getContext('2d');
    if (!bctx) return;
    bctx.scale(dpr, dpr);

    bctx.fillStyle = 'rgba(5, 8, 18, 0.82)';
    bctx.fillRect(0, 0, SIZE, SIZE);

    bctx.fillStyle = 'rgba(148, 163, 184, 0.16)';
    for (const b of buildings) {
      const [mx, my] = toMap(b.position[0], b.position[2]);
      const w = b.size[0] * scale;
      const h = b.size[2] * scale;
      bctx.fillRect(mx - w / 2, my - h / 2, w, h);
    }

    // Boulevard
    bctx.strokeStyle = 'rgba(34, 211, 238, 0.22)';
    bctx.lineWidth = 5 * scale;
    bctx.beginPath();
    const [bx0, bz0] = toMap(0, WORLD_BOUNDS.minZ);
    const [, bz1] = toMap(0, WORLD_BOUNDS.maxZ);
    bctx.moveTo(bx0, bz0);
    bctx.lineTo(bx0, bz1);
    bctx.stroke();

    const draw = () => {
      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.drawImage(base, 0, 0, SIZE, SIZE);

      // Data cores
      for (const c of collectibles) {
        if (c.collected) continue;
        const [mx, my] = toMap(c.position[0], c.position[2]);
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(mx, my, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Landmarks
      for (const zone of zones) {
        const [mx, my] = toMap(zone.position[0], zone.position[2]);
        const seen = visited.includes(zone.id);
        ctx.fillStyle = zone.color;
        ctx.globalAlpha = seen ? 1 : 0.55;
        ctx.beginPath();
        ctx.arc(mx, my, 3.4, 0, Math.PI * 2);
        ctx.fill();
        if (!seen) {
          ctx.globalAlpha = 0.85;
          ctx.strokeStyle = zone.color;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(mx, my, 6, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      // Player: a triangle pointing along the view direction.
      const [px, py] = toMap(playerState.x, playerState.z);
      // World forward is (-sin(yaw), -cos(yaw)); on the radar +Z points up, so
      // a heading of "up" (angle 0) corresponds to fz = +1.
      const fx = -Math.sin(playerState.yaw);
      const fz = -Math.cos(playerState.yaw);
      const angle = Math.atan2(fx, fz);

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(angle);
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

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [zones, collectibles, visited]);

  return (
    <div className="glass clip-cyber relative overflow-hidden p-1.5">
      <canvas
        ref={canvasRef}
        style={{ width: SIZE, height: SIZE }}
        className="block rounded-sm"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-1.5 border border-neon-cyan/20" />
      <div className="absolute left-1/2 top-2 -translate-x-1/2 font-mono text-[8px] tracking-[0.3em] text-neon-cyan/60">
        N
      </div>
    </div>
  );
};
