'use client';
import { KpiCard, ComparisonKpiCard } from './KpiCard';
import type { AnalysisData, MergedData, OverloadedTourInfo, DurationDiscrepancy, LateStartAnomaly, PerformanceByDriver, PerformanceByGeo, PerformanceByGroup } from '@/lib/types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, AreaChart, Area, ComposedChart, Line } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AiAnalysis from './AiAnalysis';
import AiReportGenerator from './AiReportGenerator';
import { AlertTriangle, Info, Clock, MapPin, UserCheck, Timer, Smile, Frown, PackageCheck, Route, ArrowUpDown, MessageSquareX, ListChecks, Truck, Calendar, Sun, Moon, Sunset, Sigma, BarChart2, Hash, Users, Warehouse, Building, Percent, Filter, HelpCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Button } from '../ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Tooltip as UiTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';


interface AnalysisDashboardProps {
  analysisData: AnalysisData | null;
  onFilterAndSwitch: (filter: Record<string, any>) => void;
  allData: MergedData[];
  filters: Record<string, any>;
}

const ACCENT_COLOR = "hsl(var(--accent))";
const PRIMARY_COLOR = "hsl(var(--primary))";
const ADVANCE_COLOR = "hsl(210 100% 56%)";

function formatSecondsToTime(seconds: number): string {
    const isNegative = seconds < 0;
    seconds = Math.abs(seconds);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.round(seconds % 60);
    return `${isNegative ? '-' : ''}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatSecondsToClock(seconds: number): string {
    if (isNaN(seconds) || seconds < 0) return '--:--';
    seconds = Math.round(seconds);
    const h = Math.floor(seconds / 3600) % 24;
    const m = Math.floor((seconds % 3600) / 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatDate(dateString: string): string {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        return format(date, 'dd/MM/yyyy', { locale: fr });
    } catch {
        return dateString;
    }
}


type SortConfig<T> = {
    key: keyof T;
    direction: 'asc' | 'desc';
} | null;

export default function AnalysisDashboard({ analysisData, onFilterAndSwitch, allData, filters }: AnalysisDashboardProps) {
  const [activeGeoTab, setActiveGeoTab] = useState('ville');
  const [feedbackAnalysisResult, setFeedbackAnalysisResult] = useState<{ reason: string; count: number }[] | null>(null);
  const [showTop20Only, setShowTop20Only] = useState(false);
  
  const [sorts, setSorts] = useState<{ [key: string]: SortConfig<any> }>({
      overloaded: { key: 'tauxDepassementPoids', direction: 'desc' },
      duration: { key: 'ecart', direction: 'desc' },
      anomaly: { key: 'tasksInDelay', direction: 'desc' },
      driver: { key: 'totalTours', direction: 'desc' },
      depot: { key: 'totalTasks', direction: 'desc' },
      warehouse: { key: 'totalTasks', direction: 'desc' },
      city: { key: 'totalTasks', direction: 'desc' },
      postalCode: { key: 'totalTasks', direction: 'desc' },
  });

  const handleSort = <T,>(table: string, key: keyof T) => {
    let direction: 'asc' | 'desc' = 'asc';
    const currentSort = sorts[table];
    if (currentSort && currentSort.key === key && currentSort.direction === 'asc') {
        direction = 'desc';
    }
    setSorts(prev => ({...prev, [table]: { key, direction } }));
  };

  const renderSortIcon = (table: string, key: string) => {
    const sortConfig = sorts[table];
    if (!sortConfig || sortConfig.key !== key) {
        return <ArrowUpDown className="ml-2 h-4 w-4 opacity-30 group-hover:opacity-80" />;
    }
    return sortConfig.direction === 'asc' ? '▲' : '▼';
  };
  
  const sortedData = useMemo(() => {
    if (!analysisData) return {
      overloadedTours: [],
      durationDiscrepancies: [],
      lateStartAnomalies: [],
      performanceByDriver: [],
      performanceByCity: [],
      performanceByPostalCode: [],
      performanceByDepot: [],
      performanceByWarehouse: [],
    };
    
    const sortFn = <T,>(data: T[] | undefined, config: SortConfig<T>): T[] => {
        if (!data) return [];
        if (!config) return data;

        const sorted = [...data].sort((a, b) => {
            const aValue = a[config.key];
            const bValue = b[config.key];
            
            if (aValue == null) return 1;
            if (bValue == null) return -1;
            
            if (typeof aValue === 'number' && typeof bValue === 'number') {
                if (config.direction === 'asc') return aValue - bValue;
                return bValue - aValue;
            }
            
            if (typeof aValue === 'string' && typeof bValue === 'string') {
                if (config.direction === 'asc') return aValue.localeCompare(bValue);
                return bValue.localeCompare(aValue);
            }

            return 0;
        });

        return sorted;
    }

    const maybeSlice = <T extends { totalTasks: number }>(data: T[] | undefined): T[] => {
        if (!data) return [];
        if (!showTop20Only) return data;

        const sortedByVolume = [...data].sort((a, b) => b.totalTasks - a.totalTasks);
        const sliceCount = Math.ceil(sortedByVolume.length * 0.2);
        return sortedByVolume.slice(0, sliceCount);
    }
    
    return {
      overloadedTours: sortFn<OverloadedTourInfo>(analysisData.overloadedTours, sorts.overloaded),
      durationDiscrepancies: sortFn<DurationDiscrepancy>(analysisData.durationDiscrepancies, sorts.duration),
      lateStartAnomalies: sortFn<LateStartAnomaly>(analysisData.lateStartAnomalies, sorts.anomaly),
      performanceByDriver: sortFn<PerformanceByDriver>(analysisData.performanceByDriver, sorts.driver), // not slicing drivers
      performanceByCity: sortFn<PerformanceByGeo>(maybeSlice(analysisData.performanceByCity), sorts.city),
      performanceByPostalCode: sortFn<PerformanceByGeo>(maybeSlice(analysisData.performanceByPostalCode), sorts.postalCode),
      performanceByDepot: sortFn<PerformanceByGroup>(maybeSlice(analysisData.performanceByDepot), sorts.depot),
      performanceByWarehouse: sortFn<PerformanceByGroup>(maybeSlice(analysisData.performanceByWarehouse), sorts.warehouse),
    };
  }, [analysisData, sorts, showTop20Only]);


  if (!analysisData) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-8 bg-card rounded-lg border">
        <Info className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="text-xl font-semibold">Aucune donnée à afficher</h3>
        <p className="text-muted-foreground mt-1">Veuillez ajuster vos filtres ou vérifier les fichiers importés.</p>
      </div>
    );
  }
  
  const CustomYAxisTick = ({ y, payload }: any) => {
    return (
      <g transform={`translate(0,${y})`}>
        <text x={0} y={0} dy={4} textAnchor="start" fill="#666" fontSize={12} className="max-w-[70px] truncate">
          {payload.value}
        </text>
      </g>
    );
  };
  
  const handleBarClick = (data: any, filterKey: string) => {
    if (data && data.activePayload && data.activePayload.length > 0) {
      const payload = data.activePayload[0].payload;
      if (payload.key) {
        onFilterAndSwitch({ [filterKey]: payload.key });
      } else if (filterKey === 'heure' && payload.hour) {
        onFilterAndSwitch({ [filterKey]: parseInt(payload.hour.split(':')[0]) });
      }
    }
  };
  
  const dayOrder = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
  const sortedPerformanceByDay = (analysisData.performanceByDayOfWeek || []).sort((a,b) => dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day));

  const sortedPerformanceBySlot = analysisData.performanceByTimeSlot || [];

  const combinedHourlyDelays = (analysisData.delaysByHour || []).map(d => ({ hour: d.hour, delays: d.count, advances: 0 }));
  const combinedHourlyAdvances = (analysisData.advancesByHour || []).map(a => ({ hour: a.hour, advances: a.count, delays: 0 }));
  const hourlyDataMap = new Map<string, {delays: number, advances: number}>();
  [...combinedHourlyDelays, ...combinedHourlyAdvances].forEach(item => {
    const entry = hourlyDataMap.get(item.hour) || { delays: 0, advances: 0 };
    entry.delays += item.delays;
    entry.advances += item.advances;
    hourlyDataMap.set(item.hour, entry);
  });
  const combinedHourlyData = Array.from(hourlyDataMap.entries()).map(([hour, data]) => ({ hour, ...data })).sort((a,b) => a.hour.localeCompare(b.hour));

  const combinedWarehouseDelays = (analysisData.delaysByWarehouse || []).map(d => ({ key: d.key, delays: d.count, advances: 0 }));
  const combinedWarehouseAdvances = (analysisData.advancesByWarehouse || []).map(a => ({ key: a.key, advances: a.count, delays: 0 }));
  const warehouseDataMap = new Map<string, {delays: number, advances: number}>();
  [...combinedWarehouseDelays, ...combinedWarehouseAdvances].forEach(item => {
      const entry = warehouseDataMap.get(item.key) || { delays: 0, advances: 0 };
      entry.delays += item.delays;
      entry.advances += item.advances;
      warehouseDataMap.set(item.key, entry);
  });
  const combinedWarehouseData = Array.from(warehouseDataMap.entries()).map(([key, data]) => ({ key, ...data })).sort((a,b) => (b.delays + b.advances) - (a.delays + a.advances));
  
  const totalTours = useMemo(() => {
    const toursKpi = analysisData.generalKpis.find(k => k.title.includes('Tournées'));
    return toursKpi ? parseInt(toursKpi.value) : 0;
  }, [analysisData.generalKpis]);

  const overloadedToursCount = (analysisData.overloadedTours || []).length;
  const durationDiscrepanciesCount = (analysisData.durationDiscrepancies || []).length;
  const lateStartAnomaliesCount = (analysisData.lateStartAnomalies || []).length;

  const performanceFocusData = useMemo(() => {
    const data = [
        ...(analysisData.performanceByDepot || []).map(d => ({ ...d, type: 'Dépôt' })),
        ...(analysisData.performanceByWarehouse || []).map(d => ({ ...d, type: 'Entrepôt' })),
        ...(analysisData.performanceByCity || []).map(d => ({ ...d, type: 'Ville' })),
    ];
    return data
        .map(d => ({
            key: `${d.type}: ${d.key}`,
            punctualityDiscrepancy: d.punctualityRateRealized - d.punctualityRatePlanned,
        }))
        .filter(d => d.punctualityDiscrepancy < 0)
        .sort((a, b) => a.punctualityDiscrepancy - b.punctualityDiscrepancy)
        .slice(0, 5);
  }, [analysisData]);


  return (
    <div className="space-y-8">
      {/* Section 1: Vue d'Ensemble & Synthèse Globale */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Vue d'Ensemble & Synthèse Globale</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-6">
          {analysisData.generalKpis.map(kpi => <KpiCard key={kpi.title} {...kpi} />)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {analysisData.discrepancyKpis.map(kpi => <ComparisonKpiCard key={kpi.title} {...kpi} />)}
        </div>
      </section>
      
      {/* Section 2: Impact Qualité & Analyse IA */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Impact Qualité & Analyse IA</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><BarChart2 />Impact des Écarts sur la Qualité</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {analysisData.qualityKpis.map(kpi => {
                    if ('value1' in kpi && 'value2' in kpi) {
                        return <ComparisonKpiCard key={kpi.title} {...kpi} />
                    }
                    return <KpiCard variant="inline" key={kpi.title} {...kpi} />
                })}
              </CardContent>
            </Card>
          </div>
          <div className="lg:col-span-2 space-y-6">
              <AiAnalysis allData={allData} onAnalysisComplete={setFeedbackAnalysisResult}/>
              <AiReportGenerator analysisData={analysisData} allData={allData} filters={filters} aiFeedbackAnalysis={feedbackAnalysisResult} />
          </div>
        </div>
      </section>

      {/* Section 3: Analyse des Causes (Groupes & Anomalies) */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Analyse des Causes (Anomalies & Groupes)</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader><CardTitle>Synthèse des Écarts Globaux par Groupe</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableBody>
                  <TableRow><TableCell className="font-medium">Taux Ponctualité Planifié</TableCell><TableCell className="text-right font-semibold">{analysisData.globalSummary.punctualityRatePlanned.toFixed(1)}%</TableCell></TableRow>
                  <TableRow><TableCell className="font-medium">Taux Ponctualité Réalisé</TableCell><TableCell className="text-right font-semibold">{analysisData.globalSummary.punctualityRateRealized.toFixed(1)}%</TableCell></TableRow>
                  <TableRow><TableCell className="font-medium">Écart Durée Moyen / Tournée</TableCell><TableCell className="text-right font-semibold">{formatSecondsToTime(analysisData.globalSummary.avgDurationDiscrepancyPerTour)} ({analysisData.globalSummary.durationOverrunPercentage.toFixed(1)}%)</TableCell></TableRow>
                  <TableRow><TableCell className="font-medium">Écart Poids Moyen / Tournée</TableCell><TableCell className="text-right font-semibold">{analysisData.globalSummary.avgWeightDiscrepancyPerTour.toFixed(2)} kg ({analysisData.globalSummary.weightOverrunPercentage.toFixed(1)}%)</TableCell></TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card>
              <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="text-amber-500"/>
                      Analyse des Anomalies
                  </CardTitle>
                  <CardDescription>
                      Explorez les principaux types d'anomalies opérationnelles.
                  </CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="overloaded">
                    <AccordionTrigger>
                        Dépassements de Charge ({overloadedToursCount} - {totalTours > 0 ? (overloadedToursCount / totalTours * 100).toFixed(1) : 0}%)
                    </AccordionTrigger>
                    <AccordionContent>
                      <ScrollArea className="h-60">
                        <Table>
                          <TableHeader><TableRow><TableHead>Tournée</TableHead><TableHead>Entrepôt</TableHead><TableHead>Dépassement Poids</TableHead></TableRow></TableHeader>
                          <TableBody>
                            {sortedData.overloadedTours?.map(tour => (
                              <TableRow key={tour.uniqueId}>
                                <TableCell>{formatDate(tour.date)} - {tour.nom}</TableCell>
                                <TableCell>{tour.entrepot}</TableCell>
                                <TableCell className="font-semibold text-destructive">
                                  {tour.depassementPoids > 0 ? `+${tour.depassementPoids.toFixed(2)} kg` : '-'}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="duration">
                    <AccordionTrigger>
                        Écarts de Durée Positifs ({durationDiscrepanciesCount} - {totalTours > 0 ? (durationDiscrepanciesCount / totalTours * 100).toFixed(1) : 0}%)
                    </AccordionTrigger>
                    <AccordionContent>
                       <ScrollArea className="h-60">
                        <Table>
                          <TableHeader><TableRow><TableHead>Tournée</TableHead><TableHead>Écart</TableHead></TableRow></TableHeader>
                          <TableBody>
                            {(sortedData.durationDiscrepancies || []).map(tour => (
                                <TableRow key={tour.uniqueId}>
                                  <TableCell>{formatDate(tour.date)} - {tour.nom}</TableCell>
                                  <TableCell className="text-destructive font-semibold">
                                      +{formatSecondsToTime(tour.ecart)}
                                  </TableCell>
                                </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="anomaly">
                     <AccordionTrigger>
                        <div className="flex items-center gap-2">
                            Anomalies de Planification ({lateStartAnomaliesCount} - {totalTours > 0 ? (lateStartAnomaliesCount / totalTours * 100).toFixed(1) : 0}%)
                            <TooltipProvider>
                                <UiTooltip>
                                    <TooltipTrigger>
                                        <HelpCircle className="w-4 h-4 text-muted-foreground" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Tournées parties à l'heure (ou en avance) mais dont au moins une<br/> livraison est arrivée en retard. Signale des problèmes de temps de parcours.</p>
                                    </TooltipContent>
                                </UiTooltip>
                            </TooltipProvider>
                        </div>
                    </AccordionTrigger>
                     <AccordionContent>
                       <ScrollArea className="h-60">
                         <Table>
                          <TableHeader><TableRow><TableHead>Tournée</TableHead><TableHead>Départ Prévu</TableHead><TableHead>Départ Réel</TableHead><TableHead># Tâches Retard</TableHead></TableRow></TableHeader>
                          <TableBody>
                            {sortedData.lateStartAnomalies?.map(tour => (
                                <TableRow key={tour.uniqueId}>
                                  <TableCell>{formatDate(tour.date)} - {tour.nom}</TableCell>
                                  <TableCell>{formatSecondsToClock(tour.heureDepartPrevue)}</TableCell>
                                  <TableCell className="font-semibold text-blue-600">{formatSecondsToClock(tour.heureDepartReelle)}</TableCell>
                                  <TableCell className="font-bold">{tour.tasksInDelay}</TableCell>
                                </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                       </ScrollArea>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
          </Card>
        </div>
      </section>

      {/* Section 4: Analyses Temporelles & Géographiques Détaillées */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Analyses Détaillées</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <Card>
               <CardHeader>
                 <CardTitle className="flex items-center gap-2"><Calendar/>Performance par Jour</CardTitle>
               </CardHeader>
               <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                     <ComposedChart data={sortedPerformanceByDay}>
                       <CartesianGrid strokeDasharray="3 3" />
                       <XAxis dataKey="day" fontSize={12} />
                       <YAxis yAxisId="left" label={{ value: 'Nb. Tâches', angle: -90, position: 'insideLeft', fontSize: 12, offset: 10 }} />
                       <YAxis yAxisId="right" orientation="right" label={{ value: 'Retard Moyen (min)', angle: -90, position: 'insideRight', fontSize: 12, offset: 10 }} />
                       <Tooltip />
                       <Legend wrapperStyle={{fontSize: "12px"}}/>
                       <Bar yAxisId="left" dataKey="delays" name="Retards" fill={PRIMARY_COLOR} stackId="a" />
                       <Bar yAxisId="left" dataKey="advances" name="Avances" fill={ADVANCE_COLOR} stackId="a" />
                       <Line yAxisId="right" type="monotone" dataKey="avgDelay" name="Retard Moyen" stroke="#ff7300" dot={false} strokeWidth={2} />
                     </ComposedChart>
                  </ResponsiveContainer>
               </CardContent>
             </Card>
             <Card>
               <CardHeader>
                 <CardTitle className="flex items-center gap-2"><Clock/>Performance par Créneau de 2h</CardTitle>
               </CardHeader>
               <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                     <ComposedChart data={sortedPerformanceBySlot}>
                       <CartesianGrid strokeDasharray="3 3" />
                       <XAxis dataKey="slot" fontSize={12}/>
                       <YAxis yAxisId="left" label={{ value: 'Nb. Tâches', angle: -90, position: 'insideLeft', fontSize: 12, offset: 10 }} />
                       <YAxis yAxisId="right" orientation="right" label={{ value: 'Retard Moyen (min)', angle: -90, position: 'insideRight', fontSize: 12, offset: 10 }}/>
                       <Tooltip />
                       <Legend wrapperStyle={{fontSize: "12px"}}/>
                       <Bar yAxisId="left" dataKey="delays" name="Retards" fill={PRIMARY_COLOR} stackId="a" />
                       <Bar yAxisId="left" dataKey="advances" name="Avances" fill={ADVANCE_COLOR} stackId="a" />
                       <Line yAxisId="right" type="monotone" dataKey="avgDelay" name="Retard Moyen" stroke="#ff7300" dot={false} strokeWidth={2} />
                     </ComposedChart>
                  </ResponsiveContainer>
               </CardContent>
             </Card>
             <Card>
               <CardHeader>
                 <CardTitle className="flex items-center gap-2"><Sigma />Répartition des Écarts</CardTitle>
               </CardHeader>
               <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                     <BarChart data={analysisData.delayHistogram}>
                       <CartesianGrid strokeDasharray="3 3" />
                       <XAxis dataKey="range" fontSize={10} angle={-45} textAnchor="end" height={80} interval={0} />
                       <YAxis />
                       <Tooltip />
                       <Bar dataKey="count" name="Nb. de Tâches">
                          {(analysisData.delayHistogram || []).map((entry, index) => {
                             let color = '#a0aec0'; // default grey
                             if (entry.range.includes('retard')) color = PRIMARY_COLOR;
                             if (entry.range.includes('avance')) color = ADVANCE_COLOR;
                             if (entry.range.includes('l\'heure')) color = '#48bb78'; // green
                             return <Cell key={`cell-${index}`} fill={color} />;
                          })}
                       </Bar>
                     </BarChart>
                  </ResponsiveContainer>
               </CardContent>
             </Card>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Clock />Écarts par Heure</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={combinedHourlyData} onClick={(e) => handleBarClick(e, 'heure')}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="delays" name="Retards" stackId="a" fill={PRIMARY_COLOR} className="cursor-pointer" />
                    <Bar dataKey="advances" name="Avances" stackId="a" fill={ADVANCE_COLOR} className="cursor-pointer" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Warehouse />Écarts par Entrepôt</CardTitle>
              </CardHeader>
              <CardContent>
                  <ScrollArea className="h-80">
                    <ResponsiveContainer width="100%" height={combinedWarehouseData.length * 40}>
                      <BarChart data={combinedWarehouseData} layout="vertical" margin={{ left: 100 }} onClick={(e) => handleBarClick(e, 'entrepot')}>
                          <XAxis type="number" />
                          <YAxis dataKey="key" type="category" width={100} tickLine={false} axisLine={false} tick={CustomYAxisTick} />
                          <Tooltip cursor={{fill: 'rgba(206, 206, 206, 0.2)'}} />
                          <Legend />
                          <Bar dataKey="delays" name="Retards" stackId="a" barSize={20} fill={PRIMARY_COLOR} className="cursor-pointer" />
                          <Bar dataKey="advances" name="Avances" stackId="a" barSize={20} fill={ADVANCE_COLOR} className="cursor-pointer" />
                      </BarChart>
                    </ResponsiveContainer>
                  </ScrollArea>
              </CardContent>
            </Card>
        </div>
      </section>

      {/* Section 5: Analyse de la Charge de Travail & Performance Humaine */}
       <section>
        <h2 className="text-2xl font-bold mb-4">Analyse de la Charge & Performance Humaine</h2>
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
             <Card>
               <CardHeader>
                 <CardTitle>Charge, Retards et Avances par Heure</CardTitle>
                 <CardDescription>Volume de tâches, retards et avances au fil de la journée.</CardDescription>
               </CardHeader>
               <CardContent>
                  <ResponsiveContainer width="100%" height={320}>
                     <ComposedChart data={analysisData.workloadByHour}>
                       <CartesianGrid strokeDasharray="3 3" />
                       <XAxis dataKey="hour" />
                       <YAxis yAxisId="left" label={{ value: 'Nb. Tâches', angle: -90, position: 'insideLeft' }}/>
                       <YAxis yAxisId="right" orientation="right" label={{ value: 'Nb. Écarts', angle: -90, position: 'insideRight' }} />
                       <Tooltip />
                       <Legend />
                       <Area yAxisId="left" type="monotone" dataKey="planned" name="Planifié" stroke={ACCENT_COLOR} fill={ACCENT_COLOR} fillOpacity={0.3} />
                       <Area yAxisId="left" type="monotone" dataKey="real" name="Réalisé" stroke={PRIMARY_COLOR} fill={PRIMARY_COLOR} fillOpacity={0.3} />
                       <Line yAxisId="right" type="monotone" dataKey="delays" name="Retards" stroke={PRIMARY_COLOR} dot={false} strokeWidth={2} />
                       <Line yAxisId="right" type="monotone" dataKey="advances" name="Avances" stroke={ADVANCE_COLOR} dot={false} strokeWidth={2} />
                     </ComposedChart>
                  </ResponsiveContainer>
               </CardContent>
             </Card>
             <Card>
              <CardHeader>
                <CardTitle>Intensité du Travail par Heure</CardTitle>
                 <CardDescription className="flex items-center gap-2">
                  <span>Nb. moyen de tâches / tournée active.</span>
                  <span className="font-semibold text-xs rounded bg-muted px-1.5 py-0.5">
                      Moy Plan.: {analysisData.avgWorkload.avgPlanned.toFixed(2)}
                  </span>
                  <span className="font-semibold text-xs rounded bg-muted px-1.5 py-0.5">
                      Moy Réel: {analysisData.avgWorkload.avgReal.toFixed(2)}
                  </span>
                 </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={analysisData.avgWorkloadByDriverByHour}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis label={{ value: 'Tâches / Tournée', angle: -90, position: 'insideLeft' }}/>
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="avgPlanned" name="Planifié / Tournée" stroke={ACCENT_COLOR} fill={ACCENT_COLOR} fillOpacity={0.3} />
                    <Area type="monotone" dataKey="avgReal" name="Réalisé / Tournée" stroke={PRIMARY_COLOR} fill={PRIMARY_COLOR} fillOpacity={0.3} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
         </div>

         <Card>
            <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Analyse des Performances par Groupe</CardTitle>
                <div className="flex items-center space-x-2">
                    <Switch
                        id="top-20-filter"
                        checked={showTop20Only}
                        onCheckedChange={setShowTop20Only}
                    />
                    <Label htmlFor="top-20-filter" className="flex items-center gap-2">
                        <Filter className="w-4 h-4"/>
                        Afficher uniquement le Top 20% (par volume)
                    </Label>
                </div>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="driver" className="w-full">
                    <TabsList>
                        <TabsTrigger value="driver">Par Livreur</TabsTrigger>
                        <TabsTrigger value="depot">Par Dépôt</TabsTrigger>
                        <TabsTrigger value="warehouse">Par Entrepôt</TabsTrigger>
                        <TabsTrigger value="city">Par Ville</TabsTrigger>
                        <TabsTrigger value="postalCode">Par Code Postal</TabsTrigger>
                    </TabsList>
                    <TabsContent value="driver" className="mt-4">
                        <ScrollArea className="h-96">
                             <Table>
                                  <TableHeader>
                                      <TableRow>
                                          <TableHead className="cursor-pointer group" onClick={() => handleSort('driver', 'key')}>Livreur {renderSortIcon('driver', 'key')}</TableHead>
                                          <TableHead className="cursor-pointer group" onClick={() => handleSort('driver', 'totalTours')}>Nb. Tournées {renderSortIcon('driver', 'totalTours')}</TableHead>
                                          <TableHead className="cursor-pointer group" onClick={() => handleSort('driver', 'punctualityRate')}>Ponctualité {renderSortIcon('driver', 'punctualityRate')}</TableHead>
                                          <TableHead className="cursor-pointer group" onClick={() => handleSort('driver', 'avgDelay')}>Retard Moyen (min) {renderSortIcon('driver', 'avgDelay')}</TableHead>
                                          <TableHead className="cursor-pointer group" onClick={() => handleSort('driver', 'overweightToursCount')}>Dépassements Poids {renderSortIcon('driver', 'overweightToursCount')}</TableHead>
                                          <TableHead className="cursor-pointer group" onClick={() => handleSort('driver', 'avgRating')}>Notation Moy. {renderSortIcon('driver', 'avgRating')}</TableHead>
                                      </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                      {(sortedData.performanceByDriver || []).map(driver => (
                                          <TableRow key={driver.key}>
                                              <TableCell>{driver.key}</TableCell>
                                              <TableCell>{driver.totalTours}</TableCell>
                                              <TableCell>{driver.punctualityRate.toFixed(1)}%</TableCell>
                                              <TableCell>{driver.avgDelay.toFixed(1)}</TableCell>
                                              <TableCell>{driver.overweightToursCount}</TableCell>
                                              <TableCell>{driver.avgRating?.toFixed(2) || 'N/A'}</TableCell>
                                          </TableRow>
                                      ))}
                                  </TableBody>
                              </Table>
                         </ScrollArea>
                    </TabsContent>
                    <TabsContent value="depot" className="mt-4">
                       <ScrollArea className="h-96">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="cursor-pointer group" onClick={() => handleSort('depot', 'key')}>Dépôt {renderSortIcon('depot', 'key')}</TableHead>
                                <TableHead className="cursor-pointer group" onClick={() => handleSort('depot', 'totalTasks')}>Nb. Tâches {renderSortIcon('depot', 'totalTasks')}</TableHead>
                                <TableHead className="cursor-pointer group" onClick={() => handleSort('depot', 'punctualityRateRealized')}>Ponctualité {renderSortIcon('depot', 'punctualityRateRealized')}</TableHead>
                                <TableHead className="cursor-pointer group" onClick={() => handleSort('depot', 'avgDurationDiscrepancy')}>Écart Durée {renderSortIcon('depot', 'avgDurationDiscrepancy')}</TableHead>
                                <TableHead className="cursor-pointer group" onClick={() => handleSort('depot', 'avgWeightDiscrepancy')}>Écart Poids {renderSortIcon('depot', 'avgWeightDiscrepancy')}</TableHead>
                                <TableHead className="cursor-pointer group" onClick={() => handleSort('depot', 'lateWithBadReviewPercentage')}>% Insat. {renderSortIcon('depot', 'lateWithBadReviewPercentage')}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(sortedData.performanceByDepot || []).map(item => (
                                <TableRow key={item.key}>
                                  <TableCell className="font-medium">{item.key}</TableCell>
                                  <TableCell>{item.totalTasks}</TableCell>
                                  <TableCell><span className={cn(item.punctualityRateRealized < item.punctualityRatePlanned - 2 && "text-destructive font-bold")}>{item.punctualityRateRealized.toFixed(1)}%</span><span className="text-xs text-muted-foreground"> ({item.punctualityRatePlanned.toFixed(1)}%)</span></TableCell>
                                  <TableCell className={cn(item.avgDurationDiscrepancy > 600 && "text-destructive font-bold")}>{formatSecondsToTime(item.avgDurationDiscrepancy)}</TableCell>
                                  <TableCell className={cn(item.avgWeightDiscrepancy > 20 && "text-destructive font-bold")}>{item.avgWeightDiscrepancy.toFixed(1)} kg</TableCell>
                                  <TableCell>{item.lateWithBadReviewPercentage.toFixed(1)}%</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                       </ScrollArea>
                    </TabsContent>
                    <TabsContent value="warehouse" className="mt-4">
                         <ScrollArea className="h-96">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                   <TableHead className="cursor-pointer group" onClick={() => handleSort('warehouse', 'key')}>Entrepôt {renderSortIcon('warehouse', 'key')}</TableHead>
                                   <TableHead className="cursor-pointer group" onClick={() => handleSort('warehouse', 'totalTasks')}>Nb. Tâches {renderSortIcon('warehouse', 'totalTasks')}</TableHead>
                                   <TableHead className="cursor-pointer group" onClick={() => handleSort('warehouse', 'punctualityRateRealized')}>Ponctualité {renderSortIcon('warehouse', 'punctualityRateRealized')}</TableHead>
                                   <TableHead className="cursor-pointer group" onClick={() => handleSort('warehouse', 'avgDurationDiscrepancy')}>Écart Durée {renderSortIcon('warehouse', 'avgDurationDiscrepancy')}</TableHead>
                                   <TableHead className="cursor-pointer group" onClick={() => handleSort('warehouse', 'avgWeightDiscrepancy')}>Écart Poids {renderSortIcon('warehouse', 'avgWeightDiscrepancy')}</TableHead>
                                   <TableHead className="cursor-pointer group" onClick={() => handleSort('warehouse', 'lateWithBadReviewPercentage')}>% Insat. {renderSortIcon('warehouse', 'lateWithBadReviewPercentage')}</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {(sortedData.performanceByWarehouse || []).map(item => (
                                  <TableRow key={item.key}>
                                    <TableCell className="font-medium">{item.key}</TableCell>
                                    <TableCell>{item.totalTasks}</TableCell>
                                    <TableCell><span className={cn(item.punctualityRateRealized < item.punctualityRatePlanned - 2 && "text-destructive font-bold")}>{item.punctualityRateRealized.toFixed(1)}%</span><span className="text-xs text-muted-foreground"> ({item.punctualityRatePlanned.toFixed(1)}%)</span></TableCell>
                                    <TableCell className={cn(item.avgDurationDiscrepancy > 600 && "text-destructive font-bold")}>{formatSecondsToTime(item.avgDurationDiscrepancy)}</TableCell>
                                    <TableCell className={cn(item.avgWeightDiscrepancy > 20 && "text-destructive font-bold")}>{item.avgWeightDiscrepancy.toFixed(1)} kg</TableCell>
                                    <TableCell>{item.lateWithBadReviewPercentage.toFixed(1)}%</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                         </ScrollArea>
                    </TabsContent>
                    <TabsContent value="city" className="mt-4">
                         <ScrollArea className="h-96">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="cursor-pointer group" onClick={() => handleSort('city', 'key')}>Ville {renderSortIcon('city', 'key')}</TableHead>
                                  <TableHead className="cursor-pointer group" onClick={() => handleSort('city', 'totalTasks')}>Nb. Tâches {renderSortIcon('city', 'totalTasks')}</TableHead>
                                  <TableHead className="cursor-pointer group" onClick={() => handleSort('city', 'punctualityRateRealized')}>Ponctualité {renderSortIcon('city', 'punctualityRateRealized')}</TableHead>
                                  <TableHead className="cursor-pointer group" onClick={() => handleSort('city', 'avgDurationDiscrepancy')}>Écart Durée {renderSortIcon('city', 'avgDurationDiscrepancy')}</TableHead>
                                  <TableHead className="cursor-pointer group" onClick={() => handleSort('city', 'avgWeightDiscrepancy')}>Écart Poids {renderSortIcon('city', 'avgWeightDiscrepancy')}</TableHead>
                                  <TableHead className="cursor-pointer group" onClick={() => handleSort('city', 'lateWithBadReviewPercentage')}>% Insat. {renderSortIcon('city', 'lateWithBadReviewPercentage')}</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {sortedData.performanceByCity.map(item => (
                                   <TableRow key={item.key}>
                                    <TableCell className="font-medium">{item.key}</TableCell>
                                    <TableCell>{item.totalTasks}</TableCell>
                                    <TableCell><span className={cn(item.punctualityRateRealized < item.punctualityRatePlanned - 2 && "text-destructive font-bold")}>{item.punctualityRateRealized.toFixed(1)}%</span><span className="text-xs text-muted-foreground"> ({item.punctualityRatePlanned.toFixed(1)}%)</span></TableCell>
                                    <TableCell className={cn(item.avgDurationDiscrepancy > 600 && "text-destructive font-bold")}>{formatSecondsToTime(item.avgDurationDiscrepancy)}</TableCell>
                                    <TableCell className={cn(item.avgWeightDiscrepancy > 20 && "text-destructive font-bold")}>{item.avgWeightDiscrepancy.toFixed(1)} kg</TableCell>
                                    <TableCell>{item.lateWithBadReviewPercentage.toFixed(1)}%</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                         </ScrollArea>
                    </TabsContent>
                    <TabsContent value="postalCode" className="mt-4">
                         <ScrollArea className="h-96">
                             <Table>
                              <TableHeader>
                                  <TableRow>
                                      <TableHead className="cursor-pointer group" onClick={() => handleSort('postalCode', 'key')}>Code Postal {renderSortIcon('postalCode', 'key')}</TableHead>
                                      <TableHead className="cursor-pointer group" onClick={() => handleSort('postalCode', 'totalTasks')}>Tâches {renderSortIcon('postalCode', 'totalTasks')}</TableHead>
                                      <TableHead className="cursor-pointer group" onClick={() => handleSort('postalCode', 'punctualityRateRealized')}>Ponctualité {renderSortIcon('postalCode', 'punctualityRateRealized')}</TableHead>
                                      <TableHead className="cursor-pointer group" onClick={() => handleSort('postalCode', 'avgDurationDiscrepancy')}>Écart Durée {renderSortIcon('postalCode', 'avgDurationDiscrepancy')}</TableHead>
                                      <TableHead className="cursor-pointer group" onClick={() => handleSort('postalCode', 'avgWeightDiscrepancy')}>Écart Poids {renderSortIcon('postalCode', 'avgWeightDiscrepancy')}</TableHead>
                                      <TableHead className="cursor-pointer group" onClick={() => handleSort('postalCode', 'lateWithBadReviewPercentage')}>% Insat. sur Retard {renderSortIcon('postalCode', 'lateWithBadReviewPercentage')}</TableHead>
                                  </TableRow>
                              </TableHeader>
                              <TableBody>
                                  {sortedData.performanceByPostalCode?.map(item => (
                                      <TableRow key={item.key}>
                                          <TableCell>{item.key}</TableCell>
                                          <TableCell>{item.totalTasks}</TableCell>
                                          <TableCell><span className={cn(item.punctualityRateRealized < item.punctualityRatePlanned - 2 && "text-destructive font-bold")}>{item.punctualityRateRealized.toFixed(1)}%</span><span className="text-xs text-muted-foreground"> ({item.punctualityRatePlanned.toFixed(1)}%)</span></TableCell>
                                          <TableCell className={cn(item.avgDurationDiscrepancy > 600 && "text-destructive font-bold")}>{formatSecondsToTime(item.avgDurationDiscrepancy)}</TableCell>
                                          <TableCell className={cn(item.avgWeightDiscrepancy > 20 && "text-destructive font-bold")}>{item.avgWeightDiscrepancy.toFixed(1)} kg</TableCell>
                                          <TableCell>{item.lateWithBadReviewPercentage.toFixed(1)}%</TableCell>
                                      </TableRow>
                                  ))}
                              </TableBody>
                          </Table>
                         </ScrollArea>
                    </TabsContent>
                </Tabs>
            </CardContent>
         </Card>
        {performanceFocusData.length > 0 && (
            <Card className="mt-6">
                <CardHeader>
                    <CardTitle>Focus sur les Écarts de Ponctualité par Groupe</CardTitle>
                    <CardDescription>
                        Top 5 des groupes avec les plus grands écarts négatifs entre la ponctualité planifiée et réalisée.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart layout="vertical" data={performanceFocusData} margin={{ left: 150 }}>
                            <XAxis type="number" dataKey="punctualityDiscrepancy" domain={['auto', 0]} formatter={(value) => `${value.toFixed(1)}%`} />
                            <YAxis type="category" dataKey="key" width={150} tickLine={false} />
                            <Tooltip formatter={(value: number) => [`${value.toFixed(2)}%`, "Écart de Ponctualité"]} />
                            <Legend />
                            <Bar dataKey="punctualityDiscrepancy" name="Écart Planifié/Réalisé" fill={ACCENT_COLOR}>
                                {performanceFocusData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={cn(entry.punctualityDiscrepancy < -5 ? "hsl(var(--destructive))" : "hsl(var(--accent))")} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        )}
      </section>
    </div>
  );
}
