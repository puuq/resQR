'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowUpRight, Check, LoaderCircle } from 'lucide-react';
import { api } from '@/lib/client';
import { ErrorBox } from './ui';

export function SetupRequestForm() {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const success = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (sent) success.current?.focus();
  }, [sent]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setError('');
    try {
      await api('/api/inquiries', {
        method: 'POST',
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      form.reset();
      setSent(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (sent)
    return (
      <div className="setup-success" role="status" tabIndex={-1} ref={success}>
        <span className="setup-success-icon">
          <Check size={28} />
        </span>
        <h3>You’re on our list.</h3>
        <p>
          Your setup request has reached the resQR team. We’ll use the contact details you shared to
          discuss your place and help you get started.
        </p>
        <small>You don’t need to create an account or pay to request setup.</small>
        <button className="button secondary" onClick={() => setSent(false)}>
          Send another request
        </button>
      </div>
    );
  return (
    <form className="setup-request-form" onSubmit={submit} aria-label="Restaurant setup request">
      <div className="form-grid">
        <label>
          Your name
          <input
            name="name"
            autoComplete="name"
            required
            minLength={2}
            maxLength={80}
            placeholder="What should we call you?"
          />
        </label>
        <label>
          Restaurant / café name
          <input
            name="restaurant"
            autoComplete="organization"
            required
            minLength={2}
            maxLength={100}
            placeholder="Your place’s name"
          />
        </label>
      </div>
      <div className="form-grid">
        <label>
          City or area
          <input
            name="location"
            autoComplete="address-level2"
            required
            minLength={2}
            maxLength={120}
            placeholder="e.g. Jhamsikhel, Lalitpur"
          />
        </label>
        <label>
          Phone number
          <input
            name="phone"
            type="tel"
            autoComplete="tel"
            required
            minLength={7}
            maxLength={30}
            placeholder="e.g. 98XXXXXXXX"
          />
        </label>
      </div>
      <label>
        Email <span className="optional-label">(optional)</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          maxLength={254}
          placeholder="you@example.com"
        />
      </label>
      <label>
        Anything you’d like us to know? <span className="optional-label">(optional)</span>
        <textarea
          name="message"
          rows={3}
          maxLength={1000}
          placeholder="Tell us a little about your café, tables, or what you need."
        />
      </label>
      <div className="inquiry-honeypot" aria-hidden="true">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <ErrorBox message={error} />
      <button className="button primary large full-width" disabled={busy}>
        {busy ? (
          <>
            <LoaderCircle className="spin" size={18} /> Sending request…
          </>
        ) : (
          <>
            Let’s get your place connected <ArrowUpRight size={19} />
          </>
        )}
      </button>
      <p className="contact-note">
        By sending this form, you agree that resQR may contact you about this request. Your details
        are visible only to the resQR administrator.
      </p>
    </form>
  );
}
