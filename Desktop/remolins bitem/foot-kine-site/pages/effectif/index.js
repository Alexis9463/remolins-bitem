import { useEffect, useState } from 'react';
import Link from 'next/link';
import Layout from '../../components/Layout';
import Modal from '../../components/Modal';
import { supabase } from '../../lib/supabase';
import { POSTES, STATUTS, addLog, displayNameFromUser, uploadFile, publicUrl } from '../../lib/data';
import { IconPlus, IconTeam } from '../../components/Icons';

export default function Effectif() {
  const [players, setPlayers] = useState([]);
  const [douleursCount, setDouleursCount] = useState({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filterPoste, setFilterPoste] = useState('');
  const [filterStatut, setFilterStatut] = useState('');
  const [sortBy, setSortBy] = useState('alpha'); // 'numero' | 'alpha'
  const [showForm, setShowForm] = useState(false);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserName(displayNameFromUser(data.user)));
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data: p } = await supabase.from('players').select('*').order('numero', { ascending: true, nullsFirst: false });
    const { data: d } = await supabase.from('douleurs').select('player_id').neq('statut', 'resolue');
    const counts = {};
    (d || []).forEach(x => { counts[x.player_id] = (counts[x.player_id] || 0) + 1; });
    setDouleursCount(counts);
    setPlayers(p || []);
    setLoading(false);
  }

  let list = players.filter(p => (filterStatut ? p.statut === filterStatut : p.statut !== 'archive'));
  if (query) { const q = query.toLowerCase(); list = list.filter(p => (p.prenom + ' ' + p.nom).toLowerCase().includes(q)); }
  if (filterPoste) list = list.filter(p => p.poste === filterPoste);
  list = list.slice().sort((a, b) => sortBy === 'alpha'
    ? (a.nom + a.prenom).localeCompare(b.nom + b.prenom)
    : (a.numero ?? 999) - (b.numero ?? 999));

  async function savePlayer(form, photoFile) {
    const { data, error } = await supabase.from('players').insert({
      prenom: form.prenom, nom: form.nom, numero: form.numero || null, poste: form.poste || null,
      date_naissance: form.dateNaissance || null, taille: form.taille || null, poids: form.poids || null,
      telephone: form.telephone || null, statut: form.statut, antecedents: form.antecedents || null,
    }).select().single();
    if (error) { alert("Error en afegir: " + error.message); return; }
    if (photoFile) {
      const path = `${data.id}/${Date.now()}-${photoFile.name}`;
      try {
        await uploadFile('avatars', path, photoFile);
        await supabase.from('players').update({ photo_url: path }).eq('id', data.id);
      } catch (e) { alert('El jugador s\'ha creat però la foto no s\'ha pogut enviar: ' + e.message); }
    }
    await addLog(userName, 'ha afegit', 'Jugador', form.prenom + ' ' + form.nom);
    setShowForm(false);
    load();
  }

  return (
    <Layout title="Gestió de plantilla" subtitle="Perfils, notes, balanços i seguiment de dolors"
      actions={<button className="btn btn-primary" onClick={() => setShowForm(true)}><IconPlus /> Afegir un jugador</button>}>

      <div className="flex flex-wrap gap-2.5 mb-4">
        <input className="input flex-1 min-w-[180px]" placeholder="Cerca un jugador…" value={query} onChange={e => setQuery(e.target.value)} />
        <select className="input w-auto" value={filterPoste} onChange={e => setFilterPoste(e.target.value)}>
          <option value="">Tots els llocs</option>
          {POSTES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="input w-auto" value={filterStatut} onChange={e => setFilterStatut(e.target.value)}>
          <option value="">Actius (tots els estats)</option>
          {Object.keys(STATUTS).map(k => <option key={k} value={k}>{STATUTS[k].label}</option>)}
        </select>
        <button
          className="btn btn-secondary"
          onClick={() => setSortBy(sortBy === 'alpha' ? 'numero' : 'alpha')}
          title="Ordenar"
        >
          {sortBy === 'alpha' ? 'Ordenat A → Z · clica per ordenar per núm.' : 'Ordenat per núm. · clica per ordenar A → Z'}
        </button>
      </div>

      {loading ? <div className="text-inksoft">Carregant…</div> : list.length === 0 ? (
        <div className="text-center py-10 text-inksoft"><IconTeam className="mx-auto mb-2.5" width={38} height={38} />
          <div className="font-bold text-ink mb-1">Cap jugador</div>
          <div className="text-sm">Afegeix el teu primer jugador per començar el seguiment.</div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {list.map(p => (
            <Link href={`/effectif/${p.id}`} key={p.id} className="card flex items-center gap-3 hover:border-tape transition cursor-pointer">
              <PlayerAvatar player={p} size="jersey" />
              <div className="min-w-0 flex-1">
                <div className="font-bold text-[14.5px] truncate">{p.prenom} {p.nom}</div>
                <div className="text-xs text-inksoft mt-0.5">{p.poste || 'Lloc no indicat'}</div>
                <div className="flex gap-1.5 flex-wrap mt-1.5">
                  <span className={`badge ${STATUTS[p.statut].cls}`}><span className="badge-dot" />{STATUTS[p.statut].label}</span>
                  {douleursCount[p.id] > 0 && <span className="badge badge-danger">{douleursCount[p.id]} dolor{douleursCount[p.id] > 1 ? 's' : ''}</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showForm && <PlayerFormModal onClose={() => setShowForm(false)} onSave={savePlayer} />}
    </Layout>
  );
}

/** Mostra la foto del jugador si n'hi ha, si no el seu número de samarreta. */
export function PlayerAvatar({ player, size = 'jersey' }) {
  const cls = size === 'jersey-sm' ? 'jersey-sm' : size === 'jersey-xl' ? 'jersey-xl' : 'jersey';
  if (player.photo_url) {
    const url = publicUrl('avatars', player.photo_url);
    return <img src={url} alt={`${player.prenom} ${player.nom}`} className={`${cls} object-cover`} style={{ padding: 0 }} />;
  }
  return <div className={cls}>{player.numero || '–'}</div>;
}

export function PlayerFormModal({ onClose, onSave, initial }) {
  const [form, setForm] = useState(initial || { prenom: '', nom: '', numero: '', poste: '', dateNaissance: '', statut: 'disponible', taille: '', poids: '', telephone: '', antecedents: '' });
  const [photoFile, setPhotoFile] = useState(null);
  const [preview, setPreview] = useState(initial?.photoUrl || null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  function onPhotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoFile(file);
    setPreview(URL.createObjectURL(file));
  }

  return (
    <Modal title={initial ? 'Modificar el jugador' : 'Nou jugador'} onClose={onClose} footer={
      <>
        <button className="btn btn-secondary" onClick={onClose}>Cancel·lar</button>
        <button className="btn btn-primary" onClick={() => {
          if (!form.prenom.trim() || !form.nom.trim()) { alert('El nom i els cognoms són obligatoris.'); return; }
          onSave(form, photoFile);
        }}>Desar</button>
      </>
    }>
      <div className="field flex items-center gap-3">
        <div className="w-16 h-16 rounded-lg bg-surface2 overflow-hidden flex items-center justify-center flex-shrink-0">
          {preview ? <img src={preview} alt="" className="w-full h-full object-cover" /> : <span className="text-inkfaint text-xs">Foto</span>}
        </div>
        <div>
          <label className="label">Foto del jugador</label>
          <input type="file" accept="image/*" onChange={onPhotoChange} className="text-xs" />
        </div>
      </div>
      <div className="flex gap-3">
        <div className="field flex-1"><label className="label">Nom</label><input className="input" value={form.prenom} onChange={set('prenom')} /></div>
        <div className="field flex-1"><label className="label">Cognoms</label><input className="input" value={form.nom} onChange={set('nom')} /></div>
      </div>
      <div className="flex gap-3">
        <div className="field flex-1"><label className="label">Número</label><input className="input" type="number" value={form.numero} onChange={set('numero')} /></div>
        <div className="field flex-1"><label className="label">Lloc</label>
          <select className="input" value={form.poste} onChange={set('poste')}>
            <option value="">—</option>
            {POSTES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>
      <div className="flex gap-3">
        <div className="field flex-1"><label className="label">Data de naixement</label><input className="input" type="date" value={form.dateNaissance} onChange={set('dateNaissance')} /></div>
        <div className="field flex-1"><label className="label">Estat</label>
          <select className="input" value={form.statut} onChange={set('statut')}>
            {Object.entries(STATUTS).filter(([k]) => k !== 'archive').map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </div>
      <div className="flex gap-3">
        <div className="field flex-1"><label className="label">Alçada (cm)</label><input className="input" type="number" value={form.taille} onChange={set('taille')} /></div>
        <div className="field flex-1"><label className="label">Pes (kg)</label><input className="input" type="number" value={form.poids} onChange={set('poids')} /></div>
      </div>
      <div className="field"><label className="label">Telèfon</label><input className="input" value={form.telephone} onChange={set('telephone')} /></div>
      <div className="field"><label className="label">Antecedents mèdics</label><textarea className="input" rows={3} value={form.antecedents} onChange={set('antecedents')} /></div>
    </Modal>
  );
}
