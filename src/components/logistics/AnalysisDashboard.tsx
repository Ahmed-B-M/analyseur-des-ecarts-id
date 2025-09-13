'use client';
import { KpiCard, ComparisonKpiCard } from './KpiCard';
import type { AnalysisData, MergedData } from '@/lib/types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AiAnalysis from './AiAnalysis';
import { AlertTriangle, Info, Package, Weight } from 'lucide-react';

interface AnalysisDashboardProps {
  analysisData: AnalysisData | null;
  onFilterAndSwitch: (filter: Record<string, any>) => void;
  allData: MergedData[];
}

const COLORS = ['#0033A0', '#E4002B', '#FFBB28', '#FF8042', '#00C49F'];

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

  const handleBarClick = (data: any) => {
    if (data && data.activePayload && data.activePayload[0]) {
      const payload = data.activePayload[0].payload;
      if(payload.warehouse) {
        onFilterAndSwitch({ entrepot: payload.warehouse });
      } else if (payload.key && analysisData.performanceByCity.some(c => c.key === payload.key)) {
         onFilterAndSwitch({ city: payload.key });
      }
    }
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
              <CardTitle>Top 5 Villes par Nombre de Tâches</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analysisData.performanceByCity.slice(0, 5)} onClick={handleBarClick} className="cursor-pointer">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="key" />
                  <YAxis yAxisId="left" orientation="left" stroke="var(--color-chart-1)" />
                  <YAxis yAxisId="right" orientation="right" stroke="var(--color-chart-2)" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="totalTasks" fill="hsl(var(--chart-1))" name="Nb. Tâches" />
                  <Bar yAxisId="right" dataKey="avgDelay" fill="hsl(var(--chart-2))" name="Retard moyen (min)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Retards par Entrepôt</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                 <BarChart data={analysisData.delaysByWarehouse} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="warehouse" type="category" width={80} tick={{fontSize: 12}} />
                    <Tooltip />
                    <Bar dataKey="count" name="Nombre de retards">
                        {analysisData.delaysByWarehouse.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
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
                    Tournées en Surcharge de Poids
                </CardTitle>
                <CardDescription>
                    Tournées dont le poids réel des tâches dépasse la capacité maximale du véhicule.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Tournée</TableHead>
                            <TableHead>Livreur</TableHead>
                            <TableHead>Capacité (kg)</TableHead>
                            <TableHead>Poids Réel (kg)</TableHead>
                            <TableHead>Dépassement</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {analysisData.overloadedTours.slice(0,5).map(tour => (
                            <TableRow key={tour.uniqueId}>
                                <TableCell>{tour.nom}</TableCell>
                                <TableCell>{tour.livreur}</TableCell>
                                <TableCell>{tour.capacitePoids.toFixed(2)}</TableCell>
                                <TableCell className="font-bold text-destructive">
                                    {tour.poidsReel.toFixed(2)}
                                </TableCell>
                                <TableCell className="font-semibold">
                                    +{tour.depassementPoids.toFixed(2)} kg ({tour.tauxDepassementPoids.toFixed(1)}%)
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
