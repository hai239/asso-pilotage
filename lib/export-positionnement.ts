// Export du test de positionnement généré en .docx / .pdf — génération 100% côté client
// (pas de backend de stockage, cohérent avec le reste du projet).

import type { Niveau } from "@/lib/positionnement-data"

export interface GeneratedContent {
  contenu: string
  transcription?: string
  audio?: string
  audioError?: string
  image?: string
  imageError?: string
}

export type GeneresCategorie = Record<string, GeneratedContent>

const ORAL_CATEGORIE_ID = "comprehension-orale"

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function slug(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .toLowerCase()
}

/** Convertit un data URI base64 en Buffer + mimeType pour les exports. */
function dataUriToBuffer(dataUri: string): { buffer: Buffer; mimeType: string } {
  const [header, b64] = dataUri.split(",")
  const mimeType = header.replace("data:", "").replace(";base64", "")
  return { buffer: Buffer.from(b64, "base64"), mimeType }
}

export async function exportWord(niveau: Niveau, generes: GeneresCategorie) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun } = await import("docx")

  const children: InstanceType<typeof Paragraph>[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun(`Test de positionnement — ${niveau.label}`)],
    }),
    new Paragraph({
      children: [new TextRun("Nom : ……………………………………      Prénom : ……………………………………      Date : ……………………")],
      spacing: { after: 300 },
    }),
  ]

  for (const cat of niveau.categories) {
    const data = generes[cat.id]
    if (!data?.contenu) continue

    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun(`${cat.nom} / ${cat.bareme}`)],
        spacing: { before: 300 },
      })
    )

    if (cat.id === ORAL_CATEGORIE_ID) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "🔊 Document audio à écouter séparément (généré en ligne, voir module Test de positionnement).",
              italics: true,
            }),
          ],
          spacing: { after: 150 },
        })
      )
    }

    if (data.image) {
      try {
        const { buffer, mimeType } = dataUriToBuffer(data.image)
        const imgType = mimeType.includes("png") ? "png" : "jpg"
        children.push(
          new Paragraph({
            children: [
              new ImageRun({
                data: buffer,
                type: imgType,
                transformation: { width: 400, height: 300 },
              }),
            ],
            spacing: { after: 150 },
          })
        )
      } catch {
        // image non critique — on l'ignore si elle échoue à s'insérer
      }
    }

    for (const line of data.contenu.split("\n")) {
      children.push(new Paragraph({ children: [new TextRun(line)] }))
    }
  }

  const doc = new Document({
    styles: {
      default: { document: { run: { font: "Arial", size: 22 } } },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 32, bold: true, font: "Arial" },
          paragraph: { spacing: { after: 200 }, outlineLevel: 0 },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 26, bold: true, font: "Arial" },
          paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 1 },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 },
          },
        },
        children,
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  downloadBlob(blob, `test-positionnement-${slug(niveau.label)}.docx`)
}

export async function exportPdf(niveau: Niveau, generes: GeneresCategorie) {
  const { jsPDF } = await import("jspdf")

  const doc = new jsPDF({ unit: "pt", format: "a4" })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 48
  const maxWidth = pageWidth - margin * 2
  let y = margin

  function ensureSpace(lineHeight: number) {
    if (y + lineHeight > pageHeight - margin) {
      doc.addPage()
      y = margin
    }
  }

  function writeLines(text: string, fontSize: number, bold: boolean, spacingAfter: number) {
    doc.setFont("helvetica", bold ? "bold" : "normal")
    doc.setFontSize(fontSize)
    const lines = doc.splitTextToSize(text, maxWidth) as string[]
    for (const line of lines) {
      ensureSpace(fontSize * 1.3)
      doc.text(line, margin, y)
      y += fontSize * 1.3
    }
    y += spacingAfter
  }

  writeLines(`Test de positionnement — ${niveau.label}`, 18, true, 10)
  writeLines("Nom : ……………………………………      Prénom : ……………………………………      Date : ……………………", 11, false, 16)

  for (const cat of niveau.categories) {
    const data = generes[cat.id]
    if (!data?.contenu) continue

    writeLines(`${cat.nom} / ${cat.bareme}`, 14, true, 6)

    if (cat.id === ORAL_CATEGORIE_ID) {
      writeLines("Document audio à écouter séparément (généré en ligne, voir module Test de positionnement).", 10, false, 8)
    }

    if (data.image) {
      try {
        const { buffer, mimeType } = dataUriToBuffer(data.image)
        const imgFormat = mimeType.includes("png") ? "PNG" : "JPEG"
        const imgWidth = 320
        const imgHeight = 240
        ensureSpace(imgHeight + 12)
        doc.addImage(buffer as unknown as string, imgFormat, margin, y, imgWidth, imgHeight)
        y += imgHeight + 12
      } catch {
        // image non critique
      }
    }

    for (const line of data.contenu.split("\n")) {
      writeLines(line || " ", 11, false, 2)
    }
    y += 12
  }

  doc.save(`test-positionnement-${slug(niveau.label)}.pdf`)
}
