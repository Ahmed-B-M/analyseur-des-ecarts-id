
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Wand2, Loader2, FileText, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateLogisticsReport, GenerateLogisticsReportInput, GenerateLogisticsReportOutput } from '@/ai/flows/generate-logistics-report';
import type { AnalysisData, MergedData, CustomReportConfig } from '@/lib/types';
import { analyzeData } from '@/lib/dataAnalyzer';
import { getWeek, startOfWeek, endOfWeek, parseISO } from 'date-fns';

interface AiReportGeneratorProps {
  reportConfig: CustomReportConfig;
  data: MergedData[];
}

export default function AiReportGenerator({ reportConfig, data }: AiReportGeneratorProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleGenerateAndOpenReport = async () => {
    setIsLoading(true);
    
    try {
        // 1. Filter data based on config
        const filteredData = data.filter(item => {
            if (!item.tournee) return false;
            if (reportConfig.filters.depots.length > 0 && !reportConfig.filters.depots.some(d => item.tournee.entrepot.startsWith(d))) {
                return false;
            }
            if (reportConfig.filters.warehouses.length > 0 && !reportConfig.filters.warehouses.includes(item.tournee.entrepot)) {
                return false;
            }
            return true;
        });

        // 2. Perform analysis on filtered data
        const analysisData: AnalysisData = analyzeData(filteredData, {});

        // 3. Prepare weekly analyses if requested
        const weeklyAnalyses = (reportConfig.selectedWeeks || []).map(weekKey => {
            const weekData = filteredData.filter(item => {
                try {
                    const date = parseISO(item.date);
                    const itemWeekNumber = getWeek(date, { weekStartsOn: 1 });
                    const itemYear = date.getFullYear();
                    return `${itemYear}-W${String(itemWeekNumber).padStart(2, '0')}` === weekKey;
                } catch (e) { return false; }
            });
            const weekStart = weekData.length > 0 ? startOfWeek(parseISO(weekData[0].date), { weekStartsOn: 1 }) : new Date();
            const weekEnd = weekData.length > 0 ? endOfWeek(parseISO(weekData[0].date), { weekStartsOn: 1 }) : new Date();

            return {
              weekLabel: weekKey,
              dateRange: { from: weekStart, to: weekEnd },
              analysis: analyzeData(weekData, {}),
            };
        });

        // 4. Construct AI input based on selections
        const input: GenerateLogisticsReportInput = {
            config: reportConfig,
            analysis: {},
        };

        const totalTours = analysisData.generalKpis?.find(k => k.title.includes('Tournées'))?.value ? parseInt(analysisData.generalKpis.find(k => k.title.includes('Tournées'))!.value) : 0;

<<<<<<< HEAD
        // Dynamically populate analysis based on config
        if (reportConfig.sections.globalKpis) {
            input.analysis.generalKpis = (analysisData.generalKpis || []).map(({icon, ...kpi}) => kpi);
            input.analysis.discrepancyKpis = (analysisData.discrepancyKpis || []).map(({changeType, ...kpi}) => kpi).filter(kpi => !kpi.title.toLowerCase().includes('distance'));
        }
        if (reportConfig.sections.qualityImpact) {
            const lateTasksWithBadReview = filteredData.filter(d => d.notation && d.notation <= 3 && d.retardStatus === 'late');
            input.analysis.negativeReviewsFromLateness = {
                title: "Avis Négatifs sur Retards",
                value: `${lateTasksWithBadReview.length}`,
                description: ''
            };
        }
        if (reportConfig.sections.anomalies) {
            input.analysis.overloadedToursPercentage = totalTours > 0 ? ((analysisData.overloadedTours || []).length / totalTours) * 100 : 0;
            input.analysis.durationDiscrepancyPercentage = totalTours > 0 ? ((analysisData.durationDiscrepancies || []).filter(d => d.ecart > 900).length / totalTours) * 100 : 0;
            input.analysis.planningAnomalyPercentage = totalTours > 0 ? ((analysisData.lateStartAnomalies || []).length / totalTours) * 100 : 0;
            input.analysis.top10OverloadedTours = analysisData.overloadedTours?.slice(0, 5).map(t => ({...t, entrepot: t.entrepot}));
        }
        if(reportConfig.sections.temporalAnalysis) {
             input.analysis.performanceByDayOfWeek = analysisData.performanceByDayOfWeek;
             input.analysis.performanceByTimeSlot = analysisData.performanceByTimeSlot;
             input.analysis.delayHistogram = analysisData.delayHistogram;
        }
        if(reportConfig.sections.geoAnalysis) {
            input.analysis.topWarehouseByDelay = analysisData.delaysByWarehouse?.[0]?.key;
            input.analysis.topCityByDelay = analysisData.delaysByCity?.[0]?.key;
        }
=======
        // --- KPI Calculations ---
        const lateTasksWithBadReview = (allData || []).filter(d => d.notation && d.notation <= 3 && d.retardStatus === 'late');
        const totalLateTasks = (allData || []).filter(d => d.retardStatus === 'late').length;
        const percentageOfLateTasksWithBadReview = totalLateTasks > 0 ? (lateTasksWithBadReview.length / totalLateTasks) * 100 : 0;
        const negativeReviewsKpi = {
            title: "Avis Négatifs sur Retards",
            value: `${lateTasksWithBadReview.length}`,
            description: `${percentageOfLateTasksWithBadReview.toFixed(1)}% des livraisons en retard ont une mauvaise note.`
        };
        
        // --- Inefficiency Quantification ---
        const totalCumulativeDelaySeconds = (allData || []).reduce((acc, d) => d.retardStatus === 'late' ? acc + d.retard : acc, 0);
        const totalCumulativeDelayHours = totalCumulativeDelaySeconds / 3600;
        const totalAdditionalServiceSeconds = (analysisData.durationDiscrepancies || []).reduce((acc, d) => d.ecart > 0 ? acc + d.ecart : acc, 0);
        const totalAdditionalServiceHours = totalAdditionalServiceSeconds / 3600;

        // --- Anomaly Percentages ---
        const overloadedToursPercentage = totalTours > 0 ? ((analysisData.overloadedTours || []).length / totalTours) * 100 : 0;
        const positiveDiscrepancyTours = (analysisData.durationDiscrepancies || []).filter(d => d.ecart > 900).length;
        const durationDiscrepancyPercentage = totalTours > 0 ? (positiveDiscrepancyTours / totalTours) * 100 : 0;
        const planningAnomalyPercentage = totalTours > 0 ? ((analysisData.lateStartAnomalies || []).length / totalTours) * 100 : 0;

        // --- Preparing Top 10 examples ---
        const top10Overloaded = (analysisData.overloadedTours || [])
            .sort((a,b) => b.tauxDepassementPoids - a.tauxDepassementPoids)
            .slice(0, 10);

        const top10PositiveDuration = (analysisData.durationDiscrepancies || [])
            .filter(d => d.ecart > 0)
            .sort((a,b) => b.ecart - a.ecart)
            .slice(0, 10);

        const top10Anomalies = (analysisData.lateStartAnomalies || [])
            .sort((a,b) => b.tasksInDelay - a.tasksInDelay)
            .slice(0, 10);

        // --- Exemplary Driver Analysis ---
        const exemplaryDrivers = (analysisData.performanceByDriver || [])
            .filter(d => d.overweightToursCount > 0 && d.punctualityRate > 90)
            .sort((a,b) => b.punctualityRate - a.punctualityRate)
            .slice(0, 3)
            .map(d => ({ key: d.key, punctualityRate: d.punctualityRate, overweightToursCount: d.overweightToursCount, avgDelay: d.avgDelay }));

        // --- New Warehouse Overrun Analysis ---
        const warehouseOverruns = (analysisData.overloadedTours || []).reduce((acc, tour) => {
            if (!acc[tour.entrepot]) {
                acc[tour.entrepot] = { totalWeightOverrun: 0, totalTimeOverrun: 0 };
            }
            acc[tour.entrepot].totalWeightOverrun += (tour.poidsReel - tour.poidsPrevu);
            return acc;
        }, {} as Record<string, { totalWeightOverrun: number, totalTimeOverrun: number }>);

        (analysisData.durationDiscrepancies || []).forEach(tour => {
            if (tour.ecart > 0) {
                if (!warehouseOverruns[tour.entrepot]) {
                    warehouseOverruns[tour.entrepot] = { totalWeightOverrun: 0, totalTimeOverrun: 0 };
                }
                warehouseOverruns[tour.entrepot].totalTimeOverrun += tour.ecart / 3600; // convert to hours
            }
        });
        
        const sortedWarehouses = Object.entries(warehouseOverruns)
            .map(([entrepot, data]) => ({ entrepot, ...data }))
            .sort((a, b) => b.totalWeightOverrun - a.totalWeightOverrun);
        
        const top20percentWarehouses = sortedWarehouses.slice(0, Math.ceil(sortedWarehouses.length * 0.2));

        const weeklyAnalyses = generateWeeklyAnalyses(4);
        const depotWeeklyAnalyses = generateDepotWeeklyAnalyses(4);

        // --- Constructing the input for the AI report ---
        const input: GenerateLogisticsReportInput = {
            totalTours,
            generalKpis: (analysisData.generalKpis || []).map(({icon, ...kpi}) => kpi),
            qualityKpis: (analysisData.qualityKpis || []).map(({...kpi}) => kpi),
            negativeReviewsFromLateness: negativeReviewsKpi,
            discrepancyKpis: (analysisData.discrepancyKpis || []).map(({changeType, ...kpi}) => kpi).filter(kpi => !kpi.title.toLowerCase().includes('distance')),
            totalCumulativeDelayHours,
            totalAdditionalServiceHours,
            overloadedToursPercentage,
            durationDiscrepancyPercentage,
            planningAnomalyPercentage,
            firstTaskLatePercentage: analysisData.firstTaskLatePercentage,
            top10OverloadedTours: top10Overloaded.map(t => ({
                date: t.date,
                nom: t.nom,
                livreur: t.livreur,
                entrepot: t.entrepot,
                poidsPrevu: t.poidsPrevu,
                poidsReel: t.poidsReel,
                tauxDepassementPoids: t.tauxDepassementPoids
            })),
            top10PositiveDurationDiscrepancies: top10PositiveDuration,
            top10LateStartAnomalies: top10Anomalies,
            topExemplaryDrivers: exemplaryDrivers,
            top20percentWarehousesByOverrun: top20percentWarehouses,
            topWarehouseByDelay: analysisData.delaysByWarehouse?.[0]?.key,
            topCityByDelay: analysisData.delaysByCity?.[0]?.key,
            globalSummary: analysisData.globalSummary,
            performanceByDayOfWeek: analysisData.performanceByDayOfWeek,
            performanceByTimeSlot: analysisData.performanceByTimeSlot,
            delayHistogram: analysisData.delayHistogram,
        };
>>>>>>> 8120bf3 (QuotaExceededError: Failed to execute 'setItem' on 'Storage': Setting th)

        // 5. Generate report with AI
        const generatedReport: GenerateLogisticsReportOutput = await generateLogisticsReport(input);
      
        // 6. Store data for the report page
        const reportData = {
<<<<<<< HEAD
            config: reportConfig,
            analysis: analysisData,
=======
            analysis: {
                ...analysisData,
                // Truncate large arrays to prevent quota errors
                overloadedTours: analysisData.overloadedTours.slice(0, 50),
                durationDiscrepancies: analysisData.durationDiscrepancies.slice(0, 50),
                lateStartAnomalies: analysisData.lateStartAnomalies.slice(0, 50),
                performanceByDriver: analysisData.performanceByDriver.slice(0, 100),
            },
>>>>>>> 8120bf3 (QuotaExceededError: Failed to execute 'setItem' on 'Storage': Setting th)
            ai: generatedReport,
            weeklyAnalyses: weeklyAnalyses,
            filters: reportConfig.filters, // Pass selected filters
             extra: { // Keep some extra data for display that doesn't go to AI
                negativeReviewsKpi: input.analysis.negativeReviewsFromLateness,
                overloadedToursPercentage: input.analysis.overloadedToursPercentage,
                durationDiscrepancyPercentage: input.analysis.durationDiscrepancyPercentage,
                planningAnomalyPercentage: input.analysis.planningAnomalyPercentage,
                firstTaskLatePercentage: analysisData.firstTaskLatePercentage,
                top10Overloaded: analysisData.overloadedTours.slice(0,10),
                top10PositiveDuration: analysisData.durationDiscrepancies.filter(d=>d.ecart > 0).slice(0,10),
                top10Anomalies: analysisData.lateStartAnomalies.slice(0,10),
             }
        };
        sessionStorage.setItem('visualReportData', JSON.stringify(reportData));
      
        // 7. Open report page
        window.open('/report', '_blank');

        toast({
            title: "Rapport d'analyse personnalisé généré !",
            description: "Le rapport visuel a été ouvert dans un nouvel onglet.",
        });

    } catch (error) {
      console.error("AI Report Generation failed:", error);
      toast({
        variant: "destructive",
        title: "Erreur de génération",
        description: error instanceof Error && error.message.includes('quota') 
          ? "Les données à analyser sont trop volumineuses. Essayez de réduire la période."
          : "La génération du rapport a échoué. Veuillez réessayer.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-8 flex justify-center">
        <Button onClick={handleGenerateAndOpenReport} disabled={isLoading} size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Génération du rapport en cours...
            </>
          ) : (
            <>
              <FileText className="mr-2 h-4 w-4" />
              Générer et ouvrir le Rapport Personnalisé
              <ExternalLink className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
    </div>
  );
}
