/**
 * Migration : nettoie les valeurs incorrectes dans INSCRIPTION
 *  - "Type apprenant" : rien à changer (FLE / Soutien scolaire déjà corrects)
 *  - "Niveau / Classe" : vide les niveaux de langue (Alpha, A1-, A1+, A2-, A2+/B1, B1)
 *    qui ont été mis par erreur dans cette colonne (ne concerne que les inscriptions FLE)
 *
 * Usage : npx tsx scripts/migrate-inscription-values.ts
 * Ajoutez --dry-run pour simuler sans écrire.
 */
import fs from "fs"
import path from "path"
import { google } from "googleapis"

const DRY_RUN = process.argv.includes("--dry-run")

const envFile = path.resolve(process.cwd(), ".env.local")
for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "")
}

const SPREADSHEET_ID = "1bOISBPwoU1xa5R4Um0fRASXKFeclJ8jB3A3CUHBMlI8"

// Valeurs de langue à supprimer du champ Niveau / Classe
const NIVEAUX_LANGUE = ["Alpha", "A1-", "A1+", "A2-", "A2+/B1", "B1", "A1", "A2"]

async function main() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  })
  const sheets = google.sheets({ version: "v4", auth })

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "INSCRIPTION",
  })

  const rows = res.data.values ?? []
  if (rows.length < 2) { console.log("Aucune donnée."); return }

  const headers = rows[0].map((h: unknown) => String(h ?? ""))
  const iNiveau = headers.findIndex(h => h.toLowerCase().includes("niveau"))

  if (iNiveau === -1) { console.log("Colonne Niveau introuvable."); return }

  console.log(`\nColonne "Niveau / Classe" → index ${iNiveau}`)
  if (DRY_RUN) console.log("MODE DRY-RUN — aucune écriture\n")

  const updates: { row: number; value: string }[] = []

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const niveau = String(row[iNiveau] ?? "").trim()
    if (NIVEAUX_LANGUE.includes(niveau)) {
      updates.push({ row: i + 1, value: niveau }) // +1 car Sheets est 1-indexé
    }
  }

  if (updates.length === 0) {
    console.log("Aucune valeur incorrecte trouvée. Rien à migrer.")
    return
  }

  console.log(`${updates.length} inscription(s) avec un niveau de langue dans Niveau/Classe :`)
  updates.forEach(u => console.log(`  Ligne ${u.row} : "${u.value}" → (vide)`))

  if (DRY_RUN) {
    console.log("\nDry-run terminé. Relancez sans --dry-run pour appliquer.")
    return
  }

  // Colonne Sheets = lettre (A=0, B=1…)
  const colLetter = String.fromCharCode(65 + iNiveau)

  for (const u of updates) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `INSCRIPTION!${colLetter}${u.row}`,
      valueInputOption: "RAW",
      requestBody: { values: [[""]] },
    })
    console.log(`  ✓ Ligne ${u.row} vidée`)
  }

  console.log("\nMigration terminée.")
}

main().catch(console.error)
