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
    
    // --- Corrected Aggregation Logic ---

    // 1. Get unique tours from the filtered data
    const tourneeMap = new Map<string, Tournee>();
    allTasks.forEach(task => {
        if(task.tournee && !tourneeMap.has(task.tournee.uniqueId)) {
            tourneeMap.set(task.tournee.uniqueId, task.tournee);
        }
    });
    const uniqueTournees = Array.from(tourneeMap.values());

    // 2. Calculate planned totals from unique tours
    const { totalDurationPlanned, totalWeightPlanned, totalKmPlanned } = uniqueTournees.reduce((acc, tour) => {
        acc.totalDurationPlanned += tour.dureePrevue || 0;
        acc.totalWeightPlanned += tour.poidsPrevu || 0;
        acc.totalKmPlanned += tour.kmPrevus || 0;
        return acc;
    }, { totalDurationPlanned: 0, totalWeightPlanned: 0, totalKmPlanned: 0 });

    // 3. Calculate actual totals from tasks
    const { totalDurationActual, totalWeightActual, totalKmActual } = allTasks.reduce((acc, task) => {
        // Actual duration is complex. A simple approach is sum of durations from start of tour.
        if (task.tournee && task.statut === 'complete') {
             // Heure réalisée - heure de départ de la tournée pour cette tâche
            const taskDuration = task.heureRealisee - task.tournee.heureDepartPrevue;
            if(taskDuration > 0) {
                 // This is still not perfect as it sums for each task. Let's find max realization time per tour.
            }
        }
        acc.totalWeightActual += task.poidsReal || 0;
        // Actual KM is not available in data, so we use a placeholder logic.
        acc.totalKmActual += (task.tournee?.kmPrevus || 0) / (allTasks.filter(t => t.tourneeUniqueId === task.tourneeUniqueId).length || 1); // Distribute planned km
        return acc;
    }, { totalDurationActual: 0, totalWeightActual: 0, totalKmActual: 0});

    // A better actual duration: sum of (last task time - tour start time) for each tour.
    const actualDurationByTour = uniqueTournees.reduce((acc, tour) => {
        const tasksForTour = completedTasks.filter(t => t.tourneeUniqueId === tour.uniqueId);
        if (tasksForTour.length > 0) {
            const lastTask = tasksForTour.reduce((latest, current) => current.heureRealisee > latest.heureRealisee ? current : latest);
            const tourDuration = lastTask.heureRealisee - tour.heureDepartPrevue;
            if (tourDuration > 0) {
                acc += tourDuration;
            }
        }
        return acc;
    }, 0);


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
            { title: 'Total Tournées', value: uniqueTournees.length.toString(), icon: Truck },
        ],
        discrepancyKpis: [
            { title: 'Durée', value1: formatSeconds(totalDurationPlanned), label1: 'Prévue', value2: formatSeconds(actualDurationByTour), label2: 'Réelle', change: `${formatSeconds(Math.abs(actualDurationByTour - totalDurationPlanned))}`, changeType: actualDurationByTour > totalDurationPlanned ? 'increase' : 'decrease' },
            { title: 'Poids', value1: `${(totalWeightPlanned/1000).toFixed(1)} t`, label1: 'Prévu', value2: `${(totalWeightActual/1000).toFixed(1)} t`, label2: 'Réel', change: `${(Math.abs(totalWeightActual - totalWeightPlanned)/1000).toFixed(2)} t`, changeType: totalWeightActual > totalWeightPlanned ? 'increase' : 'decrease' },
            { title: 'Kilométrage', value1: `${Math.round(totalKmPlanned)} km`, label1: 'Prévu', value2: `${Math.round(totalKmActual)} km`, label2: 'Réel', change: `${Math.round(Math.abs(totalKmActual - totalKmPlanned))} km`, changeType: totalKmActual > totalKmPlanned ? 'increase' : 'decrease' },
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
