'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Wand2, Loader2, FileText, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateLogisticsReport, GenerateLogisticsReportInput, GenerateLogisticsReportOutput } from '@/ai/flows/generate-logistics-report';
import type { AnalysisData } from '@/lib/types';
import { useRouter } from 'next/navigation';


interface AiReportGeneratorProps {
  analysisData: AnalysisData;
  filters: Record<string, any>;
  aiFeedbackAnalysis: { reason: string; count: number }[] | null;
}

export default function AiReportGenerator({ analysisData, filters, aiFeedbackAnalysis }: AiReportGeneratorProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const handleGenerateAndOpenReport = async () => {
    setIsLoading(true);
    
    try {
      const punctualityKpi = analysisData.generalKpis.find(k => k.title.includes('Ponctualité'));
      const avgRatingKpi = analysisData.generalKpis.find(k => k.title.includes('Notation Moyenne'));
      const lateTasksKpi = analysisData.generalKpis.find(k => k.title.includes('en Retard'));
      const earlyTasksKpi = analysisData.generalKpis.find(k => k.title.includes('en Avance'));

      const mainReasonForNegativeFeedback = aiFeedbackAnalysis && aiFeedbackAnalysis.length > 0 
        ? [...aiFeedbackAnalysis].sort((a,b) => b.count - a.count)[0].reason
        : undefined;

      const input: GenerateLogisticsReportInput = {
        totalTours: analysisData.generalKpis.find(k => k.title.includes('Tournées'))?.value ? parseInt(analysisData.generalKpis.find(k => k.title.includes('Tournées'))!.value) : 0,
        totalTasks: analysisData.generalKpis.find(k => k.title.includes('Livraisons'))?.value ? parseInt(analysisData.generalKpis.find(k => k.title.includes('Livraisons'))!.value) : 0,
        punctualityRate: punctualityKpi ? parseFloat(punctualityKpi.value) : 0,
        avgRating: avgRatingKpi ? parseFloat(avgRatingKpi.value) : 0,
        totalLateTasks: lateTasksKpi ? parseInt(lateTasksKpi.value) : 0,
        totalEarlyTasks: earlyTasksKpi ? parseInt(earlyTasksKpi.value) : 0,
        overloadedToursCount: analysisData.overloadedTours.length,
        lateStartAnomaliesCount: analysisData.lateStartAnomalies.length,
        topLateDriver: analysisData.performanceByDriver.sort((a,b) => b.avgDelay - a.avgDelay)[0]?.key,
        topLateCity: analysisData.delaysByCity[0]?.key,
        mainReasonForNegativeFeedback: mainReasonForNegativeFeedback
      };

      const generatedReport: GenerateLogisticsReportOutput = await generateLogisticsReport(input);
      
      // Store data in session storage to pass it to the new page
      const reportData = {
          analysis: analysisData,
          ai: generatedReport,
          filters: filters
      };
      sessionStorage.setItem('visualReportData', JSON.stringify(reportData));
      
      // Open the report in a new tab
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
