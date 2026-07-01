import { NextRequest, NextResponse } from "next/server"
import {
  getSheetsClient, SPREADSHEET_ID,
  sheetToObjects, appendRow, updateRowById, deleteRowById, deleteRowsWhere, nextId, fmtDate, parseDateFr, ensureColumn,
} from "@/lib/google-sheets-server"

type Sheets = ReturnType<typeof getSheetsClient>

// ── Réponses ──────────────────────────────────────────────

function ok(data: unknown) {
  return NextResponse.json(data)
}
function err(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

// ── GET ───────────────────────────────────────────────────

export async function GET(request: NextRequest) {
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
      case "getMembre":
        return ok(await getMembre(sheets, searchParams.get("idMembre")!))
      case "getPaiements":
        return ok(await getPaiements(sheets, searchParams.get("idMembre")!))
      case "getEvenements":
        return ok(await getEvenements(sheets, searchParams.get("categorie") ?? undefined))
      case "getAssiduite":
        return ok(await getAssiduite(sheets, searchParams.get("idEvenement") ?? undefined, searchParams.get("idPersonne") ?? undefined))
      case "getAteliers":
        return ok(await getAteliers(sheets, searchParams.get("audience") ?? undefined))
      case "getIntervenants":
        return ok(await getIntervenants(sheets))
      case "getBeneficiaires":
        return ok(await getBeneficiaires(sheets, searchParams.get("audience") ?? undefined))
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
      case "updateInscription": return ok(await updateInscription(sheets, body.idInscription, body.data))
      case "addEvenement":    return ok(await addEvenement(sheets, body.data))
      case "updateEvenement": return ok(await updateEvenement(sheets, body.idEvenement, body.data))
      case "deleteEvenement": return ok(await deleteEvenement(sheets, body.idEvenement))
      case "addAssiduite":    return ok(await addAssiduite(sheets, body.data))
      case "updateAssiduite": return ok(await updateAssiduite(sheets, body.idAssiduite, body.data))
      case "deleteAssiduite": return ok(await deleteAssiduite(sheets, body.idAssiduite))
      case "upsertAssiduite": return ok(await upsertAssiduite(sheets, body.idEvenement, body.idPersonne, body.statut, body.notes))
      case "addAtelier":      return ok(await addAtelier(sheets, body.data, body.beneficiaireIds, body.intervenantIds))
      case "updateAtelier":   return ok(await updateAtelier(sheets, body.idAtelier, body.data, body.beneficiaireIds, body.intervenantIds))
      case "deleteAtelier":   return ok(await deleteAtelier(sheets, body.idAtelier))
      default:
        return err(`Action inconnue : ${action}`)
    }
  } catch (e) {
    console.error("[sheets/POST]", action, e)
    return err(String(e), 500)
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
  const rows = await sheetToObjects(sheets, "EVENEMENT")
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

async function getAssiduite(sheets: Sheets, idEvenement?: string, idPersonne?: string) {
  const rows = await sheetToObjects(sheets, "ASSIDUITE")
  return rows
    .filter((r) => {
      const matchE = !idEvenement || String(r["Evenement ID"]) === String(idEvenement)
      const matchP = !idPersonne  || String(r["Personne ID"])  === String(idPersonne)
      return matchE && matchP
    })
    .map((r) => ({
      ID_Assiduite: String(r["ID"]),
      ID_Evenement: String(r["Evenement ID"]),
      ID_Personne:  String(r["Personne ID"]),
      Statut: r["ETAT"] ?? "present",
      Notes: r["Commentaire"] ?? "",
    }))
}

// ── LECTURE ATELIERS ──────────────────────────────────────

async function getAteliers(sheets: Sheets, audience?: string) {
  const [ateliers, benefLinks, intervLinks] = await Promise.all([
    sheetToObjects(sheets, "ATELIER"),
    sheetToObjects(sheets, "ATELIER_BENEFICIAIRE"),
    sheetToObjects(sheets, "ATELIER_INTERVENANT"),
  ])
  return ateliers
    .filter((a) => !audience || String(a["Audience"]).toLowerCase() === audience.toLowerCase())
    .map((a) => {
      const id = String(a["ID"])
      const beneficiaireIds = Array.from(new Set(
        benefLinks
          .filter((l) => String(l["Atelier ID"]) === id)
          .map((l) => String(l["Personne ID"]))
      ))
      const intervenants = intervLinks
        .filter((l) => String(l["Atelier ID"]) === id)
        .map((l) => ({
          ID_Intervenant: String(l["Intervenant ID"]),
          Heures: l["Heures"] ?? "",
          Role: l["Role"] ?? "",
        }))
      const competences = String(a["Competences ciblees"] ?? "")
        .split(",").map((s) => s.trim()).filter(Boolean)
      return {
        ID_Atelier: id,
        Categorie: a["Categorie"] ?? "",
        Groupe: a["Groupe"] ?? "",
        Titre: a["Titre"] ?? "",
        Audience: a["Audience"] ?? "",
        Date_Debut: fmtDate(a["Date debut"] as string),
        Date_Fin: fmtDate(a["Date fin"] as string),
        Periode: a["Periode"] ?? "",
        Heure_Debut: a["Heure debut"] ?? "",
        Heure_Fin: a["Heure fin"] ?? "",
        Salle: a["Salle"] ?? "",
        Mode_Groupage: a["Mode groupage"] ?? "",
        Taille_Cible: a["Taille cible"] ?? "",
        Ratio_Encadrement: a["Ratio encadrement"] ?? "",
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

/** Bénéficiaires (élèves/parents) prêts pour la composition de groupes :
 *  type, statut, disponibilité, niveau + les 4 notes du dernier positionnement. */
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
      const evals = evaluations.filter((e) => String(e["Personne ID"]) === id)
      const lastEval = evals.length > 0 ? evals[evals.length - 1] : null
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
        Niveau_CECRL: lastEval ? (lastEval["Niveau attribue"] ?? "") : "",
        notes: {
          comprehensionEcrite: numOrNull(lastEval?.["Note comprehension ecrite"]),
          comprehensionOrale:  numOrNull(lastEval?.["Note comprehension orale"]),
          expressionEcrite:    numOrNull(lastEval?.["Note expression ecrite"]),
          expressionOrale:     numOrNull(lastEval?.["Note expression orale"]),
        },
      }
    })
    .filter((b) => !audience || (audience === "parents" ? b.type === "parent" : b.type === "eleve"))
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
    "Droit a l'image": data.Droit_Image ?? "",
    "Charte d'engagement": data.Charte ?? "",
    "Commentaire": data.Notes ?? "",
  })

  if (data.Niveau || data.Statut_Inscription) {
    const inscId = await nextId(sheets, "INSCRIPTION")
    await appendRow(sheets, "INSCRIPTION", {
      "ID": inscId,
      "Personne ID": id,
      "Annee scolaire": data.Annee_Scolaire ?? "",
      "Type apprenant": data.Type_Apprenant ?? "",
      "Statut": data.Statut_Inscription ?? "",
      "Niveau / Classe": data.Niveau ?? "",
      "Orientation": data.Source_Orientation ?? "",
      "Date d'inscription": new Date().toISOString().split("T")[0],
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
  if (data.Droit_Image !== undefined)      pmap["Droit a l'image"] = data.Droit_Image
  if (data.Charte !== undefined)           pmap["Charte d'engagement"] = data.Charte
  if (data.Notes !== undefined)            pmap["Commentaire"] = data.Notes

  const updated = await updateRowById(sheets, "PERSONNE", idMembre, pmap)
  if (!updated) return { error: "Personne introuvable" }

  if (
    data.Statut_Inscription !== undefined ||
    data.Niveau !== undefined ||
    data.Type_Apprenant !== undefined ||
    data.Source_Orientation !== undefined
  ) {
    const imap: Record<string, unknown> = {}
    if (data.Statut_Inscription !== undefined) imap["Statut"] = data.Statut_Inscription
    if (data.Niveau !== undefined)             imap["Niveau / Classe"] = data.Niveau
    if (data.Type_Apprenant !== undefined)     imap["Type apprenant"] = data.Type_Apprenant
    if (data.Source_Orientation !== undefined) imap["Orientation"] = data.Source_Orientation

    const inscriptions = await sheetToObjects(sheets, "INSCRIPTION")
    const persoInsc = inscriptions.filter((i) => String(i["Personne ID"]) === String(idMembre))

    if (persoInsc.length > 0) {
      const latest = persoInsc[persoInsc.length - 1]
      await updateRowById(sheets, "INSCRIPTION", String(latest["ID"]), imap)
    } else {
      const inscId = await nextId(sheets, "INSCRIPTION")
      await appendRow(sheets, "INSCRIPTION", {
        "ID": inscId,
        "Personne ID": idMembre,
        "Statut": data.Statut_Inscription ?? "",
        "Niveau / Classe": data.Niveau ?? "",
        "Type apprenant": data.Type_Apprenant ?? "",
        "Orientation": data.Source_Orientation ?? "",
        "Date d'inscription": new Date().toISOString().split("T")[0],
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

async function updateInscription(sheets: Sheets, idInscription: string, data: Record<string, unknown>) {
  const map: Record<string, unknown> = {}
  if (data.Montant_Du !== undefined) {
    await ensureColumn(sheets, "INSCRIPTION", "Montant du")
    map["Montant du"] = data.Montant_Du
  }
  if (data.Montant_Adhesion !== undefined) map["Montant adhesion"] = data.Montant_Adhesion
  if (data.Statut !== undefined)           map["Statut"] = data.Statut
  if (data.Niveau !== undefined)           map["Niveau / Classe"] = data.Niveau
  const ok = await updateRowById(sheets, "INSCRIPTION", idInscription, map)
  return ok ? { ok: true } : { error: "Inscription introuvable" }
}

// ── ÉCRITURE ÉVÉNEMENT ────────────────────────────────────

async function addEvenement(sheets: Sheets, data: Record<string, unknown>) {
  const id = await nextId(sheets, "EVENEMENT")
  await appendRow(sheets, "EVENEMENT", {
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
  const ok = await updateRowById(sheets, "EVENEMENT", idEvenement, map)
  return ok ? { ok: true } : { error: "Événement introuvable" }
}

async function deleteEvenement(sheets: Sheets, idEvenement: string) {
  const ok = await deleteRowById(sheets, "EVENEMENT", idEvenement)
  return ok ? { ok: true } : { error: "Événement introuvable" }
}

// ── ÉCRITURE ASSIDUITÉ ────────────────────────────────────

async function addAssiduite(sheets: Sheets, data: Record<string, unknown>) {
  const id = await nextId(sheets, "ASSIDUITE")
  await appendRow(sheets, "ASSIDUITE", {
    "ID": id,
    "Evenement ID": data.ID_Evenement ?? "",
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
  notes?: string
) {
  const rows = await sheetToObjects(sheets, "ASSIDUITE")
  const existing = rows.find(
    (r) =>
      String(r["Evenement ID"]) === String(idEvenement) &&
      String(r["Personne ID"]) === String(idPersonne)
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
    "Evenement ID": idEvenement,
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
    await deleteRowsWhere(sheets, "ATELIER_BENEFICIAIRE", "Atelier ID", [String(idAtelier)])
    for (const pid of beneficiaireIds) {
      const bid = await nextId(sheets, "ATELIER_BENEFICIAIRE")
      await appendRow(sheets, "ATELIER_BENEFICIAIRE", { "ID": bid, "Atelier ID": idAtelier, "Personne ID": pid })
    }
  }
  if (intervenantIds !== undefined) {
    await deleteRowsWhere(sheets, "ATELIER_INTERVENANT", "Atelier ID", [String(idAtelier)])
    for (const iid of intervenantIds) {
      const rid = await nextId(sheets, "ATELIER_INTERVENANT")
      await appendRow(sheets, "ATELIER_INTERVENANT", { "ID": rid, "Atelier ID": idAtelier, "Intervenant ID": iid, "Heures": "", "Role": "" })
    }
  }
}

function atelierRow(data: Record<string, unknown>): Record<string, unknown> {
  return {
    "Categorie": data.Categorie ?? "",
    "Groupe": data.Groupe ?? "",
    "Titre": data.Titre ?? "",
    "Audience": data.Audience ?? "",
    "Date debut": isoToFr(data.Date_Debut),
    "Date fin": isoToFr(data.Date_Fin),
    "Periode": data.Periode ?? "",
    "Heure debut": data.Heure_Debut ?? "",
    "Heure fin": data.Heure_Fin ?? "",
    "Salle": data.Salle ?? "",
    "Mode groupage": data.Mode_Groupage ?? "",
    "Taille cible": data.Taille_Cible ?? "",
    "Ratio encadrement": data.Ratio_Encadrement ?? "",
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
  const id = await nextId(sheets, "ATELIER")
  await appendRow(sheets, "ATELIER", { "ID": id, ...atelierRow(data) })
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
  const updated = await updateRowById(sheets, "ATELIER", idAtelier, atelierRow(data))
  if (!updated) return { error: "Atelier introuvable" }
  await syncAtelierLiens(sheets, idAtelier, beneficiaireIds, intervenantIds)
  return { ok: true }
}

async function deleteAtelier(sheets: Sheets, idAtelier: string) {
  await Promise.all([
    deleteRowsWhere(sheets, "ATELIER_BENEFICIAIRE", "Atelier ID", [String(idAtelier)]),
    deleteRowsWhere(sheets, "ATELIER_INTERVENANT", "Atelier ID", [String(idAtelier)]),
  ])
  const deleted = await deleteRowById(sheets, "ATELIER", idAtelier)
  return deleted ? { ok: true } : { error: "Atelier introuvable" }
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
    Droit_Image: p["Droit a l'image"],
    Charte: p["Charte d'engagement"],
    Statut_Inscription: d ? d["Statut"] : "",
    Niveau: d ? d["Niveau / Classe"] : "",
    Type_Apprenant: d ? d["Type apprenant"] : "",
    Source_Orientation: d ? d["Orientation"] : "",
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
    Beneficiaire: i["Beneficiaire"],
    Montant_Adhesion: i["Montant adhesion"],
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
