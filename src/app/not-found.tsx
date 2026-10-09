import { Logo } from '@/components/ui';
export default function NotFound() {
  return (
    <main className="standalone">
      <Logo />
      <h1>This table isn’t on the map.</h1>
      <p>Check the link or ask a member of staff for help.</p>
      <a className="button primary" href="/">
        Back to resQR
      </a>
    </main>
  );
}
