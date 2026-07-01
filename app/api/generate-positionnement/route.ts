import { NextResponse } from "next/server"
import { getServerUser } from "@/lib/supabase/server"
import { getNiveau, type NiveauKey } from "@/lib/positionnement-data"
import {
  getSheetsClient,
  uploadToDrive,
  makeFilePublic,
  POSITIONNEMENT_FOLDER_ID,
  sheetToObjects,
  appendRow,
  deleteRowsWhere,
  nextId,
  getHeaders,
  SPREADSHEET_ID,
} from "@/lib/google-sheets-server"

// POST /api/generate-positionnement
// Génère le contenu d'une catégorie d'exercices d'un test de positionnement via Gemini.
// Pour la compréhension orale : génère aussi la transcription et la synthétise en audio (TTS).
// Body : GeneratePositionnementRequest
// Response : GeneratePositionnementResponse

const GEMINI_TEXT_MODEL = "gemini-2.5-flash"
const GEMINI_TTS_MODEL = "gemini-2.5-flash-preview-tts"
const GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image"
const ORAL_CATEGORIE_ID = "comprehension-orale"

// Le modèle ne dessine plus lui-même les pointillés (il pouvait en générer des milliers
// en boucle) : il pose une balise [[LIGNE]] qu'on remplace ici par une ligne de taille fixe.
const LIGNE_REPONSE_TAG = "[[LIGNE]]"
const LIGNE_REPONSE = ".".repeat(90)
const POSITIONNEMENT_SHEET = "POSITIONNEMENT"
const SHEET_HEADERS = ["ID", "Niveau", "Categorie_ID", "Date", "Contenu", "Transcription", "Audio_URL", "Image_URL"]

export interface GeneratePositionnementRequest {
  niveau: NiveauKey
  categorieId: string
}

export interface GeneratePositionnementResponse {
  contenu: string
  /** Transcription du document audio (catégorie compréhension orale uniquement) */
  transcription?: string
  /** Audio synthétisé, encodé en data URI (audio/wav), prêt pour <audio src=...> */
  audio?: string
  /** Présent si la synthèse vocale a échoué — l'exercice texte reste utilisable */
  audioError?: string
  /** Image illustrative encodée en data URI (image/png), contextuelle au contenu de l'exercice */
  image?: string
  /** Présent si la génération d'image a échoué — l'exercice reste utilisable */
  imageError?: string
}

function buildTextPrompt(niveauKey: NiveauKey, categorieId: string): string | null {
  const niveau = getNiveau(niveauKey)
  const categorie = niveau?.categories.find((c) => c.id === categorieId)
  if (!niveau || !categorie) return null

  const consigneAudio =
    categorieId === ORAL_CATEGORIE_ID
      ? `- Ne rédige pas de transcription dans ce texte : elle sera générée séparément et lue par un audio. Indique simplement en haut "Écoutez l'enregistrement puis répondez aux questions."`
      : `- N'invente pas de lien audio ; si un document oral est nécessaire, écris la transcription que le formateur lira à voix haute, précédée de "Transcription à lire :".`

  return `Tu rédiges un exercice de test de positionnement en français langue étrangère / français pour l'association AREA Nantes.

Public : ${niveau.description} (niveau ${niveau.label})
Catégorie d'exercice : ${categorie.nom} (noté sur ${categorie.bareme})

Formats attendus pour cette catégorie, à utiliser pour composer l'exercice (varie le thème à chaque génération, choisis un sujet du quotidien différent) :
${categorie.formats.map((f) => `- ${f}`).join("\n")}

Consignes :
- Rédige uniquement le contenu de l'exercice (consignes + questions), prêt à être imprimé.
- Adapte la difficulté du vocabulaire et de la syntaxe précisément au public visé.
${consigneAudio}
- Numérote les questions clairement.
- Quand une réponse écrite est attendue, indique l'espace de réponse en écrivant la balise ${LIGNE_REPONSE_TAG} seule sur sa propre ligne, une fois par ligne de réponse nécessaire (par exemple 1 balise pour une réponse courte, 6 à 10 balises pour une production écrite d'environ 80 mots). N'écris JAMAIS toi-même de points de suspension, de tirets ou de pointillés pour figurer l'espace de réponse — utilise uniquement cette balise.
- N'utilise AUCUN symbole de mise en forme Markdown : pas d'astérisques (* ou **) pour le gras/italique, pas de dièse (#) pour les titres. Pour une liste, écris chaque élément sur sa propre ligne précédé d'un simple tiret suivi d'une espace ("- élément"), jamais d'astérisque.
- N'inclus ni corrigé ni barème détaillé par question, seulement les exercices.
- Réponds UNIQUEMENT avec le texte de l'exercice, prêt à être imprimé tel quel. N'ajoute aucun commentaire, aucune explication de ton raisonnement, aucune analyse de la consigne, ni en français ni en anglais, avant ou après le texte de l'exercice.`
}

function buildTranscriptionPrompt(niveauKey: NiveauKey, exerciceContenu: string): string {
  const niveau = getNiveau(niveauKey)!
  return `Voici un exercice de compréhension orale destiné à ${niveau.description} (niveau ${niveau.label}) :

"""
${exerciceContenu}
"""

Rédige la transcription du document audio qui doit être lu/écouté pour répondre à ces questions.
Contraintes :
- Le contenu doit permettre de répondre précisément à chaque question de l'exercice ci-dessus.
- Vocabulaire et débit adaptés au public visé (phrases courtes pour les niveaux débutants/jeunes enfants).
- Style oral naturel (dialogue, message, annonce ou récit court selon le contexte de l'exercice), 60 à 180 mots.
- Réponds uniquement avec le texte à dire à voix haute, sans titre, sans guillemets, sans markdown.`
}

async function callGeminiText(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TEXT_MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        // Désactive le mode "réflexion" : sans ça, le raisonnement interne du modèle
        // peut fuiter dans le texte de sortie au lieu d'en être exclu.
        generationConfig: { thinkingConfig: { thinkingBudget: 0 } },
      }),
    }
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message ?? `HTTP ${res.status}`)

  const parts: { text?: string; thought?: boolean }[] = data?.candidates?.[0]?.content?.parts ?? []
  const raw = parts.filter((p) => !p.thought).map((p) => p.text ?? "").join("")
  return raw.trim()
}

/**
 * Remplace la balise [[LIGNE]] par une ligne de pointillés de taille fixe et retire
 * le markdown résiduel (gras/italique/dièse) que le modèle ajoute parfois malgré la consigne.
 */
function sanitizeExercice(text: string): string {
  return text
    .split("\n")
    .map((line) => (line.trim() === LIGNE_REPONSE_TAG ? LIGNE_REPONSE : line))
    .join("\n")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/(?<!\w)\*(\S.*?)\*(?!\w)/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*\*\s+/gm, "- ")
}

/**
 * Demande à Gemini de décrire l'image qui devrait illustrer l'exercice.
 * Retourne un prompt en anglais pour Imagen, ou null si aucune image n'est pertinente.
 */
async function buildImagePrompt(apiKey: string, niveauKey: NiveauKey, categorieId: string, exerciceContenu: string): Promise<string | null> {
  const niveau = getNiveau(niveauKey)!
  const categorie = niveau.categories.find((c) => c.id === categorieId)!

  const prompt = `You are helping generate a language learning test for French learners (level: ${niveau.label}, category: ${categorie.nom}).

Here is the exercise text:
"""
${exerciceContenu}
"""

Does this exercise require students to look at an image to answer the questions (e.g., a photo, a document, a map, a flyer, a price list, a schedule, etc.)?

If YES: Write a detailed image generation prompt in English (max 80 words) describing exactly what the image should show so that students can answer the exercise questions. The image must be:
- A realistic, photographic-style scene or document
- Appropriate for a language school classroom (no violence, no adult content)
- Directly relevant to the exercise scenario and questions
- Rich in the specific details the questions ask about

If NO image is needed (e.g. the exercise is pure grammar, dictation, or has all information in the text): reply exactly with the word NO_IMAGE and nothing else.

Reply with ONLY the image prompt OR the word NO_IMAGE. No explanation.`

  const result = await callGeminiText(apiKey, prompt)
  const trimmed = result.trim()
  if (!trimmed || trimmed === "NO_IMAGE" || trimmed.startsWith("NO_IMAGE")) return null
  return trimmed
}

/** Génère une image via Gemini. Retourne le base64 brut et le mimeType (prêt pour upload Drive). */
async function generateImageBase64(apiKey: string, imagePrompt: string): Promise<{ base64: string; mimeType: string }> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: imagePrompt }] }],
        generationConfig: { responseModalities: ["IMAGE"] },
      }),
    }
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message ?? `Gemini Image HTTP ${res.status}`)

  const parts = data?.candidates?.[0]?.content?.parts ?? []
  const imagePart = parts.find((p: { inlineData?: { mimeType?: string; data?: string } }) => p.inlineData?.data)
  if (!imagePart) throw new Error("Aucune image renvoyée par Gemini.")

  return { base64: imagePart.inlineData.data, mimeType: imagePart.inlineData.mimeType ?? "image/png" }
}

/** Initialise les en-têtes de l'onglet POSITIONNEMENT s'ils sont absents. */
async function ensurePositionnementHeaders(): Promise<void> {
  const sheets = getSheetsClient()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${POSITIONNEMENT_SHEET}!1:1`,
  })
  const existing = (res.data.values?.[0] as string[]) ?? []
  if (existing.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${POSITIONNEMENT_SHEET}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [SHEET_HEADERS] },
    })
  }
}

/** Supprime les anciens fichiers Drive d'une ligne existante et remplace la ligne dans Sheets. */
async function upsertPositionnementRow(data: {
  niveau: string
  categorieId: string
  contenu: string
  transcription?: string
  audioUrl?: string
  imageUrl?: string
}): Promise<void> {
  await ensurePositionnementHeaders()
  const sheets = getSheetsClient()
  const rows = await sheetToObjects(sheets, POSITIONNEMENT_SHEET)

  // Supprime les lignes existantes pour ce niveau + catégorie
  const existing = rows.filter(
    (r) => String(r["Niveau"]) === data.niveau && String(r["Categorie_ID"]) === data.categorieId
  )
  if (existing.length > 0) {
    const ids = existing.map((r) => String(r["ID"]))
    await deleteRowsWhere(sheets, POSITIONNEMENT_SHEET, "ID", ids)
  }

  const id = await nextId(sheets, POSITIONNEMENT_SHEET)
  const headers = await getHeaders(sheets, POSITIONNEMENT_SHEET)
  const row: Record<string, unknown> = {
    "ID": id,
    "Niveau": data.niveau,
    "Categorie_ID": data.categorieId,
    "Date": new Date().toISOString().split("T")[0],
    "Contenu": data.contenu,
    "Transcription": data.transcription ?? "",
    "Audio_URL": data.audioUrl ?? "",
    "Image_URL": data.imageUrl ?? "",
  }
  const values = headers.map((h) => (row[h] !== undefined ? String(row[h]) : ""))
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: POSITIONNEMENT_SHEET,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [values] },
  })
}

/** Convertit un buffer PCM 16-bit brut en fichier WAV (ajout de l'en-tête). */
function pcmToWav(pcm: Buffer, sampleRate: number, channels = 1, bitsPerSample = 16): Buffer {
  const blockAlign = (channels * bitsPerSample) / 8
  const byteRate = sampleRate * blockAlign
  const header = Buffer.alloc(44)
  header.write("RIFF", 0)
  header.writeUInt32LE(36 + pcm.length, 4)
  header.write("WAVE", 8)
  header.write("fmt ", 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20) // PCM
  header.writeUInt16LE(channels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(bitsPerSample, 34)
  header.write("data", 36)
  header.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([header, pcm])
}

/** Synthétise l'audio et retourne le WAV encodé en base64 (prêt pour upload Drive). */
async function synthesizeAudioBase64(apiKey: string, text: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TTS_MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
          },
        },
      }),
    }
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message ?? `HTTP ${res.status}`)

  const part = data?.candidates?.[0]?.content?.parts?.[0]
  const base64Pcm: string | undefined = part?.inlineData?.data
  const mimeType: string = part?.inlineData?.mimeType ?? "audio/L16;rate=24000"
  if (!base64Pcm) throw new Error("Aucun audio renvoyé par Gemini.")

  const rateMatch = mimeType.match(/rate=(\d+)/)
  const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000

  const pcm = Buffer.from(base64Pcm, "base64")
  const wav = pcmToWav(pcm, sampleRate)
  return wav.toString("base64")
}

export async function POST(request: Request) {
  if (!(await getServerUser())) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 })
  }
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey || apiKey.startsWith("VOTRE")) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY non configurée. Ajoutez votre clé dans .env.local." },
      { status: 500 }
    )
  }

  let body: GeneratePositionnementRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 })
  }

  if (!body.niveau || !body.categorieId) {
    return NextResponse.json({ error: "Champs requis manquants (niveau, categorieId)." }, { status: 400 })
  }

  const prompt = buildTextPrompt(body.niveau, body.categorieId)
  if (!prompt) {
    return NextResponse.json({ error: "Niveau ou catégorie inconnu." }, { status: 400 })
  }

  try {
    const contenuBrut = await callGeminiText(apiKey, prompt)
    const contenu = sanitizeExercice(contenuBrut)
    const response: GeneratePositionnementResponse = { contenu }

    if (body.categorieId === ORAL_CATEGORIE_ID) {
      try {
        const transcription = await callGeminiText(apiKey, buildTranscriptionPrompt(body.niveau, contenu))
        response.transcription = transcription
        const audioBase64 = await synthesizeAudioBase64(apiKey, transcription)
        const cat = getNiveau(body.niveau)?.categories.find((c: { id: string }) => c.id === body.categorieId)
        const today = new Date().toISOString().split("T")[0]
        const audioNom = `Audio-${body.niveau}-${cat?.nom ?? body.categorieId}-${today}.wav`
        const { fileId } = await uploadToDrive(
          audioNom,
          "audio/wav",
          audioBase64,
          POSITIONNEMENT_FOLDER_ID
        )
        response.audio = await makeFilePublic(fileId)
      } catch (err: unknown) {
        response.audioError = err instanceof Error ? err.message : "Échec de la génération audio."
      }
    }

    // Génération d'image contextuelle — non bloquante
    try {
      const imagePrompt = await buildImagePrompt(apiKey, body.niveau, body.categorieId, contenu)
      if (imagePrompt) {
        const { base64: imageBase64, mimeType: imageMime } = await generateImageBase64(apiKey, imagePrompt)
        const ext = imageMime.includes("png") ? "png" : "jpg"
        const { fileId } = await uploadToDrive(
          `image-${body.niveau}-${body.categorieId}-${Date.now()}.${ext}`,
          imageMime,
          imageBase64,
          POSITIONNEMENT_FOLDER_ID
        )
        response.image = await makeFilePublic(fileId)
      }
    } catch (err: unknown) {
      response.imageError = err instanceof Error ? err.message : "Échec de la génération d'image."
    }

    // Sauvegarde dans Google Sheets (non bloquante si échec)
    try {
      await upsertPositionnementRow({
        niveau: body.niveau,
        categorieId: body.categorieId,
        contenu,
        transcription: response.transcription,
        audioUrl: response.audio,
        imageUrl: response.image,
      })
    } catch (err: unknown) {
      console.error("[positionnement] Échec sauvegarde Sheets:", err)
    }

    return NextResponse.json(response)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erreur inconnue"
    return NextResponse.json({ error: `Erreur Gemini : ${msg}` }, { status: 500 })
  }
}
