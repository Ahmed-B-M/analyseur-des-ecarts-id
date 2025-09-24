
'use client';

import { useLogistics } from '@/context/LogisticsContext';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMemo } from 'react';
import type { MergedData } from '@/lib/types';

// Helper function to calculate depot statistics
const calculateDepotStats = (depotName: string, data: MergedData[], toleranceMinutes: number = 15) => {
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


    // Ponctualité Réalisée
    const realizedOnTime = depotData.filter(d => d.heureArriveeReelle <= d.heureFinCreneau).length;
    const ponctualiteRealisee = totalDeliveries > 0 ? (realizedOnTime / totalDeliveries) * 100 : 0;

    // % des tournées parties à l'heure ET arrivées en retard
    const totalTours = new Set(depotData.map(d => d.tourneeUniqueId)).size;
    const lateArrivals = depotData.filter(d => d.tournee && d.tournee.heureDepartReelle <= d.tournee.heureDepartPrevue && d.heureArriveeReelle > d.heureFinCreneau);
    const tourneesPartiesHeureRetard = totalTours > 0 ? (new Set(lateArrivals.map(t => t.tourneeUniqueId)).size / totalTours) * 100 : 0;
   
    // % des notes négatives (1-3) qui sont arrivées en retard
    const negativeRatings = depotData.filter(d => d.notation && d.notation >= 1 && d.notation <= 3);
    const negativeRatingsLate = negativeRatings.filter(d => d.heureArriveeReelle > d.heureFinCreneau);
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
    
    return {
        entrepot: depotName,
        ponctualitePrev: `${ponctualitePrev.toFixed(2)}%`,
        ponctualiteRealisee: `${ponctualiteRealisee.toFixed(2)}%`,
        tourneesPartiesHeureRetard: `${tourneesPartiesHeureRetard.toFixed(2)}%`,
        notesNegativesRetard: `${notesNegativesRetard.toFixed(2)}%`,
        depassementPoids: `${depassementPoids.toFixed(2)}%`,
        intensiteTravailPlanifie: 'N/A',
        intensiteTravailRealise: 'N/A',
    };
};

const calculatePostalCodeStats = (data: MergedData[]) => {
    const postalCodeStats: Record<string, { total: number; late: number; depot: string }> = {};

    data.forEach(item => {
        if (item.codePostal && item.tournee) {
            if (!postalCodeStats[item.codePostal]) {
                postalCodeStats[item.codePostal] = { total: 0, late: 0, depot: item.tournee.entrepot };
            }
            postalCodeStats[item.codePostal].total++;
            // Le retard est défini par un dépassement du créneau horaire du client
            if (item.heureArriveeReelle > item.heureFinCreneau) {
                postalCodeStats[item.codePostal].late++;
            }
        }
    });

    return Object.entries(postalCodeStats)
        .map(([codePostal, stats]) => ({
            codePostal,
            entrepot: stats.depot,
            livraisonsRetard: stats.total > 0 ? ((stats.late / stats.total) * 100).toFixed(2) + '%' : '0.00%',
        }))
        .sort((a, b) => parseFloat(b.livraisonsRetard) - parseFloat(a.livraisonsRetard));
};


export default function DepotAnalysisPage() {
    const { state, mergedData } = useLogistics();

    const depotData = useMemo(() => {
        if (!mergedData) return [];
        const depotNames = [...new Set(mergedData.map(item => item.tournee?.entrepot).filter(Boolean) as string[])];
        return depotNames.map(name => calculateDepotStats(name, mergedData, state.filters.punctualityThreshold));
    }, [mergedData, state.filters.punctualityThreshold]);
    
    const postalCodeData = useMemo(() => {
        if(!mergedData) return [];
        return calculatePostalCodeStats(mergedData);
    }, [mergedData])


    if (!mergedData || mergedData.length === 0) {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-lg text-muted-foreground">Veuillez charger les fichiers de données sur la page principale.</p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle>Analyse Détaillée des Entrepôts</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Entrepôt</TableHead>
                                <TableHead>Ponctualité Prév.</TableHead>
                                <TableHead>Ponctualité Réalisée</TableHead>
                                <TableHead>% Tournées Départ à l'heure / Arrivée en retard</TableHead>
                                <TableHead>% Notes Négatives (1-3) en Retard</TableHead>
                                <TableHead>% Dépassement de Poids</TableHead>
                                <TableHead>Intensité Travail Planifié (moy. 2h)</TableHead>
                                <TableHead>Intensité Travail Réalisé (moy. 2h)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {depotData.map((row) => (
                                <TableRow key={row?.entrepot}>
                                    <TableCell>{row?.entrepot}</TableCell>
                                    <TableCell>{row?.ponctualitePrev}</TableCell>
                                    <TableCell>{row?.ponctualiteRealisee}</TableCell>
                                    <TableCell>{row?.tourneesPartiesHeureRetard}</TableCell>
                                    <TableCell>{row?.notesNegativesRetard}</TableCell>
                                    <TableCell>{row?.depassementPoids}</TableCell>
                                    <TableCell>{row?.intensiteTravailPlanifie}</TableCell>
                                    <TableCell>{row?.intensiteTravailRealise}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Classement des Codes Postaux par Retards</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Code Postal</TableHead>
                                <TableHead>Entrepôt</TableHead>
                                <TableHead>% Livraisons en Retard</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {postalCodeData.map((row) => (
                                <TableRow key={row.codePostal}>
                                    <TableCell>{row.codePostal}</TableCell>
                                    <TableCell>{row.entrepot}</TableCell>
                                    <TableCell>{row.livraisonsRetard}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
