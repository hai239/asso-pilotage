import LegalPage, { Section, Todo } from "@/components/LegalPage"

export const metadata = { title: "Mentions légales — Asso Pilotage" }

export default function MentionsLegalesPage() {
  return (
    <LegalPage title="Mentions légales" updated="1er juillet 2026">
      <p>
        Conformément à l'article 6 de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans
        l'économie numérique (LCEN), les informations suivantes sont portées à la connaissance
        des utilisateurs du site.
      </p>

      <Section title="Éditeur du site">
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li>Dénomination : <Todo>nom exact de l'association</Todo></li>
          <li>Forme juridique : <Todo>association loi 1901 (à confirmer)</Todo></li>
          <li>Siège social : <Todo>adresse postale complète</Todo></li>
          <li>Numéro SIRET / RNA : <Todo>SIRET et/ou n° RNA (W…)</Todo></li>
          <li>Téléphone : <Todo>numéro de contact</Todo></li>
          <li>Adresse e-mail : <Todo>email de contact</Todo></li>
          <li>Directeur / directrice de la publication : <Todo>nom du/de la responsable de publication</Todo></li>
        </ul>
      </Section>

      <Section title="Hébergement">
        <p>Le site est hébergé par :</p>
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li>Vercel Inc.</li>
          <li>340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis</li>
          <li>Site : <a href="https://vercel.com" className="text-familles-dark hover:underline">vercel.com</a></li>
        </ul>
      </Section>

      <Section title="Propriété intellectuelle">
        <p>
          L'ensemble des contenus (structure, textes, éléments graphiques, code) présents sur ce
          site est, sauf mention contraire, la propriété de l'éditeur ou de ses partenaires. Toute
          reproduction, représentation ou diffusion, totale ou partielle, sans autorisation
          préalable est interdite.
        </p>
      </Section>

      <Section title="Responsabilité">
        <p>
          L'application est un outil de gestion interne à accès restreint (authentification
          requise). L'éditeur s'efforce d'assurer l'exactitude des informations mais ne saurait être
          tenu responsable des erreurs, d'une indisponibilité temporaire du service ou de l'usage
          qui en est fait par les personnes autorisées.
        </p>
      </Section>

      <Section title="Données personnelles">
        <p>
          Le traitement des données personnelles est décrit dans la{" "}
          <a href="/confidentialite" className="text-familles-dark hover:underline">politique de confidentialité</a>.
        </p>
      </Section>
    </LegalPage>
  )
}
