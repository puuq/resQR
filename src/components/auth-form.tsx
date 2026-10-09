'use client';
import { useState, type FormEvent } from 'react';
import { ArrowRight, BellRing, Check, Coffee, QrCode, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/client';
import { ErrorBox, Logo } from './ui';
export function AuthForm({ setup = false }: { setup?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await api('/api/auth', {
        method: 'POST',
        body: JSON.stringify({ ...data, action: setup ? 'setup' : 'login' }),
      });
      window.location.href = '/dashboard';
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <aside className="auth-story">
        <Logo />
        <div className="auth-story-body">
          <span className="eyebrow light">GOOD SERVICE STARTS HERE</span>
          <h1>
            Less waiting.
            <br />
            More <em>good moments.</em>
          </h1>
          <p>
            A menu in their pocket. A little nudge for your team. Bring your café closer to every
            guest.
          </p>
          <div className="table-illustration">
            <div className="illustration-circle" />
            <div className="coffee-cup">
              <Coffee size={60} strokeWidth={1} />
            </div>
            <div className="mini-qr">
              <QrCode size={64} />
              <strong>Make yourself at home.</strong>
              <span>Scan. Explore. Call us over.</span>
            </div>
            <div className="floating-call">
              <span className="round-icon">
                <BellRing size={21} />
              </span>
              <div>
                <strong>Table 04 needs you</strong>
                <small>A little attention goes a long way.</small>
              </div>
              <Check size={18} />
            </div>
          </div>
        </div>
        <footer>
          Made for the places that bring people together.<span>NEPAL · resQR</span>
        </footer>
      </aside>
      <section className="auth-form-side">
        <div className="auth-mobile-logo">
          <Logo />
        </div>
        <div className="auth-form-wrap">
          <span className="eyebrow">YOUR SERVICE, SIMPLIFIED</span>
          <h2>{setup ? 'Let’s open the doors.' : 'Welcome back.'}</h2>
          <p className="muted">
            {setup
              ? 'Create your private platform administrator account.'
              : 'Sign in to keep your tables happy and your team in sync.'}
          </p>
          <form onSubmit={submit}>
            {setup && (
              <>
                <label>
                  Your name
                  <input
                    name="name"
                    required
                    minLength={2}
                    maxLength={80}
                    autoComplete="name"
                    placeholder="Your name"
                  />
                </label>
                <label>
                  Setup token
                  <input
                    name="token"
                    type="password"
                    required
                    autoComplete="off"
                    placeholder="From your local or Cloudflare configuration"
                  />
                </label>
              </>
            )}
            <label>
              Email address
              <input
                name="email"
                type="email"
                required
                autoComplete="username"
                placeholder="you@yourcafe.com"
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                minLength={12}
                maxLength={128}
                required
                autoComplete={setup ? 'new-password' : 'current-password'}
                placeholder="At least 12 characters"
              />
            </label>
            <ErrorBox message={error} />
            <button className="button primary large" disabled={busy}>
              {busy ? 'One moment…' : setup ? 'Create account' : 'Sign in'}
              <ArrowRight size={18} />
            </button>
          </form>
          <div className="auth-note">
            <ShieldCheck size={17} />
            <span>
              {setup
                ? 'Setup works once and requires your private token.'
                : 'Need access? Ask your restaurant owner or resQR administrator.'}
            </span>
          </div>
        </div>
        <footer className="auth-footer">Thoughtful technology. Better hospitality.</footer>
      </section>
    </main>
  );
}
