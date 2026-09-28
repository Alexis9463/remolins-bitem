import { supabase } from './supabase';

export const POSTES = [
  "Porter","Defensa central","Lateral dret","Lateral esquerre","Migcampista defensiu",
  "Migcampista","Migcampista ofensiu","Extrem dret","Extrem esquerre","Davanter centre"
];

export const STATUTS = {
  disponible: { label: 'Disponible', cls: 'badge-ok' },
  incertain: { label: 'Dubtós', cls: 'badge-warn' },
  blesse: { label: 'Lesionat', cls: 'badge-danger' },
  repos: { label: 'Descans / recuperació', cls: 'badge-blue' },
  archive: { label: 'Arxivat', cls: 'badge-grey' },
};

export const NOTE_CATEGORIES = ['General', 'Seguiment fisio', 'Entrenament', 'Partit', 'Altres'];
export const BILAN_TYPES = ['Balanç inicial', 'Test físic', "Amplitud articular (ROM)", 'Força / isocinètic', 'Balanç de sortida / RTP', 'Altres'];
export const ZONES_COURANTES = ['Turmell','Genoll','Isquiotibials','Quàdriceps','Bessons','Espatlla','Lumbars','Cervicals','Adductors','Peu','Canell / Mà','Colze','Maluc','Cap / Commoció','Altres'];
export const MECANISMES = ['Muscular','Articular','Tendinós','Lligamentós','Ossi','Commoció / neuro','Altres'];
export const DOULEUR_STATUTS = {
  active: { label: 'Activa', cls: 'badge-danger' },
  surveillance: { label: 'Vigilància', cls: 'badge-warn' },
  resolue: { label: 'Resolta', cls: 'badge-ok' },
};

export const MATERIEL_CATEGORIES = {
  Embenatges: 'badge-purple',
  Farmàcia: 'badge-blue',
  Cremes: 'badge-pink',
  Eines: 'badge-grey',
  Alimentació: 'badge-green',
  Altres: 'badge-warn',
};

export function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('ca-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
export function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('ca-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' a les ' + d.toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit' });
}
export function todayInput() { return new Date().toISOString().slice(0, 10); }
export function ageFromDob(dob) {
  if (!dob) return null;
  const d = new Date(dob), n = new Date();
  let age = n.getFullYear() - d.getFullYear();
  const m = n.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && n.getDate() < d.getDate())) age--;
  return age;
}

/** Nom mostrat del fisio connectat, a partir de la sessió Supabase Auth. */
export function displayNameFromUser(user) {
  if (!user) return 'Desconegut';
  const meta = user.user_metadata || {};
  if (meta.full_name) return meta.full_name;
  const local = (user.email || '').split('@')[0];
  return local ? local[0].toUpperCase() + local.slice(1) : 'Fisio';
}

/** Registra una entrada al diari d'activitat (mòdul: Jugador/Nota/Balanç/Dolor/Mesura/Sessió). */
export async function addLog(auteur, action, module, cibleNom, details) {
  await supabase.from('journal').insert({
    auteur, action, module, cible_nom: cibleNom || null, details: details || null,
  });
}

/** Calcula l'IMC (kg/m²) a partir del pes (kg) i l'alçada (cm). */
export function computeBMI(poidsKg, tailleCm) {
  if (!poidsKg || !tailleCm) return null;
  const tailleM = tailleCm / 100;
  return poidsKg / (tailleM * tailleM);
}

/** Puja un fitxer a un bucket de Supabase Storage i en retorna la ruta. */
export async function uploadFile(bucket, path, file) {
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
  if (error) throw error;
  return path;
}

/** URL pública (bucket "avatars"). */
export function publicUrl(bucket, path) {
  if (!path) return null;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/** URL signada temporal per a un fitxer privat (bucket "documents"). */
export async function signedUrl(bucket, path, expiresIn = 3600) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteFile(bucket, path) {
  await supabase.storage.from(bucket).remove([path]);
}

export function computeACWR(entries) {
  // entries: [{date, minutes, rpe}]
  const now = new Date();
  const cutAcute = new Date(); cutAcute.setDate(cutAcute.getDate() - 7);
  const cutChronic = new Date(); cutChronic.setDate(cutChronic.getDate() - 28);
  let acute = 0, chronicSum = 0;
  entries.forEach(e => {
    const d = new Date(e.date);
    const charge = e.minutes * e.rpe;
    if (d >= cutAcute && d <= now) acute += charge;
    if (d >= cutChronic && d <= now) chronicSum += charge;
  });
  const chronic = chronicSum / 4;
  const acwr = chronic > 0 ? acute / chronic : null;
  let zone = 'none', zoneLabel = 'Dades insuficients', cls = 'badge-grey';
  if (acwr != null) {
    if (acwr < 0.8) { zone = 'sous'; zoneLabel = 'Càrrega baixa'; cls = 'badge-blue'; }
    else if (acwr <= 1.3) { zone = 'ok'; zoneLabel = 'Càrrega òptima'; cls = 'badge-ok'; }
    else if (acwr <= 1.5) { zone = 'vigilance'; zoneLabel = 'Vigilància'; cls = 'badge-warn'; }
    else { zone = 'risque'; zoneLabel = 'Risc elevat'; cls = 'badge-danger'; }
  }
  return { acute, chronic, acwr, zone, zoneLabel, cls };
}
