'use client';
import { useState, useMemo } from 'react';
import type { MergedData } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useLogistics } from '@/context/LogisticsContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from '@/components/ui/scroll-area';
import { runFeedbackAnalysis } from '@/actions/feedback';
import type { AnalysisResult } from '@/actions/feedback';

const COLORS = { 
  'Retard': '#E4002B', 
  'Avance': '#00C49F', 
  'Autre': '#FFBB28',
  'Attitude livreur': '#FF8042',
  'Produit manquant': '#0088FE',
  'Casse Produit': '#00C49F',
  'Rupture chaine de froid': '#FFBB28'
};

interface AiAnalysisProps {
    allData: MergedData[];
    onAnalysisComplete: (results: any) => void;
}

type DetailedAnalysisResult = {
  id: string;
  comment: string;
  category: string;
};


export default function AiAnalysis({ allData, onAnalysisComplete }: AiAnalysisProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { state, dispatch } = useLogistics();
  const { toast } = useToast();

  const negativeFeedback = useMemo(() => {
    return allData.filter(item => item.notation != null && item.notation <= 3 && item.commentaire);
  }, [allData]);

  const handleAnalyze = async () => {
    if (negativeFeedback.length === 0) return;
    setIsLoading(true);
    dispatch({ type: 'SET_ANALYSIS_RESULTS', results: null });

    try {
      const results = await Promise.all(
        negativeFeedback.map(item => runFeedbackAnalysis(item.commentaire!))
      );

      const detailedResults: DetailedAnalysisResult[] = negativeFeedback.map((item, index) => ({
        id: String(item.ordre),
        comment: item.commentaire!,
        category: (results[index] as AnalysisResult).reason,
      }));

      const breakdown = (results as AnalysisResult[]).reduce((acc, result) => {
        acc[result.reason] = (acc[result.reason] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const aggregatedResults = Object.entries(breakdown).map(([reason, count]) => ({ reason, count }));

      const analysisPayload = {
          aggregated: aggregatedResults,
          detailed: detailedResults,
      };

      dispatch({
        type: 'SET_ANALYSIS_RESULTS',
        results: analysisPayload
      });

      onAnalysisComplete(aggregatedResults);

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

  const handleBarClick = (data: any) => {
    setSelectedCategory(data.reason);
  };

  const selectedComments = useMemo(() => {
    if (!selectedCategory || !state.analysisResults?.detailed) {
      return [];
    }
    return state.analysisResults.detailed.filter(
      (item: DetailedAnalysisResult) => item.category === selectedCategory
    );
  }, [selectedCategory, state.analysisResults?.detailed]);


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

        {state.analysisResults && (
          <div className="pt-4">
            <h4 className="font-semibold mb-2">Résultats de l'analyse :</h4>
            <ResponsiveContainer width="100%" height={150}>
                <BarChart data={state.analysisResults.aggregated} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis dataKey="reason" type="category" width={80} />
                    <Tooltip />
                     <Bar dataKey="count" name="Nombre d'avis" barSize={20} onClick={handleBarClick} style={{ cursor: 'pointer' }}>
                        {state.analysisResults.aggregated.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[entry.reason as keyof typeof COLORS] || '#8884d8'} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {selectedCategory && (
            <Dialog open={!!selectedCategory} onOpenChange={(isOpen) => !isOpen && setSelectedCategory(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Commentaires pour la catégorie : {selectedCategory}</DialogTitle>
                        <DialogDescription>
                            Liste des {selectedComments.length} commentaires classés dans la catégorie "{selectedCategory}".
                        </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="h-[400px] pr-4">
                        <div className="space-y-4">
                            {selectedComments.map((item: DetailedAnalysisResult) => (
                                <div key={item.id} className="border-b pb-2">
                                    <p className="text-sm text-muted-foreground">ID: {item.id}</p>
                                    <p className="font-medium">{item.comment}</p>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        )}
      </CardContent>
    </Card>
  );
}
