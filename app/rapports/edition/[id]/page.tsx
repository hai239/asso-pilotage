"use client"

import { useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { BookOpen, ExternalLink, FileDown, RotateCcw, Sparkles } from "lucide-react"
import SplitPane from "@/components/rapports/SplitPane"
import SlidePreview from "@/components/rapports/SlidePreview"
import AiChatPanel from "@/components/rapports/AiChatPanel"
import {
  type Brouillon,
  type DonneesGabarit,
  type FormatRapport,
  type GabaritDiapositive,
  type RapportArchive,
  type StyleRapport,
  BROUILLONS_MOCK,
  FORMAT_DEFAUT,
  HISTORIQUE_MOCK,
  SEPARATEUR_DIAPOSITIVES,
  STORAGE_BROUILLONS,
  STORAGE_HISTORIQUE,
  STYLE_DEFAUT,
  decouperDiapositives,
  migrerContenuBrouillon,
  tagLignesParSegment,
  load,
  save,
} from "@/lib/rapports-data"
import { lireSlide, pdfDownloadUrl, syncSlide, validerRapport } from "@/lib/rapports-slides-api"
import {
  analyserTemplate,
  listerTemplatesDrive,
  suggererStylesGlobaux,
  type SuggestionStyleGlobal,
} from "@/lib/rapports-template-api"
import { lireFichierEnDataUrl } from "@/lib/rapports-file-utils"
import { useFermerAuClicExterieur } from "@/lib/use-fermer-au-clic-exterieur"

interface BubbleState {
  x: number
  y: number
  texte: string
}

// Le panneau gauche n'est JAMAIS rendu via des enfants JSX réactifs : le navigateur mute déjà
// le DOM d'un contentEditable à chaque Entrée/Suppr (fusion/scission de lignes), et laisser
// React réconcilier ces mêmes nœuds provoque un crash ("removeChild... not a child of this
// node") dès qu'un enfant que React croit connaître a déjà été déplacé par le navigateur. Le
// contenu est donc géré entièrement à la main via ces deux fonctions, jamais par re-render.
function remplacerContenuEditable(container: HTMLDivElement, texte: string) {
  container.innerHTML = ""
  for (const tag of tagLignesParSegment(texte)) {
    const p = document.createElement("p")
    p.className = tag.delimiteur ? "text-slate-300 select-all" : "rounded px-1 -mx-1 transition-colors"
    if (tag.ligne) {
      p.textContent = tag.ligne
    } else {
      p.appendChild(document.createElement("br"))
    }
    container.appendChild(p)
  }
}

export default function EditionRapportPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const [brouillon, setBrouillon] = useState<Brouillon | null | undefined>(undefined)
  const [contenuActif, setContenuActif] = useState("")
  const [selectionScope, setSelectionScope] = useState<string | null>(null)
  const [bubble, setBubble] = useState<BubbleState | null>(null)
  const [activeParaIndex, setActiveParaIndex] = useState<number | null>(null)
  const [selectedSlideIndex, setSelectedSlideIndex] = useState<number | null>(null)
  const [chatInstruction, setChatInstruction] = useState("")
  const [style, setStyle] = useState<StyleRapport>(STYLE_DEFAUT)
  const [imagesParDiapositive, setImagesParDiapositive] = useState<Record<number, string>>({})
  const [dispositionParDiapositive, setDispositionParDiapositive] = useState<Record<number, StyleRapport["disposition"]>>({})
  const [donneesGabaritParDiapositive, setDonneesGabaritParDiapositive] = useState<Record<number, DonneesGabarit>>({})
  const [format, setFormat] = useState<FormatRapport>(FORMAT_DEFAUT)
  const [validation, setValidation] = useState(false)
  const [bibliothequeOuverte, setBibliothequeOuverte] = useState(false)
  const bibliothequeMenuRef = useFermerAuClicExterieur<HTMLDivElement>(bibliothequeOuverte, () => setBibliothequeOuverte(false))
  const [bibliothequeEnCours, setBibliothequeEnCours] = useState(false)
  const [bibliothequeErreur, setBibliothequeErreur] = useState<string | null>(null)
  const [templatesDrive, setTemplatesDrive] = useState<{ id: string; nom: string }[]>([])
  const [suggestionsGlobales, setSuggestionsGlobales] = useState<SuggestionStyleGlobal[]>([])
  const editableRef = useRef<HTMLDivElement>(null)
  const bibliothequePdfInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const all = load<Brouillon[]>(STORAGE_BROUILLONS, BROUILLONS_MOCK)
    const trouve = all.find((b) => b.id === params.id) ?? null
    // Migration auto : voir lib/rapports-data.ts § migrerContenuBrouillon.
    const found = trouve ? { ...trouve, contenu: migrerContenuBrouillon(trouve.contenu) } : null
    setBrouillon(found)
    setContenuActif(found?.contenu ?? "")
    // Fusionne avec STYLE_DEFAUT pour les brouillons sauvegardés avant l'ajout d'un champ à
    // StyleRapport (ex. `typographie`) — évite un style incomplet issu d'un ancien localStorage.
    setStyle({ ...STYLE_DEFAUT, ...found?.style })
    setFormat(found?.format ?? FORMAT_DEFAUT)
    // Gabarit/données décidés lors de la génération initiale sur le dashboard (template importé
    // avant même l'ouverture de cet éditeur) — voir app/rapports/page.tsx § handleGenerer.
    setDispositionParDiapositive(found?.dispositionInitiale ?? {})
    setDonneesGabaritParDiapositive(found?.donneesGabaritInitiales ?? {})
  }, [params.id])

  // Peuple le contentEditable une fois le brouillon chargé et le ref monté — la seule fois où
  // son contenu est écrit "de l'extérieur" sans que l'utilisateur soit en train de taper.
  useEffect(() => {
    if (editableRef.current && brouillon) {
      remplacerContenuEditable(editableRef.current, brouillon.contenu)
    }
  }, [brouillon])

  // Applique un contenu venant d'un événement externe (ré-injection Slides, révision IA) :
  // met à jour l'état ET reconstruit le contentEditable — sans risque puisque ce n'est jamais
  // déclenché pendant que l'utilisateur tape (voir handleInput, qui ne touche jamais au DOM).
  function appliquerContenu(texte: string) {
    setContenuActif(texte)
    if (editableRef.current) remplacerContenuEditable(editableRef.current, texte)
  }

  // Ré-injection : si ce brouillon a déjà un Google Slides et qu'il a été modifié directement
  // depuis Drive (hors de l'app), on récupère cette version au lieu de la copie locale — best
  // effort, silencieux si les dossiers Drive ne sont pas configurés (voir CLAUDE.md).
  useEffect(() => {
    if (!brouillon?.slideId) return
    let annule = false
    lireSlide(brouillon.slideId).then((segmentsDistants) => {
      if (annule || !segmentsDistants) return
      appliquerContenu(segmentsDistants.join(SEPARATEUR_DIAPOSITIVES))
    })
    return () => { annule = true }
  }, [brouillon?.slideId])

  // Surlignage croisé : ne fait QUE basculer une classe CSS sur les <p> déjà en place, jamais
  // de création/suppression de nœud — sûr à exécuter à chaque frappe ou changement de scroll.
  useEffect(() => {
    if (!editableRef.current) return
    const tags = tagLignesParSegment(contenuActif)
    const enfants = editableRef.current.children
    for (let i = 0; i < enfants.length && i < tags.length; i++) {
      const tag = tags[i]
      if (tag.delimiteur) continue
      ;(enfants[i] as HTMLElement).classList.toggle("bg-rapports-light/70", tag.segmentIndex === activeParaIndex)
    }
  }, [activeParaIndex, contenuActif])

  function handleMouseUp() {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !editableRef.current) {
      setBubble(null)
      return
    }
    const texte = sel.toString().trim()
    if (!texte) {
      setBubble(null)
      return
    }
    const range = sel.getRangeAt(0)
    if (!editableRef.current.contains(range.commonAncestorContainer)) {
      setBubble(null)
      return
    }
    const rect = range.getBoundingClientRect()
    setBubble({ x: rect.left + rect.width / 2, y: rect.top, texte })
  }

  function handleAskIA() {
    if (bubble) setSelectionScope(bubble.texte)
    setBubble(null)
  }

  function lireContenuActuel(): string {
    if (!editableRef.current) return contenuActif
    const lignes = Array.from(editableRef.current.children).map((el) => el.textContent ?? "")
    return lignes.length > 0 ? lignes.join("\n") : contenuActif
  }

  // Synchronisation immédiate côté interface uniquement (texte ↔ aperçu des diapositives) :
  // on relit le DOM après chaque frappe et on répercute dans le state qui alimente
  // SlidePreview. Comme la valeur relue est celle que le navigateur vient d'écrire, React ne
  // touche à aucun nœud texte au re-rendu (aucun saut de curseur).
  function handleInput() {
    setContenuActif(lireContenuActuel())
  }

  // Applique un mapping gabarit/données reçu de l'IA (analyse de template ou suggestion de
  // style globale) à toutes les diapositives concernées d'un coup — voir
  // app/api/rapports-template/route.ts § gabarits.
  function appliquerGabarits(gabarits?: GabaritDiapositive[]) {
    if (!gabarits?.length) return
    setDispositionParDiapositive((d) => {
      const next = { ...d }
      for (const g of gabarits) next[g.index] = g.disposition
      return next
    })
    setDonneesGabaritParDiapositive((dd) => {
      const next = { ...dd }
      for (const g of gabarits) if (g.donnees) next[g.index] = g.donnees
      return next
    })
  }

  async function chargerSuggestionsGlobales() {
    setBibliothequeEnCours(true)
    setBibliothequeErreur(null)
    try {
      const { suggestions } = await suggererStylesGlobaux(decouperDiapositives(contenuActif), style)
      setSuggestionsGlobales(suggestions)
    } catch (e) {
      setBibliothequeErreur(e instanceof Error ? e.message : "Échec des suggestions de style")
    } finally {
      setBibliothequeEnCours(false)
    }
  }

  async function handleOuvrirBibliotheque() {
    setBibliothequeOuverte((v) => !v)
    if (templatesDrive.length > 0 || suggestionsGlobales.length > 0) return // déjà chargées
    listerTemplatesDrive().then(({ templates }) => setTemplatesDrive(templates)).catch(() => {})
    await chargerSuggestionsGlobales()
  }

  function handleRegenererSuggestionsGlobales() {
    void chargerSuggestionsGlobales()
  }

  function handleAppliquerSuggestionGlobale(s: SuggestionStyleGlobal) {
    setStyle({ couleurPrincipale: s.couleurPrincipale, couleurAccent: s.couleurAccent, disposition: s.disposition, typographie: s.typographie })
    appliquerGabarits(s.gabarits)
    setBibliothequeOuverte(false)
  }

  async function handleAppliquerTemplateDrive(presentationId: string) {
    setBibliothequeEnCours(true)
    setBibliothequeErreur(null)
    try {
      const { style: nouveauStyle, gabarits } = await analyserTemplate({ type: "slides", presentationId }, undefined, decouperDiapositives(contenuActif))
      setStyle(nouveauStyle)
      appliquerGabarits(gabarits)
      setBibliothequeOuverte(false)
    } catch (e) {
      setBibliothequeErreur(e instanceof Error ? e.message : "Échec de l'application du template")
    } finally {
      setBibliothequeEnCours(false)
    }
  }

  // Import PDF direct depuis l'éditeur (en plus des Templates Drive / suggestions IA déjà
  // disponibles) — même mécanisme que le dashboard (app/rapports/page.tsx § handlePdfSelected),
  // mais applique le style ET le mapping gabarit immédiatement puisque l'éditeur est déjà ouvert.
  async function handleImporterTemplatePdf(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setBibliothequeEnCours(true)
    setBibliothequeErreur(null)
    try {
      const dataUrl = await lireFichierEnDataUrl(file)
      const base64 = dataUrl.split(",")[1] ?? ""
      const { style: nouveauStyle, gabarits } = await analyserTemplate({ type: "pdf", base64 }, undefined, decouperDiapositives(contenuActif))
      setStyle(nouveauStyle)
      appliquerGabarits(gabarits)
      setBibliothequeOuverte(false)
    } catch (e) {
      setBibliothequeErreur(e instanceof Error ? e.message : "Échec de l'application du template PDF")
    } finally {
      setBibliothequeEnCours(false)
    }
  }

  async function handleSauvegarder() {
    if (!brouillon) return
    const contenuActuel = lireContenuActuel()
    const all = load<Brouillon[]>(STORAGE_BROUILLONS, BROUILLONS_MOCK)
    let slideId = brouillon.slideId
    let slideUrl = brouillon.slideUrl

    // Synchronisation Slides au checkpoint "Sauvegarder" — best-effort, non bloquant. L'API
    // Slides ne permet pas de redimensionner une présentation existante (16:9 ↔ A4) : si le
    // format a changé depuis la dernière sync, on force la création d'un nouveau fichier (voir
    // lib/google-slides-server.ts) et on met à jour slideId/slideUrl en conséquence.
    if (slideId) {
      const formatPrecedent = brouillon.format ?? FORMAT_DEFAUT
      const nouveauFichier = formatPrecedent !== format
      const resultat = await syncSlide(slideId, decouperDiapositives(contenuActuel), {
        format,
        nouveauFichier,
        titre: nouveauFichier ? brouillon.titre : undefined,
      })
      if (resultat) {
        slideId = resultat.presentationId
        slideUrl = resultat.url
      }
    }

    const next = { ...brouillon, contenu: contenuActuel, style, format, slideId, slideUrl, modifieLe: new Date().toISOString().split("T")[0] }
    save(STORAGE_BROUILLONS, all.map((b) => (b.id === next.id ? next : b)))

    router.push("/rapports")
  }

  function handleFermer() {
    if (window.confirm("Fermer sans enregistrer les modifications ?")) {
      router.push("/rapports")
    }
  }

  async function handleValider() {
    if (!brouillon) return
    setValidation(true)
    const contenuActuel = lireContenuActuel()
    const segments = decouperDiapositives(contenuActuel)
    let slideId = brouillon.slideId
    let slideUrl = brouillon.slideUrl

    if (slideId) {
      const formatPrecedent = brouillon.format ?? FORMAT_DEFAUT
      const nouveauFichier = formatPrecedent !== format
      const resultat = await syncSlide(slideId, segments, {
        format,
        nouveauFichier,
        titre: nouveauFichier ? brouillon.titre : undefined,
      })
      if (resultat) {
        slideId = resultat.presentationId
        slideUrl = resultat.url
      }
      if (slideId) await validerRapport(slideId)
    }

    const allBrouillons = load<Brouillon[]>(STORAGE_BROUILLONS, BROUILLONS_MOCK)
    save(STORAGE_BROUILLONS, allBrouillons.filter((b) => b.id !== brouillon.id))

    const archive: RapportArchive = {
      id: brouillon.id,
      titre: brouillon.titre,
      dateGeneration: new Date().toISOString().split("T")[0],
      periodeDebut: brouillon.periodeDebut,
      periodeFin: brouillon.periodeFin,
      slideId,
      slideUrl,
    }
    const allHistorique = load<RapportArchive[]>(STORAGE_HISTORIQUE, HISTORIQUE_MOCK)
    save(STORAGE_HISTORIQUE, [archive, ...allHistorique])

    router.push("/rapports")
  }

  if (brouillon === undefined) return null

  if (brouillon === null) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-sm text-muted">Brouillon introuvable.</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col relative">
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-surface shrink-0">
        <div>
          <p className="text-sm font-semibold text-foreground">{brouillon.titre}</p>
          <p className="text-xs text-muted">{brouillon.periodeDebut} → {brouillon.periodeFin}</p>
        </div>
      </div>

      <SplitPane
        left={
          <div
            ref={editableRef}
            contentEditable
            suppressContentEditableWarning
            onMouseUp={handleMouseUp}
            onInput={handleInput}
            className="p-8 h-full overflow-y-auto text-sm leading-relaxed text-foreground focus:outline-none"
          />
        }
        right={
          <div className="flex flex-col h-full border-l border-border">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface shrink-0">
              <div ref={bibliothequeMenuRef} className="relative">
                <button
                  type="button"
                  onClick={handleOuvrirBibliotheque}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-rapports/30 text-rapports-dark hover:bg-rapports-light transition-colors"
                >
                  <BookOpen size={13} /> Bibliothèque de templates
                </button>

                <input ref={bibliothequePdfInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleImporterTemplatePdf} />

                {bibliothequeOuverte && (
                  <div className="absolute top-full mt-1 left-0 bg-surface border border-border rounded-lg shadow-lg p-3 z-20 flex flex-col gap-3 max-h-96 overflow-y-auto w-80">
                    {bibliothequeErreur && <p className="text-xs text-alert">{bibliothequeErreur}</p>}

                    <div>
                      <p className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5">Importer un document</p>
                      <button
                        type="button"
                        onClick={() => bibliothequePdfInputRef.current?.click()}
                        disabled={bibliothequeEnCours}
                        className="w-full text-left text-xs px-2.5 py-1.5 rounded-lg border border-border hover:border-rapports hover:bg-rapports-light/40 transition-colors disabled:opacity-50"
                      >
                        Importer un PDF de référence
                      </button>
                    </div>

                    <div>
                      <p className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5">Templates Drive</p>
                    {templatesDrive.length === 0 ? (
                      <p className="text-xs text-muted italic">Aucun template trouvé dans le dossier Drive dédié.</p>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        {templatesDrive.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => handleAppliquerTemplateDrive(t.id)}
                            disabled={bibliothequeEnCours}
                            className="text-left text-xs px-2.5 py-1.5 rounded-lg border border-border hover:border-rapports hover:bg-rapports-light/40 transition-colors disabled:opacity-50"
                          >
                            {t.nom}
                          </button>
                        ))}
                      </div>
                    )}
                    </div>

                    <div>
                      <p className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5">Suggestions IA</p>
                      {bibliothequeEnCours && <p className="text-xs text-muted italic">Analyse en cours…</p>}
                      {!bibliothequeEnCours && (
                        <div className="flex flex-col gap-1.5">
                          {suggestionsGlobales.map((s, i) => (
                            <button
                              key={i}
                              onClick={() => handleAppliquerSuggestionGlobale(s)}
                              className="text-left rounded-lg border border-border hover:border-rapports hover:bg-rapports-light/40 transition-colors p-2"
                            >
                              <p className="text-xs font-semibold text-foreground">{s.label}</p>
                              <p className="text-[11px] text-muted mt-0.5">{s.description}</p>
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={handleRegenererSuggestionsGlobales}
                            className="flex items-center justify-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-border hover:bg-slate-50 text-muted transition-colors"
                          >
                            <RotateCcw size={12} /> Régénérer d'autres suggestions
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <label className="flex items-center gap-1.5 text-xs font-medium text-muted cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={format === "a4"}
                  onChange={(e) => setFormat(e.target.checked ? "a4" : "classique")}
                  className="accent-rapports"
                />
                Format A4
              </label>
            </div>
            <div className="flex-[4] min-h-0">
              <SlidePreview
                contenu={contenuActif}
                style={style}
                imagesParDiapositive={imagesParDiapositive}
                dispositionParDiapositive={dispositionParDiapositive}
                donneesGabaritParDiapositive={donneesGabaritParDiapositive}
                format={format}
                logoUrl={brouillon.logoUrl}
                onActiveParagraphChange={setActiveParaIndex}
                selectedSlideIndex={selectedSlideIndex}
                onSlideClick={setSelectedSlideIndex}
                onPhotoDirectAdd={(index, dataUrl) => setImagesParDiapositive((imgs) => ({ ...imgs, [index]: dataUrl }))}
                onDispositionChoisie={(index, disposition) => setDispositionParDiapositive((d) => ({ ...d, [index]: disposition }))}
              />
            </div>
            <div className="flex-[1.5] min-h-0 overflow-y-auto">
              <AiChatPanel
                selectionScope={selectionScope}
                onClearSelectionScope={() => setSelectionScope(null)}
                instruction={chatInstruction}
                onInstructionChange={setChatInstruction}
                selectedSlideIndex={selectedSlideIndex}
                texteDiapositiveSelectionnee={(slideIndex) => decouperDiapositives(contenuActif)[slideIndex] ?? ""}
                aUneImageSelectionnee={(slideIndex) => Boolean(imagesParDiapositive[slideIndex])}
                style={style}
                onDispositionChoisie={(slideIndex, disposition, donnees) => {
                  setDispositionParDiapositive((d) => ({ ...d, [slideIndex]: disposition }))
                  if (donnees) setDonneesGabaritParDiapositive((dd) => ({ ...dd, [slideIndex]: donnees }))
                }}
              />
            </div>
            <div className="flex flex-col gap-2 p-4 border-t border-border shrink-0">
              <button
                type="button"
                onClick={handleSauvegarder}
                className="bg-rapports text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity"
              >
                💾 Sauvegarder le brouillon
              </button>
              <button
                type="button"
                onClick={handleValider}
                disabled={validation}
                className="border border-rapports text-rapports-dark text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-rapports-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {validation ? "Validation en cours…" : "✅ Valider le rapport"}
              </button>
              <button
                type="button"
                onClick={handleFermer}
                className="text-sm font-medium px-4 py-2.5 rounded-xl text-alert hover:bg-red-50 transition-colors"
              >
                ❌ Fermer sans enregistrer
              </button>
              <div className="flex gap-2">
                {brouillon.slideUrl ? (
                  <a
                    href={brouillon.slideUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border border-border text-muted hover:bg-slate-50 transition-colors"
                  >
                    <ExternalLink size={14} /> Télécharger en Google Slides
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    title="Disponible une fois les dossiers Drive Rapports configurés"
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border border-border text-muted opacity-50 cursor-not-allowed"
                  >
                    <ExternalLink size={14} /> Télécharger en Google Slides
                  </button>
                )}
                {brouillon.slideId ? (
                  <a
                    href={pdfDownloadUrl(brouillon.slideId)}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border border-border text-muted hover:bg-slate-50 transition-colors"
                  >
                    <FileDown size={14} /> Télécharger en PDF
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    title="Disponible une fois les dossiers Drive Rapports configurés"
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border border-border text-muted opacity-50 cursor-not-allowed"
                  >
                    <FileDown size={14} /> Télécharger en PDF
                  </button>
                )}
              </div>
            </div>
          </div>
        }
      />

      {bubble && (
        <button
          type="button"
          onClick={handleAskIA}
          style={{ position: "fixed", left: bubble.x, top: bubble.y - 40, transform: "translateX(-50%)" }}
          className="z-50 flex items-center gap-1.5 bg-slate-900 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg hover:bg-slate-700"
        >
          <Sparkles size={13} /> Ask IA
        </button>
      )}
    </div>
  )
}
