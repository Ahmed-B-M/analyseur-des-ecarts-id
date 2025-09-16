
'use client';
import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { DepotWeeklyAnalysis, PerformanceByGroup, MergedData, WeeklyAnalysis } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Badge } from '../ui/badge';
import { ArrowDown, ArrowUp, Loader2 } from 'lucide-react';
import { getWeek, startOfWeek, endOfWeek, parseISO } from 'date-fns';
import { analyzeData } from '@/lib/dataAnalyzer';

interface DepotComparisonProps {
    allData?: MergedData[];
    filters?: Record<string, any>;
    depots: string[];
    depotWeeklyAnalyses?: DepotWeeklyAnalysis[];
    isForReport?: boolean;
}


type KpiKey = 'punctualityRateRealized' | 'avgDurationDiscrepancy' | 'avgWeightDiscrepancy' | 'lateWithBadReviewPercentage';

const kpiLabels: Record<KpiKey, string> = {
  punctualityRateRealized: 'Ponctualité (%)',
  avgDurationDiscrepancy: 'Écart Durée (min)',
  avgWeightDiscrepancy: 'Écart Poids (kg)',
  lateWithBadReviewPercentage: '% Insat. / Retard',
};

const formatters: Record<KpiKey, (value: number) => string> = {
    punctualityRateRealized: value => `${value.toFixed(1)}%`,
    avgDurationDiscrepancy: value => `${(value / 60).toFixed(1)}`,
    avgWeightDiscrepancy: value => `${value.toFixed(1)} kg`,
    lateWithBadReviewPercentage: value => `${value.toFixed(1)}%`,
};

const PRIMARY_COLOR = "hsl(var(--primary))";

export default function DepotComparison({ allData, filters, depots, depotWeeklyAnalyses: propDepotWeeklyAnalyses, isForReport = false }: DepotComparisonProps) {
  const [selectedKpi, setSelectedKpi] = useState<KpiKey>('punctualityRateRealized');
  const [numberOfWeeks, setNumberOfWeeks] = useState(4);
  const [depotWeeklyAnalyses, setDepotWeeklyAnalyses] = useState<DepotWeeklyAnalysis[]>(propDepotWeeklyAnalyses || []);
  const [isLoading, setIsLoading] = useState(!isForReport);

  useEffect(() => {
    if (isForReport) return;

    const processData = () => {
        setIsLoading(true);
        if (!allData || !depots) {
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
                if (!weeks[weekKey]) weeks[weekKey] = [];
                weeks[weekKey].push(item);
            } catch (e) {}
        });

        const sortedWeekKeys = Object.keys(weeks).sort().slice(-numberOfWeeks);
        const weeklyAnalyses: WeeklyAnalysis[] = sortedWeekKeys.map(weekKey => {
            const weekData = weeks[weekKey];
            return {
                weekLabel: weekKey,
                dateRange: { from: startOfWeek(parseISO(weekData[0].date), { weekStartsOn: 1 }), to: endOfWeek(parseISO(weekData[0].date), { weekStartsOn: 1 }) },
                analysis: analyzeData(weekData, filters || {}),
            };
        });

        const newDepotAnalyses: DepotWeeklyAnalysis[] = depots.map(depot => {
            const weeklyData = weeklyAnalyses.map(wa => ({
                weekLabel: wa.weekLabel,
                analysis: wa.analysis.performanceByDepot.find(d => d.key === depot) || null
            }));
            return { depot, weeklyData };
        });

        setDepotWeeklyAnalyses(newDepotAnalyses);
        setIsLoading(false);
    }
    processData();
  }, [allData, filters, depots, numberOfWeeks, isForReport])

  const chartData = useMemo(() => {
    if (!depotWeeklyAnalyses.length) return { data: [], depots: [] };

    const weeks = depotWeeklyAnalyses[0]?.weeklyData.map(d => d.weekLabel.replace(/-W/g, ' S')) || [];
    const dataByWeek: any[] = weeks.map(weekLabel => ({ week: weekLabel }));

    const depotKeys: string[] = [];

    depotWeeklyAnalyses.forEach(depotAnalysis => {
      depotKeys.push(depotAnalysis.depot);
      depotAnalysis.weeklyData.forEach((weekData, index) => {
        const value = weekData.analysis ? weekData.analysis[selectedKpi] : 0;
        if (selectedKpi === 'avgDurationDiscrepancy') {
            (dataByWeek[index] as any)[depotAnalysis.depot] = value / 60; // Convert to minutes for chart
        } else {
            (dataByWeek[index] as any)[depotAnalysis.depot] = value;
        }
      });
    });

    return { data: dataByWeek, depots: depotKeys };
  }, [depotWeeklyAnalyses, selectedKpi]);
  
  const tableData = useMemo(() => {
    if (!depotWeeklyAnalyses.length || depotWeeklyAnalyses[0].weeklyData.length < 2) return [];

    return depotWeeklyAnalyses.map(depotAnalysis => {
        const lastWeekData = depotAnalysis.weeklyData[depotAnalysis.weeklyData.length - 1].analysis;
        const prevWeekData = depotAnalysis.weeklyData[depotAnalysis.weeklyData.length - 2].analysis;

        const lastValue = lastWeekData ? lastWeekData[selectedKpi] : 0;
        const prevValue = prevWeekData ? prevWeekData[selectedKpi] : 0;

        let change: number | null = null;
        if(prevValue !== 0) {
            change = ((lastValue - prevValue) / Math.abs(prevValue)) * 100;
        }

        const isGoodChange = selectedKpi === 'punctualityRateRealized' ? (change || 0) > 0 : (change || 0) < 0;

        return {
            depot: depotAnalysis.depot,
            lastValue: lastValue,
            prevValue: prevValue,
            change,
            isGoodChange
        };
    })

  }, [depotWeeklyAnalyses, selectedKpi]);

  const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  if (isLoading) {
    return (
        <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="w-12 h-12 animate-spin text-primary"/>
            <p className="ml-4 text-lg text-muted-foreground">Calcul des tendances par dépôt...</p>
        </div>
    )
  }

  return (
    <div className="space-y-6">
      {!isForReport && (
         <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Analyse Comparative par Dépôt</CardTitle>
                    <CardDescription>Évolution des performances pour chaque dépôt sur les dernières semaines.</CardDescription>
                </div>
                 <div className="flex items-center gap-4">
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
                        <span className="text-sm font-medium">semaines</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Indicateur</span>
                        <Select value={selectedKpi} onValueChange={(val: KpiKey) => setSelectedKpi(val)}>
                            <SelectTrigger className="w-[200px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(kpiLabels).map(([key, label]) => (
                                    <SelectItem key={key} value={key}>{label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                 </div>
            </CardHeader>
        </Card>
      )}
     
      <div className={cn("grid grid-cols-1 gap-6", !isForReport && "lg:grid-cols-3")}>
        <Card className={cn(isForReport ? "md:col-span-2" : "lg:col-span-2", isForReport && "print:shadow-none")}>
            <CardHeader>
                <CardTitle className={cn(isForReport ? "text-base" : "")}>Évolution de : {kpiLabels[selectedKpi]}</CardTitle>
            </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={isForReport ? 300: 400}>
              <LineChart data={chartData.data}>
                <XAxis dataKey="week" fontSize={10} />
                <YAxis fontSize={10} />
                <Tooltip formatter={(value: number) => formatters[selectedKpi](value)} />
                <Legend />
                {chartData.depots.map((depot, index) => (
                    <Line key={depot} type="monotone" dataKey={depot} stroke={colors[index % colors.length]} name={depot} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className={cn(isForReport ? "md:col-span-1" : "lg:col-span-1", isForReport && "print:shadow-none")}>
           <CardHeader>
                <CardTitle  className={cn(isForReport ? "text-base" : "")}>Synthèse Sem. vs S-1</CardTitle>
                <CardDescription>
                    {depotWeeklyAnalyses.length > 0 && depotWeeklyAnalyses[0].weeklyData.length >=2 ? 
                    `Comparaison de ${depotWeeklyAnalyses[0].weeklyData.slice(-1)[0].weekLabel} et ${depotWeeklyAnalyses[0].weeklyData.slice(-2)[0].weekLabel}`
                    : "Données insuffisantes."}
                </CardDescription>
            </CardHeader>
            <CardContent>
                 <div className="max-h-[400px] overflow-y-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Dépôt</TableHead>
                                <TableHead>Cette Sem.</TableHead>
                                <TableHead>Évolution</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {tableData.map(item => (
                                <TableRow key={item.depot}>
                                    <TableCell className="font-medium text-xs">{item.depot}</TableCell>
                                    <TableCell className="font-semibold text-xs">{formatters[selectedKpi](item.lastValue)}</TableCell>
                                    <TableCell>
                                        {item.change !== null ? (
                                            <Badge variant={item.isGoodChange ? "default" : "destructive"} className="flex items-center gap-1 text-xs">
                                                {item.isGoodChange ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                                                {Math.abs(item.change).toFixed(1)}%
                                            </Badge>
                                        ) : <span className="text-xs">-</span>}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                 </div>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
