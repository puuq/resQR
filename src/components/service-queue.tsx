'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bell,
  BellRing,
  Check,
  CheckCheck,
  Clock3,
  RefreshCw,
  Volume2,
  VolumeX,
  WifiOff,
} from 'lucide-react';
import { api, elapsed } from '@/lib/client';
import type { ServiceRequest, User } from '@/lib/types';
import { ErrorBox } from './ui';
export function ServiceQueue({ restaurantId, user }: { restaurantId: string; user: User }) {
  const [calls, setCalls] = useState<ServiceRequest[]>([]);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [sound, setSound] = useState(false);
  const [busy, setBusy] = useState('');
  const [filter, setFilter] = useState<'active' | 'completed'>('active');
  const [, tick] = useState(0);
  const context = useRef<AudioContext | null>(null);
  const known = useRef(new Set<string>());
  const soundEnabled = useRef(false);
  const lastSound = useRef(0);
  const inFlight = useRef(false);
  const ring = useCallback(() => {
    const ctx = context.current;
    if (!ctx || ctx.state !== 'running') return;
    for (let i = 0; i < 2; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = i ? 784 : 659;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.25);
      gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + i * 0.25 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.25 + 0.23);
      osc.start(ctx.currentTime + i * 0.25);
      osc.stop(ctx.currentTime + i * 0.25 + 0.24);
    }
  }, []);
  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const { calls: next } = await api<{ calls: ServiceRequest[] }>(
        `/api/calls?restaurant=${restaurantId}`,
      );
      const pending = next.filter((c) => c.status === 'pending');
      if (
        soundEnabled.current &&
        pending.length &&
        (pending.some((c) => !known.current.has(c.id)) || Date.now() - lastSound.current > 30000)
      ) {
        ring();
        lastSound.current = Date.now();
      }
      known.current = new Set(next.map((c) => c.id));
      setCalls(next);
      setConnected(true);
      setError('');
    } catch (e) {
      setConnected(false);
      setError((e as Error).message);
    } finally {
      inFlight.current = false;
    }
  }, [restaurantId, ring]);
  useEffect(() => {
    known.current = new Set();
    void refresh();
    const timer = setInterval(() => void refresh(), 5000);
    const clock = setInterval(() => tick((n) => n + 1), 1000);
    return () => {
      clearInterval(timer);
      clearInterval(clock);
    };
  }, [refresh]);
  useEffect(
    () => () => {
      void context.current?.close();
    },
    [],
  );
  async function toggleSound() {
    try {
      if (sound) {
        soundEnabled.current = false;
        setSound(false);
        return;
      }
      context.current ??= new AudioContext();
      await context.current.resume();
      soundEnabled.current = true;
      setSound(true);
      ring();
    } catch {
      setError('Audio could not start on this device. Check browser permissions and try again.');
    }
  }
  async function update(call: ServiceRequest, status: 'acknowledged' | 'completed') {
    setBusy(call.id);
    try {
      await api('/api/calls', {
        method: 'PATCH',
        body: JSON.stringify({ id: call.id, restaurant_id: restaurantId, status }),
      });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  const pending = calls.filter((c) => c.status === 'pending');
  const attending = calls.filter((c) => c.status === 'acknowledged');
  const complete = calls.filter((c) => c.status === 'completed');
  const visible = (
    filter === 'active' ? calls.filter((c) => c.status !== 'completed') : complete
  ).sort((a, b) =>
    filter === 'active'
      ? a.created_at - b.created_at
      : (b.completed_at || 0) - (a.completed_at || 0),
  );
  return (
    <>
      <div className="queue-stats">
        <div className="queue-stat">
          <span className="stat-icon amber">
            <BellRing size={23} />
          </span>
          <span>
            <strong>{pending.length}</strong>
            <small>Waiting for you</small>
          </span>
        </div>
        <div className="queue-stat">
          <span className="stat-icon">
            <CoffeeIcon />
          </span>
          <span>
            <strong>{attending.length}</strong>
            <small>Being attended</small>
          </span>
        </div>
        <div className="queue-stat">
          <span className="stat-icon neutral">
            <CheckCheck size={23} />
          </span>
          <span>
            <strong>{complete.length}</strong>
            <small>Completed · last 12h</small>
          </span>
        </div>
      </div>
      <div className="queue-controls">
        <div className="segmented">
          <button
            className={filter === 'active' ? 'selected' : ''}
            onClick={() => setFilter('active')}
          >
            Active requests <span>{pending.length + attending.length}</span>
          </button>
          <button
            className={filter === 'completed' ? 'selected' : ''}
            onClick={() => setFilter('completed')}
          >
            Completed
          </button>
        </div>
        <div className="queue-tools">
          <span className={`connection ${connected ? '' : 'offline'}`}>
            {connected ? <span className="status-dot" /> : <WifiOff size={15} />}{' '}
            {connected ? 'Updates every 5s' : 'Reconnecting'}
          </span>
          <button className={`button secondary ${sound ? 'sound-on' : ''}`} onClick={toggleSound}>
            {sound ? <Volume2 size={17} /> : <VolumeX size={17} />}{' '}
            {sound ? 'Sound on' : 'Enable sound'}
          </button>
          <button
            className="icon-button"
            onClick={() => void refresh()}
            aria-label="Refresh requests"
          >
            <RefreshCw size={17} />
          </button>
        </div>
      </div>
      <ErrorBox message={error} />
      {!sound && (
        <div className="notice">
          <Volume2 size={18} />
          <span>Enable sound and keep this screen open at the counter to hear new requests.</span>
        </div>
      )}
      {visible.length ? (
        <div className="call-grid">
          {visible.map((call) => (
            <article className={`call-card ${call.status}`} key={call.id}>
              <div className="call-top">
                <span className={`badge ${call.status === 'pending' ? 'amber' : ''}`}>
                  {call.status === 'pending'
                    ? 'WAITING'
                    : call.status === 'acknowledged'
                      ? 'ACKNOWLEDGED'
                      : 'COMPLETED'}
                </span>
                <span className="call-timer">
                  <Clock3 size={14} />
                  {elapsed(call.created_at)}
                </span>
              </div>
              <div className="call-table">
                <span className="table-glyph">
                  <Bell size={29} strokeWidth={1.5} />
                </span>
                <h2>{call.table_label}</h2>
                <p>
                  {call.status === 'pending'
                    ? 'A guest would like your attention.'
                    : call.status === 'acknowledged'
                      ? `${call.staff_name || 'A staff member'} is taking care of this table.`
                      : 'Another guest, well looked after.'}
                </p>
              </div>
              {call.status === 'pending' ? (
                <button
                  className="button primary full-width"
                  disabled={busy === call.id}
                  onClick={() => void update(call, 'acknowledged')}
                >
                  I’ll take this
                  <Check size={17} />
                </button>
              ) : call.status === 'acknowledged' ? (
                <button
                  className="button secondary full-width"
                  disabled={
                    busy === call.id || (user.role === 'waiter' && call.assigned_to !== user.id)
                  }
                  onClick={() => void update(call, 'completed')}
                >
                  Mark complete
                  <CheckCheck size={17} />
                </button>
              ) : (
                <div className="completed-note">
                  <CheckCheck size={16} />
                  Completed at{' '}
                  {new Date(call.completed_at!).toLocaleTimeString('en-NP', {
                    timeZone: 'Asia/Kathmandu',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="queue-empty">
          <div className="empty-illustration">
            <Bell size={45} strokeWidth={1.2} />
            <span>
              <Check size={18} />
            </span>
          </div>
          <span className="eyebrow">
            {filter === 'active' ? 'A MOMENT TO BREATHE' : 'THE LITTLE THINGS ADD UP'}
          </span>
          <h2>
            {filter === 'active' ? 'All caught up.' : 'Your completed requests will appear here.'}
          </h2>
          <p>
            {filter === 'active'
              ? 'When a guest calls from their table, you’ll see it here. Keep this screen open and your sound on.'
              : 'Acknowledge a table call, attend the guest, then mark it complete.'}
          </p>
        </div>
      )}
    </>
  );
}
function CoffeeIcon() {
  return <Clock3 size={23} />;
}
