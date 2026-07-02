"use client"

import { useRef, useState } from "react"
import { ImagePlus, MapPin, UserCheck } from "lucide-react"
import { decouperDiapositives, POLICES, STYLE_DEFAUT, type Disposition, type DonneesGabarit, type FormatRapport, type StyleRapport } from "@/lib/rapports-data"
import { lireFichierEnDataUrl } from "@/lib/rapports-file-utils"
import { choisirDisposition } from "@/lib/rapports-template-api"

interface GabaritProps {
  texte: string
  donnees?: DonneesGabarit
  style: StyleRapport
  image?: string
}

/** Repli générique : découpe un texte brut en liste courte (lignes, puces "·"/";" ou phrases)
 * pour les gabarits qui attendent normalement une liste structurée (`donnees.items`) mais n'en
 * ont pas reçu (ex. gabarit choisi manuellement sans passer par l'IA). */
function listeDepuisTexte(texte: string, max = 6): string[] {
  const lignes = texte.split(/\n|·|;/).map((s) => s.trim()).filter(Boolean)
  if (lignes.length > 1) return lignes.slice(0, max)
  return texte.split(". ").map((s) => s.trim()).filter(Boolean).slice(0, max)
}

function TexteSlide({ texte, style }: { texte: string; style: StyleRapport }) {
  return (
    <p
      className="text-[11px] leading-relaxed whitespace-pre-wrap text-center max-h-full overflow-hidden"
      style={{ color: "#334155", fontFamily: POLICES[style.typographie].corps }}
    >
      {texte.trim() || <span className="italic text-slate-300">Diapositive vide</span>}
    </p>
  )
}

// ── Gabarits inspirés des "master templates" AREA (PDF de référence — ~10 composants
// réutilisés à travers 50 dispositions). Chacun consomme `donnees` en priorité et se rabat sur
// le texte brut de la diapositive quand un champ manque. ──────────────────────────────────────

function GabaritCouverture({ texte, donnees, style }: GabaritProps) {
  const titre = donnees?.titre || texte.split("\n")[0] || texte
  const titres = POLICES[style.typographie].titres
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-6 relative overflow-hidden">
      <div className="flex items-center gap-1.5 max-w-[85%]">
        <span className="text-xl font-black leading-none" style={{ color: style.couleurPrincipale, fontFamily: titres }}>[</span>
        <span className="text-sm font-black uppercase text-center leading-tight" style={{ color: style.couleurPrincipale, fontFamily: titres }}>{titre}</span>
        <span className="text-xl font-black leading-none" style={{ color: style.couleurPrincipale, fontFamily: titres }}>]</span>
      </div>
      {donnees?.sousTitre && (
        <p className="text-[11px] font-semibold" style={{ color: style.couleurAccent, fontFamily: POLICES[style.typographie].corps }}>{donnees.sousTitre}</p>
      )}
      <div className="absolute -bottom-6 -right-6 w-20 h-20 rounded-full opacity-15" style={{ backgroundColor: style.couleurPrincipale }} />
    </div>
  )
}

function GabaritSommaire({ texte, donnees, style }: GabaritProps) {
  const items = donnees?.items?.length ? donnees.items : listeDepuisTexte(texte, 4)
  return (
    <div className="w-full h-full flex flex-col p-5 gap-2">
      <p className="text-xs font-black uppercase" style={{ color: style.couleurPrincipale, fontFamily: POLICES[style.typographie].titres }}>Sommaire</p>
      <div className="grid grid-cols-2 gap-2 flex-1">
        {items.slice(0, 4).map((item, i) => (
          <div key={i} className="flex items-center gap-2 bg-white rounded-lg border p-2" style={{ borderColor: `${style.couleurPrincipale}25` }}>
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
              style={{ backgroundColor: i % 2 === 0 ? style.couleurPrincipale : style.couleurAccent }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="text-[9px] font-medium leading-snug" style={{ color: "#334155" }}>{item}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function GabaritSeparateur({ texte, donnees, style }: GabaritProps) {
  const titre = donnees?.titre || texte
  const numero = donnees?.numero || "01"
  return (
    <div className="w-full h-full rounded-lg flex flex-col items-center justify-center gap-2 p-6" style={{ backgroundColor: style.couleurPrincipale }}>
      <p className="text-3xl font-black text-white/60 leading-none">{numero}.</p>
      <p className="text-sm font-black text-white text-center uppercase" style={{ fontFamily: POLICES[style.typographie].titres }}>{titre}</p>
    </div>
  )
}

function GabaritKpiCartes({ texte, donnees, style }: GabaritProps) {
  const chiffres = donnees?.chiffres?.length ? donnees.chiffres : [{ valeur: "—", label: texte.slice(0, 40) || "Indicateur" }]
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-4">
      <div className="flex items-start gap-5">
        {chiffres.slice(0, 3).map((c, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div
              className="w-14 h-14 rounded-full border-2 flex items-center justify-center"
              style={{ borderColor: i % 2 === 0 ? style.couleurPrincipale : style.couleurAccent }}
            >
              <span className="text-xs font-black" style={{ color: i % 2 === 0 ? style.couleurPrincipale : style.couleurAccent, fontFamily: POLICES[style.typographie].titres }}>
                {c.valeur}
              </span>
            </div>
            <p className="w-16 text-[8px] text-center font-medium leading-snug" style={{ color: "#334155" }}>{c.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function GabaritTableau({ texte, donnees, style }: GabaritProps) {
  const labels = donnees?.items?.length ? donnees.items : listeDepuisTexte(texte)
  const valeurs = donnees?.items2 ?? []
  return (
    <div className="w-full h-full flex flex-col p-5 gap-0.5 justify-center">
      <div className="flex text-white text-[9px] font-bold rounded-t overflow-hidden" style={{ backgroundColor: style.couleurPrincipale }}>
        <div className="flex-1 px-2 py-1">Élément</div>
        <div className="w-16 px-2 py-1 text-right">Valeur</div>
      </div>
      {labels.slice(0, 5).map((l, i) => (
        <div key={i} className="flex text-[9px] px-2 py-1" style={{ color: "#334155", backgroundColor: i % 2 ? "#f8fafc" : "transparent" }}>
          <div className="flex-1">{l}</div>
          <div className="w-16 text-right font-semibold" style={{ color: style.couleurAccent }}>{valeurs[i] ?? ""}</div>
        </div>
      ))}
    </div>
  )
}

function GabaritBarresProgression({ texte, donnees, style }: GabaritProps) {
  const chiffres = donnees?.chiffres
  if (!chiffres?.length) return <div className="w-full h-full flex items-center justify-center p-6"><TexteSlide texte={texte} style={style} /></div>
  return (
    <div className="w-full h-full flex flex-col justify-center gap-3 p-6">
      {chiffres.slice(0, 4).map((c, i) => {
        const pct = Math.max(0, Math.min(100, parseFloat(c.valeur) || 0))
        return (
          <div key={i} className="flex flex-col gap-1">
            <div className="flex justify-between text-[9px] font-medium" style={{ color: "#334155" }}>
              <span>{c.label}</span>
              <span style={{ color: style.couleurAccent }}>{c.valeur}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: style.couleurAccent }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function GabaritTerritoire({ texte, donnees, style }: GabaritProps) {
  const zones = donnees?.items?.length ? donnees.items : listeDepuisTexte(texte, 3)
  const descriptions = donnees?.items2 ?? []
  return (
    <div className="w-full h-full flex p-4 gap-3">
      <div className="w-2/5 h-full rounded-lg border-2 border-dashed flex items-center justify-center shrink-0" style={{ borderColor: `${style.couleurAccent}60` }}>
        <MapPin size={20} style={{ color: style.couleurAccent }} />
      </div>
      <div className="flex-1 flex flex-col gap-1.5 justify-center min-w-0">
        {zones.slice(0, 3).map((z, i) => (
          <div key={i} className="bg-white rounded-lg border-l-4 px-2 py-1" style={{ borderColor: i % 2 === 0 ? style.couleurAccent : style.couleurPrincipale }}>
            <p className="text-[9px] font-semibold truncate" style={{ color: style.couleurPrincipale }}>{z}</p>
            {descriptions[i] && <p className="text-[8px] text-muted truncate">{descriptions[i]}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}

function GabaritTemoignage({ texte, donnees, style }: GabaritProps) {
  const citation = donnees?.citation || texte
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-6">
      <div className="w-8 h-8 rounded-full border-2 flex items-center justify-center" style={{ borderColor: style.couleurAccent }}>
        <UserCheck size={14} style={{ color: style.couleurAccent }} />
      </div>
      <p className="text-[11px] italic text-center max-w-[85%]" style={{ color: style.couleurPrincipale, fontFamily: POLICES[style.typographie].corps }}>
        « {citation} »
      </p>
      {donnees?.auteur && <p className="text-[9px] font-semibold" style={{ color: "#334155" }}>— {donnees.auteur}</p>}
    </div>
  )
}

const SWOT_LABELS = ["Forces", "Faiblesses", "Opportunités", "Menaces"]
const SWOT_COULEURS = ["#0f9d68", "#d97706", "#0f9d68", "#d97706"]

function GabaritSwot({ texte, donnees, style }: GabaritProps) {
  const cases = donnees?.items?.length === 4 ? donnees.items : listeDepuisTexte(texte, 4)
  return (
    <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-1.5 p-3">
      {SWOT_LABELS.map((label, i) => (
        <div key={label} className="rounded-lg p-1.5 flex flex-col gap-0.5 overflow-hidden" style={{ backgroundColor: `${SWOT_COULEURS[i]}12`, border: `1px solid ${SWOT_COULEURS[i]}50` }}>
          <p className="text-[8px] font-bold uppercase" style={{ color: SWOT_COULEURS[i], fontFamily: POLICES[style.typographie].titres }}>{label}</p>
          <p className="text-[8px] leading-snug" style={{ color: "#334155" }}>{cases[i] ?? ""}</p>
        </div>
      ))}
    </div>
  )
}

function GabaritCloture({ texte, donnees, style }: GabaritProps) {
  const titre = donnees?.titre || texte || "Merci !"
  return (
    <div className="w-full h-full rounded-lg flex flex-col items-center justify-center gap-2 p-6" style={{ backgroundColor: style.couleurPrincipale }}>
      <p className="text-xl font-black text-white" style={{ fontFamily: POLICES[style.typographie].titres }}>{titre}</p>
      {donnees?.sousTitre && <p className="text-[11px] text-white/80">{donnees.sousTitre}</p>}
    </div>
  )
}

function ContenuSlide({
  texte,
  image,
  style,
  disposition,
  donnees,
}: {
  texte: string
  image?: string
  style: StyleRapport
  disposition: Disposition
  donnees?: DonneesGabarit
}) {
  switch (disposition) {
    case "couverture": return <GabaritCouverture texte={texte} donnees={donnees} style={style} />
    case "sommaire": return <GabaritSommaire texte={texte} donnees={donnees} style={style} />
    case "separateur": return <GabaritSeparateur texte={texte} donnees={donnees} style={style} />
    case "kpi-cartes": return <GabaritKpiCartes texte={texte} donnees={donnees} style={style} />
    case "tableau": return <GabaritTableau texte={texte} donnees={donnees} style={style} />
    case "barres-progression": return <GabaritBarresProgression texte={texte} donnees={donnees} style={style} />
    case "territoire": return <GabaritTerritoire texte={texte} donnees={donnees} style={style} />
    case "temoignage": return <GabaritTemoignage texte={texte} donnees={donnees} style={style} />
    case "swot": return <GabaritSwot texte={texte} donnees={donnees} style={style} />
    case "cloture": return <GabaritCloture texte={texte} donnees={donnees} style={style} />
  }

  if (disposition === "image-gauche") {
    return (
      <div className="w-full h-full flex">
        <div
          className="w-1/2 h-full flex items-center justify-center rounded-l-lg overflow-hidden"
          style={{
            backgroundColor: image ? "transparent" : `${style.couleurAccent}30`,
            boxShadow: image ? `inset 0 0 0 3px ${style.couleurAccent}` : undefined,
          }}
        >
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-[10px] italic text-slate-400">Image</span>
          )}
        </div>
        <div className="w-1/2 h-full flex items-center justify-center p-4">
          <TexteSlide texte={texte} style={style} />
        </div>
      </div>
    )
  }

  if (disposition === "bandeau") {
    return (
      <div className="w-full h-full flex flex-col">
        <div className="h-[35%] shrink-0 overflow-hidden rounded-t-lg" style={{ backgroundColor: style.couleurPrincipale }}>
          {image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" className="w-full h-full object-cover" />
          )}
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <TexteSlide texte={texte} style={style} />
        </div>
      </div>
    )
  }

  // "centre" (défaut)
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-6">
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          className="w-16 h-16 rounded-full object-cover shadow-sm"
          style={{ boxShadow: `0 0 0 2px ${style.couleurAccent}` }}
        />
      )}
      <TexteSlide texte={texte} style={style} />
    </div>
  )
}

export default function SlidePreview({
  contenu,
  style = STYLE_DEFAUT,
  imagesParDiapositive = {},
  dispositionParDiapositive = {},
  donneesGabaritParDiapositive = {},
  format = "classique",
  logoUrl,
  onActiveParagraphChange,
  selectedSlideIndex,
  onSlideClick,
  onPhotoDirectAdd,
  onDispositionChoisie,
}: {
  contenu: string
  style?: StyleRapport
  imagesParDiapositive?: Record<number, string>
  dispositionParDiapositive?: Record<number, Disposition>
  donneesGabaritParDiapositive?: Record<number, DonneesGabarit>
  format?: FormatRapport
  logoUrl?: string
  onActiveParagraphChange?: (index: number | null) => void
  selectedSlideIndex?: number | null
  onSlideClick?: (index: number) => void
  onPhotoDirectAdd?: (index: number, dataUrl: string) => void
  onDispositionChoisie?: (index: number, disposition: Disposition) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const slideRefs = useRef<(HTMLDivElement | null)[]>([])
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [indexPourUpload, setIndexPourUpload] = useState<number | null>(null)

  // Diapositives dynamiques : une par segment de texte séparé par une ligne de tirets (voir
  // lib/rapports-data.ts). Le nombre n'est pas plafonné (une quarantaine pour un vrai rapport).
  const slides = decouperDiapositives(contenu)

  function handleAjouterPhotoClick(e: React.MouseEvent, index: number) {
    e.stopPropagation()
    setIndexPourUpload(index)
    photoInputRef.current?.click()
  }

  async function handlePhotoSelectionnee(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file && indexPourUpload !== null) {
      const index = indexPourUpload
      const dataUrl = await lireFichierEnDataUrl(file)
      onPhotoDirectAdd?.(index, dataUrl)
      // Adaptation graphique par IA (best-effort) : filet de sécurité si l'appel échoue.
      try {
        const { disposition } = await choisirDisposition(index, slides[index] ?? "", true, undefined)
        onDispositionChoisie?.(index, disposition)
      } catch {
        onDispositionChoisie?.(index, style.disposition === "centre" ? "image-gauche" : style.disposition)
      }
    }
    e.target.value = ""
    setIndexPourUpload(null)
  }

  function handleScroll() {
    if (!scrollRef.current || !onActiveParagraphChange) return
    const containerRect = scrollRef.current.getBoundingClientRect()
    const containerMid = containerRect.top + containerRect.height / 2
    let closestIdx = 0
    let closestDist = Infinity
    slideRefs.current.forEach((el, i) => {
      if (!el) return
      const rect = el.getBoundingClientRect()
      const dist = Math.abs(rect.top + rect.height / 2 - containerMid)
      if (dist < closestDist) {
        closestDist = dist
        closestIdx = i
      }
    })
    onActiveParagraphChange(closestIdx)
  }

  const aspectRatio = format === "a4" ? "210 / 297" : "16 / 9"

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="h-full overflow-y-scroll [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full"
      style={{ scrollbarWidth: "thin", scrollbarColor: "#cbd5e1 transparent" }}
    >
      <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelectionnee} />

      {slides.map((texte, i) => {
        const image = imagesParDiapositive[i]
        // Disposition effective : décision IA (choisirDisposition/gabarit de template) si
        // disponible pour cette diapositive, sinon repli sur la disposition du deck (avec
        // bascule de sécurité centre→image-gauche si une image existe sans décision IA).
        const disposition = dispositionParDiapositive[i] ?? (image && style.disposition === "centre" ? "image-gauche" : style.disposition)
        const donnees = donneesGabaritParDiapositive[i]

        return (
          <div key={i} ref={(el) => { slideRefs.current[i] = el }} className={format === "a4" ? "p-4 mx-auto max-w-[220px] border-b border-border" : "p-4 border-b border-border"}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => onSlideClick?.(i)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSlideClick?.(i) } }}
              aria-pressed={selectedSlideIndex === i}
              className={`relative w-full rounded-lg shadow-sm cursor-pointer transition-shadow ${
                selectedSlideIndex === i ? "ring-2 ring-rapports" : ""
              }`}
              style={{ backgroundColor: "#ffffff", border: `1px solid ${style.couleurPrincipale}20`, aspectRatio }}
            >
              <ContenuSlide texte={texte} image={image} style={style} disposition={disposition} donnees={donnees} />
              <div className="absolute top-2 left-2 bg-white/90 rounded-full p-1 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrl || "/area-logo.png"} alt="Logo" className="w-5 h-5 object-contain" />
              </div>
              {selectedSlideIndex === i && onPhotoDirectAdd && (
                <button
                  type="button"
                  onClick={(e) => handleAjouterPhotoClick(e, i)}
                  title="Ajouter une photo à cette diapositive"
                  aria-label="Ajouter une photo à cette diapositive"
                  className="absolute top-2 right-2 flex items-center justify-center w-7 h-7 rounded-full bg-rapports text-white shadow-md hover:opacity-90 transition-opacity"
                >
                  <ImagePlus size={14} />
                </button>
              )}
            </div>
            <p className="text-[11px] text-muted text-center mt-1.5" style={{ fontFamily: POLICES[style.typographie].titres }}>
              Diapositive {i + 1}
            </p>
          </div>
        )
      })}
    </div>
  )
}
