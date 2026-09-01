import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { TerminalSquare, X, ChevronRight } from 'lucide-react';
import { useGameStore, THEMES } from '../../store/useGameStore';
import { portfolio } from '../../config/portfolio';
import { ThemeId, QualityLevel } from '../../types/game';
import { audio } from '../../utils/audioSynth';

interface Line {
  text: string;
  tone: 'out' | 'in' | 'err' | 'ok';
}

const BANNER: Line[] = [
  { text: 'NEON CITY OS  v5.2.1', tone: 'ok' },
  { text: `operator: ${portfolio.identity.callsign}`, tone: 'out' },
  { text: "type 'help' for the command list", tone: 'out' },
  { text: '─'.repeat(46), tone: 'out' },
];

export const Console: React.FC = () => {
  const store = useGameStore();
  const [lines, setLines] = useState<Line[]>(BANNER);
  const [value, setValue] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const print = (...newLines: Line[]) => setLines((l) => [...l, ...newLines]);

  const run = (raw: string) => {
    const cmd = raw.trim();
    if (!cmd) return;

    print({ text: `> ${cmd}`, tone: 'in' });
    setHistory((h) => [cmd, ...h].slice(0, 40));
    setHistoryIndex(-1);

    const [name, ...args] = cmd.toLowerCase().split(/\s+/);
    const arg = args[0];

    switch (name) {
      case 'help':
        print(
          { text: 'AVAILABLE COMMANDS', tone: 'ok' },
          { text: '  goto <zone>      warp to a landmark', tone: 'out' },
          { text: '  open <panel>     open a portfolio panel', tone: 'out' },
          { text: '  zones            list every landmark', tone: 'out' },
          { text: '  theme <name>     cyan | magenta | emerald | amber', tone: 'out' },
          { text: '  quality <level>  ultra | high | medium | low', tone: 'out' },
          { text: '  stats            show progression', tone: 'out' },
          { text: '  cores            data core tracker', tone: 'out' },
          { text: '  whoami           operator profile', tone: 'out' },
          { text: '  clear            wipe the terminal', tone: 'out' },
          { text: '  exit             return to the city', tone: 'out' },
        );
        break;

      case 'zones':
        print({ text: 'LANDMARKS', tone: 'ok' });
        store.zones.forEach((z) =>
          print({ text: `  ${z.id.padEnd(14)} ${z.name}`, tone: 'out' }),
        );
        break;

      case 'goto':
      case 'tp':
      case 'warp': {
        if (!arg) {
          print({ text: "ERROR: usage 'goto <zone>' — try 'zones'", tone: 'err' });
          break;
        }
        const zone = store.zones.find((z) => z.id.toLowerCase() === arg);
        if (!zone) {
          print({ text: `ERROR: unknown zone '${arg}'`, tone: 'err' });
          break;
        }
        if (zone.locked && store.collectibles.filter((c) => c.collected).length < 5) {
          print({ text: 'ERROR: that zone is sealed. Find all 5 data cores.', tone: 'err' });
          break;
        }
        print({ text: `warping to ${zone.name}…`, tone: 'ok' });
        store.teleportTo([zone.position[0], 1.4, zone.position[2] - 4]);
        break;
      }

      case 'open': {
        const panels = [
          'about',
          'skills',
          'projects',
          'experience',
          'credentials',
          'contact',
          'resume',
          'achievements',
          'arcade',
        ];
        if (!arg || !panels.includes(arg)) {
          print({ text: `ERROR: panels are ${panels.join(', ')}`, tone: 'err' });
          break;
        }
        store.openModal(arg as Parameters<typeof store.openModal>[0]);
        break;
      }

      case 'theme': {
        const themes = Object.keys(THEMES) as ThemeId[];
        if (!arg || !themes.includes(arg as ThemeId)) {
          print({ text: `ERROR: themes are ${themes.join(', ')}`, tone: 'err' });
          break;
        }
        store.setTheme(arg as ThemeId);
        print({ text: `theme set to ${arg}`, tone: 'ok' });
        break;
      }

      case 'quality': {
        const levels: QualityLevel[] = ['ultra', 'high', 'medium', 'low'];
        if (!arg || !levels.includes(arg as QualityLevel)) {
          print({ text: `ERROR: levels are ${levels.join(', ')}`, tone: 'err' });
          break;
        }
        store.setQuality(arg as QualityLevel);
        print({ text: `graphics set to ${arg}`, tone: 'ok' });
        break;
      }

      case 'stats': {
        const done = store.quests.filter((q) => q.done).length;
        const unlocked = store.achievements.filter((a) => a.unlocked).length;
        print(
          { text: 'PROGRESSION', tone: 'ok' },
          { text: `  level        ${store.level}`, tone: 'out' },
          { text: `  xp           ${store.xp} (total ${store.totalXp})`, tone: 'out' },
          { text: `  objectives   ${done}/${store.quests.length}`, tone: 'out' },
          { text: `  achievements ${unlocked}/${store.achievements.length}`, tone: 'out' },
        );
        break;
      }

      case 'cores': {
        print({ text: 'DATA CORES', tone: 'ok' });
        store.collectibles.forEach((c) =>
          print({
            text: `  [${c.collected ? 'x' : ' '}] ${c.name}`,
            tone: c.collected ? 'ok' : 'out',
          }),
        );
        break;
      }

      case 'whoami':
        print(
          { text: portfolio.identity.name, tone: 'ok' },
          { text: portfolio.identity.title, tone: 'out' },
          { text: portfolio.identity.location, tone: 'out' },
          { text: portfolio.links.email, tone: 'out' },
        );
        break;

      case 'clear':
        setLines([]);
        break;

      case 'exit':
      case 'quit':
        store.closeModal();
        break;

      default:
        audio.error();
        print({ text: `command not found: ${name}. try 'help'`, tone: 'err' });
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = Math.min(history.length - 1, historyIndex + 1);
      if (next >= 0) {
        setHistoryIndex(next);
        setValue(history[next]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = historyIndex - 1;
      setHistoryIndex(next);
      setValue(next >= 0 ? history[next] : '');
    }
  };

  const TONE: Record<Line['tone'], string> = {
    in: 'text-neon-pink font-bold',
    err: 'text-red-400',
    ok: 'text-neon-cyan',
    out: 'text-slate-400',
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={store.closeModal}
        aria-label="Close terminal"
        className="absolute inset-0 cursor-default bg-void-950/85 backdrop-blur-md"
      />

      <motion.div
        initial={{ opacity: 0, y: 26, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className="glass-strong clip-cyber relative flex h-[min(560px,86vh)] w-full max-w-2xl flex-col border-neon-cyan/40"
        style={{ boxShadow: '0 0 60px -12px rgba(34,211,238,0.45)' }}
        role="dialog"
        aria-modal="true"
        aria-label="Terminal"
      >
        <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-3.5">
          <div className="flex items-center gap-2.5 font-display text-xs font-black tracking-[0.16em] text-neon-cyan">
            <TerminalSquare className="h-4 w-4" />
            COMMAND CONSOLE
          </div>
          <button
            onClick={store.closeModal}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/12 text-slate-400 transition hover:border-neon-pink/60 hover:text-neon-pink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-5 py-4 font-mono text-[12px] leading-relaxed">
          {lines.map((line, i) => (
            <div key={i} className={`whitespace-pre-wrap ${TONE[line.tone]}`} data-selectable>
              {line.text}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(value);
            setValue('');
          }}
          className="flex items-center gap-2 border-t border-white/[0.07] px-5 py-3.5"
        >
          <ChevronRight className="h-4 w-4 shrink-0 text-neon-pink" />
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            spellCheck={false}
            autoComplete="off"
            placeholder="help"
            aria-label="Terminal input"
            className="flex-1 bg-transparent font-mono text-[13px] text-slate-100 outline-none placeholder:text-slate-700"
          />
        </form>
      </motion.div>
    </div>
  );
};
