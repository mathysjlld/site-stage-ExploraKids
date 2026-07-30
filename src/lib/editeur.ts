// ─────────────────────────────────────────────────────────────────────────────
// IDENTITÉ LÉGALE DE L'ÉDITEUR — SOURCE UNIQUE
//
// Toutes les pages légales (mentions légales, CGV, politique de confidentialité)
// et l'expéditeur des e-mails lisent ce fichier. C'est le SEUL endroit à modifier
// le jour où l'encaissement bascule.
//
// ⚠️ À CHANGER EN MÊME TEMPS QUE LE COMPTE STRIPE — pas avant, pas après.
// Le vendeur déclaré dans les CGV doit être celui qui encaisse réellement :
// tant que les paiements arrivent sur le compte Stripe de Kaiden, ces valeurs
// doivent rester les siennes. Le jour de la bascule, on remplace les constantes
// ci-dessous d'un bloc et les 30 mentions du site suivent.
//
// Ce qu'il faudra alors renseigner :
//   NOM_EDITEUR             prénom + nom + forme juridique (ex. « entrepreneur individuel »)
//   DIRECTEUR_PUBLICATION   la personne physique responsable
//   SIRET                   14 chiffres, une fois la micro-entreprise immatriculée
//   ADRESSE                 adresse de l'établissement déclarée à l'INPI
//   EMAIL_CONTACT           idéalement contact@lesmondesdusavoir.fr, pas un Gmail
//   MENTION_TVA             dépend du régime : franchise en base ou TVA applicable
// ─────────────────────────────────────────────────────────────────────────────

/** Espace insécable : garde un numéro ou un montant d'un seul tenant à l'affichage. */
const INSEC = " ";

/** Dénomination complète de l'exploitant, telle qu'affichée comme éditeur et vendeur. */
export const NOM_EDITEUR = "Kaïden Zoghlami Vialle, entrepreneur individuel";

/** Personne physique responsable du contenu publié (art. 6 LCEN). */
export const DIRECTEUR_PUBLICATION = "Kaïden Zoghlami Vialle";

/** Numéro SIRET, groupé par tranches insécables comme sur l'avis de situation. */
export const SIRET = ["890", "831", "415", "00025"].join(INSEC);

/** Adresse de l'établissement. */
export const ADRESSE = "172 rue Charles Germain, 69400 Villefranche-sur-Saône, France";

/** Adresse de contact — sert aussi de point d'entrée RGPD (accès, rectification, suppression). */
export const EMAIL_CONTACT = "kaidenvialle@gmail.com";

/** Régime de TVA affiché sur les prix et dans les mentions légales. */
export const MENTION_TVA = `TVA non applicable, article 293${INSEC}B du Code général des impôts`;

/** Lien `mailto:` prêt à poser dans un href. */
export const LIEN_CONTACT = `mailto:${EMAIL_CONTACT}`;
