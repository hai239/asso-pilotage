---
type: how-to
chantier: "2.1"
statut: livré
date: 2026-05-21
---

# Composer un brouillon de groupes pour un atelier

> Ce guide explique comment utiliser la fonctionnalité d'aide à la composition
> de groupes livrée dans le chantier 2.1. Pour les détails techniques, voir
> les fichiers `lib/positionnement.ts`, `lib/atelier.ts`, `lib/group-composer.ts`
> et `app/brouillon-groupes/page.tsx`.

## À quoi ça sert

Avant ce chantier, la constitution des groupes d'atelier se faisait à la main :
les collaboratrices ressortaient les notes du test de positionnement, choisissaient
les thématiques pertinentes pour l'atelier visé, composaient les groupes à l'œil,
puis revérifiaient. Long, fastidieux, source d'erreurs.

Désormais, dès qu'un atelier est créé, l'app propose un **brouillon de groupes**
calculé à partir des notes des bénéficiaires. Les collaboratrices ajustent à la
souris (drag & drop) puis valident — la composition bascule alors dans l'onglet
Ateliers comme un groupe officiel.

L'idée n'est pas de remplacer le jugement humain, mais de partir d'un brouillon
intelligent plutôt que d'une page blanche.

## Vue d'ensemble du flux

```
1. Saisir les notes du test                  → onglet Bénéficiaires
   (4 thématiques × 2 sessions)

2. Créer un atelier + cocher les thématiques → onglet Ateliers
   pertinentes pour cet atelier
       ↓ génération automatique
3. Voir le brouillon proposé                 → sous-onglet "Brouillon groupes" de la page Ateliers
       ↓ drag & drop pour ajuster
4. Valider la composition                    → groupes créés dans Ateliers
```

## Étape 1 — Saisir les notes du test de positionnement

Ouvre la fiche d'un bénéficiaire (onglet **Bénéficiaires**, crayon ✏️ sur la ligne).
Dans la section "Test de positionnement", remplis les **4 thématiques évaluées** :

- **Compréhension écrite** — lire un texte et le comprendre
- **Compréhension orale** — écouter et comprendre un échange oral
- **Expression écrite** — rédiger
- **Expression orale** — s'exprimer à voix haute

Chaque note est sur 20. Tu peux saisir :

- **Initial** : noté à l'entrée — sert à composer les groupes
- **Final** : noté en fin de parcours — mesure d'impact (optionnel)

> ⚠️ Tant que les 4 notes initiales sont vides, le bénéficiaire est marqué
> **"À évaluer avant attribution"** dans la liste, et il n'est pas placé
> automatiquement dans les groupes. Il apparaît dans une zone dédiée du
> brouillon pour qu'on ne l'oublie pas.

## Étape 2 — Créer un atelier en cochant les compétences ciblées

Ouvre l'onglet **Ateliers** et clique sur "Nouvel atelier". Dans le formulaire,
**3 sections nouvelles** alimentent l'algorithme :

### Compétences ciblées (bandeau bleu)

Coche les thématiques du test de positionnement que cet atelier va travailler.

| Atelier | Compétences à cocher |
|---|---|
| Atelier théâtre | expression orale, compréhension orale |
| Atelier exposé | expression orale, expression écrite |
| Logique & algo | compréhension écrite, expression écrite |
| Médiation numérique | compréhension écrite (selon contenu) |

> 💡 Si tu coches **plusieurs thématiques**, l'algorithme regroupe les bénéficiaires
> qui ont des notes proches **sur chacune des thématiques**, pas sur leur moyenne.
> Deux bénéficiaires avec la même moyenne mais des notes très différentes sur
> chaque axe ne se retrouvent **pas** dans le même groupe.

### Public ciblé

- **Âge min / max** : la tranche d'âge cible. Trois tranches sont reconnues
  comme **barrières dures** (un 9 ans et un 10 ans peuvent être ensemble, un
  9 ans et un 14 ans jamais) :
  - 6-9 ans
  - 10-13 ans
  - 14-18 ans
- **Taille de groupe cible** (facultatif) : nombre visé par groupe (ex 8 ou 10).

### Organisation

Cette section ne nourrit pas l'algorithme mais sert au suivi opérationnel :

- **Tâches à faire** — liste à puces éditable (ajouter, supprimer)
- **Besoins matériels / humains** — idem
- **Étapes d'organisation** — liste ordonnée numérotée
- **Personnes impliquées** — multi-sélection sur l'annuaire des membres

## Étape 3 — Consulter le brouillon proposé

Dès que tu cliques sur "Enregistrer", **un brouillon est généré automatiquement**.
Un toast orange apparaît en bas à droite avec un lien "Voir →" qui bascule
sur le sous-onglet **Brouillon groupes** (3e onglet de la page Ateliers, à
côté de "Ateliers" et "Groupes").

Sur cet écran, pour chaque atelier :

- Les **groupes proposés** sont affichés en cartes, avec le nom auto-généré
  (*{atelier} · {tranche} · Groupe N*).
- Les bénéficiaires **non placés** sont affichés à part dans deux zones :
  - **À évaluer avant attribution** (orange) — pas de notes initiales
  - **Hors tranche d'âge** (gris) — âge en dehors de la plage de l'atelier

## Étape 4 — Ajuster par drag & drop

Tu peux **déplacer un bénéficiaire d'un groupe à l'autre** simplement en le
glissant à la souris. Le brouillon est sauvegardé à chaque mouvement.

Tu peux aussi **régénérer** avec d'autres paramètres :

1. Clique sur le bouton "Régénérer" en haut à droite du brouillon.
2. Modifie la taille de groupe.
3. Valide — le brouillon est remplacé.

> 💡 Tu peux régénérer autant de fois que tu veux jusqu'à être satisfaite.
> Tant que tu n'as pas cliqué sur "Valider la composition", **rien n'est
> publié dans l'onglet Ateliers**.

## Étape 5 — Valider la composition

Quand le brouillon te convient, clique sur **"Valider la composition"** (bouton
vert). Les groupes sont créés dans l'onglet **Ateliers** (sous-onglet Groupes)
comme des groupes officiels. Le brouillon disparaît de l'écran.

À partir de là, les groupes alimentent toutes les pages aval (émargement,
absences, etc.).

## Bonus — Abandonner un brouillon

Si tu ne veux finalement pas valider, clique sur "Abandonner ce brouillon"
(petit lien en bas à droite de la carte). Le brouillon est supprimé et la
carte de l'atelier propose à nouveau "Générer un brouillon".

## Cas limites

- **Aucune compétence cochée sur l'atelier** → l'algorithme ne sait pas sur
  quels axes comparer. Bouton "Générer" désactivé jusqu'à correction.
- **Bénéficiaire sans aucune note initiale** → relégué en zone "À évaluer
  avant attribution", non placé. Une fois ses notes saisies, régénérer
  le brouillon le placera automatiquement.
- **Atelier dont la plage d'âge chevauche plusieurs tranches** (ex 8-12)
  → l'algorithme crée des groupes **par tranche** (un groupe 6-9 et un
  groupe 10-13). Les tranches ne sont jamais mélangées même si la plage
  l'autorise.
- **Bénéficiaires non actifs** (diplômés, abandons) → écartés silencieusement.

## Roadmap

- ⏳ **Synchronisation Google Sheets** : voir
  `docs/explanation/adr/004-google-sheets-integration.md`. Le mapping des
  colonnes est prêt côté app, le script de sync sera développé avec le collègue
  qui s'occupe du Sheet.
- ⏳ **Pondération des compétences** : possibilité de donner plus de poids
  à une thématique qu'à une autre (ex théâtre = expression orale ×2, compréhension
  orale ×1). Non implémenté dans le premier livrable, prévu si le besoin se
  confirme à l'usage.
- ⏳ **Historique des brouillons** : conserver les versions passées pour
  comparer plusieurs essais. Non implémenté (un seul brouillon actif par
  atelier pour l'instant).
