import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Radio, Send, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { ModalShell } from './ModalShell';
import { portfolio } from '../../config/portfolio';
import { useGameStore } from '../../store/useGameStore';
import { audio } from '../../utils/audioSynth';
import { SocialLinks } from '../ui/SocialLinks';

type Status = 'idle' | 'sending' | 'sent' | 'error';

export const ContactModal: React.FC = () => {
  const { contact, links, identity } = portfolio;
  const unlockAchievement = useGameStore((s) => s.unlockAchievement);

  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', message: '' });

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === 'sending') return;

    setStatus('sending');
    setError('');

    try {
      if (contact.formEndpoint) {
        // POST to whatever form service the owner configured.
        const res = await fetch(contact.formEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error(`Server responded ${res.status}`);
      } else {
        // No endpoint configured: hand off to the visitor's mail client.
        const subject = encodeURIComponent(`Portfolio enquiry from ${form.name || 'a visitor'}`);
        const body = encodeURIComponent(
          `${form.message}\n\n— ${form.name}\n${form.email}`,
        );
        window.location.href = `mailto:${links.email}?subject=${subject}&body=${body}`;
      }

      audio.achievement();
      setStatus('sent');
      unlockAchievement('signal');
    } catch (err) {
      audio.error();
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Transmission failed.');
    }
  };

  const inputClass =
    'w-full border border-white/12 bg-black/40 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-neon-pink/70 focus:bg-black/60';

  return (
    <ModalShell
      accent="#f472b6"
      icon={<Radio className="h-5 w-5" />}
      title={contact.heading}
      subtitle="COMMS TOWER — UPLINK READY"
      width="max-w-2xl"
    >
      {status === 'sent' ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          className="py-14 text-center"
        >
          <CheckCircle2 className="mx-auto h-16 w-16 text-neon-mint" />
          <h3 className="mt-4 font-display text-2xl font-black text-neon-mint">
            {contact.formEndpoint ? 'SIGNAL TRANSMITTED' : 'MAIL CLIENT OPENED'}
          </h3>
          <p className="mx-auto mt-2 max-w-sm text-sm text-slate-400">
            {contact.formEndpoint
              ? `Thanks for reaching out. ${identity.name.split(' ')[0]} will get back to you soon.`
              : 'Finish sending the message in your email app and it will arrive shortly.'}
          </p>
          <button
            onClick={() => {
              setStatus('idle');
              setForm({ name: '', email: '', message: '' });
            }}
            className="clip-tag mt-6 border border-white/15 px-5 py-2.5 font-display text-[11px] font-bold tracking-[0.16em] text-slate-300 transition hover:border-neon-pink/60 hover:text-neon-pink"
          >
            SEND ANOTHER
          </button>
        </motion.div>
      ) : (
        <>
          <p className="mb-6 text-sm leading-relaxed text-slate-300">{contact.blurb}</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="contact-name"
                  className="mb-1.5 block font-mono text-[10px] tracking-[0.2em] text-slate-500"
                >
                  YOUR NAME
                </label>
                <input
                  id="contact-name"
                  className={`clip-tag ${inputClass}`}
                  required
                  autoComplete="name"
                  value={form.name}
                  onChange={update('name')}
                  placeholder="Ada Lovelace"
                />
              </div>

              <div>
                <label
                  htmlFor="contact-email"
                  className="mb-1.5 block font-mono text-[10px] tracking-[0.2em] text-slate-500"
                >
                  EMAIL
                </label>
                <input
                  id="contact-email"
                  type="email"
                  className={`clip-tag ${inputClass}`}
                  required
                  autoComplete="email"
                  value={form.email}
                  onChange={update('email')}
                  placeholder="you@company.com"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="contact-message"
                className="mb-1.5 block font-mono text-[10px] tracking-[0.2em] text-slate-500"
              >
                MESSAGE
              </label>
              <textarea
                id="contact-message"
                rows={5}
                className={`clip-tag resize-none ${inputClass}`}
                required
                value={form.message}
                onChange={update('message')}
                placeholder="Tell me about the role, the product, or the problem…"
              />
            </div>

            {status === 'error' && (
              <div className="clip-tag flex items-start gap-2.5 border border-neon-red/40 bg-neon-red/10 p-3 text-xs text-red-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {error} You can email directly at{' '}
                  <a className="underline" href={`mailto:${links.email}`}>
                    {links.email}
                  </a>
                  .
                </span>
              </div>
            )}

            <button
              type="submit"
              disabled={status === 'sending'}
              className="clip-tag flex w-full items-center justify-center gap-2 bg-gradient-to-r from-neon-pink to-neon-violet px-6 py-4 font-display text-sm font-black tracking-[0.14em] text-void-950 transition hover:brightness-110 disabled:opacity-60"
            >
              {status === 'sending' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> TRANSMITTING…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" /> TRANSMIT SIGNAL
                </>
              )}
            </button>
          </form>

          {/* Direct channels, straight from the socials config */}
          <div className="mt-6 border-t border-white/[0.07] pt-5">
            <SocialLinks includeEmail size="sm" />
          </div>
        </>
      )}
    </ModalShell>
  );
};
