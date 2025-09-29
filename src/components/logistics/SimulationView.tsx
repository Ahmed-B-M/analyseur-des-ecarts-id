
'use client';

import { useMemo } from 'react';
import { MergedData } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import CustomerPromiseChart from './CustomerPromiseChart';

interface SimulationViewProps {
  data: MergedData[];
  punctualityThreshold: number;
}

// Helper to format time from minutes
const formatTime = (minutes: number) => {
    const h = Math.floor(minutes / 60).toString().padStart(2, '0');
    const m = (minutes % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
};

const SimulationView = ({ data, punctualityThreshold }: SimulationViewProps) => {

    const actualTableData = useMemo(() => {
        if (!data || data.length === 0) return [];

        const dataByWarehouse = data.reduce((acc, task) => {
            const warehouse = task.tournee?.entrepot;
            if (warehouse) {
                if (!acc[warehouse]) acc[warehouse] = [];
                acc[warehouse].push(task);
            }
            return acc;
        }, {} as Record<string, MergedData[]>);

        const tableRows: { warehouse: string; slot: string; count: number; percentage: string }[] = [];

        for (const warehouse in dataByWarehouse) {
            const tasks = dataByWarehouse[warehouse];
            const totalOrders = tasks.length;

            const ordersBySlot = tasks.reduce((acc, task) => {
                const start = new Date(task.heureDebutCreneau * 1000);
                const end = new Date(task.heureFinCreneau * 1000);
                const slotKey = `${start.getUTCHours().toString().padStart(2, '0')}:${start.getUTCMinutes().toString().padStart(2, '0')}-${end.getUTCHours().toString().padStart(2, '0')}:${end.getUTCMinutes().toString().padStart(2, '0')}`;
                
                if (!acc[slotKey]) acc[slotKey] = 0;
                acc[slotKey]++;
                return acc;
            }, {} as Record<string, number>);

            const sortedSlots = Object.keys(ordersBySlot).sort();
            
            sortedSlots.forEach(slot => {
                const count = ordersBySlot[slot];
                tableRows.push({
                    warehouse,
                    slot,
                    count,
                    percentage: ((count / totalOrders) * 100).toFixed(2) + '%'
                });
            });
        }
        return tableRows;
    }, [data]);


    const simulatedChartData = useMemo(() => {
        if (!data || data.length === 0) return [];

        const totalOrders = data.length;

        // 1. Calculate original distribution profile (by start hour)
        const originalDistribution: Record<number, number> = {};
        for (let i = 6; i < 22; i++) originalDistribution[i] = 0;
        data.forEach(task => {
            const startHour = new Date(task.heureDebutCreneau * 1000).getUTCHours();
            if (originalDistribution[startHour] !== undefined) {
                originalDistribution[startHour]++;
            }
        });

        // 2. Define new slots (2h duration, 30min step)
        const newSlots: { start: number; key: string }[] = [];
        for (let i = 6 * 60; i < 22 * 60; i += 30) {
            newSlots.push({ start: i, key: `${formatTime(i)}-${formatTime(i + 120)}` });
        }

        // 3. Interpolate and normalize to get simulated counts per new slot
        const simulatedCounts: Record<string, number> = {};
        let simulatedTotal = 0;
        newSlots.forEach(slot => {
            const startHour = Math.floor(slot.start / 60);
            const nextHour = startHour + 1;
            const proportion = (slot.start % 60) / 60;
            const dist1 = originalDistribution[startHour] || 0;
            const dist2 = originalDistribution[nextHour] || 0;
            simulatedCounts[slot.key] = dist1 * (1 - proportion) + dist2 * proportion;
            simulatedTotal += simulatedCounts[slot.key];
        });
        
        const normalizationFactor = totalOrders / simulatedTotal;
        for (const key in simulatedCounts) {
            simulatedCounts[key] *= normalizationFactor;
        }

        // 4. Calculate average offsets and late probability from real data
        let totalPlanOffset = 0, totalRealizedOffset = 0, lateCount = 0;
        const lateToleranceSeconds = punctualityThreshold * 60;
        data.forEach(task => {
            totalPlanOffset += (task.heureArriveeApprox - task.heureDebutCreneau);
            totalRealizedOffset += (task.heureCloture - task.heureArriveeApprox);
            if (task.heureCloture > task.heureFinCreneau + lateToleranceSeconds) {
                lateCount++;
            }
        });
        const avgPlanOffsetMinutes = (totalPlanOffset / data.length) / 60;
        const avgRealizedOffsetMinutes = (totalRealizedOffset / data.length) / 60;
        const lateProbability = lateCount / data.length;

        // 5. Initialize minute-by-minute buckets
        const buckets: Record<string, { customerPromise: number; urbantzPlan: number; realized: number; late: number }> = {};
        for (let i = 6 * 60; i < 23 * 60; i++) {
            buckets[formatTime(i)] = { customerPromise: 0, urbantzPlan: 0, realized: 0, late: 0 };
        }

        // 6. Populate buckets with simulated data
        for (const slotKey in simulatedCounts) {
            const ordersInSlot = simulatedCounts[slotKey];
            const [startStr] = slotKey.split('-');
            const [startH, startM] = startStr.split(':').map(Number);
            const startMinutes = startH * 60 + startM;
            const duration = 120; // 2-hour slots
            const weightPerMinute = ordersInSlot / duration;

            for (let i = 0; i < duration; i++) {
                const currentMinute = startMinutes + i;
                const promiseKey = formatTime(currentMinute);
                if (buckets[promiseKey]) {
                    buckets[promiseKey].customerPromise += weightPerMinute;

                    const planKey = formatTime(currentMinute + avgPlanOffsetMinutes);
                    if (buckets[planKey]) buckets[planKey].urbantzPlan += weightPerMinute;

                    const realizedKey = formatTime(currentMinute + avgPlanOffsetMinutes + avgRealizedOffsetMinutes);
                    if (buckets[realizedKey]) {
                        buckets[realizedKey].realized += weightPerMinute;
                         // Simulate late deliveries based on probability
                        if (Math.random() < lateProbability) {
                           buckets[realizedKey].late += weightPerMinute;
                        }
                    }
                }
            }
        }
        
        return Object.entries(buckets).map(([hour, data]) => ({ ...data, hour }));
    }, [data, punctualityThreshold]);


    if (!data || data.length === 0) {
        return null;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Analyse des Créneaux Actuels et Simulation</CardTitle>
                <CardDescription>
                    Le tableau ci-dessous montre la répartition réelle des commandes par créneau. 
                    Le graphique simule l'impact d'une offre de créneaux plus flexibles (chevauchement toutes les 30 min) sur la distribution des livraisons.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="h-96 overflow-y-auto border rounded-md">
                    <Table>
                        <TableHeader className="sticky top-0 bg-background">
                            <TableRow>
                                <TableHead>Entrepôt</TableHead>
                                <TableHead>Créneau Actuel</TableHead>
                                <TableHead className="text-right">% Commandes</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {actualTableData.map((row, i) => (
                                <TableRow key={i}>
                                    <TableCell>{row.warehouse}</TableCell>
                                    <TableCell>{row.slot}</TableCell>
                                    <TableCell className="text-right">{row.percentage}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                <div>
                   <CustomerPromiseChart data={simulatedChartData} />
                </div>
            </CardContent>
        </Card>
    );
};

export default SimulationView;
