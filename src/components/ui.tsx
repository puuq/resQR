'use client';
import { QrCode, LoaderCircle, Upload, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { api } from '@/lib/client';
export function Logo({ small = false }: { small?: boolean }) {
  return (
    <a className={`wordmark ${small ? 'small' : ''}`} href="/">
      <span className="logo-icon">
        <QrCode size={small ? 20 : 24} />
      </span>
      <span>
        res<span className="wordmark-qr">QR</span>
        <span className="logo-dot">.</span>
      </span>
    </a>
  );
}
export function Loading() {
  return (
    <div className="loading">
      <LoaderCircle className="spin" size={25} />
      <span>Getting things ready…</span>
    </div>
  );
}
export function ErrorBox({ message }: { message: string }) {
  return message ? (
    <div className="error-box" role="alert">
      {message}
    </div>
  ) : null;
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-heading">
          <h2>{title}</h2>
          <button className="icon-button" aria-label="Close dialog" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
export function ImageUpload({
  value,
  onChange,
  label = 'Upload image',
}: {
  value: string;
  onChange: (s: string) => void;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <div className="image-upload">
      {value && <img src={value} alt="Uploaded preview" />}
      <label className="button secondary">
        {busy ? <LoaderCircle className="spin" size={16} /> : <Upload size={16} />}{' '}
        {busy ? 'Uploading…' : label}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          disabled={busy}
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setBusy(true);
            setError('');
            try {
              const form = new FormData();
              form.set('file', file);
              onChange(
                (await api<{ url: string }>('/api/media', { method: 'POST', body: form })).url,
              );
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      {value && (
        <button type="button" className="text-button" onClick={() => onChange('')}>
          Remove
        </button>
      )}
      <small>PNG, JPG, WebP or GIF · up to 3 MB</small>
      <ErrorBox message={error} />
    </div>
  );
}
