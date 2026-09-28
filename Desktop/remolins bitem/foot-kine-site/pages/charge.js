import { useEffect, useState } from 'react';
import Link from 'next/link';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import { supabase } from '../lib/supabase';
import { addLog, displayNameFromUser, fmtDate, todayInput, computeACWR } from '../lib/data';
import { PlayerAvatar } from './effectif/index';
import { IconPlus, IconLoad, IconTrash } from '../components/Icons';

export default function Charge() {
  const [sessions, setSessions] = useState([]);
  const [players, setPlayers] = useState([]);
  const [acwrByPlayer, setAcwrByPlayer] = useState({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [userName, setUserName] = useState('');

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUserName(displayNameFromUser(data.user))); load(); }, []);

  async function load() {
    setLoading(true);
    const [{ data: s }, { data: p }, { data: entries }] = await Promise.all([
      supabase.from('sessions').select('*, session_entries(*)').order('date', { ascending: false }),
      supabase.from('players').select('*').neq('statut', 'archive').order('numero', { ascending: true, nullsFirst: false }),
      supabase.from('session_entries').select('player_id, minutes, rpe, sessions(date)'),
    ]);
    setSessions(s || []); setPlayers(p || []);
    const byPlayer = {};
    (entries || []).forEach(e => { if (!e.sessions) return; (byPlayer[e.player_id] ||= []).push({ date: e.sessions.date, minutes: e.minutes, rpe: e.rpe }); });
    const map = {};
    Object.keys(byPlayer).forEach(pid => { map[pid] = computeACWR(byPlayer[pid]); });
    setAcwrByPlayer(map);
    setLoading(false);
  }

  async function deleteSession(s) {
    if (!confirm('Suprimir aquesta sessió?')) return;
    await supabase.from('sessions').delete().eq('id', s.id);
    await addLog(userName, 'ha suprimit la sessió', 'Sessió', s.titre);
    setShowForm(false); setEditing(null); load();
  }

  const ranking = players.map(p => ({ p, c: acwrByPlayer[p.id] })).filter(x => x.c && x.c.acwr != null).sort((a, b) => b.c.acwr - a.c.acwr);

  return (
    <Layout title="Gestió de càrrega" subtitle="Temps de joc, RPE, FC i ràtio càrrega aguda / crònica"
      actions={<button className="btn btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}><IconPlus /> Nova sessió</button>}>
      {loading ? <div className="text-inksoft">Carregant…</div> : (
        <div className="grid md:grid-cols-2 gap-3.5">
          <div>
            <div className="section-title">Sessions registrades</div>
            {sessions.length === 0 ? (
              <div className="text-center py-9 text-inksoft"><IconLoad className="mx-auto mb-2.5" width={38} height={38} /><div className="font-bold text-ink mb-1">Cap sessió</div><div className="text-sm">Afegeix un partit o un entrenament per seguir la càrrega.</div></div>
            ) : sessions.map(s => {
              const total = (s.session_entries || []).reduce((a, e) => a + e.minutes * e.rpe, 0);
              return (
                <div key={s.id} className="card flex items-center gap-3.5 mb-2.5 cursor-pointer hover:border-tape" onClick={() => { setEditing(s); setShowForm(true); }}>
                  <div className={`w-[38px] h-[38px] rounded-lg flex items-center justify-center font-display font-extrabold text-xs flex-shrink-0 ${s.type === 'match' ? 'bg-dangerlight text-danger' : 'bg-okbg text-oktext'}`}>{s.type === 'match' ? 'P' : 'E'}</div>
                  <div className="flex-1 min-w-0"><div className="font-bold text-[13.5px]">{s.titre}</div><div className="text-xs text-inksoft">{fmtDate(s.date)} · {(s.session_entries || []).length} jugador{(s.session_entries || []).length > 1 ? 's' : ''}</div></div>
                  <div className="text-right"><div className="font-mono font-bold text-sm">{total} UA</div><div className="text-[11px] text-inksoft">càrrega total</div></div>
                </div>
              );
            })}
          </div>
          <div>
            <div className="section-title">Jugadors en zona de vigilància / risc</div>
            <div className="card">
              {ranking.length === 0 ? <div className="text-sm text-inksoft">Encara no hi ha prou dades de càrrega.</div> :
                ranking.map(({ p, c }) => (
                  <Link href={`/effectif/${p.id}?tab=charge`} key={p.id} className="tl-item flex items-center justify-between block">
                    <div className="flex items-center gap-2.5"><PlayerAvatar player={p} size="jersey-sm" /><div className="font-bold text-sm">{p.prenom} {p.nom}</div></div>
                    <span className={`badge ${c.cls}`}>ACWR {c.acwr.toFixed(2)}</span>
                  </Link>
                ))}
            </div>
          </div>
        </div>
      )}
      {showForm && <SessionFormModal players={players} initial={editing} userName={userName}
        onClose={() => { setShowForm(false); setEditing(null); }}
        onDelete={editing ? () => deleteSession(editing) : null}
        onSaved={() => { setShowForm(false); setEditing(null); load(); }} />}
    </Layout>
  );
}

function SessionFormModal({ players, initial, userName, onClose, onSaved, onDelete }) {
  const [date, setDate] = useState(initial?.date || todayInput());
  const [type, setType] = useState(initial?.type || 'entrainement');
  const [titre, setTitre] = useState(initial?.titre || '');
  const initialMap = {};
  (initial?.session_entries || []).forEach(e => { initialMap[e.player_id] = { minutes: e.minutes, rpe: e.rpe, bpmMax: e.bpm_max ?? '', bpmMoy: e.bpm_moy ?? '' }; });
  const [rows, setRows] = useState(initialMap);

  function toggle(pid, checked) {
    const next = { ...rows };
    if (checked) next[pid] = next[pid] || { minutes: '', rpe: '', bpmMax: '', bpmMoy: '' };
    else delete next[pid];
    setRows(next);
  }
  function setField(pid, field, val) { setRows({ ...rows, [pid]: { ...rows[pid], [field]: val } }); }

  async function save() {
    if (!titre.trim()) { alert('El títol de la sessió és obligatori.'); return; }
    const entries = Object.entries(rows)
      .map(([pid, v]) => ({
        player_id: pid, minutes: parseInt(v.minutes) || 0, rpe: parseInt(v.rpe) || 0,
        bpm_max: v.bpmMax ? parseInt(v.bpmMax) : null, bpm_moy: v.bpmMoy ? parseInt(v.bpmMoy) : null,
      }))
      .filter(e => e.minutes > 0);
    if (entries.length === 0) { alert('Afegeix com a mínim un jugador amb temps de joc.'); return; }

    let sessionId = initial?.id;
    if (initial) {
      await supabase.from('sessions').update({ date, type, titre }).eq('id', initial.id);
      await supabase.from('session_entries').delete().eq('session_id', initial.id);
      await addLog(userName, 'ha modificat la sessió', 'Sessió', titre);
    } else {
      const { data, error } = await supabase.from('sessions').insert({ date, type, titre, auteur: userName }).select().single();
      if (error) { alert('Error: ' + error.message); return; }
      sessionId = data.id;
      await addLog(userName, 'ha afegit la sessió', 'Sessió', titre, entries.length + ' jugador(s)');
    }
    await supabase.from('session_entries').insert(entries.map(e => ({ ...e, session_id: sessionId })));
    onSaved();
  }

  return (
    <Modal title={initial ? 'Modificar la sessió' : 'Nova sessió'} onClose={onClose} footer={
      <>
        {onDelete && <button className="btn btn-danger" onClick={onDelete}><IconTrash /> Suprimir</button>}
        <button className="btn btn-secondary" onClick={onClose}>Cancel·lar</button>
        <button className="btn btn-primary" onClick={save}>Desar</button>
      </>
    }>
      <div className="flex gap-3">
        <div className="field flex-1"><label className="label">Data</label><input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
        <div className="field flex-1"><label className="label">Tipus</label>
          <select className="input" value={type} onChange={e => setType(e.target.value)}>
            <option value="entrainement">Entrenament</option>
            <option value="match">Partit</option>
          </select>
        </div>
      </div>
      <div className="field"><label className="label">Títol</label><input className="input" placeholder={type === 'match' ? 'ex: vs Girona (local)' : 'ex: Entrenament col·lectiu'} value={titre} onChange={e => setTitre(e.target.value)} /></div>

      <label className="label mt-1">Jugadors — temps de joc (min), RPE (0–10) i freqüència cardíaca (bpm)</label>
      <div className="max-h-72 overflow-y-auto border border-line rounded-lg px-2.5">
        <div className="grid grid-cols-[22px_1fr_54px_44px_58px_58px] gap-1.5 py-1.5 text-[10px] font-bold uppercase text-inksoft">
          <div></div><div>Jugador</div><div>Min.</div><div>RPE</div><div>FC mitj</div><div>FC màx</div>
        </div>
        {players.map(p => {
          const checked = !!rows[p.id];
          return (
            <div key={p.id} className="grid grid-cols-[22px_1fr_54px_44px_58px_58px] gap-1.5 items-center py-1.5 border-t border-line">
              <input type="checkbox" checked={checked} onChange={e => toggle(p.id, e.target.checked)} />
              <div className="text-xs font-semibold truncate">{p.numero || '–'} · {p.prenom} {p.nom}</div>
              <input className="input" style={{ padding: '6px 6px' }} type="number" min={0} max={120} disabled={!checked} value={rows[p.id]?.minutes ?? ''} onChange={e => setField(p.id, 'minutes', e.target.value)} placeholder="0" />
              <input className="input" style={{ padding: '6px 6px' }} type="number" min={0} max={10} disabled={!checked} value={rows[p.id]?.rpe ?? ''} onChange={e => setField(p.id, 'rpe', e.target.value)} placeholder="0" />
              <input className="input" style={{ padding: '6px 6px' }} type="number" min={0} max={230} disabled={!checked} value={rows[p.id]?.bpmMoy ?? ''} onChange={e => setField(p.id, 'bpmMoy', e.target.value)} placeholder="—" />
              <input className="input" style={{ padding: '6px 6px' }} type="number" min={0} max={230} disabled={!checked} value={rows[p.id]?.bpmMax ?? ''} onChange={e => setField(p.id, 'bpmMax', e.target.value)} placeholder="—" />
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
