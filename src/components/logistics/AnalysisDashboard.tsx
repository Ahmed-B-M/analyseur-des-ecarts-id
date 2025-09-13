'use client';
import { KpiCard, ComparisonKpiCard } from './KpiCard';
import type { AnalysisData, MergedData } from '@/lib/types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AiAnalysis from './AiAnalysis';
import { AlertTriangle, Info, Clock, MapPin } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface AnalysisDashboardProps {
  analysisData: AnalysisData | null;
  onFilterAndSwitch: (filter: Record<string, any>) => void;
  allData: MergedData[];
}

const ACCENT_COLOR = "hsl(var(--accent))";

export default function AnalysisDashboard({ analysisData, onFilterAndSwitch, allData }: AnalysisDashboardProps) {
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

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-bold mb-4">KPIs Généraux</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {analysisData.generalKpis.map(kpi => <KpiCard key={kpi.title} {...kpi} />)}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">Comparaison Planifié vs. Réel</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {analysisData.discrepancyKpis.map(kpi => <ComparisonKpiCard key={kpi.title} {...kpi} />)}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Qualité & Avis Clients</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {analysisData.qualityKpis.map(kpi => <KpiCard variant="inline" key={kpi.title} {...kpi} />)}
          </CardContent>
        </Card>
        <div className="lg:col-span-2">
            <AiAnalysis allData={allData} />
        </div>
      </div>

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><MapPin/>Répartition des Retards par Entrepôt</CardTitle>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-80">
                  <ResponsiveContainer width="100%" height={analysisData.delaysByWarehouse.length * 30}>
                    <BarChart data={analysisData.delaysByWarehouse} layout="vertical" margin={{ left: 80 }}>
                        <XAxis type="number" />
                        <YAxis dataKey="key" type="category" width={100} tickLine={false} axisLine={false} tick={CustomYAxisTick} />
                        <Tooltip cursor={{fill: 'rgba(206, 206, 206, 0.2)'}} />
                        <Bar dataKey="count" name="Retards" barSize={20} fill={ACCENT_COLOR}>
                        </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ScrollArea>
            </CardContent>
          </Card>
           <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Clock />Répartition des Retards par Heure</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={analysisData.delaysByHour}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill={ACCENT_COLOR} name="Nb. Retards" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><MapPin/>Top 10 Villes avec le Plus de Retards</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                 <BarChart data={analysisData.delaysByCity.slice(0,10).reverse()} layout="vertical" margin={{ left: 80 }}>
                    <XAxis type="number" />
                    <YAxis dataKey="key" type="category" tickLine={false} axisLine={false} />
                    <Tooltip cursor={{fill: 'rgba(206, 206, 206, 0.2)'}}/>
                    <Bar dataKey="count" name="Retards" barSize={20} fill={ACCENT_COLOR}>
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
                 <BarChart data={analysisData.delaysByPostalCode.slice(0,10).reverse()} layout="vertical" margin={{ left: 60 }}>
                    <XAxis type="number" />
                    <YAxis dataKey="key" type="category" tickLine={false} axisLine={false} />
                    <Tooltip cursor={{fill: 'rgba(206, 206, 206, 0.2)'}}/>
                    <Bar dataKey="count" name="Retards" barSize={20} fill={ACCENT_COLOR}>
                    </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
      </div>
      
      {analysisData.overloadedTours.length > 0 && (
          <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="text-amber-500"/>
                    Tournées en Surcharge
                </CardTitle>
                <CardDescription>
                    Tournées dont le poids réel ou le nombre de bacs dépasse la capacité maximale du véhicule.
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
                        {analysisData.overloadedTours.slice(0,5).map(tour => (
                            <TableRow key={tour.uniqueId}>
                                <TableCell>{tour.nom}</TableCell>
                                <TableCell>{tour.livreur}</TableCell>
                                <TableCell>{tour.capacitePoids.toFixed(2)} kg</TableCell>
                                <TableCell className={cn(tour.poidsReel > tour.capacitePoids && "font-bold text-destructive")}>
                                    {tour.poidsReel.toFixed(2)} kg
                                </TableCell>
                                <TableCell className={cn(tour.poidsReel > tour.capacitePoids && "font-semibold")}>
                                    {tour.depassementPoids > 0 ? `+${tour.depassementPoids.toFixed(2)} kg (${tour.tauxDepassementPoids.toFixed(1)}%)` : '-'}
                                </TableCell>
                                <TableCell>{tour.capaciteBacs} bacs</TableCell>
                                 <TableCell className={cn(tour.bacsReels > tour.capaciteBacs && "font-bold text-destructive")}>
                                    {tour.bacsReels} bacs
                                </TableCell>
                                <TableCell className={cn(tour.bacsReels > tour.capaciteBacs && "font-semibold")}>
                                    {tour.depassementBacs > 0 ? `+${tour.depassementBacs} bacs (${tour.tauxDepassementBacs.toFixed(1)}%)` : '-'}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
          </Card>
      )}

      <Card>
          <CardHeader><CardTitle>Performance par Livreur (Top 10)</CardTitle></CardHeader>
          <CardContent>
               <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Livreur</TableHead>
                            <TableHead>Taux de Ponctualité</TableHead>
                            <TableHead>Retard Moyen (min)</TableHead>
                            <TableHead>Notation Moyenne</TableHead>
                            <TableHead>Nb Tâches</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {analysisData.performanceByDriver.slice(0, 10).map(driver => (
                            <TableRow key={driver.key}>
                                <TableCell>{driver.key}</TableCell>
                                <TableCell>{driver.punctualityRate.toFixed(1)}%</TableCell>
                                <TableCell>{driver.avgDelay.toFixed(1)}</TableCell>
                                <TableCell>{driver.avgRating?.toFixed(2) || 'N/A'}</TableCell>
                                <TableCell>{driver.totalTasks}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
          </CardContent>
      </Card>

    </div>
  );
}
