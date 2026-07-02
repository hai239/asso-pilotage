---
type: reference
---

# Charte graphique « Estuaire »

Identité visuelle de l'application de pilotage AREA Nantes, inspirée du site
[areanantes.fr](https://areanantes.fr/) : teal apaisant, fond crème, rondeurs et
pictogrammes. Tout est piloté par des **tokens** dans `app/globals.css` (config
CSS-first Tailwind v4, `@theme inline`) et les polices dans `app/layout.tsx`.

## Palette

La marque est **unifiée sur 3 couleurs** + neutres. Chaque module est rattaché à
l'une des trois (plus de code-couleur « arc-en-ciel » par module).

| Rôle | Hex | Variantes | Modules rattachés |
|---|---|---|---|
| **Teal** (primaire) | `#159c99` | `-light #ddf3f2` · `-dark #0c6c6a` | ateliers, bénévoles, positionnement, notes, émargement |
| **Vert forêt** | `#1b6840` | `-light #dbede3` · `-dark #134d30` | finances, familles |
| **Doré** | `#d99a1e` | `-light #f8eccd` · `-dark #8f6410` | communication, absences, assiduité, veille subventions |
| Fond (crème) | `#f7f5f1` | — | `--background` |
| Encre (navy) | `#0f1e2b` | — | `--foreground` |
| Filet | `#e7e2d9` | — | `--border` |
| Rouge fonctionnel | `#e4472b` | — | `--color-alert` (erreurs / actions destructives, **hors** marque) |

> Les couleurs des modules (`bg-finances`, `bg-communication`…) restent des classes
> sémantiques Tailwind. Elles pointent désormais toutes vers l'une des 3 teintes,
> mais on continue d'utiliser `bg-ateliers`, `bg-finances`, etc. — **jamais**
> `bg-[var(--color-…)]`.

## Typographie

| Rôle | Police | Où |
|---|---|---|
| Titres (`h1`–`h6`) | **Poppins** (500/600/700) | `--font-poppins`, règle globale dans `globals.css` |
| Texte courant | **Inter** | `--font-sans` / `--font-inter`, `body` |
| Mono | pile système | `--font-mono` |

Chargées via `next/font/google` dans `app/layout.tsx` (variables CSS posées sur `<html>`).

## Arrondis

Bumpés globalement via les tokens Tailwind (`@theme inline`) : `--radius-md 0.5rem`,
`--radius-lg 0.75rem`, `--radius-xl 1rem`, `--radius-2xl 1.25rem`. Toute classe
`rounded-*` existante devient un peu plus ronde, sans toucher les composants.

## Conventions de composants

### Boutons d'action (accordés à l'onglet)

Un bouton d'action principal reprend la couleur de son module :

```tsx
// module « clair » (teal / vert forêt) → couleur pleine + texte blanc
className="… bg-finances text-white hover:bg-finances-dark …"

// module « doré » (communication / absences / subventions) → variante -dark
// (le blanc sur doré clair échoue le contraste RGAA)
className="… bg-communication-dark text-white hover:opacity-90 …"
```

Modules sans couleur propre (Équipe/Membres, Compte) → **teal de marque** (`bg-brand`).

### `SaveButton` (formulaires SlideOver)

Le bouton d'enregistrement partagé accepte une prop `accent` (défaut `brand`) :

```tsx
<SaveButton accent="communication" />   // doré
<SaveButton accent="finances" />        // vert forêt
<SaveButton />                          // teal de marque (défaut)
```

Les classes sont **statiques** (table `SAVE_ACCENTS` dans `components/SlideOver.tsx`) —
Tailwind ne génère pas les classes construites dynamiquement (`bg-${x}`).

### Pictogrammes d'état (Communication)

Chaque état de validation a un picto (lucide-react), réutilisé dans la **légende**,
les **cases de l'agenda** (calendrier) et les **en-têtes du kanban** pour la lisibilité :

| État | Picto |
|---|---|
| Brouillon | `Pencil` |
| À valider | `Clock` |
| Validé | `Check` |
| Publié | `CheckCircle2` |

Défini dans `STATUT_ICON` (`app/communication/page.tsx`).

## Changer la charte

- **Couleurs / neutres / arrondis** → `app/globals.css` (bloc `:root` + `@theme inline`).
- **Polices** → `app/layout.tsx` (imports `next/font`) + tokens `--font-*` dans `globals.css`.
- **Accents de bouton** → table `SAVE_ACCENTS` dans `components/SlideOver.tsx`.

> ⚠️ Turbopack ne recharge pas à chaud les changements de `@theme` ni de `next/font` :
> après modification, **redémarrer `npm run dev`** (supprimer `.next/` si besoin).
