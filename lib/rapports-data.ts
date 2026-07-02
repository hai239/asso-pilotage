// Module Rapports — Phase 1 (UI mockée, pas encore branchée Slides/Drive/IA réelle)

export interface ImpactCompetence {
  competence: string
  initial_100: number
  final_100: number
}

export interface RapportKPIs {
  exercice: string
  exercice_precedent: string
  kpis_generaux: {
    familles_accompagnees: number
    parents_inscrits: number
    eleves_inscrits: number
    rendez_vous_parents_profs: number
  }
  maillage_territorial: {
    total_etablissements: number
    ecoles_elementaires: number
    colleges: number
    lycees: number
  }
  profil_eleves: {
    repartition_elementaire_pourcent: number
    repartition_college_pourcent: number
    repartition_lycee_pourcent: number
  }
  impact_scolaire_eleves: ImpactCompetence[]
  impact_linguistique_parents: {
    progression_moyenne_pourcent: number
    repartition_niveaux_fin: Record<string, number>
  }
  ressources_humaines: {
    salaries_etp: number
    salaries_physiques: number
    benevoles_actifs: number
  }
  evenements_cles: string[]
  perspectives: string[]
}

// Pas de chargement dynamique de police (aucune infra pour extraire/charger la police exacte
// d'un document importé) : la "typographie" d'un template est approximée par un choix parmi
// ces 2 styles déjà disponibles dans l'app, consommés par components/rapports/SlidePreview.tsx.
export type StyleTypographique = "moderne" | "classique"

export const POLICES: Record<StyleTypographique, { titres: string; corps: string }> = {
  moderne: { titres: "Poppins, sans-serif", corps: "Lato, sans-serif" },
  classique: { titres: "Georgia, 'Times New Roman', serif", corps: "Georgia, serif" },
}

// 13 gabarits de diapositive au total : les 3 génériques d'origine + 10 gabarits inspirés des
// "master templates" AREA (PDF de référence fournis par l'utilisateur — ~10 composants
// réutilisés à travers leurs 50 dispositions). Voir components/rapports/SlidePreview.tsx pour
// le rendu de chacun.
export type Disposition =
  | "centre" | "bandeau" | "image-gauche"
  | "couverture" | "sommaire" | "separateur" | "kpi-cartes"
  | "tableau" | "barres-progression" | "territoire"
  | "temoignage" | "swot" | "cloture"

// Sac de champs optionnels et génériques, réutilisé par tous les gabarits (un seul contrat
// simple pour l'IA plutôt qu'un schéma par gabarit) — voir app/api/rapports-template/route.ts.
// Chaque gabarit ne consomme que les champs qui le concernent et se rabat sur le texte brut de
// la diapositive si `donnees` est absent ou incomplet.
export interface DonneesGabarit {
  titre?: string
  sousTitre?: string
  numero?: string
  items?: string[]
  items2?: string[]
  chiffres?: { valeur: string; label: string }[]
  citation?: string
  auteur?: string
}

export type FormatRapport = "classique" | "a4"
export const FORMAT_DEFAUT: FormatRapport = "classique"

// Mapping gabarit/données pour une diapositive donnée, tel que produit par l'IA lors de
// l'analyse d'un template (app/api/rapports-template/route.ts) — un élément par segment du
// rapport.
export interface GabaritDiapositive {
  index: number
  disposition: Disposition
  donnees?: DonneesGabarit
}

export interface StyleRapport {
  couleurPrincipale: string
  couleurAccent: string
  disposition: Disposition
  typographie: StyleTypographique
}

// Couleurs réelles de la charte AREA (extraites du logo et des rapports d'activité existants
// — cf. conversation, PDF de référence fournis par l'utilisateur) : vert sapin foncé et
// turquoise, pas le bleu marine utilisé dans les tout premiers mockups.
export const STYLE_DEFAUT: StyleRapport = {
  couleurPrincipale: "#0B4F4B",
  couleurAccent: "#1C9AA0",
  disposition: "centre",
  typographie: "moderne",
}

export interface Brouillon {
  id: string
  titre: string
  periodeDebut: string
  periodeFin: string
  modifieLe: string
  contenu: string
  slideId?: string
  slideUrl?: string
  style?: StyleRapport
  logoUrl?: string
  format?: FormatRapport
  // Gabarit/données par diapositive décidés lors de la génération initiale (dashboard, avant
  // qu'un écran d'édition n'existe pour porter cet état) — repris par la page d'édition au
  // chargement. Une fois en édition, l'état vif vit dans dispositionParDiapositive/
  // donneesGabaritParDiapositive (app/rapports/edition/[id]/page.tsx), pas ici.
  dispositionInitiale?: Record<number, Disposition>
  donneesGabaritInitiales?: Record<number, DonneesGabarit>
}

export interface RapportArchive {
  id: string
  titre: string
  dateGeneration: string
  periodeDebut: string
  periodeFin: string
  slideId?: string
  slideUrl?: string
}

export interface SectionTitles {
  creation: string
  brouillons: string
  historique: string
}

export const SECTION_TITLES_DEFAUT: SectionTitles = {
  creation: "Créer un nouveau rapport",
  brouillons: "Brouillons en cours",
  historique: "Historique des rapports générés",
}

export const RAPPORT_KPIS_MOCK: RapportKPIs = {
  exercice: "2023-2024",
  exercice_precedent: "2022-2023",
  kpis_generaux: {
    familles_accompagnees: 92,
    parents_inscrits: 94,
    eleves_inscrits: 58,
    rendez_vous_parents_profs: 26,
  },
  maillage_territorial: {
    total_etablissements: 30,
    ecoles_elementaires: 14,
    colleges: 10,
    lycees: 6,
  },
  profil_eleves: {
    repartition_elementaire_pourcent: 27.6,
    repartition_college_pourcent: 58.6,
    repartition_lycee_pourcent: 13.8,
  },
  impact_scolaire_eleves: [
    { competence: "Compréhension Orale", initial_100: 64, final_100: 83 },
    { competence: "Compréhension Écrite", initial_100: 48, final_100: 85 },
    { competence: "Expression Orale", initial_100: 41, final_100: 75 },
  ],
  impact_linguistique_parents: {
    progression_moyenne_pourcent: 33.75,
    repartition_niveaux_fin: { alpha: 12, "a1.1": 45, a1: 25, a2: 10, b1: 2 },
  },
  ressources_humaines: {
    salaries_etp: 2.0,
    salaries_physiques: 3,
    benevoles_actifs: 23,
  },
  evenements_cles: [
    "Déménagement dans les nouveaux locaux (octobre 2023)",
    "Création de l'atelier Théâtre",
  ],
  perspectives: [
    "Rejoindre le pôle associatif Rosa Parks",
    "Certification Qualiopi",
    "Essaimage territorial (Nantes Est, Saint-Nazaire)",
  ],
}

// Diapositives dynamiques : le nombre de diapositives n'est plus fixe (~40 pour un vrai
// rapport). L'utilisateur coupe lui-même le texte en diapositives en tapant une ligne de plus
// de 10 tirets sur sa propre ligne ; la supprimer refusionne les deux diapositives voisines.
// Ces lignes ne doivent JAMAIS apparaître dans l'aperçu ni dans le vrai Google Slides.
export const DELIMITEUR_RE = /^-{11,}$/

/** Découpe le texte brut en diapositives (segments), lignes-délimiteurs exclues. Aucun trim
 * au niveau des lignes lues depuis le panneau gauche (voir app/rapports/edition/[id]/page.tsx)
 * — seul l'affichage dans SlidePreview trim le résultat. Les segments vides sont conservés :
 * une diapositive vide apparaît dès qu'un délimiteur est tapé, même sans contenu après. */
export function decouperDiapositives(texte: string | undefined): string[] {
  const lignes = (texte ?? "").split("\n")
  const segments: string[][] = [[]]
  for (const ligne of lignes) {
    if (DELIMITEUR_RE.test(ligne.trim())) {
      segments.push([])
    } else {
      segments[segments.length - 1].push(ligne)
    }
  }
  return segments.map((lignesSegment) => lignesSegment.join("\n"))
}

export interface LigneTaguee {
  ligne: string
  segmentIndex: number
  delimiteur: boolean
}

/** Découpe le texte brut ligne par ligne (une ligne = un élément DOM du contentEditable) et
 * tague chaque ligne avec l'index de la diapositive à laquelle elle appartient, pour le
 * surlignage croisé dans le panneau gauche. Les lignes-délimiteurs restent affichées (donc
 * éditables/supprimables) mais taguées `delimiteur: true` — jamais surlignées comme contenu. */
export function tagLignesParSegment(texte: string): LigneTaguee[] {
  const lignes = texte.split("\n")
  let segmentIndex = 0
  return lignes.map((ligne) => {
    if (DELIMITEUR_RE.test(ligne.trim())) {
      const tag = { ligne, segmentIndex, delimiteur: true }
      segmentIndex += 1
      return tag
    }
    return { ligne, segmentIndex, delimiteur: false }
  })
}

export const SEPARATEUR_DIAPOSITIVES = `\n\n${"-".repeat(12)}\n\n`

// Trame des rapports d'activité réels de l'association (relevée sur les PDF de référence
// fournis par l'utilisateur) : 10 thèmes, dans cet ordre, que tout rapport généré doit aborder.
// Partagée avec app/api/rapports-generation/route.ts (génération IA du contenu complet).
export const THEMES_RAPPORT = [
  "Mot de la directrice",
  "Le parcours d'accompagnement des élèves",
  "Mesure d'impact — élèves",
  "Nos actions — élèves",
  "Le parcours d'accompagnement des parents",
  "Mesure d'impact — parents",
  "Nos actions — parents",
  "Interventions extérieures",
  "Vie associative",
  "Perspectives de développement",
] as const

export function titrePeriode(du: string, au: string): string {
  return `Rapport d'activité — période du ${du} au ${au}`
}

/** Génération déterministe (repli sans IA — voir lib/rapports-generation-api.ts pour la
 * génération IA, prioritaire). Couvre les 10 thèmes de `THEMES_RAPPORT` : les thèmes adossés à
 * des chiffres réels de RapportKPIs sont rédigés à partir de ces chiffres ; les autres reçoivent
 * un texte générique de repli, moins riche que ce que produirait l'IA. */
export function genererContenuBrouillon(kpis: RapportKPIs, du: string, au: string): string {
  return [
    titrePeriode(du, au),
    // Mot de la directrice
    `Cette année encore, AREA a joué son rôle de trait d'union dans le triangle de la réussite ` +
      `qui unit l'Élève, l'École et les Parents. ${kpis.kpis_generaux.familles_accompagnees} familles ` +
      `ont été accompagnées, dont ${kpis.kpis_generaux.parents_inscrits} parents inscrits et ` +
      `${kpis.kpis_generaux.eleves_inscrits} élèves suivis à travers nos ateliers.`,
    // Le parcours d'accompagnement des élèves
    `Chaque élève allophone accompagné bénéficie d'un parcours individualisé, de l'évaluation ` +
      `initiale de son niveau jusqu'à sa pleine inclusion scolaire, en lien constant avec les ` +
      `équipes pédagogiques des établissements partenaires.`,
    // Mesure d'impact — élèves
    `Sur le plan de l'accompagnement des élèves, les progressions sont notables : ` +
      kpis.impact_scolaire_eleves
        .map((c) => `${c.competence} passe de ${c.initial_100} à ${c.final_100} sur 100`)
        .join(", ") +
      `.`,
    // Nos actions — élèves
    `Ateliers FLE, méthodologie, numérique et théâtre rythment l'année pour consolider les ` +
      `apprentissages fondamentaux et l'estime de soi des élèves suivis.`,
    // Le parcours d'accompagnement des parents
    `Les parents sont accompagnés vers l'autonomie administrative et linguistique, avec des ` +
      `ateliers réguliers et une orientation vers les partenaires du territoire selon les besoins.`,
    // Mesure d'impact — parents
    `Côté autonomie des parents, la progression linguistique moyenne atteint ` +
      `${kpis.impact_linguistique_parents.progression_moyenne_pourcent}%, preuve de l'empowerment ` +
      `induit par nos ateliers de FLE.`,
    // Nos actions — parents
    `Cours de FLE, ateliers débats et sorties culturelles renforcent le lien social et ` +
      `l'autonomie administrative des familles accompagnées.`,
    // Interventions extérieures
    `AREA intervient également auprès des équipes éducatives et partenaires du territoire pour ` +
      `sensibiliser à l'accueil des élèves allophones et à la coéducation.`,
    // Vie associative
    `L'association s'appuie sur ${kpis.ressources_humaines.salaries_physiques} salariés ` +
      `(${kpis.ressources_humaines.salaries_etp} ETP) et ${kpis.ressources_humaines.benevoles_actifs} ` +
      `bénévoles actifs. Temps forts de l'année : ${kpis.evenements_cles.join(" · ")}.`,
    // Perspectives de développement
    `Perspectives : ${kpis.perspectives.join(" · ")}.`,
  ].join(SEPARATEUR_DIAPOSITIVES)
}

/** Migration auto : les brouillons créés avant l'introduction des lignes-délimiteurs (voir
 * ci-dessus) séparaient encore leurs sections par une simple ligne vide — sans délimiteur,
 * `decouperDiapositives` ne renvoie alors qu'un seul segment (symptôme : une seule diapositive
 * s'affiche). On convertit ce texte hérité vers le nouveau format au chargement. */
export function migrerContenuBrouillon(contenu: string): string {
  if (decouperDiapositives(contenu).length > 1) return contenu
  const paragraphes = contenu.split("\n\n").map((p) => p.trim()).filter(Boolean)
  return paragraphes.length > 1 ? paragraphes.join(SEPARATEUR_DIAPOSITIVES) : contenu
}

export const STORAGE_BROUILLONS = "asso-rapports-brouillons"
export const STORAGE_HISTORIQUE = "asso-rapports-historique"
export const STORAGE_SECTIONS = "asso-rapports-sections"

export const BROUILLONS_MOCK: Brouillon[] = [
  {
    id: "b1",
    titre: "Rapport annuel 2023-2024",
    periodeDebut: "2023-09-01",
    periodeFin: "2024-06-30",
    modifieLe: "2024-07-02",
    contenu: genererContenuBrouillon(RAPPORT_KPIS_MOCK, "01/09/2023", "30/06/2024"),
  },
]

export const HISTORIQUE_MOCK: RapportArchive[] = [
  {
    id: "h1",
    titre: "Rapport annuel 2022-2023",
    dateGeneration: "2023-07-10",
    periodeDebut: "2022-09-01",
    periodeFin: "2023-06-30",
  },
]

export function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try {
    const s = localStorage.getItem(key)
    return s ? JSON.parse(s) : fallback
  } catch {
    return fallback
  }
}

export function save<T>(key: string, v: T) {
  localStorage.setItem(key, JSON.stringify(v))
}
