# Asso Pilotage — Contexte IA

> Ce fichier est lu par les assistants IA (Claude Code, Copilot, Cursor…) en début de session.
> Il donne le contexte projet indispensable pour ne pas casser ce qui existe.

## Ce qu'est ce projet

Dashboard de pilotage pour une association de formation numérique.
**SaaS Next.js** — interface uniquement.
Persistance : `localStorage` pour la plupart des modules. **Exception : le module Familles** est connecté à **Google Sheets** (API REST v4 côté serveur) — voir section "Backend Familles".

## Stack exacte

| Outil | Version | Note critique |
|---|---|---|
| Next.js | **16.2.6** | App Router, conventions différentes du Next.js courant — **lire `AGENTS.md`** |
| Tailwind CSS | **v4** | Config CSS-first dans `globals.css`, **pas de `tailwind.config.ts`** |
| React | 19 | Server Components + `"use client"` explicite |
| TypeScript | 5 | `strict: true` |
| lucide-react | 1.16.0 | Certaines icônes n'existent pas — voir liste dans `AGENTS.md` |
| Gemini API | `fetch` natif (pas de SDK npm) | Génération IA : posts Communication, OCR bulletins, tests de positionnement, et **module Rapports** (contenu + template/style/gabarits) — clé `GEMINI_API_KEY` dans `.env.local` |

## Structure des modules

```
app/
├── login/          Page de connexion / inscription (publique)
├── dashboard/      Vue d'ensemble — KPIs globaux
├── emargement/     Émargement numérique par séance
├── assiduite/      Hub assiduité — Google Sheets (présences, décrochage)
├── veille-subventions/  Suivi appels à projets — Google Sheets (Apps Script)
├── ateliers/       Planning + notes apprenantes + composition groupes — Google Sheets
├── familles/       Bénéficiaires — familles, parents, enfants — Google Sheets
│   ├── page.tsx              Listing (Familles / Membres)
│   ├── [id]/page.tsx         Fiche famille + ajout membre
│   └── [id]/membre/[membreId]/page.tsx  Fiche membre individuelle
├── positionnement/ Génération de tests de positionnement — Gemini (texte + TTS)
├── notes/          Saisie rapide des notes d'évaluation — Google Sheets
├── communication/  Calendrier éditorial + kanban suivi posts — Google Sheets
├── rapports/       Génération de rapports d'activité — backend Slides/Drive réel + Gemini
│   ├── page.tsx              Dashboard 3 sections renommables (création/brouillons/historique)
│   └── edition/[id]/page.tsx Écran plein écran, split-pane éditeur + panneau IA
├── membres/        Annuaire équipe (admins uniquement)
├── compte/         Profil + mot de passe (+ gestion des comptes pour admins)
└── (pages légales) mentions-legales/ · confidentialite/ · accessibilite/  (publiques)

> ⚠️ Modules retirés : `absences/`, `finances/`, `benevoles/` n'existent plus
> (les tokens couleur `absences`/`finances` restent en revanche définis et utilisés).

components/
├── Sidebar.tsx     Navigation + chip utilisateur connecté
├── SlideOver.tsx   Panneau latéral réutilisable (TOUTES les forms passent par là)
├── StatCard.tsx    Carte KPI dashboard
└── AuthGate.tsx    Protection des routes + affichage conditionnel sidebar

lib/
├── auth.ts             Helpers auth (login, register, logout, getSession)
├── auth-context.tsx    Provider React + hook useAuth()
├── mock-data.ts        Données mockées (absences, ateliers, communication, membres, bénévoles)
├── emargement-data.ts  Séances + présences initiales
├── sheets-api.ts       Couche client module Familles (fetch → /api/sheets)
├── google-sheets-server.ts  Clients Sheets + Drive (compte de service, côté serveur)
├── google-slides-server.ts  Client Slides + génération/sync du deck (compte de service)
├── rapports-data.ts    Types + mocks module Rapports (localStorage) + contrats partagés
├── rapports-slides-api.ts  Couche client Rapports → Slides (fetch → /api/slides, best-effort)
├── rapports-template-api.ts  Couche client template/style/suggestions IA (fetch → /api/rapports-template, lève une erreur)
├── rapports-generation-api.ts  Couche client génération IA du contenu complet (fetch → /api/rapports-generation, lève une erreur)
└── use-fermer-au-clic-exterieur.ts  Hook partagé : ferme un menu au clic hors de son conteneur

app/api/
├── generate-post/route.ts  POST — génère contenu + hashtags via Gemini (fetch natif)
│                            Requiert GEMINI_API_KEY dans .env.local
├── sheets/route.ts     API REST Google Sheets v4 du module Familles (voir "Backend Familles")
├── slides/route.ts     API Google Slides du module Rapports (voir "Module Rapports")
├── rapports-template/route.ts  Analyse de template, suggestions visuelles/style, bibliothèque Drive
└── rapports-generation/route.ts  Génération IA du contenu complet du rapport (10 thèmes AREA)
```

## Conventions impératives

### Charte graphique « Estuaire » — à respecter pour tout ce qui touche l'UI
> Guide complet : `docs/reference/charte-graphique-estuaire.md` — **le lire avant
> toute modification de style, couleur, police ou composant visuel.**

- **Couleurs Tailwind v4 — classes sémantiques uniquement, jamais de valeur en dur.**
  ```tsx
  // ✅ Correct
  "bg-absences text-finances-dark border-ateliers/20"

  // ❌ Interdit
  "bg-[var(--color-absences)]"
  ```
  Toutes les couleurs sont définies dans `app/globals.css` sous `@theme inline`.
  Variantes disponibles : `{module}`, `{module}-light`, `{module}-dark`.
- **Palette unifiée sur 3 teintes de marque** (plus de couleur unique par module) :
  teal `#159c99` (ateliers, bénévoles, positionnement, notes, émargement) ·
  vert forêt `#1b6840` (finances, familles) · doré `#d99a1e` (communication,
  absences, assiduité, veille subventions). Modules sans couleur propre (Équipe,
  Compte) → `bg-brand` (teal de marque).
  ⚠️ Sur fond doré, utiliser la variante `-dark` avec texte blanc (le doré clair
  échoue le contraste RGAA) — les autres teintes utilisent la couleur pleine.
- **Typographie** : titres (`h1`–`h6`) en Poppins, texte courant en Inter — réglé
  globalement via `app/layout.tsx` (`next/font`) + `globals.css`, rien à faire
  page par page.
- **`SaveButton`** (`components/SlideOver.tsx`) accepte une prop `accent` (module
  courant, défaut `brand`) — utiliser `<SaveButton accent="finances" />` plutôt
  qu'un style custom.
- ⚠️ Turbopack ne recharge pas à chaud les changements de `@theme` (`globals.css`)
  ni de `next/font` (`layout.tsx`) — redémarrer `npm run dev` après modification.

### Pattern CRUD standard
**Chaque page avec données modifiables** suit ce pattern :
1. `useState` initialisé avec données mock
2. `useEffect` → charge depuis `localStorage` (hydratation)
3. `persist(data)` → `setData(data)` + `localStorage.setItem(...)`
4. `SlideOver` pour les formulaires (jamais de modal inline)
5. `openNew()` / `openEdit(item)` → ouvre le SlideOver

```tsx
// Template type à copier
const [items, setItems] = useState<Item[]>(mockData)
useEffect(() => { setItems(load(STORAGE_KEY, mockData)) }, [])
function persist(data: Item[]) { setItems(data); localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }
```

### SlideOver — composant central
```tsx
import SlideOver, { Field, Input, Select, Textarea, FormRow, SaveButton, DeleteButton } from "@/components/SlideOver"

<SlideOver open={slideOpen} onClose={() => setSlideOpen(false)} title="..." width="md | lg">
  <form onSubmit={(e) => { e.preventDefault(); handleSave() }} className="flex flex-col gap-4">
    <Field label="Nom" required>
      <Input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} />
    </Field>
    <SaveButton />
    {editing && <DeleteButton onClick={handleDelete} />}
  </form>
</SlideOver>
```

### Auth
```tsx
import { useAuth } from "@/lib/auth-context"
const { user, logout } = useAuth()
// user : AuthUser | null  →  { id, email, nom, prenom, role, createdAt }
// role : "super_admin" | "admin" | "formatrice" | "coordinatrice" | "benevole"
```
L'authentification passe par **Supabase** (voir `docs/explanation/adr/007-auth-supabase.md`).

### ⚠️ Règle — TOUTES les URLs passent par l'authentification
Toute route de l'application (l'espace « dashboard » et tous ses modules) **exige une
session authentifiée**. Une URL n'est accessible sans connexion que si elle figure
explicitement dans les **exceptions publiques** :
- `/login`
- les pages légales : `/mentions-legales`, `/confidentialite`, `/accessibilite`
  (liste `LEGAL_PATHS` dans `components/AuthGate.tsx`)

Concrètement :
- **Pages** : `components/AuthGate.tsx` redirige tout·e visiteur·se non authentifié·e vers
  `/login` (sauf exceptions ci-dessus). Toute nouvelle page fait donc partie du périmètre
  protégé par défaut — ne l'ajoute JAMAIS à `LEGAL_PATHS`/exceptions sans décision explicite.
- **Routes API** (`app/api/*`) : chaque handler doit commencer par la garde serveur
  `if (!(await getServerUser())) return 401` (`lib/supabase/server.ts`). Toute nouvelle
  route API exposant des données ou appelant un service tiers DOIT être gardée.

### "use client" — règle
Toutes les pages sont `"use client"` (localStorage, état, hooks).
Les composants partagés aussi (`Sidebar`, `SlideOver`, `AuthGate`).
Pas de Server Actions. Le module Familles appelle sa **route interne `/api/sheets`** (API REST Google Sheets v4, voir "Backend Familles") ; les autres modules restent en localStorage.

## Modèle Post (Communication) — **Google Sheets** (feuille `CONTENUS`)

> ⚠️ Depuis la migration Sheets, les posts ne sont plus en `localStorage`. Le module Communication
> lit/écrit dans la feuille `CONTENUS` du Sheet `BDD_Asso_CRM` via `/api/sheets` (voir "Backend
> Communication" plus bas). Seul `asso-communication-rejected` (le repère visuel "dot rouge") reste
> en `localStorage` — c'est une annotation UI locale, pas une donnée métier.

```typescript
type ValidationStatus = "brouillon" | "à valider" | "validé" | "publié"
type CategoriePost = "atelier" | "autre"

interface PlatformeContent { contenu?: string; tags?: string; lien?: string }
interface MediaItem { nom: string; type: string; preview?: string; url?: string }  // preview = local (upload en cours), url = Drive persistée
interface PostParticipant { id: number; prenom: string; nom: string }
interface PostParticipants {
  apprenantes: PostParticipant[]   // IDs → cross-ref avec asso-beneficiaires
  benevoles: string[]              // noms (ref benevolesMock.liste)
  formatrices: string[]            // noms libres
}

interface Post {
  id: number
  categorie: CategoriePost          // atelier | autre
  date: string                       // date programmée ISO
  titre: string
  brief?: string                     // contexte court pour la génération IA (posts "autre")
  contenu?: string                   // contenu principal
  media?: MediaItem[]                // 1 image + 1 vidéo max (colonnes Image/Vidéo singulières du Sheet)
  plateforme: Plateforme[]           // LinkedIn | Instagram | Facebook
  plateformeContenu: Partial<Record<Plateforme, PlatformeContent>>  // surcharge par plateforme
  statut: ValidationStatus
  auteur: string
  sessionId?: number | null          // lien optionnel vers une Session du module Ateliers
  participants?: PostParticipants    // uniquement pour categorie === "atelier"
}
```

**Données cross-module (lecture seule depuis Communication) :**
- `asso-ateliers-sessions` → sessions (pour auto-peupler les participants)
- `asso-beneficiaires` → bénéficiaires (pour résoudre les noms et vérifier `droitsImage`)

**Liste de floutage :** dérivée des apprenantes du post dont `beneficiaire.droitsImage !== true`.
`droitsImage?: boolean` est défini dans l'interface `Beneficiaire` de `/app/beneficiaires/page.tsx` (champ optionnel, non encore affiché dans le formulaire).
Tant qu'il n'est pas configuré, la liste de floutage affiche un message d'alerte et ne liste personne.

**Kanban :** clic sur une carte ouvre directement l'édition (pas de panneau de lecture intermédiaire).

## Page de seed de test (à supprimer avant prod)

`/app/dev/seed/page.tsx` — injecte des données fictives dans le localStorage pour tester
la section participants et le floutage dans Communication.
IDs réservés : 9001–9099. Supprimer ce fichier + le dossier `app/dev/` avant la mise en production.

## Ce qu'il ne faut PAS faire

- ❌ Ne pas créer `tailwind.config.ts` — config dans `globals.css`
- ❌ Ne pas importer `Linkedin`, `Instagram`, `Facebook`, `Kanban` de lucide-react (n'existent pas en v1.16.0)
- ❌ Ne pas utiliser `bg-[var(--color-xxx)]` — utiliser `bg-xxx`
- ❌ Ne pas créer de routes API (`app/api/`) sans décision d'équipe — exceptions validées : `app/api/generate-post/route.ts` (génération IA), `app/api/sheets/route.ts` (backend Google Sheets du module Familles), `app/api/ocr/route.ts` (OCR bulletins d'inscription via Gemini API), `app/api/subventions-sheet/*` (backend Google Sheets de la Veille subventions : lecture CSV + écriture via Web App Apps Script — nécessite `SHEETS_WEBAPP_URL` + `SHEETS_WEBAPP_TOKEN`), `app/api/slides/route.ts` (backend Google Slides du module Rapports), `app/api/rapports-template/route.ts` (template/style/suggestions IA du module Rapports) et `app/api/rapports-generation/route.ts` (génération IA du contenu complet du module Rapports)
- ❌ Ne pas mettre de données dans l'URL (PII)
- ❌ Ne pas casser le pattern SlideOver existant (cohérence UX)

## Ajouter un nouveau module — en 5 étapes

1. Créer `app/{module}/page.tsx` avec `"use client"`
2. Ajouter les données mock dans `lib/mock-data.ts`
3. Choisir une couleur ou réutiliser une existante dans `globals.css`
4. Ajouter l'entrée dans `components/Sidebar.tsx` (tableau `navItems`)
5. Ajouter une `StatCard` dans `app/dashboard/page.tsx`

→ Guide détaillé : `docs/how-to/add-new-module.md`

## Déploiement

- **GitHub** : `github.com/anais0210/asso-pilotage`
- **Vercel** : `asso-pilotage.vercel.app` (auto-deploy sur push `main`)
- Compte démo : `admin@asso.fr` / `AdminAsso2026!`

@AGENTS.md

---

## Travaux Diane-GA — contexte de contribution

> Diane-GA travaille sur un **fork** de `anais0210/asso-pilotage`.
> À chaque session, synchroniser le fork avant de coder :
> ```bash
> git fetch upstream
> git checkout main && git merge --ff-only upstream/main
> git push origin main
> git checkout <branche-travail>
> ```

### Dépôts
| Rôle | URL |
|------|-----|
| Fork (push) | `github.com/Diane-GA/asso-pilotage` |
| Upstream (référence) | `github.com/anais0210/asso-pilotage` |

### Branches de travail
| Branche | Cas | Statut |
|---------|-----|--------|
| `cas_4-1-1` | Cas 4.1.1 — améliorations UI calendrier & kanban | Poussée, rebased sur main |
| `Cas_4-1-2` | Cas 4.1.2 — refonte vue Communication | En cours |

---

## Module Communication — état branche Cas_4-1-2

### Structure fichiers
```
app/communication/
├── page.tsx        Page principale : calendrier, onglet Suivi (kanban)
└── publies/
    └── page.tsx    Archive de tous les posts publiés (lecture seule + SlideOver)
```

### Persistance — Communication
| Clé / Source | Type | Contenu |
|-----|------|---------|
| Feuille `CONTENUS` (Google Sheets) | `Post[]` | Tous les posts — voir "Backend Communication" ci-dessous |
| `asso-communication-rejected` (localStorage) | `number[]` | IDs posts repassés en brouillon via ✕ (annotation UI locale, pas dans Sheets) |

### Onglets de la page Communication
1. **Calendrier** — posts uniquement, fond coloré par statut, clic sur une date = nouveau post
2. **Suivi** — kanban 4 colonnes : Brouillon / À valider / Validé / Publié

> ⚠️ L'onglet **Événements** a été entièrement supprimé (Cas_4-1-2).
> Toute l'infrastructure associée a été retirée : type `Evenement`, `TypeEvenement`,
> `EventsTab`, `STORAGE_EVENTS`, `eventsInitiaux`, `emptyEvent`, `TYPE_OPTIONS`.
> Le champ `evenement` (déprécié) a depuis été retiré entièrement de l'interface `Post`
> lors de la migration vers Google Sheets.

### Modifications réalisées en Cas_4-1-2

#### 1. Renommage statut `"en attente de validation"` → `"à valider"`
- Mis à jour partout : type, KANBAN_COLS, statutDot, statutBg, données mock, boutons, formulaire
- **Migration automatique** au chargement : tout post stocké avec l'ancien libellé est corrigé

```tsx
// Dans useEffect — migration au boot
const raw = load<Post[]>(STORAGE_POSTS, postsInitiaux)
const migrated = raw.map(p =>
  (p.statut as string) === "en attente de validation" ? { ...p, statut: "à valider" as ValidationStatus } : p
)
if (migrated.some((p, i) => p !== raw[i])) localStorage.setItem(STORAGE_POSTS, JSON.stringify(migrated))
setPosts(migrated)
```

#### 2. Stat cards (haut de page)
| Carte | Couleur | Calcul |
|-------|---------|--------|
| En cours de rédaction | slate | `statut === "brouillon"` |
| À valider | absences (orange) | `statut === "à valider"` |
| Publiés cette année | emerald | `statut === "publié" && date >= 1er jan année en cours` |

#### 3. Cartes kanban — contenu affiché
- ✅ Titre + badge catégorie (Atelier / Autre)
- ✅ Vignettes réseaux sociaux (LI / IG / FB)
- ✅ Date de publication
- ✅ Boutons de validation
- ❌ Preview contenu texte (supprimée)
- ❌ Compteur participants (supprimé)

#### 4. Dot rouge — posts repassés en brouillon
Quand un post passe de `"à valider"` → `"brouillon"` via le bouton ✕ :
- Un point rouge apparaît en haut à droite de la carte (`absolute -top-1.5 -right-1.5`)
- Persisté dans `asso-communication-rejected` (survit au rechargement)
- Disparaît quand le post repart vers `"à valider"` ou tout autre statut ≠ brouillon

```tsx
// Dans changeStatus() :
if (status === "brouillon" && prev?.statut === "à valider") {
  persistRejected([...rejectedIds, id])
} else if (status !== "brouillon" && rejectedIds.includes(id)) {
  persistRejected(rejectedIds.filter(rid => rid !== id))
}

// Dans la carte kanban :
{rejectedIds.includes(p.id) && (
  <span className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-red-500 ring-2 ring-white shadow-sm" />
)}
```

#### 5. Colonne "Publié" — vue limitée + archive
- Affiche les **3 posts les plus récents** (triés par date décroissante)
- Le compteur en badge affiche le total réel
- Bouton **"Voir tous les posts publiés"** → `/communication/publies`
- Page `/communication/publies` : grille 3 colonnes, mêmes cartes que le kanban,
  clic → SlideOver lecture (titre, contenu, plateformes, médias, participants)

### Logique de travail (préférences Diane-GA)
- Travailler par **petites modifications ciblées**, une fonctionnalité à la fois
- Valider TypeScript (`npx tsc --noEmit`) avant chaque commit
- Commits fréquents avec messages descriptifs en français/anglais mixte
- Ne pas modifier ce qui n'est pas dans le périmètre de la branche
- Privilégier la suppression propre (pas de code mort commenté)

<!-- rtk-instructions v2 -->
# RTK (Rust Token Killer) - Token-Optimized Commands

## Golden Rule

**Always prefix commands with `rtk`**. If RTK has a dedicated filter, it uses it. If not, it passes through unchanged. This means RTK is always safe to use.

**Important**: Even in command chains with `&&`, use `rtk`:
```bash
# ❌ Wrong
git add . && git commit -m "msg" && git push

# ✅ Correct
rtk git add . && rtk git commit -m "msg" && rtk git push
```

## RTK Commands by Workflow

### Build & Compile (80-90% savings)
```bash
rtk cargo build         # Cargo build output
rtk cargo check         # Cargo check output
rtk cargo clippy        # Clippy warnings grouped by file (80%)
rtk tsc                 # TypeScript errors grouped by file/code (83%)
rtk lint                # ESLint/Biome violations grouped (84%)
rtk prettier --check    # Files needing format only (70%)
rtk next build          # Next.js build with route metrics (87%)
```

### Test (60-99% savings)
```bash
rtk cargo test          # Cargo test failures only (90%)
rtk go test             # Go test failures only (90%)
rtk jest                # Jest failures only (99.5%)
rtk vitest              # Vitest failures only (99.5%)
rtk playwright test     # Playwright failures only (94%)
rtk pytest              # Python test failures only (90%)
rtk rake test           # Ruby test failures only (90%)
rtk rspec               # RSpec test failures only (60%)
rtk test <cmd>          # Generic test wrapper - failures only
```

### Git (59-80% savings)
```bash
rtk git status          # Compact status
rtk git log             # Compact log (works with all git flags)
rtk git diff            # Compact diff (80%)
rtk git show            # Compact show (80%)
rtk git add             # Ultra-compact confirmations (59%)
rtk git commit          # Ultra-compact confirmations (59%)
rtk git push            # Ultra-compact confirmations
rtk git pull            # Ultra-compact confirmations
rtk git branch          # Compact branch list
rtk git fetch           # Compact fetch
rtk git stash           # Compact stash
rtk git worktree        # Compact worktree
```

Note: Git passthrough works for ALL subcommands, even those not explicitly listed.

### GitHub (26-87% savings)
```bash
rtk gh pr view <num>    # Compact PR view (87%)
rtk gh pr checks        # Compact PR checks (79%)
rtk gh run list         # Compact workflow runs (82%)
rtk gh issue list       # Compact issue list (80%)
rtk gh api              # Compact API responses (26%)
```

### JavaScript/TypeScript Tooling (70-90% savings)
```bash
rtk pnpm list           # Compact dependency tree (70%)
rtk pnpm outdated       # Compact outdated packages (80%)
rtk pnpm install        # Compact install output (90%)
rtk npm run <script>    # Compact npm script output
rtk npx <cmd>           # Compact npx command output
rtk prisma              # Prisma without ASCII art (88%)
```

### Files & Search (60-75% savings)
```bash
rtk ls <path>           # Tree format, compact (65%)
rtk read <file>         # Code reading with filtering (60%)
rtk grep <pattern>      # Search grouped by file (75%). Format flags (-c, -l, -L, -o, -Z) run raw.
rtk find <pattern>      # Find grouped by directory (70%)
```

### Analysis & Debug (70-90% savings)
```bash
rtk err <cmd>           # Filter errors only from any command
rtk log <file>          # Deduplicated logs with counts
rtk json <file>         # JSON structure without values
rtk deps                # Dependency overview
rtk env                 # Environment variables compact
rtk summary <cmd>       # Smart summary of command output
rtk diff                # Ultra-compact diffs
```

### Infrastructure (85% savings)
```bash
rtk docker ps           # Compact container list
rtk docker images       # Compact image list
rtk docker logs <c>     # Deduplicated logs
rtk kubectl get         # Compact resource list
rtk kubectl logs        # Deduplicated pod logs
```

### Network (65-70% savings)
```bash
rtk curl <url>          # Compact HTTP responses (70%)
rtk wget <url>          # Compact download output (65%)
```

### Meta Commands
```bash
rtk gain                # View token savings statistics
rtk gain --history      # View command history with savings
rtk discover            # Analyze Claude Code sessions for missed RTK usage
rtk proxy <cmd>         # Run command without filtering (for debugging)
rtk init                # Add RTK instructions to CLAUDE.md
rtk init --global       # Add RTK to ~/.claude/CLAUDE.md
```

## Token Savings Overview

| Category | Commands | Typical Savings |
|----------|----------|-----------------|
| Tests | vitest, playwright, cargo test | 90-99% |
| Build | next, tsc, lint, prettier | 70-87% |
| Git | status, log, diff, add, commit | 59-80% |
| GitHub | gh pr, gh run, gh issue | 26-87% |
| Package Managers | pnpm, npm, npx | 70-90% |
| Files | ls, read, grep, find | 60-75% |
| Infrastructure | docker, kubectl | 85% |
| Network | curl, wget | 65-70% |

Overall average: **60-90% token reduction** on common development operations.
<!-- /rtk-instructions -->

---

## Module Familles — ce qui a été construit

> ⚠️ **Le module Familles ne suit PAS le pattern localStorage** du reste de l'app.
> Il lit et écrit dans **Google Sheets** via une API REST v4 côté serveur (voir
> section « Backend Familles » ci-dessous). Il n'y a plus de `lib/familles-data.ts`.

### Page listing (`/familles`)
- 2 onglets : **Familles** et **Membres**
- Recherche **par préfixe** (début du nom), tolérante aux accents, tri alphabétique
- Bouton **"+ Ajouter une famille"** (onglet Familles)

### Fiche famille (`/familles/[id]`)
- Infos famille + bouton Modifier (cascade adresse → tous les membres)
- **Autocomplétion d'adresse** via l'API Base Adresse Nationale (`components/AdresseAutocomplete.tsx`)
- Cartes membres + **Journal de suivi** (commentaires)
- Bouton **"+ Ajouter un membre"**

### Fiche membre (`/familles/[id]/membre/[membreId]`)
- Breadcrumb, badges type/statut, état civil, inscriptions, **âge calculé auto** depuis la date de naissance
- **Paiements** : ajout / modification / suppression, rattachés à une inscription (sélecteur d'année)
- **Reste à payer** : champ « Montant du » par inscription → récap payé / attendu / reste (badge rouge/vert)
- **Documents** : upload par catégorie vers Google Drive, consultation (aperçu Drive) + suppression
- **Journal de suivi** : commentaires / appels / emails horodatés, filtrable par type, groupé par date (`components/JournalSuivi.tsx`)

### Couleur du module
`familles` / `familles-light` / `familles-dark` (vert forêt — charte « Estuaire »,
voir `docs/reference/charte-graphique-estuaire.md`).

---

## Backend Familles — Google Sheets REST API v4 (implémenté)

Le module Familles est connecté à **Google Sheets** via l'**API REST v4** appelée
**côté serveur** avec un **compte de service** (PR #8, puis #9/#10). Ce n'est PAS
Apps Script (une variante Apps Script Web App existait dans les premières PR et a
été abandonnée ; le fichier `apps-script/web-app.gs` est conservé mais n'est plus
utilisé par l'app).

### Architecture
```
Client (pages familles)
  → lib/sheets-api.ts        (fetch vers la route interne, agnostique au transport)
  → app/api/sheets/route.ts  (routeur par "action" : GET = lecture, POST = écriture)
  → lib/google-sheets-server.ts  (clients Sheets + Drive via compte de service)
  → Google Sheet "BDD_Asso_CRM" + Google Drive
```

### Fichiers clés
| Fichier | Rôle |
|---|---|
| `lib/sheets-api.ts` | Couche client. `API_URL = "/api/sheets"`. Fonctions `fetchFamilles`, `addMembre`, `addPaiement`, `updateInscription`, `uploadFichier`, `fetchDocuments`… |
| `app/api/sheets/route.ts` | Route serveur (exception validée à la règle « pas de `app/api/` »). Switch par `action`. |
| `lib/google-sheets-server.ts` | Auth compte de service, helpers `sheetToObjects`/`appendRow`/`updateRowById`/`deleteRowById`/`ensureColumn`, client Drive `uploadToDrive`/`deleteDriveFile`. |

### Google Sheet — `BDD_Asso_CRM`
- ID : `1bOISBPwoU1xa5R4Um0fRASXKFeclJ8jB3A3CUHBMlI8`
- Tables : **FAMILLE**, **PERSONNE** (état civil), **INSCRIPTION** (niveau/statut/`Montant du`), **PAIEMENT**, **EVALUATION**, **DOCUMENTS JOINTS**, EVENEMENT, ASSIDUITE, SCOLARITE…
- L'état civil vit dans PERSONNE ; le niveau/statut dans INSCRIPTION.

### Documents → Google Drive
4 dossiers Drive (un par catégorie, IDs en dur dans `route.ts`) partagés **en Éditeur**
avec le compte de service. Fichier renommé `Nom Prénom - Type - Date.ext`, ligne
ajoutée dans la table `DOCUMENTS JOINTS`.
⚠️ Upload en base64 via la route → plafond Vercel **~4,5 Mo** par requête.

### Variables d'environnement requises (`.env.local` + Vercel)
```
GOOGLE_CLIENT_EMAIL=...@....iam.gserviceaccount.com   # compte de service
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GEMINI_API_KEY=...                                    # IA : OCR, posts, positionnement, Rapports (Google AI Studio)
# Module Rapports — 3 dossiers Drive dédiés (ID lisible dans l'URL du dossier) :
GOOGLE_DRIVE_RAPPORTS_BROUILLONS_FOLDER_ID=...        # où sont créés les rapports en cours (Slides "brouillons")
GOOGLE_DRIVE_RAPPORTS_ARCHIVES_FOLDER_ID=...          # où un rapport est déplacé une fois validé/archivé
GOOGLE_DRIVE_RAPPORTS_TEMPLATES_FOLDER_ID=...         # bibliothèque de modèles Slides proposés à l'import
```
- Scopes utilisés : `spreadsheets` + `drive` + `presentations` (module Rapports).
- Activer **Google Slides API** sur le projet Google Cloud (module Rapports), en plus de Sheets + Drive.
- Le compte de service doit avoir **accès Éditeur** au Sheet `BDD_Asso_CRM`, aux 4 dossiers Drive des documents Familles, et aux **3 dossiers Drive du module Rapports** (Brouillons / Archives / Templates).
- `NEXT_PUBLIC_SHEETS_API_URL` / `NEXT_PUBLIC_SHEETS_SCRIPT_URL` : **obsolètes**, ne plus utiliser.

### Helpers de mapping (`lib/sheets-api.ts`)
- `calculerAge(dateStr)` — âge depuis une date `JJ/MM/AAAA`
- `getStatut(statut)` — normalise vers `EN COURS` / `ARRÊTÉ` / `SUSPENDU`

> Le reste de l'app (dashboard, absences, ateliers, bénévoles, membres…)
> reste en **localStorage** — Familles et Communication sont passés sur Google Sheets/Drive,
> Rapports est **hybride** (localStorage + vrai Google Slides/Drive à certains checkpoints,
> voir plus bas).

---

## Backend Communication — feuille `CONTENUS` + Drive médias (implémenté)

Même architecture que Familles (`/api/sheets`, compte de service), appliquée aux posts.

### Feuille `CONTENUS` du Sheet `BDD_Asso_CRM`
Colonnes d'origine : `ID | Titre | Contenu principal | Image | Vidéo | Tags | État  | Date programmée | Plateforme RS | Catégorie  | Event ID`
(⚠️ `État ` et `Catégorie ` ont un espace final dans le Sheet — à respecter exactement dans le code).

Colonnes ajoutées via `ensureColumns` (créées automatiquement au premier `addPost`/`updatePost`) pour couvrir la richesse de l'app : `Auteur`, `Brief`, `Plateforme Contenu` (JSON du `plateformeContenu` par réseau), `Participants` (JSON, posts "atelier" uniquement), `Session ID`.

`Event ID` n'est **pas utilisé** par l'app (concept distinct de la feuille `EVENEMENT`, non branché sur les sessions Ateliers) — laissé vide intentionnellement.

### Médias (Image / Vidéo)
- **Une image + une vidéo max par post** (colonnes singulières) — un nouvel ajout du même type remplace le précédent dans le formulaire.
- Upload : `uploadToDrive(nom, mimeType, base64, COMMUNICATION_MEDIA_FOLDER_ID)` puis `makeFilePublic(fileId)` (contrairement aux documents Familles, les médias de posts sont rendus **publics par lien** — nécessaire pour l'aperçu inline dans `PostPreviewCard`, et sans risque car destinés à être publiés).
- `COMMUNICATION_MEDIA_FOLDER_ID` (`lib/google-sheets-server.ts`) : dossier Drive dédié, à partager manuellement en Éditeur avec le compte de service (le compte de service n'est pas membre du Drive partagé existant, donc ne peut pas y créer de dossier lui-même).
- Suppression best-effort du fichier Drive à la suppression d'un post (`deletePost`, extraction du `fileId` depuis l'URL `?id=...`).

### Fichiers clés
| Fichier | Rôle |
|---|---|
| `lib/sheets-api.ts` | `fetchPosts`, `addPost`, `updatePost`, `deletePost`, `uploadPostMedia` |
| `app/api/sheets/route.ts` | Actions `getPosts`/`addPost`/`updatePost`/`deletePost`/`uploadPostMedia`, mapping `rowToPost`/`postWriteMap` |
| `lib/google-sheets-server.ts` | `ensureColumns` (ajout de plusieurs colonnes en 1 lecture), `COMMUNICATION_MEDIA_FOLDER_ID` |

> `asso-communication-rejected` reste en `localStorage` (annotation UI, pas une donnée métier — voir section Communication).

---

## Module Rapports — diapositives dynamiques + sync Google Slides par checkpoints

Génération de rapports d'activité (contexte : coéducation AREA, indicateurs annuels,
export en présentation). Le module reste en **localStorage** pour les listes et l'édition
(comme tous les modules sauf Familles), mais synchronise désormais un **vrai Google Slides**
à des moments précis — **pas de sync en temps réel caractère par caractère** (quotas API,
pas de push serveur→navigateur simple sur Vercel serverless) :

### Diapositives dynamiques (pas de nombre fixe)
Le deck n'a **plus de nombre de diapositives figé** (une quarantaine pour un vrai rapport,
sans plafond). L'utilisateur découpe lui-même le texte du panneau gauche en tapant **une ligne
de plus de 10 tirets** (`DELIMITEUR_RE = /^-{11,}$/`, `lib/rapports-data.ts`) sur sa propre
ligne : chaque segment entre deux délimiteurs (ou début/fin) devient une diapositive,
**instantanément** (réutilise la synchronisation passive ci-dessous). Supprimer la ligne de
tirets refusionne les deux diapositives voisines — aucune logique d'annulation séparée, c'est
recalculé à chaque frappe depuis le texte brut. **Ces lignes n'apparaissent jamais** dans
l'aperçu de droite ni dans le vrai Google Slides.

### ⚠️ Charte réelle AREA (corrige les premiers mockups)
Les tout premiers mockups de ce module utilisaient un bleu marine/turquoise **inventé** (donné
dans la spec initiale). L'utilisateur a ensuite fourni 2 vrais rapports d'activité AREA en PDF —
`STYLE_DEFAUT` (`lib/rapports-data.ts`) et `--color-rapports*` (`app/globals.css`) ont été
recalibrés sur les **vraies couleurs** (extraites du logo au pixel près) :
- Vert sapin foncé `#0B4F4B` (titres/couleur principale — remplace l'ancien `#005088`)
- Turquoise `#1C9AA0` (accent — remplace l'ancien `#11caa0`)

Le vrai logo AREA (triangles superposés) a été extrait de ces PDF (`pdftoppm`/`pdfimages` du
paquet `poppler`, recombiné avec sa soft mask via Pillow pour la transparence) et vit dans
`public/area-logo.png`. Il est affiché en badge sur chaque diapositive dans `SlidePreview.tsx`.
- `decouperDiapositives(texte)` — segments uniquement (délimiteurs exclus), utilisé par
  `SlidePreview.tsx` et tout le backend Slides.
- `tagLignesParSegment(texte)` — découpe ligne par ligne en taguant l'index de segment de
  chaque ligne (délimiteurs inclus, tagués `delimiteur: true`), utilisé par le panneau gauche
  pour le rendu **ligne par ligne** (une ligne = un élément DOM du `contentEditable`, calé sur
  le comportement natif du navigateur à chaque Entrée) et le surlignage croisé.
- Toutes les diapositives sont **génériques** (même gabarit charte AREA — bleu marine/turquoise,
  Poppins/Lato). Les anciens designs spéciaux par position fixe (cartes KPI, tableau de
  progression, triangle, témoignage) ont été retirés : plus de rôle fixe possible par diapositive
  quand leur nombre/ordre est entièrement piloté par l'utilisateur.

- **Interface → Slide** : au clic sur "💾 Sauvegarder le brouillon" et sur "✅ Valider le
  rapport" (jamais pendant la frappe).
- **Slide → Interface** : à la réouverture d'un brouillon ("Reprendre l'édition") — si le
  Slides a été modifié directement sur Drive, cette version remplace la copie locale
  (ré-injection). Pas de polling pendant que l'éditeur est ouvert.
- Toutes les synchronisations sont **best-effort** : si les dossiers Drive ne sont pas
  configurés (variables d'env absentes) ou en cas d'erreur réseau, l'échec est absorbé
  silencieusement (`console.warn`) et le module continue de fonctionner en localStorage pur.

### Architecture
```
Client (app/rapports/*)
  → lib/rapports-slides-api.ts   (fetch best-effort vers /api/slides)
  → app/api/slides/route.ts      (routeur par "action")
  → lib/google-slides-server.ts  (client Slides — création/sync/lecture du deck)
  → lib/google-sheets-server.ts  (client Drive réutilisé — déplacement de fichier, export PDF)
  → Google Slides + Google Drive (dossiers Rapports)
```

### Backend Slides — reconstruction complète à chaque checkpoint
Le découpage n'étant plus fixe (segments insérables/supprimables n'importe où, y compris au
milieu), un patch chirurgical par `objectId` fixe n'est plus fiable. `reconstruireSlides`
(`lib/google-slides-server.ts`) supprime toutes les pages existantes puis recrée une page +
zone de texte par segment courant, dans l'ordre — un seul `batchUpdate`, gère nativement
l'ajout/suppression/réordonnancement de diapositives. Utilisée à la fois pour la création
initiale (`presentationId` nul) et la synchronisation (`presentationId` fourni).
`lireTextesRapport` relit simplement le texte de chaque page **dans l'ordre réel du fichier**
(plus de mapping par index fixe) — s'adapte si l'utilisateur a ajouté/retiré des diapositives
directement dans Slides.

### Portée actuelle vs. visuelle du mock React
Le vrai Google Slides généré est **plus simple visuellement** que l'aperçu React (une seule
zone de texte par page, texte brut). Une mise en forme plus riche du vrai fichier (couleurs,
tableaux…) reste une itération séparée à faire plus tard. Seul le **format de page** (16:9 vs
A4, voir plus bas) est répliqué sur le vrai fichier — pas la mise en page des gabarits.

### Bouton "Valider le rapport"
Distinct de "Sauvegarder" : synchronise une dernière fois, déplace le fichier Drive de
`RAPPORTS_BROUILLONS_FOLDER_ID` vers `RAPPORTS_ARCHIVES_FOLDER_ID`, retire le brouillon de
`asso-rapports-brouillons` et ajoute une entrée dans `asso-rapports-historique` (première
écriture réelle de cette clé — l'Historique n'était que mock statique en Phase 1).

### ⚠️ Configuration requise (à faire par l'utilisateur avant que la sync fonctionne)
1. Créer 3 dossiers Google Drive (ex. `/AREA/Rapports/Brouillons`, `/AREA/Rapports/Archives`,
   `/AREA/Rapports/Templates` — ce dernier pour la bibliothèque de templates, voir plus bas).
2. Les partager avec le compte de service (`GOOGLE_CLIENT_EMAIL`) — **Éditeur** pour
   Brouillons/Archives (comme les 4 dossiers Documents du module Familles), **Lecteur** suffit
   pour Templates (lecture seule).
3. Ajouter dans `.env.local` + Vercel (ID lisible dans l'URL du dossier, `drive.google.com/drive/folders/<ID>`) :
   ```
   GOOGLE_DRIVE_RAPPORTS_BROUILLONS_FOLDER_ID=...   # création des rapports en cours (Slides "brouillons")
   GOOGLE_DRIVE_RAPPORTS_ARCHIVES_FOLDER_ID=...     # destination d'un rapport validé/archivé
   GOOGLE_DRIVE_RAPPORTS_TEMPLATES_FOLDER_ID=...    # bibliothèque de modèles Slides proposés à l'import
   ```
4. Activer **Google Slides API** sur le projet Google Cloud (en plus de Sheets + Drive).
   Scope Google supplémentaire utilisé : `https://www.googleapis.com/auth/presentations`
   (API Slides — doit être activée sur le même projet Google Cloud que Sheets/Drive).

### Synchronisation passive texte ↔ aperçu (temps réel, côté interface uniquement)
Chaque frappe dans le panneau gauche (`onInput`) relit le DOM et met à jour l'état
`contenuActif`, qui alimente `SlidePreview` : l'aperçu des diapositives reflète le texte
instantanément. C'est un simple miroir de texte, **pas** une révision — aucun appel IA, aucun
changement de mise en page. Ne touche jamais le vrai Google Slides (qui reste synchronisé
uniquement aux checkpoints Sauvegarder/Valider, voir ci-dessus).

### ⚠️ Révision IA — retirée
Les boutons "Révision globale"/"Réviser cette diapositive" (réécriture du texte par Claude) ont
été retirés à la demande de l'utilisateur (jugés peu utiles) — `app/api/rapports-revision/route.ts`
et `lib/rapports-revision-api.ts` ont été supprimés. Ne pas les recréer sans nouvelle demande
explicite.

### Génération de contenu suivant la trame réelle AREA — implémentée
`THEMES_RAPPORT` (`lib/rapports-data.ts`) fixe les 10 thèmes relevés sur les rapports d'activité
PDF réels fournis par l'utilisateur (Mot de la directrice, parcours élèves/parents, mesure
d'impact élèves/parents, nos actions élèves/parents, interventions extérieures, vie associative,
perspectives). Au clic sur "Générer" (`app/rapports/page.tsx`), `genererRapportIA`
(`lib/rapports-generation-api.ts` → `app/api/rapports-generation/route.ts`) est appelé en
priorité : il transmet le JSON complet de `RapportKPIs` ("la base de données") et demande à
Claude de rédiger les 10 thèmes — en s'appuyant strictement sur les chiffres fournis pour les
thèmes qui en ont (mesure d'impact, vie associative, perspectives), et en interprétant/rédigeant
le reste (mot de la directrice, parcours, actions, interventions extérieures). La charte
éditoriale AREA (postulats narratifs, lexique) est ré-embarquée dans cette route (elle vivait
dans la révision IA, supprimée). **Repli automatique** sur `genererContenuBrouillon`
(déterministe, mêmes 10 thèmes mais texte générique) si l'appel IA échoue — un message
d'avertissement (`genererErreur`) prévient alors l'utilisateur, sans bloquer la génération.

### Fermeture au clic extérieur — implémentée
`lib/use-fermer-au-clic-exterieur.ts` (hook partagé) ferme n'importe quel menu ouvrant dès qu'on
clique en dehors de son conteneur (bouton + panneau) — cliquer ailleurs équivaut à ne jamais
avoir ouvert le menu. Appliqué aux 3 menus du module : "Ajouter un template" (dashboard),
"Proposer des visuels pour cette diapositive" (chat), "Bibliothèque de templates" (éditeur).

### 13 gabarits graphiques — implémentés (inspirés des "master templates" AREA)
L'utilisateur a fourni 2 PDF "master template" (styles Moderne/Classique, 50 dispositions
chacun). Analyse : pas 50 mises en page uniques, mais ~10 composants réutilisés avec des
contenus différents. Plutôt qu'une réplique pixel-parfaite des 50, **10 gabarits curés** ont
été ajoutés aux 3 génériques d'origine (`centre`/`bandeau`/`image-gauche`), soit 13 valeurs pour
`Disposition` (`lib/rapports-data.ts`) : `couverture` (titre à crochets stylisés), `sommaire`
(cartes numérotées), `separateur` (fond plein + numéro), `kpi-cartes` (pastilles rondes),
`tableau` (2 colonnes), `barres-progression`, `territoire` (carte + zones), `temoignage`
(citation), `swot` (grille 2×2), `cloture` (fond sombre). Chaque gabarit consomme un sac de
champs optionnels partagé `DonneesGabarit` (`titre`, `sousTitre`, `numero`, `items`, `items2`,
`chiffres`, `citation`, `auteur`) et se rabat sur le texte brut de la diapositive si ces champs
sont absents — rendu dans `components/rapports/SlidePreview.tsx`.

L'IA choisit le gabarit le plus adapté **par diapositive** (jamais un plaquage littéral des 50
dispositions) lors de l'analyse d'un template — `analyserTemplate`/`suggererStylesGlobaux`
(`app/api/rapports-template/route.ts`) renvoient désormais un tableau `gabarits: {index,
disposition, donnees}[]`, un élément par segment du rapport, en plus du style de couleurs. Les
champs de `donnees` sont **extraits/reformulés depuis le texte déjà rédigé** de chaque
diapositive, jamais inventés (même règle stricte que pour le style : le document de référence
n'influence que la forme, jamais le fond). `suggererVisuels` (menu par diapositive) et
`choisirDisposition` (après ajout direct d'une photo) restent inchangés dans leur portée
propre (le second reste volontairement limité à `centre`/`bandeau`/`image-gauche`, les seuls
gabarits avec un emplacement photo).

`gabarits[]` est appliqué en un coup à `dispositionParDiapositive` +
`donneesGabaritParDiapositive` (état de `app/rapports/edition/[id]/page.tsx`) dès qu'un template
est analysé — que ce soit depuis le dashboard (avant l'ouverture de l'éditeur : stocké
temporairement sur `Brouillon.dispositionInitiale`/`donneesGabaritInitiales`, repris au
chargement) ou depuis la Bibliothèque de templates de l'éditeur (Drive, suggestions IA, **et
désormais import PDF direct** — 3ᵉ bouton du menu, même mécanisme que le dashboard).

### Format A4 — vraie page sur le fichier Google Slides réel
Case à cocher "Format A4" dans la barre du haut de l'éditeur, à côté de "Bibliothèque de
templates" (`app/rapports/edition/[id]/page.tsx`, état `format: FormatRapport =
"classique"|"a4"`). Bascule l'aperçu React (`SlidePreview` — `aspectRatio` 16:9 ↔ 210:297) ET la
géométrie du vrai fichier Slides. **Contrainte API vérifiée** : `presentations.create()` accepte
un `pageSize` personnalisé, mais aucune requête `batchUpdate` ne permet de redimensionner une
présentation existante (`node_modules/googleapis/build/src/apis/slides/v1.d.ts`). Donc si le
format demandé diffère de `brouillon.format` au moment de Sauvegarder/Valider, l'éditeur passe
`nouveauFichier: true` à `syncSlide` (`lib/rapports-slides-api.ts` → `app/api/slides/route.ts`),
ce qui force `reconstruireSlides` (`lib/google-slides-server.ts`) à créer une **toute nouvelle
présentation** (nouveau `presentationId`) plutôt que réutiliser l'ancienne — `slideId`/`slideUrl`
sont mis à jour sur le `Brouillon` en conséquence. L'ancien fichier Slides n'est **pas** supprimé
automatiquement (reste sur Drive, cohérent avec le reste du module qui est best-effort).
Dimensions EMU : 16:9 = 9144000×5143500 (existant), A4 portrait 210×297mm = 7560000×10692000
(1mm = 36000 EMU). Toutes les fonctionnalités (gabarits, photos, chat, bibliothèque de
templates) restent disponibles dans les deux formats.

### Import de template/logo (dès la création) + assemblage IA — implémentés
Le template et le logo s'importent sur le **dashboard** (`app/rapports/page.tsx`, section
"Créer un nouveau rapport"), pas dans l'éditeur : 2 boutons **"Ajouter un template"** (PDF lu
nativement par Gemini via `inlineData` base64, ou lien/ID Google Slides existant lu via
`getSlidesClient()`) et **"Ajouter un logo"** (image). Choisis avant de cliquer "Générer" —
mémorisés en state local (`templateSource`/`logoDataUrl`), aucun appel IA tant qu'on n'a pas
généré. **Pas de PowerPoint (.pptx)** — non parsé nativement et aucun outil de conversion
disponible dans cet environnement (PDF et Google Slides uniquement).
- Au clic sur "Générer" (`handleGenerer`) : le contenu est généré, PUIS si un template est
  présent, `analyserTemplate(source, undefined, segments)` (`lib/rapports-template-api.ts`) lui
  transmet **le contenu déjà rédigé** pour qu'il assemble le tout "le plus graphiquement
  possible", en respectant strictement disposition/typographie/couleurs du document de
  référence — best-effort (échec → style par défaut + message d'erreur affiché, la génération
  n'est jamais bloquée). Le logo (s'il y en a un) est stocké tel quel sur `Brouillon.logoUrl`,
  indépendamment de l'analyse du template.
- Backend : `app/api/rapports-template/route.ts` (Gemini via `fetch` natif, `gemini-2.5-flash`,
  prompt "directeur de communication expérimenté"). `analyserTemplate` renvoie
  `{ style, message }` — `style` = `StyleRapport` (`couleurPrincipale`, `couleurAccent`,
  `disposition`, **`typographie: "moderne"|"classique"`** — 2 styles prédéfinis, pas de
  chargement dynamique de police réelle, voir `POLICES` dans `lib/rapports-data.ts`).
- **Disposition par diapositive choisie par l'IA** (plus de bascule fixe centre→image-gauche) :
  nouvelle action `choisirDisposition` (même route), appelée à chaque fois qu'une photo atterrit
  sur une diapositive — que ce soit via le bouton 📷 direct sur la diapositive sélectionnée
  (`SlidePreview.tsx`) ou via le chat (`AiChatPanel.tsx`, après `placerPhoto`). Résultat stocké
  dans `dispositionParDiapositive` (état de `app/rapports/edition/[id]/page.tsx`, par index de
  diapositive) ; repli sur l'ancienne heuristique fixe uniquement si l'appel IA échoue.
- `SlidePreview.tsx` prend `style`/`imagesParDiapositive`/`dispositionParDiapositive`/`logoUrl`
  en props. `logoUrl` (si fourni par le brouillon) remplace le logo AREA par défaut. `style`
  (donc la typographie choisie) est persisté sur le `Brouillon` (`handleSauvegarder`) mais
  **pas synchronisé vers le vrai Google Slides** (qui reste texte brut).

### Suppression (brouillons + historique) — implémentée
Bouton 🗑️ sur chaque ligne du dashboard, avec confirmation explicite. **Supprime aussi le
vrai fichier Google Slides sur Drive** s'il existe (`deleteDriveFile`, déjà présent dans
`lib/google-sheets-server.ts`, exposé via l'action `supprimer` de `app/api/slides/route.ts` et
`supprimerSlide` côté client) — irréversible, décision explicite de l'utilisateur.

### Le template n'influence QUE le style, jamais le contenu
Le prompt d'`analyserTemplate` (`app/api/rapports-template/route.ts`) interdit explicitement à
l'IA de reprendre un fait, chiffre, date ou texte du document de référence importé — le contenu
du rapport reste strictement celui généré pour la période sélectionnée par l'utilisateur ; seuls
la couleur principale/accent, la disposition et la typographie peuvent en être extraits.

### Photo : uniquement via le bouton direct sur la diapositive
Le bouton "Photo" du chat a été retiré (`components/rapports/AiChatPanel.tsx`) — l'insertion de
photo se fait uniquement via le bouton 📷 qui apparaît en haut à droite d'une diapositive
**sélectionnée** dans `SlidePreview.tsx` (voir plus haut). L'action `placerPhoto` de l'API
Rapports a été retirée avec (elle ne servait qu'à deviner l'index de diapositive depuis le
chat — inutile maintenant que le bouton direct connaît déjà l'index).

### Suggestions visuelles par diapositive — implémentées
Quand une diapositive est sélectionnée, un bouton **"Proposer des visuels pour cette
diapositive"** apparaît au-dessus de la zone de saisie du chat. Il déclenche l'action
`suggererVisuels` (même route `app/api/rapports-template/route.ts`) qui croise le style actuel
du rapport (issu du template importé s'il y en a un, sinon le style par défaut) avec le contenu
propre à cette diapositive, et renvoie 3 suggestions (une par disposition disponible) avec un
label et une description. Un menu s'ouvre à droite du bouton ; cliquer une suggestion applique
sa disposition à cette diapositive via `dispositionParDiapositive` (même mécanisme que le choix
automatique après ajout de photo). Un bouton **"Régénérer d'autres visuels"** en bas du menu
relance le même appel pour obtenir 3 nouvelles propositions si les premières ne conviennent pas.

### Bibliothèque de templates (globale) — implémentée
En haut du panneau droit, au-dessus de `SlidePreview`, un bouton **"Bibliothèque de
templates"** ouvre un menu proposant des variations de **style pour tout le deck** (pas une
seule diapositive) — deux sources :
- **Templates Drive** : liste des Google Slides du dossier `RAPPORTS_TEMPLATES_FOLDER_ID`
  (action `listerTemplatesDrive`, `lib/google-sheets-server.ts` § `listerFichiersDriveDossier` —
  tableau vide si le dossier n'est pas configuré, jamais d'erreur). Cliquer un template
  l'analyse via `analyserTemplate` (déjà existant) et applique le style résultant à **tout**
  le rapport (`setStyle`, pas `dispositionParDiapositive`).
- **Suggestions IA** : action `suggererStylesGlobaux` (même route), qui propose 3 variations
  complètes (couleurs + disposition + typographie) à partir du contenu entier du rapport, avec
  un bouton "Régénérer" comme pour les suggestions par diapositive.

### Hors périmètre (phases suivantes, PAS encore implémenté)
- Import PowerPoint (.pptx) — pas d'outil de conversion disponible dans cet environnement.
- Chargement dynamique d'une police exacte extraite d'un document (2 styles prédéfinis seulement).
- Persistance durable des photos placées (upload Drive réel, comme `uploadToDrive` du module
  Familles) — restent en mémoire navigateur pour l'instant.
- Fidélité visuelle complète du vrai Slides (couleurs/disposition/typographie non poussées
  vers le fichier réel, qui reste texte brut).
- Chat en texte libre (sans pièce jointe) réellement intelligent — reste mocké.
- Confirmation en 2 temps pour le template (analyse → question → réponse séparée) : analyse et
  application se font en un seul aller-retour, l'instruction étant fournie avec l'import.
- Densité visuelle "bilan annuel" du mockup React (demande reçue, indépendante du backend).
- Journalisation `Apprentissage_IA` dans Sheets (boucle d'auto-apprentissage).
