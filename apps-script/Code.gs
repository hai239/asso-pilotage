// ═══════════════════════════════════════════════════════════════
//  Code.gs — API Google Sheets pour Asso Pilotage
//  À coller dans : Google Sheet → Extensions → Apps Script
// ═══════════════════════════════════════════════════════════════

const SS_ID         = "1vvI6bzj3N0hjBWzRi9p7Yt_l9yzH2XAxDnDBDwTZtCs";
const SHEET_FAMILLE = "Famille";
const SHEET_CONTACT = "Contact";

// ═══════════════════════════════════════════════════════════════
//  GET — Lecture des données
// ═══════════════════════════════════════════════════════════════
function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || "all";
    const ss = SpreadsheetApp.openById(SS_ID);
    let result;

    if (action === "familles") {
      result = readSheet(ss.getSheetByName(SHEET_FAMILLE));
    } else if (action === "contacts") {
      result = readSheet(ss.getSheetByName(SHEET_CONTACT));
    } else {
      result = {
        familles: readSheet(ss.getSheetByName(SHEET_FAMILLE)),
        contacts: readSheet(ss.getSheetByName(SHEET_CONTACT))
      };
    }
    return jsonOutput(result);
  } catch (err) {
    return jsonOutput({ error: err.toString() });
  }
}

// ═══════════════════════════════════════════════════════════════
//  POST — Écriture (create / update / delete)
// ═══════════════════════════════════════════════════════════════
function doPost(e) {
  try {
    const body      = JSON.parse(e.postData.contents);
    const action    = body.action;
    const sheetName = body.sheet;
    const ss        = SpreadsheetApp.openById(SS_ID);
    const sheet     = ss.getSheetByName(sheetName);

    if (!sheet) return jsonOutput({ error: "Feuille introuvable : " + sheetName });

    let result;
    if      (action === "create") result = createRow(sheet, body.data);
    else if (action === "update") result = updateRow(sheet, body.idField, body.id, body.data);
    else if (action === "delete") result = deleteRow(sheet, body.idField, body.id);
    else result = { error: "Action inconnue : " + action };

    return jsonOutput(result);
  } catch (err) {
    return jsonOutput({ error: err.toString() });
  }
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════
function jsonOutput(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getHeaders(sheet) {
  const last = sheet.getLastColumn();
  if (last === 0) return [];
  return sheet.getRange(1, 1, 1, last).getValues()[0];
}

function readSheet(sheet) {
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1)
    .filter(row => row[0] !== "" && row[0] !== null)
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = (row[i] === "" || row[i] === null || row[i] === undefined) ? null : row[i];
      });
      return obj;
    });
}

function createRow(sheet, data) {
  const headers = getHeaders(sheet);
  const row = headers.map(h => (data[h] !== undefined && data[h] !== null) ? data[h] : "");
  sheet.appendRow(row);
  return { success: true };
}

function updateRow(sheet, idField, id, data) {
  const all     = sheet.getDataRange().getValues();
  const headers = all[0];
  const idCol   = headers.indexOf(idField);
  if (idCol === -1) return { error: "Colonne ID introuvable : " + idField };

  for (let i = 1; i < all.length; i++) {
    if (String(all[i][idCol]) === String(id)) {
      headers.forEach((h, j) => {
        if (data[h] !== undefined) {
          sheet.getRange(i + 1, j + 1).setValue(data[h] !== null ? data[h] : "");
        }
      });
      return { success: true };
    }
  }
  return { error: "Ligne introuvable pour id=" + id };
}

function deleteRow(sheet, idField, id) {
  const all     = sheet.getDataRange().getValues();
  const headers = all[0];
  const idCol   = headers.indexOf(idField);
  if (idCol === -1) return { error: "Colonne ID introuvable : " + idField };

  for (let i = 1; i < all.length; i++) {
    if (String(all[i][idCol]) === String(id)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { error: "Ligne introuvable pour id=" + id };
}
