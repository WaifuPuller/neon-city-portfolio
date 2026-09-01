import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronUp, Zap, Hand } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { input, setTouchJump, setTouchMove, setTouchSprint } from '../../systems/input';

const STICK_RADIUS = 56;
const KNOB_RADIUS = 26;

/**
 * Virtual gamepad for touch devices: an analogue stick on the left, a look pad
 * covering the right half of the screen, and action buttons.
 */
export const TouchControls: React.FC = () => {
  const phase = useGameStore((s) => s.phase);
  const activeModal = useGameStore((s) => s.activeModal);
  const nearby = useGameStore((s) => s.nearbyZone);
  const openModal = useGameStore((s) => s.openModal);
  const cores = useGameStore((s) => s.collectibles.filter((c) => c.collected).length);
  const sensitivity = useGameStore((s) => s.mouseSensitivity);
  const invertY = useGameStore((s) => s.invertY);

  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [sprinting, setSprinting] = useState(false);
  const stickId = useRef<number | null>(null);
  const stickOrigin = useRef({ x: 0, y: 0 });
  const lookId = useRef<number | null>(null);
  const lookLast = useRef({ x: 0, y: 0 });

  const active = phase === 'PLAYING' && activeModal === null;

  /* ------------------------------------------------------------------ stick */

  const updateStick = useCallback((clientX: number, clientY: number) => {
    const dx = clientX - stickOrigin.current.x;
    const dy = clientY - stickOrigin.current.y;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, STICK_RADIUS);
    const angle = Math.atan2(dy, dx);

    const kx = Math.cos(angle) * clamped;
    const ky = Math.sin(angle) * clamped;
    setKnob({ x: kx, y: ky });

    // Dead zone keeps the avatar still when a thumb merely rests on the pad.
    const norm = clamped / STICK_RADIUS;
    if (norm < 0.18) {
      setTouchMove(0, 0, true);
      return;
    }
    setTouchMove(-(ky / STICK_RADIUS), kx / STICK_RADIUS, true);
    setTouchSprint(norm > 0.86);
    setSprinting(norm > 0.86);
  }, []);

  const onStickDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    stickId.current = e.pointerId;
    const rect = e.currentTarget.getBoundingClientRect();
    stickOrigin.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    updateStick(e.clientX, e.clientY);
  };

  const onStickMove = (e: React.PointerEvent) => {
    if (stickId.current !== e.pointerId) return;
    updateStick(e.clientX, e.clientY);
  };

  const onStickUp = (e: React.PointerEvent) => {
    if (stickId.current !== e.pointerId) return;
    stickId.current = null;
    setKnob({ x: 0, y: 0 });
    setSprinting(false);
    setTouchMove(0, 0, false);
    setTouchSprint(false);
  };

  /* ------------------------------------------------------------------- look */

  const onLookDown = (e: React.PointerEvent) => {
    if (lookId.current !== null) return;
    lookId.current = e.pointerId;
    lookLast.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onLookMove = (e: React.PointerEvent) => {
    if (lookId.current !== e.pointerId) return;
    const sens = sensitivity * 0.0042;
    input.lookX += (e.clientX - lookLast.current.x) * sens;
    input.lookY += (e.clientY - lookLast.current.y) * sens * (invertY ? -1 : 1);
    lookLast.current = { x: e.clientX, y: e.clientY };
  };

  const onLookUp = (e: React.PointerEvent) => {
    if (lookId.current !== e.pointerId) return;
    lookId.current = null;
  };

  /* Release everything if the game leaves the playing state mid-touch. */
  useEffect(() => {
    if (!active) {
      stickId.current = null;
      lookId.current = null;
      setKnob({ x: 0, y: 0 });
      setSprinting(false);
      setTouchMove(0, 0, false);
      setTouchSprint(false);
      setTouchJump(false);
    }
  }, [active]);

  if (!active) return null;

  return (
    <div className="absolute inset-0 z-40 md:hidden">
      {/* Look surface — the right half of the screen, above the buttons */}
      <div
        className="absolute bottom-0 right-0 top-0 w-1/2 touch-none"
        onPointerDown={onLookDown}
        onPointerMove={onLookMove}
        onPointerUp={onLookUp}
        onPointerCancel={onLookUp}
        aria-hidden
      />

      {/* Movement stick */}
      <div
        className="absolute bottom-8 left-6 touch-none select-none"
        style={{ width: STICK_RADIUS * 2, height: STICK_RADIUS * 2 }}
        onPointerDown={onStickDown}
        onPointerMove={onStickMove}
        onPointerUp={onStickUp}
        onPointerCancel={onStickUp}
      >
        <div
          className={`absolute inset-0 rounded-full border-2 backdrop-blur-md transition-colors ${
            sprinting ? 'border-neon-pink/70 bg-neon-pink/10' : 'border-white/25 bg-white/[0.07]'
          }`}
        />
        <div
          className="pointer-events-none absolute rounded-full border border-white/40 bg-white/20 backdrop-blur-sm"
          style={{
            width: KNOB_RADIUS * 2,
            height: KNOB_RADIUS * 2,
            left: STICK_RADIUS - KNOB_RADIUS + knob.x,
            top: STICK_RADIUS - KNOB_RADIUS + knob.y,
            boxShadow: sprinting ? '0 0 20px rgba(244,114,182,0.6)' : '0 0 14px rgba(34,211,238,0.35)',
          }}
        />
        <div className="pointer-events-none absolute inset-x-0 -bottom-6 text-center font-mono text-[9px] tracking-[0.2em] text-white/40">
          {sprinting ? 'SPRINT' : 'MOVE'}
        </div>
      </div>

      {/* Action buttons */}
      <div className="absolute bottom-8 right-6 flex flex-col items-end gap-3">
        {nearby && (
          <button
            onPointerDown={(e) => {
              e.stopPropagation();
              openModal(nearby.modal);
            }}
            className="flex h-20 w-20 flex-col items-center justify-center rounded-full border-2 font-display text-[10px] font-black tracking-wider backdrop-blur-md"
            style={{
              borderColor: nearby.color,
              background: `${nearby.color}22`,
              color: nearby.color,
              boxShadow: `0 0 26px ${nearby.color}55`,
            }}
          >
            <Hand className="mb-0.5 h-6 w-6" />
            OPEN
          </button>
        )}

        <div className="flex items-center gap-3">
          <button
            onPointerDown={(e) => {
              e.stopPropagation();
              setTouchSprint(true);
              setSprinting(true);
            }}
            onPointerUp={() => {
              setTouchSprint(false);
              setSprinting(false);
            }}
            onPointerCancel={() => {
              setTouchSprint(false);
              setSprinting(false);
            }}
            className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-neon-pink/50 bg-neon-pink/10 text-neon-pink backdrop-blur-md active:bg-neon-pink/25"
            aria-label="Sprint"
          >
            <Zap className="h-5 w-5" />
          </button>

          <button
            onPointerDown={(e) => {
              e.stopPropagation();
              setTouchJump(true);
            }}
            onPointerUp={() => setTouchJump(false)}
            onPointerCancel={() => setTouchJump(false)}
            className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-neon-cyan/60 bg-neon-cyan/15 text-neon-cyan backdrop-blur-md active:bg-neon-cyan/30"
            aria-label="Jump"
          >
            <ChevronUp className="h-7 w-7" />
          </button>
        </div>
      </div>

      {/* Compact core counter, since the desktop one is hidden on small screens */}
      <div className="glass clip-tag pointer-events-none absolute right-3 top-16 flex items-center gap-1.5 px-2.5 py-1.5">
        <span className="h-2 w-2 rounded-full bg-neon-amber" />
        <span className="font-mono text-[11px] font-bold tabular-nums text-neon-amber">
          {cores}/5
        </span>
      </div>
    </div>
  );
};
