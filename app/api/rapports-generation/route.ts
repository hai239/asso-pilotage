import { NextResponse } from "next/server"
import { getServerUser } from "@/lib/supabase/server"
import { THEMES_RAPPORT, type RapportKPIs } from "@/lib/rapports-data"

const GEMINI_MODEL = "gemini-2.5-flash"

// POST /api/rapports-generation
// Génère le contenu complet d'un rapport d'activité selon la trame réelle de l'association
// (THEMES_RAPPORT — relevée sur les rapports d'activité PDF fournis par l'utilisateur) : les
// thèmes adossés à des chiffres réels (mesure d'impact, vie associative, perspectives) sont
// rédigés à partir des données de RapportKPIs ("recherche dans la BDD") ; les thèmes purement
// qualitatifs (mot de la directrice, parcours, actions, interventions extérieures) sont
// interprétés et rédigés par l'IA. Voir CLAUDE.md § Module Rapports.

// Charte éditoriale AREA (postulats narratifs + lexique) — recréée ici après la suppression de
// la révision IA, car de nouveau nécessaire pour la qualité de la génération de contenu.
const CHARTE_EDITORIALE = `Tu rédiges pour l'association AREA (Association pour la Réussite des Élèves Allophones, Nantes). Ton chaleureux, valorisant et professionnel, axé sur l'impact social et la rigueur méthodologique.

Postulats narratifs obligatoires :
- Coéducation (Triangle de la Réussite) : AREA est le lien indispensable entre l'Élève, l'École et les Parents.
- Empowerment des parents : leur autonomie est le premier levier de la réussite des enfants ; on valorise leurs compétences (notamment plurilingues), on ne pointe pas de lacunes.
- Pragmatisme scientifique : chaque affirmation d'impact s'appuie sur une métrique précise.

Lexique à utiliser : allophonie, inclusion socio-éducative, rupture linguistique, barrière de la langue, égalité des chances, coéducation, autonomie administrative, estime de soi, remobilisation.
Lexique interdit : "difficultés scolaires" (préférer "défis à relever" ou "besoins d'accompagnement"), "immigrés"/"étrangers" (utiliser "allophones" ou "familles issues de la migration").`

interface RequeteGeneration {
  kpis: RapportKPIs
  du: string
  au: string
}

function buildPrompt({ kpis, du, au }: RequeteGeneration): string {
  const themes = THEMES_RAPPORT
    .map((t, i) => `${i + 1}. ${t}`)
    .join("\n")

  return `${CHARTE_EDITORIALE}

Tu rédiges le rapport d'activité de la période du ${du} au ${au}. Il doit aborder EXACTEMENT ces 10 thèmes, dans cet ordre (un paragraphe par thème, pas de titre répété dans le texte lui-même) :
${themes}

Données chiffrées réelles de l'exercice, issues de la base de données — utilise-les telles quelles pour les thèmes qui s'y prêtent (Mesure d'impact élèves/parents, Vie associative, Perspectives) : ne les invente jamais, ne les modifie jamais.
${JSON.stringify(kpis)}

Pour les thèmes sans données chiffrées associées (Mot de la directrice, Le parcours d'accompagnement des élèves/parents, Nos actions élèves/parents, Interventions extérieures), interprète et rédige un contenu qualitatif original, cohérent avec le contexte de l'association (allophonie, FLE, coéducation) et le reste des données disponibles.

Réponds UNIQUEMENT avec un JSON de cette forme, sans markdown, exactement 10 éléments dans l'ordre des thèmes ci-dessus :
{"segments": ["...", "...", ...]}`
}

export async function POST(request: Request) {
  if (!(await getServerUser())) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 })
  }
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY non configurée. Ajoutez votre clé dans .env.local." },
      { status: 500 }
    )
  }

  let body: RequeteGeneration
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 })
  }

  if (!body.kpis || !body.du || !body.au) {
    return NextResponse.json({ error: "Champs requis manquants (kpis, du, au)." }, { status: 400 })
  }

  const payload = {
    contents: [{ parts: [{ text: buildPrompt(body) }] }],
    generationConfig: { responseMimeType: "application/json", maxOutputTokens: 8192 },
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: `Erreur Gemini ${res.status} : ${err}` }, { status: 502 })
    }

    const result = await res.json()
    const rawText = result?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!rawText) return NextResponse.json({ error: "Erreur Gemini : réponse vide" }, { status: 502 })

    const parsed: { segments: string[] } = JSON.parse(rawText)
    return NextResponse.json(parsed)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erreur inconnue"
    return NextResponse.json({ error: `Erreur Gemini : ${msg}` }, { status: 500 })
  }
}
