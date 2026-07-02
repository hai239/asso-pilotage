import { NextResponse } from "next/server"
import { getServerUser } from "@/lib/supabase/server"
import { getSlidesClient } from "@/lib/google-slides-server"
import { listerFichiersDriveDossier, RAPPORTS_TEMPLATES_FOLDER_ID } from "@/lib/google-sheets-server"
import type { Disposition, DonneesGabarit, GabaritDiapositive } from "@/lib/rapports-data"

const GEMINI_MODEL = "gemini-2.5-flash"

type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } }

// Appel Gemini (fetch natif, comme le reste de l'app) attendant une réponse JSON.
// Renvoie le JSON parsé ; lève une erreur en cas d'échec HTTP ou de réponse vide.
async function callGemini<T>(parts: GeminiPart[], maxOutputTokens: number): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY
  const payload = {
    contents: [{ parts }],
    generationConfig: { responseMimeType: "application/json", maxOutputTokens },
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Gemini ${res.status} : ${await res.text()}`)
  const result = await res.json()
  const rawText = result?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!rawText) throw new Error("réponse Gemini vide")
  return JSON.parse(rawText) as T
}

// POST /api/rapports-template
// Actions IA pour le module Rapports : analyse d'un document de référence (PDF ou Google Slides
// existant) pour en extraire un style (couleurs + typographie + disposition, jamais le contenu
// factuel) et un mapping gabarit/données par diapositive ; choix de la disposition la plus
// graphique pour une diapositive donnée (après ajout d'une photo) ; menu de suggestions
// visuelles esthétiques pour une diapositive sélectionnée. Voir CLAUDE.md § Module Rapports.

type Typographie = "moderne" | "classique"

export interface StyleAnalyse {
  couleurPrincipale: string
  couleurAccent: string
  disposition: Disposition
  typographie: Typographie
}

const DIRECTEUR_COMMUNICATION = `Tu es un directeur de communication expérimenté au sein d'une association (AREA, coéducation/allophonie). On te soumet un document de référence (charte graphique, ancien rapport, présentation existante) pour que tu en extraies l'ADN visuel à réappliquer à un nouveau rapport d'activité. Exprime-toi avec l'assurance et le jugement d'un professionnel du secteur — explique brièvement et concrètement ce que tu retiens et pourquoi, sans jargon creux.`

// Les 13 gabarits de diapositive disponibles côté rendu (components/rapports/SlidePreview.tsx)
// — description de leur usage, embarquée dans les prompts pour que l'IA choisisse le plus
// adapté au contenu de chaque diapositive.
const GABARITS_DISPONIBLES = `- "centre" : texte centré, générique, pour un contenu simple sans structure particulière.
- "bandeau" : bandeau de couleur/photo en haut + texte dessous.
- "image-gauche" : image à gauche, texte à droite.
- "couverture" : page de titre avec grand titre encadré de crochets stylisés — pour la toute première diapositive du rapport.
- "sommaire" : grille de 3-4 cartes numérotées — pour une diapositive qui liste des sections/thèmes à venir.
- "separateur" : fond plein coloré avec un gros numéro + titre — pour marquer le début d'une nouvelle partie.
- "kpi-cartes" : jusqu'à 3 pastilles rondes avec un chiffre clé + un libellé — pour un contenu qui cite des chiffres précis et marquants.
- "tableau" : tableau à 2 colonnes (élément/valeur) — pour un contenu qui liste plusieurs éléments avec une valeur chacun.
- "barres-progression" : barres horizontales avec pourcentages — pour un contenu qui évoque une progression/évolution chiffrée.
- "territoire" : carte + liste de zones avec description — pour un contenu qui évoque une répartition géographique/par zones/établissements.
- "temoignage" : citation en grand + auteur — pour un verbatim/témoignage rapporté.
- "swot" : grille 2×2 (forces/faiblesses/opportunités/menaces) — pour un contenu de diagnostic/bilan à 4 facettes.
- "cloture" : fond sombre plein, titre de conclusion/remerciement — pour la toute dernière diapositive du rapport.`

function schemaDonneesGabarit(): string {
  return `{"titre"?:"...","sousTitre"?:"...","numero"?:"...","items"?:["..."],"items2"?:["..."],"chiffres"?:[{"valeur":"...","label":"..."}],"citation"?:"...","auteur"?:"..."}`
}

function schemaStyle(avecGabarits: boolean): string {
  const base = `"style":{"couleurPrincipale":"#RRGGBB","couleurAccent":"#RRGGBB","disposition":"...","typographie":"moderne|classique"},"message":"..."`
  if (!avecGabarits) return `{${base}}`
  return `{${base},"gabarits":[{"index":0,"disposition":"...","donnees":${schemaDonneesGabarit()}}, ...]}`
}

function consigneSegments(segments?: string[]): string {
  if (!segments?.length) return ""
  return `\nVoici le contenu déjà rédigé du rapport en cours (une diapositive par élément), pour te donner le contexte de densité/nature du contenu à styliser :\n${JSON.stringify(segments)}\nAssemble ce template avec ce contenu de la façon la plus graphique possible.\n⚠️ Règle stricte : ce document de référence ne doit influencer QUE le style visuel et la mise en page (couleurs, disposition, typographie, gabarits). Tu ne dois JAMAIS reprendre, mélanger ou laisser transparaître un fait, un chiffre, une date ou un texte propre à ce document — le contenu du rapport ci-dessus reste strictement celui de la période sélectionnée par l'utilisateur, intact.`
}

function consigneGabarits(segments?: string[]): string {
  if (!segments?.length) return ""
  return `\nEnsuite, pour CHAQUE diapositive du rapport (index 0 à ${segments.length - 1}), choisis le gabarit le plus adapté à son contenu parmi :\n${GABARITS_DISPONIBLES}\nEt extrais les champs structurés pertinents à partir du texte EXISTANT de cette diapositive (ne jamais inventer de nouveaux chiffres/faits — seulement reformuler/structurer ce qui existe déjà) selon ce schéma (tous les champs sont optionnels, n'inclus que ceux pertinents pour le gabarit choisi) :\n${schemaDonneesGabarit()}\nInclus un tableau "gabarits" dans ta réponse, un élément par diapositive, dans l'ordre.`
}

function consigneStyle(avecGabarits: boolean): string {
  return `Détermine :
- une couleur principale (hex),
- une couleur d'accent (hex),
- la disposition dominante par défaut du deck, à choisir parmi :
${GABARITS_DISPONIBLES}
- la typographie la plus proche parmi deux styles disponibles : "moderne" (géométrique, type Poppins — sobre et contemporain) ou "classique" (serif, type Georgia — institutionnel).
Respecte strictement la disposition, la typographie et le code couleur du document fourni. Ignore tout contenu factuel (texte, chiffres, dates) de ce document — seul son style visuel t'intéresse.${avecGabarits ? "" : ""}`
}

async function analyserPdf(base64: string, instruction: string | undefined, segments: string[] | undefined): Promise<{ style: StyleAnalyse; message: string; gabarits?: GabaritDiapositive[] }> {
  const consigne = instruction?.trim()
    ? `Consigne de l'utilisateur à respecter en priorité : "${instruction.trim()}"`
    : "Aucune consigne précise : fais le choix le plus pertinent de façon autonome et explique-le."
  const avecGabarits = Boolean(segments?.length)

  return callGemini([
    { inlineData: { mimeType: "application/pdf", data: base64 } },
    {
      text: `${DIRECTEUR_COMMUNICATION}

Analyse ce document. ${consigneStyle(avecGabarits)}
${consigneSegments(segments)}
${consigneGabarits(segments)}

${consigne}

Réponds UNIQUEMENT avec un JSON de cette forme, sans markdown :
${schemaStyle(avecGabarits)}`,
    },
  ], 4096)
}

async function analyserSlides(presentationId: string, instruction: string | undefined, segments: string[] | undefined): Promise<{ style: StyleAnalyse; message: string; gabarits?: GabaritDiapositive[] }> {
  const slides = getSlidesClient()
  const res = await slides.presentations.get({ presentationId })
  const page = res.data.slides?.[0]

  const fondPage = page?.pageProperties?.pageBackgroundFill?.solidFill?.color?.rgbColor
  const couleursFormes = (page?.pageElements ?? [])
    .map((pe) => pe.shape?.shapeProperties?.shapeBackgroundFill?.solidFill?.color?.rgbColor)
    .filter(Boolean)

  const description = `Fond de la première page : ${JSON.stringify(fondPage) || "non défini"}. ` +
    `Couleurs de remplissage des formes trouvées : ${JSON.stringify(couleursFormes)}.`

  const consigne = instruction?.trim()
    ? `Consigne de l'utilisateur à respecter en priorité : "${instruction.trim()}"`
    : "Aucune consigne précise : fais le choix le plus pertinent de façon autonome et explique-le."
  const avecGabarits = Boolean(segments?.length)

  return callGemini([{
    text: `${DIRECTEUR_COMMUNICATION}

Voici les données brutes extraites d'une présentation Google Slides de référence (couleurs en RGB 0-1) :
${description}

À partir de ces éléments (et de ton expérience si les données sont incomplètes), ${consigneStyle(avecGabarits)}
${consigneSegments(segments)}
${consigneGabarits(segments)}

${consigne}

Réponds UNIQUEMENT avec un JSON de cette forme, sans markdown :
${schemaStyle(avecGabarits)}`,
  }], 4096)
}

interface SuggestionVisuelle {
  disposition: Disposition
  donnees?: DonneesGabarit
  label: string
  description: string
}

/** Propose plusieurs visuels esthétiques pour la diapositive sélectionnée, en croisant le
 * style actuel du rapport (issu du template importé s'il y en a un, ou du style par défaut)
 * avec le contenu propre à cette diapositive — affichés en menu, l'utilisateur choisit lequel
 * appliquer (voir components/rapports/AiChatPanel.tsx). */
async function suggererVisuels(
  slideIndex: number,
  texteSlide: string,
  aUneImage: boolean,
  style: StyleAnalyse
): Promise<{ suggestions: SuggestionVisuelle[] }> {
  return callGemini([{
    text: `${DIRECTEUR_COMMUNICATION}

Style actuel du rapport (issu d'un template importé s'il y en a un, sinon du style par défaut) : couleur principale ${style.couleurPrincipale}, couleur d'accent ${style.couleurAccent}, typographie ${style.typographie}.
Diapositive n°${slideIndex + 1}, texte actuel : "${texteSlide || "(vide)"}"${aUneImage ? " (contient déjà une image)" : ""}.

Gabarits disponibles :
${GABARITS_DISPONIBLES}

Propose les 3 gabarits les plus esthétiques et pertinents pour CE contenu précis (pas forcément 3 gabarits différents dans l'absolu, mais les 3 meilleurs choix pour cette diapositive). Pour chacun, un label court et accrocheur, une description d'une phrase, et si le gabarit s'y prête, extrais les champs structurés pertinents à partir du texte existant (jamais inventer de chiffres) selon ce schéma optionnel : ${schemaDonneesGabarit()}. Ordonne du plus recommandé au moins recommandé.

Réponds UNIQUEMENT avec un JSON de cette forme, sans markdown :
{"suggestions":[{"disposition":"...","donnees":${schemaDonneesGabarit()},"label":"...","description":"..."}, ...]} (exactement 3 éléments)`,
  }], 1536)
}

interface SuggestionStyleGlobal extends StyleAnalyse {
  label: string
  description: string
  gabarits?: GabaritDiapositive[]
}

/** Liste les Google Slides du dossier Drive "Templates" dédié (bibliothèque de templates —
 * voir components/rapports/AiChatPanel.tsx / app/rapports/edition/[id]/page.tsx). Tableau vide
 * si le dossier n'est pas configuré, jamais d'erreur. */
async function listerTemplatesDrive(): Promise<{ templates: { id: string; nom: string }[] }> {
  const templates = await listerFichiersDriveDossier(RAPPORTS_TEMPLATES_FOLDER_ID, "application/vnd.google-apps.presentation")
  return { templates }
}

/** Propose plusieurs variations de style pour l'ensemble du rapport (pas une seule diapositive)
 * — mêmes principes que `suggererVisuels`, à l'échelle du deck entier, avec mapping gabarit
 * par diapositive pour la variation retenue. */
async function suggererStylesGlobaux(
  segments: string[],
  styleActuel: StyleAnalyse
): Promise<{ suggestions: SuggestionStyleGlobal[] }> {
  return callGemini([{
    text: `${DIRECTEUR_COMMUNICATION}

Style actuel du rapport : couleur principale ${styleActuel.couleurPrincipale}, couleur d'accent ${styleActuel.couleurAccent}, disposition ${styleActuel.disposition}, typographie ${styleActuel.typographie}.
Contenu du rapport entier (une diapositive par élément, index 0 à ${segments.length - 1}) : ${JSON.stringify(segments)}.

Gabarits disponibles pour chaque diapositive :
${GABARITS_DISPONIBLES}

En te basant sur la nature globale de ce contenu, propose 3 variations de style **complètes et distinctes** pour l'ensemble du rapport — chacune avec sa propre couleur principale (hex), couleur d'accent (hex), disposition dominante par défaut, typographie, un label court, une description d'une phrase, ET pour CHAQUE diapositive (index 0 à ${segments.length - 1}) le gabarit le plus adapté avec ses données structurées extraites du texte existant (schéma ${schemaDonneesGabarit()}, jamais inventer de chiffres). Ordonne du plus recommandé au moins recommandé.

Réponds UNIQUEMENT avec un JSON de cette forme, sans markdown, exactement 3 suggestions :
{"suggestions":[{"couleurPrincipale":"#RRGGBB","couleurAccent":"#RRGGBB","disposition":"...","typographie":"moderne|classique","label":"...","description":"...","gabarits":[{"index":0,"disposition":"...","donnees":${schemaDonneesGabarit()}}, ...]}, ...]}`,
  }], 4096)
}

async function choisirDisposition(
  slideIndex: number,
  texteSlide: string,
  aUneImage: boolean,
  instruction: string | undefined
): Promise<{ disposition: "centre" | "bandeau" | "image-gauche"; message: string }> {
  return callGemini([{
    text: `${DIRECTEUR_COMMUNICATION}

Une photo vient d'être ajoutée à la diapositive n°${slideIndex + 1}, dont voici le texte actuel :
"${texteSlide || "(vide)"}"
${aUneImage ? "Cette diapositive contient désormais une image." : ""}
${instruction?.trim() ? `Consigne de l'utilisateur : "${instruction.trim()}"` : "Aucune consigne précise."}

Choisis la disposition la plus graphique pour cette diapositive précise, strictement parmi : "centre" (photo en médaillon au-dessus du texte, pour un texte dense), "bandeau" (photo en bandeau au-dessus, pour un texte court/percutant), "image-gauche" (photo en pleine hauteur à gauche, texte à droite, pour une mise en valeur forte de l'image).

Réponds UNIQUEMENT avec un JSON de cette forme, sans markdown :
{"disposition": "centre|bandeau|image-gauche", "message": "..."}`,
  }], 512)
}

export async function POST(request: Request) {
  if (!(await getServerUser())) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 })
  }
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY non configurée. Ajoutez votre clé dans .env.local." },
      { status: 500 }
    )
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 })
  }

  try {
    switch (body.action) {
      case "analyserTemplate": {
        const source = body.source as { type: "pdf"; base64: string } | { type: "slides"; presentationId: string }
        const instruction = body.instruction as string | undefined
        const segments = body.segments as string[] | undefined
        const resultat = source.type === "pdf"
          ? await analyserPdf(source.base64, instruction, segments)
          : await analyserSlides(source.presentationId, instruction, segments)
        return NextResponse.json(resultat)
      }
      case "suggererVisuels": {
        const { slideIndex, texteSlide, aUneImage, style } = body as {
          slideIndex: number
          texteSlide: string
          aUneImage: boolean
          style: StyleAnalyse
        }
        return NextResponse.json(await suggererVisuels(slideIndex, texteSlide, aUneImage, style))
      }
      case "choisirDisposition": {
        const { slideIndex, texteSlide, aUneImage, instruction } = body as {
          slideIndex: number
          texteSlide: string
          aUneImage: boolean
          instruction?: string
        }
        return NextResponse.json(await choisirDisposition(slideIndex, texteSlide, aUneImage, instruction))
      }
      case "listerTemplatesDrive": {
        return NextResponse.json(await listerTemplatesDrive())
      }
      case "suggererStylesGlobaux": {
        const { segments, styleActuel } = body as { segments: string[]; styleActuel: StyleAnalyse }
        return NextResponse.json(await suggererStylesGlobaux(segments, styleActuel))
      }
      default:
        return NextResponse.json({ error: `Action inconnue : ${body.action}` }, { status: 400 })
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erreur inconnue"
    return NextResponse.json({ error: `Erreur Gemini : ${msg}` }, { status: 500 })
  }
}
