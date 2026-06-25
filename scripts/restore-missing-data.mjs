// ──────────────────────────────────────────────────────────────────
//  restore-missing-data.mjs
//  Remet à jour les colonnes manquantes après restructuration du sheet
//  Usage : node scripts/restore-missing-data.mjs
// ──────────────────────────────────────────────────────────────────

const API_URL = "https://script.google.com/macros/s/AKfycbzZQnoNI89_h9EMcq0v_yYhpawN6UaNTXPO84vCH6Asr2u1TzllNYUABM9rrk8C6pyQjQ/exec"

async function post(body) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body),
    redirect: "follow",
  })
  return res.json()
}

async function update(sheet, idField, id, data) {
  const r = await post({ action: "update", sheet, idField, id, data })
  if (r.success) {
    console.log(`  ✅  ${sheet.padEnd(8)} ${String(id).padEnd(8)} mis à jour`)
  } else {
    console.error(`  ❌  ${sheet} ${id} — ${JSON.stringify(r)}`)
  }
}

// ── Téléphones des familles ─────────────────────────────────────
const famillesTel = [
  { id: "FAM002", "Téléphone": "07 62 11 45 89" },
  { id: "FAM003", "Téléphone": "06 33 77 52 14" },
  { id: "FAM004", "Téléphone": "07 88 23 04 61" },
  { id: "FAM005", "Téléphone": "06 51 88 39 72" },
  { id: "FAM006", "Téléphone": "07 14 56 83 20" },
  { id: "FAM007", "Téléphone": "06 70 44 19 35" },
]

// ── Données manquantes des contacts ────────────────────────────
const contactsUpdate = [
  // ── FAM002 Martin ─────────────────────────────────────────────
  {
    id: "CONT010",
    "WhatsApp": "07 62 11 45 89", "Adresse": "14 rue des Acacias",
    "Code postal": "44100", "Ville": "Nantes",
    "Groupe": "", "Inscriptions": "", "Assiduité": "", "Test 1": "", "Test 2": "",
    "Autorisation parentale": "",
  },
  {
    id: "CONT011",
    "WhatsApp": "06 21 54 87 33", "Adresse": "14 rue des Acacias",
    "Code postal": "44100", "Ville": "Nantes",
    "Groupe": "A1", "Inscriptions": "Payé", "Assiduité": 82, "Test 1": 13, "Test 2": 15,
    "Autorisation parentale": "",
  },
  {
    id: "CONT012",
    "WhatsApp": "", "Adresse": "14 rue des Acacias",
    "Code postal": "44100", "Ville": "Nantes",
    "Groupe": "A1", "Inscriptions": "Payé", "Assiduité": 91, "Test 1": 16, "Test 2": 17,
    "Autorisation parentale": "OUI",
  },
  {
    id: "CONT013",
    "WhatsApp": "", "Adresse": "14 rue des Acacias",
    "Code postal": "44100", "Ville": "Nantes",
    "Groupe": "Alpha", "Inscriptions": "Payé", "Assiduité": 78, "Test 1": "", "Test 2": "",
    "Autorisation parentale": "OUI",
  },

  // ── FAM003 Benali ─────────────────────────────────────────────
  {
    id: "CONT014",
    "WhatsApp": "06 33 77 52 14", "Adresse": "3 allée des Peupliers",
    "Code postal": "44000", "Ville": "Nantes",
    "Groupe": "Pré-A1", "Inscriptions": "Exonéré", "Assiduité": 67, "Test 1": 7, "Test 2": 9,
    "Autorisation parentale": "",
  },
  {
    id: "CONT015",
    "WhatsApp": "06 33 77 52 15", "Adresse": "3 allée des Peupliers",
    "Code postal": "44000", "Ville": "Nantes",
    "Groupe": "", "Inscriptions": "", "Assiduité": "", "Test 1": "", "Test 2": "",
    "Autorisation parentale": "",
  },
  {
    id: "CONT016",
    "WhatsApp": "", "Adresse": "3 allée des Peupliers",
    "Code postal": "44000", "Ville": "Nantes",
    "Groupe": "A2", "Inscriptions": "Exonéré", "Assiduité": 88, "Test 1": 17, "Test 2": 18,
    "Autorisation parentale": "OUI",
  },
  {
    id: "CONT017",
    "WhatsApp": "", "Adresse": "3 allée des Peupliers",
    "Code postal": "44000", "Ville": "Nantes",
    "Groupe": "A1", "Inscriptions": "Exonéré", "Assiduité": 72, "Test 1": 11, "Test 2": 13,
    "Autorisation parentale": "OUI",
  },

  // ── FAM004 Nguyen ─────────────────────────────────────────────
  {
    id: "CONT018",
    "WhatsApp": "07 88 23 04 61", "Adresse": "8 boulevard Michelet",
    "Code postal": "44200", "Ville": "Nantes",
    "Groupe": "A2", "Inscriptions": "Payé", "Assiduité": 95, "Test 1": 18, "Test 2": 19,
    "Autorisation parentale": "",
  },
  {
    id: "CONT019",
    "WhatsApp": "", "Adresse": "8 boulevard Michelet",
    "Code postal": "44200", "Ville": "Nantes",
    "Groupe": "A1", "Inscriptions": "Payé", "Assiduité": 84, "Test 1": 14, "Test 2": 15,
    "Autorisation parentale": "OUI",
  },

  // ── FAM005 Diallo ─────────────────────────────────────────────
  {
    id: "CONT020",
    "WhatsApp": "06 51 88 39 72", "Adresse": "27 rue du Breil",
    "Code postal": "44300", "Ville": "Nantes",
    "Groupe": "", "Inscriptions": "", "Assiduité": "", "Test 1": "", "Test 2": "",
    "Autorisation parentale": "",
  },
  {
    id: "CONT021",
    "WhatsApp": "06 51 88 39 73", "Adresse": "27 rue du Breil",
    "Code postal": "44300", "Ville": "Nantes",
    "Groupe": "Pré-A1", "Inscriptions": "Exonéré", "Assiduité": 58, "Test 1": 6, "Test 2": 8,
    "Autorisation parentale": "",
  },
  {
    id: "CONT022",
    "WhatsApp": "", "Adresse": "27 rue du Breil",
    "Code postal": "44300", "Ville": "Nantes",
    "Groupe": "A1", "Inscriptions": "Exonéré", "Assiduité": 76, "Test 1": 12, "Test 2": 14,
    "Autorisation parentale": "OUI",
  },
  {
    id: "CONT023",
    "WhatsApp": "", "Adresse": "27 rue du Breil",
    "Code postal": "44300", "Ville": "Nantes",
    "Groupe": "Pré-A1", "Inscriptions": "Exonéré", "Assiduité": 44, "Test 1": 5, "Test 2": 7,
    "Autorisation parentale": "OUI",
  },
  {
    id: "CONT024",
    "WhatsApp": "", "Adresse": "27 rue du Breil",
    "Code postal": "44300", "Ville": "Nantes",
    "Groupe": "Alpha", "Inscriptions": "Exonéré", "Assiduité": 90, "Test 1": "", "Test 2": "",
    "Autorisation parentale": "NON",
  },

  // ── FAM006 Rousseau ───────────────────────────────────────────
  {
    id: "CONT025",
    "WhatsApp": "07 14 56 83 20", "Adresse": "5 impasse des Lilas",
    "Code postal": "44000", "Ville": "Nantes",
    "Groupe": "", "Inscriptions": "", "Assiduité": "", "Test 1": "", "Test 2": "",
    "Autorisation parentale": "",
  },
  {
    id: "CONT026",
    "WhatsApp": "", "Adresse": "5 impasse des Lilas",
    "Code postal": "44000", "Ville": "Nantes",
    "Groupe": "A2", "Inscriptions": "À payer", "Assiduité": 63, "Test 1": 14, "Test 2": "",
    "Autorisation parentale": "OUI",
  },
  {
    id: "CONT027",
    "WhatsApp": "", "Adresse": "5 impasse des Lilas",
    "Code postal": "44000", "Ville": "Nantes",
    "Groupe": "A1", "Inscriptions": "À payer", "Assiduité": 50, "Test 1": 9, "Test 2": 10,
    "Autorisation parentale": "OUI",
  },

  // ── FAM007 Okafor ─────────────────────────────────────────────
  {
    id: "CONT028",
    "WhatsApp": "06 70 44 19 35", "Adresse": "19 avenue de la Beaujoire",
    "Code postal": "44300", "Ville": "Nantes",
    "Groupe": "Alpha", "Inscriptions": "Exonéré", "Assiduité": 88, "Test 1": "", "Test 2": "",
    "Autorisation parentale": "",
  },
  {
    id: "CONT029",
    "WhatsApp": "", "Adresse": "19 avenue de la Beaujoire",
    "Code postal": "44300", "Ville": "Nantes",
    "Groupe": "A1", "Inscriptions": "Exonéré", "Assiduité": 81, "Test 1": 13, "Test 2": 14,
    "Autorisation parentale": "OUI",
  },
]

// ──────────────────────────────────────────────────────────────────
//  MAIN
// ──────────────────────────────────────────────────────────────────
console.log("\n🔧  Restauration des données manquantes…\n")

console.log("📞  Téléphones familles (6)")
for (const f of famillesTel) {
  const { id, ...data } = f
  await update("Famille", "ID Famille", id, data)
}

console.log("\n📋  Données contacts (20)")
for (const c of contactsUpdate) {
  const { id, ...data } = c
  await update("Contact", "ID contact", id, data)
}

console.log("\n✅  Restauration terminée — " + (famillesTel.length + contactsUpdate.length) + " enregistrements mis à jour")
