import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { supabase } from '../lib/supabase';
import { displayNameFromUser } from '../lib/data';
import { IconDashboard, IconTeam, IconLoad, IconJournal, IconSettings, IconLogout, IconBox } from './Icons';

const TABS = [
  { href: '/dashboard', label: 'Tauler', icon: IconDashboard },
  { href: '/effectif', label: 'Plantilla', icon: IconTeam },
  { href: '/charge', label: 'Càrrega', icon: IconLoad },
  { href: '/materiel', label: 'Material', icon: IconBox },
  { href: '/journal', label: 'Diari', icon: IconJournal },
  { href: '/reglages', label: 'Ajustos', icon: IconSettings },
];

export default function Layout({ children, title, subtitle, actions }) {
  const router = useRouter();
  const [user, setUser] = useState(undefined); // undefined = chargement, null = pas connecté

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (!data.session) { router.replace('/login'); setUser(null); }
      else setUser(data.session.user);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) { router.replace('/login'); setUser(null); }
      else setUser(session.user);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, [router]);

  if (user === undefined) {
    return <div className="h-screen flex items-center justify-center text-inksoft font-semibold">Carregant…</div>;
  }
  if (user === null) return null;

  const name = displayNameFromUser(user);
  const activeHref = TABS.find(t => router.pathname.startsWith(t.href))?.href || '/dashboard';

  async function logout() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden md:flex md:flex-col w-[220px] flex-shrink-0 bg-pitchdark text-[#EAF1FB] p-4 sticky top-0 h-screen">
        <div className="flex items-center gap-2.5 pb-5 border-b border-white/10 mb-4 px-1">
          <div className="w-[34px] h-[34px] rounded-md bg-white flex items-center justify-center flex-shrink-0 overflow-hidden p-0.5">
            <img src="/logo.jpg" alt="Logo del club" className="w-full h-full object-contain" />
          </div>
          <div className="font-display font-bold text-base uppercase leading-tight">Staff Fisio
            <span className="block font-body font-medium text-[10.5px] normal-case text-white/55">Seguiment de plantilla i càrrega</span>
          </div>
        </div>
        <nav className="flex flex-col gap-1 flex-1">
          {TABS.map(t => {
            const Icon = t.icon;
            const active = activeHref === t.href;
            return (
              <Link key={t.href} href={t.href} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg font-semibold text-[13.5px] transition ${active ? 'bg-tape text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>
                <Icon /> {t.label}
              </Link>
            );
          })}
        </nav>
        <div className="pt-3.5 border-t border-white/10">
          <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-white/5">
            <div className="w-7 h-7 rounded-full bg-tape flex items-center justify-center font-display font-bold text-xs flex-shrink-0">{name[0]}</div>
            <div className="min-w-0">
              <div className="text-xs font-semibold truncate">{name}</div>
              <div className="text-[10px] text-white/55">Fisioterapeuta</div>
            </div>
            <button onClick={logout} className="ml-auto text-white/60 hover:text-white" title="Tancar sessió"><IconLogout /></button>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center justify-between px-5 md:px-7 py-3.5 md:py-4.5 bg-white border-b border-line sticky top-0 z-20">
          <div>
            <div className="font-display font-bold text-[19px] md:text-[22px] uppercase tracking-wide">{title}</div>
            {subtitle && <div className="text-[12.5px] text-inksoft mt-0.5 hidden sm:block">{subtitle}</div>}
          </div>
          <div className="flex gap-2">{actions}</div>
        </div>
        <div className="p-4 md:p-7 pb-24 md:pb-16 flex-1">{children}</div>
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-pitchdark flex justify-around px-1 pt-1.5 pb-[calc(env(safe-area-inset-bottom,0px)+4px)] z-50">
        {TABS.map(t => {
          const Icon = t.icon;
          const active = activeHref === t.href;
          return (
            <Link key={t.href} href={t.href} className={`flex flex-col items-center gap-0.5 px-1 py-1.5 text-[9.5px] font-bold uppercase flex-1 ${active ? 'text-white' : 'text-white/60'}`}>
              <Icon /> {t.label.split(' ')[0]}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
