import type { QuoteStrategicBlock } from '@/types/database';

export type PresetLine = {
  service_name: string;
  detail_text: string;
  quantity: number;
  unit: string | null;
  unit_price: number;
  is_optional: boolean;
  is_recommended: boolean;
  strategic_explanation: string;
};

export type QuotePreset = {
  id: string;
  label: string;
  package_name: string;
  proposal_title: string;
  project_object: string;
  strategic_positioning: string;
  conditions: string;
  execution_assumptions: string;
  commercial_recommendation: string;
  promotional_label: string;
  promotional_terms: string;
  ads_budget_note: string;
  maintenance_note: string;
  revision_policy_note: string;
  payment_terms: string;
  strategic_value_blocks: QuoteStrategicBlock[];
  lines: PresetLine[];
};

const ACQUISITION_VISIBILITY: QuotePreset = {
  id: 'acquisition_visibility',
  label: 'Forfait acquisition & visibilité',
  package_name: 'Acquisition & visibilité — diffusion et conversion',
  proposal_title: 'Proposition commerciale',
  project_object:
    'Structurer votre présence digitale, générer de l’attention qualifiée et sécuriser des parcours de conversion mesurables (notoriété locale, trafic payant, actifs créatifs, site crédible).',
  strategic_positioning:
    'Cette proposition vise un pilotage marketing intégré : création d’actifs publicitaires, tests d’angles, pages de conversion dédiées, présence Google Business, achat média encadré et pilotage stratégique. Le SEO recommandé prolonge la visibilité organique au-delà des campagnes.',
  conditions:
    'Engagement et calendrier validés par écrit. Toute prestation hors périmètre fera l’objet d’un avenant ou d’un devis complémentaire. Les livrables sont fournis selon les formats convenus en comité de lancement.',
  execution_assumptions: [
    'Budget média (Meta / Google / autres leviers) non inclus : il est à provisionner et géré distinctement.',
    'Les montants média sont facturés ou versés selon les modalités convenues avec les plateformes ; Supra v. facture la prestation d’achat et d’optimisation.',
    'Le référencement naturel (SEO) est recommandé mais optionnel : il s’inscrit dans une logique de capitalisation sur le moyen terme.',
    'La maintenance technique du site (hors périmètre créatif/marketing) n’est pas incluse sauf convention spécifique.',
    'Les demandes hors scope (nouvelles pages, shootings additionnels, intégrations complexes) pourront nécessiter un addendum.',
  ].join('\n'),
  commercial_recommendation:
    'Le scénario complet est le plus pertinent : il aligne création, test, conversion et visibilité locale, tout en sécurisant un pilotage média et stratégique. Il réduit les angles morts entre acquisition et image de marque, et accélère l’apprentissage campagne grâce aux itérations A/B et aux assets vidéo.',
  promotional_label: 'Offre de lancement (exemple)',
  promotional_terms:
    'Réduction sur le premier mois sous réserve d’un engagement minimum de trois mois sur le forfait (à préciser selon votre grille tarifaire).',
  ads_budget_note:
    'Le budget publicitaire est distinct de la prestation : prévoir une enveloppe mensuelle adaptée à votre marché et à vos objectifs de volume.',
  maintenance_note:
    'Hébergement, mises à jour techniques critiques et évolutions structurelles du site peuvent faire l’objet d’un contrat de maintenance séparé.',
  revision_policy_note:
    'Les allers-retours créatifs sont cadrés par le brief validé ; toute refonte majeure hors brief est traitée comme évolution.',
  payment_terms:
    'Modalités de facturation et d’acompte selon contrat ou avenant. En cas de retard de paiement, les prestations en cours peuvent être suspendues après mise en demeure.',
  strategic_value_blocks: [
    {
      title: 'Production vidéo publicitaire',
      body: 'Des formats courts pensés pour capter l’attention, nourrir les tests créatifs et améliorer la qualité perçue de l’offre. La vidéo soutient la performance des campagnes et accélère l’apprentissage média.',
    },
    {
      title: 'Tests A/B',
      body: 'Comparer des angles, des messages et des hooks pour identifier ce qui convertit réellement, puis réallouer le budget vers les hypothèses gagnantes.',
    },
    {
      title: 'Landing pages',
      body: 'Des pages dédiées qui clarifient la promesse, réduisent la friction et alignent le message sur l’intention publicitaire — levier direct sur le taux de conversion.',
    },
    {
      title: 'Site sur mesure',
      body: 'Un socle crédible pour l’activité : preuve sociale, offre claire, parcours lisible — indispensable lorsque la décision d’achat se joue en ligne.',
    },
    {
      title: 'Fiche Google Business',
      body: 'Renforcer la visibilité locale, la confiance et les interactions « près de moi » lorsque le point de vente ou la zone de chalandise est décisive.',
    },
    {
      title: 'Achat média',
      body: 'Mettre du trafic qualifié derrière les créations et les pages : objectifs, ciblages, enchères et itérations pilotés avec rigueur.',
    },
    {
      title: 'Conseil & stratégie',
      body: 'Prioriser les leviers, cadrer le message, arbitrer budget et créations pour éviter les disperssions et garder une trajectoire claire.',
    },
    {
      title: 'SEO intelligent (recommandé)',
      body: 'Capitaliser sur la demande organique au-delà des campagnes : visibilité durable, moindre dépendance exclusive au paid sur le long terme.',
    },
  ],
  lines: [
    {
      service_name: 'Production de vidéos publicitaires',
      detail_text:
        'Création et déclinaisons de formats courts adaptés aux plateformes ; soutien aux tests créatifs et aux campagnes.',
      quantity: 1,
      unit: 'forfait mensuel',
      unit_price: 0,
      is_optional: false,
      is_recommended: false,
      strategic_explanation:
        'La vidéo capte l’attention en scroll, renforce la mémorisation et fournit des assets pour itérer vite sur les campagnes.',
    },
    {
      service_name: 'Campagne A/B — variation 1',
      detail_text: 'Montage d’une série de tests (angles, accroches, formats) selon brief validé.',
      quantity: 1,
      unit: 'forfait',
      unit_price: 0,
      is_optional: false,
      is_recommended: false,
      strategic_explanation:
        'Isoler l’angle le plus performant pour concentrer le budget sur ce qui prouve sa valeur.',
    },
    {
      service_name: 'Campagne A/B — variation 2',
      detail_text: 'Itération complémentaire pour comparer deux hypothèses fortes et réduire l’incertitude.',
      quantity: 1,
      unit: 'forfait',
      unit_price: 0,
      is_optional: false,
      is_recommended: false,
      strategic_explanation:
        'Éviter le biais d’une seule direction créative : la comparaison structure la décision.',
    },
    {
      service_name: 'Landing pages',
      detail_text: 'Pages dédiées alignées sur les promesses publicitaires et le parcours utilisateur.',
      quantity: 1,
      unit: 'forfait',
      unit_price: 0,
      is_optional: false,
      is_recommended: false,
      strategic_explanation:
        'Une page focalisée améliore la conversion là où la campagne envoie le trafic.',
    },
    {
      service_name: 'Banque visuelle — photos & rushes',
      detail_text: 'Captation et sélection d’assets pour alimenter site, réseaux et publicités.',
      quantity: 1,
      unit: 'forfait',
      unit_price: 0,
      is_optional: false,
      is_recommended: false,
      strategic_explanation:
        'Des visuels authentiques renforcent la crédibilité et la cohérence de la marque.',
    },
    {
      service_name: 'Site web sur mesure (développement)',
      detail_text: 'Intégration sur mesure, performance et mise en ligne selon cahier des charges.',
      quantity: 1,
      unit: 'forfait',
      unit_price: 0,
      is_optional: false,
      is_recommended: false,
      strategic_explanation:
        'Le site ancrage la marque et soutient la conversion lorsque l’offre est expliquée en ligne.',
    },
    {
      service_name: 'Optimisation Google Business Profile',
      detail_text: 'Fiche complétée, catégories, médias et bonnes pratiques de visibilité locale.',
      quantity: 1,
      unit: 'forfait',
      unit_price: 0,
      is_optional: false,
      is_recommended: false,
      strategic_explanation:
        'Renforce la découverte locale et la confiance lors des recherches « near me ».',
    },
    {
      service_name: 'Pilotage achat média',
      detail_text: 'Mise en ligne, optimisation et reporting ; budget média hors prestation.',
      quantity: 1,
      unit: 'forfait mensuel',
      unit_price: 0,
      is_optional: false,
      is_recommended: false,
      strategic_explanation:
        'Transforme les créations et pages en trafic mesurable avec des objectifs clairs.',
    },
    {
      service_name: 'Conseil stratégique & comité',
      detail_text: 'Rythme de pilotage, arbitrages et recommandations selon performance.',
      quantity: 1,
      unit: 'forfait mensuel',
      unit_price: 0,
      is_optional: false,
      is_recommended: false,
      strategic_explanation:
        'Maintient l’alignement business/marketing et accélère les décisions utiles.',
    },
    {
      service_name: 'SEO intelligent — recommandé',
      detail_text:
        'Audit technique & sémantique, plan d’actions et mise en œuvre progressive (périmètre à valider).',
      quantity: 1,
      unit: 'forfait',
      unit_price: 0,
      is_optional: true,
      is_recommended: true,
      strategic_explanation:
        'Construit une visibilité durable et complète l’effort paid sur le moyen terme.',
    },
  ],
};

export const QUOTE_PRESETS: QuotePreset[] = [ACQUISITION_VISIBILITY];

export function getQuotePreset(id: string): QuotePreset | undefined {
  return QUOTE_PRESETS.find((p) => p.id === id);
}
