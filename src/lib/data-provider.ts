
import { Tournee, Tache, MergedData, AnalysisData } from '@/lib/types';
import { analyzeData } from '@/lib/dataAnalyzer';
import { getNomDepot } from '@/lib/config-depots';

export function processAndAnalyzeData(
  mergedData: MergedData[],
  filters: Record<string, any>
): AnalysisData | null {
  if (!mergedData.length) {
    return null;
  }
  
  const tourneeUniqueIds = new Set(mergedData.map(d => d.tourneeUniqueId));
  const depots = [...new Set(mergedData.map(t => getNomDepot(t.entrepot)))].filter(Boolean).sort();
  const warehouses = [...new Set(mergedData.map(t => t.entrepot))];
  const cities = [...new Set(mergedData.map(t => t.ville))];


  const analysisResult = analyzeData(mergedData, filters);
  
  return {
    ...analysisResult,
    depots: depots,
    warehouses: warehouses,
    cities: cities,
  };
}
