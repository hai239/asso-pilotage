---
type: explanation
adr: "006"
statut: accepté
date: 2026-07-01
---

# ADR 006 — OCR des bulletins d'inscription via Gemini API

## Contexte

L'association AREA reçoit des bulletins d'inscription manuscrits en PDF. La saisie
manuelle dans l'outil est source d'erreurs et chronophage. L'objectif est d'extraire
automatiquement les informations du bulletin pour pré-remplir le formulaire d'ajout
de membre.

## Options étudiées

### Option A — OCR classique (Tesseract, Google Vision)
Moteur OCR traditionnel : fiable sur texte imprimé, peu performant sur manuscrit
cursif français.

### Option B — Gemini API avec sortie structurée (RETENUE)
Gemini 2.5 Flash accepte un PDF en base64 et retourne un JSON contraint par un
schéma (`responseSchema`). La précision sur l'écriture manuscrite est nettement
supérieure aux OCR classiques.

## Décision

**Retenue : Option B** — Gemini 2.5 Flash via l'API REST avec sortie structurée JSON.

Avantages : excellente précision sur manuscrit, schéma imposé (pas de parsing fragile),
aucune dépendance npm supplémentaire (appel `fetch` natif).
Limites : clé API Gemini requise, quota gratuit limité.

## Implémentation

### Route serveur

`app/api/ocr/route.ts` — reçoit un PDF en `multipart/form-data`, l'encode en base64,
appelle Gemini et retourne le JSON extrait.

Schéma de sortie :
```typescript
{ nom, prenom, date_naissance, telephones: string[], montant_total, date_signature }
```

Modèle : `gemini-2.5-flash`
Clé : `process.env.GEMINI_API_KEY`

### Intégration formulaire

Dans `app/familles/[id]/page.tsx` — formulaire "Ajouter un membre" :
- Champ upload PDF → déclenche l'OCR automatiquement
- Pré-remplit : Nom, Prénom, Téléphone, Date de naissance
- Le PDF est uploadé sur Google Drive (catégorie "Fiche d'inscription") à l'enregistrement

### Variable d'environnement

```
GEMINI_API_KEY=...
```

À définir dans `.env.local` **et** dans Vercel (Production + Preview + Development).
Clé à créer sur [Google AI Studio](https://aistudio.google.com/app/apikey).
