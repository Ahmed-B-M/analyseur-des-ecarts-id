
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

        // 5. Generate report with AI
        const generatedReport: GenerateLogisticsReportOutput = await generateLogisticsReport(input);
      
        // 6. Store data for the report page
        const reportData = {
            config: reportConfig,
            analysis: analysisData,
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
        description: "La génération du rapport a échoué. Veuillez réessayer.",
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
