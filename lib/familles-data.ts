// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type Groupe = "Pré-A1" | "Alpha" | "A1" | "A2" | ""
export type Inscription = "Payé" | "À payer" | "Exonéré" | ""
export type QVP = "OUI" | "NON"
export type AutorisationParentale = "OUI" | "NON" | ""
export type Statut = "Actif" | "À surveiller" | "Abandon"

export function getStatut(assiduite: number): Statut {
  if (assiduite >= 75) return "Actif"
  if (assiduite >= 50) return "À surveiller"
  return "Abandon"
}

export interface Famille {
  id: string
  nomFamille: string
  contactPrincipal: string
  telephone: string
  adresse: string
  codePostal: string
  ville: string
  quartierQVP: QVP
  commentaires: string
}

export interface BeneficiaireParent {
  id: string
  idFamille: string
  nom: string
  prenom: string
  telephone: string
  adresse: string
  codePostal: string
  ville: string
  email: string
  whatsapp: string
  groupe: Groupe
  test1: number | null
  test2: number | null
  inscriptions: Inscription
  assiduite: number
  age?: number | null
  dateNaissance?: string
}

export interface BeneficiaireEnfant {
  id: string
  idFamille: string
  nom: string
  prenom: string
  telephone: string
  adresse: string
  codePostal: string
  ville: string
  email: string
  whatsapp: string
  groupe: Groupe
  test1: number | null
  test2: number | null
  autorisationParentale: AutorisationParentale
  inscriptions: Inscription
  assiduite: number
  age?: number | null
  dateNaissance?: string
}

// ──────────────────────────────────────────────
// Données mock (issues du Google Sheet)
// ──────────────────────────────────────────────

export const famillesMock: Famille[] = [
  { id: "FAM-001", nomFamille: "Benali", contactPrincipal: "Fatima Benali", telephone: "06 12 34 56 78", adresse: "12 rue des Lilas", codePostal: "44000", ville: "Nantes", quartierQVP: "OUI", commentaires: "Famille très motivée, 3 enfants scolarisés" },
  { id: "FAM-002", nomFamille: "Dupont", contactPrincipal: "Marie Dupont",  telephone: "07 89 01 23 45", adresse: "5 avenue Victor Hugo", codePostal: "44200", ville: "Nantes", quartierQVP: "NON", commentaires: "Mère seule, disponible le matin uniquement" },
  { id: "FAM-003", nomFamille: "Traoré", contactPrincipal: "Aminata Traoré", telephone: "06 55 44 33 22", adresse: "8 impasse des Roses", codePostal: "44300", ville: "Nantes", quartierQVP: "OUI", commentaires: "Famille arrivée récemment, besoin d'accompagnement" },
  { id: "FAM-004", nomFamille: "Moreau", contactPrincipal: "Sophie Moreau", telephone: "07 11 22 33 44", adresse: "25 boulevard de la Paix", codePostal: "44100", ville: "Nantes", quartierQVP: "NON", commentaires: "" },
  { id: "FAM-005", nomFamille: "Diallo", contactPrincipal: "Kadiatou Diallo", telephone: "06 77 88 99 00", adresse: "3 rue du Moulin", codePostal: "44000", ville: "Nantes", quartierQVP: "OUI", commentaires: "Famille avec 2 parents en formation" },
]

export const parentsMock: BeneficiaireParent[] = [
  { id: "PAR-001", idFamille: "FAM-001", nom: "Benali", prenom: "Fatima",    telephone: "06 12 34 56 78", adresse: "12 rue des Lilas",        codePostal: "44000", ville: "Nantes", email: "fatima.benali@gmail.com",  whatsapp: "06 12 34 56 78", groupe: "A1",     test1: 14, test2: 16,   inscriptions: "Payé",    assiduite: 85, age: 38, dateNaissance: "15/03/1988" },
  { id: "PAR-002", idFamille: "FAM-002", nom: "Dupont", prenom: "Marie",     telephone: "07 89 01 23 45", adresse: "5 avenue Victor Hugo",    codePostal: "44200", ville: "Nantes", email: "marie.dupont@yahoo.fr",    whatsapp: "07 89 01 23 45", groupe: "Pré-A1", test1: 8,  test2: null, inscriptions: "À payer", assiduite: 60, age: 42, dateNaissance: "22/07/1983" },
  { id: "PAR-003", idFamille: "FAM-003", nom: "Traoré", prenom: "Aminata",   telephone: "06 55 44 33 22", adresse: "8 impasse des Roses",     codePostal: "44300", ville: "Nantes", email: "aminata.traore@gmail.com", whatsapp: "06 55 44 33 22", groupe: "Alpha",  test1: null, test2: null, inscriptions: "Exonéré", assiduite: 90, age: 35, dateNaissance: "08/11/1990" },
  { id: "PAR-004", idFamille: "FAM-003", nom: "Traoré", prenom: "Moussa",    telephone: "06 55 44 33 23", adresse: "8 impasse des Roses",     codePostal: "44300", ville: "Nantes", email: "moussa.traore@gmail.com",  whatsapp: "06 55 44 33 23", groupe: "Pré-A1", test1: 10, test2: 12,   inscriptions: "Exonéré", assiduite: 75, age: 40, dateNaissance: "20/08/1985" },
  { id: "PAR-005", idFamille: "FAM-004", nom: "Moreau", prenom: "Sophie",    telephone: "07 11 22 33 44", adresse: "25 boulevard de la Paix", codePostal: "44100", ville: "Nantes", email: "s.moreau@hotmail.fr",       whatsapp: "07 11 22 33 44", groupe: "A2",     test1: 18, test2: 17,   inscriptions: "Payé",    assiduite: 95, age: 45, dateNaissance: "30/01/1981" },
  { id: "PAR-006", idFamille: "FAM-005", nom: "Diallo", prenom: "Kadiatou",  telephone: "06 77 88 99 00", adresse: "3 rue du Moulin",         codePostal: "44000", ville: "Nantes", email: "k.diallo@gmail.com",        whatsapp: "06 77 88 99 00", groupe: "A1",     test1: 12, test2: 15,   inscriptions: "Payé",    assiduite: 80, age: 32, dateNaissance: "19/09/1993" },
]

export const enfantsMock: BeneficiaireEnfant[] = [
  { id: "ENF-001", idFamille: "FAM-001", nom: "Benali", prenom: "Youssef",  telephone: "06 12 34 56 78", adresse: "12 rue des Lilas",        codePostal: "44000", ville: "Nantes", email: "",                      whatsapp: "", groupe: "A1",     test1: 15, test2: 17,   autorisationParentale: "OUI", inscriptions: "Payé",    assiduite: 90,  age: 15, dateNaissance: "04/06/2010" },
  { id: "ENF-002", idFamille: "FAM-001", nom: "Benali", prenom: "Nour",     telephone: "06 12 34 56 78", adresse: "12 rue des Lilas",        codePostal: "44000", ville: "Nantes", email: "",                      whatsapp: "", groupe: "Pré-A1", test1: 9,  test2: null, autorisationParentale: "OUI", inscriptions: "Payé",    assiduite: 70,  age: 12, dateNaissance: "27/09/2013" },
  { id: "ENF-003", idFamille: "FAM-001", nom: "Benali", prenom: "Inès",     telephone: "06 12 34 56 78", adresse: "12 rue des Lilas",        codePostal: "44000", ville: "Nantes", email: "",                      whatsapp: "", groupe: "Alpha",  test1: null, test2: null, autorisationParentale: "OUI", inscriptions: "Payé",    assiduite: 85,  age: 8,  dateNaissance: "11/10/2017" },
  { id: "ENF-004", idFamille: "FAM-003", nom: "Traoré", prenom: "Sékou",    telephone: "06 55 44 33 22", adresse: "8 impasse des Roses",     codePostal: "44300", ville: "Nantes", email: "",                      whatsapp: "", groupe: "A1",     test1: 11, test2: 13,   autorisationParentale: "OUI", inscriptions: "Exonéré", assiduite: 65,  age: 14, dateNaissance: "22/07/2011" },
  { id: "ENF-005", idFamille: "FAM-004", nom: "Moreau", prenom: "Lucas",    telephone: "07 11 22 33 44", adresse: "25 boulevard de la Paix", codePostal: "44100", ville: "Nantes", email: "lucas.moreau@gmail.com", whatsapp: "", groupe: "A2",     test1: 19, test2: 20,   autorisationParentale: "OUI", inscriptions: "Payé",    assiduite: 100, age: 16, dateNaissance: "03/08/2009" },
  { id: "ENF-006", idFamille: "FAM-005", nom: "Diallo", prenom: "Mariama",  telephone: "06 77 88 99 00", adresse: "3 rue du Moulin",         codePostal: "44000", ville: "Nantes", email: "",                      whatsapp: "", groupe: "Pré-A1", test1: 7,  test2: 10,   autorisationParentale: "NON", inscriptions: "À payer", assiduite: 55,  age: 11, dateNaissance: "17/12/2014" },
  { id: "ENF-007", idFamille: "FAM-005", nom: "Diallo", prenom: "Ibrahim",  telephone: "06 77 88 99 00", adresse: "3 rue du Moulin",         codePostal: "44000", ville: "Nantes", email: "",                      whatsapp: "", groupe: "Alpha",  test1: null, test2: null, autorisationParentale: "OUI", inscriptions: "Exonéré", assiduite: 80,  age: 9,  dateNaissance: "29/08/2016" },
]

// ──────────────────────────────────────────────
// Clés localStorage
// ──────────────────────────────────────────────

export const STORAGE_FAMILLES  = "asso-familles"
export const STORAGE_PARENTS   = "asso-beneficiaires-parents-v2"
export const STORAGE_ENFANTS   = "asso-beneficiaires-enfants-v2"

// ──────────────────────────────────────────────
// Helper load générique
// ──────────────────────────────────────────────

export function loadFromStorage<T>(key: string, fallback: T[]): T[] {
  if (typeof window === "undefined") return fallback
  try {
    const s = localStorage.getItem(key)
    return s ? (JSON.parse(s) as T[]) : fallback
  } catch {
    return fallback
  }
}
