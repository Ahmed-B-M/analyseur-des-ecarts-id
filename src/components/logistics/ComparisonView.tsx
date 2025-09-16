
'use client';
import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { getWeek, startOfWeek, endOfWeek, format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { MergedData, AnalysisData, WeeklyAnalysis, Kpi } from '@/lib/types';
import { analyzeData } from '@/lib/dataAnalyzer';
import { ArrowDown, ArrowUp, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ComparisonViewProps {
  allData: MergedData[];
  filters: Record<string, any>;
}

const PRIMARY_COLOR = "hsl(var(--primary))";
const ACCENT_COLOR = "hsl(var(--accent))";

const kpiConfig: { key: keyof AnalysisData; title: string; type: 'kpi' | 'sub' | 'percent' | 'rating' | 'count'; kpiTitle?: string }[] = [
    { key: 'generalKpis', kpiTitle: 'Taux de Ponctualité (Réalisé)', title: 'Taux de Ponctualité', type: 'percent' },
    { key: 'generalKpis', kpiTitle: 'Livraisons en Retard', title: 'Nb. Retards', type: 'count' },
    { key: 'generalKpis', kpiTitle: 'Livraisons en Avance', title: 'Nb. Avances', type: 'count' },
    { key: 'generalKpis', kpiTitle: 'Notation Moyenne Client', title: 'Notation Moyenne', type: 'rating' },
    { key: 'generalKpis', kpiTitle: 'Avis Négatifs', title: 'Nb. Avis Négatifs', type: 'count' },
    { key: 'globalSummary', key2: 'weightOverrunPercentage', title: '% Dépassement Poids', type: 'percent' },
    { key: 'globalSummary', key2: 'durationOverrunPercentage', title: '% Dépassement Durée', type: 'percent' },
];


export default function ComparisonView({ allData, filters }: ComparisonViewProps) {
  const [numberOfWeeks, setNumberOfWeeks] = useState(4);
  const [weeklyAnalyses, setWeeklyAnalyses] = useState<WeeklyAnalysis[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const processData = async () => {
      setIsLoading(true);
      if (allData.length === 0) {
          setWeeklyAnalyses([]);
          setIsLoading(false);
          return;
      }
      
      const weeks: Record<string, MergedData[]> = {};
      allData.forEach(item => {
        const date = parseISO(item.date);
        const weekNumber = getWeek(date, { weekStartsOn: 1 });
        const year = date.getFullYear();
        const weekKey = `${year}-W${String(weekNumber).padStart(2, '0')}`;
        if (!weeks[weekKey]) {
          weeks[weekKey] = [];
        }
        weeks[weekKey].push(item);
      });

      const sortedWeekKeys = Object.keys(weeks).sort().slice(-numberOfWeeks);

      const analyses: WeeklyAnalysis[] = sortedWeekKeys.map(weekKey => {
        const weekData = weeks[weekKey];
        const weekStart = startOfWeek(parseISO(weekData[0].date), { weekStartsOn: 1 });
        const weekEnd = endOfWeek(parseISO(weekData[0].date), { weekStartsOn: 1 });
        const analysis = analyzeData(weekData, filters);
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
  }, [allData, filters, numberOfWeeks]);

  const evolutionData = useMemo(() => {
    if (weeklyAnalyses.length === 0) return [];
    
    return kpiConfig.map(config => {
        const values = weeklyAnalyses.map(wa => {
            let rawValue: string | number | undefined;

            if (config.type === 'kpi' || config.type === 'percent' || config.type === 'rating' || config.type === 'count') {
                const kpi = (wa.analysis.generalKpis as Kpi[]).find(k => k.title === config.kpiTitle);
                rawValue = kpi?.value;
            } else if (config.key2) {
                 rawValue = wa.analysis.globalSummary[config.key2 as keyof typeof wa.analysis.globalSummary];
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
  }, [weeklyAnalyses]);

  const comparisonTableData = useMemo(() => {
    if (weeklyAnalyses.length < 2) return [];

    const lastWeek = weeklyAnalyses[weeklyAnalyses.length - 1].analysis;
    const previousWeek = weeklyAnalyses[weeklyAnalyses.length - 2].analysis;

    return kpiConfig.map(config => {
        const findValue = (analysis: AnalysisData) => {
            if (config.type === 'kpi' || config.type === 'percent' || config.type === 'rating' || config.type === 'count') {
                const kpi = (analysis.generalKpis as Kpi[]).find(k => k.title === config.kpiTitle);
                return kpi?.value;
            } else if (config.key2) {
                const val = analysis.globalSummary[config.key2 as keyof typeof analysis.globalSummary];
                return `${val.toFixed(1)}%`;
            }
        };

        const lastValueStr = findValue(lastWeek) || '0';
        const prevValueStr = findValue(previousWeek) || '0';

        const lastValue = parseFloat(lastValueStr.replace('%', ''));
        const prevValue = parseFloat(prevValueStr.replace('%', ''));
        
        let change: number | null = null;
        if (!isNaN(lastValue) && !isNaN(prevValue) && prevValue !== 0) {
            change = ((lastValue - prevValue) / prevValue) * 100;
        }

        const isGoodChange = (config.title.includes('Ponctualité') || config.title.includes('Notation'))
            ? change > 0 
            : change < 0;

        return {
            kpi: config.title,
            lastWeek: lastValueStr,
            previousWeek: prevValueStr,
            change,
            isGoodChange,
        };
    });
  }, [weeklyAnalyses]);


  if (isLoading) {
    return (
        <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="w-12 h-12 animate-spin text-primary"/>
            <p className="ml-4 text-lg text-muted-foreground">Calcul des tendances hebdomadaires...</p>
        </div>
    )
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
      
       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
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
                                <TableCell className="font-medium">{item.kpi}</TableCell>
                                <TableCell className="font-semibold">{item.lastWeek}</TableCell>
                                <TableCell>{item.previousWeek}</TableCell>
                                <TableCell>
                                    {item.change !== null ? (
                                        <span className={cn("flex items-center gap-1", item.isGoodChange ? "text-green-600" : "text-red-600")}>
                                            {item.isGoodChange ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                                            {item.change.toFixed(1)}%
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