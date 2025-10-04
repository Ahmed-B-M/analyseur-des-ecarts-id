
export const prefixesDepots: { [key: string]: string[] } = {
  "Aix": [
    "Aix"
  ],
  "Castries": [
    "Cast"
  ],
  "Rungis": [
    "Rung"
  ],
  "Antibes": [
    "Solo"
  ],
  "VLG": [
    "Villeneuve",
    "Vill"
  ],
  "Vitry": [
    "Vitr"
  ]
};

/**
 * Détermine le nom du dépôt à partir du nom de l'entrepôt en utilisant la configuration.
 * @param entrepot - Le nom complet de l'entrepôt (ex: "Villeneuve-la-Garenne 1").
 * @returns Le nom du dépôt configuré (ex: "VLG") ou une valeur par défaut.
 */
export const getNomDepot = (entrepot: string | undefined): string => {
  if (!entrepot) {
    return 'Inconnu';
  }

  const lowerCaseEntrepot = entrepot.toLowerCase();

  // Parcourir la configuration pour trouver un préfixe correspondant (insensible à la casse).
  for (const [nomDepot, prefixes] of Object.entries(prefixesDepots)) {
    if (prefixes.some(prefix => lowerCaseEntrepot.startsWith(prefix.toLowerCase()))) {
      return nomDepot;
    }
  }

  // Si aucun préfixe ne correspond, utiliser le premier mot comme solution de repli.
  return entrepot.split(' ')[0] || 'Inconnu';
};
