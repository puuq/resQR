import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { PrintCards } from '@/components/print-cards';
export const dynamic = 'force-dynamic';
export default async function Page() {
  if (!(await currentUser())) redirect('/login');
  return <PrintCards />;
}
