'use client';
import { useState, type FormEvent } from 'react';
import { Trash2 } from 'lucide-react';
import type { Restaurant } from '@/lib/types';
import { api } from '@/lib/client';
import { ErrorBox, Modal } from './ui';

export function DeleteRestaurant({
  restaurant,
  onDeleted,
}: {
  restaurant: Restaurant;
  onDeleted: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  function close() {
    if (!busy) {
      setOpen(false);
      setName('');
      setError('');
    }
  }
  async function remove(event: FormEvent) {
    event.preventDefault();
    if (busy || name !== restaurant.name) return;
    setBusy(true);
    setError('');
    try {
      await api('/api/restaurants', {
        method: 'DELETE',
        body: JSON.stringify({ id: restaurant.id, confirm_name: name }),
      });
      await onDeleted();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="restaurant-danger-zone">
        <div>
          <h3>Delete restaurant</h3>
          <p>Remove this restaurant and revoke its QR links and team access.</p>
        </div>
        <button type="button" className="button danger-button" onClick={() => setOpen(true)}>
          <Trash2 size={16} /> Delete restaurant
        </button>
      </div>
      {open && (
        <Modal title="Delete this restaurant?" onClose={close}>
          <form onSubmit={remove} className="delete-restaurant-form">
            <p>
              This permanently removes <strong>{restaurant.name}</strong>, its menu items, table and
              shared QR links, staff accounts, and call history. Printed QR cards will stop working.
              This cannot be undone in resQR.
            </p>
            <p className="muted">Uploaded images are retained in platform storage.</p>
            <label>
              Type the restaurant name to confirm
              <input
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="off"
                disabled={busy}
                maxLength={100}
              />
            </label>
            <ErrorBox message={error} />
            <div className="form-actions">
              <button type="button" className="button secondary" onClick={close} disabled={busy}>
                Cancel
              </button>
              <button className="button danger-button" disabled={busy || name !== restaurant.name}>
                {busy ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
