import { useEffect, useState } from 'react';
import Link from 'next/link';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabase';
import { STATUTS, DOULEUR_STATUTS, computeACWR, fmtDateTime, MATERIEL_CATEGORIES } from '../lib/data';
import { PlayerAvatar } from './effectif/index';
import { IconAlert, IconLoad, IconJournal, IconBox } from '../components/Icons';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState([]);
  const [douleurs, setDouleurs] = useState([]);
  const [acwrByPlayer, setAcwrByPlayer] = useState({});
  const [logs, setLogs] = useState([]);
  const [materielBas, setMaterielBas] = useState([]);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [{ data: p }, { data: d }, { data: entries }, { data: j }, { data: m }] = await Promise.all([
      supabase.from('players').select('*').order('numero', { ascending: true }),
      supabase.from('douleurs').select('*').eq('statut', 'active').order('date_debut', { ascending: false }),
      supabase.from('session_entries').select('player_id, minutes, rpe, sessions(date)'),
      supabase.from('journal').select('*').order('date', { ascending: false }).limit(8),
      supabase.from('materiel').select('*'),
    ]);
    setPlayers(p || []);
    setDouleurs(d || []);
    setLogs(j || []);
    const low = (m || []).filter(i => i.stock_qte <= i.seuil_alerte).sort((a, b) => (a.stock_qte / (a.seuil_alerte || 1)) - (b.stock_qte / (b.seuil_alerte || 1)));
    setMaterielBas(low);

    const byPlayer = {};
    (entries || []).forEach(e => {
      if (!e.sessions) return;
      if (!byPlayer[e.player_id]) byPlayer[e.player_id] = [];
      byPlayer[e.player_id].push({ date: e.sessions.date, minutes: e.minutes, rpe: e.rpe });
    });
    const acwrMap = {};
    Object.keys(byPlayer).forEach(pid => { acwrMap[pid] = computeACWR(byPlayer[pid]); });
    setAcwrByPlayer(acwrMap);
    setLoading(false);
  }

  const actifs = players.filter(p => p.statut !== 'archive');
  const disponibles = actifs.filter(p => p.statut === 'disponible').length;
  const blesses = actifs.filter(p => p.statut === 'blesse').length;
  const incertains = actifs.filter(p => p.statut === 'incertain').length;

  const painAlerts = actifs
    .map(p => ({ p, d: douleurs.find(x => x.player_id === p.id) }))
    .filter(x => x.d);

  const acwrAlerts = actifs
    .map(p => ({ p, c: acwrByPlayer[p.id] }))
    .filter(x => x.c && (x.c.zone === 'risque' || x.c.zone === 'vigilance'))
    .sort((a, b) => (b.c.acwr || 0) - (a.c.acwr || 0));

  return (
    <Layout title="Tauler" subtitle="Visió general de la plantilla i alertes del dia">
      {loading ? <div className="text-inksoft">Carregant…</div> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-5">
            <div className="card"><div className="font-display font-extrabold text-3xl text-pitch">{actifs.length}</div><div className="text-xs font-semibold uppercase text-inksoft mt-1.5">Jugadors seguits</div></div>
            <div className="card"><div className="font-display font-extrabold text-3xl text-oktext">{disponibles}</div><div className="text-xs font-semibold uppercase text-inksoft mt-1.5">Disponibles</div></div>
            <div className="card"><div className="font-display font-extrabold text-3xl text-amber">{incertains}</div><div className="text-xs font-semibold uppercase text-inksoft mt-1.5">Dubtosos</div></div>
            <div className="card"><div className="font-display font-extrabold text-3xl text-danger">{blesses}</div><div className="text-xs font-semibold uppercase text-inksoft mt-1.5">Lesionats</div></div>
          </div>

          <div className="grid md:grid-cols-2 gap-3.5">
            <div>
              <div className="card mb-3.5">
                <div className="section-title"><IconAlert /> Dolors actius</div>
                {painAlerts.length === 0 ? <div className="text-sm text-inksoft py-2">No hi ha cap dolor actiu declarat. 👍</div> :
                  painAlerts.map(({ p, d }) => (
                    <Link href={`/effectif/${p.id}`} key={p.id} className="tl-item block">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <PlayerAvatar player={p} size="jersey-sm" />
                          <div>
                            <div className="font-bold text-sm">{p.prenom} {p.nom}</div>
                            <div className="text-[11.5px] text-inksoft">{d.zone} · {d.mecanisme}</div>
                          </div>
                        </div>
                        <span className={`badge ${DOULEUR_STATUTS[d.statut].cls}`}>{DOULEUR_STATUTS[d.statut].label}</span>
                      </div>
                    </Link>
                  ))}
              </div>

              <div className="card">
                <div className="section-title"><IconLoad /> Càrrega a vigilar (ACWR)</div>
                {acwrAlerts.length === 0 ? <div className="text-sm text-inksoft py-2">Cap jugador en zona de vigilància o risc.</div> :
                  acwrAlerts.map(({ p, c }) => (
                    <Link href={`/effectif/${p.id}?tab=charge`} key={p.id} className="tl-item block">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <PlayerAvatar player={p} size="jersey-sm" />
                          <div>
                            <div className="font-bold text-sm">{p.prenom} {p.nom}</div>
                            <div className="text-[11.5px] text-inksoft">ACWR {c.acwr.toFixed(2)} · càrrega aguda {Math.round(c.acute)} UA</div>
                          </div>
                        </div>
                        <span className={`badge ${c.cls}`}>{c.zoneLabel}</span>
                      </div>
                    </Link>
                  ))}
              </div>

              <div className="card mt-3.5">
                <div className="section-title"><IconBox /> Material a punt d'esgotar-se</div>
                {materielBas.length === 0 ? <div className="text-sm text-inksoft py-2">Cap producte per sota del llindar.</div> :
                  materielBas.map(m => (
                    <Link href="/materiel" key={m.id} className="tl-item block">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className={`badge ${MATERIEL_CATEGORIES[m.categorie] || 'badge-grey'}`}>{m.categorie}</span>
                          <div className="font-bold text-sm">{m.nom}</div>
                        </div>
                        <span className="badge badge-danger">{m.stock_qte} / llindar {m.seuil_alerte}</span>
                      </div>
                    </Link>
                  ))}
              </div>
            </div>

            <div className="card">
              <div className="section-title"><IconJournal /> Activitat recent</div>
              {logs.length === 0 ? <div className="text-sm text-inksoft py-2">Encara no hi ha cap activitat.</div> :
                logs.map(l => (
                  <div key={l.id} className="flex gap-3 py-2.5 border-b border-line last:border-none">
                    <div className="w-2 h-2 rounded-full bg-tape mt-1.5 flex-shrink-0" />
                    <div>
                      <div className="text-sm"><strong>{l.auteur}</strong> {l.action} {l.cible_nom ? `— ${l.cible_nom}` : ''}</div>
                      <div className="text-[11px] text-inkfaint font-mono mt-0.5">{fmtDateTime(l.date)}</div>
                    </div>
                  </div>
                ))}
              <Link href="/journal" className="btn btn-ghost btn-sm mt-2.5">Veure tot el diari →</Link>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
