'use client';

import { useMemo } from 'react';
import type { MergedData } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Warehouse, StarOff } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface DriverRatingStat {
  name: string;
  totalTasks: number;
  negativeRatings: number;
  negativeRate: number;
  avgRating: number;
}

interface DepotRatingStat {
    name: string;
    totalTasks: number;
    negativeRatings: number;
    negativeRate: number;
    avgRating: number;
    drivers: DriverRatingStat[];
}

export default function NegativeRatingsSummary({ data }: { data: MergedData[] }) {
    
    const statsByDepotAndDriver = useMemo(() => {
        const byDepot: Record<string, MergedData[]> = {};
        // Group tasks by depot first
        data.forEach(item => {
            const depot = item.entrepot?.split(' ')[0] || 'Inconnu';
            if (!byDepot[depot]) byDepot[depot] = [];
            byDepot[depot].push(item);
        });

        const result: DepotRatingStat[] = Object.entries(byDepot).map(([depotName, depotTasks]) => {
            // Calculate depot-level stats
            const depotRatedTasks = depotTasks.filter(t => t.notation != null);
            const depotNegativeRatings = depotRatedTasks.filter(t => t.notation! <= 3);
            const depotAvgRating = depotRatedTasks.length > 0 ? depotRatedTasks.reduce((sum, t) => sum + t.notation!, 0) / depotRatedTasks.length : 0;

            // Now, group tasks within this depot by driver
            const byDriver: Record<string, MergedData[]> = {};
            depotTasks.forEach(item => {
                const driver = item.livreur || 'Inconnu';
                if (!byDriver[driver]) byDriver[driver] = [];
                byDriver[driver].push(item);
            });

            const driverStats: DriverRatingStat[] = Object.entries(byDriver).map(([driverName, driverTasks]) => {
                const ratedTasks = driverTasks.filter(t => t.notation != null);
                const negativeRatings = ratedTasks.filter(t => t.notation! <= 3);
                const avgRating = ratedTasks.length > 0 ? ratedTasks.reduce((sum, t) => sum + t.notation!, 0) / ratedTasks.length : 0;
                return {
                    name: driverName,
                    totalTasks: driverTasks.length,
                    negativeRatings: negativeRatings.length,
                    negativeRate: driverTasks.length > 0 ? (negativeRatings.length / driverTasks.length) * 100 : 0,
                    avgRating,
                };
            }).sort((a, b) => b.negativeRate - a.negativeRate);

            return {
                name: depotName,
                totalTasks: depotTasks.length,
                negativeRatings: depotNegativeRatings.length,
                negativeRate: depotTasks.length > 0 ? (depotNegativeRatings.length / depotTasks.length) * 100 : 0,
                avgRating: depotAvgRating,
                drivers: driverStats
            };
        }).sort((a, b) => b.negativeRate - a.negativeRate);

        return result;

    }, [data]);


    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><StarOff />Statistiques des Notes Négatives</CardTitle>
                <CardDescription>
                    Analyse des notes négatives (≤ 3) par dépôt et par livreur. Les livreurs sont listés pour chaque dépôt.
                </CardDescription>
            </CardHeader>
            <CardContent>
                 <Accordion type="multiple" className="w-full space-y-2" defaultValue={statsByDepotAndDriver.length > 0 ? [statsByDepotAndDriver[0].name] : []}>
                    {statsByDepotAndDriver.map((depotStat) => (
                        <AccordionItem value={depotStat.name} key={depotStat.name}>
                            <AccordionTrigger className="bg-muted/50 px-4 rounded-md hover:bg-muted/80">
                                <div className='flex items-center gap-4 justify-between w-full pr-4'>
                                    <div className="flex items-center gap-2">
                                        <Warehouse size={20} />
                                        <span className='font-bold text-lg'>{depotStat.name}</span>
                                    </div>
                                    <div className="flex items-center gap-4 text-sm">
                                        <span>Taux Négatif: <Badge variant="destructive">{depotStat.negativeRate.toFixed(1)}%</Badge></span>
                                        <span>Nb. Négatifs: <Badge variant="secondary">{depotStat.negativeRatings}</Badge></span>
                                        <span>Note Moyenne: <Badge variant="outline">{depotStat.avgRating.toFixed(2)}</Badge></span>
                                        <span>Total Livraisons: <Badge variant="outline">{depotStat.totalTasks}</Badge></span>
                                    </div>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="p-4 border rounded-b-md">
                                <div className="rounded-md border h-[400px] overflow-y-auto">
                                    <Table>
                                        <TableHeader className="sticky top-0 bg-secondary">
                                            <TableRow>
                                                <TableHead>Livreur</TableHead>
                                                <TableHead>Taux Avis Nég.</TableHead>
                                                <TableHead>Nb. Avis Nég.</TableHead>
                                                <TableHead>Note Moyenne</TableHead>
                                                <TableHead>Total Livraisons</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {depotStat.drivers.map(stat => (
                                                <TableRow key={stat.name}>
                                                    <TableCell className="font-medium">{stat.name}</TableCell>
                                                    <TableCell><Badge variant="destructive">{stat.negativeRate.toFixed(1)}%</Badge></TableCell>
                                                    <TableCell>{stat.negativeRatings}</TableCell>
                                                    <TableCell>{stat.avgRating.toFixed(2)}</TableCell>
                                                    <TableCell>{stat.totalTasks}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </CardContent>
        </Card>
    );
}
