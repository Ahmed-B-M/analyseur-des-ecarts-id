'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Wand2, Loader2, FileText, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateLogisticsReport, GenerateLogisticsReportInput, GenerateLogisticsReportOutput } from '@/ai/flows/generate-logistics-report';
import type { AnalysisData, MergedData } from '@/lib/types';
import { useRouter } from 'next/navigation';

interface AiReportGeneratorProps {
  analysisData: AnalysisData;
  allData: MergedData[];
  filters: Record<string, any>;
  aiFeedbackAnalysis: { reason: string; count: number }[] | null;
}

export default function AiReportGenerator({ analysisData, allData, filters, aiFeedbackAnalysis }: AiReportGeneratorProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const handleGenerateAndOpenReport = async () => {
    setIsLoading(true);
    
    try {
        const totalTours = analysisData.generalKpis?.find(k => k.title.includes('Tournées'))?.value ? parseInt(analysisData.generalKpis.find(k => k.title.includes('Tournées'))!.value) : 0;

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
            .slice(0, 10)
            .map(t => ({ date: t.date, nom: t.nom, livreur: t.livreur, poidsPrevu: t.poidsPrevu, poidsReel: t.poidsReel, tauxDepassementPoids: t.tauxDepassementPoids }));

        const top10PositiveDuration = (analysisData.durationDiscrepancies || [])
            .filter(d => d.ecart > 0)
            .sort((a,b) => b.ecart - a.ecart)
            .slice(0, 10)
            .map(t => ({ date: t.date, nom: t.nom, livreur: t.livreur, ecart: t.ecart, dureeEstimee: t.dureeEstimee, dureeReelle: t.dureeReelle }));

        const top10Anomalies = (analysisData.lateStartAnomalies || [])
            .sort((a,b) => b.tasksInDelay - a.tasksInDelay)
            .slice(0, 10)
            .map(t => ({ date: t.date, nom: t.nom, livreur: t.livreur, tasksInDelay: t.tasksInDelay, heureDepartPrevue: t.heureDepartPrevue, heureDepartReelle: t.heureDepartReelle }));

        // --- Exemplary Driver Analysis ---
        const exemplaryDrivers = (analysisData.performanceByDriver || [])
            .filter(d => d.overweightToursCount > 0 && d.punctualityRate > 90)
            .sort((a,b) => b.punctualityRate - a.punctualityRate)
            .slice(0, 3)
            .map(d => ({ key: d.key, punctualityRate: d.punctualityRate, overweightToursCount: d.overweightToursCount, avgDelay: d.avgDelay }));


        // --- Constructing the input for the AI report ---
        const input: GenerateLogisticsReportInput = {
            totalTours: totalTours,
            generalKpis: (analysisData.generalKpis || []).map(({icon, ...kpi}) => kpi),
            qualityKpis: (analysisData.qualityKpis || []).map(({icon, ...kpi}) => kpi),
            negativeReviewsFromLateness: negativeReviewsKpi,
            discrepancyKpis: (analysisData.discrepancyKpis || []).filter(kpi => !kpi.title.toLowerCase().includes('distance')),
            totalCumulativeDelayHours: totalCumulativeDelayHours,
            totalAdditionalServiceHours: totalAdditionalServiceHours,
            overloadedToursPercentage: overloadedToursPercentage,
            durationDiscrepancyPercentage: durationDiscrepancyPercentage,
            planningAnomalyPercentage: planningAnomalyPercentage,
            top10OverloadedTours: top10Overloaded,
            top10PositiveDurationDiscrepancies: top10PositiveDuration,
            top10LateStartAnomalies: top10Anomalies,
            topExemplaryDrivers: exemplaryDrivers,
            topWarehouseByDelay: analysisData.delaysByWarehouse?.[0]?.key,
            topCityByDelay: analysisData.delaysByCity?.[0]?.key,
        };

        const generatedReport: GenerateLogisticsReportOutput = await generateLogisticsReport(input);
      
        // Store the FULL data in session storage
        const reportData = {
            analysis: analysisData,
            ai: generatedReport,
            filters: filters,
            extra: {
                negativeReviewsKpi,
                overloadedToursPercentage,
                durationDiscrepancyPercentage,
                planningAnomalyPercentage,
                top10PositiveDuration,
                top10Anomalies,
                top10Overloaded,
                exemplaryDrivers,
                totalCumulativeDelayHours,
                totalAdditionalServiceHours
            }
        };
        sessionStorage.setItem('visualReportData', JSON.stringify(reportData));
      
        window.open('/report', '_blank');

        toast({
            title: "Rapport d'analyse généré !",
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
    <Card className="bg-gradient-to-br from-primary/5 via-background to-background border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-primary">
          <Wand2 />
          Générateur de Rapport d'Analyse IA
        </CardTitle>
        <CardDescription>
          Générez une synthèse visuelle et intelligente de la période sélectionnée, prête à être exportée et présentée.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={handleGenerateAndOpenReport} disabled={isLoading} size="lg">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Génération en cours...
            </>
          ) : (
            <>
              <FileText className="mr-2 h-4 w-4" />
              Générer et ouvrir le Rapport Visuel
              <ExternalLink className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
