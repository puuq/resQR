'use client';
import { useCallback, useEffect, useState } from 'react';
import { Check, Inbox, Mail, MapPin, Phone, RefreshCw } from 'lucide-react';
import { api } from '@/lib/client';
import { ErrorBox, Loading } from './ui';

type Inquiry = {
  id: number;
  name: string;
  restaurant: string;
  location: string;
  phone: string;
  email: string;
  message: string;
  status: 'new' | 'contacted';
  created_at: number;
};
type Result = { inquiries: Inquiry[]; newCount: number; nextCursor: number | null };
export function InquiryInbox() {
  const [data, setData] = useState<Result | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api<Result>(`/api/inquiries${cursor ? `?before=${cursor}` : ''}`));
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [cursor]);
  useEffect(() => {
    void load();
  }, [load]);
  async function toggle(item: Inquiry) {
    setBusy(item.id);
    try {
      await api('/api/inquiries', {
        method: 'PATCH',
        body: JSON.stringify({ id: item.id, status: item.status === 'new' ? 'contacted' : 'new' }),
      });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR NEXT RESTAURANTS</span>
          <h1>Setup requests.</h1>
          <p>Restaurant owners who want to bring resQR to their place.</p>
        </div>
        <button className="button secondary" disabled={loading} onClick={() => void load()}>
          <RefreshCw size={16} /> Refresh inbox
        </button>
      </div>
      <ErrorBox message={error} />
      <div className="inquiry-summary">
        <Inbox size={19} />
        <strong>{data?.newCount || 0} new requests</strong>
        <span>Contact owners directly using the details below. No automatic emails are sent.</span>
      </div>
      {loading ? (
        <Loading />
      ) : !data?.inquiries.length ? (
        <div className="empty-panel">
          <Inbox size={32} />
          <h2>{error ? 'The inbox couldn’t load.' : 'Your next connection starts here.'}</h2>
          <p>
            {error ? 'Try refreshing the inbox.' : 'Requests from the homepage will appear here.'}
          </p>
        </div>
      ) : (
        <div className="inquiry-list">
          {data.inquiries.map((item) => (
            <article className="panel inquiry-card" key={item.id}>
              <header>
                <div>
                  <span className={`inquiry-status ${item.status}`}>
                    {item.status === 'new' ? 'New request' : 'Contacted'}
                  </span>
                  <h2>{item.restaurant}</h2>
                  <p>
                    {item.name} <span>·</span>{' '}
                    {new Date(item.created_at).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      timeZone: 'Asia/Kathmandu',
                    })}
                  </p>
                </div>
                <button
                  className="button secondary"
                  disabled={busy === item.id}
                  onClick={() => void toggle(item)}
                >
                  {item.status === 'new' ? (
                    <>
                      <Check size={15} /> Mark contacted
                    </>
                  ) : (
                    'Mark as new'
                  )}
                </button>
              </header>
              <div className="inquiry-contact">
                <span>
                  <MapPin size={15} /> {item.location}
                </span>
                <a href={`tel:${item.phone.replace(/[^+\d]/g, '')}`}>
                  <Phone size={15} /> {item.phone}
                </a>
                {item.email && (
                  <a href={`mailto:${encodeURIComponent(item.email)}`}>
                    <Mail size={15} /> {item.email}
                  </a>
                )}
              </div>
              {item.message && <p className="inquiry-message">{item.message}</p>}
            </article>
          ))}
        </div>
      )}
      <div className="inquiry-pagination">
        {cursor && (
          <button className="button secondary" disabled={loading} onClick={() => setCursor(null)}>
            Back to latest
          </button>
        )}
        {data?.nextCursor && (
          <button
            className="button secondary"
            disabled={loading}
            onClick={() => setCursor(data.nextCursor)}
          >
            Older requests
          </button>
        )}
      </div>
    </>
  );
}
