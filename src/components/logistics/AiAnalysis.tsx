'use client';
import { useState, useMemo } from 'react';
import type { MergedData } from '@/lib/types';
import { analyzeCustomerFeedback } from '@/ai/flows/analyze-customer-feedback-for-delivery-issues';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const COLORS = { 'Retard': '#E4002B', 'Avance': '#00C49F', 'Autre': '#FFBB28' };

interface AiAnalysisProps {
    allData: MergedData[];
    onAnalysisComplete: (result: { reason: string; count: number }[] | null) => void;
}

export default function AiAnalysis({ allData, onAnalysisComplete }: AiAnalysisProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{ reason: string; count: number }[] | null>(null);
  const { toast } = useToast();

  const negativeFeedback = useMemo(() => {
    return allData.filter(item => item.notation != null && item.notation <= 3 && item.commentaire);
  }, [allData]);

  const handleAnalyze = async () => {
    if (negativeFeedback.length === 0) return;
    setIsLoading(true);
    setAnalysisResult(null);
    onAnalysisComplete(null);

    try {
      const results = await Promise.all(
        negativeFeedback.map(item => analyzeCustomerFeedback({ commentaire: item.commentaire! }))
      );

      const breakdown = results.reduce((acc, result) => {
        acc[result.reason] = (acc[result.reason] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const resultData = Object.entries(breakdown).map(([reason, count]) => ({ reason, count }));
      setAnalysisResult(resultData);
      onAnalysisComplete(resultData);

      toast({
        title: "Analyse IA terminée",
        description: `${results.length} commentaires analysés avec succès.`,
      });
    } catch (error) {
      console.error("AI Analysis failed:", error);
      toast({
        variant: "destructive",
        title: "Erreur d'analyse IA",
        description: "L'analyse des commentaires a échoué. Veuillez réessayer.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <Sparkles className="text-primary"/>
            Analyse IA des Retours Clients
        </CardTitle>
        <CardDescription>
          Analysez sémantiquement les {negativeFeedback.length} avis négatifs (note ≤ 3) pour en identifier la cause.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={handleAnalyze} disabled={isLoading || negativeFeedback.length === 0}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analyse en cours...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Lancer l'analyse avec l'IA
            </>
          )}
        </Button>

        {analysisResult && (
          <div className="pt-4">
            <h4 className="font-semibold mb-2">Résultats de l'analyse :</h4>
            <ResponsiveContainer width="100%" height={150}>
                <BarChart data={analysisResult} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis dataKey="reason" type="category" width={80} />
                    <Tooltip />
                     <Bar dataKey="count" name="Nombre d'avis" barSize={20}>
                        {analysisResult.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[entry.reason as keyof typeof COLORS] || '#8884d8'} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
