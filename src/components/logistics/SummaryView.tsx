'use client';
import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Wand2, Loader2, AlertCircle, FileText, Target, Search, BarChart2, Calendar, Clock, Lightbulb, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateLogisticsReport, GenerateLogisticsReportInput, GenerateLogisticsReportOutput } from '@/ai/flows/generate-logistics-report';
import type { AnalysisData, MergedData, Kpi } from '@/lib/types';
import { KpiCard } from './KpiCard';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ComposedChart, Legend, Line, Area, Cell } from 'recharts';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';


interface SummaryViewProps {
  analysisData: AnalysisData | null;
  allData: MergedData[];
  filters: Record<string, any>;
}

const PRIMARY_COLOR = "hsl(var(--primary))";
const ACCENT_COLOR = "hsl(var(--accent))";
const ADVANCE_COLOR = "hsl(210 100% 56%)";

export default function SummaryView({ analysisData, allData, filters }: SummaryViewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [report, setReport] = useState<GenerateLogisticsReportOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const generateReport = async () => {
    if (!analysisData) return;
    setIsLoading(true);
    setError(null);
    setReport(null);
    
    try {
        const totalTours = analysisData.generalKpis?.find(k => k.title.includes('Tournées'))?.value ? parseInt(analysisData.generalKpis.find(k => k.title.includes('Tournées'))!.value) : 0;
        const lateTasksWithBadReview = allData.filter(d => d.notation && d.notation <= 3 && d.retardStatus === 'late');
        const negativeReviewsKpi = {
            title: "Avis Négatifs sur Retards",
            value: `${lateTasksWithBadReview.length}`,
            description: "Corrélation retards / satisfaction."
        };
        const totalCumulativeDelaySeconds = allData.reduce((acc, d) => d.retardStatus === 'late' ? acc + d.retard : acc, 0);
        const totalCumulativeDelayHours = totalCumulativeDelaySeconds / 3600;
        const totalAdditionalServiceSeconds = (analysisData.durationDiscrepancies || []).reduce((acc, d) => d.ecart > 0 ? acc + d.ecart : acc, 0);
        const totalAdditionalServiceHours = totalAdditionalServiceSeconds / 3600;
        const overloadedToursPercentage = totalTours > 0 ? ((analysisData.overloadedTours || []).length / totalTours) * 100 : 0;
        const positiveDiscrepancyTours = (analysisData.durationDiscrepancies || []).filter(d => d.ecart > 900).length;
        const durationDiscrepancyPercentage = totalTours > 0 ? (positiveDiscrepancyTours / totalTours) * 100 : 0;
        const planningAnomalyPercentage = totalTours > 0 ? ((analysisData.lateStartAnomalies || []).length / totalTours) * 100 : 0;
        const top10Overloaded = (analysisData.overloadedTours || []).sort((a,b) => b.tauxDepassementPoids - a.tauxDepassementPoids).slice(0, 10);
        const top10PositiveDuration = (analysisData.durationDiscrepancies || []).filter(d => d.ecart > 0).sort((a,b) => b.ecart - a.ecart).slice(0, 10);
        const top10Anomalies = (analysisData.lateStartAnomalies || []).sort((a,b) => b.tasksInDelay - a.tasksInDelay).slice(0, 10);
        const exemplaryDrivers = (analysisData.performanceByDriver || []).filter(d => d.overweightToursCount > 0 && d.punctualityRate > 90).sort((a,b) => b.punctualityRate - a.punctualityRate).slice(0, 3);

        const warehouseOverruns = (analysisData.overloadedTours || []).reduce((acc, tour) => {
            if (!acc[tour.entrepot]) { acc[tour.entrepot] = { totalWeightOverrun: 0, totalTimeOverrun: 0 }; }
            acc[tour.entrepot].totalWeightOverrun += (tour.poidsReel - tour.poidsPrevu);
            return acc;
        }, {} as Record<string, { totalWeightOverrun: number, totalTimeOverrun: number }>);
        (analysisData.durationDiscrepancies || []).forEach(tour => {
            if (tour.ecart > 0) {
                if (!warehouseOverruns[tour.entrepot]) { warehouseOverruns[tour.entrepot] = { totalWeightOverrun: 0, totalTimeOverrun: 0 }; }
                warehouseOverruns[tour.entrepot].totalTimeOverrun += tour.ecart / 3600;
            }
        });
        const sortedWarehouses = Object.entries(warehouseOverruns).map(([entrepot, data]) => ({ entrepot, ...data })).sort((a, b) => b.totalWeightOverrun - a.totalWeightOverrun);
        const top20percentWarehouses = sortedWarehouses.slice(0, Math.ceil(sortedWarehouses.length * 0.2));

        const input: GenerateLogisticsReportInput = {
            totalTours,
            generalKpis: (analysisData.generalKpis || []).map(({icon, ...kpi}) => kpi),
            qualityKpis: (analysisData.qualityKpis || []).filter(kpi => 'value' in kpi).map(({icon, ...kpi}) => kpi as Kpi),
            negativeReviewsFromLateness: negativeReviewsKpi,
            discrepancyKpis: (analysisData.discrepancyKpis || []).map(({changeType, ...kpi}) => kpi).filter(kpi => !kpi.title.toLowerCase().includes('distance')),
            totalCumulativeDelayHours,
            totalAdditionalServiceHours,
            overloadedToursPercentage,
            durationDiscrepancyPercentage,
            planningAnomalyPercentage,
            firstTaskLatePercentage: analysisData.firstTaskLatePercentage || 0,
            top10OverloadedTours: top10Overloaded.map(t => ({ date: t.date, nom: t.nom, livreur: t.livreur, entrepot: t.entrepot, poidsPrevu: t.poidsPrevu, poidsReel: t.poidsReel, tauxDepassementPoids: t.tauxDepassementPoids })),
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

        const generatedReport: GenerateLogisticsReportOutput = await generateLogisticsReport(input);
        setReport(generatedReport);

    } catch (error: any) {
      console.error("AI Report Generation failed:", error);
      setError("La génération du résumé a échoué. " + (error.message || "Veuillez réessayer."));
      toast({
        variant: "destructive",
        title: "Erreur de génération",
        description: "La génération du résumé a échoué. Veuillez réessayer.",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    generateReport();
  }, [analysisData]);

  if (isLoading) {
    return (
      <Card className="flex flex-col items-center justify-center min-h-[500px]">
        <CardContent className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <h3 className="text-xl font-semibold">Génération de la synthèse IA...</h3>
            <p className="text-muted-foreground mt-1">L'IA analyse vos données pour en extraire les informations clés.</p>
        </CardContent>
      </Card>
    );
  }

  if (error || !report) {
     return (
        <Card className="flex flex-col items-center justify-center min-h-[500px] border-destructive">
            <CardContent className="text-center">
                <AlertCircle className="h-12 w-12 text-destructive mb-4" />
                <h3 className="text-xl font-semibold text-destructive">Erreur de Synthèse</h3>
                <p className="text-muted-foreground mt-1">{error || "Aucun rapport n'a pu être généré."}</p>
                <Button onClick={generateReport} className="mt-6">
                    <Wand2 className="mr-2"/>
                    Relancer la génération
                </Button>
            </CardContent>
      </Card>
     )
  }

  const dayOrder = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
  const sortedPerformanceByDay = (analysisData?.performanceByDayOfWeek || []).sort((a,b) => dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day));

  return (
    <Card className="bg-gradient-to-br from-primary/5 via-background to-background border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-primary">
          <Wand2 />
          Synthèse Intelligente de la Période
        </CardTitle>
        <CardDescription>
          Un résumé exécutif généré par IA pour une compréhension rapide des performances et des points d'attention.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <Alert className="bg-blue-50 border-blue-200 text-blue-900">
            <Info className="h-4 w-4 !text-blue-900" />
            <AlertTitle className="font-bold">Synthèse Managériale</AlertTitle>
            <AlertDescription className="!text-blue-800">
                <p className="whitespace-pre-line leading-relaxed">{report.globalSynthesis}</p>
            </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
             {analysisData?.generalKpis.filter(k => ['Ponctualité', 'Avis Négatifs', 'Tournées en Retard'].some(t => k.title.includes(t))).map(kpi => <KpiCard key={kpi.title} {...kpi} />)}
             <KpiCard title="% Tournées en Surcharge" value={`${(analysisData?.overloadedTours.length || 0) * 100 / (analysisData?.generalKpis.find(k=>k.title.includes("Tournées"))?.value ? parseInt(analysisData.generalKpis.find(k=>k.title.includes("Tournées"))!.value) : 1)  }%`} icon="Percent" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
                <ReportBlock title="Analyses et Insights Clés" icon={Search}>
                    <Accordion type="single" collapsible className="w-full bg-white rounded-lg p-4 border">
                        <AccordionItem value="punctuality">
                            <AccordionTrigger>Ponctualité</AccordionTrigger>
                            <AccordionContent>{report.kpiComments.punctuality}</AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="discrepancy">
                            <AccordionTrigger>Écarts Planifié / Réalisé</AccordionTrigger>
                            <AccordionContent>{report.kpiComments.discrepancy}</AccordionContent>
                        </AccordionItem>
                         <AccordionItem value="anomalies">
                            <AccordionTrigger>Anomalies Opérationnelles</AccordionTrigger>
                            <AccordionContent>
                                <ul className="list-disc pl-5 space-y-1 text-sm">
                                    <li><span className="font-semibold">Surcharge:</span> {report.anomaliesComments.overloaded}</li>
                                    <li><span className="font-semibold">Durée:</span> {report.anomaliesComments.duration}</li>
                                </ul>
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="geo">
                            <AccordionTrigger>Performance Géographique</AccordionTrigger>
                            <AccordionContent>{report.geoDriverComments.warehouse}</AccordionContent>
                        </AccordionItem>
                         <AccordionItem value="temporal">
                            <AccordionTrigger>Performance Temporelle</AccordionTrigger>
                            <AccordionContent>{report.temporalAnalysisComments.byDay}</AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </ReportBlock>
                
                <ReportBlock title="Recommandations Stratégiques" icon={Lightbulb}>
                    <Card className="bg-amber-50 border-amber-200">
                        <CardContent className="pt-6 space-y-4">
                             <div>
                                <h4 className="font-semibold flex items-center gap-2"><Target className="w-4 h-4"/>Planification</h4>
                                <p className="text-gray-700 text-sm pl-6">{report.recommendations.planning}</p>
                            </div>
                            <div>
                                <h4 className="font-semibold flex items-center gap-2"><Users className="w-4 h-4"/>Opérations</h4>
                                <p className="text-gray-700 text-sm pl-6">{report.recommendations.operations}</p>
                            </div>
                            <div>
                                <h4 className="font-semibold flex items-center gap-2"><Smile className="w-4 h-4"/>Qualité de Service</h4>
                                <p className="text-gray-700 text-sm pl-6">{report.recommendations.quality}</p>
                            </div>
                        </CardContent>
                    </Card>
                </ReportBlock>
            </div>
            <div className="space-y-6">
                <ReportBlock title="Performance par Jour de la Semaine" icon={Calendar}>
                    <ResponsiveContainer width="100%" height={200}>
                         <ComposedChart data={sortedPerformanceByDay} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                           <XAxis dataKey="day" fontSize={10} />
                           <YAxis yAxisId="left" label={{ value: 'Nb. Écarts', angle: -90, position: 'insideLeft', fontSize: 10, offset: 10 }} fontSize={10}/>
                           <Tooltip />
                           <Legend wrapperStyle={{fontSize: "10px"}}/>
                           <Bar yAxisId="left" dataKey="delays" name="Retards" fill={PRIMARY_COLOR} stackId="a" />
                           <Bar yAxisId="left" dataKey="advances" name="Avances" fill={ADVANCE_COLOR} stackId="a" />
                         </ComposedChart>
                    </ResponsiveContainer>
                </ReportBlock>

                 <ReportBlock title="Répartition des Écarts" icon={BarChart2}>
                    <ResponsiveContainer width="100%" height={200}>
                         <BarChart data={analysisData?.delayHistogram} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                           <XAxis dataKey="range" fontSize={10} angle={-30} textAnchor="end" height={50} />
                           <YAxis fontSize={10}/>
                           <Tooltip />
                           <Bar dataKey="count" name="Nb. de Tâches">
                              {(analysisData?.delayHistogram || []).map((entry, index) => (
                                 <Cell key={`cell-${index}`} fill={entry.range.includes('retard') ? ACCENT_COLOR : entry.range.includes('avance') ? ADVANCE_COLOR : '#a0aec0'} />
                              ))}
                           </Bar>
                         </BarChart>
                    </ResponsiveContainer>
                </ReportBlock>
            </div>
        </div>
      </CardContent>
    </Card>
  );
}