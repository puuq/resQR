'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  Building2,
  ChevronDown,
  ChevronRight,
  Coffee,
  LayoutGrid,
  LogOut,
  Menu,
  Palette,
  Plus,
  QrCode,
  Search,
  Settings2,
  Sparkles,
  Users,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import type { RestaurantSummary, User, Workspace } from '@/lib/types';
import { api, brandStyle } from '@/lib/client';
import { ErrorBox, Loading, Logo, Modal } from './ui';
import { RestaurantForm } from './restaurant-form';
import { MenuEditor, StaffEditor, TableEditor } from './workspace-editors';
import { ServiceQueue } from './service-queue';

type Tab = 'calls' | 'menu' | 'tables' | 'team' | 'settings';
export function Dashboard({ user }: { user: User }) {
  const [restaurants, setRestaurants] = useState<RestaurantSummary[]>([]);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [selected, setSelected] = useState<string | null>(user.restaurant_id);
  const [tab, setTab] = useState<Tab>('calls');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [create, setCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [mobile, setMobile] = useState(false);
  const loadList = useCallback(async () => {
    try {
      setRestaurants(
        (await api<{ restaurants: RestaurantSummary[] }>('/api/restaurants')).restaurants,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  const loadWorkspace = useCallback(async () => {
    if (!selected) return;
    try {
      setWorkspace(await api<Workspace>(`/api/workspace?restaurant=${selected}`));
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }, [selected]);
  useEffect(() => {
    void loadList();
  }, [loadList]);
  useEffect(() => {
    setWorkspace(null);
    void loadWorkspace();
  }, [loadWorkspace]);
  const managing = user.role === 'platform' || user.role === 'owner';
  const nav = [
    { key: 'calls' as Tab, label: 'Service queue', icon: Bell },
    { key: 'menu' as Tab, label: 'Menu', icon: UtensilsCrossed },
    { key: 'tables' as Tab, label: 'Tables & QR', icon: QrCode },
    { key: 'team' as Tab, label: 'Your team', icon: Users },
    { key: 'settings' as Tab, label: 'Brand & settings', icon: Palette },
  ];
  const titles = {
    calls: [
      'A little attention. A better visit.',
      'Every table, every request. Keep the good moments flowing.',
    ],
    menu: ['A menu worth exploring.', 'Keep your dishes, prices and availability up to date.'],
    tables: [
      'A connection at every table.',
      'Print a QR card, place it on the table, and you’re ready.',
    ],
    team: [
      'Good service is a team effort.',
      'Give your people the right access to their restaurant.',
    ],
    settings: ['Make it feel like your place.', 'Your colours, your logo, your personality.'],
  };
  const choose = (rid: string) => {
    setSelected(rid);
    setTab('calls');
    setMobile(false);
  };
  return (
    <div
      className="dashboard"
      style={workspace ? brandStyle(workspace.restaurant.color) : undefined}
    >
      {mobile && <div className="sidebar-scrim" onClick={() => setMobile(false)} />}
      <aside className={`sidebar ${mobile ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <Logo />
          <button
            className="icon-button mobile-only"
            aria-label="Close navigation"
            onClick={() => setMobile(false)}
          >
            <X size={20} />
          </button>
        </div>
        <div className="workspace-label">
          {user.role === 'platform' ? 'PLATFORM WORKSPACE' : 'RESTAURANT WORKSPACE'}
        </div>
        {user.role === 'platform' && (
          <button
            className={`nav-item ${!selected ? 'active' : ''}`}
            onClick={() => {
              setSelected(null);
              setWorkspace(null);
              setMobile(false);
              void loadList();
            }}
          >
            <LayoutGrid size={19} />
            Restaurants<span className="nav-count">{restaurants.length}</span>
          </button>
        )}
        {selected && (
          <>
            <div className="sidebar-venue">
              <span className="venue-avatar">
                {workspace?.restaurant.logo ? (
                  <img src={workspace.restaurant.logo} alt="" />
                ) : (
                  <Coffee size={19} />
                )}
              </span>
              <span>
                {workspace?.restaurant.name || 'Loading restaurant…'}
                <small>Restaurant workspace</small>
              </span>
              <ChevronDown size={15} />
            </div>
            <nav>
              {nav
                .filter((n) => managing || n.key === 'calls')
                .map((n) => (
                  <button
                    key={n.key}
                    className={`nav-item ${tab === n.key ? 'active' : ''}`}
                    onClick={() => {
                      setTab(n.key);
                      setMobile(false);
                    }}
                  >
                    <n.icon size={19} />
                    {n.label}
                  </button>
                ))}
            </nav>
          </>
        )}
        {!selected && (
          <div className="sidebar-hint">
            <QrCode size={27} />
            <strong>
              One scan.
              <br />A better experience.
            </strong>
            <p>Open a restaurant to manage its menu, tables and service.</p>
          </div>
        )}
        <div className="sidebar-bottom">
          <div className="pilot-label">
            <span className="status-dot" />
            PILOT EDITION
          </div>
          <div className="user-info">
            <span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>{user.name}</strong>
              <small>{user.role === 'platform' ? 'Platform administrator' : user.role}</small>
            </div>
            <button
              className="icon-button"
              title="Sign out"
              aria-label="Sign out"
              onClick={async () => {
                try {
                  await api('/api/auth', { method: 'DELETE' });
                  window.location.href = '/login';
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="dashboard-main">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-only"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={21} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{selected ? workspace?.restaurant.name || 'Restaurant' : 'Restaurants'}</strong>
            {selected && (
              <>
                <ChevronRight size={14} />
                <span>{nav.find((n) => n.key === tab)?.label}</span>
              </>
            )}
          </div>
          <span className="topbar-note">
            <span className="status-dot" /> Made for good hospitality
          </span>
        </header>
        <main className="main-content">
          <ErrorBox message={error} />
          {!selected ? (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">YOUR PLACES, CONNECTED</span>
                  <h1>
                    Your restaurants<span className="heading-dot">.</span>
                  </h1>
                  <p>A little less waiting. A lot more happy guests.</p>
                </div>
                <button className="button primary" onClick={() => setCreate(true)}>
                  <Plus size={18} />
                  Add restaurant
                </button>
              </div>
              <div className="overview-strip">
                <div>
                  <span className="stat-icon">
                    <Building2 size={22} />
                  </span>
                  <span>
                    <strong>{restaurants.length}</strong>
                    <small>Restaurants</small>
                  </span>
                </div>
                <div>
                  <span className="stat-icon">
                    <QrCode size={22} />
                  </span>
                  <span>
                    <strong>{restaurants.reduce((a, r) => a + r.table_count, 0)}</strong>
                    <small>Connected tables</small>
                  </span>
                </div>
                <div>
                  <span className="stat-icon">
                    <UtensilsCrossed size={22} />
                  </span>
                  <span>
                    <strong>{restaurants.reduce((a, r) => a + r.item_count, 0)}</strong>
                    <small>Menu items</small>
                  </span>
                </div>
                <div className="overview-message">
                  <Sparkles size={20} />
                  <span>
                    Small touches.
                    <br />
                    <strong>Better experiences.</strong>
                  </span>
                </div>
              </div>
              <div className="section-toolbar">
                <div>
                  <h2>
                    All restaurants <span className="count-pill">{restaurants.length}</span>
                  </h2>
                  <p>Everything you need to get a place up and running.</p>
                </div>
                <label className="search-field">
                  <Search size={17} />
                  <input
                    aria-label="Search restaurants"
                    placeholder="Find a restaurant…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
              </div>
              {loading ? (
                <Loading />
              ) : (
                <div className="restaurant-grid">
                  {restaurants
                    .filter((r) => r.name.toLowerCase().includes(search.toLowerCase()))
                    .map((r) => (
                      <button className="restaurant-card" key={r.id} onClick={() => choose(r.id)}>
                        <div
                          className="restaurant-card-art"
                          style={{ background: `${r.color}13`, color: r.color }}
                        >
                          <div className="art-rings" />
                          <span className="restaurant-card-logo">
                            {r.logo ? (
                              <img src={r.logo} alt="" />
                            ) : (
                              <Coffee size={41} strokeWidth={1.3} />
                            )}
                          </span>
                          <span className="card-live">
                            <span className="status-dot" />
                            Ready to serve
                          </span>
                        </div>
                        <div className="restaurant-card-body">
                          <div className="restaurant-card-title">
                            <h3>{r.name}</h3>
                            <ArrowUpRight size={19} />
                          </div>
                          <p>{r.address || r.tagline || 'Your next great guest experience'}</p>
                          <div className="restaurant-card-meta">
                            <span>
                              <QrCode size={15} />
                              {r.table_count} tables
                            </span>
                            <span>
                              <UtensilsCrossed size={15} />
                              {r.item_count} items
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  <button className="add-restaurant-card" onClick={() => setCreate(true)}>
                    <span className="add-circle">
                      <Plus size={26} />
                    </span>
                    <strong>A new place. A fresh start.</strong>
                    <p>
                      Add a restaurant, build its menu,
                      <br />
                      and connect the first table.
                    </p>
                    <span className="text-link">
                      Set up a restaurant <ArrowUpRight size={15} />
                    </span>
                  </button>
                </div>
              )}
              <div className="onboarding-strip">
                <span className="onboarding-icon">
                  <ArrowDownLeft size={25} />
                </span>
                <div>
                  <strong>From hello to your first table call.</strong>
                  <p>Create a place → add the menu → print table QRs → open the service queue.</p>
                </div>
                <span className="badge">NO CUSTOMER APP NEEDED</span>
              </div>
            </>
          ) : !workspace ? (
            <Loading />
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">{workspace.restaurant.name.toUpperCase()}</span>
                  <h1>{titles[tab][0]}</h1>
                  <p>{titles[tab][1]}</p>
                </div>
                <a
                  className="button secondary"
                  target="_blank"
                  rel="noreferrer"
                  href={`/r/${workspace.restaurant.slug}`}
                >
                  View menu
                  <ArrowUpRight size={16} />
                </a>
              </div>
              {tab === 'calls' && <ServiceQueue restaurantId={selected} user={user} />}
              {tab === 'menu' && managing && (
                <MenuEditor workspace={workspace} refresh={loadWorkspace} />
              )}
              {tab === 'tables' && managing && (
                <TableEditor workspace={workspace} refresh={loadWorkspace} />
              )}
              {tab === 'team' && managing && (
                <StaffEditor workspace={workspace} refresh={loadWorkspace} />
              )}
              {tab === 'settings' && managing && (
                <section className="panel settings-panel">
                  <div className="panel-title">
                    <Settings2 size={19} />
                    <h2>Restaurant details</h2>
                  </div>
                  <RestaurantForm
                    initial={workspace.restaurant}
                    canEditAd={user.role === 'platform'}
                    onSaved={async () => {
                      await loadWorkspace();
                      await loadList();
                    }}
                  />
                </section>
              )}
            </>
          )}
          <footer className="workspace-footer">
            <span>
              resQR <span>·</span> A little closer to your guests.
            </span>
            <span>Built for cafés & restaurants in Nepal</span>
          </footer>
        </main>
      </div>
      {create && (
        <Modal title="A new place at the table." onClose={() => setCreate(false)}>
          <RestaurantForm
            onSaved={async (rid) => {
              setCreate(false);
              await loadList();
              if (rid) choose(rid);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
