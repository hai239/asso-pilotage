/**
 * Lit le Sheet INSCRIPTION et affiche les valeurs uniques de
 * "Type apprenant" et "Niveau / Classe", avec leur nombre d'occurrences.
 * Usage : npx tsx scripts/inspect-inscription-values.ts
 */
import fs from "fs"
import path from "path"
import { google } from "googleapis"

// Charge .env.local sans dotenv
const envFile = path.resolve(process.cwd(), ".env.local")
for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "")
}

const SPREADSHEET_ID = "1bOISBPwoU1xa5R4Um0fRASXKFeclJ8jB3A3CUHBMlI8"

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
  if (rows.length === 0) { console.log("Aucune donnée."); return }

  const headers = rows[0].map((h: unknown) => String(h ?? ""))
  const iType   = headers.findIndex(h => h.toLowerCase().includes("type apprenant"))
  const iNiveau = headers.findIndex(h => h.toLowerCase().includes("niveau"))

  console.log(`\nColonnes trouvées :`)
  console.log(`  "Type apprenant" → colonne ${iType >= 0 ? iType : "INTROUVABLE"}`)
  console.log(`  "Niveau / Classe" → colonne ${iNiveau >= 0 ? iNiveau : "INTROUVABLE"}`)

  const countType:   Record<string, number> = {}
  const countNiveau: Record<string, number> = {}

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const t = iType   >= 0 ? String(row[iType]   ?? "").trim() : ""
    const n = iNiveau >= 0 ? String(row[iNiveau] ?? "").trim() : ""
    countType[t || "(vide)"]   = (countType[t || "(vide)"]   ?? 0) + 1
    countNiveau[n || "(vide)"] = (countNiveau[n || "(vide)"] ?? 0) + 1
  }

  console.log(`\n── Type apprenant (${rows.length - 1} lignes) ──`)
  Object.entries(countType).sort((a, b) => b[1] - a[1]).forEach(([v, c]) =>
    console.log(`  "${v}" → ${c} occurrence(s)`)
  )

  console.log(`\n── Niveau / Classe ──`)
  Object.entries(countNiveau).sort((a, b) => b[1] - a[1]).forEach(([v, c]) =>
    console.log(`  "${v}" → ${c} occurrence(s)`)
  )
}

main().catch(console.error)
