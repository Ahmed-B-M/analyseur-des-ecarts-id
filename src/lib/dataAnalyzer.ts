import type { MergedData, AnalysisData, Tournee, OverloadedTourInfo, DelayCount, DelayByHour } from './types';
import { Truck, Clock, Star, AlertTriangle, Smile, Frown, Package, Weight } from 'lucide-react';

const TOLERANCE_MINUTES = 15;
const TOLERANCE_SECONDS = TOLERANCE_MINUTES * 60;

export function analyzeData(data: MergedData[], filters: Record<string, any>): AnalysisData {
    
    const allTasks = data.filter(t => t.tournee);

    const tourneeMap = new Map<string, { tour: Tournee, tasks: MergedData[] }>();
    allTasks.forEach(task => {
        if (task.tournee) {
            if (!tourneeMap.has(task.tournee.uniqueId)) {
                 const poidsReel = allTasks.filter(t => t.tourneeUniqueId === task.tournee!.uniqueId).reduce((sum, t) => sum + t.poids, 0);
                 const bacsReels = allTasks.filter(t => t.tourneeUniqueId === task.tournee!.uniqueId).reduce((sum, t) => sum + t.items, 0);
                tourneeMap.set(task.tournee.uniqueId, { 
                    tour: {...task.tournee, poidsReel, bacsReels}, 
                    tasks: [] 
                });
            }
            tourneeMap.get(task.tournee.uniqueId)!.tasks.push(task);
        }
    });

    const uniqueTournees = Array.from(tourneeMap.values());
    const lateTasks = allTasks.filter(t => t.retard > TOLERANCE_SECONDS);

    const punctualityRate = allTasks.length > 0 ? (1 - lateTasks.length / allTasks.length) * 100 : 100;
    const avgRatingData = allTasks.filter(t => t.notation != null && t.notation > 0);
    const avgRating = avgRatingData.length > 0 ? avgRatingData.reduce((acc, t) => acc + t.notation!, 0) / avgRatingData.length : 0;
    const generalKpis: AnalysisData['generalKpis'] = [
        { title: 'Taux de Ponctualité', value: `${punctualityRate.toFixed(1)}%`, description: `Seuil de tolérance: ${TOLERANCE_MINUTES} min`, icon: Clock },
        { title: 'Tâches en Retard', value: lateTasks.length.toString(), description: `Sur ${allTasks.length} tâches au total`, icon: AlertTriangle },
        { title: 'Notation Moyenne', value: avgRating.toFixed(2), description: `Basé sur ${avgRatingData.length} avis`, icon: Star },
        { title: 'Total Tournées', value: uniqueTournees.length.toString(), icon: Truck },
    ];
    
    const totals = uniqueTournees.reduce((acc, { tour }) => {
        acc.dureePrevue += tour.dureePrevue || 0;
        acc.dureeReelle += tour.dureeReelle || 0;
        acc.poidsPrevu += tour.poidsPrevu || 0;
        acc.poidsReel += tour.poidsReel || 0;
        acc.distancePrevue += tour.distancePrevue || 0;
        acc.distanceReelle += tour.distanceReelle || 0;
        return acc;
    }, { dureePrevue: 0, dureeReelle: 0, poidsPrevu: 0, poidsReel: 0, distancePrevue: 0, distanceReelle: 0 });
    
    const discrepancyKpis: AnalysisData['discrepancyKpis'] = [
        { title: 'Durée de tournée', value1: formatSeconds(totals.dureePrevue), label1: 'Prévue', value2: formatSeconds(totals.dureeReelle), label2: 'Réelle', change: formatSeconds(Math.abs(totals.dureeReelle - totals.dureePrevue)), changeType: totals.dureeReelle > totals.dureePrevue ? 'increase' : 'decrease' },
        { title: 'Poids total', value1: `${(totals.poidsPrevu / 1000).toFixed(2)} t`, label1: 'Prévu', value2: `${(totals.poidsReel / 1000).toFixed(2)} t`, label2: 'Réel', change: `${(Math.abs(totals.poidsReel - totals.poidsPrevu) / 1000).toFixed(2)} t`, changeType: totals.poidsReel > totals.poidsPrevu ? 'increase' : 'decrease' },
        { title: 'Distance totale', value1: `${(totals.distancePrevue / 1000).toFixed(1)} km`, label1: 'Prévue', value2: `${(totals.distanceReelle / 1000).toFixed(1)} km`, label2: 'Réelle', change: `${(Math.abs(totals.distanceReelle - totals.distancePrevue) / 1000).toFixed(1)} km`, changeType: totals.distanceReelle > totals.distancePrevue ? 'increase' : 'decrease' },
    ];

    const overloadedTours: OverloadedTourInfo[] = [];
    uniqueTournees.forEach(({ tour }) => {
        const { poidsReel, bacsReels, capacitePoids, capaciteBacs } = tour;
        let isOverloaded = false;
        if (capacitePoids > 0 && poidsReel > capacitePoids) isOverloaded = true;
        if (capaciteBacs > 0 && bacsReels > capaciteBacs) isOverloaded = true;

        if (isOverloaded) {
            const depassementPoids = poidsReel - capacitePoids;
            const tauxDepassementPoids = capacitePoids > 0 ? (depassementPoids / capacitePoids) * 100 : Infinity;
            const depassementBacs = bacsReels - capaciteBacs;
            const tauxDepassementBacs = capaciteBacs > 0 ? (depassementBacs / capaciteBacs) * 100 : Infinity;
            overloadedTours.push({
                ...tour,
                poidsReel,
                depassementPoids,
                tauxDepassementPoids,
                bacsReels,
                depassementBacs,
                tauxDepassementBacs,
            });
        }
    });

    const negativeReviews = allTasks.filter(t => t.notation != null && t.notation <= 3);
    const negativeReviewsLate = negativeReviews.filter(t => t.retard > TOLERANCE_SECONDS || t.retard < -TOLERANCE_SECONDS);
    const qualityKpis: AnalysisData['qualityKpis'] = [
      { title: 'Avis Négatifs (≤ 3)', value: negativeReviews.length.toString(), icon: Frown },
      { title: 'Avis négatifs liés à la ponctualité', value: negativeReviewsLate.length.toString(), icon: Smile },
    ];

    const performanceByDriver = calculatePerformanceBy(allTasks, 'livreur');
    const performanceByCity = calculatePerformanceBy(allTasks, 'ville');

    const delaysByWarehouse = countDelaysBy(lateTasks, (t) => t.tournee!.entrepot);
    const delaysByCity = countDelaysBy(lateTasks, (t) => t.ville);
    const delaysByPostalCode = countDelaysBy(lateTasks, (t) => t.codePostal);

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
        performanceByCity,
        delaysByWarehouse,
        delaysByCity,
        delaysByPostalCode,
        delaysByHour: sortedDelaysByHour,
    };
}


function countDelaysBy(tasks: MergedData[], keyGetter: (task: MergedData) => string): DelayCount[] {
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


function calculatePerformanceBy(data: MergedData[], key: 'livreur' | 'ville') {
    const groups = data.reduce((acc, t) => {
        const groupKey = key === 'livreur' ? t.livreur : t[key];
        if (!groupKey) return acc;
        if (!acc[groupKey]) {
            acc[groupKey] = { tasks: [], lateTasksCount: 0, totalRating: 0, ratingCount: 0, totalDelaySeconds: 0 };
        }
        acc[groupKey].tasks.push(t);
        if (t.retard > TOLERANCE_SECONDS) {
            acc[groupKey].lateTasksCount++;
        }
        if (t.notation != null) {
            acc[groupKey].totalRating += t.notation;
            acc[groupKey].ratingCount++;
        }
        acc[groupKey].totalDelaySeconds += Math.max(0, t.retard);

        return acc;
    }, {} as Record<string, { tasks: MergedData[], lateTasksCount: number, totalRating: number, ratingCount: number, totalDelaySeconds: number }>);

    return Object.entries(groups).map(([groupKey, value]) => ({
        key: groupKey,
        totalTasks: value.tasks.length,
        punctualityRate: (1 - value.lateTasksCount / value.tasks.length) * 100,
        avgDelay: value.tasks.length > 0 ? (value.totalDelaySeconds / value.tasks.length) / 60 : 0, // in minutes
        avgRating: value.ratingCount > 0 ? value.totalRating / value.ratingCount : undefined,
    })).sort((a,b) => b.totalTasks - a.totalTasks);
}

function formatSeconds(seconds: number): string {
    if (seconds < 0) seconds = 0;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m < 10 ? '0' : ''}${m}m`;
}
