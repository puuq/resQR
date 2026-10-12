# resQR

A Next.js pilot for Nepal's cafés: branded menus, table-specific waiter calls, a staff queue, and a private restaurant setup dashboard. Customers do not need accounts or an app.

The public homepage explains the platform and lets restaurant owners request setup. Sign in at `/login` (also linked quietly in the footer). Platform administrators can open **Setup requests** in the dashboard to see contact details and mark a request as contacted. These details are private to the platform administrator; restaurant accounts cannot access them. No automatic email notifications are sent, so check the inbox and contact owners directly.

The setup form validates contact details, preserves inputs on failure and confirms success only after the server accepts the request. A honeypot and a limit of five submissions per IP per hour reduce spam. Requests are stored in D1 with the `0002_setup_inquiries.sql` migration.

## Stack

- Next.js App Router, React and TypeScript; standard Next.js runtime.
- OpenNext adapter for Cloudflare Workers, D1 for persistent data, R2 for images.
- Cookie sessions, server-side role/restaurant checks, parameterized SQL, atomic duplicate-call protection.
- Locally bundled fonts. No advertising trackers, payment flows or third-party ad network.

On customer menus, the advertisement occupies a separate compact strip above the waiter bar when the page opens. It slides away after the customer starts scrolling, giving the menu more room; it does not reappear during that visit. The menu and advertisement never overlap, and the waiter button stays available. The resQR/Splitr promotion strip remains near the menu heading.

## Develop locally

Node 22 is recommended.

```sh
npm ci
npm run setup:local
npm run db:local
npm run dev
```

Open `http://localhost:3000/setup`. Use the generated token in `.local/setup-token.txt` and choose your administrator email and password. Setup is allowed once. `.dev.vars`, `.local`, database files, sessions and uploads are ignored by Git.

The development token and database are separate from production. Wrangler's local database lives in `.wrangler/state`; only commands with `--remote` change Cloudflare data. A database migration changes the schema; redeploying the app does not replace restaurant data.

`npm test` runs a browser/API integration scenario against localhost:3000. It creates local-only sample restaurants and tests authentication, cross-restaurant denial, concurrent duplicate taps, cooldown, staff acknowledgement/completion, the customer mobile layout and QR printing. It also checks the public homepage at phone widths, setup-form failure/success, inquiry persistence, admin inbox updates, access denial and spam controls. If you already chose local admin credentials, put them in the ignored `.local/pilot-credentials.json` as `{ "email": "...", "password": "..." }` before running tests. Repeated runs add sample restaurants and setup requests. Never point this test at production.

```sh
npm run typecheck
npm test
npm run build:cloudflare
npm run preview
```

Development uses Webpack, matching the production build. This avoids a Turbopack reload loop observed with the local Cloudflare bindings on Windows. OpenNext may require permission to create symlinks during Windows builds. CI uses Linux.

Next.js is pinned to 16.3.8, matching the [OpenNext Cloudflare template](https://github.com/opennextjs/opennextjs-cloudflare/blob/main/create-cloudflare/next/package.json). A production request with 16.4.0 failed when the adapter tried to load `preview-props.json`; verify a Workers preview before updating Next.js.

## Deploy to Cloudflare

The production Worker is `resqr`; its intended custom domain is `resqr.thesyntaxorbit.com`. Bindings and the D1 ID are in `wrangler.jsonc`. Domain/account access is required.

For a fresh account create `resqr` with `wrangler d1 create resqr`, create `resqr-media` with `wrangler r2 bucket create resqr-media`, then update the D1 ID and domain in the configuration.

Before the first setup, store a long random `BOOTSTRAP_TOKEN` as a **runtime secret**, not a repository variable:

```sh
npx wrangler secret put BOOTSTRAP_TOKEN
npm run build:cloudflare
npm run deploy
```

The deploy script applies pending D1 migrations and publishes the already-built Worker. Changes should be backward compatible with the previous app during deployment. A Worker rollback does not roll back SQL migrations. Use D1 recovery/export before destructive schema changes.

Open `/setup` on the deployed domain, supply the token, and choose the platform account. Remove the bootstrap runtime secret after setup using `wrangler secret delete BOOTSTRAP_TOKEN`; existing users continue to work.

## Deployment workflow

The pilot currently uses manual deployment, as requested. GitHub runs validation on pushes; it does not publish production. To publish an update, run `npm run build:cloudflare` followed by `npm run deploy` while authenticated to Cloudflare.

### Optional deployment on GitHub pushes

Connect `puuq/resQR` to the existing `resqr` Worker in Cloudflare **Workers & Pages → resqr → Settings → Builds**:

- Production branch: `main`
- Root directory: repository root
- Build command: `npm run build:cloudflare`
- Deploy command: `npm run deploy`
- Grant the build credential permission to update this Worker and apply migrations to the resQR D1 database.

The repository's GitHub workflow runs type checks, integration tests in both the Next.js development server and the built Cloudflare Worker, and a Cloudflare build. Cloudflare Builds performs deployment separately; configure branch protection if you want merges to require the checks. Do not point branch preview bindings or migration commands at production data. A test environment needs its own Worker, D1, R2 and secrets.

## Demonstrate at a café

### Import a printed menu

In **Add restaurant → Import your menu**, choose one or more PDFs/photos (PDF, JPG, PNG or WebP). Up to 10 files, 8 MB per file and 10 MB combined are accepted. Read the files, correct the editable names/categories/descriptions/prices, remove unwanted dishes, and confirm you checked the draft. Creating the restaurant saves its tables and up to 200 reviewed dishes atomically. Importing disables the sample menu. Missing prices must be filled in; amounts are entered in rupees and stored as integer paisa. Unknown dietary labels remain unlabelled on the customer menu. Menu images are not automatically cropped into dish photos.

Automatic reading uses Google Gemini and needs a server-side key. Create a key at [Google AI Studio](https://aistudio.google.com/api-keys), keep billing disabled to use available free quota, and add **GEMINI_API_KEY** as a Secret in Cloudflare → Workers & Pages → resqr → Settings → Variables and Secrets. Alternatively run `npx wrangler secret put GEMINI_API_KEY` and enter the key at its private prompt. Never commit it or use a `NEXT_PUBLIC_` variable. For local development, add it to ignored `.dev.vars`. The form reports when the reader is not configured; manual setup still works. No key is bundled with this feature.

The default model is `gemini-3.5-flash-lite`; optional runtime variable `MENU_IMPORT_MODEL` can select another compatible Gemini model after testing it. Google [restricts Gemini 2.5 access to projects that previously used it](https://ai.google.dev/gemini-api/docs/deprecations), so new projects need a current model. Gemini 3 uses its default thinking settings; the zero-token budget is kept only for legacy 2.5 Flash models. No SDK, extra Worker, database migration or VPS is needed. The reader allows six attempts per admin per hour and twenty per day, bounds upload size, checks file signatures, and rejects invalid/truncated AI results. It distinguishes invalid/expired keys, unavailable models, rejected settings and billing-credit errors without exposing Google's raw response. It does not automatically retry quota errors or switch to a paid provider. These application limits do not guarantee a particular Google free quota or prevent charges if billing is enabled on the Google project; check [Google's pricing](https://ai.google.dev/gemini-api/docs/pricing).

The form explains that uploaded menu bytes are sent to Google and that free-tier data may be used to improve its products. Use public menu pages only. Original files and unfinished drafts are not saved in D1/R2. A failed extraction preserves the existing draft; a successful reread replaces it. The reader requests structured JSON with a 32,768-token output cap and the same schema used for local validation. If the provider rejects a structured request with a non-key HTTP 400, it falls back once to JSON mode. It validates the complete response locally with Zod, rejecting missing required fields, invalid prices and truncated output before any draft is shown. Absent optional descriptions, notes and dietary labels remain empty or unknown. If the provider exceeds 200 entries, the draft includes the first 200 and a warning that remaining entries were omitted. A response-limit error asks users to upload smaller menu sections. Schema fallback retains complete local validation; quota and key failures are never retried. Check the result against the originals: OCR may miss dishes or misread variant columns, taxes and blurred prices. Large/unclear PDFs should be split into smaller batches. Closing the form discards the draft. Extraction requires the configured key and real menu testing before it can be considered verified end to end.

Tests mock provider responses without sending files to Google or consuming quota. They cover multiple files, uncertain prices, invalid/truncated results, quota failures, authentication, draft review/correction, failure recovery, mobile layout, and a real local D1 transaction with 200 dishes and 100 tables.

1. Sign in as platform admin and add a restaurant. Optionally start with the clearly labelled sample menu.
2. Upload the logo, set the brand colour and menu appearance, and enter actual dishes/prices.
3. Add the table count, then rename tables if needed. Optionally enter the **guest** Wi-Fi network details.
4. Create an owner, receptionist or waiter account. Share access directly; the app does not send emails.
5. Open the service queue on a counter device. Click **Enable sound** and verify the chime is audible.
6. Open **Tables & QR** and print the two-sided cards, or download a QR PNG. Test with a phone before placing cards.
7. Scan, call, acknowledge on the counter, and mark the request complete. Customer status updates every five seconds while a request is active.

Admin can manage all restaurants. Owners manage their own menus, branding, tables and staff. Reception can handle all calls at its venue. Waiters claim requests and complete their own claimed requests. Sponsorship is controlled by the platform administrator.

Admin and owners can set an optional **Google review link** in restaurant settings (Google Business Profile → Read reviews → Get more reviews). A compact, nonsticky **Review on Google** button appears beside the customer Menu heading and opens that restaurant's link in a new tab. Leaving the field empty hides it. Google links are validated on the server; the `0003_google_review_link.sql` migration preserves existing restaurants with an empty default. resQR does not collect review ratings or verify whether a customer posted a review.

## Pilot limits and next steps

- Keep the staff queue open, the device awake and sound enabled. Background/locked-phone notifications and native apps are not implemented. Internet is required; a failed POST never displays a successful send.
- Five-second polling is intended for a small pilot. A counter open for 12 hours produces roughly 8,640 polling requests. Monitor account-wide Workers/D1 limits before adding venues; add WebSocket/push delivery as the service grows.
- One active call per table, a 30-second post-completion cooldown and server rate limits reduce repeat calls. A photographed/shared QR can be used remotely; the QR is not proof of presence.
- Up to 100 tables at a venue. The service queue returns at most 200 recent/active records. The completed view covers the last 12 hours.
- Restaurant setup, menu management, logo upload, staff creation, QR generation and static/animated image sponsor placement are implemented. Custom restaurant domains, hostname routing/redirect management, QR revocation, self-service password recovery and a native waiter app are future work.
- Printed QRs use `QR_BASE_URL` and a stable random table token. Keep that hostname serving the app (or add redirects later). Changing the variable cannot rewrite printed cards.
- Use real menu data before deployment at a venue. Confirm prices, availability, allergy information and Wi-Fi QR compatibility on the actual phones.
- Customer menus have a compact, scrolling resQR + Splitr promotion below the Menu heading (Splitr is marked Coming soon), separate from an Advertisement area after the first four visible dishes. The ad area reserves a small empty space until an image is configured; existing restaurant ad image/title/HTTPS destination settings fill it. No ad network, tracking, automatic revenue or impression/click billing is connected yet.
- R2 Standard and Workers have usage-based pricing beyond included allowances. No paid plan change is performed by this project.

## Key paths

`src/app/api/` holds the backend; `src/components/` holds the interactive screens; `src/lib/` holds auth, validation and database utilities; `migrations/` holds the schema; `tests/` exercises the pilot end to end.
