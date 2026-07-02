"use client"

import { useEffect, useRef, useState } from "react"
import { RotateCcw, Sparkles, Wand2, X } from "lucide-react"
import type { DonneesGabarit, StyleRapport } from "@/lib/rapports-data"
import { suggererVisuels, type SuggestionVisuelle } from "@/lib/rapports-template-api"
import { useFermerAuClicExterieur } from "@/lib/use-fermer-au-clic-exterieur"

interface ChatMessage {
  id: number
  role: "user" | "assistant"
  text: string
}

const CANNED_REPLIES = [
  "Noté — je prends en compte cette instruction pour la prochaine génération de cette diapositive.",
  "C'est fait, le ton a été ajusté en conséquence.",
  "Compris, j'applique ce changement sur le texte concerné.",
]

let nextId = 1

export default function AiChatPanel({
  selectionScope,
  onClearSelectionScope,
  instruction,
  onInstructionChange,
  selectedSlideIndex,
  texteDiapositiveSelectionnee,
  aUneImageSelectionnee,
  style,
  onDispositionChoisie,
}: {
  selectionScope?: string | null
  onClearSelectionScope?: () => void
  instruction: string
  onInstructionChange: (v: string) => void
  selectedSlideIndex: number | null
  texteDiapositiveSelectionnee?: (slideIndex: number) => string
  aUneImageSelectionnee?: (slideIndex: number) => boolean
  style: StyleRapport
  onDispositionChoisie?: (slideIndex: number, disposition: StyleRapport["disposition"], donnees?: DonneesGabarit) => void
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [suggestionsOuvertes, setSuggestionsOuvertes] = useState(false)
  const [suggestions, setSuggestions] = useState<SuggestionVisuelle[]>([])
  const [suggestionsEnCours, setSuggestionsEnCours] = useState(false)
  const [suggestionsErreur, setSuggestionsErreur] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const suggestionsMenuRef = useFermerAuClicExterieur<HTMLDivElement>(suggestionsOuvertes, () => setSuggestionsOuvertes(false))

  useEffect(() => {
    if (selectionScope) textareaRef.current?.focus()
  }, [selectionScope])

  // Referme le menu de suggestions si l'utilisateur change de diapositive sélectionnée.
  useEffect(() => {
    setSuggestionsOuvertes(false)
  }, [selectedSlideIndex])

  async function chargerSuggestions() {
    if (selectedSlideIndex === null) return
    setSuggestionsEnCours(true)
    setSuggestionsErreur(null)
    try {
      const { suggestions: resultat } = await suggererVisuels(
        selectedSlideIndex,
        texteDiapositiveSelectionnee?.(selectedSlideIndex) ?? "",
        aUneImageSelectionnee?.(selectedSlideIndex) ?? false,
        style
      )
      setSuggestions(resultat)
    } catch (e) {
      setSuggestionsErreur(e instanceof Error ? e.message : "Échec de la suggestion visuelle")
    } finally {
      setSuggestionsEnCours(false)
    }
  }

  function handleSuggererVisuels() {
    setSuggestionsOuvertes((v) => !v)
    if (suggestions.length > 0) return // déjà chargées pour cette ouverture
    void chargerSuggestions()
  }

  // Régénère de nouvelles suggestions si les précédentes ne conviennent pas — même appel,
  // relancé volontairement (pas de court-circuit "déjà chargées").
  function handleRegenererVisuels() {
    void chargerSuggestions()
  }

  function handleChoisirSuggestion(s: SuggestionVisuelle) {
    if (selectedSlideIndex === null) return
    onDispositionChoisie?.(selectedSlideIndex, s.disposition, s.donnees)
    setSuggestionsOuvertes(false)
    setSuggestions([])
  }

  function commit() {
    const texte = instruction.trim()
    if (!texte) return

    const userMessage: ChatMessage = { id: nextId++, role: "user", text: texte }
    setMessages((m) => [...m, userMessage])
    onInstructionChange("")
    onClearSelectionScope?.()

    // Chat en texte libre : reste mocké pour l'instant.
    setMessages((m) => [...m, { id: nextId++, role: "assistant", text: CANNED_REPLIES[userMessage.id % CANNED_REPLIES.length] }])
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      commit()
    }
  }

  return (
    <div className="flex flex-col gap-3 p-4 border-t border-border">
      {selectedSlideIndex !== null && (
        <div ref={suggestionsMenuRef} className="relative">
          <button
            type="button"
            onClick={handleSuggererVisuels}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-rapports/30 text-rapports-dark hover:bg-rapports-light transition-colors"
          >
            <Wand2 size={13} /> Proposer des visuels pour cette diapositive
          </button>

          {suggestionsOuvertes && (
            <div className="absolute top-full mt-1 right-0 bg-surface border border-border rounded-lg shadow-lg p-2 z-10 w-72 flex flex-col gap-2">
              {suggestionsEnCours && <p className="text-xs text-muted italic px-1 py-1">Analyse en cours…</p>}
              {suggestionsErreur && <p className="text-xs text-alert px-1">{suggestionsErreur}</p>}
              {!suggestionsEnCours && !suggestionsErreur && suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleChoisirSuggestion(s)}
                  className="text-left rounded-lg border border-border hover:border-rapports hover:bg-rapports-light/40 transition-colors p-2"
                >
                  <p className="text-xs font-semibold text-foreground">{s.label}</p>
                  <p className="text-[11px] text-muted mt-0.5">{s.description}</p>
                </button>
              ))}
              {!suggestionsEnCours && (
                <button
                  type="button"
                  onClick={handleRegenererVisuels}
                  className="flex items-center justify-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-border hover:bg-slate-50 text-muted transition-colors"
                >
                  <RotateCcw size={12} /> Régénérer d'autres visuels
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
        {messages.length === 0 && (
          <p className="text-xs text-muted italic">
            Donnez une instruction globale, ou surlignez du texte à gauche puis « Ask IA ✨ ».
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`text-sm rounded-lg px-3 py-2 max-w-[90%] ${
              m.role === "user" ? "self-end bg-rapports-light text-rapports-dark" : "self-start bg-slate-100 text-foreground"
            }`}
          >
            {m.text}
          </div>
        ))}
      </div>

      {selectionScope && (
        <div className="flex items-center justify-between gap-2 bg-rapports-light text-rapports-dark text-xs rounded-lg px-3 py-2">
          <span className="truncate">Sur la sélection : « {selectionScope.slice(0, 50)}{selectionScope.length > 50 ? "…" : ""} »</span>
          <button onClick={() => onClearSelectionScope?.()} aria-label="Retirer la sélection" className="shrink-0 hover:opacity-70">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="relative">
        <textarea
          ref={textareaRef}
          value={instruction}
          onChange={(e) => onInstructionChange(e.target.value)}
          onKeyDown={onKeyDown}
          rows={2}
          placeholder="Écrire une instruction pour l'IA…"
          className="w-full px-3 py-2.5 rounded-xl border border-border bg-surface text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-rapports resize-none"
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={commit}
          className="ml-auto flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-rapports text-white hover:opacity-90 transition-opacity"
        >
          <Sparkles size={14} /> Envoyer
        </button>
      </div>
    </div>
  )
}
