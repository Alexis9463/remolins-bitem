# Staff Fisio — C.D. Bitem (futbol)

Web (mòbil + ordinador) per a la gestió de la plantilla des del punt de vista de fisioteràpia: fitxes de jugadors, notes, balanços/tests, seguiment de dolors, pes/greix corporal, gestió de càrrega (minuts, RPE, FC, ràtio ACWR), control de material i diari d'activitat.

Interfície en **català**, tema **blau i blanc**. Dades i comptes a **Supabase**, desplegament gratuït a **Vercel**.

## 1. Crear el projecte Supabase
1. Crea un compte a supabase.com i un projecte nou.
2. **SQL Editor → New query**: executa en aquest ordre `supabase/schema.sql`, `supabase/migration_v2.sql` i `supabase/migration_v3.sql`.
3. **Authentication → Users → Add user**: crea un compte per a cada fisio. A *User Metadata* afegeix `{ "full_name": "Nom" }`.
4. **Project Settings → API**: copia el *Project URL* i la *anon public key*.

## 2. Variables d'entorn
Copia `.env.local.example` a `.env.local` (o crea'l) i omple:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## 3. Executar en local
```
npm install
npm run dev
```

## 4. Desplegar a Vercel
Puja el projecte a GitHub, importa'l a Vercel i afegeix les dues variables d'entorn.

## Personalització
- Logo: `public/logo.jpg`
- Colors: `tailwind.config.js` (`pitch` = blau marí, `tape` = blau d'accent)
- Llocs dels jugadors, estats, categories: `lib/data.js`
- Les dades de jugadors s'afegeixen a mà o via **Ajustos → Importar CSV** (columnes: Cognoms, Nom, Número, Lloc, Data de naixement, Alçada, Pes, Telèfon).
