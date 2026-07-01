// Données du module Test de positionnement
// Niveaux + catégories d'exercices, basés sur les tests papier existants (DELF A1/A2,
// Alpha, et tests scolaires CE/CM-6ème/5ème-4ème/3ème-Lycée).

export type NiveauKey =
  | "A1"
  | "A2"
  | "Alpha"
  | "3eme-Lycee"
  | "5eme-4eme"
  | "CE"
  | "CM-6eme"

export interface Categorie {
  id: string
  nom: string
  bareme: number
  /** Formats d'exercices attendus pour cette catégorie — guide la génération IA */
  formats: string[]
}

export interface Niveau {
  key: NiveauKey
  label: string
  /** Public visé */
  description: string
  categories: Categorie[]
}

export const NIVEAUX: Niveau[] = [
  {
    key: "A1",
    label: "A1",
    description: "Adultes débutants — niveau DELF A1",
    categories: [
      {
        id: "comprehension-orale",
        nom: "Compréhension orale",
        bareme: 25,
        formats: [
          "3 exercices basés sur de courts documents audio simulés (météo, message téléphonique, annonce, dialogues du quotidien)",
          "QCM à 3 choix sur des informations factuelles (lieu, date, heure, numéro de téléphone)",
          "association image/dialogue",
        ],
      },
      {
        id: "comprehension-ecrite",
        nom: "Compréhension écrite",
        bareme: 25,
        formats: [
          "lecture de petites annonces (logement) suivie de questions factuelles courtes",
          "lecture d'un mot/message simple (école, médecin) avec QCM",
          "lecture d'horaires/règlement avec questions factuelles",
        ],
      },
      {
        id: "production-ecrite",
        nom: "Production écrite",
        bareme: 25,
        formats: [
          "remplir un formulaire administratif simple (état civil)",
          "rédiger un court message WhatsApp (20 à 30 mots) pour prévenir d'une absence",
        ],
      },
    ],
  },
  {
    key: "A2",
    label: "A2",
    description: "Adultes — niveau DELF A2",
    categories: [
      {
        id: "comprehension-orale",
        nom: "Compréhension orale",
        bareme: 25,
        formats: [
          "message téléphonique (répondeur, colis, commerce) avec QCM",
          "2 mini-dialogues de situations du quotidien (santé, rendez-vous) avec questions ouvertes courtes",
        ],
      },
      {
        id: "comprehension-ecrite",
        nom: "Compréhension écrite",
        bareme: 25,
        formats: [
          "petites annonces (logement) à associer à des profils de personnes",
          "article de magazine avec QCM et questions ouvertes",
          "texte informatif (vie quotidienne/société) avec questions factuelles + vrai/faux justifié",
        ],
      },
      {
        id: "production-ecrite",
        nom: "Production écrite",
        bareme: 25,
        formats: [
          "récit d'une journée type / routine quotidienne (environ 80 mots)",
        ],
      },
    ],
  },
  {
    key: "Alpha",
    label: "Alpha",
    description: "Adultes non-lecteurs / alphabétisation",
    categories: [
      {
        id: "diagnostic-lecture-ecriture",
        nom: "Diagnostic lecture - écriture",
        bareme: 25,
        formats: [
          "reconnaissance des lettres de l'alphabet (majuscules, script, cursive)",
          "lecture de syllabes simples puis complexes",
          "lecture de mots courants puis d'une courte phrase de présentation",
          "copie de mots/phrases modèles",
          "repérage du mot correct parmi des mots proches visuellement",
        ],
      },
      {
        id: "comprehension-orale",
        nom: "Compréhension orale",
        bareme: 25,
        formats: [
          "QCM sur un message audio simple (âge, numéro de téléphone, prix, date)",
          "identification de l'ordre de plusieurs messages courts",
        ],
      },
      {
        id: "production-ecrite",
        nom: "Production écrite",
        bareme: 25,
        formats: [
          "message WhatsApp très court pour prévenir d'une absence",
          "formulaire d'inscription simple (nom, prénom, date de naissance, téléphone)",
        ],
      },
    ],
  },
  {
    key: "3eme-Lycee",
    label: "3ème - Lycée",
    description: "Collégiens (3ème) et lycéens",
    categories: [
      {
        id: "comprehension-orale",
        nom: "Compréhension orale",
        bareme: 20,
        formats: [
          "courts documents audio du quotidien (transports, annonces) avec QCM",
          "texte/transcription plus long (sujet ado) avec vrai/faux et QCM",
          "questions ouvertes demandant 3 éléments de réponse à citer",
        ],
      },
      {
        id: "comprehension-ecrite",
        nom: "Compréhension écrite",
        bareme: 20,
        formats: [
          "texte argumentatif (société, vie quotidienne) d'une vingtaine de lignes",
          "questions ouvertes de compréhension globale et de détail",
          "question de vocabulaire en contexte (sens d'un mot/expression)",
          "question de grammaire (identifier sujet, verbes et temps, adjectif)",
          "réécriture d'une phrase (changement singulier/pluriel)",
        ],
      },
      {
        id: "production-ecrite",
        nom: "Production écrite",
        bareme: 20,
        formats: [
          "rédaction guidée (introduction / développement en 2 paragraphes / conclusion), 80 mots minimum, sur un sujet personnel ou de société",
        ],
      },
    ],
  },
  {
    key: "5eme-4eme",
    label: "5ème - 4ème",
    description: "Collégiens 5ème et 4ème",
    categories: [
      {
        id: "comprehension-orale",
        nom: "Compréhension orale",
        bareme: 20,
        formats: [
          "courts documents audio du quotidien avec QCM (3 choix)",
          "texte/transcription (vie d'ado) avec vrai/faux, QCM et questions ouvertes en phrases complètes",
        ],
      },
      {
        id: "comprehension-ecrite",
        nom: "Compréhension écrite",
        bareme: 20,
        formats: [
          "texte documentaire (animal, nature, science) accessible",
          "vrai/faux avec justification en citant le texte",
          "QCM à 4 choix sur le contenu",
          "questions ouvertes en s'appuyant sur le texte",
        ],
      },
      {
        id: "production-ecrite",
        nom: "Production écrite",
        bareme: 20,
        formats: [
          "fiche de présentation personnelle à compléter (prénom, adresse, goûts, qualité/défaut, rêve de métier)",
          "récit personnel guidé (rentrée scolaire, ressenti) d'au moins 70 mots",
        ],
      },
    ],
  },
  {
    key: "CE",
    label: "CE1 - CE2",
    description: "Écoliers CE1 et CE2",
    categories: [
      {
        id: "comprehension-orale",
        nom: "Compréhension orale",
        bareme: 20,
        formats: [
          "court audio/texte raconté avec questions simples",
        ],
      },
      {
        id: "comprehension-ecrite",
        nom: "Compréhension écrite",
        bareme: 20,
        formats: [
          "petit récit du quotidien (scène familiale, école) très court et simple",
          "vrai/faux",
          "QCM à 3 choix",
          "questions ouvertes très courtes",
        ],
      },
      {
        id: "production-ecrite",
        nom: "Production écrite",
        bareme: 20,
        formats: [
          "fiche d'inscription à compléter (prénom, adresse, anniversaire, fratrie, animal préféré, langues parlées)",
          "questions à partir d'images à décrire en phrases complètes",
        ],
      },
      {
        id: "dictee",
        nom: "Dictée",
        bareme: 10,
        formats: [
          "courte dictée d'une à deux phrases simples adaptées au niveau CE1-CE2",
        ],
      },
      {
        id: "production-orale",
        nom: "Production orale",
        bareme: 20,
        formats: [
          "consigne pour raconter une histoire à partir d'une suite d'images",
        ],
      },
    ],
  },
  {
    key: "CM-6eme",
    label: "CM1 - CM2 - 6ème",
    description: "Écoliers CM1, CM2 et élèves de 6ème",
    categories: [
      {
        id: "comprehension-orale",
        nom: "Compréhension orale",
        bareme: 20,
        formats: [
          "2 courts dialogues du quotidien scolaire (consignes, rendez-vous) avec QCM et questions ouvertes courtes",
        ],
      },
      {
        id: "comprehension-ecrite",
        nom: "Compréhension écrite",
        bareme: 20,
        formats: [
          "texte documentaire accessible (histoire, sciences, nature)",
          "vrai/faux",
          "QCM à cases multiples",
          "questions ouvertes en phrases complètes s'appuyant sur le texte",
        ],
      },
      {
        id: "production-ecrite",
        nom: "Production écrite",
        bareme: 20,
        formats: [
          "fiche de présentation personnelle à compléter",
          "récit personnel guidé (rentrée scolaire, ressenti) d'au moins 50 mots",
        ],
      },
      {
        id: "dictee",
        nom: "Dictée",
        bareme: 10,
        formats: [
          "dictée de quelques phrases adaptées au niveau CM1-CM2-6ème",
        ],
      },
    ],
  },
]

export function getNiveau(key: NiveauKey): Niveau | undefined {
  return NIVEAUX.find((n) => n.key === key)
}
