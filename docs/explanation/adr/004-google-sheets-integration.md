---
type: explanation
adr: "004"
statut: accepté (module Familles)
date: 2026-05-20
maj: 2026-07-01
---

# ADR 004 — Intégration Google Sheets

> **Mise à jour (juillet 2026)** — Le module **Familles** est le premier à intégrer
> Google Sheets. La solution retenue n'est **aucune des options A/B/C ci-dessous** mais
> l'**API REST Google Sheets v4 appelée côté serveur via un compte de service** (voir
> section « Décision » et « Implémentation réelle »). Le reste de l'app est toujours en
> localStorage (ADR 001).

## Contexte

L'association gère ses données dans plusieurs Google Sheets (bénéficiaires, présences, ateliers).
L'outil de pilotage doit pouvoir **lire et écrire** ces sheets pour éviter la double saisie.

## Contrainte actuelle

L'app est 100% navigateur (localStorage, pas de backend — voir ADR 001).
L'API Google Sheets nécessite OAuth, ce qui exige normalement un serveur pour stocker les credentials.

## Options étudiées

### Option A — Google Apps Script (recommandée pour la phase 1)

Un script Apps Script expose un **Web App HTTP** (doGet / doPost).
L'app Next.js appelle ce endpoint avec `fetch` — aucun backend requis côté nous.

```
Navigateur → fetch → Apps Script Web App → Google Sheets
```

**Avantages** : zéro coût, pas de backend, déployable en 30 min
**Limites** : URL du script exposée publiquement, pas d'auth granulaire

Implémentation côté app :
```typescript
// lib/sheets.ts
const SCRIPT_URL = process.env.NEXT_PUBLIC_SHEETS_SCRIPT_URL

export async function fetchBeneficiaires() {
  const res = await fetch(`${SCRIPT_URL}?action=getBeneficiaires`)
  return res.json()
}

export async function updatePresence(sessionId: number, benefId: number, statut: string) {
  await fetch(SCRIPT_URL!, {
    method: "POST",
    body: JSON.stringify({ action: "setPresence", sessionId, benefId, statut }),
  })
}
```

### Option B — Supabase (recommandée pour la phase 2)

Migration vers Supabase (voir ADR 001). Supabase peut synchroniser avec Google Sheets
via ses Edge Functions ou un cron job.

**Avantages** : auth intégrée, multi-utilisateurs, vraie BDD
**Limites** : coût potentiel, migration à planifier

### Option C — Export/Import CSV (solution de transition immédiate)

Ajouter dans l'app :
- Un bouton **"Exporter CSV"** sur les pages Bénéficiaires et Présences
- Un bouton **"Importer CSV"** pour charger un fichier Google Sheets exporté

Pas de sync temps réel, mais élimine la ressaisie manuelle.

### Option D — API REST Google Sheets v4 côté serveur (RETENUE)

Une **route serveur Next.js** (`app/api/sheets/route.ts`) parle directement à l'API
REST Google Sheets v4 (et Drive) via la lib `googleapis`, authentifiée par un
**compte de service**. Les credentials restent côté serveur (variables d'env), l'URL
n'est jamais exposée publiquement.

```
Client (pages familles) → /api/sheets (route serveur) → googleapis → Google Sheets / Drive
```

**Avantages** : credentials privés (pas d'URL publique), CRUD complet, accès Drive,
pas de service tiers. **Limites** : nécessite un compte de service + partage des
Sheets/dossiers ; corps de requête plafonné à ~4,5 Mo sur Vercel (upload de fichiers).

## Décision

**Retenue : Option D** — API REST v4 côté serveur via compte de service.
Une première itération utilisait un Web App Apps Script (Option A) ; elle a été
abandonnée au profit de l'Option D (credentials privés, accès Drive). Voir
« Implémentation réelle ».

Une migration Supabase (Option B) reste envisageable à terme si le multi-utilisateurs
et une vraie auth deviennent nécessaires.

## Implémentation réelle (module Familles)

- **Sheet** : `BDD_Asso_CRM` (ID `1bOISBPwoU1xa5R4Um0fRASXKFeclJ8jB3A3CUHBMlI8`),
  tables relationnelles FAMILLE / PERSONNE / INSCRIPTION / PAIEMENT / EVALUATION /
  DOCUMENTS JOINTS…
- **Route** : `app/api/sheets/route.ts` (routeur par `action`, GET = lecture / POST = écriture)
- **Serveur** : `lib/google-sheets-server.ts` (clients Sheets + Drive, helpers CRUD)
- **Client** : `lib/sheets-api.ts` (`API_URL = "/api/sheets"`)
- **Documents** : upload par catégorie vers 4 dossiers Google Drive
- Le fichier `apps-script/web-app.gs` de l'itération Apps Script est conservé mais **plus utilisé**.

## Structure des Google Sheets attendue

Pour que l'intégration fonctionne, les sheets doivent avoir ces colonnes.
Le chantier 2.1 "Aide à la composition des groupes" a ajouté plusieurs
colonnes pour porter les notes détaillées du test de positionnement, la
fiche descriptive de chaque atelier, et l'état brouillon/validé des
groupes — détails dans `docs/how-to/composition-groupes.md`.

### Sheet "Bénéficiaires"

Identité & contact :
| id | prenom | nom | dateNaissance | email | telephone | nomParent | telephoneParent | emailParent | dateInscription | niveau | statut | notes |

Notes du test de positionnement initial (sert à la composition de groupes) :
| init_comprehensionEcrite | init_comprehensionOrale | init_expressionEcrite | init_expressionOrale |

Notes du test de positionnement final (mesure d'impact, optionnel) :
| final_comprehensionEcrite | final_comprehensionOrale | final_expressionEcrite | final_expressionOrale |

> Toutes les notes sont sur 20, ou vides si non évaluées. Si les 4 notes
> initiales sont vides, le bénéficiaire est marqué "à évaluer avant
> attribution" et n'est pas placé automatiquement dans les groupes.

### Sheet "Ateliers"

Identité & planning :
| id | titre | description | date | heure | duree | salle | formatrice | statut |

Public ciblé & paramètres de composition :
| ageMin | ageMax | tailleGroupeCible |

Période (champ texte libre, ex : "Vacances de printemps 2026") :
| periode |

Compétences ciblées (4 colonnes booléennes : VRAI/FAUX) :
| comp_comprehensionEcrite | comp_comprehensionOrale | comp_expressionEcrite | comp_expressionOrale |

Organisation (chaînes JSON sérialisées — listes éditables côté app) :
| taches | besoins | etapes | personnesImpliqueesIds |

Participants :
| beneficiaireIds | benevoleIds |

### Sheet "Groupes"

| id | nom | atelierId | type | description | beneficiaireIds | etat | dateValidation |

- `type` : `niveau` (homogène) / `mixte` (hétérogène) / `âge`
- `etat` : `brouillon` (proposition de l'algo, non validée) / `valide` (composition officielle)
- `dateValidation` : ISO, vide tant que le groupe est en brouillon

> Un groupe peut basculer de `brouillon` à `valide` après ajustement humain.
> Inversement, on supprime simplement la ligne pour abandonner un brouillon.

### Sheet "Présences"
| sessionId | beneficiaireId | statut | date |

## Variables d'environnement (option D — retenue)

```
GOOGLE_CLIENT_EMAIL=...@....iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

À définir dans `.env.local` **et** dans Vercel (Production + Preview + Development).
Le compte de service doit avoir un accès **Éditeur** au Sheet `BDD_Asso_CRM` et aux
dossiers Drive de documents. Scopes utilisés : `spreadsheets` + `drive`.

> `NEXT_PUBLIC_SHEETS_SCRIPT_URL` et `NEXT_PUBLIC_SHEETS_API_URL` (itérations Apps Script)
> sont **obsolètes** et ne sont plus lues par le code.
