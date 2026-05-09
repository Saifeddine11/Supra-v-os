/**
 * Libellés et textes d’appoint pour le PDF « proposition commerciale ».
 * Ton : précis, commercial, sans formulations génériques ni « IA ».
 */

export const QUOTE_PDF_COPY = {
  docLabel: 'Document contractuel',
  docType: 'Proposition commerciale',
  agencyTagline: 'Agency OS',

  /** Sous-titre discret sous le titre principal (si pas de texte utilisateur). */
  coverIntroFallback:
    'La présente proposition formalise le périmètre, les livrables et l’investissement associés à votre projet. Elle sert de base contractuelle une fois acceptée.',

  metaClient: 'Client',
  metaObject: 'Objet',
  metaConditions: 'Modalités & conditions',
  metaValidity: 'Validité de l’offre',

  refLabel: 'Référence',
  issueLabel: 'Date d’émission',

  sectionServices: 'Investissement & périmètre',
  sectionServicesLead:
    'Le détail ci-dessous regroupe les prestations, leur articulation et les montants retenus. Les lignes « recommandé » ou « option » sont indiquées explicitement.',

  colService: 'Prestation',
  colDetail: 'Périmètre & livrables',
  colPrice: 'Montant',

  badgeRecommended: 'Recommandé',
  badgeOptional: 'Option',

  totalsTitle: 'Synthèse financière',
  totalsSubtitle: (currency: string) => `Montants exprimés en ${currency} — TVA selon taux en vigueur indiqué.`,
  subtotalHt: 'Total hors taxes',
  vat: (rate: number) => `TVA (${rate} %)`,
  beforeDiscount: 'Net fiscal avant remise',
  discount: 'Remise commerciale',
  totalTtc: 'Net à payer TTC',
  firstMonth: 'Échéance indicative — 1er mois',
  recurring: 'Récurrence mensuelle indicative',
  commitment: 'Engagement minimum',

  sectionValue: 'Valeur ajoutée par composante',
  sectionValueLead:
    'Chaque volet ci-dessous précise l’intérêt business attendu : visibilité, conversion, crédibilité ou pilotage. Il complète le descriptif opérationnel du tableau précédent.',

  sectionExecution: 'Cadre d’exécution & limites',
  executionFallback: [
    'Les honoraires couvrent la production et l’accompagnement décrits dans cette proposition. Les budgets d’achat média sont provisionnés et réglés distinctement (plateformes, régies).',
    'Toute demande sortant du périmètre validé fera l’objet d’un devis complémentaire ou d’un avenant avant mise en œuvre.',
    'Le respect des délais de validation et des retours côté client conditionne directement le calendrier de livraison et de mise en ligne.',
  ].join('\n\n'),

  sectionClosing: 'Recommandation & suite',
  closingFallback:
    'Nous restons à votre disposition pour ajuster volumes, calendrier ou priorisation selon vos contraintes opérationnelles et votre capacité d’investissement.',

  summaryClosing: 'Rappel de l’engagement financier',
  bonPourAccord: 'Bon pour accord',
  bonPourAccordBody:
    'La signature du présent bon pour accord vaut acceptation sans réserve du périmètre décrit, des montants TTC indiqués et des modalités précisées dans ce document. Le démarrage effectif des prestations intervient après confirmation écrite et selon le planning arrêté de commun accord.',

  signHint: 'Nom, qualité, lieu, date et signature',
  signForClient: (name: string) => `Pour ${name}, bon pour accord`,

  footerConfidential: (agency: string, clientName: string) =>
    `${agency} — document confidentiel destiné exclusivement à ${clientName}. Toute reproduction ou diffusion non autorisée est interdite.`,
} as const;
