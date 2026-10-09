'use client';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Coffee, Printer, Wifi } from 'lucide-react';
import type { Workspace } from '@/lib/types';
import { api } from '@/lib/client';
import { ErrorBox, Loading, Logo } from './ui';
const escapeWifi = (s: string) => s.replace(/([\\;,:" ])/g, '\\$1');
export function PrintCards() {
  const [data, setData] = useState<Workspace | null>(null);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [wifi, setWifi] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    async function load() {
      try {
        const rid = new URLSearchParams(window.location.search).get('restaurant');
        const w = await api<Workspace>(`/api/workspace?restaurant=${rid || ''}`);
        const pairs = await Promise.all(
          w.tables.map(async (t) => [
            t.id,
            await QRCode.toDataURL(`${w.qrBaseUrl}/t/${t.token}`, {
              width: 500,
              margin: 4,
              errorCorrectionLevel: 'M',
            }),
          ]),
        );
        setCodes(Object.fromEntries(pairs));
        if (w.restaurant.wifi_ssid)
          setWifi(
            await QRCode.toDataURL(
              `WIFI:T:${w.restaurant.wifi_password ? 'WPA' : 'nopass'};S:${escapeWifi(w.restaurant.wifi_ssid)};P:${escapeWifi(w.restaurant.wifi_password)};;`,
              { width: 500, margin: 4, errorCorrectionLevel: 'M' },
            ),
          );
        setData(w);
      } catch (e) {
        setError((e as Error).message);
      }
    }
    void load();
  }, []);
  if (error)
    return (
      <div className="standalone">
        <ErrorBox message={error} />
      </div>
    );
  if (!data) return <Loading />;
  return (
    <main className="print-page">
      <header className="print-toolbar">
        <Logo />
        <div>
          <strong>Table cards · {data.restaurant.name}</strong>
          <p>Print at 100% scale. Cut each pair and place back-to-back in a holder.</p>
        </div>
        <button className="button primary" onClick={() => window.print()}>
          <Printer size={17} />
          Print / Save PDF
        </button>
      </header>
      <div className="print-warning">
        Scan a test card before printing the full set. These codes use{' '}
        <strong>{data.qrBaseUrl}</strong>.
      </div>
      <div className="print-sheets">
        {data.tables.map((t) => (
          <section className="print-pair" key={t.id}>
            <div className="print-card" style={{ borderTopColor: data.restaurant.color }}>
              <span className="print-venue">
                {data.restaurant.logo ? (
                  <img src={data.restaurant.logo} alt="" />
                ) : (
                  <Coffee size={22} />
                )}{' '}
                {data.restaurant.name}
              </span>
              <span className="eyebrow">MAKE YOURSELF AT HOME</span>
              <h2>
                Good things
                <br />
                start with a scan.
              </h2>
              <img className="print-qr" src={codes[t.id]} alt={`Menu QR for ${t.label}`} />
              <strong className="print-table">{t.label}</strong>
              <p>Explore the menu · Call your waiter</p>
              <small>No app. Just your camera.</small>
              <span className="print-powered">Powered by resQR</span>
            </div>
            <div className="print-card wifi-card" style={{ borderTopColor: data.restaurant.color }}>
              <span className="print-venue">
                <Wifi size={22} />
                {data.restaurant.name}
              </span>
              <span className="eyebrow">STAY A LITTLE LONGER</span>
              <h2>
                {wifi ? (
                  <>
                    Good company.
                    <br />
                    Good connection.
                  </>
                ) : (
                  <>
                    A little pause.
                    <br />A lovely place.
                  </>
                )}
              </h2>
              {wifi ? (
                <>
                  <img className="print-qr" src={wifi} alt="Join guest Wi-Fi" />
                  <strong>{data.restaurant.wifi_ssid}</strong>
                  <p>Scan to join our guest Wi-Fi</p>
                </>
              ) : (
                <div className="wifi-placeholder">
                  <Coffee size={65} strokeWidth={1} />
                  <p>
                    Turn this card over
                    <br />
                    to explore our menu.
                  </p>
                </div>
              )}
              <small>{t.label}</small>
              <span className="print-powered">Powered by resQR</span>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
