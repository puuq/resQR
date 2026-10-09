import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { Dashboard } from '@/components/dashboard';
export const dynamic = 'force-dynamic';
export default async function Page() {
  const user = await currentUser();
  if (!user) redirect('/login');
  return <Dashboard user={user} />;
}
