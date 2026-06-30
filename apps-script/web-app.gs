// Web App — CRM relationnel BDD_Asso_CRM (lecture + ecriture)
// Tables : FAMILLE / PERSONNE / INSCRIPTION / PAIEMENT / EVALUATION / SCOLARITE / ETABLISSEMENT / PROFESSEUR / EVENEMENT / ASSIDUITE
// L'etat civil vit dans PERSONNE ; le niveau/statut vit dans INSCRIPTION.

const SHEET_ID = "1bOISBPwoU1xa5R4Um0fRASXKFeclJ8jB3A3CUHBMlI8";

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || "ping";
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var result;
    if (action === "ping")           result = { ok: true, message: "API CRM operationnelle", base: ss.getName() };
    else if (action === "inspectSheets") result = inspectSheets(ss);
    else if (action === "getFamilles")   result = getFamilles(ss);
    else if (action === "getMembres")    result = getMembres(ss, e.parameter.idFamille);
    else if (action === "getMembre")     result = getMembre(ss, e.parameter.idMembre);
    else if (action === "getPaiements")  result = getPaiements(ss, e.parameter.idMembre);
    else if (action === "getTaches")     result = getTaches(ss, e.parameter.cibleType, e.parameter.cibleId);
    else if (action === "getEvenements") result = getEvenements(ss, e.parameter.categorie);
    else if (action === "getAssiduite")  result = getAssiduite(ss, e.parameter.idEvenement, e.parameter.idPersonne);
    else result = { error: "Action inconnue : " + action };
    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ error: String(err) });
  }
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var a = body.action, result;
    if (a === "addFamille")              result = addFamille(ss, body.data);
    else if (a === "updateFamille")      result = updateFamille(ss, body.idFamille, body.data);
    else if (a === "addMembre")          result = addMembre(ss, body.data);
    else if (a === "updateMembre")       result = updateMembre(ss, body.idMembre, body.data);
    else if (a === "deleteMembre")       result = deleteMembre(ss, body.idMembre);
    else if (a === "ensureCommentaireColumn") result = ensureCommentaireColumn(ss);
    else if (a === "ensureTacheSheet")   result = ensureTacheSheet(ss);
    else if (a === "addTache")           result = addTache(ss, body.data);
    else if (a === "updateTache")        result = updateTache(ss, body.idTache, body.data);
    else if (a === "deleteTache")        result = deleteTache(ss, body.idTache);
    else if (a === "addEvenement")       result = addEvenement(ss, body.data);
    else if (a === "updateEvenement")    result = updateEvenement(ss, body.idEvenement, body.data);
    else if (a === "deleteEvenement")    result = deleteEvenement(ss, body.idEvenement);
    else if (a === "addAssiduite")       result = addAssiduite(ss, body.data);
    else if (a === "updateAssiduite")    result = updateAssiduite(ss, body.idAssiduite, body.data);
    else if (a === "deleteAssiduite")    result = deleteAssiduite(ss, body.idAssiduite);
    else if (a === "upsertAssiduite")    result = upsertAssiduite(ss, body.idEvenement, body.idPersonne, body.statut, body.notes);
    else if (a === "seedEvenements")     result = seedEvenements(ss);
    else if (a === "seedAssiduite")      result = seedAssiduite(ss);
    else result = { error: "Action inconnue : " + a };
    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ error: String(err) });
  }
}

// ── LECTURE / mapping ─────────────────────────────────────

function getFamilles(ss) {
  var familles = sheetToObjects(ss, "FAMILLE");
  var personnes = sheetToObjects(ss, "PERSONNE");
  var inscriptions = sheetToObjects(ss, "INSCRIPTION");
  return familles.map(function(f) {
    var membresF = personnes
      .filter(function(p) { return String(p["Famille ID"]) === String(f["ID"]); })
      .map(function(p) { return mapMembre(p, inscriptions); });
    return {
      ID_Famille: String(f["ID"]),
      Nom_Famille: f["Nom"],
      Adresse: f["Adresse"] || "",
      Code_Postal: f["Code postal"] ? String(f["Code postal"]) : "",
      Ville: f["Ville"] || "",
      Adresse_Complete: joinAdresse(f),
      Quartier_QVP: f["Quartier QVP"],
      Notes: f["Commentaire"] || "",
      Nb_Membres: membresF.length,
      Date_Creation: "",
      membres: membresF,
      statut: membresF.length > 0 ? membresF[0].Statut_Inscription : "",
      nbMembres: membresF.length
    };
  });
}

function getMembres(ss, idFamille) {
  var personnes = sheetToObjects(ss, "PERSONNE");
  var inscriptions = sheetToObjects(ss, "INSCRIPTION");
  var membres = personnes.map(function(p) { return mapMembre(p, inscriptions); });
  if (idFamille) return membres.filter(function(m) { return m.ID_Famille === String(idFamille); });
  return membres;
}

function getMembre(ss, idMembre) {
  var personnes = sheetToObjects(ss, "PERSONNE");
  var inscriptions = sheetToObjects(ss, "INSCRIPTION");
  var p = personnes.filter(function(x) { return String(x["ID"]) === String(idMembre); })[0];
  if (!p) return { error: "Personne introuvable" };
  var membre = mapMembre(p, inscriptions);
  membre.inscriptions = inscriptions
    .filter(function(i) { return String(i["Personne ID"]) === String(idMembre); })
    .map(function(i) { return mapInscription(i); });
  membre.paiements = getPaiements(ss, idMembre);
  membre.evaluations = sheetToObjects(ss, "EVALUATION")
    .filter(function(ev) { return String(ev["Personne ID"]) === String(idMembre); })
    .map(function(ev) {
      return {
        ID: String(ev["ID"]), Date: fmtDate(ev["Date"]), Niveau: ev["Niveau attribue"],
        Comprehension_Ecrite: ev["Note comprehension ecrite"], Comprehension_Orale: ev["Note comprehension orale"],
        Expression_Ecrite: ev["Note expression ecrite"], Expression_Orale: ev["Note expression orale"],
        Evaluateur: ev["Evaluateur"]
      };
    });
  return membre;
}

function getPaiements(ss, idMembre) {
  var inscriptions = sheetToObjects(ss, "INSCRIPTION");
  var paiements = sheetToObjects(ss, "PAIEMENT");
  var inscIds = inscriptions
    .filter(function(i) { return String(i["Personne ID"]) === String(idMembre); })
    .map(function(i) { return String(i["ID"]); });
  return paiements
    .filter(function(pay) { return inscIds.indexOf(String(pay["Inscription ID"])) >= 0; })
    .map(function(pay) {
      return {
        ID_Paiement: String(pay["ID"]), ID_Membre: String(idMembre),
        Date_Paiement: fmtDate(pay["Date de paiement"]), Montant: pay["Montant"],
        Mode_Paiement: pay["Mode de paiement"],
        Date_Depot_Banque: fmtDate(pay["Date de depot banque"]),
        Date_Virement: fmtDate(pay["Date de virement"])
      };
    });
}

// ── ECRITURE ──────────────────────────────────────────────

function addFamille(ss, data) {
  var sh = ss.getSheetByName("FAMILLE");
  var id = nextId(sh);
  appendByHeader(sh, {
    "ID": id, "Nom": data.Nom_Famille || "", "Adresse": data.Adresse || "",
    "Code postal": data.Code_Postal || "", "Ville": data.Ville || "",
    "Quartier QVP": data.Quartier_QVP || ""
  });
  return { ok: true, ID_Famille: String(id) };
}

function updateFamille(ss, idFamille, data) {
  var sh = ss.getSheetByName("FAMILLE");
  var map = {};
  if (data.Nom_Famille !== undefined) map["Nom"] = data.Nom_Famille;
  if (data.Adresse !== undefined) map["Adresse"] = data.Adresse;
  if (data.Code_Postal !== undefined) map["Code postal"] = data.Code_Postal;
  if (data.Ville !== undefined) map["Ville"] = data.Ville;
  if (data.Quartier_QVP !== undefined) map["Quartier QVP"] = data.Quartier_QVP;
  if (data.Notes !== undefined) map["Commentaire"] = data.Notes;
  var ok = updateRowByHeader(sh, idFamille, map);
  return ok ? { ok: true } : { error: "Famille introuvable" };
}

function addMembre(ss, data) {
  var shP = ss.getSheetByName("PERSONNE");
  var id = nextId(shP);
  appendByHeader(shP, {
    "ID": id, "Famille ID": data.ID_Famille, "Categorie": data.Role || "Adulte",
    "Contact principal": data.Contact_Principal || "", "Nom": data.Nom || "", "Prenom": data.Prenom || "",
    "Genre": data.Genre || "", "Date de naissance": parseDateFr(data.Date_Naissance),
    "Telephone": data.Telephone || "", "Email": data.Email || "",
    "Pays d'origine": data.Pays_Origine || "", "Langue maternelle": data.Langue_Maternelle || "",
    "Droit a l'image": data.Droit_Image || "", "Charte d'engagement": data.Charte || "",
    "Commentaire": data.Notes || ""
  });
  // Cree une inscription si un niveau ou un statut est fourni
  if (data.Niveau || data.Statut_Inscription) {
    var shI = ss.getSheetByName("INSCRIPTION");
    appendByHeader(shI, {
      "ID": nextId(shI), "Personne ID": id, "Annee scolaire": data.Annee_Scolaire || "",
      "Type apprenant": data.Type_Apprenant || "", "Statut": data.Statut_Inscription || "",
      "Niveau / Classe": data.Niveau || "", "Orientation": data.Source_Orientation || "",
      "Date d'inscription": new Date()
    });
  }
  return { ok: true, ID_Membre: String(id) };
}

function updateMembre(ss, idMembre, data) {
  var shP = ss.getSheetByName("PERSONNE");
  var pmap = {};
  if (data.Nom !== undefined) pmap["Nom"] = data.Nom;
  if (data.Prenom !== undefined) pmap["Prenom"] = data.Prenom;
  if (data.Role !== undefined) pmap["Categorie"] = data.Role;
  if (data.Contact_Principal !== undefined) pmap["Contact principal"] = data.Contact_Principal;
  if (data.Genre !== undefined) pmap["Genre"] = data.Genre;
  if (data.Date_Naissance !== undefined) pmap["Date de naissance"] = parseDateFr(data.Date_Naissance);
  if (data.Telephone !== undefined) pmap["Telephone"] = data.Telephone;
  if (data.Email !== undefined) pmap["Email"] = data.Email;
  if (data.Pays_Origine !== undefined) pmap["Pays d'origine"] = data.Pays_Origine;
  if (data.Langue_Maternelle !== undefined) pmap["Langue maternelle"] = data.Langue_Maternelle;
  if (data.Droit_Image !== undefined) pmap["Droit a l'image"] = data.Droit_Image;
  if (data.Charte !== undefined) pmap["Charte d'engagement"] = data.Charte;
  if (data.Notes !== undefined) pmap["Commentaire"] = data.Notes;
  var ok = updateRowByHeader(shP, idMembre, pmap);
  if (!ok) return { error: "Personne introuvable" };

  // Niveau / statut / orientation -> INSCRIPTION (derniere, sinon on en cree une)
  if (data.Statut_Inscription !== undefined || data.Niveau !== undefined ||
      data.Type_Apprenant !== undefined || data.Source_Orientation !== undefined) {
    var shI = ss.getSheetByName("INSCRIPTION");
    var imap = {};
    if (data.Statut_Inscription !== undefined) imap["Statut"] = data.Statut_Inscription;
    if (data.Niveau !== undefined) imap["Niveau / Classe"] = data.Niveau;
    if (data.Type_Apprenant !== undefined) imap["Type apprenant"] = data.Type_Apprenant;
    if (data.Source_Orientation !== undefined) imap["Orientation"] = data.Source_Orientation;
    var rowIdx = findLatestRowBy(shI, "Personne ID", idMembre);
    if (rowIdx > 0) {
      var headers = shI.getRange(1, 1, 1, shI.getLastColumn()).getValues()[0];
      Object.keys(imap).forEach(function(h) {
        var c = headers.indexOf(h);
        if (c >= 0) shI.getRange(rowIdx + 1, c + 1).setValue(imap[h]);
      });
    } else {
      appendByHeader(shI, {
        "ID": nextId(shI), "Personne ID": idMembre, "Statut": data.Statut_Inscription || "",
        "Niveau / Classe": data.Niveau || "", "Type apprenant": data.Type_Apprenant || "",
        "Orientation": data.Source_Orientation || "", "Date d'inscription": new Date()
      });
    }
  }
  return { ok: true };
}

function deleteMembre(ss, idMembre) {
  // Recupere les inscriptions de la personne pour cascader les paiements
  var inscriptions = sheetToObjects(ss, "INSCRIPTION")
    .filter(function(i) { return String(i["Personne ID"]) === String(idMembre); })
    .map(function(i) { return String(i["ID"]); });
  deleteRowsWhere(ss.getSheetByName("PAIEMENT"), "Inscription ID", inscriptions);
  deleteRowsWhere(ss.getSheetByName("INSCRIPTION"), "Personne ID", [String(idMembre)]);
  deleteRowsWhere(ss.getSheetByName("EVALUATION"), "Personne ID", [String(idMembre)]);
  deleteRowsWhere(ss.getSheetByName("SCOLARITE"), "Personne ID", [String(idMembre)]);
  var ok = deleteRowsWhere(ss.getSheetByName("PERSONNE"), "ID", [String(idMembre)]);
  return ok > 0 ? { ok: true } : { error: "Personne introuvable" };
}

// ── Helpers mapping ───────────────────────────────────────

function mapMembre(p, inscriptions) {
  var insc = inscriptions.filter(function(i) { return String(i["Personne ID"]) === String(p["ID"]); });
  var d = insc.length > 0 ? insc[insc.length - 1] : null;
  return {
    ID_Membre: String(p["ID"]), ID_Famille: String(p["Famille ID"]),
    Nom: p["Nom"], Prenom: p["Prenom"], Role: p["Categorie"],
    Contact_Principal: p["Contact principal"], Genre: p["Genre"],
    Date_Naissance: fmtDate(p["Date de naissance"]),
    Langue_Maternelle: p["Langue maternelle"], Pays_Origine: p["Pays d'origine"],
    Telephone: p["Telephone"], Email: p["Email"], WhatsApp: "",
    Droit_Image: p["Droit a l'image"], Charte: p["Charte d'engagement"],
    Statut_Inscription: d ? d["Statut"] : "", Niveau: d ? d["Niveau / Classe"] : "",
    Type_Apprenant: d ? d["Type apprenant"] : "", Source_Orientation: d ? d["Orientation"] : "",
    Nb_Enfants: "", Notes: p["Commentaire"] || ""
  };
}

function mapInscription(i) {
  return {
    ID_Inscription: String(i["ID"]), ID_Membre: String(i["Personne ID"]),
    Annee_Scolaire: i["Annee scolaire"], Type_Apprenant: i["Type apprenant"],
    Statut: i["Statut"], Niveau: i["Niveau / Classe"], Disponibilite: i["Disponibilite"],
    Orientation: i["Orientation"], Date_Inscription: fmtDate(i["Date d'inscription"]),
    Beneficiaire: i["Beneficiaire"], Montant_Adhesion: i["Montant adhesion"], Remarques: i["Remarques"]
  };
}

// ── TACHES ────────────────────────────────────────────────

var TACHE_HEADERS = ["ID", "Cible_Type", "Cible_ID", "Titre", "Echeance", "Statut", "Assigne_A", "Date_Creation"];

function ensureTacheSheet(ss) {
  var sh = ss.getSheetByName("TACHE");
  if (!sh) {
    sh = ss.insertSheet("TACHE");
    sh.getRange(1, 1, 1, TACHE_HEADERS.length).setValues([TACHE_HEADERS]);
    return { ok: true, cree: true };
  }
  return { ok: true, deja: true };
}

function getTaches(ss, cibleType, cibleId) {
  var taches = sheetToObjects(ss, "TACHE");
  return taches
    .filter(function(t) { return String(t["Cible_Type"]) === String(cibleType) && String(t["Cible_ID"]) === String(cibleId); })
    .map(mapTache);
}

function addTache(ss, data) {
  ensureTacheSheet(ss);
  var sh = ss.getSheetByName("TACHE");
  var id = nextId(sh);
  appendByHeader(sh, {
    "ID": id,
    "Cible_Type": data.Cible_Type || "",
    "Cible_ID": data.Cible_ID || "",
    "Titre": data.Titre || "",
    "Echeance": data.Echeance || "",
    "Statut": data.Statut || "A faire",
    "Assigne_A": data.Assigne_A || "",
    "Date_Creation": fmtDate(new Date())
  });
  return { ok: true, ID_Tache: String(id) };
}

function updateTache(ss, idTache, data) {
  var sh = ss.getSheetByName("TACHE");
  var map = {};
  if (data.Titre !== undefined) map["Titre"] = data.Titre;
  if (data.Echeance !== undefined) map["Echeance"] = data.Echeance;
  if (data.Statut !== undefined) map["Statut"] = data.Statut;
  if (data.Assigne_A !== undefined) map["Assigne_A"] = data.Assigne_A;
  var ok = updateRowByHeader(sh, idTache, map);
  return ok ? { ok: true } : { error: "Tache introuvable" };
}

function deleteTache(ss, idTache) {
  var n = deleteRowsWhere(ss.getSheetByName("TACHE"), "ID", [String(idTache)]);
  return n > 0 ? { ok: true } : { error: "Tache introuvable" };
}

function mapTache(t) {
  return {
    ID_Tache: String(t["ID"]),
    Cible_Type: t["Cible_Type"],
    Cible_ID: String(t["Cible_ID"]),
    Titre: t["Titre"],
    Echeance: t["Echeance"] ? fmtDateISO(t["Echeance"]) : "",
    Statut: t["Statut"] || "A faire",
    Assigne_A: t["Assigne_A"] || "",
    Date_Creation: t["Date_Creation"] ? fmtDate(t["Date_Creation"]) : ""
  };
}

function ensureCommentaireColumn(ss) {
  var res = {};
  ["PERSONNE", "FAMILLE"].forEach(function(nom) {
    var sh = ss.getSheetByName(nom);
    var lastCol = sh.getLastColumn();
    var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    if (headers.indexOf("Commentaire") >= 0) { res[nom] = "deja"; return; }
    sh.getRange(1, lastCol + 1).setValue("Commentaire");
    res[nom] = "ajoute colonne " + (lastCol + 1);
  });
  return { ok: true, resultat: res };
}

function joinAdresse(f) {
  var parts = [];
  if (f["Adresse"]) parts.push(f["Adresse"]);
  var cpVille = [f["Code postal"], f["Ville"]].filter(function(x) { return x; }).join(" ");
  if (cpVille) parts.push(cpVille);
  return parts.join(", ");
}

// ── Utilitaires generiques ────────────────────────────────

function nextId(sh) {
  var data = sh.getDataRange().getValues();
  var max = 0;
  for (var i = 1; i < data.length; i++) { var v = Number(data[i][0]); if (!isNaN(v) && v > max) max = v; }
  return max + 1;
}

function appendByHeader(sh, obj) {
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var row = headers.map(function(h) { return obj.hasOwnProperty(h) ? obj[h] : ""; });
  sh.appendRow(row);
}

function updateRowByHeader(sh, idValue, mapping) {
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(idValue)) {
      Object.keys(mapping).forEach(function(h) {
        var c = headers.indexOf(h);
        if (c >= 0) sh.getRange(i + 1, c + 1).setValue(mapping[h]);
      });
      return true;
    }
  }
  return false;
}

function findLatestRowBy(sh, headerName, value) {
  var data = sh.getDataRange().getValues();
  var col = data[0].indexOf(headerName);
  if (col < 0) return -1;
  var last = -1;
  for (var i = 1; i < data.length; i++) { if (String(data[i][col]) === String(value)) last = i; }
  return last;
}

function deleteRowsWhere(sh, headerName, values) {
  if (!sh || !values || values.length === 0) return 0;
  var data = sh.getDataRange().getValues();
  var col = data[0].indexOf(headerName);
  if (col < 0) return 0;
  var count = 0;
  for (var i = data.length - 1; i >= 1; i--) {
    if (values.indexOf(String(data[i][col])) >= 0) { sh.deleteRow(i + 1); count++; }
  }
  return count;
}

function parseDateFr(s) {
  if (!s) return "";
  var parts = String(s).split("/");
  if (parts.length !== 3) return s;
  var d = parseInt(parts[0], 10), m = parseInt(parts[1], 10), y = parseInt(parts[2], 10);
  if (isNaN(d) || isNaN(m) || isNaN(y)) return s;
  return new Date(y, m - 1, d);
}

function fmtDate(v) {
  if (!v) return "";
  if (Object.prototype.toString.call(v) === "[object Date]") return Utilities.formatDate(v, "Europe/Paris", "dd/MM/yyyy");
  return String(v);
}

function fmtDateISO(v) {
  if (!v) return "";
  if (Object.prototype.toString.call(v) === "[object Date]") return Utilities.formatDate(v, "Europe/Paris", "yyyy-MM-dd");
  return String(v);
}

function sheetToObjects(ss, nom) {
  var feuille = ss.getSheetByName(nom);
  if (!feuille) return [];
  var data = feuille.getDataRange().getValues();
  if (data.length < 2) return [];
  var entetes = data[0];
  return data.slice(1).map(function(row) {
    var obj = {};
    entetes.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  }).filter(function(obj) { return obj[entetes[0]] !== "" && obj[entetes[0]] !== null; });
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

// ── INSPECTION ────────────────────────────────────────────

function inspectSheets(ss) {
  return ss.getSheets().map(function(sh) {
    var lc = sh.getLastColumn();
    var lr = sh.getLastRow();
    var headers = lc > 0 ? sh.getRange(1, 1, 1, lc).getValues()[0] : [];
    var sample = (lr > 1 && lc > 0) ? sh.getRange(2, 1, 1, lc).getValues()[0] : [];
    return { nom: sh.getName(), lignes: lr - 1, colonnes: lc, entetes: headers, exemple: sample };
  });
}

// ── EVENEMENT — LECTURE ───────────────────────────────────

function getEvenements(ss, categorie) {
  var rows = sheetToObjects(ss, "EVENEMENT");
  return rows
    .filter(function(r) { return !categorie || String(r["Categorie"]).toLowerCase() === String(categorie).toLowerCase(); })
    .map(function(r) {
      return {
        ID_Evenement:  String(r["ID"]),
        Titre:         r["Titre"] || "",
        Date:          fmtDate(r["Date"]),
        Heure_Debut:   r["Heure_Debut"] || "",
        Heure_Fin:     r["Heure_Fin"] || "",
        Salle:         r["Salle"] || "",
        Animateur:     r["Animateur"] || "",
        Categorie:     r["Categorie"] || "",
        Statut:        r["Statut"] || ""
      };
    });
}

// ── EVENEMENT — ECRITURE ──────────────────────────────────

function addEvenement(ss, data) {
  var sh = ss.getSheetByName("EVENEMENT");
  if (!sh) return { error: "Feuille EVENEMENT introuvable" };
  var id = nextId(sh);
  appendByHeader(sh, {
    "ID":          id,
    "Titre":       data.Titre || "",
    "Date":        data.Date ? parseDateFr(data.Date) : "",
    "Heure_Debut": data.Heure_Debut || "",
    "Heure_Fin":   data.Heure_Fin || "",
    "Salle":       data.Salle || "",
    "Animateur":   data.Animateur || "",
    "Categorie":   data.Categorie || "",
    "Statut":      data.Statut || "planifie"
  });
  return { ok: true, ID_Evenement: String(id) };
}

function updateEvenement(ss, idEvenement, data) {
  var sh = ss.getSheetByName("EVENEMENT");
  if (!sh) return { error: "Feuille EVENEMENT introuvable" };
  var map = {};
  if (data.Titre !== undefined)       map["Titre"] = data.Titre;
  if (data.Date !== undefined)        map["Date"] = parseDateFr(data.Date);
  if (data.Heure_Debut !== undefined) map["Heure_Debut"] = data.Heure_Debut;
  if (data.Heure_Fin !== undefined)   map["Heure_Fin"] = data.Heure_Fin;
  if (data.Salle !== undefined)       map["Salle"] = data.Salle;
  if (data.Animateur !== undefined)   map["Animateur"] = data.Animateur;
  if (data.Categorie !== undefined)   map["Categorie"] = data.Categorie;
  if (data.Statut !== undefined)      map["Statut"] = data.Statut;
  var ok = updateRowByHeader(sh, idEvenement, map);
  return ok ? { ok: true } : { error: "Evenement introuvable" };
}

function deleteEvenement(ss, idEvenement) {
  var n = deleteRowsWhere(ss.getSheetByName("EVENEMENT"), "ID", [String(idEvenement)]);
  return n > 0 ? { ok: true } : { error: "Evenement introuvable" };
}

// ── ASSIDUITE — LECTURE ───────────────────────────────────

function getAssiduite(ss, idEvenement, idPersonne) {
  var rows = sheetToObjects(ss, "ASSIDUITE");
  return rows
    .filter(function(r) {
      var matchE = !idEvenement || String(r["ID_Evenement"]) === String(idEvenement);
      var matchP = !idPersonne  || String(r["ID_Personne"])  === String(idPersonne);
      return matchE && matchP;
    })
    .map(function(r) {
      return {
        ID_Assiduite:  String(r["ID"]),
        ID_Evenement:  String(r["ID_Evenement"]),
        ID_Personne:   String(r["ID_Personne"]),
        Statut:        r["Statut"] || "present",
        Notes:         r["Notes"] || ""
      };
    });
}

// ── ASSIDUITE — ECRITURE ──────────────────────────────────

function addAssiduite(ss, data) {
  var sh = ss.getSheetByName("ASSIDUITE");
  if (!sh) return { error: "Feuille ASSIDUITE introuvable" };
  var id = nextId(sh);
  appendByHeader(sh, {
    "ID":           id,
    "ID_Evenement": data.ID_Evenement || "",
    "ID_Personne":  data.ID_Personne || "",
    "Statut":       data.Statut || "present",
    "Notes":        data.Notes || ""
  });
  return { ok: true, ID_Assiduite: String(id) };
}

function updateAssiduite(ss, idAssiduite, data) {
  var sh = ss.getSheetByName("ASSIDUITE");
  if (!sh) return { error: "Feuille ASSIDUITE introuvable" };
  var map = {};
  if (data.Statut !== undefined) map["Statut"] = data.Statut;
  if (data.Notes !== undefined)  map["Notes"] = data.Notes;
  var ok = updateRowByHeader(sh, idAssiduite, map);
  return ok ? { ok: true } : { error: "Ligne assiduite introuvable" };
}

function deleteAssiduite(ss, idAssiduite) {
  var n = deleteRowsWhere(ss.getSheetByName("ASSIDUITE"), "ID", [String(idAssiduite)]);
  return n > 0 ? { ok: true } : { error: "Ligne assiduite introuvable" };
}

// upsert : cree ou met a jour la ligne (idEvenement x idPersonne)
function upsertAssiduite(ss, idEvenement, idPersonne, statut, notes) {
  var sh = ss.getSheetByName("ASSIDUITE");
  if (!sh) return { error: "Feuille ASSIDUITE introuvable" };
  var rows = sheetToObjects(ss, "ASSIDUITE");
  var existing = rows.filter(function(r) {
    return String(r["ID_Evenement"]) === String(idEvenement) && String(r["ID_Personne"]) === String(idPersonne);
  })[0];
  if (existing) {
    var map = { "Statut": statut || "present" };
    if (notes !== undefined) map["Notes"] = notes;
    updateRowByHeader(sh, existing["ID"], map);
    return { ok: true, action: "updated", ID_Assiduite: String(existing["ID"]) };
  }
  var id = nextId(sh);
  appendByHeader(sh, {
    "ID": id, "ID_Evenement": idEvenement, "ID_Personne": idPersonne,
    "Statut": statut || "present", "Notes": notes || ""
  });
  return { ok: true, action: "created", ID_Assiduite: String(id) };
}

// ── SEED — DONNEES FICTIVES ───────────────────────────────

function seedEvenements(ss) {
  var sh = ss.getSheetByName("EVENEMENT");
  if (!sh) return { error: "Feuille EVENEMENT introuvable" };
  var existing = sh.getLastRow();
  if (existing > 1) return { ok: false, message: "Des donnees existent deja (" + (existing - 1) + " lignes). Supprimer avant de seeder." };

  var evenements = [
    { Titre: "Cours FLE - Groupe Alpha",      Date: new Date(2025, 3, 7),  Heure_Debut: "09:00", Heure_Fin: "11:00", Salle: "Salle A", Animateur: "Sophie Martin",   Categorie: "cours",      Statut: "termine" },
    { Titre: "Cours FLE - Groupe A1",         Date: new Date(2025, 3, 14), Heure_Debut: "09:00", Heure_Fin: "11:00", Salle: "Salle A", Animateur: "Sophie Martin",   Categorie: "cours",      Statut: "termine" },
    { Titre: "Cours FLE - Groupe A1",         Date: new Date(2025, 3, 21), Heure_Debut: "09:00", Heure_Fin: "11:00", Salle: "Salle A", Animateur: "Sophie Martin",   Categorie: "cours",      Statut: "termine" },
    { Titre: "Atelier numerique",             Date: new Date(2025, 3, 28), Heure_Debut: "14:00", Heure_Fin: "16:00", Salle: "Salle B", Animateur: "Marc Leblanc",    Categorie: "atelier",    Statut: "termine" },
    { Titre: "Cours FLE - Groupe B1",         Date: new Date(2025, 4, 5),  Heure_Debut: "09:00", Heure_Fin: "11:00", Salle: "Salle A", Animateur: "Sophie Martin",   Categorie: "cours",      Statut: "termine" },
    { Titre: "Atelier insertion pro",         Date: new Date(2025, 4, 12), Heure_Debut: "14:00", Heure_Fin: "17:00", Salle: "Grande salle", Animateur: "Marc Leblanc", Categorie: "atelier",   Statut: "termine" },
    { Titre: "Journee portes ouvertes",       Date: new Date(2025, 4, 17), Heure_Debut: "10:00", Heure_Fin: "17:00", Salle: "Tout le centre", Animateur: "Equipe",    Categorie: "evenement",  Statut: "termine" },
    { Titre: "Cours FLE - Groupe Alpha",      Date: new Date(2025, 4, 26), Heure_Debut: "09:00", Heure_Fin: "11:00", Salle: "Salle A", Animateur: "Sophie Martin",   Categorie: "cours",      Statut: "termine" },
    { Titre: "Cours FLE - Groupe A1",         Date: new Date(2025, 5, 2),  Heure_Debut: "09:00", Heure_Fin: "11:00", Salle: "Salle A", Animateur: "Sophie Martin",   Categorie: "cours",      Statut: "planifie" },
    { Titre: "Atelier numerique",             Date: new Date(2025, 5, 9),  Heure_Debut: "14:00", Heure_Fin: "16:00", Salle: "Salle B", Animateur: "Marc Leblanc",    Categorie: "atelier",    Statut: "planifie" },
  ];

  var id = 1;
  evenements.forEach(function(ev) {
    appendByHeader(sh, {
      "ID": id++, "Titre": ev.Titre, "Date": ev.Date,
      "Heure_Debut": ev.Heure_Debut, "Heure_Fin": ev.Heure_Fin,
      "Salle": ev.Salle, "Animateur": ev.Animateur,
      "Categorie": ev.Categorie, "Statut": ev.Statut
    });
  });
  return { ok: true, inserted: evenements.length };
}

function seedAssiduite(ss) {
  var sh = ss.getSheetByName("ASSIDUITE");
  if (!sh) return { error: "Feuille ASSIDUITE introuvable" };
  var existing = sh.getLastRow();
  if (existing > 1) return { ok: false, message: "Des donnees existent deja (" + (existing - 1) + " lignes). Supprimer avant de seeder." };

  // IDs PERSONNE connus : adultes FLE
  // 16=Mariama(Alpha,EN COURS) 11=Fatou(A1-,En cours) 14=Saba(A1+,En cours) 9=Karim(B1,En cours) 12=Mira(A2+/B1,En cours)
  // 7=Amal(Alpha,Arrete) 1=Leila(A1+,Arrete) 5=Esra(A1-,Arrete)
  // Evenement IDs : 1=Alpha 2=A1(14avr) 3=A1(21avr) 4=atelier num 5=B1 6=atelier pro 7=JPO 8=Alpha(26mai) 9=A1(2juin) 10=atelier num(9juin)

  var lignes = [
    // Ev 1 — Cours Alpha (07/04) : Mariama, Amal
    [1,  16, "present",  ""],
    [2,  7,  "absent",   ""],
    // Ev 2 — Cours A1 (14/04) : Fatou, Saba, Leila, Esra
    [3,  11, "present",  ""],
    [4,  14, "present",  ""],
    [5,  1,  "absent",   ""],
    [6,  5,  "excuse",   "Rendez-vous medical"],
    // Ev 3 — Cours A1 (21/04) : Fatou, Saba, Leila, Esra
    [7,  11, "absent",   ""],
    [8,  14, "present",  ""],
    [9,  1,  "absent",   ""],
    [10, 5,  "present",  ""],
    // Ev 4 — Atelier numerique (28/04) : tous
    [11, 16, "present",  ""],
    [12, 11, "present",  ""],
    [13, 14, "retard",   "Arrivee 14h30"],
    [14, 9,  "present",  ""],
    [15, 12, "present",  ""],
    [16, 7,  "absent",   ""],
    // Ev 5 — Cours B1 (05/05) : Karim, Mira
    [17, 9,  "present",  ""],
    [18, 12, "absent",   ""],
    // Ev 6 — Atelier insertion pro (12/05) : tous
    [19, 16, "present",  ""],
    [20, 11, "excuse",   ""],
    [21, 14, "present",  ""],
    [22, 9,  "present",  ""],
    [23, 12, "present",  ""],
    // Ev 7 — Journee portes ouvertes (17/05) : tous
    [24, 16, "present",  ""],
    [25, 11, "present",  ""],
    [26, 14, "present",  ""],
    [27, 9,  "absent",   ""],
    [28, 12, "present",  ""],
    [29, 7,  "present",  ""],
    // Ev 8 — Cours Alpha (26/05) : Mariama, Amal
    [30, 16, "absent",   ""],
    [31, 7,  "absent",   ""],
  ];

  var idEv   = [1,1, 2,2,2,2, 3,3,3,3, 4,4,4,4,4,4, 5,5, 6,6,6,6,6, 7,7,7,7,7,7, 8,8];
  var idLine = 1;
  lignes.forEach(function(l, i) {
    appendByHeader(sh, {
      "ID": idLine++, "ID_Evenement": idEv[i], "ID_Personne": l[1],
      "Statut": l[2], "Notes": l[3]
    });
  });
  return { ok: true, inserted: lignes.length };
}
