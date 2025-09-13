'use client';
import { KpiCard, ComparisonKpiCard } from './KpiCard';
import type { AnalysisData, MergedData, OverloadedTourInfo, DurationDiscrepancy, LateStartAnomaly, PerformanceByDriver, PerformanceByGeo } from '@/lib/types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, AreaChart, Area } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AiAnalysis from './AiAnalysis';
import { AlertTriangle, Info, Clock, MapPin, UserCheck, Timer, Smile, Frown, PackageCheck, Route, ArrowUpDown } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useState, useMemo } from 'react';

interface AnalysisDashboardProps {
  analysisData: AnalysisData | null;
  onFilterAndSwitch: (filter: Record<string, any>) => void;
  allData: MergedData[];
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

type SortConfig<T> = {
    key: keyof T;
    direction: 'asc' | 'desc';
} | null;

export default function AnalysisDashboard({ analysisData, onFilterAndSwitch, allData }: AnalysisDashboardProps) {
  const [activeTab, setActiveTab] = useState('ville');
  const [sorts, setSorts] = useState<{ [key: string]: SortConfig<any> }>({
      overloaded: { key: 'tauxDepassementPoids', direction: 'desc' },
      duration: { key: 'ecart', direction: 'desc' },
      anomaly: { key: 'tasksInDelay', direction: 'desc' },
      driver: { key: 'totalTours', direction: 'desc' },
      geo: { key: 'totalDelays', direction: 'desc' },
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
    if (!analysisData) return {};
    
    const sortFn = <T,>(data: T[], config: SortConfig<T>): T[] => {
        if (!config) return data;
        return [...data].sort((a, b) => {
            const aValue = a[config.key];
            const bValue = b[config.key];
            if (aValue == null) return 1;
            if (bValue == null) return -1;

            let comparison = 0;
            if (typeof aValue === 'number' && typeof bValue === 'number') {
                comparison = aValue - bValue;
            } else {
                comparison = String(aValue).localeCompare(String(bValue));
            }
            
            // For duration discrepancy, sort by absolute value
            if (config.key === 'ecart') {
                comparison = Math.abs(bValue as number) - Math.abs(aValue as number);
            }

            return config.direction === 'asc' ? comparison : -comparison;
        });
    }
    
    return {
      overloadedTours: sortFn<OverloadedTourInfo>(analysisData.overloadedTours, sorts.overloaded),
      durationDiscrepancies: sortFn<DurationDiscrepancy>(analysisData.durationDiscrepancies, sorts.duration),
      lateStartAnomalies: sortFn<LateStartAnomaly>(analysisData.lateStartAnomalies, sorts.anomaly),
      performanceByDriver: sortFn<PerformanceByDriver>(analysisData.performanceByDriver, sorts.driver),
      performanceByCity: sortFn<PerformanceByGeo>(analysisData.performanceByCity, sorts.geo),
      performanceByPostalCode: sortFn<PerformanceByGeo>(analysisData.performanceByPostalCode, sorts.geo),
    };
  }, [analysisData, sorts]);

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

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-bold mb-4">KPIs Généraux & Satisfaction Client</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-4">
          {analysisData.generalKpis.map(kpi => <KpiCard key={kpi.title} {...kpi} />)}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">Synthèse des Écarts : Planifié vs. Réalisé</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {analysisData.discrepancyKpis.map(kpi => <ComparisonKpiCard key={kpi.title} {...kpi} />)}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Impact des Écarts sur la Qualité</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {analysisData.qualityKpis.map(kpi => <KpiCard variant="inline" key={kpi.title} {...kpi} />)}
          </CardContent>
        </Card>
        <div className="lg:col-span-2">
            <AiAnalysis allData={allData} />
        </div>
      </div>
       
      {analysisData.overloadedTours.length > 0 && (
          <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="text-amber-500"/>
                    Analyse des Dépassements de Charge
                </CardTitle>
                <CardDescription>
                    Tournées dont la charge réelle (poids ou volume) dépasse la capacité maximale du véhicule.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="cursor-pointer group" onClick={() => handleSort('overloaded', 'nom')}>Tournée {renderSortIcon('overloaded', 'nom')}</TableHead>
                            <TableHead className="cursor-pointer group" onClick={() => handleSort('overloaded', 'livreur')}>Livreur {renderSortIcon('overloaded', 'livreur')}</TableHead>
                            <TableHead>Capacité Poids</TableHead>
                            <TableHead>Poids Réel</TableHead>
                            <TableHead className="cursor-pointer group" onClick={() => handleSort('overloaded', 'tauxDepassementPoids')}>Dépassement Poids {renderSortIcon('overloaded', 'tauxDepassementPoids')}</TableHead>
                            <TableHead>Capacité Bacs</TableHead>
                            <TableHead>Bacs Réels</TableHead>
                            <TableHead className="cursor-pointer group" onClick={() => handleSort('overloaded', 'tauxDepassementBacs')}>Dépassement Bacs {renderSortIcon('overloaded', 'tauxDepassementBacs')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedData.overloadedTours?.slice(0,10).map(tour => (
                            <TableRow key={tour.uniqueId}>
                                <TableCell>{tour.nom}</TableCell>
                                <TableCell>{tour.livreur}</TableCell>
                                <TableCell>{tour.capacitePoids.toFixed(2)} kg</TableCell>
                                <TableCell className={cn(tour.depassementPoids > 0 && "font-bold text-destructive")}>
                                    {tour.poidsReel.toFixed(2)} kg
                                </TableCell>
                                <TableCell className={cn(tour.depassementPoids > 0 && "font-semibold")}>
                                    {tour.depassementPoids > 0 ? `+${tour.depassementPoids.toFixed(2)} kg (${tour.tauxDepassementPoids.toFixed(1)}%)` : '-'}
                                </TableCell>
                                <TableCell>{tour.capaciteBacs} bacs</TableCell>
                                 <TableCell className={cn(tour.depassementBacs > 0 && "font-bold text-destructive")}>
                                    {tour.bacsReels} bacs
                                </TableCell>
                                <TableCell className={cn(tour.depassementBacs > 0 && "font-semibold")}>
                                    {tour.depassementBacs > 0 ? `+${tour.depassementBacs} bacs (${tour.tauxDepassementBacs.toFixed(1)}%)` : '-'}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
          </Card>
      )}

      {analysisData.durationDiscrepancies.length > 0 && (
          <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Timer className="text-blue-500"/>
                    Analyse des Écarts de Durée (Estimée vs. Réelle)
                </CardTitle>
                <CardDescription>
                    Comparaison entre la durée opérationnelle estimée (via Urbantz) et la durée réelle mesurée sur le terrain.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="cursor-pointer group" onClick={() => handleSort('duration', 'nom')}>Tournée {renderSortIcon('duration', 'nom')}</TableHead>
                            <TableHead className="cursor-pointer group" onClick={() => handleSort('duration', 'livreur')}>Livreur {renderSortIcon('duration', 'livreur')}</TableHead>
                            <TableHead>Estimée (Urbantz)</TableHead>
                            <TableHead>Réelle (Tâches)</TableHead>
                            <TableHead className="cursor-pointer group" onClick={() => handleSort('duration', 'ecart')}>Écart {renderSortIcon('duration', 'ecart')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedData.durationDiscrepancies?.slice(0,10).map(tour => (
                            <TableRow key={tour.uniqueId}>
                                <TableCell>{tour.nom}</TableCell>
                                <TableCell>{tour.livreur}</TableCell>
                                <TableCell>{formatSecondsToTime(tour.dureeEstimee)}</TableCell>
                                <TableCell>{formatSecondsToTime(tour.dureeReelle)}</TableCell>
                                <TableCell className={cn(tour.ecart > 0 ? "text-destructive font-semibold" : tour.ecart < 0 ? "text-blue-500 font-semibold" : "")}>
                                    {tour.ecart > 0 ? '+' : ''}{formatSecondsToTime(tour.ecart)}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
          </Card>
      )}

      {analysisData.lateStartAnomalies.length > 0 && (
          <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Route className="text-violet-500"/>
                    Anomalie : Parties à l'Heure, Livrées en Retard
                </CardTitle>
                <CardDescription>
                    Tournées qui ont démarré à l'heure prévue mais qui ont accumulé des retards pendant la livraison, indiquant des problèmes sur la route.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="cursor-pointer group" onClick={() => handleSort('anomaly', 'nom')}>Tournée {renderSortIcon('anomaly', 'nom')}</TableHead>
                            <TableHead className="cursor-pointer group" onClick={() => handleSort('anomaly', 'livreur')}>Livreur {renderSortIcon('anomaly', 'livreur')}</TableHead>
                            <TableHead>Départ Prévu</TableHead>
                            <TableHead>Départ Réel</TableHead>
                            <TableHead>Écart au Départ</TableHead>
                            <TableHead className="cursor-pointer group" onClick={() => handleSort('anomaly', 'tasksInDelay')}># Tâches en Retard {renderSortIcon('anomaly', 'tasksInDelay')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedData.lateStartAnomalies?.slice(0,5).map(tour => (
                            <TableRow key={tour.uniqueId}>
                                <TableCell>{tour.nom}</TableCell>
                                <TableCell>{tour.livreur}</TableCell>
                                <TableCell>{new Date(tour.heureDepartPrevue * 1000).toISOString().substr(11, 8)}</TableCell>
                                <TableCell>{new Date(tour.heureDepartReelle * 1000).toISOString().substr(11, 8)}</TableCell>
                                <TableCell className="text-green-600 font-semibold">
                                    {formatSecondsToTime(tour.ecartDepart)}
                                </TableCell>
                                <TableCell className="font-bold">{tour.tasksInDelay}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
          </Card>
      )}

      <Card>
          <CardHeader>
              <CardTitle>Synthèse par Livreur</CardTitle>
              <CardDescription>Performances individuelles pour identifier les top-performers et les axes d'accompagnement.</CardDescription>
          </CardHeader>
          <CardContent>
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
                        {sortedData.performanceByDriver?.slice(0, 10).map(driver => (
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
          </CardContent>
      </Card>

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
           <Card>
            <CardHeader>
                <CardTitle>Analyse Comparative Géographique</CardTitle>
                <CardDescription>Performances par secteur pour identifier les zones à problèmes.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex justify-center mb-4">
                    <button onClick={() => setActiveTab('ville')} className={cn("px-4 py-2 text-sm font-medium", activeTab === 'ville' ? "border-b-2 border-primary text-primary" : "text-muted-foreground")}>Par Ville</button>
                    <button onClick={() => setActiveTab('codePostal')} className={cn("px-4 py-2 text-sm font-medium", activeTab === 'codePostal' ? "border-b-2 border-primary text-primary" : "text-muted-foreground")}>Par Code Postal</button>
                </div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="cursor-pointer group" onClick={() => handleSort('geo', 'key')}>Secteur {renderSortIcon('geo', 'key')}</TableHead>
                            <TableHead className="cursor-pointer group" onClick={() => handleSort('geo', 'totalTasks')}>Tâches Totales {renderSortIcon('geo', 'totalTasks')}</TableHead>
                            <TableHead className="cursor-pointer group" onClick={() => handleSort('geo', 'punctualityRate')}>Taux Ponctualité {renderSortIcon('geo', 'punctualityRate')}</TableHead>
                            <TableHead className="cursor-pointer group" onClick={() => handleSort('geo', 'totalDelays')}>Nb. Retards {renderSortIcon('geo', 'totalDelays')}</TableHead>
                            <TableHead className="cursor-pointer group" onClick={() => handleSort('geo', 'avgDelay')}>Retard Moyen (min) {renderSortIcon('geo', 'avgDelay')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {geoDataToDisplay?.slice(0, 10).map(item => (
                            <TableRow key={item.key}>
                                <TableCell>{item.key}</TableCell>
                                <TableCell>{item.totalTasks}</TableCell>
                                <TableCell>{item.punctualityRate.toFixed(1)}%</TableCell>
                                <TableCell>{item.totalDelays}</TableCell>
                                <TableCell>{item.avgDelay.toFixed(1)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
           </Card>
           <Card>
            <CardHeader>
              <CardTitle>Charge de Travail par Heure</CardTitle>
              <CardDescription>Comparaison du volume de tâches planifiées et réalisées au fil de la journée.</CardDescription>
            </CardHeader>
            <CardContent>
               <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={analysisData.workloadByHour}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="planned" name="Planifié" stroke={ACCENT_COLOR} fill={ACCENT_COLOR} fillOpacity={0.3} />
                    <Area type="monotone" dataKey="real" name="Réalisé" stroke={PRIMARY_COLOR} fill={PRIMARY_COLOR} fillOpacity={0.3} />
                  </AreaChart>
               </ResponsiveContainer>
            </CardContent>
          </Card>
           <Card>
            <CardHeader>
              <CardTitle>Intensité du Travail par Heure</CardTitle>
               <CardDescription>Nombre moyen de tâches gérées par livreur à chaque heure.</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={analysisData.avgWorkloadByDriverByHour}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="avgLoad" fill={PRIMARY_COLOR} name="Tâches / Livreur" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
           <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Frown style={{color: PRIMARY_COLOR}} />Répartition des Retards par Heure</CardTitle>
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
              <CardTitle className="flex items-center gap-2"><MapPin/>Répartition des Retards par Entrepôt</CardTitle>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-80">
                  <ResponsiveContainer width="100%" height={analysisData.delaysByWarehouse.length * 30}>
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
              <CardTitle className="flex items-center gap-2"><MapPin/>Top 10 Villes avec le Plus de Retards</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                 <BarChart data={analysisData.delaysByCity.slice(0,10).reverse()} layout="vertical" margin={{ left: 80 }} onClick={(e) => handleBarClick(e, 'city')}>
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
              <CardTitle className="flex items-center gap-2"><MapPin/>Top 10 Codes Postaux avec le Plus de Retards</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                 <BarChart data={analysisData.delaysByPostalCode.slice(0,10).reverse()} layout="vertical" margin={{ left: 60 }} onClick={(e) => handleBarClick(e, 'codePostal')}>
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
              <CardTitle className="flex items-center gap-2"><MapPin/>Répartition des Avances par Entrepôt</CardTitle>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-80">
                  <ResponsiveContainer width="100%" height={analysisData.advancesByWarehouse.length * 30}>
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
      </div>
    </div>
  );
}
