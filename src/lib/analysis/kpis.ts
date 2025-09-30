
import type { MergedData, Tournee, Kpi, ComparisonKpi, OverloadedTourInfo, LateStartAnomaly } from '../types';
import { formatSeconds } from '../dataAnalyzer';

export function calculateKpis(completedTasks: MergedData[], uniqueTournees: Tournee[], toleranceSeconds: number): Kpi[] {
    const punctualityRate = getPunctualityRate(completedTasks);
    const lateTasks = completedTasks.filter(t => t.retardStatus === 'late');
    const earlyTasks = completedTasks.filter(t => t.retard < -toleranceSeconds);
    const avgRatingData = completedTasks.filter(t => t.notation != null && t.notation > 0);
    const avgRating = avgRatingData.length > 0 ? avgRatingData.reduce((acc, t) => acc + t.notation!, 0) / avgRatingData.length : 0;
    const negativeReviews = completedTasks.filter(t => t.notation != null && t.notation <= 3);

    return [
        { title: 'Tournées Analysées', value: uniqueTournees.length.toString(), icon: 'Truck' },
        { title: 'Livraisons Analysées', value: completedTasks.length.toString(), icon: 'ListChecks' },
        { title: 'Taux de Ponctualité (Réalisé)', value: `${punctualityRate.toFixed(1)}%`, description: `Seuil de tolérance: ±${Math.round(toleranceSeconds / 60)} min`, icon: 'Clock' },
        { title: 'Notation Moyenne Client', value: avgRating.toFixed(2), description: `Basé sur ${avgRatingData.length} avis (sur 5)`, icon: 'Star' },
        { title: 'Livraisons en Retard', value: lateTasks.length.toString(), description: `> ${Math.round(toleranceSeconds / 60)} min après le créneau`, icon: 'Frown' },
        { title: 'Livraisons en Avance', value: earlyTasks.length.toString(), description: `< -${Math.round(toleranceSeconds / 60)} min avant le créneau`, icon: 'Smile' },
        { title: 'Avis Négatifs', value: negativeReviews.length.toString(), description: 'Note client de 1 à 3 / 5', icon: 'MessageSquareX' },
    ];
}

export function calculateDiscrepancyKpis(
    uniqueTournees: Tournee[],
    punctualityRate: number,
    predictedPunctualityRate: number,
    outOfTimeTasks: number,
    predictedOutOfTimeTasks: number,
): ComparisonKpi[] {
    const totals = uniqueTournees.reduce((acc, tour) => {
        acc.dureePrevue += tour.dureeEstimeeOperationnelle || 0;
        acc.dureeReelleCalculee += tour.dureeReelleCalculee || 0;
        acc.poidsPrevu += tour.poidsPrevu || 0;
        acc.poidsReel += tour.poidsReel || 0;
        acc.distancePrevue += tour.distancePrevue || 0;
        acc.distanceReelle += tour.distanceReelle || 0;
        return acc;
    }, { dureePrevue: 0, dureeReelleCalculee: 0, poidsPrevu: 0, poidsReel: 0, distancePrevue: 0, distanceReelle: 0 });

    return [
        { title: 'Taux de Ponctualité', value1: `${predictedPunctualityRate.toFixed(1)}%`, label1: 'Planifié', value2: `${punctualityRate.toFixed(1)}%`, label2: 'Réalisé', change: `${(Math.abs(punctualityRate - predictedPunctualityRate)).toFixed(1)} pts`, changeType: punctualityRate < predictedPunctualityRate ? 'increase' : 'decrease' },
        { title: 'Tâches Hors Délais', value1: `${predictedOutOfTimeTasks}`, label1: 'Planifié', value2: `${outOfTimeTasks}`, label2: 'Réalisé', change: `${Math.abs(outOfTimeTasks - predictedOutOfTimeTasks)}`, changeType: outOfTimeTasks > predictedOutOfTimeTasks ? 'increase' : 'decrease' },
        { title: 'Écart de Durée Totale', value1: formatSeconds(totals.dureePrevue), label1: 'Planifié', value2: formatSeconds(totals.dureeReelleCalculee), label2: 'Réalisé', change: formatSeconds(Math.abs(totals.dureeReelleCalculee - totals.dureePrevue)), changeType: totals.dureeReelleCalculee > totals.dureePrevue ? 'increase' : 'decrease' },
        { title: 'Écart de Poids Total', value1: `${(totals.poidsPrevu / 1000).toFixed(2)} t`, label1: 'Planifié', value2: `${(totals.poidsReel / 1000).toFixed(2)} t`, label2: 'Réalisé', change: `${(Math.abs(totals.poidsReel - totals.poidsPrevu) / 1000).toFixed(2)} t`, changeType: totals.poidsReel > totals.poidsPrevu ? 'increase' : 'decrease' },
        { title: 'Écart de Kilométrage Total', value1: `${totals.distancePrevue.toFixed(1)} km`, label1: 'Planifié', value2: `${totals.distanceReelle.toFixed(1)} km`, label2: 'Réalisé', change: `${(Math.abs(totals.distanceReelle - totals.distanceReelle)).toFixed(1)} km`, changeType: totals.distanceReelle > totals.distanceReelle ? 'increase' : 'decrease' },
    ];
}

export function calculateQualityKpis(
    completedTasks: MergedData[],
    overloadedTours: OverloadedTourInfo[],
    lateStartAnomalies: LateStartAnomaly[],
    totalTours: number
): (Kpi | ComparisonKpi)[] {
    const negativeReviews = completedTasks.filter(t => t.notation != null && t.notation <= 3);

    const overloadedToursIds = new Set(overloadedTours.map(t => t.uniqueId));
    
    const ratedTasksOnOverloadedTours = completedTasks.filter(t => t.notation != null && t.tournee && overloadedToursIds.has(t.tournee.uniqueId));
    const ratedTasksOnNonOverloadedTours = completedTasks.filter(t => t.notation != null && (!t.tournee || !overloadedToursIds.has(t.tournee.uniqueId)));

    const negativeReviewsOnOverloadedTours = ratedTasksOnOverloadedTours.filter(t => t.notation! <= 3);
    const negativeReviewsOnNonOverloadedTours = ratedTasksOnNonOverloadedTours.filter(t => t.notation! <= 3);

    const rateBadReviewsOverloaded = ratedTasksOnOverloadedTours.length > 0 ? (negativeReviewsOnOverloadedTours.length / ratedTasksOnOverloadedTours.length) * 100 : 0;
    const rateBadReviewsNonOverloaded = ratedTasksOnNonOverloadedTours.length > 0 ? (negativeReviewsOnNonOverloadedTours.length / ratedTasksOnNonOverloadedTours.length) * 100 : 0;

    const badReviewsOnOverloadKpi: ComparisonKpi = {
        title: "Taux d'Avis Négatifs (Surcharge vs. Standard)",
        value1: `${rateBadReviewsOverloaded.toFixed(1)}%`,
        label1: 'Surchargées',
        value2: `${rateBadReviewsNonOverloaded.toFixed(1)}%`,
        label2: 'Standard',
        change: `${(rateBadReviewsOverloaded - rateBadReviewsNonOverloaded).toFixed(1)} pts d'écart`,
        changeType: rateBadReviewsOverloaded > rateBadReviewsNonOverloaded ? 'increase' : 'decrease'
    };

    const negativeReviewsOnLateTasks = negativeReviews.filter(t => t.retardStatus === 'late');
    const correlationDelays = negativeReviews.length > 0 ? (negativeReviewsOnLateTasks.length / negativeReviews.length) * 100 : 0;
    
    const firstTaskLatePercentage = totalTours > 0 ? (lateStartAnomalies.length / totalTours) * 100 : 0;

    return [
        { title: 'Corrélation Retards / Avis Négatifs', value: `${correlationDelays.toFixed(1)}%`, icon: 'BarChart' },
        badReviewsOnOverloadKpi,
        { title: '% Tournées avec Retard à la 1ère Tâche', value: `${firstTaskLatePercentage.toFixed(1)}%`, icon: 'Route' },
    ];
}


function getPunctualityRate(tasks: MergedData[]): number {
    const onTimeTasks = tasks.filter(t => t.retardStatus === 'onTime').length;
    return tasks.length > 0 ? (onTimeTasks / tasks.length) * 100 : 100;
}
