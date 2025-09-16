
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
  allData: MergedData[];
}

export default function AiReportGenerator({ reportConfig, allData }: AiReportGeneratorProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleGenerateAndOpenReport = async () => {
    setIsLoading(true);
    
    if (!allData || allData.length === 0) {
        toast({
            variant: "destructive",
            title: "Aucune donnée à analyser",
            description: "Veuillez vérifier que les fichiers sont chargés et que les filtres ne sont pas trop restrictifs.",
        });
        setIsLoading(false);
        return;
    }

    try {
        // 1. Filter data based on config
        const filteredData = allData.filter(item => {
            if (!item.tournee) return false;
            if (reportConfig.filters.depots.length > 0 && !reportConfig.filters.depots.some(d => item.tournee.entrepot.startsWith(d))) {
                return false;
            }
            if (reportConfig.filters.warehouses.length > 0 && !reportConfig.filters.warehouses.includes(item.tournee.entrepot)) {
                return false;
            }
            return true;
        });

        if (filteredData.length === 0) {
            toast({
                variant: "destructive",
                title: "Aucune donnée après filtrage",
                description: "Vos filtres ont exclu toutes les données. Veuillez les ajuster.",
            });
            setIsLoading(false);
            return;
        }

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
        
        const totalTours = analysisData.generalKpis?.find(k => k.title.includes('Tournées'))?.value ? parseInt(analysisData.generalKpis.find(k => k.title.includes('Tournées'))!.value) : 0;
        
        const overloadedToursPercentage = totalTours > 0 ? ((analysisData.overloadedTours || []).length / totalTours) * 100 : 0;
        const durationDiscrepancyPercentage = totalTours > 0 ? ((analysisData.durationDiscrepancies || []).filter(d => d.ecart > 900).length / totalTours) * 100 : 0;
        const planningAnomalyPercentage = analysisData.firstTaskLatePercentage;
        
        // 4. Construct AI input based on selections
        const input: GenerateLogisticsReportInput = {
            config: reportConfig,
            analysis: {},
        };

        if (reportConfig.sections.globalKpis) {
            input.analysis.generalKpis = (analysisData.generalKpis || []).map(({icon, ...kpi}) => kpi);
        }
        if (reportConfig.sections.discrepancyAnalysis) {
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
            input.analysis.overloadedToursPercentage = overloadedToursPercentage.toFixed(1) + '%';
            input.analysis.durationDiscrepancyPercentage = durationDiscrepancyPercentage.toFixed(1) + '%';
            input.analysis.planningAnomalyPercentage = planningAnomalyPercentage.toFixed(1) + '%';
            input.analysis.top10OverloadedTours = analysisData.overloadedTours?.slice(0, 10).map(t => ({
                date: t.date,
                nom: t.nom,
                livreur: t.livreur,
                entrepot: t.entrepot,
                poidsPrevu: t.poidsPrevu,
                poidsReel: t.poidsReel,
                tauxDepassementPoids: t.tauxDepassementPoids
            }));
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

        // 5. Generate report with AI
        const generatedReport: GenerateLogisticsReportOutput = await generateLogisticsReport(input);
      
        // 6. Store data for the report page, only keeping what is necessary
        const reportData = {
            config: reportConfig,
            analysis: { // Pass aggregated data, not full datasets
                generalKpis: analysisData.generalKpis,
                discrepancyKpis: analysisData.discrepancyKpis,
                performanceByDayOfWeek: analysisData.performanceByDayOfWeek,
                performanceByTimeSlot: analysisData.performanceByTimeSlot,
                delayHistogram: analysisData.delayHistogram,
                delaysByWarehouse: analysisData.delaysByWarehouse.slice(0, 10), // Limit for safety
                delaysByCity: analysisData.delaysByCity.slice(0, 10), // Limit for safety
            },
            ai: generatedReport,
            weeklyAnalyses: weeklyAnalyses,
            filters: reportConfig.filters,
             extra: { // Pass only top 10 examples and key percentages
                negativeReviewsKpi: input.analysis.negativeReviewsFromLateness,
                overloadedToursPercentage: overloadedToursPercentage,
                durationDiscrepancyPercentage: durationDiscrepancyPercentage,
                planningAnomalyPercentage: planningAnomalyPercentage,
                top10Overloaded: analysisData.overloadedTours.slice(0,10),
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
