import type { MergedData, AnalysisData, Tournee, OverloadedTourInfo } from './types';
import { Truck, Clock, Star, AlertTriangle, Smile, Frown, Package, Weight } from 'lucide-react';

// Your tolerance threshold in minutes, converted to seconds
const TOLERANCE_MINUTES = 15;
const TOLERANCE_SECONDS = TOLERANCE_MINUTES * 60;

export function analyzeData(data: MergedData[], filters: Record<string, any>): AnalysisData {
    
    const allTasks = data.filter(t => t.tournee);

    // --- AGGREGATE DATA ---

    const tourneeMap = new Map<string, { tour: Tournee, tasks: MergedData[] }>();
    allTasks.forEach(task => {
        if (task.tournee) {
            if (!tourneeMap.has(task.tournee.uniqueId)) {
                tourneeMap.set(task.tournee.uniqueId, { tour: task.tournee, tasks: [] });
            }
            tourneeMap.get(task.tournee.uniqueId)!.tasks.push(task);
        }
    });

    const uniqueTournees = Array.from(tourneeMap.values());

    // --- CALCULATE KPIs ---

    // 1. Ponctualité
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
    
    // 2. Discrepancy KPIs (Durée, Poids, Distance)
    const totals = uniqueTournees.reduce((acc, { tour }) => {
        acc.dureePrevue += tour.dureePrevue || 0;
        acc.dureeReelle += tour.dureeReelle || 0;
        acc.poidsPrevu += tour.poidsPrevu || 0;
        acc.distancePrevue += tour.distancePrevue || 0;
        acc.distanceReelle += tour.distanceReelle || 0;
        return acc;
    }, { dureePrevue: 0, dureeReelle: 0, poidsPrevu: 0, distancePrevue: 0, distanceReelle: 0 });

    const totalPoidsReel = uniqueTournees.reduce((sum, { tasks }) => {
        return sum + tasks.reduce((taskSum, task) => taskSum + task.poids, 0);
    }, 0);
    
    const discrepancyKpis: AnalysisData['discrepancyKpis'] = [
        { title: 'Durée de tournée', value1: formatSeconds(totals.dureePrevue), label1: 'Prévue', value2: formatSeconds(totals.dureeReelle), label2: 'Réelle', change: formatSeconds(Math.abs(totals.dureeReelle - totals.dureePrevue)), changeType: totals.dureeReelle > totals.dureePrevue ? 'increase' : 'decrease' },
        { title: 'Poids total', value1: `${(totals.poidsPrevu / 1000).toFixed(2)} t`, label1: 'Prévu', value2: `${(totalPoidsReel / 1000).toFixed(2)} t`, label2: 'Réel', change: `${(Math.abs(totalPoidsReel - totals.poidsPrevu) / 1000).toFixed(2)} t`, changeType: totalPoidsReel > totals.poidsPrevu ? 'increase' : 'decrease' },
        { title: 'Distance totale', value1: `${(totals.distancePrevue / 1000).toFixed(1)} km`, label1: 'Prévue', value2: `${(totals.distanceReelle / 1000).toFixed(1)} km`, label2: 'Réelle', change: `${(Math.abs(totals.distanceReelle - totals.distancePrevue) / 1000).toFixed(1)} km`, changeType: totals.distanceReelle > totals.distancePrevue ? 'increase' : 'decrease' },
    ];

    // 3. Overloaded Tours (Poids & Bacs)
    const overloadedTours: OverloadedTourInfo[] = [];
    uniqueTournees.forEach(({ tour, tasks }) => {
        const poidsReel = tasks.reduce((sum, task) => sum + task.poids, 0);
        
        let isOverloaded = false;
        if (tour.capacitePoids > 0 && poidsReel > tour.capacitePoids) {
            isOverloaded = true;
        }

        if (isOverloaded) {
            const depassementPoids = poidsReel - tour.capacitePoids;
            const tauxDepassementPoids = tour.capacitePoids > 0 ? (depassementPoids / tour.capacitePoids) * 100 : Infinity;
            overloadedTours.push({
                ...tour,
                poidsReel,
                depassementPoids,
                tauxDepassementPoids,
            });
        }
    });

    // 4. Quality KPIs
    const negativeReviews = allTasks.filter(t => t.notation != null && t.notation <= 3);
    const negativeReviewsLate = negativeReviews.filter(t => t.retard > TOLERANCE_SECONDS || t.retard < -TOLERANCE_SECONDS);
    const qualityKpis: AnalysisData['qualityKpis'] = [
      { title: 'Avis Négatifs (≤ 3)', value: negativeReviews.length.toString(), icon: Frown },
      { title: 'Avis négatifs liés à la ponctualité', value: negativeReviewsLate.length.toString(), icon: Smile },
    ];

    // 5. Performance by Driver/City
    const performanceByDriver = calculatePerformanceBy(allTasks, 'livreur');
    const performanceByCity = calculatePerformanceBy(allTasks, 'ville');

    // 6. Delays by Warehouse
     const delaysByWarehouse = Object.entries(
        lateTasks.reduce((acc, t) => {
            const warehouse = t.tournee!.entrepot;
            acc[warehouse] = (acc[warehouse] || 0) + 1;
            return acc;
        }, {} as Record<string, number>)
    ).map(([warehouse, count]) => ({ warehouse, count }));


    return {
        generalKpis,
        discrepancyKpis,
        qualityKpis,
        overloadedTours,
        performanceByDriver,
        performanceByCity,
        delaysByWarehouse,
    };
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
