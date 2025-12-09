// app/page.tsx
import PrimerDashboard from '@/components/PrimerDashboard';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

export default async function HomePage() {
  // Optional: Add authentication
  // const session = await getServerSession();
  // if (!session) redirect('/login');

  return (
    <div className="min-h-screen bg-gray-50">
      <PrimerDashboard />
    </div>
  );
}