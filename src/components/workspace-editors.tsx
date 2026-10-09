'use client';
import { useState, type FormEvent } from 'react';
import {
  ArrowUpRight,
  Download,
  Edit3,
  Leaf,
  Plus,
  Printer,
  QrCode,
  Search,
  Trash2,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import QRCode from 'qrcode';
import type { MenuItem, Workspace } from '@/lib/types';
import { api, money } from '@/lib/client';
import { ErrorBox, ImageUpload, Modal } from './ui';
type Props = { workspace: Workspace; refresh: () => Promise<void> };
export function MenuEditor({ workspace, refresh }: Props) {
  const [editing, setEditing] = useState<MenuItem | 'new' | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<MenuItem | null>(null);
  const [busy, setBusy] = useState(false);
  const filtered = workspace.menu.filter((m) =>
    (m.name + ' ' + m.category).toLowerCase().includes(search.toLowerCase()),
  );
  async function toggle(item: MenuItem) {
    try {
      await api('/api/menu', {
        method: 'POST',
        body: JSON.stringify({
          ...item,
          price: item.price / 100,
          available: !item.available,
          vegetarian: !!item.vegetarian,
        }),
      });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <div className="section-toolbar">
        <div>
          <h2>
            Your menu <span className="count-pill">{workspace.menu.length}</span>
          </h2>
          <p>Prices are displayed in Nepalese rupees.</p>
        </div>
        <div className="toolbar-actions">
          <label className="search-field">
            <Search size={16} />
            <input
              aria-label="Search menu"
              placeholder="Search dishes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <button className="button primary" onClick={() => setEditing('new')}>
            <Plus size={17} />
            Add item
          </button>
        </div>
      </div>
      <ErrorBox message={error} />
      {!filtered.length ? (
        <div className="empty-panel">
          <UtensilsCrossed size={35} />
          <h2>{search ? 'No matching dishes.' : 'Let’s put something on the menu.'}</h2>
          <p>Add your first dish or drink to get started.</p>
        </div>
      ) : (
        <section className="panel menu-table">
          <div className="menu-table-header">
            <span>ITEM</span>
            <span>PRICE</span>
            <span>AVAILABILITY</span>
            <span />
          </div>
          {filtered.map((item) => (
            <div className="menu-row" key={item.id}>
              <div className="menu-item-info">
                <div className="item-thumb">
                  {item.image ? <img src={item.image} alt="" /> : <UtensilsCrossed size={21} />}
                </div>
                <div>
                  <small>{item.category}</small>
                  <strong>
                    {item.name}
                    {!!item.vegetarian && <Leaf size={13} />}
                  </strong>
                  <p>{item.description}</p>
                </div>
              </div>
              <strong className="item-price">{money(item.price)}</strong>
              <button
                className={`availability ${item.available ? 'available' : ''}`}
                onClick={() => void toggle(item)}
                aria-label={`${item.available ? 'Mark sold out' : 'Mark available'}: ${item.name}`}
              >
                <span />
                {item.available ? 'Available' : 'Sold out'}
              </button>
              <div className="row-actions">
                <button
                  className="icon-button"
                  aria-label={`Edit ${item.name}`}
                  onClick={() => setEditing(item)}
                >
                  <Edit3 size={16} />
                </button>
                <button
                  className="icon-button danger"
                  aria-label={`Delete ${item.name}`}
                  onClick={() => setDeleting(item)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </section>
      )}
      {editing && (
        <Modal
          title={editing === 'new' ? 'Something new on the menu.' : 'Edit menu item'}
          onClose={() => setEditing(null)}
        >
          <MenuForm
            key={editing === 'new' ? 'new' : editing.id}
            item={editing === 'new' ? undefined : editing}
            workspace={workspace}
            onSaved={async () => {
              setEditing(null);
              await refresh();
            }}
          />
        </Modal>
      )}
      {deleting && (
        <Modal title="Remove this menu item?" onClose={() => setDeleting(null)}>
          <p>
            Remove <strong>{deleting.name}</strong> from the customer menu? You can mark it sold out
            instead if it’s only unavailable today.
          </p>
          <ErrorBox message={error} />
          <div className="form-actions">
            <button className="button secondary" onClick={() => setDeleting(null)}>
              Keep item
            </button>
            <button
              className="button danger-button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api('/api/menu', {
                    method: 'DELETE',
                    body: JSON.stringify({
                      id: deleting.id,
                      restaurant_id: workspace.restaurant.id,
                    }),
                  });
                  setDeleting(null);
                  await refresh();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? 'Removing…' : 'Remove item'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
function MenuForm({
  item,
  workspace,
  onSaved,
}: {
  item?: MenuItem;
  workspace: Workspace;
  onSaved: () => void;
}) {
  const [image, setImage] = useState(item?.image || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const f = new FormData(e.currentTarget);
    try {
      await api('/api/menu', {
        method: 'POST',
        body: JSON.stringify({
          ...Object.fromEntries(f),
          id: item?.id,
          restaurant_id: workspace.restaurant.id,
          price: Number(f.get('price')),
          available: f.get('available') === 'on',
          vegetarian: f.get('vegetarian') === 'on',
          image,
          sort_order: item?.sort_order ?? workspace.menu.length,
        }),
      });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <label>
        Item name
        <input
          name="name"
          required
          maxLength={100}
          defaultValue={item?.name}
          placeholder="e.g. Masala chiya"
        />
      </label>
      <div className="form-grid">
        <label>
          Category
          <input
            name="category"
            required
            maxLength={60}
            list="menu-categories"
            defaultValue={item?.category}
            placeholder="e.g. Coffee & tea"
          />
          <datalist id="menu-categories">
            {Array.from(new Set(workspace.menu.map((m) => m.category))).map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label>
          Price (NPR)
          <input
            name="price"
            required
            type="number"
            min={0}
            max={100000}
            step="0.01"
            defaultValue={item ? item.price / 100 : undefined}
            placeholder="240"
          />
        </label>
      </div>
      <label>
        Description
        <textarea
          name="description"
          maxLength={400}
          rows={3}
          defaultValue={item?.description}
          placeholder="A few tasty details…"
        />
      </label>
      <ImageUpload value={image} onChange={setImage} label="Dish photo (optional)" />
      <div className="form-grid">
        <label className="check-label">
          <input name="available" type="checkbox" defaultChecked={item ? !!item.available : true} />
          Available to order
        </label>
        <label className="check-label">
          <input name="vegetarian" type="checkbox" defaultChecked={!!item?.vegetarian} />
          Vegetarian
        </label>
      </div>
      <ErrorBox message={error} />
      <div className="form-actions">
        <button className="button primary" disabled={busy}>
          {busy ? 'Saving…' : item ? 'Save changes' : 'Add to menu'}
        </button>
      </div>
    </form>
  );
}
export function TableEditor({ workspace, refresh }: Props) {
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [rename, setRename] = useState<{ id: string; label: string } | null>(null);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const f = new FormData(e.currentTarget);
    try {
      await api('/api/tables', {
        method: 'POST',
        body: JSON.stringify({
          restaurant_id: workspace.restaurant.id,
          label: f.get('label'),
          id: rename?.id,
        }),
      });
      setAdding(false);
      setRename(null);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function download(token: string, label: string) {
    try {
      const data = await QRCode.toDataURL(`${workspace.qrBaseUrl}/t/${token}`, {
        width: 1000,
        margin: 4,
        errorCorrectionLevel: 'M',
      });
      const a = document.createElement('a');
      a.href = data;
      a.download = `${workspace.restaurant.slug}-${label.replace(/[^a-z0-9]/gi, '-')}.png`;
      a.click();
    } catch {
      setError('Could not generate the QR code. Please retry.');
    }
  }
  return (
    <>
      <div className="section-toolbar">
        <div>
          <h2>
            Connected tables <span className="count-pill">{workspace.tables.length}</span>
          </h2>
          <p>Each code is unique to its table. Menu changes won’t affect it.</p>
        </div>
        <div className="toolbar-actions">
          <a
            className="button secondary"
            href={`/print?restaurant=${workspace.restaurant.id}`}
            target="_blank"
            rel="noreferrer"
          >
            <Printer size={17} />
            Print table cards
          </a>
          <button className="button primary" onClick={() => setAdding(true)}>
            <Plus size={17} />
            Add table
          </button>
        </div>
      </div>
      <ErrorBox message={error} />
      <div className="table-grid">
        {workspace.tables.map((t) => (
          <article className="table-card" key={t.id}>
            <div className="table-card-top">
              <QrCode size={26} />
              <button
                className="icon-button"
                onClick={() => setRename({ id: t.id, label: t.label })}
                aria-label={`Rename ${t.label}`}
              >
                <Edit3 size={15} />
              </button>
            </div>
            <h3>{t.label}</h3>
            <span className="muted">Menu & waiter call</span>
            <div className="table-card-actions">
              <a className="text-link" href={`/t/${t.token}`} target="_blank" rel="noreferrer">
                Open menu
                <ArrowUpRight size={15} />
              </a>
              <button
                className="icon-button"
                aria-label={`Download QR for ${t.label}`}
                onClick={() => void download(t.token, t.label)}
              >
                <Download size={18} />
              </button>
            </div>
          </article>
        ))}
      </div>
      <div className="notice">
        <QrCode size={20} />
        <span>
          Test your printed codes on a phone before placing them. Keep the QR domain active to
          preserve existing cards.
        </span>
      </div>
      {(adding || rename) && (
        <Modal
          title={rename ? 'Rename table' : 'Connect another table'}
          onClose={() => {
            setAdding(false);
            setRename(null);
          }}
        >
          <form onSubmit={save}>
            <label>
              Table label
              <input
                name="label"
                required
                maxLength={40}
                defaultValue={rename?.label || `Table ${workspace.tables.length + 1}`}
                placeholder="e.g. Terrace 2"
              />
            </label>
            <ErrorBox message={error} />
            <div className="form-actions">
              <button className="button primary" disabled={busy}>
                {busy ? 'Saving…' : rename ? 'Save label' : 'Create table QR'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
export function StaffEditor({ workspace, refresh }: Props) {
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await api('/api/staff', {
        method: 'POST',
        body: JSON.stringify({ ...data, restaurant_id: workspace.restaurant.id }),
      });
      setAdding(false);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="section-toolbar">
        <div>
          <h2>
            Your people <span className="count-pill">{workspace.staff.length}</span>
          </h2>
          <p>Owners manage the restaurant. Reception and waiters handle service.</p>
        </div>
        <button className="button primary" onClick={() => setAdding(true)}>
          <Plus size={17} />
          Add team member
        </button>
      </div>
      {!workspace.staff.length ? (
        <div className="empty-panel">
          <Users size={36} />
          <h2>Give your team a seat.</h2>
          <p>Create an owner or staff account so the restaurant can receive calls.</p>
        </div>
      ) : (
        <section className="panel">
          {workspace.staff.map((person) => (
            <div className="staff-row" key={person.id}>
              <span className="avatar">{person.name[0].toUpperCase()}</span>
              <div>
                <strong>{person.name}</strong>
                <small>{person.email}</small>
              </div>
              <span className="badge">{person.role}</span>
            </div>
          ))}
        </section>
      )}
      {adding && (
        <Modal title="Welcome someone to the team." onClose={() => setAdding(false)}>
          <form onSubmit={submit}>
            <label>
              Full name
              <input name="name" required minLength={2} maxLength={80} autoComplete="off" />
            </label>
            <label>
              Email address
              <input name="email" type="email" required autoComplete="off" />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                required
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
                placeholder="At least 12 characters"
              />
            </label>
            <label>
              Role
              <select name="role" defaultValue="waiter">
                <option value="waiter">Waiter — receive and handle calls</option>
                <option value="receptionist">Receptionist — handle all table calls</option>
                <option value="owner">Owner — manage menu, tables, branding and staff</option>
              </select>
            </label>
            <p className="muted">
              Share these sign-in details with your team member directly. No email is sent
              automatically.
            </p>
            <ErrorBox message={error} />
            <div className="form-actions">
              <button className="button primary" disabled={busy}>
                {busy ? 'Creating…' : 'Create staff account'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
