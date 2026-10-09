import { CustomerMenu } from '@/components/customer-menu';
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <CustomerMenu slug={slug} />;
}
