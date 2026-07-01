import LegalPage, { Section, Todo } from "@/components/LegalPage"

export const metadata = { title: "Déclaration d'accessibilité — Asso Pilotage" }

export default function AccessibilitePage() {
  return (
    <LegalPage title="Déclaration d'accessibilité" updated="1er juillet 2026">
      <p>
        L'association s'engage à rendre son application accessible conformément au Référentiel
        général d'amélioration de l'accessibilité (RGAA) et à l'article 47 de la loi n° 2005-102 du
        11 février 2005.
      </p>
      <p className="text-sm text-muted">
        Note : cette obligation s'impose pleinement aux organismes publics et aux grandes
        entreprises. Nous la suivons ici comme bonne pratique. <Todo>confirmer si l'association y est légalement soumise</Todo>
      </p>

      <Section title="État de conformité">
        <p>
          L'application <strong>n'a pas encore fait l'objet d'un audit d'accessibilité</strong>{" "}
          complet. Son état de conformité au RGAA ne peut donc pas être déclaré à ce jour.{" "}
          <Todo>mettre à jour après audit : « non conforme » / « partiellement conforme » / « totalement conforme » + version du RGAA</Todo>
        </p>
      </Section>

      <Section title="Mesures déjà prises">
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li>Navigation au clavier et indicateurs de focus visibles</li>
          <li>Lien d'évitement « Aller au contenu principal »</li>
          <li>Libellés associés aux champs de formulaire et aux boutons d'action</li>
          <li>Information non portée par la seule couleur (icône + libellé)</li>
          <li>Structure sémantique (titres, régions de navigation)</li>
        </ul>
      </Section>

      <Section title="Contenus non accessibles">
        <p>
          Les non-conformités seront listées à l'issue de l'audit.{" "}
          <Todo>lister les écrans / composants non conformes après audit</Todo>
        </p>
      </Section>

      <Section title="Retour d'information et contact">
        <p>
          Si vous rencontrez un défaut d'accessibilité vous empêchant d'accéder à un contenu ou à
          une fonctionnalité, contactez-nous afin qu'une alternative vous soit proposée :{" "}
          <Todo>email de contact accessibilité</Todo>.
        </p>
      </Section>

      <Section title="Voies de recours">
        <p>
          Si vous constatez un défaut d'accessibilité et que la réponse apportée ne vous satisfait
          pas, vous pouvez saisir le Défenseur des droits —{" "}
          <a href="https://www.defenseurdesdroits.fr" className="text-familles-dark hover:underline">
            defenseurdesdroits.fr
          </a>.
        </p>
      </Section>
    </LegalPage>
  )
}
