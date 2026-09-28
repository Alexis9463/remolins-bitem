import { useState } from 'react';
import { useRouter } from 'next/router';

export default function Login() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    
    // Le mot de passe unique partagé entre toi et Pau
    if (password === 'Pau-remolinsbitem') {
      // On stocke un petit jeton local pour dire que vous êtes connectés
      localStorage.setItem('isLoggedIn', 'true');
      router.replace('/dashboard');
    } else {
      setError("Mot de passe incorrect.");
    }
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
          <p className="text-sm text-inksoft mb-5">Accés reservat a l'equip mèdic.</p>
          <div className="field">
            <label className="label">Mot de passe du club</label>
            <input 
              className="input" 
              type="password" 
              required 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              placeholder="••••••••" 
            />
          </div>
          {error && <div className="text-sm text-danger font-semibold mb-3 mt-2">{error}</div>}
          <button type="submit" className="btn btn-primary btn-block mt-4">
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}
