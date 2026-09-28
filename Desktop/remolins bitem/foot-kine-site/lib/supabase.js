import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Ne bloque pas le build, mais avertit clairement en dev/console.
  // eslint-disable-next-line no-console
  console.warn(
    "Variables NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY manquantes. Copiez .env.local.example vers .env.local et renseignez-les."
  );
}

export const supabase = createClient(url || 'https://placeholder.supabase.co', anonKey || 'placeholder');
