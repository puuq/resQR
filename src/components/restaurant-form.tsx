'use client';
import { useState, type FormEvent } from 'react';
import { ArrowRight, Check, Coffee } from 'lucide-react';
import type { Restaurant } from '@/lib/types';
import { api, menuStyle } from '@/lib/client';
import { isLightMenuBackground, menuPalette } from '@/lib/menu-appearance';
import { ErrorBox, ImageUpload } from './ui';
import { MenuImporter } from './menu-importer';
import type { ImportedDish } from '@/lib/menu-import';
export function RestaurantForm({
  initial,
  onSaved,
  canEditAd = true,
}: {
  initial?: Restaurant;
  onSaved: (id?: string) => void;
  canEditAd?: boolean;
}) {
  const [name, setName] = useState(initial?.name || '');
  const [slug, setSlug] = useState(initial?.slug || '');
  const [color, setColor] = useState(initial?.color || '#285847');
  const [theme, setTheme] = useState(initial?.theme || 'light');
  const [background, setBackground] = useState(initial?.menu_background || '');
  const backgroundError =
    background && !isLightMenuBackground(background)
      ? 'Choose a paler colour so the menu text stays readable.'
      : '';
  const backgroundColour = menuPalette(color, background).background;
  const [logo, setLogo] = useState(initial?.logo || '');
  const [adImage, setAdImage] = useState(initial?.ad_image || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [importedMenu, setImportedMenu] = useState<ImportedDish[]>([]);
  const [menuReviewed, setMenuReviewed] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [sampleMenu, setSampleMenu] = useState(true);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (importBusy || backgroundError) return;
    if (!initial && importedMenu.length && !menuReviewed) {
      setError(
        'Review the imported dishes and confirm their prices before creating the restaurant.',
      );
      return;
    }
    setBusy(true);
    setError('');
    setSaved(false);
    const f = new FormData(e.currentTarget);
    try {
      const result = await api<{ id?: string }>('/api/restaurants', {
        method: initial ? 'PATCH' : 'POST',
        body: JSON.stringify({
          ...Object.fromEntries(f),
          id: initial?.id,
          name,
          slug,
          color,
          theme,
          menu_background: background,
          logo,
          ad_image: adImage,
          table_count: Number(f.get('table_count') || 0),
          sample_menu: !initial && !importedMenu.length && sampleMenu,
          ...(!initial
            ? {
                menu_reviewed: menuReviewed,
                imported_menu: importedMenu.map((item) => ({
                  name: item.name,
                  category: item.category,
                  description: item.description,
                  price: item.price,
                  vegetarian: item.vegetarian === true,
                })),
              }
            : {}),
        }),
      });
      setSaved(true);
      onSaved(result.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="restaurant-form" onSubmit={submit}>
      <div className="form-grid">
        <label>
          Restaurant name
          <input
            required
            maxLength={100}
            minLength={2}
            placeholder="e.g. Juniper Coffee House"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!initial)
                setSlug(
                  e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-|-$/g, ''),
                );
            }}
          />
        </label>
        <label>
          Menu URL name
          <input
            required
            minLength={3}
            maxLength={60}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="juniper-coffee"
          />
          <small>/r/{slug || 'your-restaurant'}</small>
        </label>
      </div>
      <label>
        A few words about your place
        <input
          name="tagline"
          maxLength={160}
          defaultValue={initial?.tagline}
          placeholder="Good coffee. Slow mornings. Great company."
        />
      </label>
      <label>
        Location
        <input
          name="address"
          maxLength={200}
          defaultValue={initial?.address}
          placeholder="e.g. Jhamsikhel, Lalitpur"
        />
      </label>
      {!initial && (
        <div className="form-grid">
          <label>
            Number of tables (optional)
            <input
              name="table_count"
              aria-label="Number of tables (optional)"
              aria-describedby="table-count-help"
              type="number"
              min={0}
              max={100}
              placeholder="Leave blank for shared QR only"
            />
            <small id="table-count-help">
              A shared QR is always included. Enter a number to add individual table QRs.
            </small>
          </label>
          <label className="check-label">
            <input
              name="sample_menu"
              type="checkbox"
              checked={sampleMenu && !importedMenu.length}
              disabled={!!importedMenu.length || importBusy}
              onChange={(e) => setSampleMenu(e.target.checked)}
            />
            <span>
              Start with a sample menu<small>Edit these demo dishes before going live.</small>
            </span>
          </label>
        </div>
      )}
      {!initial && (
        <MenuImporter
          items={importedMenu}
          reviewed={menuReviewed}
          onReviewed={setMenuReviewed}
          onBusy={setImportBusy}
          onChange={(items) => {
            setImportedMenu(items);
            if (items.length) setSampleMenu(false);
          }}
        />
      )}
      <div className="form-divider">
        <span>MAKE IT YOURS</span>
      </div>
      <ImageUpload value={logo} onChange={setLogo} label="Restaurant logo" />
      <div className="form-grid">
        <label>
          Brand colour
          <div className="color-input">
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
            <span>{color.toUpperCase()}</span>
          </div>
        </label>
        <label>
          Menu appearance
          <select value={theme} onChange={(e) => setTheme(e.target.value as 'light' | 'dark')}>
            <option value="light">Warm & light</option>
            <option value="dark">Evening & dark</option>
          </select>
        </label>
      </div>
      <div className="menu-background-setting">
        <label>
          Menu background colour
          <div className="color-input">
            <input
              type="color"
              aria-label="Menu background colour"
              value={background || backgroundColour}
              onChange={(event) => setBackground(event.target.value)}
            />
            <span>{(background || backgroundColour).toUpperCase()}</span>
          </div>
        </label>
        <button
          type="button"
          className="text-button"
          disabled={!background}
          onClick={() => setBackground('')}
        >
          Use theme tint
        </button>
        <small>
          {background ? 'Custom colour.' : 'Automatic: a pale shade of your brand colour.'} Applies
          to the whole light menu page. Dark appearance keeps its dark background.
        </small>
        <ErrorBox message={backgroundError} />
      </div>
      <div
        className={`brand-preview ${theme === 'dark' ? 'dark' : ''}`}
        style={menuStyle(color, background)}
      >
        <span className="preview-logo">
          {logo ? <img src={logo} alt="" /> : <Coffee size={24} />}
        </span>
        <div>
          <small>LIVE BRAND PREVIEW</small>
          <strong>{name || 'Your restaurant'}</strong>
        </div>
        <span className="button primary">Call waiter</span>
      </div>
      <div className="form-divider">
        <span>GOOGLE REVIEWS · OPTIONAL</span>
      </div>
      <label>
        Google review link
        <input
          name="google_review_url"
          type="url"
          maxLength={1000}
          defaultValue={initial?.google_review_url}
          placeholder="https://g.page/r/…/review"
        />
      </label>
      <small>
        Copy your link from Google Business Profile → Read reviews → Get more reviews. Customers can
        open it from the Menu heading. Leave empty to hide the button.
      </small>
      {initial && canEditAd && (
        <>
          <div className="form-divider">
            <span>MENU ADVERTISEMENT · OPTIONAL</span>
          </div>
          <ImageUpload value={adImage} onChange={setAdImage} label="Advertisement image" />
          <label>
            Advertisement title
            <input
              name="ad_title"
              maxLength={120}
              defaultValue={initial.ad_title}
              placeholder="e.g. Discover a local favourite"
            />
          </label>
          <label>
            Advertisement destination
            <input name="ad_url" type="url" defaultValue={initial.ad_url} placeholder="https://…" />
          </label>
          <small>
            This fills the separate advertisement area within the menu. The resQR and Splitr
            promotions at the top are independent. Without an image, the ad space stays empty.
          </small>
        </>
      )}
      <ErrorBox message={error} />
      <div className="form-actions">
        {saved && (
          <span className="success-note">
            <Check size={16} />
            Saved
          </span>
        )}
        <button className="button primary" disabled={busy || importBusy || !!backgroundError}>
          {busy ? 'Saving…' : initial ? 'Save changes' : 'Create restaurant'}
          {!initial && <ArrowRight size={16} />}
        </button>
      </div>
    </form>
  );
}
