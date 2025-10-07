
'use client';
import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { getWeek, startOfWeek, endOfWeek, format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { MergedData, AnalysisData, WeeklyAnalysis, Kpi, ComparisonKpi } from '@/lib/types';
import { analyzeData } from '@/lib/dataAnalyzer';
import { ArrowDown, ArrowUp, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ComparisonViewProps {
  allData?: MergedData[];
  filters?: Record<string, any>;
  weeklyAnalyses?: WeeklyAnalysis[];
  isForReport?: boolean;
}

const PRIMARY_COLOR = "hsl(var(--primary))";
const ACCENT_COLOR = "hsl(var(--accent))";

const kpiConfig: {
    key: keyof AnalysisData;
    title: string;
    type: 'kpi' | 'percent' | 'rating' | 'count' | 'complex_percent' | 'comparison_kpi' | 'rate_from_count';
    kpiTitle?: string; // For simple KPIs
    subKey?: keyof AnalysisData[keyof AnalysisData]; // For nested values
    valueExtractor?: (analysis: AnalysisData) => number | undefined; // For complex extractions
}[] = [
    { key: 'generalKpis', kpiTitle: 'Taux de Ponctualité (Réalisé)', title: 'Taux de Ponctualité', type: 'percent' },
    { key: 'generalKpis', kpiTitle: 'Livraisons en Retard', title: 'Nb. Retards', type: 'count' },
    { key: 'generalKpis', kpiTitle: 'Avis Négatifs', title: 'Nb. Avis Négatifs', type: 'count' },
    { key: 'generalKpis', kpiTitle: 'Livraisons en Retard', title: 'Taux de Retards', type: 'rate_from_count' },
    { key: 'generalKpis', kpiTitle: 'Avis Négatifs', title: 'Taux d\'Avis Négatifs', type: 'rate_from_count' },
    { key: 'globalSummary', subKey: 'weightOverrunPercentage', title: '% Dépassement Poids', type: 'complex_percent' },
    { key: 'firstTaskLatePercentage', title: '% Retard 1ère Tâche', type: 'complex_percent' },
    { 
        key: 'lateStartAnomalies', 
        title: '% Anomalies Planification', 
        type: 'complex_percent',
        valueExtractor: (analysis) => {
            const totalToursKpi = analysis.generalKpis.find(k => k.title.includes('Tournées'));
            const totalTours = totalToursKpi ? parseInt(totalToursKpi.value) : 0;
            return totalTours > 0 ? (analysis.lateStartAnomalies.length / totalTours) * 100 : 0;
        }
    },
    { 
        key: 'qualityKpis', 
        title: 'Taux Insat. Surcharge', 
        type: 'comparison_kpi', 
        kpiTitle: "Taux d'Avis Négatifs (Surcharge vs. Standard)",
        valueExtractor: (analysis) => {
            const kpi = analysis.qualityKpis.find(k => k.title === "Taux d'Avis Négatifs (Surcharge vs. Standard)") as ComparisonKpi | undefined;
            return kpi ? parseFloat(kpi.value1) : undefined;
        }
    },
];


export default function ComparisonView({ allData, filters, weeklyAnalyses: propWeeklyAnalyses, isForReport = false }: ComparisonViewProps) {
  const [numberOfWeeks, setNumberOfWeeks] = useState(isForReport ? 8 : 4);
  const [weeklyAnalyses, setWeeklyAnalyses] = useState<WeeklyAnalysis[]>(propWeeklyAnalyses || []);
  const [isLoading, setIsLoading] = useState(!isForReport);

  const finalKpiConfig = useMemo(() => {
    if (isForReport) {
      const reportKpis = ['Taux de Ponctualité', 'Taux de Retards', 'Taux d\'Avis Négatifs', '% Dépassement Poids'];
      return kpiConfig.filter(k => reportKpis.includes(k.title));
    }
    return kpiConfig.filter(k => k.type !== 'rate_from_count');
  }, [isForReport]);


  useEffect(() => {
    // For reports, data is pre-calculated and passed via props.
    if (propWeeklyAnalyses) {
        setWeeklyAnalyses(propWeeklyAnalyses);
        setIsLoading(false);
        return;
    }

    const processData = async () => {
      setIsLoading(true);
      if (!allData || allData.length === 0) {
          setWeeklyAnalyses([]);
          setIsLoading(false);
          return;
      }
      
      const weeks: Record<string, MergedData[]> = {};
      allData.forEach(item => {
        try {
          const date = parseISO(item.date);
          const weekNumber = getWeek(date, { weekStartsOn: 1 });
          const year = date.getFullYear();
          const weekKey = `${year}-W${String(weekNumber).padStart(2, '0')}`;
          if (!weeks[weekKey]) {
            weeks[weekKey] = [];
          }
          weeks[weekKey].push(item);
        } catch(e) {
            // silent fail for invalid dates
        }
      });

      const sortedWeekKeys = Object.keys(weeks).sort().slice(-numberOfWeeks);

      const analyses: WeeklyAnalysis[] = sortedWeekKeys.map(weekKey => {
        const weekData = weeks[weekKey];
        const weekStart = startOfWeek(parseISO(weekData[0].date), { weekStartsOn: 1 });
        const weekEnd = endOfWeek(parseISO(weekData[0].date), { weekStartsOn: 1 });
        const analysis = analyzeData(weekData, filters || {});
        return {
          weekLabel: weekKey,
          dateRange: { from: weekStart, to: weekEnd },
          analysis,
        };
      });

      setWeeklyAnalyses(analyses);
      setIsLoading(false);
    };

    processData();
  }, [allData, filters, numberOfWeeks, propWeeklyAnalyses]);

  const evolutionData = useMemo(() => {
    if (weeklyAnalyses.length === 0) return [];
    
    return finalKpiConfig.map(config => {
        const values = weeklyAnalyses.map(wa => {
            let rawValue: string | number | undefined;

            if (config.type === 'percent' || config.type === 'rating' || config.type === 'count') {
                const kpi = (wa.analysis[config.key] as Kpi[]).find(k => k.title === config.kpiTitle);
                rawValue = kpi?.value;
            } else if (config.type === 'rate_from_count') {
                const countKpi = (wa.analysis.generalKpis as Kpi[]).find(k => k.title === config.kpiTitle);
                const count = countKpi ? parseFloat(countKpi.value) : 0;
                const totalDeliveriesKpi = wa.analysis.generalKpis.find(k => k.title === 'Livraisons Analysées');
                const totalDeliveries = totalDeliveriesKpi ? parseFloat(totalDeliveriesKpi.value) : 0;
                rawValue = totalDeliveries > 0 ? (count / totalDeliveries) * 100 : 0;
            } else if (config.type === 'complex_percent') {
                 if(config.subKey && config.key === 'globalSummary') {
                    rawValue = wa.analysis.globalSummary[config.subKey as keyof typeof wa.analysis.globalSummary];
                } else if (config.key === 'firstTaskLatePercentage') {
                    rawValue = wa.analysis.firstTaskLatePercentage;
                } else if (config.valueExtractor) {
                    rawValue = config.valueExtractor(wa.analysis);
                }
            } else if (config.type === 'comparison_kpi' && config.valueExtractor) {
                rawValue = config.valueExtractor(wa.analysis);
            }
            
            let value: number;
            if (typeof rawValue === 'string') {
                value = parseFloat(rawValue.replace('%', ''));
            } else {
                value = rawValue as number;
            }

            return { week: wa.weekLabel.replace(/-W/g, ' S'), value: isNaN(value) ? 0 : value };
        });

        return {
            title: config.title,
            data: values,
        };
    });
  }, [weeklyAnalyses, finalKpiConfig]);

  const comparisonTableData = useMemo(() => {
    if (weeklyAnalyses.length < 2) return [];

    const lastWeek = weeklyAnalyses[weeklyAnalyses.length - 1].analysis;
    const previousWeek = weeklyAnalyses[weeklyAnalyses.length - 2].analysis;

    const findValue = (analysis: AnalysisData, config: (typeof kpiConfig)[0]): string => {
        let rawValue: string | number | undefined;

        if (config.type === 'percent' || config.type === 'rating' || config.type === 'count') {
            const kpi = (analysis[config.key] as Kpi[]).find(k => k.title === config.kpiTitle);
            rawValue = kpi?.value;
        } else if (config.type === 'complex_percent') {
            if(config.subKey && config.key === 'globalSummary') {
                rawValue = analysis.globalSummary[config.subKey as keyof typeof analysis.globalSummary];
            } else if (config.key === 'firstTaskLatePercentage') {
                rawValue = analysis.firstTaskLatePercentage;
            } else if (config.valueExtractor) {
                rawValue = config.valueExtractor(analysis);
            }
        } else if (config.type === 'comparison_kpi' && config.valueExtractor) {
            rawValue = config.valueExtractor(analysis);
        }
        
        if (typeof rawValue === 'number') {
             if (config.title.includes('%') || config.title.toLowerCase().includes('taux')) {
                return `${rawValue.toFixed(1)}%`;
             }
             return String(rawValue);
        }
        return rawValue || '0';
    };

    return finalKpiConfig.map(config => {
        const lastValueStr = findValue(lastWeek, config);
        const prevValueStr = findValue(previousWeek, config);

        const lastValue = parseFloat(lastValueStr.replace('%', ''));
        const prevValue = parseFloat(prevValueStr.replace('%', ''));
        
        let change: number | null = null;
        if (!isNaN(lastValue) && !isNaN(prevValue) && prevValue !== 0) {
            change = ((lastValue - prevValue) / Math.abs(prevValue)) * 100;
        }

        const isGoodChange = (config.title.includes('Ponctualité'))
            ? change !== null && change > 0 
            : change !== null && change < 0;

        return {
            kpi: config.title,
            lastWeek: lastValueStr,
            previousWeek: prevValueStr,
            change,
            isGoodChange,
        };
    });
  }, [weeklyAnalyses, finalKpiConfig]);


  if (isLoading) {
    return (
        <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="w-12 h-12 animate-spin text-primary"/>
            <p className="ml-4 text-lg text-muted-foreground">Calcul des tendances hebdomadaires...</p>
        </div>
    )
  }
  
  if (isForReport) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            {evolutionData.map(chart => (
                <Card key={chart.title} className="print:shadow-none">
                    <CardHeader>
                        <CardTitle className="text-base">{chart.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={chart.data}>
                                <XAxis dataKey="week" fontSize={10} />
                                <YAxis fontSize={10} domain={['auto', 'auto']} tickFormatter={(value) => `${value.toFixed(0)}%`}/>
                                <Tooltip formatter={(value: number) => `${value.toFixed(2)}%`} />
                                <Line type="monotone" dataKey="value" name={chart.title} stroke={PRIMARY_COLOR} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }}/>
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
  }


  return (
    <div className="space-y-6">
      <Card>
          <CardHeader className="flex flex-row items-center justify-between">
              <div>
                  <CardTitle>Analyse Comparative Hebdomadaire</CardTitle>
                  <CardDescription>Évolution des indicateurs clés sur les dernières semaines.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Comparer les</span>
                  <Select value={String(numberOfWeeks)} onValueChange={(val) => setNumberOfWeeks(Number(val))}>
                      <SelectTrigger className="w-[80px]">
                          <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                          <SelectItem value="2">2</SelectItem>
                          <SelectItem value="4">4</SelectItem>
                          <SelectItem value="8">8</SelectItem>
                          <SelectItem value="12">12</SelectItem>
                      </SelectContent>
                  </Select>
                  <span className="text-sm font-medium">dernières semaines</span>
              </div>
          </CardHeader>
      </Card>
      
       <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="grid grid-cols-1 gap-6 lg:col-span-2 md:grid-cols-2">
            {evolutionData.map(chart => (
                <Card key={chart.title}>
                    <CardHeader>
                        <CardTitle className="text-base">{chart.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={chart.data}>
                                <XAxis dataKey="week" fontSize={10} />
                                <YAxis fontSize={10} domain={['auto', 'auto']} />
                                <Tooltip />
                                <Line type="monotone" dataKey="value" name={chart.title} stroke={PRIMARY_COLOR} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }}/>
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            ))}
        </div>
        <Card className="lg:col-span-1">
            <CardHeader>
                <CardTitle>Synthèse Semaine vs S-1</CardTitle>
                <CardDescription>
                    {weeklyAnalyses.length >= 2 
                        ? `Comparaison de ${weeklyAnalyses[weeklyAnalyses.length - 1].weekLabel} et ${weeklyAnalyses[weeklyAnalyses.length - 2].weekLabel}`
                        : "Données insuffisantes pour comparer."}
                </CardDescription>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Indicateur</TableHead>
                            <TableHead>Cette Sem.</TableHead>
                            <TableHead>Sem. Préc.</TableHead>
                            <TableHead>Évolution</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {comparisonTableData?.map(item => (
                            <TableRow key={item.kpi}>
                                <TableCell className="font-medium text-xs">{item.kpi}</TableCell>
                                <TableCell className="font-semibold text-xs">{item.lastWeek}</TableCell>
                                <TableCell className="text-xs">{item.previousWeek}</TableCell>
                                <TableCell>
                                    {item.change !== null ? (
                                        <span className={cn("flex items-center gap-1 text-xs", item.isGoodChange ? "text-green-600" : "text-red-600")}>
                                            {item.change > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                                            {Math.abs(item.change).toFixed(1)}%
                                        </span>
                                    ) : 'N/A'}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
       </div>
    </div>
  );
}

    