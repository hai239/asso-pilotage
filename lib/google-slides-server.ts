import { google, slides_v1 } from "googleapis"
import { getDriveClient, RAPPORTS_BROUILLONS_FOLDER_ID } from "@/lib/google-sheets-server"
import type { FormatRapport } from "@/lib/rapports-data"

export function getSlidesClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/presentations"],
  })
  return google.slides({ version: "v1", auth })
}

// Géométrie EMU d'une page 16:9 standard Slides (10in x 5.63in) et d'une page A4 portrait
// (210×297mm, 1mm = 36000 EMU), avec une marge de 0.5in / ~12.7mm.
const PAGE_WIDTH_EMU = 9144000
const PAGE_HEIGHT_EMU = 5143500
const A4_WIDTH_EMU = 7560000
const A4_HEIGHT_EMU = 10692000
const MARGE_EMU = 457200

function dimensionsPage(format: FormatRapport): { width: number; height: number } {
  return format === "a4" ? { width: A4_WIDTH_EMU, height: A4_HEIGHT_EMU } : { width: PAGE_WIDTH_EMU, height: PAGE_HEIGHT_EMU }
}

function slideObjectId(i: number) {
  return `slide-${i}`
}
function textboxObjectId(i: number) {
  return `textbox-${i}`
}

/** Crée (ou reconstruit) un Google Slides à N pages génériques — une zone de texte par
 * segment. Le nombre de diapositives est libre (défini par l'utilisateur via les lignes de
 * tirets dans le panneau gauche, voir lib/rapports-data.ts) : plutôt qu'un patch chirurgical
 * par position fixe, on reconstruit tout le deck à chaque checkpoint (Sauvegarder/Valider),
 * ce qui gère nativement l'ajout, la suppression et le réordonnancement de diapositives.
 * `presentationId` nul → création initiale (déplacée dans le dossier Drive des brouillons) ;
 * fourni → reconstruction (les pages existantes sont supprimées puis recréées).
 * `format` ne peut être choisi qu'à la création (l'API Slides ne permet pas de redimensionner
 * une présentation existante) : si le format demandé diffère de celui du fichier existant,
 * l'appelant (app/api/slides/route.ts) doit passer `presentationId: null` pour forcer une
 * nouvelle présentation plutôt que de réutiliser l'ancienne. */
export async function reconstruireSlides(
  presentationId: string | null,
  segments: string[],
  titre?: string,
  format: FormatRapport = "classique"
): Promise<{ presentationId: string; url: string }> {
  const slides = getSlidesClient()
  const requests: slides_v1.Schema$Request[] = []
  let id = presentationId
  let estNouveau = false
  const { width: pageWidth, height: pageHeight } = dimensionsPage(format)

  if (!id) {
    const creation = await slides.presentations.create({
      requestBody: {
        title: titre ?? "Rapport AREA",
        pageSize: {
          width: { magnitude: pageWidth, unit: "EMU" },
          height: { magnitude: pageHeight, unit: "EMU" },
        },
      },
    })
    id = creation.data.presentationId ?? null
    if (!id) throw new Error("Échec de création de la présentation Google Slides")
    estNouveau = true
    const idPageParDefaut = creation.data.slides?.[0]?.objectId
    if (idPageParDefaut) requests.push({ deleteObject: { objectId: idPageParDefaut } })
  } else {
    const existant = await slides.presentations.get({ presentationId: id })
    for (const page of existant.data.slides ?? []) {
      if (page.objectId) requests.push({ deleteObject: { objectId: page.objectId } })
    }
  }

  segments.forEach((segment, i) => {
    requests.push({
      createSlide: {
        objectId: slideObjectId(i),
        slideLayoutReference: { predefinedLayout: "BLANK" },
      },
    })
    requests.push({
      createShape: {
        objectId: textboxObjectId(i),
        shapeType: "TEXT_BOX",
        elementProperties: {
          pageObjectId: slideObjectId(i),
          size: {
            width: { magnitude: pageWidth - 2 * MARGE_EMU, unit: "EMU" },
            height: { magnitude: pageHeight - 2 * MARGE_EMU, unit: "EMU" },
          },
          transform: {
            scaleX: 1,
            scaleY: 1,
            translateX: MARGE_EMU,
            translateY: MARGE_EMU,
            unit: "EMU",
          },
        },
      },
    })
    requests.push({
      insertText: {
        objectId: textboxObjectId(i),
        insertionIndex: 0,
        text: segment.trim(),
      },
    })
  })

  await slides.presentations.batchUpdate({ presentationId: id, requestBody: { requests } })

  if (estNouveau && RAPPORTS_BROUILLONS_FOLDER_ID) {
    const drive = getDriveClient()
    await drive.files.update({
      fileId: id,
      addParents: RAPPORTS_BROUILLONS_FOLDER_ID,
      supportsAllDrives: true,
    })
  }

  return { presentationId: id, url: `https://docs.google.com/presentation/d/${id}/edit` }
}

function texteBrutDeLaForme(pageElement: slides_v1.Schema$PageElement | undefined): string {
  const elements = pageElement?.shape?.text?.textElements ?? []
  return elements.map((el) => el.textRun?.content ?? "").join("").replace(/\n$/, "")
}

/** Relit le Google Slides et renvoie le texte de chaque diapositive, dans l'ordre réel du
 * fichier — s'adapte nativement si des diapositives ont été ajoutées/retirées directement
 * dans Slides (ré-injection après modification externe, hors de l'application). */
export async function lireTextesRapport(presentationId: string): Promise<string[]> {
  const slides = getSlidesClient()
  const res = await slides.presentations.get({ presentationId })
  const pages = res.data.slides ?? []

  return pages.map((page) => {
    const el = page.pageElements?.find((pe) => pe.shape?.text)
    return texteBrutDeLaForme(el).trim()
  })
}
