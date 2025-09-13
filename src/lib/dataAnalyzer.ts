import type { MergedData, AnalysisData, Tournee, OverloadedTourInfo, DelayCount, DelayByHour, PerformanceBy } from './types';
import { Truck, Clock, Star, AlertTriangle, Smile, Frown, Package, Weight } from 'lucide-react';

export function analyzeData(data: MergedData[], filters: Record<string, any>): AnalysisData {
    
    const toleranceMinutes = filters.punctualityThreshold || 15;
    const toleranceSeconds = toleranceMinutes * 60;

    const allTasks = data.filter(t => t.tournee);
    if (allTasks.length === 0) {
        return createEmptyAnalysisData();
    }
    
    const tourneeMap = new Map<string, { tour: Tournee, tasks: MergedData[] }>();
    allTasks.forEach(task => {
        if (task.tournee) {
            if (!tourneeMap.has(task.tournee.uniqueId)) {
                tourneeMap.set(task.tournee.uniqueId, { tour: task.tournee, tasks: [] });
            }
            tourneeMap.get(task.tournee.uniqueId)!.tasks.push(task);
        }
    });

    const uniqueTourneesWithTasks = Array.from(tourneeMap.values());
    
    // Aggregate real values per tour
    uniqueTourneesWithTasks.forEach(({ tour, tasks }) => {
        tour.poidsReel = tasks.reduce((sum, t) => sum + t.poids, 0);
        tour.bacsReels = tasks.reduce((sum, t) => sum + t.items, 0);
        
        if (tasks.length > 0) {
            const firstTask = tasks.reduce((earliest, curr) => curr.heureArriveeApprox < earliest.heureArriveeApprox ? curr : earliest, tasks[0]);
            const lastTask = tasks.reduce((latest, curr) => curr.heureCloture > latest.heureCloture ? curr : latest, tasks[0]);
            tour.dureeReelleCalculee = lastTask.heureCloture - firstTask.heureArriveeApprox;
        } else {
            tour.dureeReelleCalculee = 0;
        }
    });

    const uniqueTournees = uniqueTourneesWithTasks.map(t => t.tour);
    
    const tasksOnTime = allTasks.filter(t => Math.abs(t.retard) <= toleranceSeconds);
    const lateTasks = allTasks.filter(t => t.retard > toleranceSeconds);

    const punctualityRate = allTasks.length > 0 ? (tasksOnTime.length / allTasks.length) * 100 : 100;
    
    const avgRatingData = allTasks.filter(t => t.notation != null && t.notation > 0);
    const avgRating = avgRatingData.length > 0 ? avgRatingData.reduce((acc, t) => acc + t.notation!, 0) / avgRatingData.length : 0;
    
    const negativeReviews = allTasks.filter(t => t.notation != null && t.notation <= 3);

    const generalKpis: AnalysisData['generalKpis'] = [
        { title: 'Taux de Ponctualité', value: `${punctualityRate.toFixed(1)}%`, description: `Seuil de tolérance: ${toleranceMinutes} min`, icon: Clock },
        { title: 'Tâches en Retard', value: lateTasks.length.toString(), description: `Sur ${allTasks.length} tâches au total`, icon: AlertTriangle },
        { title: 'Notation Moyenne', value: avgRating.toFixed(2), description: `Basé sur ${avgRatingData.length} avis`, icon: Star },
        { title: 'Total Tournées', value: uniqueTournees.length.toString(), icon: Truck },
    ];
    
    const totals = uniqueTournees.reduce((acc, tour) => {
        acc.dureePrevue += tour.dureePrevue || 0;
        acc.dureeReelleCalculee += tour.dureeReelleCalculee || 0;
        acc.poidsPrevu += tour.poidsPrevu || 0;
        acc.poidsReel += tour.poidsReel || 0;
        acc.distancePrevue += tour.distancePrevue || 0;
        acc.distanceReelle += tour.distanceReelle || 0;
        return acc;
    }, { dureePrevue: 0, dureeReelleCalculee: 0, poidsPrevu: 0, poidsReel: 0, distancePrevue: 0, distanceReelle: 0 });
    
    const discrepancyKpis: AnalysisData['discrepancyKpis'] = [
        { title: 'Écart de Durée Totale', value1: formatSeconds(totals.dureePrevue), label1: 'Prévue', value2: formatSeconds(totals.dureeReelleCalculee), label2: 'Réelle "Calculée"', change: formatSeconds(Math.abs(totals.dureeReelleCalculee - totals.dureePrevue)), changeType: totals.dureeReelleCalculee > totals.dureePrevue ? 'increase' : 'decrease' },
        { title: 'Écart de Poids Total', value1: `${(totals.poidsPrevu / 1000).toFixed(2)} t`, label1: 'Prévu', value2: `${(totals.poidsReel / 1000).toFixed(2)} t`, label2: 'Réel', change: `${(Math.abs(totals.poidsReel - totals.poidsPrevu) / 1000).toFixed(2)} t`, changeType: totals.poidsReel > totals.poidsPrevu ? 'increase' : 'decrease' },
        { title: 'Écart de Distance Totale', value1: `${(totals.distancePrevue / 1000).toFixed(1)} km`, label1: 'Prévue', value2: `${(totals.distanceReelle / 1000).toFixed(1)} km`, label2: 'Réelle', change: `${(Math.abs(totals.distanceReelle - totals.distancePrevue) / 1000).toFixed(1)} km`, changeType: totals.distanceReelle > totals.distancePrevue ? 'increase' : 'decrease' },
    ];

    const maxWeightThreshold = filters.maxWeightThreshold;
    const overloadedTours: OverloadedTourInfo[] = uniqueTournees.map(tour => {
        let isOverloaded = false;
        const weightThreshold = maxWeightThreshold || tour.capacitePoids;

        if (weightThreshold > 0 && tour.poidsReel > weightThreshold) isOverloaded = true;
        if (tour.capaciteBacs > 0 && tour.bacsReels > tour.capaciteBacs) isOverloaded = true;

        if (isOverloaded) {
            const depassementPoids = tour.poidsReel - tour.capacitePoids;
            const tauxDepassementPoids = tour.capacitePoids > 0 ? (depassementPoids / tour.capacitePoids) * 100 : Infinity;
            const depassementBacs = tour.bacsReels - tour.capaciteBacs;
            const tauxDepassementBacs = tour.capaciteBacs > 0 ? (depassementBacs / tour.capaciteBacs) * 100 : Infinity;
            return {
                ...tour,
                isOverloaded: true,
                depassementPoids,
                tauxDepassementPoids,
                depassementBacs,
                tauxDepassementBacs,
            };
        }
        return { ...tour, isOverloaded: false, depassementPoids: 0, tauxDepassementPoids: 0, depassementBacs: 0, tauxDepassementBacs: 0 };
    }).filter(tour => tour.isOverloaded);


    const negativeReviewsLate = negativeReviews.filter(t => Math.abs(t.retard) > toleranceSeconds);
    const qualityKpis: AnalysisData['qualityKpis'] = [
      { title: 'Total Avis Négatifs (≤ 3)', value: negativeReviews.length.toString(), icon: Frown },
      { title: 'Avis Négatifs & Ponctualité', value: negativeReviewsLate.length.toString(), icon: Clock },
    ];

    const performanceByDriver = calculatePerformanceBy(allTasks, 'livreur', toleranceSeconds);

    const delaysByWarehouse = countItemsBy(lateTasks, (t) => t.tournee!.entrepot);
    const delaysByCity = countItemsBy(lateTasks, (t) => t.ville);
    const delaysByPostalCode = countItemsBy(lateTasks, (t) => t.codePostal);

    const delaysByHour = lateTasks.reduce((acc, task) => {
        const hour = new Date(task.heureCloture * 1000).getHours();
        const hourString = `${String(hour).padStart(2, '0')}:00`;
        acc[hourString] = (acc[hourString] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const sortedDelaysByHour: DelayByHour[] = Object.entries(delaysByHour)
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour.localeCompare(b.hour));


    return {
        generalKpis,
        discrepancyKpis,
        qualityKpis,
        overloadedTours,
        performanceByDriver,
        delaysByWarehouse,
        delaysByCity,
        delaysByPostalCode,
        delaysByHour: sortedDelaysByHour,
    };
}


function createEmptyAnalysisData(): AnalysisData {
    return {
        generalKpis: [],
        discrepancyKpis: [],
        qualityKpis: [],
        overloadedTours: [],
        performanceByDriver: [],
        delaysByWarehouse: [],
        delaysByCity: [],
        delaysByPostalCode: [],
        delaysByHour: [],
    };
}


function countItemsBy(tasks: MergedData[], keyGetter: (task: MergedData) => string): DelayCount[] {
    const counts = tasks.reduce((acc, task) => {
        const key = keyGetter(task);
        if (key) {
            acc[key] = (acc[key] || 0) + 1;
        }
        return acc;
    }, {} as Record<string, number>);

    return Object.entries(counts)
        .map(([key, count]) => ({ key, count }))
        .sort((a, b) => b.count - a.count);
}


function calculatePerformanceBy(data: MergedData[], key: 'livreur' | 'ville', toleranceSeconds: number): PerformanceBy<string>[] {
    const groups = data.reduce((acc, t) => {
        const groupKey = key === 'livreur' ? t.livreur : t[key];
        if (!groupKey) return acc;
        if (!acc[groupKey]) {
            acc[groupKey] = { tasks: [], lateTasks: [], totalRating: 0, ratingCount: 0 };
        }
        const group = acc[groupKey];
        group.tasks.push(t);
        if (t.retard > toleranceSeconds) {
            group.lateTasks.push(t);
        }
        if (t.notation != null) {
            group.totalRating += t.notation;
            group.ratingCount++;
        }
        return acc;
    }, {} as Record<string, { tasks: MergedData[], lateTasks: MergedData[], totalRating: number, ratingCount: number }>);

    return Object.entries(groups).map(([groupKey, value]) => {
        const totalTasks = value.tasks.length;
        const lateTasksCount = value.lateTasks.length;
        const sumOfDelaysInSeconds = value.lateTasks.reduce((sum, task) => sum + task.retard, 0);

        return {
            key: groupKey,
            totalTasks: totalTasks,
            punctualityRate: totalTasks > 0 ? (1 - lateTasksCount / totalTasks) * 100 : 100,
            avgDelay: lateTasksCount > 0 ? (sumOfDelaysInSeconds / lateTasksCount) / 60 : 0, // in minutes
            avgRating: value.ratingCount > 0 ? value.totalRating / value.ratingCount : undefined,
        }
    }).sort((a,b) => b.totalTasks - a.totalTasks);
}

function formatSeconds(seconds: number): string {
    if (seconds < 0) seconds = 0;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m < 10 ? '0' : ''}${m}m`;
}
