import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabase';
import { addLog, displayNameFromUser, computeBMI, computeACWR, fmtDate } from '../lib/data';
import { toCSV, downloadCSV } from '../lib/exports';
import { IconCheck } from '../components/Icons';

const HEADER_MAP = {
  cognoms: 'nom', cognom: 'nom', nomdefamilia: 'nom',
  nom: 'prenom',
  numero: 'numero', numerodesamarreta: 'numero', dorsal: 'numero', n: 'numero',
  poste: 'poste', lloc: 'poste', posicio: 'poste',
  datadenaixement: 'dateNaissance', datanaixement: 'dateNaissance', naixement: 'dateNaissance', ddn: 'dateNaissance',
  alcada: 'taille', alcadacm: 'taille', taille: 'taille', taillecm: 'taille',
  pes: 'poids', peskg: 'poids', poids: 'poids', poidskg: 'poids',
  telefon: 'telephone', tel: 'telephone', telephone: 'telephone',
};
function normalizeHeader(h) { return (h || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ''); }
function normalizeDateInput(s) {
  s = (s || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
  if (m) { let y = m[3]; if (y.length === 2) y = '20' + y; return y + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0'); }
  return '';
}
function parseCSV(text) {
  const lines = text.split(/\r\n|\n|\r/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return { rows: [], errors: ['Fitxer buit.'] };
  const delim = lines[0].includes(';') && !lines[0].includes(',') ? ';' : ',';
  const rawHeaders = lines[0].split(delim).map(h => h.trim());
  const fields = rawHeaders.map(h => HEADER_MAP[normalizeHeader(h)] || null);
  if (!fields.includes('nom') || !fields.includes('prenom')) {
    return { rows: [], errors: ["No es troben les columnes 'Cognoms' i 'Nom' a la capçalera del fitxer."] };
  }
  const rows = [], errors = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(delim).map(c => c.trim().replace(/^"|"$/g, ''));
    if (cells.every(c => !c)) continue;
    const obj = {};
    fields.forEach((f, idx) => { if (f) obj[f] = cells[idx] || ''; });
    if (!obj.nom || !obj.prenom) { errors.push('Línia ' + (i + 1) + ' ignorada (falta el nom o els cognoms).'); continue; }
    rows.push({
      nom: obj.nom, prenom: obj.prenom,
      numero: obj.numero ? parseInt(obj.numero) || null : null,
      poste: obj.poste || '',
      dateNaissance: obj.dateNaissance ? normalizeDateInput(obj.dateNaissance) : '',
      taille: obj.taille ? parseInt(obj.taille) || null : null,
      poids: obj.poids ? parseFloat(obj.poids) || null : null,
      telephone: obj.telephone || '',
    });
  }
  return { rows, errors };
}

export default function Reglages() {
  const [userName, setUserName] = useState('');
  const [email, setEmail] = useState('');
  const [playerCount, setPlayerCount] = useState(0);
  const [logCount, setLogCount] = useState(0);
  const [archived, setArchived] = useState([]);
  const [rawText, setRawText] = useState('');
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { setUserName(displayNameFromUser(data.user)); setEmail(data.user?.email || ''); });
    load();
  }, []);

  async function load() {
    const { count: pc } = await supabase.from('players').select('*', { count: 'exact', head: true });
    const { count: lc } = await supabase.from('journal').select('*', { count: 'exact', head: true });
    const { data: arch } = await supabase.from('players').select('*').eq('statut', 'archive');
    setPlayerCount(pc || 0); setLogCount(lc || 0); setArchived(arch || []);
  }

  async function restore(p) {
    await supabase.from('players').update({ statut: 'disponible' }).eq('id', p.id);
    await addLog(userName, 'ha reactivat', 'Jugador', p.prenom + ' ' + p.nom);
    load();
  }
  async function deleteForever(p) {
    if (!confirm(`Suprimir definitivament ${p.prenom} ${p.nom} i tot el seu historial? Aquesta acció és irreversible.`)) return;
    await supabase.from('players').delete().eq('id', p.id);
    await addLog(userName, 'ha suprimit definitivament', 'Jugador', p.prenom + ' ' + p.nom);
    load();
  }

  async function exportEffectifMesures() {
    const { data: players } = await supabase.from('players').select('id, prenom, nom, taille').order('nom');
    const { data: mesures } = await supabase.from('mesures').select('*').order('date');
    const byPlayer = {}; (players || []).forEach(p => { byPlayer[p.id] = p; });
    const rows = (mesures || []).map(m => {
      const p = byPlayer[m.player_id];
      if (!p) return null;
      const taille = m.taille || p.taille;
      const bmi = computeBMI(m.poids, taille);
      return [p.prenom + ' ' + p.nom, fmtDate(m.date), m.poids ?? '', taille ?? '', bmi != null ? bmi.toFixed(1) : '', m.masse_grasse ?? '', m.auteur ?? ''];
    }).filter(Boolean);
    if (rows.length === 0) { alert('Encara no hi ha cap mesura registrada.'); return; }
    const csv = toCSV(['Jugador', 'Data', 'Pes (kg)', 'Alçada (cm)', 'IMC', 'Greix corporal (%)', 'Autor'], rows);
    downloadCSV('Plantilla - pes-imc-greix corporal.csv', csv);
  }

  async function exportEffectifCharge() {
    const { data: entries } = await supabase.from('session_entries').select('*, sessions(date, type, titre), players(prenom, nom)').order('id');
    const rows = (entries || [])
      .filter(e => e.sessions && e.players)
      .sort((a, b) => new Date(a.sessions.date) - new Date(b.sessions.date))
      .map(e => [fmtDate(e.sessions.date), e.sessions.type === 'match' ? 'Partit' : 'Entrenament', e.sessions.titre, e.players.prenom + ' ' + e.players.nom, e.minutes, e.rpe, e.minutes * e.rpe, e.bpm_moy ?? '', e.bpm_max ?? '']);
    if (rows.length === 0) { alert('Encara no hi ha cap sessió registrada.'); return; }
    const csv = toCSV(['Data', 'Tipus', 'Sessió', 'Jugador', 'Minuts', 'RPE', 'Càrrega (UA)', 'FC mitjana', 'FC màxima'], rows);
    downloadCSV('Plantilla - carrega de treball.csv', csv);
  }

  async function exportACWRRanking() {
    const { data: players } = await supabase.from('players').select('id, prenom, nom').neq('statut', 'archive');
    const { data: entries } = await supabase.from('session_entries').select('player_id, minutes, rpe, sessions(date)');
    const byPlayer = {};
    (entries || []).forEach(e => { if (!e.sessions) return; (byPlayer[e.player_id] ||= []).push({ date: e.sessions.date, minutes: e.minutes, rpe: e.rpe }); });
    const rows = (players || []).map(p => {
      const c = computeACWR(byPlayer[p.id] || []);
      if (c.acwr == null) return null;
      return [p.prenom + ' ' + p.nom, c.acwr.toFixed(2), c.zoneLabel, Math.round(c.acute), Math.round(c.chronic)];
    }).filter(Boolean).sort((a, b) => b[1] - a[1]);
    if (rows.length === 0) { alert('Encara no hi ha prou dades de càrrega per calcular una classificació.'); return; }
    const csv = toCSV(['Jugador', 'ACWR', 'Zona', 'Càrrega aguda (7d)', 'Càrrega crònica (mitj./setm.)'], rows);
    downloadCSV('Plantilla - classificacio ACWR.csv', csv);
  }

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setRawText(ev.target.result); analyze(ev.target.result); };
    reader.readAsText(file, 'UTF-8');
  }
  async function analyze(text) {
    const content = text ?? rawText;
    if (!content.trim()) { alert("Enganxa o carrega un fitxer CSV abans d'analitzar."); return; }
    const { rows, errors } = parseCSV(content);
    const { data: existing } = await supabase.from('players').select('nom, prenom');
    const existingKeys = new Set((existing || []).map(p => (p.nom + '|' + p.prenom).toLowerCase()));
    rows.forEach(r => { r._duplicate = existingKeys.has((r.nom + '|' + r.prenom).toLowerCase()); });
    setPreview({ rows, errors });
  }
  async function confirmImport() {
    const toImport = preview.rows.filter(r => !r._duplicate);
    const payload = toImport.map(r => ({
      prenom: r.prenom, nom: r.nom, numero: r.numero, poste: r.poste || null,
      date_naissance: r.dateNaissance || null, taille: r.taille, poids: r.poids,
      telephone: r.telephone || null, statut: 'disponible',
    }));
    const { error } = await supabase.from('players').insert(payload);
    if (error) { alert('Error en la importació: ' + error.message); return; }
    await addLog(userName, 'ha importat', 'Jugador', toImport.length + ' jugador(s) via CSV');
    setPreview(null); setRawText(''); load();
    alert(toImport.length + ' jugador(s) importat(s).');
  }

  return (
    <Layout title="Ajustos" subtitle="Usuari actiu i gestió de la plantilla">
      <div className="grid md:grid-cols-2 gap-3.5">
        <div className="card">
          <div className="section-title">Compte connectat</div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-tape flex items-center justify-center font-display font-bold text-white">{userName[0]}</div>
            <div><div className="font-bold">{userName}</div><div className="text-sm text-inksoft">{email}</div></div>
          </div>
          <p className="text-sm text-inksoft mt-4">Cada acció es registra amb el teu nom, per mantenir un historial fiable de les intervencions.</p>
        </div>
        <div className="card">
          <div className="section-title">Sobre les dades</div>
          <p className="text-sm text-inksoft mt-0 leading-relaxed">Totes les dades es comparteixen entre l'equip mèdic del club i s'allotgen al vostre projecte de Supabase.</p>
          <div className="grid grid-cols-2 gap-3.5 mt-2.5">
            <div className="card"><div className="font-display font-extrabold text-xl">{playerCount}</div><div className="text-xs font-semibold uppercase text-inksoft mt-1">Jugadors (total)</div></div>
            <div className="card"><div className="font-display font-extrabold text-xl">{logCount}</div><div className="text-xs font-semibold uppercase text-inksoft mt-1">Accions registrades</div></div>
          </div>
        </div>
      </div>

      <div className="card mt-3.5">
        <div className="section-title">Exportacions (tota la plantilla)</div>
        <p className="text-sm text-inksoft mt-0">Exportacions en format taula (CSV, compatible amb Excel/Numbers/Google Sheets). Per als gràfics individuals, vés a la fitxa d'un jugador.</p>
        <div className="flex flex-wrap gap-2 mt-2">
          <button className="btn btn-secondary btn-sm" onClick={exportEffectifMesures}>Pes / IMC / greix corporal — CSV</button>
          <button className="btn btn-secondary btn-sm" onClick={exportEffectifCharge}>Càrrega de treball (totes les sessions) — CSV</button>
          <button className="btn btn-secondary btn-sm" onClick={exportACWRRanking}>Classificació ACWR actual — CSV</button>
        </div>
      </div>

      <div className="card mt-3.5">
        <div className="section-title">Importar una llista de jugadors (CSV)</div>
        <p className="text-sm text-inksoft mt-0">Columnes reconegudes: <strong>Cognoms, Nom</strong> (obligatòries), i si hi són: Número, Lloc, Data de naixement, Alçada, Pes, Telèfon. Els jugadors ja existents (mateix nom i cognoms) s'ignoren.</p>
        <div className="field"><label className="label">Fitxer CSV</label><input type="file" accept=".csv,text/csv,text/plain" onChange={handleFile} /></div>
        <div className="field"><label className="label">O enganxa el contingut aquí</label>
          <textarea className="input font-mono text-xs" rows={4} value={rawText} onChange={e => setRawText(e.target.value)} placeholder={"Cognoms,Nom,Número,Lloc,Data de naixement,Alçada,Pes\nFerrer,Marc,9,Davanter centre,2001-03-12,182,76"} />
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => analyze()}>Analitzar el contingut</button>

        {preview && (
          <div className="mt-3.5 pt-3.5 border-t border-line">
            {preview.errors.length > 0 && <span className="badge badge-danger mb-2 inline-block">{preview.errors.length} línia(es) amb error</span>}
            <div className="text-sm font-bold mb-2">{preview.rows.length} jugador(s) detectat(s) — {preview.rows.filter(r => !r._duplicate).length} nou(s), {preview.rows.filter(r => r._duplicate).length} ja a la plantilla</div>
            <div className="max-h-56 overflow-y-auto border border-line rounded-lg">
              {preview.rows.map((r, i) => (
                <div key={i} className={`flex items-center gap-2.5 px-2.5 py-1.5 border-b border-line last:border-none text-xs ${r._duplicate ? 'opacity-40' : ''}`}>
                  <div className="w-6 text-center font-mono text-inksoft">{r.numero || '–'}</div>
                  <div className="flex-1 font-semibold">{r.prenom} {r.nom}</div>
                  <div className="text-inksoft">{r.poste || '—'}</div>
                  {r._duplicate && <span className="badge badge-grey">ja hi és</span>}
                </div>
              ))}
            </div>
            <div className="flex gap-2.5 mt-3">
              <button className="btn btn-secondary btn-sm" onClick={() => setPreview(null)}>Cancel·lar</button>
              <button className="btn btn-primary btn-sm" disabled={preview.rows.filter(r => !r._duplicate).length === 0} onClick={confirmImport}>
                <IconCheck /> Importar {preview.rows.filter(r => !r._duplicate).length} jugador(s)
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card mt-3.5">
        <div className="section-title">Plantilla — arxiu</div>
        {archived.length === 0 ? <div className="text-sm text-inksoft">Cap jugador arxivat.</div> :
          archived.map(p => (
            <div key={p.id} className="tl-item flex items-center justify-between">
              <div className="flex items-center gap-2.5"><div className="jersey-sm">{p.numero || '–'}</div><div className="font-bold text-sm">{p.prenom} {p.nom}</div></div>
              <div className="flex gap-2">
                <button className="btn btn-secondary btn-sm" onClick={() => restore(p)}>Reactivar</button>
                <button className="icon-btn" onClick={() => deleteForever(p)}>✕</button>
              </div>
            </div>
          ))}
      </div>
    </Layout>
  );
}
