# resQR

A Next.js pilot for Nepal's cafés: branded menus, table-specific waiter calls, a staff queue, and a private restaurant setup dashboard. Customers do not need accounts or an app.

The public homepage explains the platform and lets restaurant owners request setup. Sign in at `/login` (also linked quietly in the footer). Platform administrators can open **Setup requests** in the dashboard to see contact details and mark a request as contacted. These details are private to the platform administrator; restaurant accounts cannot access them. No automatic email notifications are sent, so check the inbox and contact owners directly.

The setup form validates contact details, preserves inputs on failure and confirms success only after the server accepts the request. A honeypot and a limit of five submissions per IP per hour reduce spam. Requests are stored in D1 with the `0002_setup_inquiries.sql` migration.

## Stack

- Next.js App Router, React and TypeScript; standard Next.js runtime.
- OpenNext adapter for Cloudflare Workers, D1 for persistent data, R2 for images.
- Cookie sessions, server-side role/restaurant checks, parameterized SQL, atomic duplicate-call protection.
- Locally bundled fonts. No advertising trackers, payment flows or third-party ad network.

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

1. Sign in as platform admin and add a restaurant. Optionally start with the clearly labelled sample menu.
2. Upload the logo, set the brand colour and menu appearance, and enter actual dishes/prices.
3. Add the table count, then rename tables if needed. Optionally enter the **guest** Wi-Fi network details.
4. Create an owner, receptionist or waiter account. Share access directly; the app does not send emails.
5. Open the service queue on a counter device. Click **Enable sound** and verify the chime is audible.
6. Open **Tables & QR** and print the two-sided cards, or download a QR PNG. Test with a phone before placing cards.
7. Scan, call, acknowledge on the counter, and mark the request complete. Customer status updates every five seconds while a request is active.

Admin can manage all restaurants. Owners manage their own menus, branding, tables and staff. Reception can handle all calls at its venue. Waiters claim requests and complete their own claimed requests. Sponsorship is controlled by the platform administrator.

## Pilot limits and next steps

- Keep the staff queue open, the device awake and sound enabled. Background/locked-phone notifications and native apps are not implemented. Internet is required; a failed POST never displays a successful send.
- Five-second polling is intended for a small pilot. A counter open for 12 hours produces roughly 8,640 polling requests. Monitor account-wide Workers/D1 limits before adding venues; add WebSocket/push delivery as the service grows.
- One active call per table, a 30-second post-completion cooldown and server rate limits reduce repeat calls. A photographed/shared QR can be used remotely; the QR is not proof of presence.
- Up to 100 tables at a venue. The service queue returns at most 200 recent/active records. The completed view covers the last 12 hours.
- Restaurant setup, menu management, logo upload, staff creation, QR generation and static/animated image sponsor placement are implemented. Custom restaurant domains, hostname routing/redirect management, QR revocation, self-service password recovery and a native waiter app are future work.
- Printed QRs use `QR_BASE_URL` and a stable random table token. Keep that hostname serving the app (or add redirects later). Changing the variable cannot rewrite printed cards.
- Use real menu data before deployment at a venue. Confirm prices, availability, allergy information and Wi-Fi QR compatibility on the actual phones.
- No revenue is generated automatically. A sponsor image can link to an HTTPS advertiser URL, and is labelled Sponsored. No impression/click billing exists yet.
- R2 Standard and Workers have usage-based pricing beyond included allowances. No paid plan change is performed by this project.

## Key paths

`src/app/api/` holds the backend; `src/components/` holds the interactive screens; `src/lib/` holds auth, validation and database utilities; `migrations/` holds the schema; `tests/` exercises the pilot end to end.
