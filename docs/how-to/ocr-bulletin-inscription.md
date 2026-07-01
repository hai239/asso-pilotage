---
type: how-to
---

# Scanner un bulletin d'inscription (OCR)

Lors de l'ajout d'un membre, il est possible d'uploader le bulletin d'inscription
PDF pour pré-remplir automatiquement le formulaire.

## Prérequis

- Clé API Gemini configurée dans `.env.local` et sur Vercel :
  ```
  GEMINI_API_KEY=...
  ```
  → Créer une clé sur [Google AI Studio](https://aistudio.google.com/app/apikey)

## Utilisation

1. Aller sur une fiche famille `/familles/[id]`
2. Cliquer sur **"+ Ajouter un membre"**
3. Dans le champ **"Bulletin d'inscription (PDF)"**, choisir le fichier
4. L'OCR se déclenche automatiquement — un spinner s'affiche pendant l'analyse
5. Une fois terminé, le message "Champs pré-remplis ✓" apparaît et les champs
   Nom, Prénom, Téléphone, Date de naissance sont remplis
6. Corriger si besoin, puis cliquer sur **"Enregistrer"**

À l'enregistrement, le PDF est automatiquement uploadé sur Google Drive dans le
dossier "Fiche d'inscription" et référencé dans la table `DOCUMENTS JOINTS`.

## Champs extraits

| Champ bulletin | Champ formulaire |
|---|---|
| Nom de famille | Nom |
| Prénom(s) | Prénom |
| Date de naissance | Date de naissance |
| Numéro(s) de téléphone | Téléphone (premier numéro) |

## Architecture technique

```
Formulaire (page.tsx)
  → POST /api/ocr (multipart/form-data, champ "file")
      → Gemini 2.5 Flash API (PDF base64 + schéma structuré)
      → JSON { nom, prenom, date_naissance, telephones[] }
  → Pré-remplissage du formulaire

À l'enregistrement :
  → addMembre() → ID_Membre
  → uploadFichier() → Drive + DOCUMENTS JOINTS
```

Voir `app/api/ocr/route.ts` et ADR 006.

## Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| Pas de pré-remplissage | `GEMINI_API_KEY` manquante ou invalide | Vérifier `.env.local` |
| Erreur 502 | Quota Gemini atteint | Attendre ou créer une nouvelle clé |
| Mauvaise lecture | Écriture peu lisible | Corriger manuellement après OCR |
