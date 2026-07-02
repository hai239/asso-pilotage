// Petit utilitaire client partagé entre AiChatPanel.tsx (import photo/template via le chat) et
// SlidePreview.tsx (ajout direct d'une photo sur la diapositive sélectionnée).
export function lireFichierEnDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
