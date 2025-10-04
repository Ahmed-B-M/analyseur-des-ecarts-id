import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { prefixesDepots } from "./config-depots";
import { driverCarrierMap } from "./driver-carrier-mapping";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getCarrierFromDriverName(driverName: string): string | null {
  if (!driverName) {
    return null;
  }
  
  const customMapping = driverCarrierMap[driverName];
  if (customMapping) {
    return customMapping;
  }

  // Transporteur "ID LOG" (case-insensitive)
  if (driverName.toLowerCase().includes("id log")) {
    return "ID LOG";
  }

  // Transporteur STT
  if (driverName.startsWith("STT")) {
    // Assuming the carrier name is what follows "STT "
    const potentialCarrier = driverName.substring(4).split(' ')[0];
    return potentialCarrier || "STT";
  }

  const suffix = driverName.slice(-1);

  switch (suffix) {
    case '3':
      return 'BC one';
    case '0':
      return 'DUB';
    case '8':
      return 'GPC';
    case '7':
      return 'GPL';
    case '6':
      return 'RK';
    case '2':
      return 'Express';
    case '5':
      return 'MLG';
    default:
      return null;
  }
}

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
