import { NextRequest, NextResponse } from "next/server"
import { getServerUser } from "@/lib/supabase/server"
import {
  getSheetsClient, SPREADSHEET_ID,
  sheetToObjects, appendRow, updateRowById, deleteRowById, deleteRowsWhere, deleteRowsWhereAll, nextId, fmtDate, parseDateFr, ensureColumn, ensureColumns,
  uploadToDrive, getHeaders, deleteDriveFile, makeFilePublic, COMMUNICATION_MEDIA_FOLDER_ID, BILAN_ATELIER_FOLDER_ID,
} from "@/lib/google-sheets-server"
import { niveauEcole } from "@/lib/atelier"

type Sheets = ReturnType<typeof getSheetsClient>

// Nom exact de la colonne PERSONNE portant le droit à l'image — source unique pour éviter
// qu'une variante orthographique (accent, apostrophe) désynchronise lecture/écriture et
// désactive silencieusement le floutage.
const COL_DROIT_IMAGE = "Droit a l'image"

// ── Réponses ──────────────────────────────────────────────

function ok(data: unknown) {
  return NextResponse.json(data)
}
function err(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

// ── GET ───────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!(await getServerUser())) return err("Non authentifié.", 401)
  const { searchParams } = new URL(request.url)
  const action = searchParams.get("action") ?? "ping"
  const sheets = getSheetsClient()

  try {
    switch (action) {
      case "ping":
        return ok({ ok: true, base: "BDD_Asso_CRM" })
      case "getFamilles":
        return ok(await getFamilles(sheets))
      case "getMembres":
        return ok(await getMembres(sheets, searchParams.get("idFamille") ?? undefined))
      case "getScolariteFamille":
        return ok(await getScolariteFamille(sheets, searchParams.get("idFamille")!))
      case "getMembre":
        return ok(await getMembre(sheets, searchParams.get("idMembre")!))
      case "getPaiements":
        return ok(await getPaiements(sheets, searchParams.get("idMembre")!))
      case "getDocuments":
        return ok(await getDocuments(sheets, searchParams.get("idMembre")!))
      case "getEvenements":
        return ok(await getEvenements(sheets, searchParams.get("categorie") ?? undefined))
      case "getAssiduite":
        return ok(await getAssiduite(sheets, searchParams.get("idEvenement") ?? undefined, searchParams.get("idPersonne") ?? undefined, searchParams.get("idSeance") ?? undefined))
      case "getPositionnements":
        return ok(await getPositionnements(sheets))
      case "getAteliers":
        return ok(await getAteliers(sheets, searchParams.get("audience") ?? undefined))
      case "getIntervenants":
        return ok(await getIntervenants(sheets))
      case "getSeances":
        return ok(await getSeances(sheets, searchParams.get("idAtelier") ?? undefined))
      case "getBeneficiaires":
        return ok(await getBeneficiaires(sheets, searchParams.get("audience") ?? undefined))
      case "getPosts":
        return ok(await getPosts(sheets))
      case "getEvaluations":
        return ok(await getEvaluations(sheets))
      case "getRecapEleves":
        return ok({ rows: await computeRecapEleves(sheets) })
      default:
        return err(`Action inconnue : ${action}`)
    }
  } catch (e) {
    console.error("[sheets/GET]", e)
    return err(String(e), 500)
  }
}

// ── POST ──────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  if (!(await getServerUser())) return err("Non authentifié.", 401)
  const body = await request.json()
  const { action } = body
  const sheets = getSheetsClient()

  try {
    switch (action) {
      case "addFamille":      return ok(await addFamille(sheets, body.data))
      case "updateFamille":   return ok(await updateFamille(sheets, body.idFamille, body.data))
      case "addMembre":       return ok(await addMembre(sheets, body.data))
      case "updateMembre":    return ok(await updateMembre(sheets, body.idMembre, body.data))
      case "deleteMembre":    return ok(await deleteMembre(sheets, body.idMembre))
      case "addPaiement":     return ok(await addPaiement(sheets, body.data))
      case "updatePaiement":  return ok(await updatePaiement(sheets, body.idPaiement, body.data))
      case "deletePaiement":  return ok(await deletePaiement(sheets, body.idPaiement))
      case "addInscription":    return ok(await addInscription(sheets, String(body.idMembre), body.data as Record<string, unknown>))
      case "updateInscription": return ok(await updateInscription(sheets, body.idInscription, body.data))
      case "addEvenement":    return ok(await addEvenement(sheets, body.data))
      case "updateEvenement": return ok(await updateEvenement(sheets, body.idEvenement, body.data))
      case "deleteEvenement": return ok(await deleteEvenement(sheets, body.idEvenement))
      case "addAssiduite":    return ok(await addAssiduite(sheets, body.data))
      case "updateAssiduite": return ok(await updateAssiduite(sheets, body.idAssiduite, body.data))
      case "deleteAssiduite": return ok(await deleteAssiduite(sheets, body.idAssiduite))
      case "upsertAssiduite": return ok(await upsertAssiduite(sheets, body.idEvenement, body.idPersonne, body.statut, body.notes, body.idSeance))
      case "addAtelier":      return ok(await addAtelier(sheets, body.data, body.beneficiaireIds, body.intervenantIds))
      case "updateAtelier":   return ok(await updateAtelier(sheets, body.idAtelier, body.data, body.beneficiaireIds, body.intervenantIds))
      case "deleteAtelier":   return ok(await deleteAtelier(sheets, body.idAtelier))
      case "addSeance":       return ok(await addSeance(sheets, body.data, body.intervenants))
      case "updateSeance":    return ok(await updateSeance(sheets, body.idSeance, body.data, body.intervenants))
      case "deleteSeance":    return ok(await deleteSeance(sheets, body.idSeance))
      case "addIntervenant":    return ok(await addIntervenant(sheets, body.data))
      case "updateIntervenant": return ok(await updateIntervenant(sheets, body.idIntervenant, body.data))
      case "deleteIntervenant": return ok(await deleteIntervenant(sheets, body.idIntervenant))
      case "upsertEvaluation":  return ok(await upsertEvaluation(sheets, String(body.idPersonne), body.session, body.data))
      case "deleteEvaluation":  return ok(await deleteEvaluation(sheets, body.idEvaluation))
      case "uploadFichier":   return ok(await uploadFichier(sheets, body))
      case "deleteDocument":  return ok(await deleteDocument(sheets, body.idDoc))
      case "addPost":         return ok(await addPost(sheets, body.data))
      case "updatePost":      return ok(await updatePost(sheets, body.id, body.data))
      case "deletePost":      return ok(await deletePost(sheets, body.id))
      case "uploadPostMedia": return ok(await uploadPostMedia(body))
      case "exportRecapEleves": return ok(await exportRecapEleves(sheets))
      default:
        return err(`Action inconnue : ${action}`)
    }
  } catch (e) {
    console.error("[sheets/POST]", action, e)
    return err(String(e), 500)
  }
}

// ── Upload de fichier (Drive) ─────────────────────────────

// Dossiers Drive par catégorie de document
const DOSSIERS_DOCUMENT: Record<string, string> = {
  "Fiche d'inscription":    "1E5KdJqdbkrnjJEMtk2NpW-1RJdB28SOX",
  "Droit à l'image":        "1vD-Q6oTVf6HrWBQIAd6Q7CSFm0zJIoAt",
  "Charte d'engagement":    "1H7FcDHQSkf9q3DW71FVBonjwxll4yXsz",
  "Autorisation de sortie": "14f-X5DRlA-z7GorJMUxlBq1KlXDGTFSi",
  "Bulletins":              "1gFIzCwk33OaHlFSJjluKDs3iU9onyAQ2",
}

// Catégorie de document → colonne « Oui/Non » à synchroniser dans la base.
// (Fiche d'inscription : pas de colonne dédiée, l'info reste dérivée de DOCUMENTS JOINTS.)
const DOC_FLAG: Record<string, { table: "PERSONNE" | "SCOLARITE"; column: string }> = {
  "Droit à l'image":        { table: "PERSONNE",  column: "Droit a l'image" },
  "Charte d'engagement":    { table: "PERSONNE",  column: "Charte d'engagement" },
  "Autorisation de sortie": { table: "SCOLARITE", column: "Autorisation de sortie" },
  "Bulletins":              { table: "SCOLARITE", column: "Bulletins" },
}

// Met la colonne liée à une catégorie de document à « Oui »/« Non ».
// Pour SCOLARITE, crée la ligne de la personne si elle n'existe pas encore.
async function syncDocFlag(sheets: Sheets, idMembre: string, categorie: string, present: boolean) {
  const map = DOC_FLAG[categorie]
  if (!map || !idMembre) return
  const val = present ? "Oui" : "Non"
  if (map.table === "PERSONNE") {
    await updateRowById(sheets, "PERSONNE", idMembre, { [map.column]: val })
    return
  }
  const scol = await sheetToObjects(sheets, "SCOLARITE")
  const row = scol.find((s) => String(s["Personne ID"]) === String(idMembre))
  if (row) {
    await updateRowById(sheets, "SCOLARITE", String(row["ID"]), { [map.column]: val })
  } else {
    const id = await nextId(sheets, "SCOLARITE")
    await appendRow(sheets, "SCOLARITE", { "ID": id, "Personne ID": idMembre, [map.column]: val })
  }
}

async function uploadFichier(sheets: Sheets, body: Record<string, unknown>) {
  const nom = String(body.nom ?? "document")
  const mimeType = String(body.mimeType ?? "application/octet-stream")
  const dataBase64 = String(body.dataBase64 ?? "")
  const idMembre = body.idMembre ? String(body.idMembre) : ""
  const categorie = String(body.categorie ?? "")
  if (!dataBase64) return { error: "Fichier vide" }
  const folderId = DOSSIERS_DOCUMENT[categorie]
  if (!folderId) return { error: `Catégorie inconnue : ${categorie}` }

  // Nom du fichier : "Nom Prénom - Type - Date.ext"
  let identite = ""
  if (idMembre) {
    const personnes = await sheetToObjects(sheets, "PERSONNE")
    const p = personnes.find((x) => String(x["ID"]) === idMembre)
    if (p) identite = `${String(p["Nom"] ?? "").trim()} ${String(p["Prenom"] ?? "").trim()}`.trim()
  }
  const d = new Date()
  const p2 = (n: number) => String(n).padStart(2, "0")
  const dateStr = `${p2(d.getDate())}-${p2(d.getMonth() + 1)}-${d.getFullYear()}`
  const ext = nom.includes(".") ? nom.slice(nom.lastIndexOf(".")) : ""
  const nomFichier = `${identite || "Document"} - ${categorie} - ${dateStr}${ext}`

  // 1) Upload dans le dossier Drive correspondant à la catégorie
  const { fileId, url } = await uploadToDrive(nomFichier, mimeType, dataBase64, folderId)

  // 2) Enregistre une ligne dans la table DOCUMENTS JOINTS,
  //    en remplissant la première ligne vide (évite de sauter les lignes pré-formatées)
  const id = await nextId(sheets, "DOCUMENTS JOINTS")
  const headers = await getHeaders(sheets, "DOCUMENTS JOINTS")
  const valeurs: Record<string, unknown> = {
    "ID": id,
    "ID PERSONNE": idMembre,
    "URL": url,
    "Catégorie": categorie,
  }
  const row = headers.map((h) => (valeurs[h] !== undefined ? String(valeurs[h]) : ""))

  const colA = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: "DOCUMENTS JOINTS!A2:A" })
  const aVals = colA.data.values ?? []
  let ligne = aVals.length + 2 // par défaut : après la dernière ligne
  for (let i = 0; i < aVals.length; i++) {
    if (!aVals[i] || !aVals[i][0]) { ligne = i + 2; break }
  }
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `DOCUMENTS JOINTS!A${ligne}`,
    valueInputOption: "RAW",
    requestBody: { values: [row] },
  })

  // 3) Synchronise la colonne « Oui/Non » correspondante (Droit à l'image, Charte, Bulletins…)
  await syncDocFlag(sheets, idMembre, categorie, true)

  return { ok: true, url, fileId, ID: id, nomFichier }
}

async function getDocuments(sheets: Sheets, idMembre: string) {
  const docs = await sheetToObjects(sheets, "DOCUMENTS JOINTS")
  return docs
    .filter((d) => String(d["ID PERSONNE"]) === String(idMembre))
    .map((d) => ({ ID_Doc: String(d["ID"]), URL: String(d["URL"] ?? ""), Categorie: String(d["Catégorie"] ?? "") }))
}

async function deleteDocument(sheets: Sheets, idDoc: string) {
  // Best-effort : tenter de supprimer le fichier Drive associé
  const docs = await sheetToObjects(sheets, "DOCUMENTS JOINTS")
  const d = docs.find((x) => String(x["ID"]) === String(idDoc))
  const idMembre = d ? String(d["ID PERSONNE"] ?? "") : ""
  const categorie = d ? String(d["Catégorie"] ?? "") : ""
  if (d) {
    const m = /\/file\/d\/([^/]+)/.exec(String(d["URL"] ?? ""))
    if (m) { try { await deleteDriveFile(m[1]) } catch { /* le compte de service ne peut pas toujours supprimer */ } }
  }
  const supprime = await deleteRowById(sheets, "DOCUMENTS JOINTS", String(idDoc))

  // Repasse la colonne à « Non » s'il ne reste plus aucun document de cette catégorie
  if (supprime && idMembre && DOC_FLAG[categorie]) {
    const resteUnDoc = docs.some((x) =>
      String(x["ID"]) !== String(idDoc) &&
      String(x["ID PERSONNE"]) === idMembre &&
      String(x["Catégorie"]) === categorie
    )
    await syncDocFlag(sheets, idMembre, categorie, resteUnDoc)
  }
  return supprime ? { ok: true } : { error: "Document introuvable" }
}

// ── CONTENUS (Communication) ──────────────────────────────
// Colonnes existantes : ID | Titre | Contenu principal | Image | Vidéo | Tags | État  |
//                       Date programmée | Plateforme RS | Catégorie  | Event ID
// Colonnes ajoutées (ensureColumns) pour couvrir la richesse de l'app :
//   Auteur | Brief | Plateforme Contenu (JSON) | Participants (JSON) | Session ID
const CONTENUS_COLONNES_ETENDUES = ["Auteur", "Brief", "Plateforme Contenu", "Participants", "Session ID"]

function rowToPost(r: Record<string, unknown>) {
  let plateformeContenu: Record<string, unknown> = {}
  try { plateformeContenu = JSON.parse(String(r["Plateforme Contenu"] ?? "{}")) } catch { /* JSON invalide, ignore */ }
  let participants: unknown = undefined
  try { participants = r["Participants"] ? JSON.parse(String(r["Participants"])) : undefined } catch { /* ignore */ }

  const media: { nom: string; type: string; url: string }[] = []
  if (r["Image"]) media.push({ nom: "image", type: "image", url: String(r["Image"]) })
  if (r["Vidéo"]) media.push({ nom: "vidéo", type: "video", url: String(r["Vidéo"]) })

  return {
    id: Number(r["ID"]),
    categorie: String(r["Catégorie "] || "autre"),
    date: String(r["Date programmée"] ?? ""),
    titre: String(r["Titre"] ?? ""),
    brief: String(r["Brief"] ?? ""),
    contenu: String(r["Contenu principal"] ?? ""),
    media,
    plateforme: String(r["Plateforme RS"] ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    plateformeContenu,
    statut: String(r["État "] || "brouillon"),
    auteur: String(r["Auteur"] ?? ""),
    sessionId: r["Session ID"] ? Number(r["Session ID"]) : null,
    participants,
  }
}

/** Ne remplit que les colonnes explicitement fournies dans `data` (update partiel). */
function postWriteMap(data: Record<string, unknown>): Record<string, unknown> {
  const map: Record<string, unknown> = {}
  if (data.titre !== undefined) map["Titre"] = data.titre
  if (data.contenu !== undefined) map["Contenu principal"] = data.contenu
  if (data.media !== undefined) {
    const media = (data.media as Array<{ type: string; url?: string }> | undefined) ?? []
    map["Image"] = media.find((m) => m.type === "image")?.url ?? ""
    map["Vidéo"] = media.find((m) => m.type === "video")?.url ?? ""
  }
  if (data.statut !== undefined) map["État "] = data.statut
  if (data.date !== undefined) map["Date programmée"] = data.date
  if (data.plateforme !== undefined) map["Plateforme RS"] = Array.isArray(data.plateforme) ? data.plateforme.join(",") : ""
  if (data.categorie !== undefined) map["Catégorie "] = data.categorie
  if (data.auteur !== undefined) map["Auteur"] = data.auteur
  if (data.brief !== undefined) map["Brief"] = data.brief
  if (data.plateformeContenu !== undefined) map["Plateforme Contenu"] = JSON.stringify(data.plateformeContenu ?? {})
  if (data.participants !== undefined) map["Participants"] = data.participants ? JSON.stringify(data.participants) : ""
  if (data.sessionId !== undefined) map["Session ID"] = data.sessionId ?? ""
  return map
}

async function getPosts(sheets: Sheets) {
  const rows = await sheetToObjects(sheets, "CONTENUS")
  return rows.map(rowToPost)
}

async function addPost(sheets: Sheets, data: Record<string, unknown>) {
  await ensureColumns(sheets, "CONTENUS", CONTENUS_COLONNES_ETENDUES)
  const id = await nextId(sheets, "CONTENUS")
  const headers = await getHeaders(sheets, "CONTENUS")
  const valeurs: Record<string, unknown> = { "ID": id, ...postWriteMap(data) }
  const row = headers.map((h) => (valeurs[h] !== undefined ? String(valeurs[h]) : ""))

  // ⚠️ Ne pas utiliser appendRow/values.append ici : sur une feuille neuve/clairsemée avec une
  // grille large (colonnes bien au-delà des en-têtes), l'auto-détection de tableau de l'API Sheets
  // se trompe et décale les valeurs de plusieurs colonnes (constaté : décalage de colonnes qui
  // grandit à chaque appel). On écrit donc à une plage explicite, comme pour DOCUMENTS JOINTS.
  const colA = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: "CONTENUS!A2:A" })
  const aVals = colA.data.values ?? []
  let ligne = aVals.length + 2
  for (let i = 0; i < aVals.length; i++) {
    if (!aVals[i] || !aVals[i][0]) { ligne = i + 2; break }
  }
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `CONTENUS!A${ligne}`,
    valueInputOption: "RAW",
    requestBody: { values: [row] },
  })
  return { ok: true, id }
}

async function updatePost(sheets: Sheets, id: number, data: Record<string, unknown>) {
  await ensureColumns(sheets, "CONTENUS", CONTENUS_COLONNES_ETENDUES)
  const updated = await updateRowById(sheets, "CONTENUS", id, postWriteMap(data))
  return updated ? { ok: true } : { error: "Post introuvable" }
}

async function deletePost(sheets: Sheets, id: number) {
  // Best-effort : supprimer les médias Drive associés (Image / Vidéo)
  const rows = await sheetToObjects(sheets, "CONTENUS")
  const row = rows.find((r) => String(r["ID"]) === String(id))
  if (row) {
    for (const col of ["Image", "Vidéo"]) {
      // "Image" = thumbnail?id=... ; "Vidéo" = webViewLink /file/d/{id}/view
      const url = String(row[col] ?? "")
      const m = /[?&]id=([^&]+)/.exec(url) ?? /\/file\/d\/([^/]+)/.exec(url)
      if (m) { try { await deleteDriveFile(m[1]) } catch { /* le compte de service ne peut pas toujours supprimer */ } }
    }
  }
  const deleted = await deleteRowById(sheets, "CONTENUS", id)
  return deleted ? { ok: true } : { error: "Post introuvable" }
}

async function uploadPostMedia(body: Record<string, unknown>) {
  const nom = String(body.nom ?? "media")
  const mimeType = String(body.mimeType ?? "application/octet-stream")
  const dataBase64 = String(body.dataBase64 ?? "")
  if (!dataBase64) return { error: "Fichier vide" }
  const { fileId, url: webViewLink } = await uploadToDrive(nom, mimeType, dataBase64, COMMUNICATION_MEDIA_FOLDER_ID)
  await makeFilePublic(fileId) // rend le fichier lisible par lien (le lien "uc?export=download" renvoyé n'est pas utilisable en <img> inline)
  // Pour les images : endpoint "thumbnail" de Drive, conçu pour l'affichage inline (contrairement à uc?export=download/view, peu fiable en <img src>).
  // Pour les vidéos : pas de lecteur inline pour l'instant, on garde le lien de visualisation Drive.
  const url = mimeType.startsWith("image/") ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600` : webViewLink
  return { ok: true, url, fileId }
}

// ── POSITIONNEMENT ────────────────────────────────────────

async function getPositionnements(sheets: Sheets) {
  try {
    const rows = await sheetToObjects(sheets, "POSITIONNEMENT")
    const result: Record<string, Record<string, unknown>> = {}
    for (const row of rows) {
      const niveau = String(row["Niveau"] ?? "")
      const catId = String(row["Categorie_ID"] ?? "")
      if (!niveau || !catId) continue
      if (!result[niveau]) result[niveau] = {}
      result[niveau][catId] = {
        contenu: row["Contenu"] ?? "",
        transcription: row["Transcription"] ?? "",
        audio: row["Audio_URL"] ?? "",
        image: row["Image_URL"] ?? "",
      }
    }
    return result
  } catch {
    return {}
  }
}

// ── LECTURE ───────────────────────────────────────────────

async function getFamilles(sheets: Sheets) {
  const [familles, personnes, inscriptions] = await Promise.all([
    sheetToObjects(sheets, "FAMILLE"),
    sheetToObjects(sheets, "PERSONNE"),
    sheetToObjects(sheets, "INSCRIPTION"),
  ])
  return familles.map((f) => {
    const membresF = personnes
      .filter((p) => String(p["Famille ID"]) === String(f["ID"]))
      .map((p) => mapMembre(p, inscriptions))
    return {
      ID_Famille: String(f["ID"]),
      Nom_Famille: f["Nom"] ?? "",
      Adresse: f["Adresse"] ?? "",
      Code_Postal: f["Code postal"] ? String(f["Code postal"]) : "",
      Ville: f["Ville"] ?? "",
      Adresse_Complete: joinAdresse(f),
      Quartier_QVP: f["Quartier QVP"] ?? "",
      Notes: f["Commentaire"] ?? "",
      Nb_Membres: membresF.length,
      Date_Creation: "",
      membres: membresF,
      statut: membresF.length > 0 ? membresF[0].Statut_Inscription : "",
      nbMembres: membresF.length,
    }
  })
}

async function getMembres(sheets: Sheets, idFamille?: string) {
  const [personnes, inscriptions] = await Promise.all([
    sheetToObjects(sheets, "PERSONNE"),
    sheetToObjects(sheets, "INSCRIPTION"),
  ])
  const membres = personnes.map((p) => mapMembre(p, inscriptions))
  if (idFamille) return membres.filter((m) => m.ID_Famille === String(idFamille))
  return membres
}

// Scolarité des membres d'une famille (jointure SCOLARITE → ETABLISSEMENT + PROFESSEUR).
// Ne renvoie que les personnes de la famille ayant une ligne SCOLARITE (typiquement les enfants).
async function getScolariteFamille(sheets: Sheets, idFamille: string) {
  const [personnes, scolarites, etabs, profs] = await Promise.all([
    sheetToObjects(sheets, "PERSONNE"),
    sheetToObjects(sheets, "SCOLARITE"),
    sheetToObjects(sheets, "ETABLISSEMENT"),
    sheetToObjects(sheets, "PROFESSEUR"),
  ])
  const etabById = new Map(etabs.map((e) => [String(e["ID"]), e]))
  const profById = new Map(profs.map((p) => [String(p["ID"]), p]))
  const persById = new Map(personnes.map((p) => [String(p["ID"]), p]))
  const idsFamille = new Set(
    personnes.filter((p) => String(p["Famille ID"]) === String(idFamille)).map((p) => String(p["ID"]))
  )
  return scolarites
    .filter((sc) => idsFamille.has(String(sc["Personne ID"])))
    .map((sc) => {
      const p = persById.get(String(sc["Personne ID"]))
      const etab = etabById.get(String(sc["Etablissement ID"]))
      const prof = profById.get(String(sc["Prof principal ID"]))
      return {
        ID_Membre: String(sc["Personne ID"]),
        Nom: String(p?.["Nom"] ?? ""),
        Prenom: String(p?.["Prenom"] ?? ""),
        Etablissement: etab ? { Type: String(etab["Type"] ?? ""), Nom: String(etab["Nom"] ?? "") } : null,
        ProfPrincipal: prof
          ? { Nom: String(prof["Nom"] ?? ""), Telephone: String(prof["Telephone"] ?? ""), Email: String(prof["Email"] ?? "") }
          : null,
        Autorisation_Sortie: String(sc["Autorisation de sortie"] ?? ""),
        Bulletins: String(sc["Bulletins"] ?? ""),
        Rencontre_Prof: String(sc["Rencontre prof"] ?? ""),
      }
    })
}

async function getMembre(sheets: Sheets, idMembre: string) {
  const [personnes, inscriptions, evaluations] = await Promise.all([
    sheetToObjects(sheets, "PERSONNE"),
    sheetToObjects(sheets, "INSCRIPTION"),
    sheetToObjects(sheets, "EVALUATION"),
  ])
  const p = personnes.find((x) => String(x["ID"]) === String(idMembre))
  if (!p) return { error: "Personne introuvable" }

  const membre = mapMembre(p, inscriptions) as Record<string, unknown>
  membre.inscriptions = inscriptions
    .filter((i) => String(i["Personne ID"]) === String(idMembre))
    .map(mapInscription)
  membre.paiements = await getPaiements(sheets, idMembre)
  membre.evaluations = evaluations
    .filter((ev) => String(ev["Personne ID"]) === String(idMembre))
    .map((ev) => ({
      ID: String(ev["ID"]),
      Date: fmtDate(ev["Date"]),
      Niveau: ev["Niveau attribue"],
      Comprehension_Ecrite: ev["Note comprehension ecrite"],
      Comprehension_Orale: ev["Note comprehension orale"],
      Expression_Ecrite: ev["Note expression ecrite"],
      Expression_Orale: ev["Note expression orale"],
      Evaluateur: ev["Evaluateur"],
    }))
  return membre
}

async function getPaiements(sheets: Sheets, idMembre: string) {
  const [inscriptions, paiements] = await Promise.all([
    sheetToObjects(sheets, "INSCRIPTION"),
    sheetToObjects(sheets, "PAIEMENT"),
  ])
  const inscIds = inscriptions
    .filter((i) => String(i["Personne ID"]) === String(idMembre))
    .map((i) => String(i["ID"]))
  return paiements
    .filter((pay) => inscIds.includes(String(pay["Inscription ID"])))
    .map((pay) => ({
      ID_Paiement: String(pay["ID"]),
      ID_Membre: String(idMembre),
      ID_Inscription: String(pay["Inscription ID"]),
      Date_Paiement: fmtDate(pay["Date de paiement"] as string),
      Montant: pay["Montant"],
      Mode_Paiement: pay["Mode de paiement"],
      Date_Depot_Banque: fmtDate(pay["Date de depot banque"] as string),
      Date_Virement: fmtDate(pay["Date de virement"] as string),
    }))
}

async function getEvenements(sheets: Sheets, categorie?: string) {
  const rows = await sheetToObjects(sheets, "EVENEMENT2")
  return rows
    .filter((r) => !categorie || String(r["Categorie"]).toLowerCase() === categorie.toLowerCase())
    .map((r) => ({
      ID_Evenement: String(r["ID"]),
      Titre: r["Titre"] ?? "",
      Date: fmtDate(r["Date"] as string),
      Heure_Debut: r["Heure_Debut"] ?? "",
      Heure_Fin: r["Heure_Fin"] ?? "",
      Salle: r["Salle"] ?? "",
      Animateur: r["Animateur"] ?? "",
      Categorie: r["Categorie"] ?? "",
      Statut: r["Statut"] ?? "",
    }))
}

async function getAssiduite(sheets: Sheets, idEvenement?: string, idPersonne?: string, idSeance?: string) {
  const rows = await sheetToObjects(sheets, "ASSIDUITE")
  return rows
    .filter((r) => {
      const matchE = !idEvenement || String(r["Evenement2 ID"]) === String(idEvenement)
      const matchP = !idPersonne  || String(r["Personne ID"])  === String(idPersonne)
      const matchS = !idSeance    || String(r["Seance ID"] ?? "") === String(idSeance)
      return matchE && matchP && matchS
    })
    .map((r) => ({
      ID_Assiduite: String(r["ID"]),
      ID_Evenement: String(r["Evenement2 ID"]),
      ID_Seance: String(r["Seance ID"] ?? ""),
      ID_Personne:  String(r["Personne ID"]),
      Statut: r["ETAT"] ?? "present",
      Notes: r["Commentaire"] ?? "",
    }))
}

// ── LECTURE ATELIERS ──────────────────────────────────────

async function getAteliers(sheets: Sheets, audience?: string) {
  const [evenements, participants] = await Promise.all([
    sheetToObjects(sheets, "EVENEMENT2"),
    sheetToObjects(sheets, "ATELIER_PARTICIPANT"),
  ])
  // La table EVENEMENT2 est partagée avec d'autres types d'événements
  // (cours, sortie…) — ce module ne gère que les lignes Type = "atelier".
  const ateliers = evenements.filter((a) => String(a["Type"] ?? "").toLowerCase() === "atelier")
  return ateliers
    .filter((a) => !audience || String(a["Audience"]).toLowerCase() === audience.toLowerCase())
    .map((a) => {
      const id = String(a["ID"])
      // Séances de cet atelier (EVENEMENT2, Type = "séance", "Atelier ID" = parent).
      // Un·e intervenant·e peut être rattaché·e au niveau séance (ligne
      // ATELIER_PARTICIPANT avec seulement "Seance ID"), pas seulement au niveau
      // atelier — on inclut ces liens pour ne pas les masquer.
      const idsSeances = new Set(
        evenements
          .filter((s) => String(s["Type"] ?? "").toLowerCase() === "séance" && String(s["Atelier ID"]) === id)
          .map((s) => String(s["Séance ID"] ?? s["ID"]))
      )
      const liens = participants.filter((l) =>
        String(l["Atelier ID"]) === id || idsSeances.has(String(l["Seance ID"] ?? ""))
      )
      const beneficiaireIds = Array.from(new Set(
        liens
          .filter((l) => l["Role"] === "Beneficiaire")
          .map((l) => String(l["Personne ID"]))
      ))
      const intervenants = liens
        .filter((l) => l["Role"] === "Intervenant")
        .map((l) => ({
          ID_Intervenant: String(l["Intervenant ID"]),
          Heures: l["Heures"] ?? "",
          Role: "",
        }))
      const competences = String(a["Competences ciblees"] ?? "")
        .split(",").map((s) => s.trim()).filter(Boolean)
      return {
        ID_Atelier: id,
        Categorie: a["Categorie"] ?? "",
        Groupe: a["Groupe"] ?? "",
        // Repli sur l'ancienne colonne "Titre" : les ateliers créés avant le
        // renommage n'ont pas de "Nom atelier" → éviter un titre vide.
        Titre: a["Nom atelier"] || a["Titre"] || "",
        Audience: a["Audience"] ?? "",
        Date_Debut: fmtDate(a["Date debut"] as string),
        Date_Fin: fmtDate(a["Date fin"] as string),
        Periode: a["Periode"] ?? "",
        Heure_Debut: a["Heure debut"] ?? "",
        Heure_Fin: a["Heure fin"] ?? "",
        Salle: a["Salle"] ?? "",
        Mode_Groupage: a["Mode groupage"] ?? "",
        Taille_Cible: a["Taille cible"] ?? "",
        Competences_Ciblees: competences,
        Taches: a["Taches"] ?? "",
        Besoins: a["Besoins"] ?? "",
        Etapes: a["Etapes"] ?? "",
        Statut: a["Statut"] ?? "",
        beneficiaireIds,
        intervenants,
      }
    })
}

function numOrNull(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null
  const n = Number(String(v).replace(",", "."))
  return isNaN(n) ? null : n
}

/** Année de début d'une "Annee scolaire" ("25-26" → 2025 ; vide → 0).
 *  Sert à retenir l'inscription la plus récente d'un élève réinscrit chaque année. */
function anneeScolaireStart(a: unknown): number {
  const m = String(a ?? "").match(/(\d{2,4})/)
  if (!m) return 0
  const y = Number(m[1])
  return y < 100 ? 2000 + y : y
}

/** Retourne l'inscription de l'année scolaire la plus récente (ou null). */
function inscriptionCourante(insc: Record<string, unknown>[]): Record<string, unknown> | null {
  if (insc.length === 0) return null
  return insc.reduce((best, cur) =>
    anneeScolaireStart(cur["Annee scolaire"]) >= anneeScolaireStart(best["Annee scolaire"]) ? cur : best,
  )
}

/** Normalise la colonne "Session" d'une ligne EVALUATION. Les lignes créées
 *  avant l'ajout de cette colonne (ou saisies via l'onglet Notes sans la
 *  préciser) sont traitées comme "initial" — c'est le comportement historique
 *  (une seule évaluation par personne, avant la distinction initial/final). */
function evalSession(e: Record<string, unknown>): "initial" | "final" {
  return String(e["Session"] ?? "").toLowerCase().trim() === "final" ? "final" : "initial"
}

/** Bénéficiaires (élèves/parents) prêts pour la composition de groupes :
 *  type, statut, disponibilité, niveau + les 4 notes de l'évaluation INITIALE.
 *  ⚠️ Ne jamais utiliser l'évaluation finale ici : elle mesure la progression
 *  en fin d'année, après la composition des groupes — s'en servir fausserait
 *  le placement des bénéficiaires (cf. lib/positionnement.ts). */
async function getBeneficiaires(sheets: Sheets, audience?: string) {
  const [personnes, inscriptions, evaluations] = await Promise.all([
    sheetToObjects(sheets, "PERSONNE"),
    sheetToObjects(sheets, "INSCRIPTION"),
    sheetToObjects(sheets, "EVALUATION"),
  ])
  return personnes
    .map((p) => {
      const id = String(p["ID"])
      const insc = inscriptions.filter((i) => String(i["Personne ID"]) === id)
      const lastInsc = inscriptionCourante(insc)
      const evalsInitiales = evaluations.filter((e) => String(e["Personne ID"]) === id && evalSession(e) === "initial")
      const evalInitiale = evalsInitiales.length > 0 ? evalsInitiales[evalsInitiales.length - 1] : null
      const type = String(p["Categorie"]).toLowerCase().startsWith("enfant") ? "eleve" : "parent"
      return {
        ID_Personne: id,
        type,
        Prenom: p["Prenom"] ?? "",
        Nom: p["Nom"] ?? "",
        Date_Naissance: fmtDate(p["Date de naissance"] as string),
        Email: p["Email"] ?? "",
        Telephone: p["Telephone"] ?? "",
        Statut_Inscription: lastInsc ? (lastInsc["Statut"] ?? "") : "",
        Niveau_Classe: lastInsc ? (lastInsc["Niveau / Classe"] ?? "") : "",
        Disponibilite: lastInsc ? (lastInsc["Disponibilite"] ?? "") : "",
        Type_Apprenant: lastInsc ? (lastInsc["Type apprenant"] ?? "") : "",
        Niveau_CECRL: evalInitiale ? (evalInitiale["Niveau attribue"] ?? "") : "",
        Droit_Image: p[COL_DROIT_IMAGE] ?? "",
        notes: {
          comprehensionEcrite: numOrNull(evalInitiale?.["Note comprehension ecrite"]),
          comprehensionOrale:  numOrNull(evalInitiale?.["Note comprehension orale"]),
          expressionEcrite:    numOrNull(evalInitiale?.["Note expression ecrite"]),
          expressionOrale:     numOrNull(evalInitiale?.["Note expression orale"]),
        },
      }
    })
    .filter((b) => !audience || (audience === "parents" ? b.type === "parent" : b.type === "eleve"))
}

async function getEvaluations(sheets: Sheets) {
  const rows = await sheetToObjects(sheets, "EVALUATION")
  return rows.map((e) => ({
    ID_Evaluation: String(e["ID"]),
    ID_Personne: String(e["Personne ID"]),
    Session: evalSession(e),
    Date: fmtDate(e["Date"] as string),
    Niveau: e["Niveau attribue"] ?? "",
    Comprehension_Ecrite: numOrNull(e["Note comprehension ecrite"]),
    Comprehension_Orale:  numOrNull(e["Note comprehension orale"]),
    Expression_Ecrite:    numOrNull(e["Note expression ecrite"]),
    Expression_Orale:     numOrNull(e["Note expression orale"]),
    Evaluateur: e["Evaluateur"] ?? "",
  }))
}

// ── ÉCRITURE EVALUATION (module Notes) ────────────────────

/** Crée ou met à jour LA ligne EVALUATION d'une personne pour une session
 *  donnée (initial/final) — une seule ligne par (personne, session). La
 *  colonne "Session" est ajoutée à la volée si le Sheet ne l'a pas encore
 *  (feuille créée avant l'introduction de la distinction initial/final). */
async function upsertEvaluation(
  sheets: Sheets,
  idPersonne: string,
  session: unknown,
  data: Record<string, unknown>,
) {
  const sessionNorm = String(session ?? "").toLowerCase().trim() === "final" ? "final" : "initial"
  await ensureColumn(sheets, "EVALUATION", "Session")

  const mapping: Record<string, unknown> = {
    "Session": sessionNorm,
    "Date": data.Date ? isoToFr(data.Date) : "",
    "Niveau attribue": data.Niveau ?? "",
    "Note comprehension ecrite": data.Comprehension_Ecrite ?? "",
    "Note comprehension orale":  data.Comprehension_Orale ?? "",
    "Note expression ecrite":    data.Expression_Ecrite ?? "",
    "Note expression orale":     data.Expression_Orale ?? "",
    "Evaluateur": data.Evaluateur ?? "",
  }

  const rows = await sheetToObjects(sheets, "EVALUATION")
  const existing = rows.find((e) =>
    String(e["Personne ID"]) === idPersonne && evalSession(e) === sessionNorm,
  )

  if (existing) {
    await updateRowById(sheets, "EVALUATION", String(existing["ID"]), mapping)
    return { ok: true, ID_Evaluation: String(existing["ID"]) }
  }

  const id = await nextId(sheets, "EVALUATION")
  await appendRow(sheets, "EVALUATION", { "ID": id, "Personne ID": idPersonne, ...mapping })
  return { ok: true, ID_Evaluation: String(id) }
}

async function deleteEvaluation(sheets: Sheets, idEvaluation: string) {
  const deleted = await deleteRowById(sheets, "EVALUATION", idEvaluation)
  return deleted ? { ok: true } : { error: "Évaluation introuvable" }
}

async function getIntervenants(sheets: Sheets) {
  const rows = await sheetToObjects(sheets, "INTERVENANT")
  return rows.map((r) => ({
    ID_Intervenant: String(r["ID"]),
    Nom: r["Nom"] ?? "",
    Prenom: r["Prenom"] ?? "",
    Type: r["Type"] ?? "",
    Email: r["Email"] ?? "",
    Telephone: r["Telephone"] ?? "",
    Statut: r["Statut"] ?? "",
  }))
}

// ── ÉCRITURE INTERVENANT ──────────────────────────────────

async function addIntervenant(sheets: Sheets, data: Record<string, unknown>) {
  const id = await nextId(sheets, "INTERVENANT")
  await appendRow(sheets, "INTERVENANT", {
    "ID": id,
    "Nom": data.Nom ?? "",
    "Prenom": data.Prenom ?? "",
    "Type": data.Type ?? "",
    "Email": data.Email ?? "",
    "Telephone": data.Telephone ?? "",
    "Statut": data.Statut ?? "actif",
  })
  return { ok: true, ID_Intervenant: String(id) }
}

async function updateIntervenant(sheets: Sheets, idIntervenant: string, data: Record<string, unknown>) {
  const map: Record<string, unknown> = {}
  if (data.Nom !== undefined)       map["Nom"] = data.Nom
  if (data.Prenom !== undefined)    map["Prenom"] = data.Prenom
  if (data.Type !== undefined)      map["Type"] = data.Type
  if (data.Email !== undefined)     map["Email"] = data.Email
  if (data.Telephone !== undefined) map["Telephone"] = data.Telephone
  if (data.Statut !== undefined)    map["Statut"] = data.Statut
  const ok = await updateRowById(sheets, "INTERVENANT", idIntervenant, map)
  return ok ? { ok: true } : { error: "Intervenant introuvable" }
}

async function deleteIntervenant(sheets: Sheets, idIntervenant: string) {
  // Cascade : retire les liens de cet intervenant sur tous les ateliers avant
  // de supprimer sa fiche, pour ne pas laisser de lignes ATELIER_PARTICIPANT
  // orphelines pointant vers un intervenant qui n'existe plus.
  await deleteRowsWhere(sheets, "ATELIER_PARTICIPANT", "Intervenant ID", [String(idIntervenant)])
  const deleted = await deleteRowById(sheets, "INTERVENANT", idIntervenant)
  return deleted ? { ok: true } : { error: "Intervenant introuvable" }
}

// ── ÉCRITURE FAMILLE ──────────────────────────────────────

async function addFamille(sheets: Sheets, data: Record<string, unknown>) {
  const id = await nextId(sheets, "FAMILLE")
  await appendRow(sheets, "FAMILLE", {
    "ID": id,
    "Nom": data.Nom_Famille ?? "",
    "Adresse": data.Adresse ?? "",
    "Code postal": data.Code_Postal ?? "",
    "Ville": data.Ville ?? "",
    "Quartier QVP": data.Quartier_QVP ?? "",
  })
  return { ok: true, ID_Famille: String(id) }
}

async function updateFamille(sheets: Sheets, idFamille: string, data: Record<string, unknown>) {
  const map: Record<string, unknown> = {}
  if (data.Nom_Famille !== undefined)  map["Nom"] = data.Nom_Famille
  if (data.Adresse !== undefined)      map["Adresse"] = data.Adresse
  if (data.Code_Postal !== undefined)  map["Code postal"] = data.Code_Postal
  if (data.Ville !== undefined)        map["Ville"] = data.Ville
  if (data.Quartier_QVP !== undefined) map["Quartier QVP"] = data.Quartier_QVP
  if (data.Notes !== undefined)        map["Commentaire"] = data.Notes
  const ok = await updateRowById(sheets, "FAMILLE", idFamille, map)
  return ok ? { ok: true } : { error: "Famille introuvable" }
}

// ── ÉCRITURE MEMBRE ───────────────────────────────────────

async function addMembre(sheets: Sheets, data: Record<string, unknown>) {
  const id = await nextId(sheets, "PERSONNE")
  await appendRow(sheets, "PERSONNE", {
    "ID": id,
    "Famille ID": data.ID_Famille ?? "",
    "Categorie": data.Role ?? "Adulte",
    "Contact principal": data.Contact_Principal ?? "",
    "Nom": data.Nom ?? "",
    "Prenom": data.Prenom ?? "",
    "Genre": data.Genre ?? "",
    "Date de naissance": parseDateFr(String(data.Date_Naissance ?? "")),
    "Telephone": data.Telephone ?? "",
    "Email": data.Email ?? "",
    "Pays d'origine": data.Pays_Origine ?? "",
    "Langue maternelle": data.Langue_Maternelle ?? "",
    [COL_DROIT_IMAGE]: data.Droit_Image ?? "",
    "Charte d'engagement": data.Charte ?? "",
    "Beneficiaire": data.Beneficiaire ?? "",
    "Commentaire": data.Notes ?? "",
  })

  // Une inscription n'est créée que si la personne est bénéficiaire.
  // Statut, Type apprenant et Date d'inscription sont déterminés automatiquement.
  if (String(data.Beneficiaire) === "Oui") {
    const inscId = await nextId(sheets, "INSCRIPTION")
    const isEnfant = String(data.Role) === "Enfant"
    await appendRow(sheets, "INSCRIPTION", {
      "ID": inscId,
      "Personne ID": id,
      "Annee scolaire": data.Annee_Scolaire ?? "",
      "Type apprenant": isEnfant ? "Soutien scolaire" : "FLE",
      "Statut": "EN COURS",
      "Niveau / Classe": isEnfant ? (data.Niveau ?? "") : "",
      "Disponibilite": data.Disponibilite ?? "",
      "Orientation": data.Source_Orientation ?? "",
      "Date d'inscription": new Date().toISOString().split("T")[0],
      "Montant adhesion": data.Montant_Adhesion ?? "",
      "Montant d'inscription": data.Montant_Inscription ?? "",
      "Remarques": data.Remarques ?? "",
    })
  }

  return { ok: true, ID_Membre: String(id) }
}

async function updateMembre(sheets: Sheets, idMembre: string, data: Record<string, unknown>) {
  const pmap: Record<string, unknown> = {}
  if (data.Nom !== undefined)              pmap["Nom"] = data.Nom
  if (data.Prenom !== undefined)           pmap["Prenom"] = data.Prenom
  if (data.Role !== undefined)             pmap["Categorie"] = data.Role
  if (data.Contact_Principal !== undefined) pmap["Contact principal"] = data.Contact_Principal
  if (data.Genre !== undefined)            pmap["Genre"] = data.Genre
  if (data.Date_Naissance !== undefined)   pmap["Date de naissance"] = parseDateFr(String(data.Date_Naissance))
  if (data.Telephone !== undefined)        pmap["Telephone"] = data.Telephone
  if (data.Email !== undefined)            pmap["Email"] = data.Email
  if (data.Pays_Origine !== undefined)     pmap["Pays d'origine"] = data.Pays_Origine
  if (data.Langue_Maternelle !== undefined) pmap["Langue maternelle"] = data.Langue_Maternelle
  if (data.Droit_Image !== undefined)      pmap[COL_DROIT_IMAGE] = data.Droit_Image
  if (data.Charte !== undefined)           pmap["Charte d'engagement"] = data.Charte
  if (data.Beneficiaire !== undefined)     pmap["Beneficiaire"] = data.Beneficiaire
  if (data.Notes !== undefined)            pmap["Commentaire"] = data.Notes

  const updated = await updateRowById(sheets, "PERSONNE", idMembre, pmap)
  if (!updated) return { error: "Personne introuvable" }

  if (
    data.Statut_Inscription !== undefined ||
    data.Niveau !== undefined ||
    data.Type_Apprenant !== undefined ||
    data.Source_Orientation !== undefined ||
    data.Date_Inscription !== undefined
  ) {
    const imap: Record<string, unknown> = {}
    if (data.Statut_Inscription !== undefined) imap["Statut"] = data.Statut_Inscription
    if (data.Niveau !== undefined)             imap["Niveau / Classe"] = data.Niveau
    if (data.Type_Apprenant !== undefined)     imap["Type apprenant"] = data.Type_Apprenant
    if (data.Source_Orientation !== undefined) imap["Orientation"] = data.Source_Orientation
    if (data.Date_Inscription !== undefined)   imap["Date d'inscription"] = parseDateFr(String(data.Date_Inscription))

    const inscriptions = await sheetToObjects(sheets, "INSCRIPTION")
    const persoInsc = inscriptions.filter((i) => String(i["Personne ID"]) === String(idMembre))

    // Le formulaire d'édition envoie ces clés à "" pour un membre sans
    // inscription (Beneficiaire = Non) : ne créer une ligne INSCRIPTION
    // que si au moins une valeur est réellement renseignée.
    const hasValeurInscription = [
      data.Statut_Inscription, data.Niveau, data.Type_Apprenant,
      data.Source_Orientation, data.Date_Inscription,
    ].some((v) => v !== undefined && String(v).trim() !== "")

    if (persoInsc.length > 0) {
      const latest = persoInsc[persoInsc.length - 1]
      await updateRowById(sheets, "INSCRIPTION", String(latest["ID"]), imap)
    } else if (hasValeurInscription) {
      const inscId = await nextId(sheets, "INSCRIPTION")
      await appendRow(sheets, "INSCRIPTION", {
        "ID": inscId,
        "Personne ID": idMembre,
        "Statut": data.Statut_Inscription ?? "",
        "Niveau / Classe": data.Niveau ?? "",
        "Type apprenant": data.Type_Apprenant ?? "",
        "Orientation": data.Source_Orientation ?? "",
        "Date d'inscription": data.Date_Inscription
          ? parseDateFr(String(data.Date_Inscription))
          : new Date().toISOString().split("T")[0],
      })
    }
  }

  return { ok: true }
}

async function deleteMembre(sheets: Sheets, idMembre: string) {
  const inscriptions = await sheetToObjects(sheets, "INSCRIPTION")
  const inscIds = inscriptions
    .filter((i) => String(i["Personne ID"]) === String(idMembre))
    .map((i) => String(i["ID"]))

  await Promise.all([
    inscIds.length > 0 ? deleteRowsWhere(sheets, "PAIEMENT", "Inscription ID", inscIds) : Promise.resolve(0),
    deleteRowsWhere(sheets, "INSCRIPTION", "Personne ID", [String(idMembre)]),
    deleteRowsWhere(sheets, "EVALUATION", "Personne ID", [String(idMembre)]),
    deleteRowsWhere(sheets, "SCOLARITE", "Personne ID", [String(idMembre)]),
  ])

  const deleted = await deleteRowById(sheets, "PERSONNE", idMembre)
  return deleted ? { ok: true } : { error: "Personne introuvable" }
}

// ── ÉCRITURE PAIEMENT ─────────────────────────────────────

async function addPaiement(sheets: Sheets, data: Record<string, unknown>) {
  const id = await nextId(sheets, "PAIEMENT")
  await appendRow(sheets, "PAIEMENT", {
    "ID": id,
    "Inscription ID": data.ID_Inscription ?? "",
    "Date de paiement": parseDateFr(String(data.Date_Paiement ?? "")),
    "Montant": data.Montant ?? "",
    "Mode de paiement": data.Mode_Paiement ?? "",
  })
  return { ok: true, ID_Paiement: String(id) }
}

async function updatePaiement(sheets: Sheets, idPaiement: string, data: Record<string, unknown>) {
  const map: Record<string, unknown> = {}
  if (data.ID_Inscription !== undefined) map["Inscription ID"] = data.ID_Inscription
  if (data.Date_Paiement !== undefined)  map["Date de paiement"] = parseDateFr(String(data.Date_Paiement))
  if (data.Montant !== undefined)        map["Montant"] = data.Montant
  if (data.Mode_Paiement !== undefined)  map["Mode de paiement"] = data.Mode_Paiement
  const ok = await updateRowById(sheets, "PAIEMENT", idPaiement, map)
  return ok ? { ok: true } : { error: "Paiement introuvable" }
}

async function deletePaiement(sheets: Sheets, idPaiement: string) {
  const ok = await deleteRowById(sheets, "PAIEMENT", idPaiement)
  return ok ? { ok: true } : { error: "Paiement introuvable" }
}

// ── ÉCRITURE INSCRIPTION ──────────────────────────────────

async function addInscription(sheets: Sheets, idMembre: string, data: Record<string, unknown>) {
  const inscId = await nextId(sheets, "INSCRIPTION")
  await appendRow(sheets, "INSCRIPTION", {
    "ID": inscId,
    "Personne ID": idMembre,
    "Annee scolaire": data.Annee_Scolaire ?? "",
    "Type apprenant": data.Type_Apprenant ?? "",
    "Statut": "EN COURS",
    "Niveau / Classe": data.Niveau ?? "",
    "Disponibilite": data.Disponibilite ?? "",
    "Orientation": data.Orientation ?? "",
    "Beneficiaire": data.Beneficiaire ?? "",
    "Date d'inscription": new Date().toISOString().split("T")[0],
    "Montant adhesion": data.Montant_Adhesion ?? "",
    "Montant d'inscription": data.Montant_Inscription ?? 30,
    "Remarques": data.Remarques ?? "",
  })
  return { ok: true, ID_Inscription: String(inscId) }
}

async function updateInscription(sheets: Sheets, idInscription: string, data: Record<string, unknown>) {
  const map: Record<string, unknown> = {}
  if (data.Montant_Du !== undefined) {
    await ensureColumn(sheets, "INSCRIPTION", "Montant du")
    map["Montant du"] = data.Montant_Du
  }
  if (data.Montant_Adhesion !== undefined) map["Montant adhesion"] = data.Montant_Adhesion
  if (data.Montant_Inscription !== undefined) {
    await ensureColumn(sheets, "INSCRIPTION", "Montant d'inscription")
    map["Montant d'inscription"] = data.Montant_Inscription
  }
  if (data.Annee_Scolaire !== undefined)   map["Annee scolaire"] = data.Annee_Scolaire
  if (data.Type_Apprenant !== undefined)   map["Type apprenant"] = data.Type_Apprenant
  if (data.Statut !== undefined)           map["Statut"] = data.Statut
  if (data.Niveau !== undefined)           map["Niveau / Classe"] = data.Niveau
  if (data.Disponibilite !== undefined)    map["Disponibilite"] = data.Disponibilite
  if (data.Orientation !== undefined)      map["Orientation"] = data.Orientation
  if (data.Remarques !== undefined)        map["Remarques"] = data.Remarques
  const ok = await updateRowById(sheets, "INSCRIPTION", idInscription, map)
  return ok ? { ok: true } : { error: "Inscription introuvable" }
}

// ── ÉCRITURE ÉVÉNEMENT ────────────────────────────────────

async function addEvenement(sheets: Sheets, data: Record<string, unknown>) {
  const id = await nextId(sheets, "EVENEMENT2")
  await appendRow(sheets, "EVENEMENT2", {
    "ID": id,
    "Titre": data.Titre ?? "",
    "Date": data.Date ? parseDateFr(String(data.Date)) : "",
    "Heure_Debut": data.Heure_Debut ?? "",
    "Heure_Fin": data.Heure_Fin ?? "",
    "Salle": data.Salle ?? "",
    "Animateur": data.Animateur ?? "",
    "Categorie": data.Categorie ?? "",
    "Statut": data.Statut ?? "planifie",
  })
  return { ok: true, ID_Evenement: String(id) }
}

async function updateEvenement(sheets: Sheets, idEvenement: string, data: Record<string, unknown>) {
  const map: Record<string, unknown> = {}
  if (data.Titre !== undefined)      map["Titre"] = data.Titre
  if (data.Date !== undefined)       map["Date"] = parseDateFr(String(data.Date))
  if (data.Heure_Debut !== undefined) map["Heure_Debut"] = data.Heure_Debut
  if (data.Heure_Fin !== undefined)  map["Heure_Fin"] = data.Heure_Fin
  if (data.Salle !== undefined)      map["Salle"] = data.Salle
  if (data.Animateur !== undefined)  map["Animateur"] = data.Animateur
  if (data.Categorie !== undefined)  map["Categorie"] = data.Categorie
  if (data.Statut !== undefined)     map["Statut"] = data.Statut
  const ok = await updateRowById(sheets, "EVENEMENT2", idEvenement, map)
  return ok ? { ok: true } : { error: "Événement introuvable" }
}

async function deleteEvenement(sheets: Sheets, idEvenement: string) {
  const ok = await deleteRowById(sheets, "EVENEMENT2", idEvenement)
  return ok ? { ok: true } : { error: "Événement introuvable" }
}

// ── ÉCRITURE ASSIDUITÉ ────────────────────────────────────

async function addAssiduite(sheets: Sheets, data: Record<string, unknown>) {
  await ensureColumn(sheets, "ASSIDUITE", "Seance ID")
  const id = await nextId(sheets, "ASSIDUITE")
  await appendRow(sheets, "ASSIDUITE", {
    "ID": id,
    "Evenement2 ID": data.ID_Evenement ?? "",
    "Seance ID": data.ID_Seance ?? "",
    "Personne ID": data.ID_Personne ?? "",
    "ETAT": data.Statut ?? "present",
    "Commentaire": data.Notes ?? "",
  })
  return { ok: true, ID_Assiduite: String(id) }
}

async function updateAssiduite(sheets: Sheets, idAssiduite: string, data: Record<string, unknown>) {
  const map: Record<string, unknown> = {}
  if (data.Statut !== undefined) map["ETAT"] = data.Statut
  if (data.Notes !== undefined)  map["Commentaire"] = data.Notes
  const ok = await updateRowById(sheets, "ASSIDUITE", idAssiduite, map)
  return ok ? { ok: true } : { error: "Ligne assiduité introuvable" }
}

async function deleteAssiduite(sheets: Sheets, idAssiduite: string) {
  const ok = await deleteRowById(sheets, "ASSIDUITE", idAssiduite)
  return ok ? { ok: true } : { error: "Ligne assiduité introuvable" }
}

async function upsertAssiduite(
  sheets: Sheets,
  idEvenement: string,
  idPersonne: string,
  statut: string,
  notes?: string,
  idSeance?: string
) {
  await ensureColumn(sheets, "ASSIDUITE", "Seance ID")
  const rows = await sheetToObjects(sheets, "ASSIDUITE")
  // Avec idSeance : une ligne par (séance, personne). Sans idSeance (ancien
  // comportement, émargement au niveau atelier entier) : une ligne par (atelier, personne),
  // en excluant explicitement les lignes déjà rattachées à une séance précise —
  // sinon un émargement "toutes les séances" retrouve et écrase par erreur la
  // ligne d'une séance spécifique (même Evenement2 ID que l'atelier parent).
  const existing = rows.find((r) =>
    String(r["Personne ID"]) === String(idPersonne) &&
    (idSeance
      ? String(r["Seance ID"] ?? "") === String(idSeance)
      : String(r["Evenement2 ID"]) === String(idEvenement) && !String(r["Seance ID"] ?? ""))
  )

  if (existing) {
    const map: Record<string, unknown> = { "ETAT": statut ?? "present" }
    if (notes !== undefined) map["Commentaire"] = notes
    await updateRowById(sheets, "ASSIDUITE", String(existing["ID"]), map)
    return { ok: true, action: "updated", ID_Assiduite: String(existing["ID"]) }
  }

  const id = await nextId(sheets, "ASSIDUITE")
  await appendRow(sheets, "ASSIDUITE", {
    "ID": id,
    "Evenement2 ID": idEvenement,
    "Seance ID": idSeance ?? "",
    "Personne ID": idPersonne,
    "ETAT": statut ?? "present",
    "Commentaire": notes ?? "",
  })
  return { ok: true, action: "created", ID_Assiduite: String(id) }
}

// ── ÉCRITURE ATELIERS ─────────────────────────────────────

function joinList(v: unknown, sep: string): string {
  if (Array.isArray(v)) return v.join(sep)
  return v === undefined || v === null ? "" : String(v)
}

/** Convertit "2026-02-16" (ISO, format du champ <input date>) en "16/02/2026" (FR)
 *  pour un affichage lisible dans le Google Sheet. Laisse la valeur inchangée sinon. */
function isoToFr(v: unknown): string {
  const s = String(v ?? "")
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s
}

/** Remplace les liens (bénéficiaires / intervenants) d'un atelier : on supprime
 *  les lignes existantes de l'atelier puis on ré-insère la nouvelle liste.
 *  `undefined` = on ne touche pas à ce type de lien. */
async function syncAtelierLiens(
  sheets: Sheets,
  idAtelier: string | number,
  beneficiaireIds?: (string | number)[],
  intervenantIds?: (string | number)[],
) {
  if (beneficiaireIds !== undefined) {
    await deleteRowsWhereAll(sheets, "ATELIER_PARTICIPANT", { "Atelier ID": String(idAtelier), "Role": "Beneficiaire" })
    for (const pid of beneficiaireIds) {
      const bid = await nextId(sheets, "ATELIER_PARTICIPANT")
      await appendRow(sheets, "ATELIER_PARTICIPANT", { "ID": bid, "Atelier ID": idAtelier, "Personne ID": pid, "Role": "Beneficiaire" })
    }
  }
  if (intervenantIds !== undefined) {
    await deleteRowsWhereAll(sheets, "ATELIER_PARTICIPANT", { "Atelier ID": String(idAtelier), "Role": "Intervenant" })
    for (const iid of intervenantIds) {
      const rid = await nextId(sheets, "ATELIER_PARTICIPANT")
      await appendRow(sheets, "ATELIER_PARTICIPANT", { "ID": rid, "Atelier ID": idAtelier, "Intervenant ID": iid, "Role": "Intervenant", "Heures": "" })
    }
  }
}

function atelierRow(data: Record<string, unknown>): Record<string, unknown> {
  return {
    // EVENEMENT2 est une table partagée (cours, sortie…) — ce module n'écrit
    // et ne gère que des lignes "atelier".
    "Type": "atelier",
    "Categorie": data.Categorie ?? "",
    "Groupe": data.Groupe ?? "",
    "Nom atelier": data.Titre ?? "",
    "Audience": data.Audience ?? "",
    "Date debut": isoToFr(data.Date_Debut),
    "Date fin": isoToFr(data.Date_Fin),
    "Periode": data.Periode ?? "",
    "Heure debut": data.Heure_Debut ?? "",
    "Heure fin": data.Heure_Fin ?? "",
    "Salle": data.Salle ?? "",
    "Mode groupage": data.Mode_Groupage ?? "",
    "Taille cible": data.Taille_Cible ?? "",
    "Competences ciblees": joinList(data.Competences_Ciblees, ","),
    "Taches": joinList(data.Taches, "\n"),
    "Besoins": joinList(data.Besoins, "\n"),
    "Etapes": joinList(data.Etapes, "\n"),
    "Statut": data.Statut ?? "planifié",
  }
}

async function addAtelier(
  sheets: Sheets,
  data: Record<string, unknown>,
  beneficiaireIds?: (string | number)[],
  intervenantIds?: (string | number)[],
) {
  // "Nom atelier" est une colonne nouvelle (ancien nom : "Titre") — la garantir
  // avant l'écriture, sinon la valeur serait silencieusement ignorée.
  await ensureColumn(sheets, "EVENEMENT2", "Nom atelier")
  const id = await nextId(sheets, "EVENEMENT2")
  await appendRow(sheets, "EVENEMENT2", { "ID": id, "Atelier ID": id, ...atelierRow(data) })
  await syncAtelierLiens(sheets, id, beneficiaireIds ?? [], intervenantIds ?? [])
  return { ok: true, ID_Atelier: String(id) }
}

async function updateAtelier(
  sheets: Sheets,
  idAtelier: string,
  data: Record<string, unknown>,
  beneficiaireIds?: (string | number)[],
  intervenantIds?: (string | number)[],
) {
  await ensureColumn(sheets, "EVENEMENT2", "Nom atelier")
  const updated = await updateRowById(sheets, "EVENEMENT2", idAtelier, atelierRow(data))
  if (!updated) return { error: "Atelier introuvable" }
  await syncAtelierLiens(sheets, idAtelier, beneficiaireIds, intervenantIds)
  return { ok: true }
}

async function deleteAtelier(sheets: Sheets, idAtelier: string) {
  // Cascade : séances rattachées (+ leurs propres liens intervenants/émargement),
  // puis liens bénéficiaires/intervenants + émargement au niveau de l'atelier entier.
  // Les séances sont maintenant des lignes EVENEMENT2 (Type = "Séance") dont
  // "Atelier ID" référence l'atelier parent.
  const evenements = await sheetToObjects(sheets, "EVENEMENT2")
  const idsSeances = evenements
    .filter((s) => String(s["Type"] ?? "").toLowerCase() === "séance" && String(s["Atelier ID"]) === String(idAtelier))
    .map((s) => String(s["Séance ID"] ?? s["ID"]))
  if (idsSeances.length) {
    await deleteRowsWhere(sheets, "ATELIER_PARTICIPANT", "Seance ID", idsSeances)
    await deleteRowsWhere(sheets, "ASSIDUITE", "Seance ID", idsSeances)
    await deleteRowsWhere(sheets, "EVENEMENT2", "Séance ID", idsSeances)
  }
  await deleteRowsWhere(sheets, "ATELIER_PARTICIPANT", "Atelier ID", [String(idAtelier)])
  await deleteRowsWhere(sheets, "ASSIDUITE", "Evenement2 ID", [String(idAtelier)])
  const deleted = await deleteRowById(sheets, "EVENEMENT2", idAtelier)
  return deleted ? { ok: true } : { error: "Atelier introuvable" }
}

// ── SÉANCE ────────────────────────────────────────────────
// Une séance est une occurrence précise d'un atelier (une date, ses propres
// horaires, salle et intervenants). Une séance est une ligne EVENEMENT2 comme
// un atelier, mais avec Type = "Séance" : "Atelier ID" y référence l'atelier
// PARENT (contrairement à une ligne atelier où "Atelier ID" est une
// auto-référence), et "Séance ID" est l'auto-référence de la séance elle-même
// (utilisée par ATELIER_PARTICIPANT/ASSIDUITE pour s'y rattacher).

/** Reconstruit toujours la ligne complète depuis `data` (même convention que
 *  `atelierRow`) : le formulaire séance doit envoyer l'état complet à chaque
 *  sauvegarde, pas un diff partiel — sinon les champs absents sont effacés. */
function seanceRow(id: number, data: Record<string, unknown>): Record<string, unknown> {
  return {
    "Type": "Séance",
    "Atelier ID": data.ID_Atelier ?? "",
    "Séance ID": id,
    "Nom séance": data.Nom ?? "",
    "Date debut": isoToFr(data.Date),
    "Heure debut": data.Heure_Debut ?? "",
    "Heure fin": data.Heure_Fin ?? "",
    "Duree": formatMinutes(minutesFromHeures(data.Heure_Debut, data.Heure_Fin)),
    "Salle": data.Salle ?? "",
    "Statut": data.Statut ?? "planifié",
  }
}

async function getSeances(sheets: Sheets, idAtelier?: string) {
  const [evenements, participants] = await Promise.all([
    sheetToObjects(sheets, "EVENEMENT2"),
    sheetToObjects(sheets, "ATELIER_PARTICIPANT"),
  ])
  return evenements
    .filter((s) => String(s["Type"] ?? "").toLowerCase() === "séance")
    .filter((s) => !idAtelier || String(s["Atelier ID"]) === String(idAtelier))
    .map((s) => {
      const id = String(s["Séance ID"] ?? s["ID"])
      const intervenants = participants
        .filter((l) => l["Role"] === "Intervenant" && String(l["Seance ID"] ?? "") === id)
        .map((l) => ({
          ID_Intervenant: String(l["Intervenant ID"]),
          Heures: l["Heures"] ?? "",
        }))
      return {
        ID_Seance: id,
        ID_Atelier: String(s["Atelier ID"]),
        Nom: s["Nom séance"] ?? "",
        Date: fmtDate(s["Date debut"] as string),
        Heure_Debut: s["Heure debut"] ?? "",
        Heure_Fin: s["Heure fin"] ?? "",
        Salle: s["Salle"] ?? "",
        Statut: s["Statut"] ?? "planifié",
        intervenants,
      }
    })
}

/** Remplace les intervenants (+ heures) rattachés à une séance précise. */
async function syncSeanceIntervenants(
  sheets: Sheets,
  idSeance: string | number,
  entries: { ID_Intervenant: string | number; Heures?: string | number }[]
) {
  await deleteRowsWhereAll(sheets, "ATELIER_PARTICIPANT", { "Seance ID": String(idSeance), "Role": "Intervenant" })
  for (const entry of entries) {
    const rid = await nextId(sheets, "ATELIER_PARTICIPANT")
    await appendRow(sheets, "ATELIER_PARTICIPANT", {
      "ID": rid,
      "Seance ID": idSeance,
      "Intervenant ID": entry.ID_Intervenant,
      "Role": "Intervenant",
      "Heures": entry.Heures ?? "",
    })
  }
}

async function addSeance(
  sheets: Sheets,
  data: Record<string, unknown>,
  intervenants?: { ID_Intervenant: string | number; Heures?: string | number }[],
) {
  await ensureColumn(sheets, "EVENEMENT2", "Duree")
  const id = await nextId(sheets, "EVENEMENT2")
  await appendRow(sheets, "EVENEMENT2", { "ID": id, ...seanceRow(id, data) })
  if (intervenants) await syncSeanceIntervenants(sheets, id, intervenants)
  return { ok: true, ID_Seance: String(id) }
}

async function updateSeance(
  sheets: Sheets,
  idSeance: string,
  data: Record<string, unknown>,
  intervenants?: { ID_Intervenant: string | number; Heures?: string | number }[],
) {
  const updated = await updateRowById(sheets, "EVENEMENT2", idSeance, seanceRow(Number(idSeance), data))
  if (!updated) return { error: "Séance introuvable" }
  if (intervenants) await syncSeanceIntervenants(sheets, idSeance, intervenants)
  return { ok: true }
}

async function deleteSeance(sheets: Sheets, idSeance: string) {
  await deleteRowsWhere(sheets, "ATELIER_PARTICIPANT", "Seance ID", [String(idSeance)])
  await deleteRowsWhere(sheets, "ASSIDUITE", "Seance ID", [String(idSeance)])
  const deleted = await deleteRowById(sheets, "EVENEMENT2", idSeance)
  return deleted ? { ok: true } : { error: "Séance introuvable" }
}

// ── RÉCAP QUANTITATIF — ATELIERS ÉLÈVES ───────────────────
// Une ligne = tous les groupes d'un même type d'atelier (Categorie) qui se
// sont déroulés sur une même période (champ Periode, ex. "Vacances de
// printemps 2026") — cf. modèle papier fourni par l'association. "Combien de
// séances" et "durée de chaque séance" supposent une organisation uniforme
// entre les groupes d'une même période (moyenne arrondie sinon).

interface RecapEleveRow {
  atelier: string
  dates: string
  vacances: string
  combienDeGroupe: number
  combienDeSeances: number
  dureeChaqueSeance: number
  heuresParEleve: number
  nElèves: number
  elementaire6e: number
  collegeLycee: number
  nSalaries: number
  hSalariees: number
  nStagiaires: number
  hStagiaires: number
  nBenevoles: number
  hBenevoles: number
}

function average(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0
}

function parseHeures(v: unknown): number {
  const n = Number(String(v ?? "").replace(",", "."))
  return isNaN(n) ? 0 : n
}

/** "2025-10-20" → "25-26" (même convention que getCurrentAnneeScolaire côté
 *  client : l'année scolaire commence en juillet). */
function anneeScolaireFromIso(iso: string): string {
  const [y, m] = iso.split("-").map(Number)
  if (!y || !m) return ""
  const baseYear = m >= 7 ? y : y - 1
  return `${String(baseYear % 100).padStart(2, "0")}-${String((baseYear + 1) % 100).padStart(2, "0")}`
}

function minutesFromHeures(heureDebut: unknown, heureFin: unknown): number {
  const [h1, m1] = String(heureDebut ?? "").split(":").map(Number)
  const [h2, m2] = String(heureFin ?? "").split(":").map(Number)
  if ([h1, m1, h2, m2].some((n) => isNaN(n))) return 0
  const mins = (h2 * 60 + m2) - (h1 * 60 + m1)
  return mins > 0 ? mins : 0
}

function formatMinutes(mins: number): string {
  if (mins <= 0) return ""
  const rounded = Math.round(mins)
  const h = Math.floor(rounded / 60)
  const m = rounded % 60
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`
}

/** Durée en heures décimales (ex. 90 → 1.5) — format numérique pour
 *  permettre les calculs côté Google Sheet, contrairement à formatMinutes(). */
function minutesToHeures(mins: number): number {
  return Math.round((mins / 60) * 100) / 100
}

async function computeRecapEleves(sheets: Sheets): Promise<RecapEleveRow[]> {
  const [evenements, participants, intervenantsRaw, personnes, inscriptions, assiduite] = await Promise.all([
    sheetToObjects(sheets, "EVENEMENT2"),
    sheetToObjects(sheets, "ATELIER_PARTICIPANT"),
    sheetToObjects(sheets, "INTERVENANT"),
    sheetToObjects(sheets, "PERSONNE"),
    sheetToObjects(sheets, "INSCRIPTION"),
    sheetToObjects(sheets, "ASSIDUITE"),
  ])

  // "Audience" vaut "Eleve"/"Parent" (singulier) dans le Sheet — même convention
  // de détection que côté client (app/ateliers/page.tsx) : tout ce qui ne
  // commence pas par "parent" est un atelier élève.
  const ateliers = evenements.filter((a) =>
    String(a["Type"] ?? "").toLowerCase() === "atelier" &&
    !String(a["Audience"] ?? "").toLowerCase().startsWith("parent")
  )
  // Les séances sont des lignes EVENEMENT2 (Type = "Séance") dont "Atelier ID"
  // référence l'atelier parent (voir seanceRow()/getSeances plus haut).
  const seances = evenements.filter((s) => String(s["Type"] ?? "").toLowerCase() === "séance")

  // Regroupement par (Categorie, Periode).
  const groupes = new Map<string, { categorie: string; periode: string; ateliers: Record<string, unknown>[] }>()
  for (const a of ateliers) {
    const categorie = String(a["Categorie"] ?? "").trim() || "(sans catégorie)"
    const periode = String(a["Periode"] ?? "").trim()
    const key = `${categorie}‖${periode}`
    if (!groupes.has(key)) groupes.set(key, { categorie, periode, ateliers: [] })
    groupes.get(key)!.ateliers.push(a)
  }

  const intervenantTypeById = new Map(intervenantsRaw.map((i) => [String(i["ID"]), String(i["Type"] ?? "")]))
  const inscriptionsByPersonne = new Map<string, Record<string, unknown>[]>()
  for (const p of personnes) {
    const id = String(p["ID"])
    inscriptionsByPersonne.set(id, inscriptions.filter((i) => String(i["Personne ID"]) === id))
  }
  /** Le niveau/classe d'un élève est propre à une année scolaire (une nouvelle
   *  ligne INSCRIPTION est créée à chaque réinscription) — un élève peut donc
   *  changer de classe d'une année sur l'autre. On prend le "Niveau / Classe"
   *  de l'année scolaire DE L'ATELIER concerné, pas la classe actuelle de
   *  l'élève, sinon un atelier passé serait reclassé avec sa classe la plus
   *  récente. Si aucune inscription ne correspond à cette année précise
   *  (donnée manquante), on retombe sur l'inscription la plus récente connue. */
  function niveauClasseAt(personneId: string, anneeScolaire: string): string {
    const insc = inscriptionsByPersonne.get(personneId) ?? []
    const exact = insc.find((i) => String(i["Annee scolaire"] ?? "").trim() === anneeScolaire)
    const retenue = exact ?? inscriptionCourante(insc)
    return retenue ? String(retenue["Niveau / Classe"] ?? "") : ""
  }

  function heuresParType(seanceIds: string[], type: string): { count: number; heures: number } {
    const ids = new Set<string>()
    let heures = 0
    for (const l of participants) {
      if (l["Role"] !== "Intervenant") continue
      if (!seanceIds.includes(String(l["Seance ID"] ?? ""))) continue
      const iid = String(l["Intervenant ID"])
      if (intervenantTypeById.get(iid) !== type) continue
      ids.add(iid)
      heures += parseHeures(l["Heures"])
    }
    return { count: ids.size, heures }
  }

  /** Heures effectivement suivies par un élève sur les séances d'un atelier :
   *  on part du principe qu'un élève d'un groupe assiste à toutes les séances
   *  de son atelier, sauf celles où ASSIDUITE le marque explicitement absent/
   *  excusé pour cette séance précise (pas de ligne ASSIDUITE = présent par
   *  défaut, cf. décision produit). */
  function heuresEleve(personneId: string, seancesAtelier: Record<string, unknown>[]): number {
    let total = 0
    for (const s of seancesAtelier) {
      const sid = String(s["Séance ID"] ?? s["ID"])
      const presence = assiduite.find((a) => String(a["Personne ID"]) === personneId && String(a["Seance ID"] ?? "") === sid)
      const etat = String(presence?.["ETAT"] ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
      if (presence && etat !== "present") continue
      total += minutesFromHeures(s["Heure debut"], s["Heure fin"])
    }
    return total
  }

  const rows: (RecapEleveRow & { _dateTri: string })[] = []
  for (const { categorie, periode, ateliers: groupe } of groupes.values()) {
    const atelierIds = groupe.map((a) => String(a["ID"]))
    const seancesGroupe = seances.filter((s) => atelierIds.includes(String(s["Atelier ID"])))
    const seanceIds = seancesGroupe.map((s) => String(s["Séance ID"] ?? s["ID"]))

    const datesIso = groupe
      .flatMap((a) => [parseDateFr(String(a["Date debut"] ?? "")), parseDateFr(String(a["Date fin"] ?? ""))])
      .filter(Boolean)
    const dateDebutMin = datesIso.length ? datesIso.reduce((a, b) => (a < b ? a : b)) : ""
    const dateFinMax = datesIso.length ? datesIso.reduce((a, b) => (a > b ? a : b)) : ""
    const datesLabel = dateDebutMin
      ? (dateFinMax && dateFinMax !== dateDebutMin ? `${fmtDateFr(dateDebutMin)} – ${fmtDateFr(dateFinMax)}` : fmtDateFr(dateDebutMin))
      : ""

    const nbSeancesParAtelier = atelierIds.map((id) => seances.filter((s) => String(s["Atelier ID"]) === id).length)
    const nbSeancesMoyen = Math.round(average(nbSeancesParAtelier))

    const dureesMinutes = seancesGroupe
      .map((s) => minutesFromHeures(s["Heure debut"], s["Heure fin"]))
      .filter((m) => m > 0)
    const dureeMoyenneMin = average(dureesMinutes)

    const beneficiaireIds = new Set(
      participants
        .filter((l) => l["Role"] === "Beneficiaire" && atelierIds.includes(String(l["Atelier ID"] ?? "")))
        .map((l) => String(l["Personne ID"]))
    )
    const anneeScolaireGroupe = anneeScolaireFromIso(dateDebutMin)
    let elementaire6e = 0, collegeLycee = 0
    for (const pid of beneficiaireIds) {
      const niveau = niveauEcole(niveauClasseAt(pid, anneeScolaireGroupe))
      if (niveau === "elementaire" || niveau === "6e") elementaire6e++
      else if (niveau === "college" || niveau === "lycee") collegeLycee++
    }

    // Heures/élève : moyenne, sur tous les élèves de tous les ateliers (groupes)
    // du bucket, de leurs heures réellement suivies (séances de LEUR atelier,
    // absences déduites) — pas une estimation uniforme du bucket entier.
    const heuresParEleveIndiv: number[] = []
    for (const a of groupe) {
      const aid = String(a["ID"])
      const seancesAtelier = seances.filter((s) => String(s["Atelier ID"]) === aid)
      const elevesAtelier = participants
        .filter((l) => l["Role"] === "Beneficiaire" && String(l["Atelier ID"] ?? "") === aid)
        .map((l) => String(l["Personne ID"]))
      for (const pid of elevesAtelier) heuresParEleveIndiv.push(heuresEleve(pid, seancesAtelier))
    }

    const salaries = heuresParType(seanceIds, "Salarié·e")
    const stagiaires = heuresParType(seanceIds, "Stagiaire")
    const benevoles = heuresParType(seanceIds, "Bénévole")

    rows.push({
      atelier: categorie,
      dates: datesLabel,
      vacances: periode,
      combienDeGroupe: atelierIds.length,
      combienDeSeances: nbSeancesMoyen,
      dureeChaqueSeance: minutesToHeures(dureeMoyenneMin),
      heuresParEleve: minutesToHeures(average(heuresParEleveIndiv)),
      nElèves: beneficiaireIds.size,
      elementaire6e,
      collegeLycee,
      nSalaries: salaries.count,
      hSalariees: salaries.heures,
      nStagiaires: stagiaires.count,
      hStagiaires: stagiaires.heures,
      nBenevoles: benevoles.count,
      hBenevoles: benevoles.heures,
      _dateTri: dateDebutMin,
    })
  }

  return rows
    .sort((a, b) => b._dateTri.localeCompare(a._dateTri) || a.atelier.localeCompare(b.atelier))
    .map(({ _dateTri, ...r }) => r)
}

/** "1989-03-14" → "14/03/1989". */
function fmtDateFr(iso: string): string {
  const [y, m, d] = iso.split("-")
  return d && m && y ? `${d}/${m}/${y}` : iso
}

const RECAP_ELEVES_HEADERS = [
  "atelier", "dates de l'atelier", "vacances", "combien de groupe", "combien de séances",
  "durée de chaque séance", "combien d'heures par élève", "n d'élèves", "élémentaires-6e",
  "collège-lycée", "n de salariés impliqués", "n d'heures salariées", "n de stagiaires impliqués",
  "n d'heures stagiaires", "n bénévoles impliqués", "n d'heures total bénévol",
]

function toCsvValue(v: string | number): string {
  const s = String(v ?? "")
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function recapEleveToCsvRow(r: RecapEleveRow): (string | number)[] {
  return [
    r.atelier, r.dates, r.vacances, r.combienDeGroupe, r.combienDeSeances,
    r.dureeChaqueSeance, r.heuresParEleve, r.nElèves, r.elementaire6e,
    r.collegeLycee, r.nSalaries, r.hSalariees, r.nStagiaires,
    r.hStagiaires, r.nBenevoles, r.hBenevoles,
  ]
}

async function exportRecapEleves(sheets: Sheets) {
  const rows = await computeRecapEleves(sheets)
  const lines = [RECAP_ELEVES_HEADERS, ...rows.map(recapEleveToCsvRow)]
    .map((line) => line.map(toCsvValue).join(";"))
  const csv = "﻿" + lines.join("\r\n") // BOM : Excel doit lire les accents en UTF-8
  const base64 = Buffer.from(csv, "utf8").toString("base64")

  const horodatage = new Date().toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })
    .replace(/\//g, "-").replace(":", "h").replace(", ", " ")
  const nomFichier = `Récap élèves - ${horodatage}.csv`

  const { url } = await uploadToDrive(nomFichier, "text/csv", base64, BILAN_ATELIER_FOLDER_ID)
  return { ok: true, url, nomFichier }
}

// ── Helpers mapping ───────────────────────────────────────

function mapMembre(p: Record<string, unknown>, inscriptions: Record<string, unknown>[]) {
  const insc = inscriptions.filter((i) => String(i["Personne ID"]) === String(p["ID"]))
  const d = insc.length > 0 ? insc[insc.length - 1] : null
  return {
    ID_Membre: String(p["ID"]),
    ID_Famille: String(p["Famille ID"]),
    Nom: p["Nom"],
    Prenom: p["Prenom"],
    Role: p["Categorie"],
    Contact_Principal: p["Contact principal"],
    Genre: p["Genre"],
    Date_Naissance: fmtDate(p["Date de naissance"] as string),
    Langue_Maternelle: p["Langue maternelle"],
    Pays_Origine: p["Pays d'origine"],
    Telephone: p["Telephone"],
    Email: p["Email"],
    WhatsApp: "",
    Droit_Image: p[COL_DROIT_IMAGE],
    Charte: p["Charte d'engagement"],
    Beneficiaire: p["Beneficiaire"],
    Statut_Inscription: d ? d["Statut"] : "",
    Niveau: d ? d["Niveau / Classe"] : "",
    Type_Apprenant: d ? d["Type apprenant"] : "",
    Source_Orientation: d ? d["Orientation"] : "",
    Date_Inscription: d ? fmtDate(d["Date d'inscription"] as string) : "",
    Nb_Enfants: "",
    Notes: p["Commentaire"] ?? "",
  }
}

function mapInscription(i: Record<string, unknown>) {
  return {
    ID_Inscription: String(i["ID"]),
    ID_Membre: String(i["Personne ID"]),
    Annee_Scolaire: i["Annee scolaire"],
    Type_Apprenant: i["Type apprenant"],
    Statut: i["Statut"],
    Niveau: i["Niveau / Classe"],
    Disponibilite: i["Disponibilite"],
    Orientation: i["Orientation"],
    Date_Inscription: fmtDate(i["Date d'inscription"] as string),
    Montant_Adhesion: i["Montant adhesion"],
    Montant_Inscription: i["Montant d'inscription"] !== undefined && i["Montant d'inscription"] !== "" ? i["Montant d'inscription"] : "",
    Montant_Du: i["Montant du"] !== undefined && i["Montant du"] !== "" ? i["Montant du"] : "",
    Remarques: i["Remarques"],
  }
}

function joinAdresse(f: Record<string, unknown>): string {
  const parts: string[] = []
  if (f["Adresse"]) parts.push(String(f["Adresse"]))
  const cpVille = [f["Code postal"], f["Ville"]].filter(Boolean).join(" ")
  if (cpVille) parts.push(cpVille)
  return parts.join(", ")
}
