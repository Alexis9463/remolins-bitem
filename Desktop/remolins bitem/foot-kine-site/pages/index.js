import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      router.replace(data.session ? '/dashboard' : '/login');
    });
  }, [router]);
  return null;
}
