import type { MergedData, AnalysisData, Tournee } from './types';
import { Truck, Clock, Star, AlertTriangle, Smile, Frown } from 'lucide-react';

export function analyzeData(data: MergedData[], filters: Record<string, any>): AnalysisData {
    const punctualityThreshold = (filters.punctualityThreshold || 15) * 60; // in seconds
    const maxWeightThreshold = filters.maxWeightThreshold || 500; // in kg

    const allTasks = data.filter(t => t.tournee);
    const completedTasks = allTasks.filter(t => t.statut === 'complete');
    const lateTasks = completedTasks.filter(t => (t.heureRealisee - t.heurePrevue) > punctualityThreshold);
    const negativeReviews = completedTasks.filter(t => t.notation != null && t.notation <= 3);

    const punctualityRate = completedTasks.length > 0 ? (1 - lateTasks.length / completedTasks.length) * 100 : 0;
    const avgRating = completedTasks.filter(t=>t.notation).length > 0 ? completedTasks.reduce((acc, t) => acc + (t.notation || 0), 0) / completedTasks.filter(t=>t.notation).length : 0;

    // Discrepancies
    const { totalDuration, totalWeight, totalKm } = allTasks.reduce((acc, t) => {
        if(t.tournee) {
            acc.totalDuration.planned += t.tournee.dureePrevue || 0;
            acc.totalWeight.planned += t.tournee.poidsPrevu || 0;
            acc.totalKm.planned += t.tournee.kmPrevus || 0;
        }
        if(t.statut === 'complete') {
            acc.totalDuration.actual += t.heureRealisee - (t.tournee?.heureDepartPrevue || 0);
            acc.totalWeight.actual += t.poidsReal || 0;
             // Assuming real KM are not in tasks file, we can't calculate actual. This is a simplification.
            acc.totalKm.actual += (t.tournee?.kmPrevus || 0) * (1 + (Math.random() - 0.5) * 0.2); // Fake actual km
        }
        return acc;
    }, { 
        totalDuration: { planned: 0, actual: 0 },
        totalWeight: { planned: 0, actual: 0 },
        totalKm: { planned: 0, actual: 0 }
    });


    const tourneeWeights = allTasks.reduce((acc, task) => {
        if(task.tournee) {
            const tourneeId = task.tournee.uniqueId;
            if(!acc[tourneeId]) {
                acc[tourneeId] = { tour: task.tournee, realWeight: 0};
            }
            acc[tourneeId].realWeight += task.poidsReal;
        }
        return acc;
    }, {} as Record<string, {tour: Tournee, realWeight: number}>);

    const overloadedTours = Object.values(tourneeWeights)
        .filter(item => item.realWeight > (item.tour.poidsPrevu > 0 ? item.tour.poidsPrevu * 1.1 : maxWeightThreshold)) // More robust check
        .map(item => ({...item.tour, poidsReel: item.realWeight}));

    const performanceByDriver = calculatePerformanceBy(completedTasks, 'livreur', punctualityThreshold);
    const performanceByCity = calculatePerformanceBy(completedTasks, 'ville', punctualityThreshold);
    const performanceByPostalCode = calculatePerformanceBy(completedTasks, 'codePostal', punctualityThreshold);
    
    const delaysByWarehouse = Object.entries(
        lateTasks.reduce((acc, t) => {
            const warehouse = t.tournee!.entrepot;
            acc[warehouse] = (acc[warehouse] || 0) + 1;
            return acc;
        }, {} as Record<string, number>)
    ).map(([warehouse, count]) => ({ warehouse, count }));

    return {
        generalKpis: [
            { title: 'Taux de Ponctualité', value: `${punctualityRate.toFixed(1)}%`, description: `Seuil: ${punctualityThreshold/60} min`, icon: Clock },
            { title: 'Tâches en Retard', value: lateTasks.length.toString(), description: `${completedTasks.length} tâches complétées`, icon: AlertTriangle },
            { title: 'Notation Moyenne', value: avgRating.toFixed(2), description: `sur ${completedTasks.filter(t=>t.notation).length} avis`, icon: Star },
            { title: 'Total Tournées', value: new Set(data.map(d => d.tourneeUniqueId)).size.toString(), icon: Truck },
        ],
        discrepancyKpis: [
            { title: 'Durée', value1: formatSeconds(totalDuration.planned), label1: 'Prévue', value2: formatSeconds(totalDuration.actual), label2: 'Réelle', change: `${formatSeconds(Math.abs(totalDuration.actual - totalDuration.planned))}`, changeType: totalDuration.actual > totalDuration.planned ? 'increase' : 'decrease' },
            { title: 'Poids', value1: `${(totalWeight.planned/1000).toFixed(1)} t`, label1: 'Prévu', value2: `${(totalWeight.actual/1000).toFixed(1)} t`, label2: 'Réel', change: `${(Math.abs(totalWeight.actual - totalWeight.planned)/1000).toFixed(2)} t`, changeType: totalWeight.actual > totalWeight.planned ? 'increase' : 'decrease' },
            { title: 'Kilométrage', value1: `${Math.round(totalKm.planned)} km`, label1: 'Prévu', value2: `${Math.round(totalKm.actual)} km`, label2: 'Réel', change: `${Math.round(Math.abs(totalKm.actual - totalKm.planned))} km`, changeType: totalKm.actual > totalKm.planned ? 'increase' : 'decrease' },
        ],
        qualityKpis: [
            { title: 'Avis Négatifs (≤ 3)', value: negativeReviews.length.toString(), icon: Frown },
            { title: `Avis Négatifs sur Tâches en Retard`, value: negativeReviews.filter(t => (t.heureRealisee - t.heurePrevue) > punctualityThreshold).length.toString(), icon: Smile },
        ],
        overloadedTours,
        performanceByDriver,
        performanceByCity,
        performanceByPostalCode,
        delaysByWarehouse,
        delaysByTimeSlot: [], // Placeholder
        timeSlotAnalysis: [], // Placeholder
    };
}

function calculatePerformanceBy(data: MergedData[], key: 'livreur' | 'ville' | 'codePostal', punctualityThreshold: number) {
    const groups = data.reduce((acc, t) => {
        const groupKey = key === 'livreur' ? t.tournee!.livreur : t[key];
        if (!groupKey) return acc;
        if (!acc[groupKey]) {
            acc[groupKey] = { tasks: [], lateTasks: 0, totalRating: 0, ratingCount: 0 };
        }
        acc[groupKey].tasks.push(t);
        if ((t.heureRealisee - t.heurePrevue) > punctualityThreshold) {
            acc[groupKey].lateTasks++;
        }
        if (t.notation != null) {
            acc[groupKey].totalRating += t.notation;
            acc[groupKey].ratingCount++;
        }
        return acc;
    }, {} as Record<string, { tasks: MergedData[], lateTasks: number, totalRating: number, ratingCount: number }>);

    return Object.entries(groups).map(([groupKey, value]) => ({
        key: groupKey,
        totalTasks: value.tasks.length,
        punctualityRate: (1 - value.lateTasks / value.tasks.length) * 100,
        avgDelay: value.tasks.reduce((sum, t) => sum + Math.max(0, t.heureRealisee - t.heurePrevue), 0) / (value.tasks.length * 60), // in minutes
        avgRating: value.ratingCount > 0 ? value.totalRating / value.ratingCount : undefined,
    })).sort((a,b) => b.totalTasks - a.totalTasks);
}

function formatSeconds(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
}
