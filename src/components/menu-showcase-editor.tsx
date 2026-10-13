'use client';
import { useState, type FormEvent } from 'react';
import { Sparkles } from 'lucide-react';
import type { MenuShowcase, Workspace } from '@/lib/types';
import { api, money } from '@/lib/client';
import { ErrorBox, Modal } from './ui';

const defaults: MenuShowcase[] = [
  { slot: 1, title: 'Our most popular', description: '', enabled: false, item_ids: [] },
  { slot: 2, title: 'This week’s offers', description: '', enabled: false, item_ids: [] },
];

export function MenuShowcaseEditor({
  workspace,
  refresh,
}: {
  workspace: Workspace;
  refresh: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const active = (workspace.showcases || []).filter(
    (section) => section.enabled && section.item_ids.length,
  );
  return (
    <>
      <section className="panel showcase-summary">
        <div>
          <h2>
            <Sparkles size={18} /> Menu highlights
          </h2>
          <p>
            {active.length
              ? active.map((section) => section.title).join(' · ')
              : 'Show your popular dishes and current offers above the menu.'}
          </p>
        </div>
        <button className="button secondary" onClick={() => setOpen(true)}>
          Edit highlights
        </button>
      </section>
      {open && (
        <Modal title="Menu highlights" onClose={() => setOpen(false)}>
          <ShowcaseForm
            workspace={workspace}
            onSaved={async () => {
              await refresh();
              setOpen(false);
            }}
          />
        </Modal>
      )}
    </>
  );
}

function ShowcaseForm({
  workspace,
  onSaved,
}: {
  workspace: Workspace;
  onSaved: () => Promise<void>;
}) {
  const [sections, setSections] = useState(() =>
    defaults.map(
      (section) =>
        (workspace.showcases || []).find((saved) => saved.slot === section.slot) || section,
    ),
  );
  const [queries, setQueries] = useState(['', '']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const invalid = sections.some(
    (section) => !section.title.trim() || (section.enabled && !section.item_ids.length),
  );
  function update(index: number, change: Partial<MenuShowcase>) {
    setSections((previous) =>
      previous.map((section, i) => (i === index ? { ...section, ...change } : section)),
    );
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (invalid || busy) return;
    setBusy(true);
    setError('');
    try {
      await api('/api/menu-showcases', {
        method: 'PUT',
        body: JSON.stringify({ restaurant_id: workspace.restaurant.id, showcases: sections }),
      });
      await onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save}>
      <p className="showcase-help">
        Two optional sections for your specials, favourites or current offers. Select dishes from
        your menu; their prices and availability stay in sync. Add a new dish in Your menu first if
        needed.
      </p>
      <fieldset disabled={busy} className="showcase-form-fields">
        {sections.map((section, index) => (
          <section
            className="showcase-edit-section"
            key={section.slot}
            aria-label={`Highlight ${section.slot}`}
          >
            <div className="showcase-edit-heading">
              <strong>Highlight {section.slot}</strong>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={section.enabled}
                  onChange={(event) => update(index, { enabled: event.target.checked })}
                />{' '}
                Show on menu
              </label>
            </div>
            <label>
              Section {section.slot} title
              <input
                required
                maxLength={60}
                value={section.title}
                onChange={(event) => update(index, { title: event.target.value })}
              />
            </label>
            <label>
              Section {section.slot} message (optional)
              <textarea
                rows={2}
                maxLength={200}
                placeholder={
                  index === 0
                    ? 'Why guests love these dishes…'
                    : 'e.g. Festival offer: a free drink with any featured meal until Friday.'
                }
                value={section.description}
                onChange={(event) => update(index, { description: event.target.value })}
              />
            </label>
            <label>
              Find dishes for section {section.slot}
              <input
                type="search"
                value={queries[index]}
                placeholder="Search by dish or category…"
                onChange={(event) =>
                  setQueries((previous) =>
                    previous.map((query, i) => (i === index ? event.target.value : query)),
                  )
                }
              />
            </label>
            <div className="showcase-pick-count">
              <span>{section.item_ids.length}/12 selected</span>
              <small>Dishes appear in the order you select them.</small>
            </div>
            <div className="showcase-dish-picker">
              {workspace.menu
                .filter((item) =>
                  `${item.name} ${item.category}`
                    .toLowerCase()
                    .includes(queries[index].toLowerCase()),
                )
                .map((item) => (
                  <label key={item.id} className="showcase-dish-choice">
                    <input
                      type="checkbox"
                      checked={section.item_ids.includes(item.id)}
                      disabled={
                        !section.item_ids.includes(item.id) && section.item_ids.length >= 12
                      }
                      onChange={(event) =>
                        update(index, {
                          item_ids: event.target.checked
                            ? [...section.item_ids, item.id]
                            : section.item_ids.filter((id) => id !== item.id),
                        })
                      }
                    />
                    <span>
                      <strong>{item.name}</strong>
                      <small>
                        {item.category}
                        {!item.available ? ' · Sold out' : ''}
                      </small>
                    </span>
                    <span>{money(item.price)}</span>
                  </label>
                ))}
              {!workspace.menu.length && <p>Add your first menu item, then choose it here.</p>}
              {workspace.menu.length > 0 &&
                !workspace.menu.some((item) =>
                  `${item.name} ${item.category}`
                    .toLowerCase()
                    .includes(queries[index].toLowerCase()),
                ) && <p>No matching dishes. Try another search.</p>}
            </div>
            {section.enabled && !section.item_ids.length && (
              <p className="showcase-help">Select at least one dish to show this section.</p>
            )}
          </section>
        ))}
      </fieldset>
      <p className="showcase-help">
        Turn a section off when an offer ends. Messages are shown as written; they do not change
        dish prices automatically.
      </p>
      <ErrorBox message={error} />
      <div className="form-actions">
        <button className="button primary" disabled={busy || invalid}>
          {busy ? 'Saving…' : 'Save highlights'}
        </button>
      </div>
    </form>
  );
}
