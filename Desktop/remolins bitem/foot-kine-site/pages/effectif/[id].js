import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '../../components/Layout';
import Modal from '../../components/Modal';
import Gauge from '../../components/Gauge';
import Sparkline from '../../components/Sparkline';
import { supabase } from '../../lib/supabase';
import {
  POSTES, STATUTS, NOTE_CATEGORIES, BILAN_TYPES, ZONES_COURANTES, MECANISMES, DOULEUR_STATUTS,
  addLog, displayNameFromUser, fmtDate, fmtDateTime, todayInput, ageFromDob, computeACWR,
  computeBMI, uploadFile, signedUrl, deleteFile, publicUrl,
} from '../../lib/data';
import { toCSV, downloadCSV, exportLineChartPNG } from '../../lib/exports';
import { IconBack, IconEdit, IconTrash, IconPlus, IconJournal, IconAlert, IconCheck, IconLoad, IconArchive } from '../../components/Icons';
import { PlayerFormModal, PlayerAvatar } from './index';

const SUBTABS = [
  { id: 'infos', label: 'Informació' },
  { id: 'notes', label: 'Notes' },
  { id: 'bilans', label: 'Balanços / tests' },
  { id: 'douleurs', label: 'Dolors' },
  { id: 'mesures', label: 'Pes / greix corporal' },
  { id: 'charge', label: 'Càrrega' },
];

export default function PlayerDetail() {
  const router = useRouter();
  const { id, tab } = router.query;
  const [player, setPlayer] = useState(null);
  const [notes, setNotes] = useState([]);
  const [bilans, setBilans] = useState([]);
  const [douleurs, setDouleurs] = useState([]);
  const [mesures, setMesures] = useState([]);
  const [sessionEntries, setSessionEntries] = useState([]);
  const [activeTab, setActiveTab] = useState('infos');
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingPlayer, setEditingPlayer] = useState(false);
  const [modal, setModal] = useState(null); // {type:'note'|'bilan'|'douleur'|'mesure', item?}

  useEffect(() => { if (tab) setActiveTab(tab); }, [tab]);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUserName(displayNameFromUser(data.user))); }, []);
  useEffect(() => { if (id) load(); }, [id]);

  async function load() {
    setLoading(true);
    const [{ data: p }, { data: n }, { data: b }, { data: d }, { data: m }, { data: se }] = await Promise.all([
      supabase.from('players').select('*').eq('id', id).single(),
      supabase.from('notes').select('*').eq('player_id', id).order('date', { ascending: false }),
      supabase.from('bilans').select('*').eq('player_id', id).order('date', { ascending: false }),
      supabase.from('douleurs').select('*').eq('player_id', id).order('date_debut', { ascending: false }),
      supabase.from('mesures').select('*').eq('player_id', id).order('date', { ascending: false }),
      supabase.from('session_entries').select('*, sessions(id, date, type, titre)').eq('player_id', id),
    ]);
    setPlayer(p); setNotes(n || []); setBilans(b || []); setDouleurs(d || []); setMesures(m || []);
    setSessionEntries((se || []).filter(e => e.sessions).sort((a, b) => new Date(b.sessions.date) - new Date(a.sessions.date)));
    setLoading(false);
  }

  function goTab(t) { setActiveTab(t); router.replace({ pathname: router.pathname, query: { id } }, undefined, { shallow: true }); }

  async function savePlayerEdit(form, photoFile) {
    const { error } = await supabase.from('players').update({
      prenom: form.prenom, nom: form.nom, numero: form.numero || null, poste: form.poste || null,
      date_naissance: form.dateNaissance || null, taille: form.taille || null, poids: form.poids || null,
      telephone: form.telephone || null, statut: form.statut, antecedents: form.antecedents || null,
    }).eq('id', id);
    if (error) { alert('Error: ' + error.message); return; }
    if (photoFile) {
      const path = `${id}/${Date.now()}-${photoFile.name}`;
      try {
        await uploadFile('avatars', path, photoFile);
        await supabase.from('players').update({ photo_url: path }).eq('id', id);
      } catch (e) { alert("La fitxa s'ha actualitzat però la foto no s'ha pogut enviar: " + e.message); }
    }
    await addLog(userName, 'ha modificat la fitxa de', 'Jugador', form.prenom + ' ' + form.nom);
    setEditingPlayer(false); load();
  }

  async function archivePlayer() {
    if (!confirm(`Arxivar ${player.prenom} ${player.nom}?`)) return;
    await supabase.from('players').update({ statut: 'archive' }).eq('id', id);
    await addLog(userName, 'ha arxivat', 'Jugador', player.prenom + ' ' + player.nom);
    router.push('/effectif');
  }

  if (loading || !player) return <Layout title="Fitxa del jugador"><div className="text-inksoft">Carregant…</div></Layout>;

  const acwrEntries = sessionEntries.map(e => ({ date: e.sessions.date, minutes: e.minutes, rpe: e.rpe }));
  const c = computeACWR(acwrEntries);
  const activeDouleurs = douleurs.filter(d => d.statut !== 'resolue');
  const lastMesure = mesures[0];

  return (
    <Layout title="Fitxa del jugador">
      <Link href="/effectif" className="btn btn-ghost btn-sm mb-3.5"><IconBack /> Tornar a la plantilla</Link>

      <div className="card flex items-center gap-4 flex-wrap mb-4">
        <PlayerAvatar player={player} size="jersey-xl" />
        <div className="flex-1 min-w-[200px]">
          <div className="font-display font-extrabold text-2xl uppercase">{player.prenom} {player.nom}</div>
          <div className="text-inksoft text-[13px] mt-0.5">{player.poste || 'Lloc no indicat'}{player.date_naissance ? ` · ${ageFromDob(player.date_naissance)} anys` : ''}</div>
          <div className="flex gap-1.5 flex-wrap mt-2">
            <span className={`badge ${STATUTS[player.statut].cls}`}><span className="badge-dot" />{STATUTS[player.statut].label}</span>
            {activeDouleurs.length > 0 && <span className="badge badge-danger">{activeDouleurs.length} dolor{activeDouleurs.length > 1 ? 's' : ''} actiu{activeDouleurs.length > 1 ? 's' : ''}</span>}
            {c.acwr != null && <span className={`badge ${c.cls}`}>ACWR {c.acwr.toFixed(2)}</span>}
            {lastMesure && <span className="badge badge-grey">{lastMesure.poids != null ? lastMesure.poids + ' kg' : ''}{lastMesure.poids != null && lastMesure.masse_grasse != null ? ' · ' : ''}{lastMesure.masse_grasse != null ? lastMesure.masse_grasse + ' % greix' : ''}</span>}
          </div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => setEditingPlayer(true)}><IconEdit /> Modificar</button>
      </div>

      <div className="flex gap-1 border-b border-line mb-4 overflow-x-auto">
        {SUBTABS.map(t => (
          <div key={t.id} className={`subtab ${activeTab === t.id ? 'subtab-active' : ''}`} onClick={() => goTab(t.id)}>
            {t.label}{t.id === 'notes' && ` (${notes.length})`}{t.id === 'bilans' && ` (${bilans.length})`}{t.id === 'douleurs' && ` (${douleurs.length})`}{t.id === 'mesures' && ` (${mesures.length})`}
          </div>
        ))}
      </div>

      {activeTab === 'infos' && (
        <div className="card">
          <div className="grid grid-cols-3 gap-4">
            <div><div className="label">Data de naixement</div><div className="font-semibold">{player.date_naissance ? fmtDate(player.date_naissance) : '—'}</div></div>
            <div><div className="label">Alçada</div><div className="font-semibold">{player.taille ? player.taille + ' cm' : '—'}</div></div>
            <div><div className="label">Pes</div><div className="font-semibold">{player.poids ? player.poids + ' kg' : '—'}</div></div>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div><div className="label">Lloc</div><div className="font-semibold">{player.poste || '—'}</div></div>
            <div><div className="label">Estat</div><div className="font-semibold">{STATUTS[player.statut].label}</div></div>
            <div><div className="label">Telèfon</div><div className="font-semibold">{player.telephone || '—'}</div></div>
          </div>
          {player.antecedents && <div className="mt-4"><div className="label">Antecedents mèdics</div><div className="text-sm whitespace-pre-wrap">{player.antecedents}</div></div>}
          <div className="mt-5 pt-4 border-t border-line">
            <button className="btn btn-danger btn-sm" onClick={archivePlayer}><IconArchive /> Arxivar aquest jugador</button>
          </div>
        </div>
      )}

      {activeTab === 'notes' && (
        <NotesTab notes={notes} onAdd={() => setModal({ type: 'note' })} onEdit={(item) => setModal({ type: 'note', item })}
          onDelete={async (item) => { if (!confirm('Suprimir aquesta nota?')) return; await supabase.from('notes').delete().eq('id', item.id); await addLog(userName, 'ha suprimit una nota per a', 'Nota', player.prenom + ' ' + player.nom); load(); }} />
      )}
      {activeTab === 'bilans' && (
        <BilansTab bilans={bilans} onAdd={() => setModal({ type: 'bilan' })} onEdit={(item) => setModal({ type: 'bilan', item })}
          onDelete={async (item) => { if (!confirm('Suprimir aquest balanç?')) return; await supabase.from('bilans').delete().eq('id', item.id); await addLog(userName, 'ha suprimit un balanç per a', 'Balanç', player.prenom + ' ' + player.nom); load(); }} />
      )}
      {activeTab === 'douleurs' && (
        <DouleursTab douleurs={douleurs} onAdd={() => setModal({ type: 'douleur' })} onEdit={(item) => setModal({ type: 'douleur', item })}
          onDelete={async (item) => { if (!confirm('Suprimir aquest registre de dolor?')) return; await supabase.from('douleurs').delete().eq('id', item.id); await addLog(userName, 'ha suprimit un dolor per a', 'Dolor', player.prenom + ' ' + player.nom); load(); }} />
      )}
      {activeTab === 'mesures' && (
        <MesuresTab mesures={mesures} playerTaille={player.taille} playerName={`${player.prenom} ${player.nom}`} onAdd={() => setModal({ type: 'mesure' })} onEdit={(item) => setModal({ type: 'mesure', item })}
          onDelete={async (item) => { if (!confirm('Suprimir aquesta mesura?')) return; await supabase.from('mesures').delete().eq('id', item.id); await addLog(userName, 'ha suprimit una mesura per a', 'Mesura', player.prenom + ' ' + player.nom); load(); }} />
      )}
      {activeTab === 'charge' && <ChargeTab c={c} entries={sessionEntries} playerName={`${player.prenom} ${player.nom}`} />}

      {editingPlayer && (
        <PlayerFormModal
          initial={{
            prenom: player.prenom, nom: player.nom, numero: player.numero || '', poste: player.poste || '',
            dateNaissance: player.date_naissance || '', statut: player.statut, taille: player.taille || '',
            poids: player.poids || '', telephone: player.telephone || '', antecedents: player.antecedents || '',
            photoUrl: player.photo_url ? publicUrl('avatars', player.photo_url) : null,
          }}
          onClose={() => setEditingPlayer(false)} onSave={savePlayerEdit}
        />
      )}

      {modal?.type === 'note' && <NoteModal item={modal.item} playerId={id} playerName={`${player.prenom} ${player.nom}`} userName={userName} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
      {modal?.type === 'bilan' && <BilanModal item={modal.item} playerId={id} playerName={`${player.prenom} ${player.nom}`} userName={userName} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
      {modal?.type === 'douleur' && <DouleurModal item={modal.item} playerId={id} playerName={`${player.prenom} ${player.nom}`} userName={userName} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
      {modal?.type === 'mesure' && <MesureModal item={modal.item} playerId={id} playerName={`${player.prenom} ${player.nom}`} userName={userName} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
    </Layout>
  );
}

/* ---------------- NOTES ---------------- */
function NotesTab({ notes, onAdd, onEdit, onDelete }) {
  return (
    <div>
      <button className="btn btn-primary btn-sm mb-3.5" onClick={onAdd}><IconPlus /> Afegir una nota</button>
      {notes.length === 0 ? <Empty icon={<IconJournal />} title="Cap nota" sub="Afegeix una nota de seguiment per a aquest jugador." /> :
        notes.map(n => (
          <div key={n.id} className="tl-item">
            <div className="flex justify-between items-start gap-2 mb-1.5">
              <div className="text-[11.5px] text-inksoft flex gap-2 items-center flex-wrap"><strong className="text-ink">{n.auteur}</strong> · {fmtDateTime(n.date)} <span className="badge badge-grey">{n.categorie}</span></div>
              <div className="flex gap-1.5 flex-shrink-0">
                <button className="icon-btn" onClick={() => onEdit(n)}><IconEdit /></button>
                <button className="icon-btn" onClick={() => onDelete(n)}><IconTrash /></button>
              </div>
            </div>
            <div className="text-sm whitespace-pre-wrap">{n.texte}</div>
            <AttachmentsList fichiers={n.fichiers} />
          </div>
        ))}
    </div>
  );
}
function AttachmentsList({ fichiers }) {
  if (!fichiers || fichiers.length === 0) return null;
  async function open(path) {
    try { const url = await signedUrl('documents', path); window.open(url, '_blank'); }
    catch (e) { alert("No s'ha pogut obrir aquest fitxer: " + e.message); }
  }
  return (
    <div className="flex flex-wrap gap-1.5 mt-2.5">
      {fichiers.map((f, i) => (
        <button key={i} onClick={() => open(f.path)} className="badge badge-blue" style={{ cursor: 'pointer' }}>📎 {f.name}</button>
      ))}
    </div>
  );
}
function AttachmentsField({ fichiers, setFichiers, folder }) {
  const [uploading, setUploading] = useState(false);
  async function onChange(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      for (const file of files) {
        const path = `${folder}/${Date.now()}-${file.name}`;
        await uploadFile('documents', path, file);
        setFichiers(prev => [...prev, { name: file.name, path }]);
      }
    } catch (err) { alert("Error en enviar el fitxer: " + err.message); }
    setUploading(false);
    e.target.value = '';
  }
  async function remove(idx) {
    const f = fichiers[idx];
    setFichiers(prev => prev.filter((_, i) => i !== idx));
    try { await deleteFile('documents', f.path); } catch (e) { /* silenciós */ }
  }
  return (
    <div className="field">
      <label className="label">Fitxers adjunts (fotos, PDF, informes…)</label>
      <input type="file" multiple onChange={onChange} className="text-xs" disabled={uploading} />
      {uploading && <div className="text-xs text-inksoft mt-1">Enviant…</div>}
      {fichiers.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {fichiers.map((f, i) => (
            <span key={i} className="badge badge-grey">📎 {f.name}
              <button onClick={() => remove(i)} className="ml-1 font-bold" style={{ cursor: 'pointer' }}>✕</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
function NoteModal({ item, playerId, playerName, userName, onClose, onSaved }) {
  const [date, setDate] = useState(item?.date || todayInput());
  const [categorie, setCategorie] = useState(item?.categorie || NOTE_CATEGORIES[0]);
  const [texte, setTexte] = useState(item?.texte || '');
  const [fichiers, setFichiers] = useState(item?.fichiers || []);
  async function save() {
    if (!texte.trim()) { alert('La nota no pot estar buida.'); return; }
    if (item) {
      await supabase.from('notes').update({ date, categorie, texte, fichiers }).eq('id', item.id);
      await addLog(userName, 'ha modificat una nota per a', 'Nota', playerName);
    } else {
      await supabase.from('notes').insert({ player_id: playerId, date, categorie, texte, fichiers, auteur: userName });
      await addLog(userName, 'ha afegit una nota per a', 'Nota', playerName);
    }
    onSaved();
  }
  return (
    <Modal title={item ? 'Modificar la nota' : 'Nova nota'} onClose={onClose} footer={<><button className="btn btn-secondary" onClick={onClose}>Cancel·lar</button><button className="btn btn-primary" onClick={save}>Desar</button></>}>
      <div className="flex gap-3">
        <div className="field flex-1"><label className="label">Data</label><input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
        <div className="field flex-1"><label className="label">Categoria</label><select className="input" value={categorie} onChange={e => setCategorie(e.target.value)}>{NOTE_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
      </div>
      <div className="field"><label className="label">Nota</label><textarea className="input" rows={5} value={texte} onChange={e => setTexte(e.target.value)} /></div>
      <AttachmentsField fichiers={fichiers} setFichiers={setFichiers} folder={`notes/${playerId}`} />
    </Modal>
  );
}

/* ---------------- BALANÇOS ---------------- */
function BilansTab({ bilans, onAdd, onEdit, onDelete }) {
  return (
    <div>
      <button className="btn btn-primary btn-sm mb-3.5" onClick={onAdd}><IconPlus /> Afegir un balanç / test</button>
      {bilans.length === 0 ? <Empty icon={<IconCheck />} title="Cap balanç registrat" sub="Afegeix un balanç inicial o un resultat de test." /> :
        bilans.map(b => (
          <div key={b.id} className="tl-item">
            <div className="flex justify-between items-start gap-2 mb-1.5">
              <div>
                <div className="font-bold text-sm">{b.titre || b.type}</div>
                <div className="text-[11.5px] text-inksoft flex gap-2 items-center flex-wrap mt-0.5"><span className="badge badge-blue">{b.type}</span> <strong className="text-ink">{b.auteur}</strong> · {fmtDate(b.date)}</div>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <button className="icon-btn" onClick={() => onEdit(b)}><IconEdit /></button>
                <button className="icon-btn" onClick={() => onDelete(b)}><IconTrash /></button>
              </div>
            </div>
            {b.valeurs && <div className="text-xs font-mono bg-surface2 px-2.5 py-2 rounded-md mb-1.5">{b.valeurs}</div>}
            <div className="text-sm whitespace-pre-wrap">{b.resultats}</div>
            <AttachmentsList fichiers={b.fichiers} />
          </div>
        ))}
    </div>
  );
}
function BilanModal({ item, playerId, playerName, userName, onClose, onSaved }) {
  const [date, setDate] = useState(item?.date || todayInput());
  const [type, setType] = useState(item?.type || BILAN_TYPES[0]);
  const [titre, setTitre] = useState(item?.titre || '');
  const [valeurs, setValeurs] = useState(item?.valeurs || '');
  const [resultats, setResultats] = useState(item?.resultats || '');
  const [fichiers, setFichiers] = useState(item?.fichiers || []);
  async function save() {
    const payload = { date, type, titre: titre.trim(), valeurs: valeurs.trim(), resultats: resultats.trim(), fichiers };
    if (item) {
      await supabase.from('bilans').update(payload).eq('id', item.id);
      await addLog(userName, 'ha modificat un balanç per a', 'Balanç', playerName);
    } else {
      await supabase.from('bilans').insert({ ...payload, player_id: playerId, auteur: userName });
      await addLog(userName, 'ha afegit un balanç per a', 'Balanç', playerName, type);
    }
    onSaved();
  }
  return (
    <Modal title={item ? 'Modificar el balanç' : 'Nou balanç / test'} onClose={onClose} footer={<><button className="btn btn-secondary" onClick={onClose}>Cancel·lar</button><button className="btn btn-primary" onClick={save}>Desar</button></>}>
      <div className="flex gap-3">
        <div className="field flex-1"><label className="label">Data</label><input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
        <div className="field flex-1"><label className="label">Tipus</label><select className="input" value={type} onChange={e => setType(e.target.value)}>{BILAN_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
      </div>
      <div className="field"><label className="label">Títol (opcional)</label><input className="input" placeholder="ex: Balanç de represa post-esquinç" value={titre} onChange={e => setTitre(e.target.value)} /></div>
      <div className="field"><label className="label">Valors / mesures (opcional)</label><textarea className="input" rows={2} placeholder="ex: Força isquios D 220N / E 240N" value={valeurs} onChange={e => setValeurs(e.target.value)} /></div>
      <div className="field"><label className="label">Resultats / observacions</label><textarea className="input" rows={4} value={resultats} onChange={e => setResultats(e.target.value)} /></div>
      <AttachmentsField fichiers={fichiers} setFichiers={setFichiers} folder={`bilans/${playerId}`} />
    </Modal>
  );
}

/* ---------------- DOLORS ---------------- */
function DouleursTab({ douleurs, onAdd, onEdit, onDelete }) {
  return (
    <div>
      <button className="btn btn-primary btn-sm mb-3.5" onClick={onAdd}><IconPlus /> Notificar un dolor</button>
      {douleurs.length === 0 ? <Empty icon={<IconAlert />} title="Cap dolor notificat" sub="Historial buit per a aquest jugador." /> :
        douleurs.map(d => (
          <div key={d.id} className="tl-item">
            <div className="flex justify-between items-start gap-2 mb-1.5">
              <div>
                <div className="font-bold text-sm">{d.zone} <span className="text-inksoft font-medium">— {d.mecanisme}</span></div>
                <div className="text-[11.5px] text-inksoft flex gap-2 items-center flex-wrap mt-0.5">
                  <span className={`badge ${DOULEUR_STATUTS[d.statut].cls}`}>{DOULEUR_STATUTS[d.statut].label}</span>
                  Intensitat {d.intensite}/10 · des del {fmtDate(d.date_debut)}{d.date_resolution ? ' · resolta el ' + fmtDate(d.date_resolution) : ''} · <strong className="text-ink">{d.auteur}</strong>
                </div>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <button className="icon-btn" onClick={() => onEdit(d)}><IconEdit /></button>
                <button className="icon-btn" onClick={() => onDelete(d)}><IconTrash /></button>
              </div>
            </div>
            {d.description && <div className="text-sm whitespace-pre-wrap">{d.description}</div>}
          </div>
        ))}
    </div>
  );
}
function DouleurModal({ item, playerId, playerName, userName, onClose, onSaved }) {
  const [zone, setZone] = useState(item?.zone || ZONES_COURANTES[0]);
  const [mecanisme, setMecanisme] = useState(item?.mecanisme || MECANISMES[0]);
  const [dateDebut, setDateDebut] = useState(item?.date_debut || todayInput());
  const [intensite, setIntensite] = useState(item?.intensite ?? 5);
  const [statut, setStatut] = useState(item?.statut || 'active');
  const [dateResolution, setDateResolution] = useState(item?.date_resolution || '');
  const [description, setDescription] = useState(item?.description || '');
  async function save() {
    const payload = { zone, mecanisme, date_debut: dateDebut, intensite: parseInt(intensite) || 0, statut, date_resolution: dateResolution || null, description: description.trim() };
    if (item) {
      await supabase.from('douleurs').update(payload).eq('id', item.id);
      await addLog(userName, 'ha actualitzat un dolor per a', 'Dolor', playerName, zone);
    } else {
      await supabase.from('douleurs').insert({ ...payload, player_id: playerId, auteur: userName });
      await addLog(userName, 'ha notificat un dolor per a', 'Dolor', playerName, zone);
    }
    onSaved();
  }
  return (
    <Modal title={item ? 'Modificar el dolor' : 'Notificar un dolor'} onClose={onClose} footer={<><button className="btn btn-secondary" onClick={onClose}>Cancel·lar</button><button className="btn btn-primary" onClick={save}>Desar</button></>}>
      <div className="flex gap-3">
        <div className="field flex-1"><label className="label">Zona</label><select className="input" value={zone} onChange={e => setZone(e.target.value)}>{ZONES_COURANTES.map(z => <option key={z}>{z}</option>)}</select></div>
        <div className="field flex-1"><label className="label">Mecanisme</label><select className="input" value={mecanisme} onChange={e => setMecanisme(e.target.value)}>{MECANISMES.map(m => <option key={m}>{m}</option>)}</select></div>
      </div>
      <div className="flex gap-3">
        <div className="field flex-1"><label className="label">Data d'inici</label><input className="input" type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} /></div>
        <div className="field flex-1"><label className="label">Intensitat (0–10)</label><input className="input" type="number" min={0} max={10} value={intensite} onChange={e => setIntensite(e.target.value)} /></div>
      </div>
      <div className="flex gap-3">
        <div className="field flex-1"><label className="label">Estat</label><select className="input" value={statut} onChange={e => setStatut(e.target.value)}>{Object.entries(DOULEUR_STATUTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
        <div className="field flex-1"><label className="label">Data de resolució</label><input className="input" type="date" value={dateResolution} onChange={e => setDateResolution(e.target.value)} /></div>
      </div>
      <div className="field"><label className="label">Descripció / conducta a seguir</label><textarea className="input" rows={3} value={description} onChange={e => setDescription(e.target.value)} /></div>
    </Modal>
  );
}

/* ---------------- MESURES (pes / greix corporal) ---------------- */
function MesuresTab({ mesures, playerTaille, playerName, onAdd, onEdit, onDelete }) {
  const asc = mesures.slice().reverse();
  const last = mesures[0], prev = mesures[1];
  function delta(curr, prevVal, unit) {
    if (curr == null || prevVal == null) return null;
    const d = curr - prevVal;
    if (Math.abs(d) < 0.01) return <span className="badge badge-grey">estable</span>;
    return <span className="badge badge-grey">{d > 0 ? '▲' : '▼'} {Math.abs(d).toFixed(1)}{unit}</span>;
  }
  const lastTaille = last?.taille || playerTaille;
  const lastBMI = last ? computeBMI(last.poids, lastTaille) : null;

  function exportCSV() {
    const rows = asc.map(m => {
      const taille = m.taille || playerTaille;
      const bmi = computeBMI(m.poids, taille);
      return [fmtDate(m.date), m.poids ?? '', taille ?? '', bmi != null ? bmi.toFixed(1) : '', m.masse_grasse ?? '', m.notes ?? '', m.auteur ?? ''];
    });
    const csv = toCSV(['Data', 'Pes (kg)', 'Alçada (cm)', 'IMC', 'Greix corporal (%)', 'Nota', 'Autor'], rows);
    downloadCSV(`${playerName} - pes-imc-greix corporal.csv`, csv);
  }
  function exportPNG() {
    exportLineChartPNG({
      filename: `${playerName} - pes-greix corporal.png`,
      title: `${playerName} — Pes / greix corporal`,
      subtitle: `${asc.length} mesura(es)`,
      panels: [
        { label: 'Pes', unit: 'kg', color: '#1D5FB8', points: asc.map(m => ({ x: fmtDate(m.date), y: m.poids })) },
        { label: 'Greix corporal', unit: '%', color: '#B8823A', points: asc.map(m => ({ x: fmtDate(m.date), y: m.masse_grasse })) },
        { label: 'IMC', unit: 'kg/m²', color: '#2C63A6', points: asc.map(m => ({ x: fmtDate(m.date), y: computeBMI(m.poids, m.taille || playerTaille) })) },
      ],
    });
  }

  return (
    <div>
      <div className="grid sm:grid-cols-3 gap-3.5 mb-3.5">
        <div className="card">
          <div className="flex justify-between items-baseline"><div className="font-display font-extrabold text-[26px]">{last?.poids != null ? last.poids + ' kg' : '—'}</div>{last && delta(last.poids, prev?.poids, ' kg')}</div>
          <div className="text-xs font-semibold uppercase text-inksoft mt-1.5">Darrer pes{last ? ' · ' + fmtDate(last.date) : ''}</div>
        </div>
        <div className="card">
          <div className="flex justify-between items-baseline"><div className="font-display font-extrabold text-[26px]">{last?.masse_grasse != null ? last.masse_grasse + ' %' : '—'}</div>{last && delta(last.masse_grasse, prev?.masse_grasse, ' %')}</div>
          <div className="text-xs font-semibold uppercase text-inksoft mt-1.5">Darrer greix corporal (pinça){last ? ' · ' + fmtDate(last.date) : ''}</div>
        </div>
        <div className="card">
          <div className="font-display font-extrabold text-[26px]">{lastBMI != null ? lastBMI.toFixed(1) : '—'}</div>
          <div className="text-xs font-semibold uppercase text-inksoft mt-1.5">IMC {lastTaille ? `(alçada ${lastTaille} cm)` : '(falta l\'alçada)'}</div>
        </div>
      </div>
      <p className="text-xs text-inksoft -mt-2 mb-3.5">L'IMC és només orientatiu en esportistes amb molta massa muscular — cal interpretar-lo amb altres indicadors (greix corporal, sensacions, historial).</p>
      <div className="flex flex-wrap gap-2 mb-3.5">
        <button className="btn btn-primary btn-sm" onClick={onAdd}><IconPlus /> Afegir una mesura</button>
        <button className="btn btn-secondary btn-sm" disabled={mesures.length === 0} onClick={exportCSV}>Exportar en taula (CSV)</button>
        <button className="btn btn-secondary btn-sm" disabled={mesures.length < 2} onClick={exportPNG}>Exportar el gràfic (PNG)</button>
      </div>
      {mesures.length >= 2 && (
        <div className="grid sm:grid-cols-2 gap-3.5 mb-3.5">
          <div className="card"><div className="section-title text-[13px]">Evolució del pes</div><Sparkline points={asc.map(m => ({ date: m.date, value: m.poids }))} color="#2E7A82" unit="kg" /></div>
          <div className="card"><div className="section-title text-[13px]">Evolució del greix corporal</div><Sparkline points={asc.map(m => ({ date: m.date, value: m.masse_grasse }))} color="#B8823A" unit="%" /></div>
        </div>
      )}
      {mesures.length === 0 ? <Empty icon={<IconLoad />} title="Cap mesura" sub="Afegeix el primer registre de pes / greix corporal amb plicòmetre." /> :
        mesures.map(m => {
          const bmi = computeBMI(m.poids, m.taille || playerTaille);
          return (
          <div key={m.id} className="tl-item">
            <div className="flex justify-between items-start gap-2 mb-1.5">
              <div className="text-[11.5px] text-inksoft"><strong className="text-ink">{m.auteur}</strong> · {fmtDate(m.date)}</div>
              <div className="flex gap-1.5 flex-shrink-0"><button className="icon-btn" onClick={() => onEdit(m)}><IconEdit /></button><button className="icon-btn" onClick={() => onDelete(m)}><IconTrash /></button></div>
            </div>
            <div className="flex gap-6 flex-wrap">
              <div><div className="text-[11px] font-bold uppercase text-inksoft">Pes</div><div className="font-bold font-mono">{m.poids != null ? m.poids + ' kg' : '—'}</div></div>
              <div><div className="text-[11px] font-bold uppercase text-inksoft">Greix corporal</div><div className="font-bold font-mono">{m.masse_grasse != null ? m.masse_grasse + ' %' : '—'}</div></div>
              <div><div className="text-[11px] font-bold uppercase text-inksoft">IMC</div><div className="font-bold font-mono">{bmi != null ? bmi.toFixed(1) : '—'}</div></div>
              {m.notes && <div className="flex-1"><div className="text-[11px] font-bold uppercase text-inksoft">Nota</div><div className="text-sm">{m.notes}</div></div>}
            </div>
          </div>
          );
        })}
    </div>
  );
}
function MesureModal({ item, playerId, playerName, userName, onClose, onSaved }) {
  const [date, setDate] = useState(item?.date || todayInput());
  const [poids, setPoids] = useState(item?.poids ?? '');
  const [taille, setTaille] = useState(item?.taille ?? '');
  const [masseGrasse, setMasseGrasse] = useState(item?.masse_grasse ?? '');
  const [notes, setNotes] = useState(item?.notes || '');
  async function save() {
    if (!poids && !masseGrasse) { alert('Indica com a mínim el pes o el greix corporal.'); return; }
    const payload = { date, poids: poids ? parseFloat(poids) : null, taille: taille ? parseInt(taille) : null, masse_grasse: masseGrasse ? parseFloat(masseGrasse) : null, notes: notes.trim() };
    if (item) {
      await supabase.from('mesures').update(payload).eq('id', item.id);
      await addLog(userName, 'ha modificat una mesura (pes/greix corporal) per a', 'Mesura', playerName);
    } else {
      await supabase.from('mesures').insert({ ...payload, player_id: playerId, auteur: userName });
      await addLog(userName, 'ha afegit una mesura (pes/greix corporal) per a', 'Mesura', playerName);
    }
    onSaved();
  }
  return (
    <Modal title={item ? 'Modificar la mesura' : 'Nova mesura'} onClose={onClose} footer={<><button className="btn btn-secondary" onClick={onClose}>Cancel·lar</button><button className="btn btn-primary" onClick={save}>Desar</button></>}>
      <div className="field"><label className="label">Data</label><input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
      <div className="flex gap-3">
        <div className="field flex-1"><label className="label">Pes (kg)</label><input className="input" type="number" step="0.1" value={poids} onChange={e => setPoids(e.target.value)} /></div>
        <div className="field flex-1"><label className="label">Greix corporal (%) — plicòmetre</label><input className="input" type="number" step="0.1" value={masseGrasse} onChange={e => setMasseGrasse(e.target.value)} /></div>
      </div>
      <div className="field"><label className="label">Alçada (cm) — opcional, si no s'utilitza la de la fitxa del jugador per calcular l'IMC</label><input className="input" type="number" value={taille} onChange={e => setTaille(e.target.value)} /></div>
      <div className="field"><label className="label">Nota (opcional)</label><textarea className="input" rows={2} placeholder="ex: mesura en dejú, 3 plecs" value={notes} onChange={e => setNotes(e.target.value)} /></div>
    </Modal>
  );
}

/* ---------------- CÀRREGA (vista jugador) ---------------- */
function ChargeTab({ c, entries, playerName }) {
  const asc = entries.slice().reverse();
  function exportCSV() {
    const rows = asc.map(e => [fmtDate(e.sessions.date), e.sessions.type === 'match' ? 'Partit' : 'Entrenament', e.sessions.titre, e.minutes, e.rpe, e.minutes * e.rpe, e.bpm_moy ?? '', e.bpm_max ?? '']);
    const csv = toCSV(['Data', 'Tipus', 'Sessió', 'Minuts', 'RPE', 'Càrrega (UA)', 'FC mitjana', 'FC màxima'], rows);
    downloadCSV(`${playerName} - carrega.csv`, csv);
  }
  function exportPNG() {
    exportLineChartPNG({
      filename: `${playerName} - carrega.png`,
      title: `${playerName} — Càrrega de treball`,
      subtitle: `${asc.length} sessió/ons`,
      panels: [
        { label: 'Càrrega per sessió', unit: 'UA', color: '#1D5FB8', points: asc.map(e => ({ x: fmtDate(e.sessions.date), y: e.minutes * e.rpe })) },
        { label: 'Freqüència cardíaca mitjana', unit: 'bpm', color: '#2C63A6', points: asc.map(e => ({ x: fmtDate(e.sessions.date), y: e.bpm_moy })) },
      ],
    });
  }
  return (
    <div className="grid md:grid-cols-2 gap-3.5">
      <div className="card flex flex-col items-center">
        <div className="section-title self-start">Ràtio càrrega aguda / crònica</div>
        <Gauge acwr={c.acwr} />
        <div className="text-xs font-bold uppercase text-inksoft mt-0.5">{c.acwr != null ? c.zoneLabel : 'Historial insuficient (mín. 2 setmanes de dades)'}</div>
        <div className="grid grid-cols-2 gap-3.5 w-full mt-4">
          <div className="card"><div className="font-display font-extrabold text-[22px]">{Math.round(c.acute)}</div><div className="text-xs font-semibold uppercase text-inksoft mt-1">Càrrega aguda (7d)</div></div>
          <div className="card"><div className="font-display font-extrabold text-[22px]">{Math.round(c.chronic)}</div><div className="text-xs font-semibold uppercase text-inksoft mt-1">Càrrega crònica (mitj./setm.)</div></div>
        </div>
      </div>
      <div className="card">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div className="section-title mb-0">Historial de sessions</div>
          <div className="flex gap-2">
            <button className="btn btn-secondary btn-sm" disabled={entries.length === 0} onClick={exportCSV}>Exportar (CSV)</button>
            <button className="btn btn-secondary btn-sm" disabled={entries.length < 2} onClick={exportPNG}>Gràfic (PNG)</button>
          </div>
        </div>
        {entries.length === 0 ? <div className="text-sm text-inksoft">Cap sessió registrada per a aquest jugador.</div> :
          entries.slice(0, 12).map(e => (
            <div key={e.id} className="tl-item">
              <div className="flex justify-between items-start gap-2">
                <div><div className="font-bold text-sm">{e.sessions.titre}</div><div className="text-[11.5px] text-inksoft">{fmtDate(e.sessions.date)} · {e.sessions.type === 'match' ? 'Partit' : 'Entrenament'}</div></div>
                <div className="text-right"><div className="font-mono font-bold text-sm">{e.minutes}min · RPE {e.rpe}</div><div className="text-[11px] text-inksoft">Càrrega {e.minutes * e.rpe}{(e.bpm_max || e.bpm_moy) ? ` · FC ${e.bpm_moy ? 'mitj ' + e.bpm_moy : ''}${e.bpm_max ? ' màx ' + e.bpm_max : ''}` : ''}</div></div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

function Empty({ icon, title, sub }) {
  return <div className="text-center py-9 text-inksoft"><div className="mx-auto mb-2.5 w-9 h-9 flex items-center justify-center text-inkfaint">{icon}</div><div className="font-bold text-ink mb-1">{title}</div><div className="text-sm">{sub}</div></div>;
}
