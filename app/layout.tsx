import type { Metadata } from "next"
import { Inter, Poppins } from "next/font/google"
import "./globals.css"
import { AuthProvider } from "@/lib/auth-context"
import AuthGate from "@/components/AuthGate"

// Charte « Estuaire » : Inter (texte) + Poppins (titres)
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] })
const poppins = Poppins({ variable: "--font-poppins", weight: ["500", "600", "700"], subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Asso – Pilotage",
  description: "Interface de gestion de l'association",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${inter.variable} ${poppins.variable} h-full`}>
      <body className="h-full flex bg-background">
        <a href="#main-content" className="skip-nav">Aller au contenu principal</a>
        <AuthProvider>
          <AuthGate>
            <main id="main-content" className="flex-1 overflow-y-auto">{children}</main>
          </AuthGate>
        </AuthProvider>
      </body>
    </html>
  )
}
