
'use client';
import type { AnalysisData, MergedData } from '@/lib/types';
import { Info } from 'lucide-react';
import { useMemo } from 'react';
import { GlobalKpiSection } from './dashboard/GlobalKpiSection';
import { QualityImpactSection } from './dashboard/QualityImpactSection';
import { AnomaliesSection } from './dashboard/AnomaliesSection';
import { TemporalAnalysisSection } from './dashboard/TemporalAnalysisSection';
import { DetailedAnalysisSection } from './dashboard/DetailedAnalysisSection';
import { WorkloadAnalysisSection } from './dashboard/WorkloadAnalysisSection';
import { PerformanceTables } from './dashboard/PerformanceTables';

interface AnalysisDashboardProps {
  analysisData: AnalysisData | null;
  onFilterAndSwitch: (filter: Record<string, any>) => void;
  allData: MergedData[];
  filters: Record<string, any>;
  depots: string[];
}

export default function AnalysisDashboard({ analysisData, onFilterAndSwitch, allData, filters, depots }: AnalysisDashboardProps) {

  const totalTours = useMemo(() => {
    if (!analysisData) return 0;
    const toursKpi = analysisData.generalKpis.find(k => k.title.includes('Tournées'));
    return toursKpi ? parseInt(toursKpi.value) : 0;
  }, [analysisData]);

  if (!analysisData) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-8 bg-card rounded-lg border">
        <Info className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="text-xl font-semibold">Aucune donnée à afficher</h3>
        <p className="text-muted-foreground mt-1">Veuillez ajuster vos filtres ou vérifier les fichiers importés.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Section 1: Vue d'Ensemble & Synthèse Globale */}
      <GlobalKpiSection
        generalKpis={analysisData.generalKpis}
        discrepancyKpis={analysisData.discrepancyKpis}
      />
      
      {/* Section 2: Impact Qualité */}
      <QualityImpactSection qualityKpis={analysisData.qualityKpis} />

      {/* Section 3: Analyse des Causes (Groupes & Anomalies) */}
      <AnomaliesSection
        globalSummary={analysisData.globalSummary}
        overloadedTours={analysisData.overloadedTours}
        durationDiscrepancies={analysisData.durationDiscrepancies}
        lateStartAnomalies={analysisData.lateStartAnomalies}
        totalTours={totalTours}
      />

      {/* Section 4: Analyses Temporelles Détaillées */}
      <TemporalAnalysisSection
        performanceByDay={analysisData.performanceByDayOfWeek}
        performanceBySlot={analysisData.performanceByTimeSlot}
        delayHistogram={analysisData.delayHistogram}
      />

      {/* Section 5: Analyses Géographiques & par Entrepôt */}
      <DetailedAnalysisSection
        delaysByHour={analysisData.delaysByHour}
        advancesByHour={analysisData.advancesByHour}
        delaysByWarehouse={analysisData.delaysByWarehouse}
        advancesByWarehouse={analysisData.advancesByWarehouse}
        onFilterAndSwitch={onFilterAndSwitch}
      />
      
      {/* Section 6: Analyse de la Charge de Travail */}
       <WorkloadAnalysisSection
        workloadByHour={analysisData.workloadByHour}
        avgWorkload={analysisData.avgWorkload}
        avgWorkloadByDriverBySlot={analysisData.avgWorkloadByDriverBySlot}
      />

      {/* Section 7: Performance Humaine & par Groupe */}
      <PerformanceTables
        analysisData={analysisData}
      />
    </div>
  );
}
