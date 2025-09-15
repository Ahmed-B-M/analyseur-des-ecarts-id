'use client';
import { KpiCard, ComparisonKpiCard } from './KpiCard';
import type { AnalysisData, MergedData, OverloadedTourInfo, DurationDiscrepancy, LateStartAnomaly, PerformanceByDriver, PerformanceByGeo, PerformanceByGroup } from '@/lib/types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, AreaChart, Area, ComposedChart, Line } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AiAnalysis from './AiAnalysis';
import AiReportGenerator from './AiReportGenerator';
import { AlertTriangle, Info, Clock, MapPin, UserCheck, Timer, Smile, Frown, PackageCheck, Route, ArrowUpDown, MessageSquareX, ListChecks, Truck, Calendar, Sun, Moon, Sunset, Sigma, BarChart2, Hash, Users, Warehouse, Building } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Button } from '../ui/button';

interface AnalysisDashboardProps {
  analysisData: AnalysisData | null;
  onFilterAndSwitch: (filter: Record<string, any>) => void;
  allData: MergedData[];
  filters: Record<string, any>;
}

const ACCENT_COLOR = "hsl(var(--accent))";
const PRIMARY_COLOR = "hsl(var(--primary))";
const ADVANCE_COLOR = "hsl(210 100% 56%)"; // A distinct blue for "advance"

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
  const [activeTab, setActiveTab] = useState('ville');
  const [feedbackAnalysisResult, setFeedbackAnalysisResult] = useState<{ reason: string; count: number }[] | null>(null);
  const [depotViewMode, setDepotViewMode] = useState<'all' | 'top20'>('all');
  const [warehouseViewMode, setWarehouseViewMode] = useState<'all' | 'top20'>('all');
  const [cityViewMode, setCityViewMode] = useState<'all' | 'top20'>('all');
  
  const [sorts, setSorts] = useState<{ [key: string]: SortConfig<any> }>({
      overloaded: { key: 'tauxDepassementPoids', direction: 'desc' },
      duration: { key: 'ecart', direction: 'desc' },
      anomaly: { key: 'tasksInDelay', direction: 'desc' },
      driver: { key: 'totalTours', direction: 'desc' },
      geo: { key: 'totalTasks', direction: 'desc' },
      depot: { key: 'avgDurationDiscrepancy', direction: 'desc' },
      warehouse: { key: 'avgDurationDiscrepancy', direction: 'desc' },
      city: { key: 'totalTasks', direction: 'desc' },
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
    
    return {
      overloadedTours: sortFn<OverloadedTourInfo>(analysisData.overloadedTours, sorts.overloaded),
      durationDiscrepancies: sortFn<DurationDiscrepancy>(analysisData.durationDiscrepancies, sorts.duration),
      lateStartAnomalies: sortFn<LateStartAnomaly>(analysisData.lateStartAnomalies, sorts.anomaly),
      performanceByDriver: sortFn<PerformanceByDriver>(analysisData.performanceByDriver, sorts.driver),
      performanceByCity: sortFn<PerformanceByGeo>(analysisData.performanceByCity, sorts.city),
      performanceByPostalCode: sortFn<PerformanceByGeo>(analysisData.performanceByPostalCode, sorts.geo),
      performanceByDepot: sortFn<PerformanceByGroup>(analysisData.performanceByDepot, sorts.depot),
      performanceByWarehouse: sortFn<PerformanceByGroup>(analysisData.performanceByWarehouse, sorts.warehouse),
    };
  }, [analysisData, sorts]);

  const depotDataToDisplay = useMemo(() => {
    const data = sortedData.performanceByDepot;
    if (depotViewMode === 'top20' && data.length > 0) {
        const sortedByTasks = [...data].sort((a,b) => b.totalTasks - a.totalTasks);
        const top20PercentIndex = Math.ceil(sortedByTasks.length * 0.2);
        return sortedByTasks.slice(0, top20PercentIndex);
    }
    return data;
  }, [sortedData.performanceByDepot, depotViewMode]);

  const warehouseDataToDisplay = useMemo(() => {
    const data = sortedData.performanceByWarehouse;
    if (warehouseViewMode === 'top20' && data.length > 0) {
        const sortedByTasks = [...data].sort((a,b) => b.totalTasks - a.totalTasks);
        const top20PercentIndex = Math.ceil(sortedByTasks.length * 0.2);
        return sortedByTasks.slice(0, top20PercentIndex);
    }
    return data;
  }, [sortedData.performanceByWarehouse, warehouseViewMode]);

  const cityDataToDisplay = useMemo(() => {
    const data = sortedData.performanceByCity;
    if (cityViewMode === 'top20' && data.length > 0) {
        const sortedByTasks = [...data].sort((a,b) => b.totalTasks - a.totalTasks);
        const top20PercentIndex = Math.ceil(sortedByTasks.length * 0.2);
        return sortedByTasks.slice(0, top20PercentIndex);
    }
    return data;
  }, [sortedData.performanceByCity, cityViewMode]);


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
  
  const geoDataToDisplay = activeTab === 'ville' ? sortedData.performanceByCity : sortedData.performanceByPostalCode;

  const dayOrder = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
  const sortedPerformanceByDay = (analysisData.performanceByDayOfWeek || []).sort((a,b) => dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day));

  const slotOrder = ['Matin (06-12h)', 'Après-midi (12-18h)', 'Soir (18-00h)'];
  const sortedPerformanceBySlot = (analysisData.performanceByTimeSlot || []).sort((a,b) => slotOrder.indexOf(a.slot) - slotOrder.indexOf(b.slot));

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-2xl font-bold mb-4">KPIs Généraux & Satisfaction Client</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
          {analysisData.generalKpis.map(kpi => <KpiCard key={kpi.title} {...kpi} />)}
        </div>
      </section>
      
      <section>
        <AiReportGenerator analysisData={analysisData} allData={allData} filters={filters} aiFeedbackAnalysis={feedbackAnalysisResult} />
      </section>
      
      <section>
        <h2 className="text-2xl font-bold mb-4">Analyse des Écarts par Groupe</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle>Synthèse des Écarts Globaux</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableBody>
                  <TableRow><TableCell className="font-medium">Taux Ponctualité Planifié</TableCell><TableCell className="text-right font-semibold">{analysisData.globalSummary.punctualityRatePlanned.toFixed(1)}%</TableCell></TableRow>
                  <TableRow><TableCell className="font-medium">Taux Ponctualité Réalisé</TableCell><TableCell className="text-right font-semibold">{analysisData.globalSummary.punctualityRateRealized.toFixed(1)}%</TableCell></TableRow>
                  <TableRow><TableCell className="font-medium">Écart Durée Moyen / Tournée</TableCell><TableCell className="text-right font-semibold">{formatSecondsToTime(analysisData.globalSummary.avgDurationDiscrepancyPerTour)}</TableCell></TableRow>
                  <TableRow><TableCell className="font-medium">Écart Poids Moyen / Tournée</TableCell><TableCell className="text-right font-semibold">{analysisData.globalSummary.avgWeightDiscrepancyPerTour.toFixed(2)} kg</TableCell></TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2"><Building />Analyse des Écarts par Dépôt</CardTitle>
              <div className="flex items-center gap-2">
                <Button variant={depotViewMode === 'top20' ? 'secondary' : 'ghost'} size="sm" onClick={() => setDepotViewMode('top20')}>Top 20%</Button>
                <Button variant={depotViewMode === 'all' ? 'secondary' : 'ghost'} size="sm" onClick={() => setDepotViewMode('all')}>Tout voir</Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-48">
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
                    {(depotDataToDisplay || []).map(item => (
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
            </CardContent>
          </Card>
           <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2"><Warehouse />Analyse des Écarts par Entrepôt</CardTitle>
              <div className="flex items-center gap-2">
                <Button variant={warehouseViewMode === 'top20' ? 'secondary' : 'ghost'} size="sm" onClick={() => setWarehouseViewMode('top20')}>Top 20%</Button>
                <Button variant={warehouseViewMode === 'all' ? 'secondary' : 'ghost'} size="sm" onClick={() => setWarehouseViewMode('all')}>Tout voir</Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-48">
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
                    {(warehouseDataToDisplay || []).map(item => (
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
            </CardContent>
          </Card>
           <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2"><MapPin />Analyse des Écarts par Ville</CardTitle>
                <div className="flex items-center gap-2">
                    <Button variant={cityViewMode === 'top20' ? 'secondary' : 'ghost'} size="sm" onClick={() => setCityViewMode('top20')}>Top 20%</Button>
                    <Button variant={cityViewMode === 'all' ? 'secondary' : 'ghost'} size="sm" onClick={() => setCityViewMode('all')}>Tout voir</Button>
                </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-48">
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
                    {cityDataToDisplay.map(item => (
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
            </CardContent>
          </Card>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">Synthèse des Écarts : Planifié vs. Réalisé</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {analysisData.discrepancyKpis.map(kpi => <ComparisonKpiCard key={kpi.title} {...kpi} />)}
        </div>
      </section>

      <section>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><BarChart2 />Impact des Écarts sur la Qualité</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {analysisData.qualityKpis.map(kpi => <KpiCard variant="inline" key={kpi.title} {...kpi} />)}
            </CardContent>
          </Card>
          <div className="lg:col-span-2">
              <AiAnalysis allData={allData} onAnalysisComplete={setFeedbackAnalysisResult}/>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">Analyse Temporelle</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                       <Bar yAxisId="left" dataKey="delays" name="Retards" fill={PRIMARY_COLOR} />
                       <Bar yAxisId="left" dataKey="advances" name="Avances" fill={ADVANCE_COLOR} />
                       <Line yAxisId="right" type="monotone" dataKey="avgDelay" name="Retard Moyen" stroke="#ff7300" dot={false} strokeWidth={2} />
                     </ComposedChart>
                  </ResponsiveContainer>
               </CardContent>
             </Card>
             <Card>
               <CardHeader>
                 <CardTitle className="flex items-center gap-2"><Clock/>Performance par Créneau</CardTitle>
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
                       <Bar yAxisId="left" dataKey="delays" name="Retards" fill={PRIMARY_COLOR} />
                       <Bar yAxisId="left" dataKey="advances" name="Avances" fill={ADVANCE_COLOR} />
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
                       <XAxis dataKey="range" fontSize={12} angle={-30} textAnchor="end" height={60} />
                       <YAxis />
                       <Tooltip />
                       <Bar dataKey="count" name="Nb. de Tâches">
                          {(analysisData.delayHistogram || []).map((entry, index) => (
                             <Cell key={`cell-${index}`} fill={entry.range.includes('retard') ? PRIMARY_COLOR : entry.range.includes('avance') ? ADVANCE_COLOR : '#a0aec0'} />
                          ))}
                       </Bar>
                     </BarChart>
                  </ResponsiveContainer>
               </CardContent>
             </Card>
        </div>
      </section>
      
      <section>
        <h2 className="text-2xl font-bold mb-4">Analyse des Anomalies de Tournées</h2>
        <div className="space-y-6">
        {(analysisData.overloadedTours || []).length > 0 && (
            <Card>
              <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="text-amber-500"/>
                      Dépassements de Charge
                  </CardTitle>
                  <CardDescription>
                      Tournées dont la charge réelle (poids) dépasse la capacité maximale du véhicule.
                  </CardDescription>
              </CardHeader>
              <CardContent>
                  <ScrollArea className="h-72">
                      <Table>
                          <TableHeader>
                              <TableRow>
                                  <TableHead className="cursor-pointer group" onClick={() => handleSort('overloaded', 'date')}>Date {renderSortIcon('overloaded', 'date')}</TableHead>
                                  <TableHead className="cursor-pointer group" onClick={() => handleSort('overloaded', 'nom')}>Tournée {renderSortIcon('overloaded', 'nom')}</TableHead>
                                  <TableHead className="cursor-pointer group" onClick={() => handleSort('overloaded', 'entrepot')}>Entrepôt {renderSortIcon('overloaded', 'entrepot')}</TableHead>
                                  <TableHead className="cursor-pointer group" onClick={() => handleSort('overloaded', 'livreur')}>Livreur {renderSortIcon('overloaded', 'livreur')}</TableHead>
                                  <TableHead>Poids Planifié</TableHead>
                                  <TableHead>Poids Réel</TableHead>
                                  <TableHead>Capacité Poids</TableHead>
                                  <TableHead className="cursor-pointer group" onClick={() => handleSort('overloaded', 'tauxDepassementPoids')}>Dépassement Poids {renderSortIcon('overloaded', 'tauxDepassementPoids')}</TableHead>
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                              {sortedData.overloadedTours?.map(tour => (
                                  <TableRow key={tour.uniqueId}>
                                      <TableCell>{formatDate(tour.date)}</TableCell>
                                      <TableCell>{tour.nom}</TableCell>
                                      <TableCell>{tour.entrepot}</TableCell>
                                      <TableCell>{tour.livreur}</TableCell>
                                      <TableCell>{tour.poidsPrevu.toFixed(2)} kg</TableCell>
                                      <TableCell className={cn(tour.depassementPoids > 0 && "font-bold text-destructive")}>
                                          {tour.poidsReel.toFixed(2)} kg
                                      </TableCell>
                                      <TableCell>{tour.capacitePoids.toFixed(2)} kg</TableCell>
                                      <TableCell className={cn(tour.depassementPoids > 0 && "font-semibold")}>
                                          {tour.depassementPoids > 0 ? `+${tour.depassementPoids.toFixed(2)} kg (${tour.tauxDepassementPoids.toFixed(1)}%)` : '-'}
                                      </TableCell>
                                  </TableRow>
                              ))}
                          </TableBody>
                      </Table>
                  </ScrollArea>
              </CardContent>
            </Card>
        )}

        {(analysisData.durationDiscrepancies || []).length > 0 && (
            <Card>
              <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                      <Timer className="text-blue-500"/>
                      Écarts de Durée de Service (Estimée vs. Réelle)
                  </CardTitle>
                  <CardDescription>
                      Comparaison de la durée entre la première et la dernière livraison de chaque tournée. Les écarts positifs importants sont affichés en premier.
                  </CardDescription>
              </CardHeader>
              <CardContent>
                  <ScrollArea className="h-72">
                      <Table>
                          <TableHeader>
                              <TableRow>
                                <TableHead className="cursor-pointer group" onClick={() => handleSort('duration', 'date')}>Date {renderSortIcon('duration', 'date')}</TableHead>
                                <TableHead className="cursor-pointer group" onClick={() => handleSort('duration', 'nom')}>Tournée {renderSortIcon('duration', 'nom')}</TableHead>
                                <TableHead className="cursor-pointer group" onClick={() => handleSort('duration', 'entrepot')}>Entrepôt {renderSortIcon('duration', 'entrepot')}</TableHead>
                                <TableHead className="cursor-pointer group" onClick={() => handleSort('duration', 'livreur')}>Livreur {renderSortIcon('duration', 'livreur')}</TableHead>
                                <TableHead className="text-center">Durée Estimée</TableHead>
                                <TableHead className="text-center">Durée Réelle</TableHead>
                                <TableHead className="cursor-pointer group" onClick={() => handleSort('duration', 'ecart')}>Écart {renderSortIcon('duration', 'ecart')}</TableHead>
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                              {sortedData.durationDiscrepancies?.map(tour => (
                                  <TableRow key={tour.uniqueId}>
                                      <TableCell>{formatDate(tour.date)}</TableCell>
                                      <TableCell>{tour.nom}</TableCell>
                                      <TableCell>{tour.entrepot}</TableCell>
                                      <TableCell>{tour.livreur}</TableCell>
                                      <TableCell className="text-center">{formatSecondsToTime(tour.dureeEstimee)}</TableCell>
                                      <TableCell className="text-center">{formatSecondsToTime(tour.dureeReelle)}</TableCell>
                                      <TableCell className={cn(tour.ecart > 300 ? "text-destructive font-semibold" : tour.ecart < -300 ? "text-blue-500 font-semibold" : "")}>
                                          {tour.ecart >= 0 ? '+' : ''}{formatSecondsToTime(tour.ecart)}
                                      </TableCell>
                                  </TableRow>
                              ))}
                          </TableBody>
                      </Table>
                  </ScrollArea>
              </CardContent>
            </Card>
        )}

        {(analysisData.lateStartAnomalies || []).length > 0 && (
            <Card>
              <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                      <Route className="text-violet-500"/>
                      Anomalie : Parties à l'Heure, Livrées en Retard
                  </CardTitle>
                  <CardDescription>
                      Tournées qui ont démarré à l'heure prévue mais qui ont accumulé des retards pendant la livraison.
                  </CardDescription>
              </CardHeader>
              <CardContent>
                  <ScrollArea className="h-72">
                      <Table>
                          <TableHeader>
                              <TableRow>
                                  <TableHead className="cursor-pointer group" onClick={() => handleSort('anomaly', 'date')}>Date {renderSortIcon('anomaly', 'date')}</TableHead>
                                  <TableHead className="cursor-pointer group" onClick={() => handleSort('anomaly', 'nom')}>Tournée {renderSortIcon('anomaly', 'nom')}</TableHead>
                                   <TableHead className="cursor-pointer group" onClick={() => handleSort('anomaly', 'entrepot')}>Entrepôt {renderSortIcon('anomaly', 'entrepot')}</TableHead>
                                  <TableHead className="cursor-pointer group" onClick={() => handleSort('anomaly', 'livreur')}>Livreur {renderSortIcon('anomaly', 'livreur')}</TableHead>
                                  <TableHead>Départ Prévu</TableHead>
                                  <TableHead>Départ Réel</TableHead>
                                  <TableHead>Écart au Départ</TableHead>
                                  <TableHead className="cursor-pointer group" onClick={() => handleSort('anomaly', 'tasksInDelay')}># Tâches en Retard {renderSortIcon('anomaly', 'tasksInDelay')}</TableHead>
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                              {sortedData.lateStartAnomalies?.map(tour => (
                                  <TableRow key={tour.uniqueId}>
                                      <TableCell>{formatDate(tour.date)}</TableCell>
                                      <TableCell>{tour.nom}</TableCell>
                                      <TableCell>{tour.entrepot}</TableCell>
                                      <TableCell>{tour.livreur}</TableCell>
                                      <TableCell>{formatSecondsToClock(tour.heureDepartPrevue)}</TableCell>
                                      <TableCell>{formatSecondsToClock(tour.heureDepartReelle)}</TableCell>
                                      <TableCell className="text-green-600 font-semibold">
                                          {formatSecondsToTime(tour.ecartDepart)}
                                      </TableCell>
                                      <TableCell className="font-bold">{tour.tasksInDelay}</TableCell>
                                  </TableRow>
                              ))}
                          </TableBody>
                      </Table>
                  </ScrollArea>
              </CardContent>
            </Card>
        )}
        </div>
      </section>

      <section>
         <h2 className="text-2xl font-bold mb-4">Analyse par Livreur & Zone Géographique</h2>
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Users />Synthèse par Livreur</CardTitle>
                    <CardDescription>Performances individuelles pour identifier les axes d'accompagnement.</CardDescription>
                </CardHeader>
                <CardContent>
                     <ScrollArea className="h-72">
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
                </CardContent>
            </Card>
             <Card>
              <CardHeader>
                  <CardTitle className="flex items-center gap-2"><MapPin />Analyse Comparative Géographique</CardTitle>
                  <CardDescription>Performances par secteur pour identifier les zones à problèmes.</CardDescription>
              </CardHeader>
              <CardContent>
                  <div className="flex justify-center mb-4 border-b">
                      <button onClick={() => setActiveTab('ville')} className={cn("px-4 py-2 text-sm font-medium -mb-px", activeTab === 'ville' ? "border-b-2 border-primary text-primary" : "text-muted-foreground")}>Par Ville</button>
                      <button onClick={() => setActiveTab('codePostal')} className={cn("px-4 py-2 text-sm font-medium -mb-px", activeTab === 'codePostal' ? "border-b-2 border-primary text-primary" : "text-muted-foreground")}>Par Code Postal</button>
                  </div>
                  <ScrollArea className="h-72">
                      <Table>
                          <TableHeader>
                              <TableRow>
                                  <TableHead className="cursor-pointer group" onClick={() => handleSort('geo', 'key')}>Secteur {renderSortIcon('geo', 'key')}</TableHead>
                                  <TableHead className="cursor-pointer group" onClick={() => handleSort('geo', 'totalTasks')}>Tâches {renderSortIcon('geo', 'totalTasks')}</TableHead>
                                  <TableHead className="cursor-pointer group" onClick={() => handleSort('geo', 'punctualityRateRealized')}>Ponctualité {renderSortIcon('geo', 'punctualityRateRealized')}</TableHead>
                                  <TableHead className="cursor-pointer group" onClick={() => handleSort('geo', 'lateWithBadReviewPercentage')}>% Insat. sur Retard {renderSortIcon('geo', 'lateWithBadReviewPercentage')}</TableHead>
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                              {geoDataToDisplay?.map(item => (
                                  <TableRow key={item.key}>
                                      <TableCell>{item.key}</TableCell>
                                      <TableCell>{item.totalTasks}</TableCell>
                                      <TableCell><span className={cn(item.punctualityRateRealized < item.punctualityRatePlanned - 2 && "text-destructive font-bold")}>{item.punctualityRateRealized.toFixed(1)}%</span><span className="text-xs text-muted-foreground"> ({item.punctualityRatePlanned.toFixed(1)}%)</span></TableCell>
                                      <TableCell>{item.lateWithBadReviewPercentage.toFixed(1)}%</TableCell>
                                  </TableRow>
                              ))}
                          </TableBody>
                      </Table>
                  </ScrollArea>
              </CardContent>
             </Card>
         </div>
      </section>

       <section>
        <h2 className="text-2xl font-bold mb-4">Analyse de la Charge de Travail</h2>
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                  <span>Nb. moyen de tâches / livreur.</span>
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
                    <YAxis label={{ value: 'Tâches / Livreur', angle: -90, position: 'insideLeft' }}/>
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="avgPlanned" name="Planifié / Livreur" stroke={ACCENT_COLOR} fill={ACCENT_COLOR} fillOpacity={0.3} />
                    <Area type="monotone" dataKey="avgReal" name="Réalisé / Livreur" stroke={PRIMARY_COLOR} fill={PRIMARY_COLOR} fillOpacity={0.3} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
         </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">Analyse Détaillée des Écarts</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Frown className="text-destructive"/>Répartition des Retards par Heure</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={analysisData.delaysByHour} onClick={(e) => handleBarClick(e, 'heure')}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill={PRIMARY_COLOR} name="Nb. Retards" className="cursor-pointer" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><MapPin className="text-destructive"/>Répartition des Retards par Entrepôt</CardTitle>
              </CardHeader>
              <CardContent>
                  <ScrollArea className="h-80">
                    <ResponsiveContainer width="100%" height={(analysisData.delaysByWarehouse || []).length * 30}>
                      <BarChart data={analysisData.delaysByWarehouse} layout="vertical" margin={{ left: 80 }} onClick={(e) => handleBarClick(e, 'entrepot')}>
                          <XAxis type="number" />
                          <YAxis dataKey="key" type="category" width={100} tickLine={false} axisLine={false} tick={CustomYAxisTick} />
                          <Tooltip cursor={{fill: 'rgba(206, 206, 206, 0.2)'}} />
                          <Bar dataKey="count" name="Retards" barSize={20} fill={PRIMARY_COLOR} className="cursor-pointer">
                          </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </ScrollArea>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><MapPin className="text-destructive"/>Top 10 Villes (Retards)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                   <BarChart data={(analysisData.delaysByCity || []).slice(0,10).reverse()} layout="vertical" margin={{ left: 80 }} onClick={(e) => handleBarClick(e, 'city')}>
                      <XAxis type="number" />
                      <YAxis dataKey="key" type="category" tickLine={false} axisLine={false} />
                      <Tooltip cursor={{fill: 'rgba(206, 206, 206, 0.2)'}}/>
                      <Bar dataKey="count" name="Retards" barSize={20} fill={PRIMARY_COLOR} className="cursor-pointer">
                      </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Smile style={{color: ADVANCE_COLOR}} />Répartition des Avances par Heure</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={analysisData.advancesByHour}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill={ADVANCE_COLOR} name="Nb. Avances" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
             <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><MapPin style={{color: ADVANCE_COLOR}}/>Répartition des Avances par Entrepôt</CardTitle>
              </CardHeader>
              <CardContent>
                  <ScrollArea className="h-80">
                    <ResponsiveContainer width="100%" height={(analysisData.advancesByWarehouse || []).length * 30}>
                      <BarChart data={analysisData.advancesByWarehouse} layout="vertical" margin={{ left: 80 }}>
                          <XAxis type="number" />
                          <YAxis dataKey="key" type="category" width={100} tickLine={false} axisLine={false} tick={CustomYAxisTick} />
                          <Tooltip cursor={{fill: 'rgba(206, 206, 206, 0.2)'}} />
                          <Bar dataKey="count" name="Avances" barSize={20} fill={ADVANCE_COLOR}>
                          </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </ScrollArea>
              </CardContent>
            </Card>
             <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><MapPin style={{color: ADVANCE_COLOR}}/>Top 10 Villes (Avances)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                   <BarChart data={(analysisData.advancesByCity || []).slice(0,10).reverse()} layout="vertical" margin={{ left: 80 }}>
                      <XAxis type="number" />
                      <YAxis dataKey="key" type="category" tickLine={false} axisLine={false} />
                      <Tooltip cursor={{fill: 'rgba(206, 206, 206, 0.2)'}}/>
                      <Bar dataKey="count" name="Avances" barSize={20} fill={ADVANCE_COLOR} className="cursor-pointer">
                      </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><MapPin className="text-destructive"/>Top 10 Codes Postaux (Retards)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                   <BarChart data={(analysisData.delaysByPostalCode || []).slice(0,10).reverse()} layout="vertical" margin={{ left: 60 }} onClick={(e) => handleBarClick(e, 'codePostal')}>
                      <XAxis type="number" />
                      <YAxis dataKey="key" type="category" tickLine={false} axisLine={false} />
                      <Tooltip cursor={{fill: 'rgba(206, 206, 206, 0.2)'}}/>
                      <Bar dataKey="count" name="Retards" barSize={20} fill={PRIMARY_COLOR} className="cursor-pointer">
                      </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><MapPin style={{color: ADVANCE_COLOR}}/>Top 10 Codes Postaux (Avances)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                   <BarChart data={(analysisData.advancesByPostalCode || []).slice(0,10).reverse()} layout="vertical" margin={{ left: 60 }}>
                      <XAxis type="number" />
                      <YAxis dataKey="key" type="category" tickLine={false} axisLine={false} />
                      <Tooltip cursor={{fill: 'rgba(206, 206, 206, 0.2)'}}/>
                      <Bar dataKey="count" name="Avances" barSize={20} fill={ADVANCE_COLOR} className="cursor-pointer">
                      </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
        </div>
      </section>
    </div>
  );
}
