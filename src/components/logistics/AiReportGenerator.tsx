'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Wand2, Loader2, Clipboard, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateLogisticsReport } from '@/ai/flows/generate-logistics-report';
import type { AnalysisData } from '@/lib/types';
import ReactMarkdown from 'react-markdown';
import { Textarea } from '../ui/textarea';

interface AiReportGeneratorProps {
  analysisData: AnalysisData;
}

export default function AiReportGenerator({ analysisData }: AiReportGeneratorProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const { toast } = useToast();

  const handleGenerateReport = async () => {
    setIsLoading(true);
    setReport(null);

    try {
      // Prepare the simplified input for the AI flow
      const punctualityKpi = analysisData.generalKpis.find(k => k.title.includes('Ponctualité'));
      const avgRatingKpi = analysisData.generalKpis.find(k => k.title.includes('Notation Moyenne'));
      const lateTasksKpi = analysisData.generalKpis.find(k => k.title.includes('en Retard'));
      const earlyTasksKpi = analysisData.generalKpis.find(k => k.title.includes('en Avance'));

      const input = {
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
        // This would require running the other AI analysis first. For now, we omit it or pass a placeholder.
        // mainReasonForNegativeFeedback: "Non analysé",
      };

      const generatedReport = await generateLogisticsReport(input);
      setReport(generatedReport);
      toast({
        title: "Rapport d'analyse généré !",
        description: "Le rapport a été créé avec succès.",
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
  
  const handleCopy = () => {
    if (report) {
        navigator.clipboard.writeText(report);
        toast({ title: "Rapport copié dans le presse-papiers." });
    }
  }

  return (
    <Card className="bg-gradient-to-br from-primary/5 via-background to-background border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-primary">
          <Wand2 />
          Générateur de Rapport d'Analyse IA
        </CardTitle>
        <CardDescription>
          Cliquez sur le bouton pour générer une synthèse intelligente de la période sélectionnée, qui met en évidence les écarts, les dégradations et les causes principales.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
            <Button onClick={handleGenerateReport} disabled={isLoading} size="lg">
            {isLoading ? (
                <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Génération en cours...
                </>
            ) : (
                <>
                <Wand2 className="mr-2 h-4 w-4" />
                Générer un Rapport d'Analyse
                </>
            )}
            </Button>
            {report && !isLoading && (
                 <Button onClick={() => setReport(null)} variant="outline" size="lg">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Recommencer
                </Button>
            )}
        </div>

        {report && (
          <div className="p-4 border rounded-lg bg-background/50 space-y-3">
             <div className="prose prose-sm max-w-none text-foreground dark:prose-invert prose-headings:text-primary prose-h1:text-2xl prose-h2:text-xl">
                <ReactMarkdown>{report}</ReactMarkdown>
             </div>
             <Button onClick={handleCopy} variant="ghost" size="sm" className="w-full justify-center">
                <Clipboard className="mr-2 h-4 w-4"/>
                Copier le rapport
             </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
