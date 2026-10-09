import type { Metadata } from 'next';
import {
  ArrowDown,
  ArrowUpRight,
  BellRing,
  Check,
  Coffee,
  Leaf,
  Palette,
  QrCode,
  Smartphone,
  Wifi,
} from 'lucide-react';
import { Logo } from '@/components/ui';
import { SetupRequestForm } from '@/components/setup-request-form';
import './home.css';

export const metadata: Metadata = {
  title: 'resQR — Good service. Just a scan away.',
  description:
    'Free digital menus and table waiter calls for cafés and restaurants in Nepal. Get a branded menu, table QRs and a simple staff dashboard with resQR.',
  robots: { index: true, follow: true },
};

function ServicePreview() {
  return (
    <figure className="service-preview">
      <div className="preview-orbit orbit-one" />
      <div className="preview-orbit orbit-two" />
      <div className="preview-table-top">
        <span className="preview-saucer">
          <Coffee size={66} strokeWidth={1.2} />
        </span>
        <span className="preview-leaf">
          <Leaf size={42} strokeWidth={1} />
        </span>
      </div>
      <div className="landing-table-card">
        <span className="mini-brand">
          <Coffee size={14} /> THE LITTLE CAFÉ
        </span>
        <strong>
          Make yourself
          <br />
          at home.
        </strong>
        <QrCode size={83} strokeWidth={1.4} />
        <span>
          Explore the menu.
          <br />
          Call us over.
        </span>
        <small>
          TABLE 04 <span>·</span> <Wifi size={12} /> Guest Wi-Fi
        </small>
      </div>
      <div className="landing-phone">
        <div className="phone-speaker" />
        <div className="phone-header">
          <Coffee size={17} />
          <span>The Little Café</span>
          <small>04</small>
        </div>
        <div className="phone-menu-title">
          <span>MAKE YOURSELF AT HOME</span>
          <strong>
            Something good
            <br />
            is on the <em>menu.</em>
          </strong>
          <p>Good coffee. Great company.</p>
        </div>
        <div className="phone-categories">
          <span>Coffee & tea</span>
          <span>From the kitchen</span>
        </div>
        <div className="phone-dish">
          <div>
            <small>COFFEE & TEA</small>
            <strong>Flat white</strong>
            <p>Silky milk. A double shot.</p>
            <b>Rs. 240</b>
          </div>
          <span className="phone-dish-art">
            <Coffee size={38} strokeWidth={1.3} />
          </span>
        </div>
        <div className="phone-dish">
          <div>
            <small>FROM THE KITCHEN</small>
            <strong>Veg momo</strong>
            <p>Handmade, with house achar.</p>
            <b>Rs. 260</b>
          </div>
          <span className="phone-dish-art momo-art">
            <Leaf size={32} strokeWidth={1.3} />
          </span>
        </div>
        <div className="phone-call">
          <span>Ready to order?</span>
          <span>
            Call waiter <BellRing size={13} />
          </span>
        </div>
      </div>
      <div className="landing-call-notice">
        <span>
          <BellRing size={22} />
        </span>
        <div>
          <strong>Table 04 needs a hand</strong>
          <small>A little nudge. A better visit.</small>
        </div>
        <span className="notice-check">
          <Check size={17} />
        </span>
      </div>
      <figcaption>
        One table. One scan. A warmer welcome.<span>PRODUCT PREVIEW</span>
      </figcaption>
    </figure>
  );
}

export default function Home() {
  return (
    <div className="landing-page">
      <a className="landing-skip" href="#main">
        Skip to content
      </a>
      <header className="landing-header landing-width">
        <Logo />
        <nav aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#for-your-place">For your place</a>
        </nav>
        <a className="button primary" href="#get-started">
          Get started <ArrowUpRight size={16} />
        </a>
      </header>
      <main id="main">
        <section className="landing-hero landing-width">
          <div className="landing-hero-copy">
            <span className="landing-eyebrow">
              <span /> A LITTLE CLOSER TO YOUR GUESTS
            </span>
            <h1>
              Good service.
              <br />
              Just a <em>scan</em>
              <br />
              away<span>.</span>
            </h1>
            <p>
              Your menu on their phone. A simple way to call your waiter. Give every table a little
              more attention, without interrupting the good moments.
            </p>
            <div className="landing-hero-actions">
              <a className="button primary large" href="#get-started">
                Bring resQR to your place <ArrowUpRight size={18} />
              </a>
              <a className="landing-story-link" href="#how-it-works">
                See how it works <ArrowDown size={16} />
              </a>
            </div>
            <div className="landing-hero-note">
              <span className="small-check">
                <Check size={13} />
              </span>{' '}
              Free for your restaurant. No app for your guests.
            </div>
          </div>
          <ServicePreview />
        </section>
        <div className="landing-promise-strip">
          <div className="landing-width">
            <span>MADE FOR THE PLACES THAT BRING PEOPLE TOGETHER</span>
            <div>
              <Coffee size={18} /> Neighbourhood cafés
            </div>
            <div>
              <Leaf size={18} /> Everyday favourites
            </div>
            <div>
              <Wifi size={18} /> Wi-Fi friendly restaurants
            </div>
          </div>
        </div>
        <section className="landing-section landing-width" id="how-it-works">
          <div className="landing-section-heading">
            <div>
              <span className="landing-eyebrow">FROM FIRST SCAN TO FIRST HELLO</span>
              <h2>
                Less calling out.
                <br />
                More being looked after.
              </h2>
            </div>
            <p>
              No waving across the room for a menu. No shouting for one more order. Just a small
              connection between your guests and your team.
            </p>
          </div>
          <div className="landing-steps">
            {[
              {
                icon: QrCode,
                title: 'A little QR at every table.',
                text: 'Guests scan with their phone camera to open your menu. Add a guest Wi-Fi QR to the other side of the table card.',
                tag: '01 · SCAN',
              },
              {
                icon: Smartphone,
                title: 'Your menu, in their hands.',
                text: 'Your dishes, prices, logo and colours, all in one easy-to-browse place. Update it whenever you need.',
                tag: '02 · EXPLORE',
              },
              {
                icon: BellRing,
                title: 'A nudge for your team.',
                text: 'When a guest is ready, they tap Call waiter. Your team sees the table request, acknowledges it and comes over.',
                tag: '03 · CONNECT',
              },
            ].map(({ icon: Icon, title, text, tag }) => (
              <article key={tag}>
                <span className="landing-step-icon">
                  <Icon size={29} strokeWidth={1.4} />
                </span>
                <span className="step-number">{tag}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="landing-brand-section" id="for-your-place">
          <div className="landing-width landing-brand-inner">
            <div className="landing-brand-art" aria-hidden="true">
              <span className="landing-brand-label">A LITTLE OF YOUR PERSONALITY</span>
              <div className="brand-sample sample-green">
                <Coffee size={28} />
                <strong>The Little Café</strong>
                <span>Good coffee. Slow mornings.</span>
                <div>
                  <i />
                  <i />
                  <i />
                </div>
              </div>
              <div className="brand-sample sample-terracotta">
                <Leaf size={27} />
                <strong>The Corner Table</strong>
                <span>A place for good company.</span>
                <div>
                  <i />
                  <i />
                  <i />
                </div>
              </div>
              <span className="brand-art-note">
                <Palette size={16} /> Your place. Your look.
              </span>
            </div>
            <div className="landing-brand-copy">
              <span className="landing-eyebrow">MADE TO FEEL LIKE YOU</span>
              <h2>
                Your place has a personality.
                <br />
                <em>Your menu should, too.</em>
              </h2>
              <p>
                A warm little café or your neighbourhood’s favourite restaurant — resQR fits right
                in with your logo, brand colours and menu style.
              </p>
              <ul>
                <li>
                  <Check size={16} /> Update dishes and prices without reprinting menus.
                </li>
                <li>
                  <Check size={16} /> Give owners, reception and waiters their own access.
                </li>
                <li>
                  <Check size={16} /> Keep track of the tables that need attention.
                </li>
              </ul>
            </div>
          </div>
        </section>
        <section className="landing-free landing-width">
          <span className="landing-eyebrow">BETTER HOSPITALITY, WITHOUT THE SUBSCRIPTION</span>
          <h2>
            Free for your place.
            <br />
            Simple for your people.
          </h2>
          <p>
            Restaurant owners and customers don’t pay to use resQR. Small, clearly labelled sponsor
            cards on the menu support the platform — without full-screen pop-ups getting in the way.
          </p>
          <a href="#get-started" className="landing-story-link">
            Let’s talk about your restaurant <ArrowUpRight size={17} />
          </a>
        </section>
        <section className="landing-contact-section" id="get-started">
          <div className="landing-width landing-contact-inner">
            <div className="landing-contact-copy">
              <span className="landing-eyebrow">A NEW PLACE AT THE TABLE</span>
              <h2>
                Let’s get your
                <br />
                place <em>connected.</em>
              </h2>
              <p>
                Own a café or restaurant in Nepal? Tell us about your place. We’ll get in touch to
                help you set up your menu, table QRs and team access.
              </p>
              <div className="landing-contact-details">
                <span>
                  <Check size={16} /> Free to get started
                </span>
                <span>
                  <Check size={16} /> Help with your first setup
                </span>
                <span>
                  <Check size={16} /> Works in your guests’ browser
                </span>
              </div>
              <span className="landing-nepal">
                BUILT FOR GOOD HOSPITALITY IN NEPAL <span>↗</span>
              </span>
            </div>
            <div className="landing-contact-card">
              <div className="landing-form-heading">
                <h3>Tell us about your place.</h3>
                <p>A few details, and we’ll take it from here.</p>
              </div>
              <SetupRequestForm />
            </div>
          </div>
        </section>
      </main>
      <footer className="landing-footer landing-width">
        <div>
          <Logo small />
          <span>A little closer to your guests.</span>
        </div>
        <span>Made for cafés & restaurants in Nepal.</span>
        <a href="/login">
          Team sign in <ArrowUpRight size={13} />
        </a>
      </footer>
    </div>
  );
}
