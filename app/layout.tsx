import type { Metadata } from "next"
import { Geist } from "next/font/google"
import "./globals.css"
import { AuthProvider } from "@/lib/auth-context"
import AuthGate from "@/components/AuthGate"

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Asso – Pilotage",
  description: "Interface de gestion de l'association",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${geistSans.variable} h-full`}>
      <body className="h-full flex bg-background">
        <AuthProvider>
          <AuthGate>
            <main className="flex-1 overflow-y-auto">{children}</main>
          </AuthGate>
        </AuthProvider>
      </body>
    </html>
  )
}
