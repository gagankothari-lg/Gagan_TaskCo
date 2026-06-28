import { redirect } from 'next/navigation';

// Index ("/") sends users to the dashboard (built fully in P19).
export default function Index() {
  redirect('/dashboard');
}
