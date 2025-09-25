
'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMemo, useState } from 'react';
import { MergedData } from '@/lib/types';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { useLogistics } from '@/context/LogisticsContext';

type SortConfig = { key: string | null; direction: 'ascending' | 'descending' };
type DepotStats = NonNullable<ReturnType<typeof calculateDepotStats>>;

interface DepotAnalysisTableProps {
    data: MergedData[];
}

const calculateDepotStats = (depotName: string, data: MergedData[], toleranceMinutes: number) => {
    // ... (logic is in DepotAnalysisPage for now, will be moved here)
    // This is just a placeholder to satisfy TypeScript
     const depotData = data.filter(item => item.tournee?.entrepot === depotName);
    if (depotData.length === 0) {
        return null;
    }

    const toleranceSeconds = toleranceMinutes * 60;
    const totalDeliveries = depotData.length;

    // Ponctualité Prév. (aligné avec dataAnalyzer.ts)
    const predictedTasksOnTime = depotData.filter(d => {
        let predictedRetard = 0;
        if (d.heureArriveeApprox < d.heureDebutCreneau) {
            predictedRetard = d.heureArriveeApprox - d.heureDebutCreneau;
        } else if (d.heureArriveeApprox > d.heureFinCreneau) {
            predictedRetard = d.heureArriveeApprox - d.heureFinCreneau;
        }
        return Math.abs(predictedRetard) <= toleranceSeconds;
    }).length;
    const ponctualitePrev = totalDeliveries > 0 ? (predictedTasksOnTime / totalDeliveries) * 100 : 0;


    // Ponctualité Réalisée (incluant les avances de plus de 15 min comme non ponctuelles)
    const realizedOnTime = depotData.filter(d => {
        let realizedDeviation = 0;
        if (d.heureCloture < d.heureDebutCreneau) {
            realizedDeviation = d.heureCloture - d.heureDebutCreneau;
        } else if (d.heureCloture > d.heureFinCreneau) {
            realizedDeviation = d.heureCloture - d.heureFinCreneau;
        }
        return Math.abs(realizedDeviation) <= toleranceSeconds;
    }).length;
    const ponctualiteRealisee = totalDeliveries > 0 ? (realizedOnTime / totalDeliveries) * 100 : 0;

    // % des tournées parties à l'heure ET arrivées en retard
    const totalTours = new Set(depotData.map(d => d.tourneeUniqueId)).size;
    const lateArrivals = depotData.filter(d => d.tournee && d.tournee.heureDepartReelle <= d.tournee.heureDepartPrevue && d.heureCloture > d.heureFinCreneau);
    const tourneesPartiesHeureRetard = totalTours > 0 ? (new Set(lateArrivals.map(t => t.tourneeUniqueId)).size / totalTours) * 100 : 0;
   
    // % des notes négatives (1-3) qui sont arrivées en retard
    const negativeRatings = depotData.filter(d => d.notation && d.notation >= 1 && d.notation <= 3);
    const negativeRatingsLate = negativeRatings.filter(d => d.heureCloture > d.heureFinCreneau);
    const notesNegativesRetard = negativeRatings.length > 0 ? (negativeRatingsLate.length / negativeRatings.length) * 100 : 0;

    // % Dépassement de Poids
    const tasksByTour = depotData.reduce((acc, task) => {
        if (!acc[task.tourneeUniqueId]) {
            acc[task.tourneeUniqueId] = { tasks: [], tour: task.tournee };
        }
        acc[task.tourneeUniqueId].tasks.push(task);
        return acc;
    }, {} as Record<string, { tasks: MergedData[], tour: MergedData['tournee'] }>);

    let overweightToursCount = 0;
    Object.values(tasksByTour).forEach(({ tasks, tour }) => {
        if (tour) {
            const totalTasksWeight = tasks.reduce((sum, task) => sum + task.poids, 0);
            if (totalTasksWeight > tour.capacitePoids) {
                overweightToursCount++;
            }
        }
    });
    const depassementPoids = totalTours > 0 ? (overweightToursCount / totalTours) * 100 : 0;
    
    // Créneau le plus choisi et créneau le plus en retard
    const slotStats: Record<string, { total: number, late: number }> = {};
    depotData.forEach(task => {
        const startTime = new Date(task.heureDebutCreneau * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
        const endTime = new Date(task.heureFinCreneau * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
        const slotKey = `${startTime}-${endTime}`;

        if (!slotStats[slotKey]) {
            slotStats[slotKey] = { total: 0, late: 0 };
        }
        slotStats[slotKey].total++;
        if (task.heureCloture > (task.heureFinCreneau + toleranceSeconds)) {
            slotStats[slotKey].late++;
        }
    });

    let creneauLePlusChoisi = "N/A";
    if (Object.keys(slotStats).length > 0) {
        const [slot, stats] = Object.entries(slotStats).reduce((a, b) => a[1].total > b[1].total ? a : b);
        const percentage = (stats.total / totalDeliveries) * 100;
        creneauLePlusChoisi = `${slot} (${percentage.toFixed(2)}%)`;
    }
    
    let creneauLePlusEnRetard = "N/A";
    const lateSlots = Object.entries(slotStats).filter(([, stats]) => stats.late > 0);
    if (lateSlots.length > 0) {
        const [worstSlot, worstSlotStats] = lateSlots.reduce((a, b) => a[1].late > b[1].late ? a : b);
        const percentage = (worstSlotStats.late / worstSlotStats.total) * 100;
        creneauLePlusEnRetard = `${worstSlot} (${percentage.toFixed(2)}% de retards)`;
    }


    // Intensité du travail par créneau (limité de 06h à 22h)
    const tasksBySlot: Record<string, { planned: number, real: number, plannedTours: Set<string>, realTours: Set<string> }> = {};
    for (let i = 6; i < 22; i += 2) {
        const start = String(i).padStart(2, '0');
        const end = String(i + 2).padStart(2, '0');
        tasksBySlot[`${start}h-${end}h`] = { planned: 0, real: 0, plannedTours: new Set(), realTours: new Set() };
    }

    depotData.forEach(task => {
        const realHourIndex = new Date(task.heureCloture * 1000).getUTCHours();
        const realSlotIndex = Math.floor(realHourIndex / 2) * 2;
        const realSlotKey = `${String(realSlotIndex).padStart(2, '0')}h-${String(realSlotIndex + 2).padStart(2, '0')}h`;
        if (tasksBySlot[realSlotKey]) {
            tasksBySlot[realSlotKey].real++;
            tasksBySlot[realSlotKey].realTours.add(task.tourneeUniqueId);
        }

        const plannedHourIndex = new Date(task.heureArriveeApprox * 1000).getUTCHours();
        const plannedSlotIndex = Math.floor(plannedHourIndex / 2) * 2;
        const plannedSlotKey = `${String(plannedSlotIndex).padStart(2, '0')}h-${String(plannedSlotIndex + 2).padStart(2, '0')}h`;
        if (tasksBySlot[plannedSlotKey]) {
            tasksBySlot[plannedSlotKey].planned++;
            tasksBySlot[plannedSlotKey].plannedTours.add(task.tourneeUniqueId);
        }
    });

    const slotIntensities = Object.entries(tasksBySlot).map(([slotKey, slotData]) => {
        const avgPlanned = slotData.plannedTours.size > 0 ? slotData.planned / slotData.plannedTours.size : 0;
        const avgReal = slotData.realTours.size > 0 ? slotData.real / slotData.realTours.size : 0;
        return { slotKey, avgPlanned, avgReal };
    }).filter(intensity => intensity.avgPlanned > 0 || intensity.avgReal > 0);

    const totalAvgPlanned = slotIntensities.reduce((sum, item) => sum + item.avgPlanned, 0);
    const totalAvgReal = slotIntensities.reduce((sum, item) => sum + item.avgReal, 0);
    const intensiteTravailPlanifie = slotIntensities.length > 0 ? totalAvgPlanned / slotIntensities.length : 0;
    const intensiteTravailRealise = slotIntensities.length > 0 ? totalAvgReal / slotIntensities.length : 0;

    let creneauPlusIntense = "N/A";
    let creneauMoinsIntense = "N/A";

    if (slotIntensities.length > 0) {
        const mostIntense = slotIntensities.reduce((max, current) => current.avgReal > max.avgReal ? current : max, slotIntensities[0]);
        creneauPlusIntense = `${mostIntense.slotKey} (${mostIntense.avgReal.toFixed(2)})`;

        const leastIntense = slotIntensities.reduce((min, current) => current.avgReal < min.avgReal ? current : min, slotIntensities[0]);
        creneauMoinsIntense = `${leastIntense.slotKey} (${leastIntense.avgReal.toFixed(2)})`;
    }

    return {
        entrepot: depotName,
        ponctualitePrev: `${ponctualitePrev.toFixed(2)}%`,
        ponctualiteRealisee: `${ponctualiteRealisee.toFixed(2)}%`,
        tourneesPartiesHeureRetard: `${tourneesPartiesHeureRetard.toFixed(2)}%`,
        notesNegativesRetard: `${notesNegativesRetard.toFixed(2)}%`,
        depassementPoids: `${depassementPoids.toFixed(2)}%`,
        creneauLePlusChoisi,
        creneauLePlusEnRetard,
        intensiteTravailPlanifie: intensiteTravailPlanifie.toFixed(2),
        intensiteTravailRealise: intensiteTravailRealise.toFixed(2),
        creneauPlusIntense,
        creneauMoinsIntense,
    };
}


export default function DepotAnalysisTable({ data: filteredData }: DepotAnalysisTableProps) {
    const { state } = useLogistics();
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'ponctualiteRealisee', direction: 'ascending' });

    const data = useMemo(() => {
        if (!filteredData) return [];
        const depotNames = [...new Set(filteredData.map(item => item.tournee?.entrepot).filter(Boolean) as string[])];
        return depotNames.map(name => calculateDepotStats(name, filteredData, state.filters.punctualityThreshold || 15)).filter(Boolean) as DepotStats[];
    }, [filteredData, state.filters.punctualityThreshold]);

    const sortedData = useMemo(() => {
         if (!data) return [];
        const sortableData = [...data];
        if (sortConfig.key) {
            sortableData.sort((a, b) => {
                if(!a || !b) return 0;
                const key = sortConfig.key as keyof NonNullable<DepotStats>;
                
                const parseValue = (value: any) => {
                     if (typeof value === 'string') {
                        if (value.endsWith('%')) return parseFloat(value.slice(0, -1));
                        const match = value.match(/\(([^)]+)\)/);
                        if (match) return parseFloat(match[1]);
                        if (value === 'N/A') return -Infinity;
                        return parseFloat(value) || value;
                    }
                    return value;
                }
                
                const aValue = parseValue(a[key]);
                const bValue = parseValue(b[key]);

                if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return sortableData;
    }, [data, sortConfig]);

    const handleSort = (key: string) => {
        const direction = sortConfig.key === key && sortConfig.direction === 'ascending' ? 'descending' : 'ascending';
        setSortConfig({ key, direction });
    };

    const renderSortIcon = (columnKey: string) => {
        if (sortConfig.key !== columnKey) return null;
        return sortConfig.direction === 'ascending' ? <ArrowUp className="ml-2 inline h-4 w-4" /> : <ArrowDown className="ml-2 inline h-4 w-4" />;
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Analyse Détaillée des Entrepôts</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                         <TableRow>
                                <TableHead className="cursor-pointer" onClick={() => handleSort('entrepot')}>Entrepôt {renderSortIcon('entrepot')}</TableHead>
                                <TableHead className="cursor-pointer" onClick={() => handleSort('ponctualitePrev')}>Ponctualité Prév. {renderSortIcon('ponctualitePrev')}</TableHead>
                                <TableHead className="cursor-pointer" onClick={() => handleSort('ponctualiteRealisee')}>Ponctualité Réalisée {renderSortIcon('ponctualiteRealisee')}</TableHead>
                                <TableHead className="cursor-pointer" onClick={() => handleSort('tourneesPartiesHeureRetard')}>% Tournées Départ à l'heure / Arrivée en retard {renderSortIcon('tourneesPartiesHeureRetard')}</TableHead>
                                <TableHead className="cursor-pointer" onClick={() => handleSort('notesNegativesRetard')}>% Notes Négatives (1-3) en Retard {renderSortIcon('notesNegativesRetard')}</TableHead>
                                <TableHead className="cursor-pointer" onClick={() => handleSort('depassementPoids')}>% Dépassement de Poids {renderSortIcon('depassementPoids')}</TableHead>
                                <TableHead className="cursor-pointer" onClick={() => handleSort('creneauLePlusChoisi')}>Créneau le plus choisi {renderSortIcon('creneauLePlusChoisi')}</TableHead>
                                <TableHead className="cursor-pointer" onClick={() => handleSort('creneauLePlusEnRetard')}>Créneau le plus en retard {renderSortIcon('creneauLePlusEnRetard')}</TableHead>
                                <TableHead className="cursor-pointer" onClick={() => handleSort('intensiteTravailPlanifie')}>Intensité Travail Planifié (moy. 2h) {renderSortIcon('intensiteTravailPlanifie')}</TableHead>
                                <TableHead className="cursor-pointer" onClick={() => handleSort('intensiteTravailRealise')}>Intensité Travail Réalisé (moy. 2h) {renderSortIcon('intensiteTravailRealise')}</TableHead>
                                <TableHead className="cursor-pointer" onClick={() => handleSort('creneauPlusIntense')}>Créneau le plus intense {renderSortIcon('creneauPlusIntense')}</TableHead>
                                <TableHead className="cursor-pointer" onClick={() => handleSort('creneauMoinsIntense')}>Créneau le moins intense {renderSortIcon('creneauMoinsIntense')}</TableHead>
                            </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedData.map((row) => (
                            row && <TableRow key={row.entrepot}>
                                <TableCell>{row.entrepot}</TableCell>
                                <TableCell>{row.ponctualitePrev}</TableCell>
                                <TableCell>{row.ponctualiteRealisee}</TableCell>
                                <TableCell>{row.tourneesPartiesHeureRetard}</TableCell>
                                <TableCell>{row.notesNegativesRetard}</TableCell>
                                <TableCell>{row.depassementPoids}</TableCell>
                                <TableCell>{row.creneauLePlusChoisi}</TableCell>
                                <TableCell>{row.creneauLePlusEnRetard}</TableCell>
                                <TableCell>{row.intensiteTravailPlanifie}</TableCell>
                                <TableCell>{row.intensiteTravailRealise}</TableCell>
                                <TableCell>{row.creneauPlusIntense}</TableCell>
                                <TableCell>{row.creneauMoinsIntense}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
