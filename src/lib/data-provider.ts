
import { Tournee, Tache, MergedData, AnalysisData } from '@/lib/types';
import { analyzeData } from '@/lib/dataAnalyzer';

export function processAndAnalyzeData(
  mergedData: MergedData[],
  filters: Record<string, any>
): AnalysisData | null {
  if (!mergedData.length) {
    return null;
  }
  
  const tourneeUniqueIds = new Set(mergedData.map(d => d.tourneeUniqueId));
  const depots = [...new Set(mergedData.map(t => (t.entrepot || "").split(' ')[0]))].filter(Boolean).sort();
  const warehouses = [...new Set(mergedData.map(t => t.entrepot))];


  const analysisResult = analyzeData(mergedData, filters);
  
  return {
    ...analysisResult,
    rawData: mergedData,
    filteredData: mergedData, // This will be updated by the context provider
    depots: depots,
    warehouses: warehouses,
  };
}
