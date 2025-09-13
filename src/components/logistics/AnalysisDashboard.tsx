'use client';
import { KpiCard, ComparisonKpiCard } from './KpiCard';
import type { AnalysisData, MergedData } from '@/lib/types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, LineChart, Line, AreaChart, Area } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AiAnalysis from './AiAnalysis';
import { AlertTriangle, Info, Clock, MapPin, UserCheck, Timer, Weight, Smile } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useState } from 'react';

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

export default function AnalysisDashboard({ analysisData, onFilterAndSwitch, allData }: AnalysisDashboardProps) {
  const [activeTab, setActiveTab] = useState('poids');

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
  
  const overloadedByWeight = analysisData.overloadedTours.filter(t => t.depassementPoids > 0);
  const overloadedByBins = analysisData.overloadedTours.filter(t => t.depassementBacs > 0);

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-bold mb-4">KPIs Généraux</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-4">
          {analysisData.generalKpis.map(kpi => <KpiCard key={kpi.title} {...kpi} />)}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">Synthèse des Écarts Principaux : Planifié vs. Réalisé</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {analysisData.discrepancyKpis.map(kpi => <ComparisonKpiCard key={kpi.title} {...kpi} />)}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Impact sur la Qualité de Service</CardTitle>
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
                    Dépassements de Poids / Bacs
                </CardTitle>
                <CardDescription>
                    Tournées dont la charge réelle dépasse la capacité maximale du véhicule.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Tournée</TableHead>
                            <TableHead>Livreur</TableHead>
                            <TableHead>Capacité Poids</TableHead>
                            <TableHead>Poids Réel</TableHead>
                            <TableHead>Dépassement Poids</TableHead>
                            <TableHead>Capacité Bacs</TableHead>
                            <TableHead>Bacs Réels</TableHead>
                            <TableHead>Dépassement Bacs</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {analysisData.overloadedTours.slice(0,10).map(tour => (
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
                    Analyse des Écarts de Durée (Calculée vs. Estimée)
                </CardTitle>
                <CardDescription>
                    Comparaison entre la durée opérationnelle estimée et la durée réelle mesurée sur le terrain.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Tournée</TableHead>
                            <TableHead>Livreur</TableHead>
                            <TableHead>Estimée (Urbantz)</TableHead>
                            <TableHead>Réelle (Tâches)</TableHead>
                            <TableHead>Écart</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {analysisData.durationDiscrepancies.slice(0,10).map(tour => (
                            <TableRow key={tour.uniqueId}>
                                <TableCell>{tour.nom}</TableCell>
                                <TableCell>{tour.livreur}</TableCell>
                                <TableCell>{formatSecondsToTime(tour.dureeEstimee)}</TableCell>
                                <TableCell>{formatSecondsToTime(tour.dureeReelle)}</TableCell>
                                <TableCell className={cn(tour.ecart > 0 && "text-destructive font-semibold")}>
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
                    <UserCheck className="text-violet-500"/>
                    Anomalie : Parties à l'Heure, Livrées en Retard
                </CardTitle>
                <CardDescription>
                    Tournées qui ont démarré à l'heure prévue (ou en avance) mais qui ont accumulé des retards pendant la livraison.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Tournée</TableHead>
                            <TableHead>Livreur</TableHead>
                            <TableHead>Départ Prévu</TableHead>
                            <TableHead>Départ Réel</TableHead>
                            <TableHead>Écart au Départ</TableHead>
                            <TableHead>Tâches en Retard</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {analysisData.lateStartAnomalies.slice(0,5).map(tour => (
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
          <CardHeader><CardTitle>Synthèse par Livreur (Top 10)</CardTitle></CardHeader>
          <CardContent>
               <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Livreur</TableHead>
                            <TableHead>Nb. Tournées</TableHead>
                            <TableHead>Ponctualité</TableHead>
                            <TableHead>Retard Moyen (min)</TableHead>
                            <TableHead>Dépassements Poids</TableHead>
                            <TableHead>Notation Moy.</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {analysisData.performanceByDriver.slice(0, 10).map(driver => (
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
            <CardHeader><CardTitle>Analyse Comparative Géographique</CardTitle></CardHeader>
            <CardContent>
                <div className="flex justify-center mb-4">
                    <button onClick={() => setActiveTab('ville')} className={cn("px-4 py-2 text-sm font-medium", activeTab === 'ville' ? "border-b-2 border-primary text-primary" : "text-muted-foreground")}>Par Ville</button>
                    <button onClick={() => setActiveTab('codePostal')} className={cn("px-4 py-2 text-sm font-medium", activeTab === 'codePostal' ? "border-b-2 border-primary text-primary" : "text-muted-foreground")}>Par Code Postal</button>
                </div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Secteur</TableHead>
                            <TableHead>Tâches Totales</TableHead>
                            <TableHead>Taux Ponctualité</TableHead>
                            <TableHead>Nb. Retards</TableHead>
                            <TableHead>Retard Moyen (min)</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {(activeTab === 'ville' ? analysisData.performanceByCity : analysisData.performanceByPostalCode).slice(0, 10).map(item => (
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
              <CardTitle>Charge Moyenne par Livreur par Heure</CardTitle>
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
              <CardTitle className="flex items-center gap-2"><Clock />Répartition des Retards par Heure</CardTitle>
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
