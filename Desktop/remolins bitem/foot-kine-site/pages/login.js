import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/dashboard');
    });
  }, [router]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setError("Credencials incorrectes. Comprova el teu correu i la contrasenya."); return; }
    router.replace('/dashboard');
  }

  return (
    <div className="min-h-screen bg-pitchdark flex items-center justify-center p-5">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 justify-center mb-8">
          <div className="w-11 h-11 rounded-lg bg-white flex items-center justify-center overflow-hidden p-0.5">
            <img src="/logo.jpg" alt="Logo del club" className="w-full h-full object-contain" />
          </div>
          <div className="font-display font-bold text-xl uppercase text-white">Staff Fisio</div>
        </div>
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-2xl">
          <div className="font-display font-bold text-lg uppercase mb-1">Inici de sessió</div>
          <p className="text-sm text-inksoft mb-5">Accés reservat a l'equip mèdic del club.</p>
          <div className="field">
            <label className="label">Correu electrònic</label>
            <input className="input" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="alexis@club.cat" />
          </div>
          <div className="field">
            <label className="label">Contrasenya</label>
            <input className="input" type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          {error && <div className="text-sm text-danger font-semibold mb-3">{error}</div>}
          <button type="submit" disabled={loading} className="btn btn-primary btn-block">
            {loading ? 'Connectant…' : 'Entrar'}
          </button>
        </form>
        <p className="text-center text-white/50 text-xs mt-5">
          Els comptes els crea l'administrador des del tauler de Supabase del projecte.
        </p>
      </div>
    </div>
  );
}
