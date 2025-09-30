
'use client';
import { useMemo, useState } from 'react';
import type { GlobalSummary, OverloadedTourInfo, DurationDiscrepancy, LateStartAnomaly } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import { Tooltip as UiTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface AnomaliesSectionProps {
  globalSummary: GlobalSummary;
  overloadedTours: OverloadedTourInfo[];
  durationDiscrepancies: DurationDiscrepancy[];
  lateStartAnomalies: LateStartAnomaly[];
  totalTours: number;
}

type SortConfig<T> = {
    key: keyof T;
    direction: 'asc' | 'desc';
} | null;

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

export function AnomaliesSection({
  globalSummary,
  overloadedTours,
  durationDiscrepancies,
  lateStartAnomalies,
  totalTours
}: AnomaliesSectionProps) {
  const [sorts, setSorts] = useState<{ [key: string]: SortConfig<any> }>({
      overloaded: { key: 'tauxDepassementPoids', direction: 'desc' },
      duration: { key: 'ecart', direction: 'desc' },
      anomaly: { key: 'tasksInDelay', direction: 'desc' },
  });

  const sortedData = useMemo(() => {
    const sortFn = <T,>(data: T[] | undefined, config: SortConfig<T>): T[] => {
        if (!data) return [];
        if (!config) return data;

        const sorted = [...data].sort((a, b) => {
            const aValue = a[config.key];
            const bValue = b[config.key];
            if (aValue == null) return 1;
            if (bValue == null) return -1;
            if (typeof aValue === 'number' && typeof bValue === 'number') {
                return config.direction === 'asc' ? aValue - bValue : bValue - aValue;
            }
            if (typeof aValue === 'string' && typeof bValue === 'string') {
                return config.direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
            }
            return 0;
        });
        return sorted;
    }
    
    return {
      overloadedTours: sortFn<OverloadedTourInfo>(overloadedTours, sorts.overloaded),
      durationDiscrepancies: sortFn<DurationDiscrepancy>(durationDiscrepancies, sorts.duration),
      lateStartAnomalies: sortFn<LateStartAnomaly>(lateStartAnomalies, sorts.anomaly),
    };
  }, [overloadedTours, durationDiscrepancies, lateStartAnomalies, sorts]);

  const overloadedToursCount = (overloadedTours || []).length;
  const durationDiscrepanciesCount = (durationDiscrepancies || []).length;
  const lateStartAnomaliesCount = (lateStartAnomalies || []).length;

  return (
    <section>
      <h2 className="text-2xl font-bold mb-4">Analyse des Causes (Anomalies & Groupes)</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader><CardTitle>Synthèse des Écarts Globaux par Groupe</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                <TableRow><TableCell className="font-medium">Taux Ponctualité Planifié</TableCell><TableCell className="text-right font-semibold">{globalSummary.punctualityRatePlanned.toFixed(1)}%</TableCell></TableRow>
                <TableRow><TableCell className="font-medium">Taux Ponctualité Réalisé</TableCell><TableCell className="text-right font-semibold">{globalSummary.punctualityRateRealized.toFixed(1)}%</TableCell></TableRow>
                <TableRow><TableCell className="font-medium">Écart Durée Moyen / Tournée</TableCell><TableCell className="text-right font-semibold">{formatSecondsToTime(globalSummary.avgDurationDiscrepancyPerTour)} ({globalSummary.durationOverrunPercentage.toFixed(1)}%)</TableCell></TableRow>
                <TableRow><TableCell className="font-medium">Écart Poids Moyen / Tournée</TableCell><TableCell className="text-right font-semibold">{globalSummary.avgWeightDiscrepancyPerTour.toFixed(2)} kg ({globalSummary.weightOverrunPercentage.toFixed(1)}%)</TableCell></TableRow>
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
                                  <TooltipTrigger asChild>
                                      <div onClick={(e) => e.stopPropagation()}>
                                          <HelpCircle className="w-4 h-4 text-muted-foreground" />
                                      </div>
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
  );
}
