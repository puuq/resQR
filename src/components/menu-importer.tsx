'use client';
import { useEffect, useState } from 'react';
import { FileText, LoaderCircle, Trash2, Upload } from 'lucide-react';
import { api } from '@/lib/client';
import {
  MENU_FILE_ACCEPT,
  menuFileError,
  type ImportedDish,
  type MenuExtraction,
} from '@/lib/menu-import';
import { ErrorBox } from './ui';

export function MenuImporter({
  items,
  onChange,
  reviewed,
  onReviewed,
  onBusy,
}: {
  items: ImportedDish[];
  onChange: (items: ImportedDish[]) => void;
  reviewed: boolean;
  onReviewed: (value: boolean) => void;
  onBusy: (value: boolean) => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    api<{ enabled: boolean }>('/api/menu-import')
      .then((result) => {
        if (active) setEnabled(result.enabled);
      })
      .catch((error) => {
        if (active) setError(error.message);
      });
    return () => {
      active = false;
    };
  }, []);
  function update(next: ImportedDish[]) {
    onChange(next);
    onReviewed(false);
  }
  function edit(index: number, patch: Partial<ImportedDish>) {
    update(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }
  async function read() {
    const problem = menuFileError(files);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    onBusy(true);
    setError('');
    const form = new FormData();
    files.forEach((file) => form.append('files', file));
    try {
      const result = await api<MenuExtraction>('/api/menu-import', {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(110000),
      });
      update(result.items);
      setWarnings(result.warnings);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <section className="menu-import" aria-label="Import restaurant menu">
      <div className="form-divider">
        <span>IMPORT YOUR MENU · OPTIONAL</span>
      </div>
      <h3>
        <FileText size={18} /> Turn menu pages into dishes
      </h3>
      <p>
        Upload a PDF or clear photos of your menu. Review the dishes here before creating the
        restaurant.
      </p>
      {enabled === false && (
        <p className="menu-import-notice" role="status">
          The menu reader isn’t connected yet. Add a Gemini API key to enable automatic reading.
        </p>
      )}
      <fieldset disabled={busy}>
        <label className="button secondary menu-file-picker">
          <Upload size={16} /> Choose menu files
          <input
            type="file"
            accept={MENU_FILE_ACCEPT}
            multiple
            hidden
            disabled={busy || items.length > 0}
            onChange={(event) => {
              const selected = Array.from(event.target.files || []);
              event.target.value = '';
              const next = [...files];
              for (const file of selected)
                if (
                  !next.some(
                    (existing) =>
                      existing.name === file.name &&
                      existing.size === file.size &&
                      existing.lastModified === file.lastModified,
                  )
                )
                  next.push(file);
              const problem = menuFileError(next);
              setError(problem);
              if (!problem) setFiles(next);
            }}
          />
        </label>
        <small>PDF, JPG, PNG or WebP · up to 10 files · 8 MB each, 10 MB total</small>
        {!!files.length && (
          <ul className="menu-file-list">
            {files.map((file, i) => (
              <li key={`${file.name}-${i}`}>
                <span>
                  {file.name} <small>({(file.size / 1024 / 1024).toFixed(1)} MB)</small>
                </span>
                {!items.length && (
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Remove file ${file.name}`}
                    onClick={() => setFiles(files.filter((_, index) => index !== i))}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="menu-import-disclosure">
          Reading sends these menu files to Google Gemini. On its free tier, Google may use them to
          improve its products. Upload public menu pages only. resQR does not keep the original
          files.
        </p>
        <div className="menu-import-actions">
          <button
            type="button"
            className="button secondary"
            disabled={enabled !== true || !files.length}
            onClick={read}
          >
            {busy ? <LoaderCircle size={16} className="spin" /> : <FileText size={16} />}
            {busy
              ? 'Reading menu…'
              : items.length
                ? 'Read again (replaces draft)'
                : 'Read menu files'}
          </button>
          {!!(files.length || items.length) && (
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setFiles([]);
                update([]);
                setWarnings([]);
                setError('');
              }}
            >
              Start over
            </button>
          )}
        </div>
        {busy && <p role="status">This can take about a minute. Keep this form open.</p>}
        <ErrorBox message={error} />
        {!!items.length && (
          <div className="menu-draft">
            <h4>{items.length} dishes to review</h4>
            <p>
              Check prices, variants and dietary labels against the original menu. Remove duplicates
              or anything that was read incorrectly.
            </p>
            {!!warnings.length && (
              <ul className="menu-import-notice">
                {warnings.map((warning, i) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
            )}
            {items.map((item, index) => (
              <article className="menu-draft-item" key={index}>
                <div className="menu-draft-heading">
                  <strong>Dish {index + 1}</strong>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Remove dish ${index + 1}`}
                    onClick={() => update(items.filter((_, i) => i !== index))}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                {item.note && <p className="menu-import-notice">{item.note}</p>}
                <div className="form-grid">
                  <label>
                    Dish name
                    <input
                      aria-label={`Dish ${index + 1} name`}
                      required
                      maxLength={100}
                      value={item.name}
                      onChange={(e) => edit(index, { name: e.target.value })}
                    />
                  </label>
                  <label>
                    Category
                    <input
                      aria-label={`Dish ${index + 1} category`}
                      required
                      maxLength={60}
                      value={item.category}
                      onChange={(e) => edit(index, { category: e.target.value })}
                    />
                  </label>
                  <label>
                    Price (Rs.)
                    <input
                      aria-label={`Dish ${index + 1} price`}
                      type="number"
                      required
                      min={0}
                      max={100000}
                      step="0.01"
                      value={item.price ?? ''}
                      placeholder="Check original menu"
                      onChange={(e) =>
                        edit(index, {
                          price: e.target.value === '' ? null : Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <label>
                    Dietary label
                    <select
                      aria-label={`Dish ${index + 1} dietary label`}
                      value={
                        item.vegetarian === null ? 'unknown' : item.vegetarian ? 'veg' : 'nonveg'
                      }
                      onChange={(e) =>
                        edit(index, {
                          vegetarian:
                            e.target.value === 'unknown' ? null : e.target.value === 'veg',
                        })
                      }
                    >
                      <option value="unknown">Not specified</option>
                      <option value="veg">Vegetarian</option>
                      <option value="nonveg">Nonvegetarian</option>
                    </select>
                  </label>
                </div>
                <label>
                  Description
                  <textarea
                    aria-label={`Dish ${index + 1} description`}
                    rows={2}
                    maxLength={400}
                    value={item.description}
                    onChange={(e) => edit(index, { description: e.target.value })}
                  />
                </label>
              </article>
            ))}
            <label className="check-label menu-draft-confirm">
              <input
                type="checkbox"
                checked={reviewed}
                onChange={(e) => onReviewed(e.target.checked)}
              />
              <span>
                I checked the imported dishes and prices.
                <small>
                  These {items.length} dishes will be added when you create the restaurant.
                </small>
              </span>
            </label>
          </div>
        )}
      </fieldset>
    </section>
  );
}
