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
  Star,
  UtensilsCrossed,
} from 'lucide-react';
import { api, menuStyle, money, sharedGuestKey } from '@/lib/client';
import type { PublicMenu, ServiceRequest } from '@/lib/types';
import { ErrorBox, Loading } from './ui';
import { MenuAdvertisement, MenuPromotions } from './menu-promotions';
import { CustomerShowcases } from './customer-showcases';
// Temporarily disabled until the apps and sponsor content are ready. Keep both layouts for later.
const SHOW_MENU_SPONSORS = false;
export function CustomerMenu({ tableToken, slug }: { tableToken?: string; slug?: string }) {
  const [data, setData] = useState<PublicMenu | null>(null);
  const [error, setError] = useState('');
  const [callError, setCallError] = useState('');
  const [call, setCall] = useState<ServiceRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [adDismissed, setAdDismissed] = useState(false);
  const [guestKey, setGuestKey] = useState('');
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    let active = true;
    setAdDismissed(false);
    setData(null);
    setCall(null);
    setGuestKey('');
    setCallError('');
    setError('');
    callRevision.current++;
    api<PublicMenu>(
      `/api/public?${tableToken ? `table=${tableToken}` : `slug=${encodeURIComponent(slug || '')}`}`,
    )
      .then((d) => {
        if (active) {
          setGuestKey(d.table?.is_shared && tableToken ? sharedGuestKey(tableToken) : '');
          setData(d);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      mounted.current = false;
      active = false;
    };
  }, [tableToken, slug]);
  const callRevision = useRef(0);
  const refreshInFlight = useRef(false);
  const refresh = useCallback(async () => {
    if (!tableToken || !data || (data.table?.is_shared && !guestKey) || refreshInFlight.current)
      return;
    refreshInFlight.current = true;
    const revision = callRevision.current;
    try {
      const result = await api<{ call: ServiceRequest | null }>(
        `/api/calls?table=${tableToken}${data.table?.is_shared ? `&guest=${guestKey}` : ''}`,
      );
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
  }, [tableToken, data, guestKey]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (!tableToken || !call || call.status === 'completed') return;
    const timer = setInterval(() => void refresh(), 5000);
    return () => clearInterval(timer);
  }, [tableToken, call?.status, refresh, !!call]);
  async function callWaiter() {
    if (!tableToken || !data || (data.table?.is_shared && !guestKey)) return;
    callRevision.current++;
    setBusy(true);
    setCallError('');
    try {
      const result = await api<{ call: ServiceRequest }>('/api/calls', {
        method: 'POST',
        body: JSON.stringify({
          token: tableToken,
          ...(data.table?.is_shared ? { guest: guestKey } : {}),
        }),
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
  const showcases = (data.showcases || []).filter(
    (section) =>
      section.enabled && section.item_ids.some((id) => data.menu.some((item) => item.id === id)),
  );
  const categories = [
    { value: 'All', label: 'All' },
    ...showcases.map((section) => ({ value: `showcase:${section.slot}`, label: section.title })),
    ...[...new Set(data.menu.map((i) => i.category))].map((name) => ({
      value: `category:${name}`,
      label: name,
    })),
  ];
  const matchesSearch = (item: (typeof data.menu)[number]) =>
    `${item.name} ${item.description}`.toLowerCase().includes(search.toLowerCase());
  const visibleShowcases = showcases
    .filter((section) => category === 'All' || category === `showcase:${section.slot}`)
    .map((section) => ({
      ...section,
      item_ids: section.item_ids.filter((id) =>
        data.menu.some((item) => item.id === id && matchesSearch(item)),
      ),
    }))
    .filter((section) => section.item_ids.length);
  const items = data.menu.filter(
    (i) => (category === 'All' || `category:${i.category}` === category) && matchesSearch(i),
  );
  const groups = new Map<string, typeof items>();
  for (const item of items) {
    const group = groups.get(item.category);
    if (group) group.push(item);
    else groups.set(item.category, [item]);
  }
  const active = !!call && call.status !== 'completed';
  return (
    <div
      className={`customer-page ${r.theme === 'dark' ? 'dark' : ''}`}
      style={menuStyle(r.color, r.menu_background)}
    >
      <main
        className="customer-scroll"
        tabIndex={0}
        aria-label={`${r.name} menu`}
        onScroll={(event) => {
          if (SHOW_MENU_SPONSORS && !adDismissed && event.currentTarget.scrollTop > 24)
            setAdDismissed(true);
        }}
      >
        <div className="customer-container">
          <header className="customer-top">
            <a href={`/r/${r.slug}`} className="customer-name">
              {r.logo ? (
                <img src={r.logo} alt={`${r.name} logo`} />
              ) : (
                <span className="customer-logo">
                  <Coffee size={20} />
                </span>
              )}
              <h1>{r.name}</h1>
            </a>
            {data.table && (
              <span className="table-chip">
                <span className="status-dot" />
                {data.table.label}
              </span>
            )}
          </header>
          <section className="customer-menu-section">
            {r.google_review_url && (
              <div className="customer-section-title">
                <a
                  className="google-review-link"
                  href={r.google_review_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Review ${r.name} on Google (opens in a new tab)`}
                >
                  <Star size={14} aria-hidden="true" />
                  Review on Google
                  <ArrowUpRight size={13} aria-hidden="true" />
                </a>
              </div>
            )}
            {SHOW_MENU_SPONSORS && <MenuPromotions />}
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
                  className={category === c.value ? 'selected' : ''}
                  key={c.value}
                  aria-pressed={category === c.value}
                  onClick={() => setCategory(c.value)}
                >
                  {c.label}
                </button>
              ))}
            </nav>
            {!!visibleShowcases.length && (
              <CustomerShowcases sections={visibleShowcases} menu={data.menu} />
            )}
            {!items.length && !visibleShowcases.length ? (
              <div className="empty-panel">
                <UtensilsCrossed size={30} />
                <h2>
                  {data.menu.length ? 'Nothing matches just yet.' : 'Good things are coming.'}
                </h2>
                <p>
                  {data.menu.length
                    ? 'Try another search or category.'
                    : 'Our menu is being updated. Please ask your waiter.'}
                </p>
              </div>
            ) : items.length ? (
              <div className="customer-items">
                {[...groups].map(([name, categoryItems]) => (
                  <section
                    className="customer-category"
                    key={name}
                    aria-label={`${name} menu items`}
                  >
                    <div className="customer-category-heading">
                      <h2 className="customer-category-title">{name}</h2>
                      <span className="customer-category-count">
                        {categoryItems.length} {categoryItems.length === 1 ? 'item' : 'items'}
                      </span>
                    </div>
                    <div className="customer-category-items">
                      {categoryItems.map((item) => (
                        <article
                          key={item.id}
                          className={`customer-item ${!item.available ? 'sold-out' : ''}`}
                        >
                          <div className="customer-item-body">
                            <div className="dish-heading">
                              <div className="dish-name">
                                <h3>{item.name}</h3>
                                {!!item.vegetarian && (
                                  <span
                                    className="dish-diet"
                                    title="Vegetarian"
                                    aria-label="Vegetarian"
                                  >
                                    <Leaf size={12} aria-hidden="true" /> Veg
                                  </span>
                                )}
                              </div>
                              <strong className="dish-price">
                                <span className="dish-currency">Rs.</span>{' '}
                                {money(item.price).slice(4)}
                              </strong>
                            </div>
                            {(item.image || item.description) && (
                              <div className="dish-details">
                                {item.image && (
                                  <img
                                    className="dish-image"
                                    src={item.image}
                                    alt={item.name}
                                    loading="lazy"
                                  />
                                )}
                                {item.description && <p>{item.description}</p>}
                              </div>
                            )}
                            {!item.available && (
                              <span className="sold-out-label">Sold out today</span>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : null}
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
        </div>
      </main>
      {SHOW_MENU_SPONSORS && (
        <div
          className={`customer-ad-rail ${adDismissed ? 'is-dismissed' : ''}`}
          aria-hidden={adDismissed}
          inert={adDismissed}
        >
          <div className="customer-ad-clip">
            <div className="customer-ad-inner">
              <MenuAdvertisement restaurant={r} />
            </div>
          </div>
        </div>
      )}
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
                        : data.table?.is_shared
                          ? 'General alert · let staff know where you’re seated.'
                          : 'Ready to order, or need something else?'}
                </small>
              </div>
            </div>
            <button
              className="button primary"
              disabled={busy || active || (!!data.table?.is_shared && !guestKey)}
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
