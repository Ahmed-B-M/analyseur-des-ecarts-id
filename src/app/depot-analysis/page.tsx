
'use client';

import { useLogistics } from '@/context/LogisticsContext';
import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Download, FileSpreadsheet } from 'lucide-react';
import HotZonesChart from '@/components/logistics/HotZonesChart';
import DepotAnalysisTable from '@/components/logistics/DepotAnalysisTable';
import PostalCodeTable from '@/components/logistics/PostalCodeTable';
import { Button } from '@/components/ui/button';
import { MergedData } from '@/lib/types';
import { exportToXlsx } from '@/lib/exportUtils';


// Helper function to calculate depot stats - needed for both table and export
const calculateDepotStats = (depotName: string, data: MergedData[], toleranceMinutes: number = 15) => {
    const depotData = data.filter(item => item.tournee?.entrepot === depotName);
    if (depotData.length === 0) return null;
    const toleranceSeconds = toleranceMinutes * 60;
    const totalDeliveries = depotData.length;
    const predictedTasksOnTime = depotData.filter(d => {
        let predictedRetard = 0;
        if (d.heureArriveeApprox < d.heureDebutCreneau) predictedRetard = d.heureArriveeApprox - d.heureDebutCreneau;
        else if (d.heureArriveeApprox > d.heureFinCreneau) predictedRetard = d.heureArriveeApprox - d.heureFinCreneau;
        return Math.abs(predictedRetard) <= toleranceSeconds;
    }).length;
    const ponctualitePrev = totalDeliveries > 0 ? (predictedTasksOnTime / totalDeliveries) * 100 : 0;
    const realizedOnTime = depotData.filter(d => {
        const isTooEarly = d.heureArriveeReelle < (d.heureDebutCreneau - toleranceSeconds);
        const isLate = d.heureArriveeReelle > d.heureFinCreneau;
        return !isTooEarly && !isLate;
    }).length;
    const ponctualiteRealisee = totalDeliveries > 0 ? (realizedOnTime / totalDeliveries) * 100 : 0;
    const totalTours = new Set(depotData.map(d => d.tourneeUniqueId)).size;
    const lateArrivals = depotData.filter(d => d.tournee && d.tournee.heureDepartReelle <= d.tournee.heureDepartPrevue && d.heureArriveeReelle > d.heureFinCreneau);
    const tourneesPartiesHeureRetard = totalTours > 0 ? (new Set(lateArrivals.map(t => t.tourneeUniqueId)).size / totalTours) * 100 : 0;
    const negativeRatings = depotData.filter(d => d.notation && d.notation >= 1 && d.notation <= 3);
    const negativeRatingsLate = negativeRatings.filter(d => d.heureArriveeReelle > d.heureFinCreneau);
    const notesNegativesRetard = negativeRatings.length > 0 ? (negativeRatingsLate.length / negativeRatings.length) * 100 : 0;
    const tasksByTour = depotData.reduce((acc, task) => {
        if (!acc[task.tourneeUniqueId]) acc[task.tourneeUniqueId] = { tasks: [], tour: task.tournee };
        acc[task.tourneeUniqueId].tasks.push(task);
        return acc;
    }, {} as Record<string, { tasks: MergedData[], tour: MergedData['tournee'] }>);
    let overweightToursCount = 0;
    Object.values(tasksByTour).forEach(({ tasks, tour }) => {
        if (tour) {
            const totalTasksWeight = tasks.reduce((sum, task) => sum + task.poids, 0);
            if (totalTasksWeight > tour.capacitePoids) overweightToursCount++;
        }
    });
    const depassementPoids = totalTours > 0 ? (overweightToursCount / totalTours) * 100 : 0;
    const tasksBySlot: Record<string, { planned: number, real: number, plannedTours: Set<string>, realTours: Set<string> }> = {};
    for (let i = 6; i < 22; i += 2) {
        const start = String(i).padStart(2, '0');
        const end = String(i + 2).padStart(2, '0');
        tasksBySlot[`${start}h-${end}h`] = { planned: 0, real: 0, plannedTours: new Set(), realTours: new Set() };
    }
    depotData.forEach(task => {
        const realHourIndex = new Date(task.heureArriveeReelle * 1000).getUTCHours();
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
    let creneauPlusIntense = "N/A", creneauMoinsIntense = "N/A";
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
        intensiteTravailPlanifie: intensiteTravailPlanifie.toFixed(2),
        intensiteTravailRealise: intensiteTravailRealise.toFixed(2),
        creneauPlusIntense,
        creneauMoinsIntense,
    };
};


// Helper function to calculate postal code stats for the chart
const calculatePostalCodeStats = (data: MergedData[], toleranceMinutes: number = 15) => {
    const postalCodeStats: Record<string, { total: number; late: number; depot: string }> = {};
    const toleranceSeconds = toleranceMinutes * 60;

    data.forEach(item => {
        if (item.codePostal && item.tournee) {
            if (!postalCodeStats[item.codePostal]) {
                postalCodeStats[item.codePostal] = { total: 0, late: 0, depot: item.tournee.entrepot };
            }
            postalCodeStats[item.codePostal].total++;
            if (item.heureArriveeReelle > (item.heureFinCreneau + toleranceSeconds)) {
                postalCodeStats[item.codePostal].late++;
            }
        }
    });

    return Object.entries(postalCodeStats)
        .map(([codePostal, stats]) => ({
            codePostal,
            entrepot: stats.depot,
            totalLivraisons: stats.total,
            livraisonsRetard: stats.total > 0 ? ((stats.late / stats.total) * 100).toFixed(2) + '%' : '0.00%',
        }));
};


export default function DepotAnalysisPage() {
    const { state, mergedData } = useLogistics();
    const router = useRouter();

     const depotData = useMemo(() => {
        if (!mergedData) return [];
        const depotNames = [...new Set(mergedData.map(item => item.tournee?.entrepot).filter(Boolean) as string[])];
        return depotNames.map(name => calculateDepotStats(name, mergedData, state.filters.punctualityThreshold)).filter(Boolean);
    }, [mergedData, state.filters.punctualityThreshold]);
    
    const postalCodeData = useMemo(() => {
        if(!mergedData) return [];
        return calculatePostalCodeStats(mergedData, state.filters.punctualityThreshold);
    }, [mergedData, state.filters.punctualityThreshold])
    
    const chartData = useMemo(() => {
        return postalCodeData.map(d => ({
            ...d,
            retardPercent: parseFloat(d.livraisonsRetard.slice(0, -1))
        }));
    }, [postalCodeData]);

    const handleExport = () => {
        if (!depotData || !postalCodeData) return;
        
        const sheets = [
            { data: depotData, sheetName: 'Analyse Entrepôts' },
            { data: postalCodeData, sheetName: 'Classement Codes Postaux' }
        ];
        
        const today = new Date().toLocaleDateString('fr-CA');
        exportToXlsx(sheets, `RDP_Export_${today}`);
    };


    if (!mergedData || mergedData.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full">
                <p className="text-lg text-muted-foreground">Veuillez charger les fichiers de données sur la page principale.</p>
                 <Button onClick={() => router.push('/')} className="mt-4">
                    Retour à l'accueil
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex justify-end gap-2">
                 <Button variant="outline" onClick={handleExport}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Exporter en XLSX
                </Button>
                <Button onClick={() => router.push('/report')}>
                    <Download className="mr-2 h-4 w-4" />
                    Télécharger le Rapport
                </Button>
            </div>
            
            <HotZonesChart data={chartData} />
            
            <DepotAnalysisTable />

            <PostalCodeTable />
        </div>
    );
}
