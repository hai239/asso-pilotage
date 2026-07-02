"use client"

import { useEffect, useRef } from "react"

/** Ferme un menu/popover dès qu'on clique en dehors de son conteneur (bouton + panneau
 * ouvrant) — cliquer ailleurs équivaut à ne jamais avoir ouvert le menu. Le ref renvoyé doit
 * englober à la fois le bouton déclencheur et le panneau, pour que cliquer le bouton lui-même
 * ne soit pas considéré comme "extérieur". Utilisé par les menus du module Rapports. */
export function useFermerAuClicExterieur<T extends HTMLElement>(ouvert: boolean, fermer: () => void) {
  const ref = useRef<T>(null)

  useEffect(() => {
    if (!ouvert) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) fermer()
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [ouvert, fermer])

  return ref
}
