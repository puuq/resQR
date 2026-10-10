'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  BellRing,
  Check,
  CheckCheck,
  Coffee,
  Leaf,
  Search,
  UtensilsCrossed,
} from 'lucide-react';
import { api, brandStyle, money } from '@/lib/client';
import type { PublicMenu, ServiceRequest } from '@/lib/types';
import { ErrorBox, Loading } from './ui';
export function CustomerMenu({ tableToken, slug }: { tableToken?: string; slug?: string }) {
  const [data, setData] = useState<PublicMenu | null>(null);
  const [error, setError] = useState('');
  const [callError, setCallError] = useState('');
  const [call, setCall] = useState<ServiceRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [adFailed, setAdFailed] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    api<PublicMenu>(
      `/api/public?${tableToken ? `table=${tableToken}` : `slug=${encodeURIComponent(slug || '')}`}`,
    )
      .then((d) => {
        if (mounted.current) setData(d);
      })
      .catch((e) => setError(e.message));
    return () => {
      mounted.current = false;
    };
  }, [tableToken, slug]);
  const callRevision = useRef(0);
  const refreshInFlight = useRef(false);
  const refresh = useCallback(async () => {
    if (!tableToken || refreshInFlight.current) return;
    refreshInFlight.current = true;
    const revision = callRevision.current;
    try {
      const result = await api<{ call: ServiceRequest | null }>(`/api/calls?table=${tableToken}`);
      if (mounted.current && revision === callRevision.current) {
        setCall(result.call);
        setCallError('');
      }
    } catch {
      if (mounted.current && revision === callRevision.current)
        setCallError('Unable to refresh your request. Please check your connection.');
    } finally {
      refreshInFlight.current = false;
    }
  }, [tableToken]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (!tableToken || !call || call.status === 'completed') return;
    const timer = setInterval(() => void refresh(), 5000);
    return () => clearInterval(timer);
  }, [tableToken, call?.status, refresh, !!call]);
  async function callWaiter() {
    if (!tableToken) return;
    callRevision.current++;
    setBusy(true);
    setCallError('');
    try {
      const result = await api<{ call: ServiceRequest }>('/api/calls', {
        method: 'POST',
        body: JSON.stringify({ token: tableToken }),
      });
      setCall(result.call);
    } catch (e) {
      setCallError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (error)
    return (
      <main className="standalone">
        <Coffee size={35} />
        <h1>A little trouble finding your table.</h1>
        <ErrorBox message={error} />
        <p>Please ask a staff member for help.</p>
        <button className="button secondary" onClick={() => window.location.reload()}>
          Try again
        </button>
      </main>
    );
  if (!data) return <Loading />;
  const r = data.restaurant;
  const categories = ['All', ...new Set(data.menu.map((i) => i.category))];
  const items = data.menu.filter(
    (i) =>
      (category === 'All' || i.category === category) &&
      `${i.name} ${i.description}`.toLowerCase().includes(search.toLowerCase()),
  );
  const active = !!call && call.status !== 'completed';
  return (
    <div
      className={`customer-page ${r.theme === 'dark' ? 'dark' : ''}`}
      style={brandStyle(r.color)}
    >
      <main className="customer-container">
        <header className="customer-top">
          <a href={`/r/${r.slug}`} className="customer-name">
            {r.logo ? (
              <img src={r.logo} alt={`${r.name} logo`} />
            ) : (
              <span className="customer-logo">
                <Coffee size={23} />
              </span>
            )}
            <strong>{r.name}</strong>
          </a>
          {data.table && (
            <span className="table-chip">
              <span className="status-dot" />
              {data.table.label}
            </span>
          )}
        </header>
        {r.ad_image && !adFailed && (
          <aside className="sponsor-card">
            <img
              src={r.ad_image}
              alt={r.ad_title || 'Sponsor advertisement'}
              onError={() => setAdFailed(true)}
            />
            <div>
              <span className="sponsored-label">SPONSORED</span>
              <strong>{r.ad_title || 'A little local discovery'}</strong>
              {r.ad_url && (
                <a href={r.ad_url} target="_blank" rel="sponsored noopener noreferrer">
                  Discover more
                  <ArrowUpRight size={13} />
                </a>
              )}
            </div>
          </aside>
        )}
        <section className="customer-menu-section">
          <div className="customer-section-title">
            <h1>Menu</h1>
            <span>{data.menu.length} items</span>
          </div>
          <label className="search-field customer-search">
            <Search size={18} />
            <input
              aria-label="Search food and drinks"
              placeholder="Find your next favourite…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <nav className="category-tabs" aria-label="Menu categories">
            {categories.map((c) => (
              <button
                className={category === c ? 'selected' : ''}
                key={c}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </nav>
          {!items.length ? (
            <div className="empty-panel">
              <UtensilsCrossed size={30} />
              <h2>{data.menu.length ? 'Nothing matches just yet.' : 'Good things are coming.'}</h2>
              <p>
                {data.menu.length
                  ? 'Try another search or category.'
                  : 'Our menu is being updated. Please ask your waiter.'}
              </p>
            </div>
          ) : (
            <div className="customer-items">
              {items.map((item) => (
                <article
                  key={item.id}
                  className={`customer-item ${!item.available ? 'sold-out' : ''}`}
                >
                  <div className="customer-item-body">
                    <div className="dish-category">
                      {item.category}
                      {!!item.vegetarian && (
                        <span title="Vegetarian">
                          <Leaf size={12} />
                          Veg
                        </span>
                      )}
                    </div>
                    <h3>{item.name}</h3>
                    {item.description && <p>{item.description}</p>}
                    <div className="dish-bottom">
                      <strong>{money(item.price)}</strong>
                      {!item.available && <span className="sold-out-label">Sold out today</span>}
                    </div>
                  </div>
                  {item.image && (
                    <img className="dish-image" src={item.image} alt={item.name} loading="lazy" />
                  )}
                </article>
              ))}
            </div>
          )}
          <p className="menu-footnote">
            Please tell your waiter about any allergies or dietary requirements.
            <br />
            Orders are taken by your waiter. Prices shown in NPR.
          </p>
        </section>
        <footer className="customer-footer">
          <span>A little closer to your guests.</span>
          <strong>
            resQR<span>.</span>
          </strong>
        </footer>
      </main>
      {tableToken && (
        <div className="call-dock">
          <div className="call-dock-inner">
            <div className="call-copy" aria-live="polite">
              <span className="call-dock-icon">
                {call?.status === 'acknowledged' ? (
                  <CheckCheck size={23} />
                ) : call?.status === 'pending' ? (
                  <Check size={23} />
                ) : (
                  <BellRing size={23} />
                )}
              </span>
              <div>
                <strong>
                  {call?.status === 'pending'
                    ? 'Request sent'
                    : call?.status === 'acknowledged'
                      ? 'A waiter has acknowledged your request'
                      : call?.status === 'completed'
                        ? 'All taken care of?'
                        : 'Need a hand?'}
                </strong>
                <small>
                  {call?.status === 'pending'
                    ? 'Waiting for a staff member to acknowledge.'
                    : call?.status === 'acknowledged'
                      ? 'Thanks for your patience.'
                      : call?.status === 'completed'
                        ? 'You can call again when you need us.'
                        : 'Ready to order, or need something else?'}
                </small>
              </div>
            </div>
            <button
              className="button primary"
              disabled={busy || active}
              onClick={() => void callWaiter()}
            >
              {busy ? 'Sending…' : active ? 'Called' : 'Call waiter'}
              {!active && <BellRing size={17} />}
            </button>
            <div className="dock-error">
              <ErrorBox message={callError} />
              {callError && active && (
                <button className="text-button" onClick={() => void refresh()}>
                  Refresh status
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {!tableToken && (
        <div className="browse-note">
          Just browsing? Scan the QR at your table to call a waiter.
        </div>
      )}
    </div>
  );
}
