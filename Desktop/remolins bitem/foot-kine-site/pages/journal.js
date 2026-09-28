import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabase';
import { fmtDateTime } from '../lib/data';
import { IconJournal } from '../components/Icons';

const MODULES = ['Jugador', 'Nota', 'Balanç', 'Dolor', 'Mesura', 'Sessió'];

export default function Journal() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState('');
  const [auteurFilter, setAuteurFilter] = useState('');
  const [auteurs, setAuteurs] = useState([]);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('journal').select('*').order('date', { ascending: false }).limit(500);
    setLogs(data || []);
    setAuteurs([...new Set((data || []).map(l => l.auteur))]);
    setLoading(false);
  }

  let filtered = logs;
  if (moduleFilter) filtered = filtered.filter(l => l.module === moduleFilter);
  if (auteurFilter) filtered = filtered.filter(l => l.auteur === auteurFilter);

  return (
    <Layout title="Diari d'activitat" subtitle="Historial complet de les accions de l'equip">
      <div className="flex flex-wrap gap-2.5 mb-4">
        <select className="input w-auto" value={moduleFilter} onChange={e => setModuleFilter(e.target.value)}>
          <option value="">Tots els mòduls</option>
          {MODULES.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select className="input w-auto" value={auteurFilter} onChange={e => setAuteurFilter(e.target.value)}>
          <option value="">Tots els fisios</option>
          {auteurs.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      <div className="card">
        {loading ? <div className="text-inksoft">Carregant…</div> : filtered.length === 0 ? (
          <div className="text-center py-9 text-inksoft"><IconJournal className="mx-auto mb-2.5" width={38} height={38} /><div className="font-bold text-ink mb-1">Cap activitat</div><div className="text-sm">Res a mostrar amb aquest filtre.</div></div>
        ) : filtered.map(l => (
          <div key={l.id} className="flex gap-3 py-2.5 border-b border-line last:border-none">
            <div className="w-2 h-2 rounded-full bg-tape mt-1.5 flex-shrink-0" />
            <div>
              <div className="text-sm"><strong>{l.auteur}</strong> {l.action} {l.cible_nom ? `— ${l.cible_nom}` : ''} <span className="badge badge-grey ml-1">{l.module}</span></div>
              {l.details && <div className="text-[12.5px] text-inksoft mt-0.5">{l.details}</div>}
              <div className="text-[11px] text-inkfaint font-mono mt-0.5">{fmtDateTime(l.date)}</div>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
