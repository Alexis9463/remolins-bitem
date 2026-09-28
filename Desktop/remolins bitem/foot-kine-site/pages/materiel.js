import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import { supabase } from '../lib/supabase';
import { addLog, displayNameFromUser, MATERIEL_CATEGORIES } from '../lib/data';
import { IconPlus, IconBox, IconAlert, IconEdit, IconTrash, IconArrowsRightLeft } from '../components/Icons';

const LOCATIONS = { stock: 'Magatzem', sacA: 'Bossa fisio A', sacH: 'Bossa fisio H' };
const LOC_FIELD = { stock: 'stock_qte', sacA: 'sac_a_qte', sacH: 'sac_h_qte' };
const CATEGORIES = Object.keys(MATERIEL_CATEGORIES);

export default function Materiel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState('stock');
  const [query, setQuery] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [usedInputs, setUsedInputs] = useState({});
  const [flashId, setFlashId] = useState(null);
  const [userName, setUserName] = useState('');

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUserName(displayNameFromUser(data.user))); load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('materiel').select('*').order('nom', { ascending: true });
    setItems(data || []);
    setLoading(false);
  }

  function flash(id) { setFlashId(id); setTimeout(() => setFlashId(null), 500); }

  async function adjustStock(item, delta) {
    const next = Math.max(0, item.stock_qte + delta);
    await supabase.from('materiel').update({ stock_qte: next, updated_at: new Date().toISOString() }).eq('id', item.id);
    await addLog(userName, delta > 0 ? "ha reaprovisionat" : "ha retirat del magatzem", 'Material', item.nom, `${LOCATIONS.stock}: ${item.stock_qte} → ${next}`);
    load();
  }

  async function transferToBag(item, bag) {
    if (item.stock_qte <= 0) { flash(item.id); return; }
    const field = LOC_FIELD[bag];
    await supabase.from('materiel').update({ stock_qte: item.stock_qte - 1, [field]: item[field] + 1, updated_at: new Date().toISOString() }).eq('id', item.id);
    await addLog(userName, 'ha transferit 1 unitat a', 'Material', item.nom, `Magatzem → ${LOCATIONS[bag]}`);
    load();
  }

  async function returnFromBag(item, bag) {
    const field = LOC_FIELD[bag];
    if (item[field] <= 0) return;
    await supabase.from('materiel').update({ stock_qte: item.stock_qte + 1, [field]: item[field] - 1, updated_at: new Date().toISOString() }).eq('id', item.id);
    await addLog(userName, 'ha retornat 1 unitat al magatzem des de', 'Material', item.nom, `${LOCATIONS[bag]} → Magatzem`);
    load();
  }

  async function validateUsed(item, bag) {
    const field = LOC_FIELD[bag];
    const val = parseInt(usedInputs[item.id]) || 0;
    if (val <= 0) return;
    if (val > item[field]) { flash(item.id); return; }
    await supabase.from('materiel').update({ [field]: item[field] - val, updated_at: new Date().toISOString() }).eq('id', item.id);
    await addLog(userName, `ha utilitzat ${val} unitat(s) de`, 'Material', item.nom, `des de ${LOCATIONS[bag]} (camp, no retornat al magatzem)`);
    setUsedInputs({ ...usedInputs, [item.id]: '' });
    load();
  }

  async function updateSeuil(item, val) {
    const seuil = parseInt(val) || 0;
    if (seuil === item.seuil_alerte) return;
    await supabase.from('materiel').update({ seuil_alerte: seuil, updated_at: new Date().toISOString() }).eq('id', item.id);
    await addLog(userName, "ha modificat el llindar d'alerta de", 'Material', item.nom, `${item.seuil_alerte} → ${seuil}`);
    load();
  }

  async function saveProduct(form) {
    if (editing) {
      await supabase.from('materiel').update({
        nom: form.nom, categorie: form.categorie, unite: form.unite,
        prix_unitaire: form.prix ? parseFloat(form.prix) : null, seuil_alerte: parseInt(form.seuil) || 0,
        updated_at: new Date().toISOString(),
      }).eq('id', editing.id);
      await addLog(userName, 'ha modificat la fitxa de producte', 'Material', form.nom);
    } else {
      await supabase.from('materiel').insert({
        nom: form.nom, categorie: form.categorie, unite: form.unite,
        prix_unitaire: form.prix ? parseFloat(form.prix) : null, seuil_alerte: parseInt(form.seuil) || 0,
        stock_qte: parseInt(form.stockInitial) || 0,
      });
      await addLog(userName, 'ha afegit al catàleg de material', 'Material', form.nom);
    }
    setShowForm(false); setEditing(null); load();
  }

  async function deleteProduct(item) {
    if (!confirm(`Suprimir "${item.nom}" del catàleg de material? Aquesta acció és irreversible.`)) return;
    await supabase.from('materiel').delete().eq('id', item.id);
    await addLog(userName, 'ha suprimit del catàleg de material', 'Material', item.nom);
    load();
  }

  let list = items;
  if (query) { const q = query.toLowerCase(); list = list.filter(i => i.nom.toLowerCase().includes(q)); }
  if (catFilter) list = list.filter(i => i.categorie === catFilter);

  const lowStock = items.filter(i => i.stock_qte <= i.seuil_alerte);
  const total = list.reduce((a, i) => a + i[LOC_FIELD[location]] * (i.prix_unitaire || 0), 0);

  return (
    <Layout title="Material" subtitle="Consumibles de fisio — magatzem i bosses de camp"
      actions={<button className="btn btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}><IconPlus /> Afegir un producte</button>}>

      <div className="flex gap-2 mb-4">
        {Object.entries(LOCATIONS).map(([k, label]) => (
          <button key={k} className={location === k ? 'btn btn-primary' : 'btn btn-secondary'} onClick={() => setLocation(k)}>{label}</button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2.5 mb-4">
        <input className="input flex-1 min-w-[180px]" placeholder="Cerca un producte…" value={query} onChange={e => setQuery(e.target.value)} />
        <select className="input w-auto" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
          <option value="">Totes les categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {location === 'stock' ? (
        lowStock.length > 0 && (
          <div className="flex items-center gap-2 bg-amberlight text-amber text-sm font-semibold px-3.5 py-2.5 rounded-lg mb-4">
            <IconAlert /> {lowStock.length} producte{lowStock.length > 1 ? 's' : ''} per sota del llindar d'alerta
          </div>
        )
      ) : (
        <div className="text-xs text-inksoft mb-4">Les alertes de llindar només s'apliquen al magatzem. « − » retorna al magatzem, « Utilitzat » retira definitivament de la bossa.</div>
      )}

      {loading ? <div className="text-inksoft">Carregant…</div> : list.length === 0 ? (
        <div className="text-center py-10 text-inksoft"><IconBox className="mx-auto mb-2.5" width={38} height={38} />
          <div className="font-bold text-ink mb-1">Cap producte</div>
          <div className="text-sm">Afegeix el teu primer consumible per començar el seguiment.</div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {list.map(item => (
            <ProductRow key={item.id} item={item} location={location} isFlashing={flashId === item.id}
              usedValue={usedInputs[item.id] || ''} onUsedChange={v => setUsedInputs({ ...usedInputs, [item.id]: v })}
              onAdjustStock={adjustStock} onTransfer={transferToBag} onReturn={returnFromBag} onValidateUsed={validateUsed}
              onSeuilChange={updateSeuil} onEdit={() => { setEditing(item); setShowForm(true); }} onDelete={() => deleteProduct(item)} />
          ))}
        </div>
      )}

      <div className="flex justify-between mt-4 pt-3 border-t border-line text-[13px] text-inksoft">
        <span>{list.length} producte{list.length > 1 ? 's' : ''} — {LOCATIONS[location]}</span>
        <span>Valor estimat: {total.toLocaleString('ca-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
      </div>

      {showForm && <ProductFormModal initial={editing} onClose={() => { setShowForm(false); setEditing(null); }} onSave={saveProduct} />}
    </Layout>
  );
}

function ProductRow({ item, location, isFlashing, usedValue, onUsedChange, onAdjustStock, onTransfer, onReturn, onValidateUsed, onSeuilChange, onEdit, onDelete }) {
  const isLow = item.stock_qte <= item.seuil_alerte;
  const qte = item[LOC_FIELD[location]];
  const badgeCls = MATERIEL_CATEGORIES[item.categorie] || 'badge-grey';

  return (
    <div className="card" style={{ borderColor: isFlashing ? '#A6423A' : undefined, transition: 'border-color .3s' }}>
      <div className="flex items-center gap-2.5">
        <span className={`badge ${badgeCls} flex-shrink-0`}>{item.categorie}</span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate flex items-center gap-1.5">
            {item.nom}
            {location === 'stock' && isLow && <IconAlert width={13} height={13} className="text-danger flex-shrink-0" />}
          </div>
          <div className="text-xs text-inksoft">
            {location === 'stock'
              ? `${item.prix_unitaire != null ? item.prix_unitaire.toFixed(2).replace('.', ',') + ' € / ' + item.unite.replace(/s$/, '') : item.unite}`
              : `Disponible al magatzem: ${item.stock_qte}`}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button className="icon-btn" style={{ width: 24, height: 24 }} onClick={() => location === 'stock' ? onAdjustStock(item, -1) : onReturn(item, location)} title={location === 'stock' ? 'Retirar 1' : 'Retornar 1 al magatzem'}>−</button>
          <span className={`text-sm font-semibold min-w-[64px] text-center ${location === 'stock' && isLow ? 'text-danger' : ''}`}>{qte} {item.unite}</span>
          <button className="icon-btn" style={{ width: 24, height: 24, opacity: location !== 'stock' && item.stock_qte <= 0 ? 0.35 : 1 }}
            onClick={() => location === 'stock' ? onAdjustStock(item, 1) : onTransfer(item, location)}
            title={location === 'stock' ? 'Afegir 1' : (item.stock_qte <= 0 ? 'Magatzem esgotat' : 'Transferir 1 des del magatzem')}>+</button>
        </div>
        {location === 'stock' && (
          <div className="flex items-center gap-1.5 flex-shrink-0 border-l border-line pl-2.5">
            <span className="text-[11px] text-inksoft">llindar</span>
            <input type="number" defaultValue={item.seuil_alerte} className="input" style={{ width: 48, padding: '4px 6px', textAlign: 'center' }}
              onBlur={e => onSeuilChange(item, e.target.value)} />
          </div>
        )}
        <div className="flex gap-1 flex-shrink-0">
          <button className="icon-btn" onClick={onEdit}><IconEdit /></button>
          <button className="icon-btn" onClick={onDelete}><IconTrash /></button>
        </div>
      </div>
      {location !== 'stock' && (
        <div className="flex items-center justify-end gap-1.5 mt-2 pt-2 border-t border-dashed border-line">
          <span className="text-xs text-inksoft mr-auto">Utilitzat al camp (no torna al magatzem)</span>
          <input type="number" min="0" placeholder="0" value={usedValue} onChange={e => onUsedChange(e.target.value)}
            className="input" style={{ width: 52, padding: '4px 6px', textAlign: 'center' }} />
          <button className="btn btn-secondary btn-sm" onClick={() => onValidateUsed(item, location)}>Validar</button>
        </div>
      )}
    </div>
  );
}

function ProductFormModal({ initial, onClose, onSave }) {
  const [form, setForm] = useState(initial ? {
    nom: initial.nom, categorie: initial.categorie, unite: initial.unite,
    prix: initial.prix_unitaire ?? '', seuil: initial.seuil_alerte, stockInitial: initial.stock_qte,
  } : { nom: '', categorie: CATEGORIES[0], unite: 'unitats', prix: '', seuil: 5, stockInitial: 0 });
  const set = k => e => setForm({ ...form, [k]: e.target.value });

  return (
    <Modal title={initial ? 'Modificar el producte' : 'Nou producte'} onClose={onClose} footer={
      <>
        <button className="btn btn-secondary" onClick={onClose}>Cancel·lar</button>
        <button className="btn btn-primary" onClick={() => {
          if (!form.nom.trim()) { alert('El nom del producte és obligatori.'); return; }
          onSave(form);
        }}>Desar</button>
      </>
    }>
      <div className="field"><label className="label">Nom del producte</label><input className="input" value={form.nom} onChange={set('nom')} /></div>
      <div className="flex gap-3">
        <div className="field flex-1"><label className="label">Categoria</label>
          <select className="input" value={form.categorie} onChange={set('categorie')}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="field flex-1"><label className="label">Unitat</label><input className="input" placeholder="unitats, rotlles, tubs…" value={form.unite} onChange={set('unite')} /></div>
      </div>
      <div className="flex gap-3">
        <div className="field flex-1"><label className="label">Preu unitari (€, opcional)</label><input className="input" type="number" step="0.01" value={form.prix} onChange={set('prix')} /></div>
        <div className="field flex-1"><label className="label">Llindar d'alerta (magatzem)</label><input className="input" type="number" value={form.seuil} onChange={set('seuil')} /></div>
      </div>
      {!initial && (
        <div className="field"><label className="label">Quantitat inicial en estoc</label><input className="input" type="number" value={form.stockInitial} onChange={set('stockInitial')} /></div>
      )}
      {initial && <p className="text-xs text-inksoft">Les quantitats en estoc i a les bosses es gestionen des de la llista (transferències, reaprovisionament), no des d'aquest formulari.</p>}
    </Modal>
  );
}
