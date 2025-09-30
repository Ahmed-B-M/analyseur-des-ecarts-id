
import { Tournee, Tache, MergedData, AnalysisData } from '@/lib/types';
import { analyzeData } from '@/lib/dataAnalyzer';

export function processAndAnalyzeData(
  tournees: Tournee[],
  taches: Tache[],
  filters: Record<string, any>
): AnalysisData | null {
  if (!tournees.length || !taches.length) {
    return null;
  }

  const mergedData = mergeData(tournees, taches);
  const filteredData = applyFilters(mergedData, filters);
  
  const analysisResult = analyzeData(filteredData, filters);
  
  // Now, we'll construct the full AnalysisData object
  const depots = [...new Set(tournees.map(t => (t.entrepot || "").split(' ')[0]))].filter(Boolean).sort();
  const warehouses = [...new Set(tournees.map(t => t.entrepot))];

  return {
    ...analysisResult,
    rawData: mergedData,
    filteredData: filteredData,
    depots: depots,
    warehouses: warehouses,
  };
}

function mergeData(tournees: Tournee[], taches: Tache[]): MergedData[] {
  const tourneeMap = new Map(tournees.map((t) => [t.uniqueId, t]));
  return taches.map((tache, index) => ({
    ...tache,
    ordre: index + 1,
    tournee: tourneeMap.get(tache.tourneeUniqueId) || null,
  }));
}

function applyFilters(data: MergedData[], filters: Record<string, any>): MergedData[] {
  return data.filter(item => {
    if (!item.tournee) return false;

    // Apply all filters from the state
    if (filters.depot && !item.tournee.entrepot.startsWith(filters.depot)) return false;
    if (filters.entrepot && item.tournee.entrepot !== filters.entrepot) return false;
    if (filters.city && item.ville !== filters.city) return false;
    if (filters.codePostal && item.codePostal !== filters.codePostal) return false;
    if (filters.heure && new Date(item.heureCloture * 1000).getUTCHours() !== parseInt(filters.heure)) return false;

    // Add other filters as they are implemented...
    
    return true;
  });
}
