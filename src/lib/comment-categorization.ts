
export const commentCategories = [
  'Attitude livreur',
  'Amabilité livreur',
  'Casse produit',
  'Manquant produit',
  'Manquant multiple',
  'Manquant bac',
  'Non livré',
  'Erreur de préparation',
  'Erreur de livraison',
  'Livraison en avance',
  'Livraison en retard',
  'Rupture chaine de froid',
  'Process',
  'Non pertinent',
  'Autre',
] as const;

export type CommentCategory = typeof commentCategories[number];

const keywordMap: Record<CommentCategory, string[]> = {
  'Attitude livreur': ['livreur', 'aimable', 'agressif', 'impoli', 'comportement', 'attitude', 'courtois', 'masque'],
  'Casse produit': ['cassé', 'abîmé', 'endommagé', 'éclaté', 'brisé', 'ecrasé'],
  'Manquant produit': ['manquant', 'manque', 'oubli', 'pas reçu', 'jamais eu', 'absent'],
  'Manquant multiple': ['plusieurs manquants', 'plusieurs articles'],
  'Manquant bac': ['sac', 'entier'],
  'Non livré': ['sac', 'entier'],
  'Erreur de préparation': ['erreur', 'mauvais produit', 'inversion'],
  'Erreur de livraison': ['pas ma commande', 'autre client'],
  'Livraison en avance': ['avance', 'trop tôt', 'avant l\'heure'],
  'Livraison en retard': ['retard', 'en retard', 'trop tard', 'attendu', 'pas à l\'heure', 'attente'],
  'Rupture chaine de froid': ['chaîne du froid', 'froid', 'chaud', 'congelé', 'décongelé', 'frais'],
  'Process': ['process', 'application', 'site', 'commande', 'sms', 'notification', 'créneau', 'appel'],
  'Non pertinent': ['non pertinent', 'rien à voir'],
  'Autre': [],
  "Amabilité livreur": []
};

export const categorizeComment = (comment: string | null): CommentCategory => {
  if (!comment) {
    return 'Autre';
  }
  const lowerCaseComment = comment.toLowerCase();
  for (const [category, keywords] of Object.entries(keywordMap)) {
    if (keywords.some(keyword => lowerCaseComment.includes(keyword))) {
      return category as CommentCategory;
    }
  }
  return 'Autre';
};
