import type { MergedData, AnalysisData, Tournee, OverloadedTourInfo, DelayCount, DelayByHour, PerformanceBy, LateStartAnomaly, WorkloadByHour, AvgWorkloadByHour, Kpi } from './types';
import { Truck, Clock, Star, AlertTriangle, Smile, Frown, Package, Weight, UserCheck, BarChart, Hash, Users, Sigma } from 'lucide-react';

export function analyzeData(data: MergedData[], filters: Record<string, any>): AnalysisData {
    
    const toleranceMinutes = filters.punctualityThreshold || 15;
    const toleranceSeconds = toleranceMinutes * 60;

    const allTasks = data.filter(t => t.tournee && t.avancement?.toLowerCase() === 'complétée');
    
    // --- Pre-calculation per task ---
    allTasks.forEach(task => {
        const windowStart = task.heureDebutCreneau - toleranceSeconds;
        const windowEnd = task.heureFinCreneau + toleranceSeconds;
        if (task.heureArriveeApprox < windowStart) {
            task.retardPrevisionnelS = task.heureArriveeApprox - windowStart;
        } else if (task.heureArriveeApprox > windowEnd) {
            task.retardPrevisionnelS = task.heureArriveeApprox - windowEnd;
        } else {
            task.retardPrevisionnelS = 0;
        }
    });

    if (allTasks.length === 0) {
        return createEmptyAnalysisData();
    }
    
    const tourneeMap = new Map<string, { tour: Tournee, tasks: MergedData[] }>();
    allTasks.forEach(task => {
        if (task.tournee) {
            if (!tourneeMap.has(task.tournee.uniqueId)) {
                tourneeMap.set(task.tournee.uniqueId, { tour: { ...task.tournee }, tasks: [] });
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
            const firstTask = tasks.reduce((earliest, curr) => curr.heureArriveeReelle < earliest.heureArriveeReelle ? curr : earliest, tasks[0]);
            const lastTask = tasks.reduce((latest, curr) => curr.heureCloture > latest.heureCloture ? curr : latest, tasks[0]);
            tour.dureeReelleCalculee = lastTask.heureCloture - firstTask.heureArriveeReelle;
        } else {
            tour.dureeReelleCalculee = 0;
        }
    });

    const uniqueTournees = uniqueTourneesWithTasks.map(t => t.tour);
    
    // --- KPI Calculations ---
    const tasksOnTime = allTasks.filter(t => Math.abs(t.retard) <= toleranceSeconds);
    const lateTasks = allTasks.filter(t => t.retard > toleranceSeconds);
    const plannedLateTasks = allTasks.filter(t => t.retardPrevisionnelS && Math.abs(t.retardPrevisionnelS) > 0);

    const punctualityRate = allTasks.length > 0 ? (tasksOnTime.length / allTasks.length) * 100 : 100;
    
    const avgRatingData = allTasks.filter(t => t.notation != null && t.notation > 0);
    const avgRating = avgRatingData.length > 0 ? avgRatingData.reduce((acc, t) => acc + t.notation!, 0) / avgRatingData.length : 0;
    
    const negativeReviews = allTasks.filter(t => t.notation != null && t.notation <= 3);
    const negativeReviewsOnLateTasks = negativeReviews.filter(t => t.retard > toleranceSeconds);

    const generalKpis: Kpi[] = [
        { title: 'Taux de Ponctualité (Réalisé)', value: `${punctualityRate.toFixed(1)}%`, description: `Seuil: ${toleranceMinutes} min`, icon: Clock },
        { title: 'Tâches en Retard (Réalisé)', value: lateTasks.length.toString(), description: `Sur ${allTasks.length} tâches`, icon: AlertTriangle },
        { title: 'Tâches Prévues en Retard', value: plannedLateTasks.length.toString(), description: `Retards anticipés par le système`, icon: UserCheck },
        { title: 'Notation Moyenne', value: avgRating.toFixed(2), description: `Basé sur ${avgRatingData.length} avis`, icon: Star },
        { title: 'Total Avis Négatifs (≤ 3)', value: negativeReviews.length.toString(), icon: Frown },
        { title: 'Avis Négatifs sur Tâches en Retard', value: negativeReviewsOnLateTasks.length.toString(), icon: Clock },
    ];
    
    // --- Discrepancy KPIs ---
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
        { title: 'Écart de Durée Totale', value1: formatSeconds(totals.dureePrevue), label1: 'Planifié', value2: formatSeconds(totals.dureeReelleCalculee), label2: 'Réalisé', change: formatSeconds(Math.abs(totals.dureeReelleCalculee - totals.dureePrevue)), changeType: totals.dureeReelleCalculee > totals.dureePrevue ? 'increase' : 'decrease' },
        { title: 'Écart de Poids Total', value1: `${(totals.poidsPrevu / 1000).toFixed(2)} t`, label1: 'Planifié', value2: `${(totals.poidsReel / 1000).toFixed(2)} t`, label2: 'Réalisé', change: `${(Math.abs(totals.poidsReel - totals.poidsPrevu) / 1000).toFixed(2)} t`, changeType: totals.poidsReel > totals.poidsPrevu ? 'increase' : 'decrease' },
        { title: 'Écart de Kilométrage Total', value1: `${totals.distancePrevue.toFixed(1)} km`, label1: 'Planifié', value2: `${totals.distanceReelle.toFixed(1)} km`, label2: 'Réalisé', change: `${(Math.abs(totals.distanceReelle - totals.distancePrevue)).toFixed(1)} km`, changeType: totals.distanceReelle > totals.distancePrevue ? 'increase' : 'decrease' },
    ];
    
    // --- Quality Impact ---
    const overloadedToursInfos: OverloadedTourInfo[] = uniqueTournees.map(tour => {
        const isOverloaded = (tour.capacitePoids > 0 && tour.poidsReel > tour.capacitePoids) || (tour.capaciteBacs > 0 && tour.bacsReels > tour.capaciteBacs);
        const depassementPoids = tour.poidsReel - tour.capacitePoids;
        const tauxDepassementPoids = tour.capacitePoids > 0 ? (depassementPoids / tour.capacitePoids) * 100 : Infinity;
        const depassementBacs = tour.bacsReels - tour.capaciteBacs;
        const tauxDepassementBacs = tour.capaciteBacs > 0 ? (depassementBacs / tour.capaciteBacs) * 100 : Infinity;
        return {
            ...tour, isOverloaded, depassementPoids, tauxDepassementPoids, depassementBacs, tauxDepassementBacs
        };
    });
    const overloadedTours = overloadedToursInfos.filter(t => t.isOverloaded);
    const overloadedToursIds = new Set(overloadedTours.map(t => t.uniqueId));
    const negativeReviewsOnOverloadedTours = negativeReviews.filter(t => t.tournee && overloadedToursIds.has(t.tournee.uniqueId));

    const correlationDelays = negativeReviews.length > 0 ? (negativeReviewsOnLateTasks.length / negativeReviews.length) * 100 : 0;
    const correlationOverload = negativeReviews.length > 0 ? (negativeReviewsOnOverloadedTours.length / negativeReviews.length) * 100 : 0;

    const lateStartAnomalies: LateStartAnomaly[] = uniqueTourneesWithTasks
        .filter(({tour, tasks}) => tour.heureDepartReelle <= tour.heureDepartPrevue && tasks.some(t => t.retard > toleranceSeconds))
        .map(({tour, tasks}) => ({ ...tour, tasksInDelay: tasks.filter(t => t.retard > toleranceSeconds).length }));


    const qualityKpis: Kpi[] = [
        { title: 'Corrélation Retards / Avis Négatifs', value: `${correlationDelays.toFixed(1)}%`, icon: BarChart },
        { title: 'Corrélation Surcharge / Avis Négatifs', value: `${correlationOverload.toFixed(1)}%`, icon: Hash },
        { title: 'Anomalies "Partie à l\'heure"', value: lateStartAnomalies.length.toString(), icon: UserCheck },
    ];
    
    // --- Performance & Context Analysis ---
    const performanceByDriver = calculatePerformanceBy(allTasks, 'livreur', toleranceSeconds);

    const delaysByWarehouse = countItemsBy(lateTasks, (t) => t.tournee!.entrepot);
    const delaysByCity = countItemsBy(lateTasks, (t) => t.ville);
    const delaysByPostalCode = countItemsBy(lateTasks, (t) => t.codePostal);
    const delaysByHour = lateTasks.reduce((acc, task) => {
        const hour = new Date(task.heureCloture * 1000).getUTCHours();
        const hourString = `${String(hour).padStart(2, '0')}:00`;
        acc[hourString] = (acc[hourString] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    const sortedDelaysByHour: DelayByHour[] = Object.entries(delaysByHour)
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour.localeCompare(b.hour));
      
    // --- Workload Charts ---
    const workloadByHour: WorkloadByHour[] = [];
    const avgWorkloadByHour: AvgWorkloadByHour[] = [];
    const tasksByHour: Record<string, { planned: number, real: number, drivers: Set<string> }> = {};

    for (let i = 0; i < 24; i++) {
        const hourStr = `${String(i).padStart(2, '0')}:00`;
        tasksByHour[hourStr] = { planned: 0, real: 0, drivers: new Set() };
    }

    allTasks.forEach(task => {
        // Planned
        const plannedHour = new Date(task.heureArriveeApprox * 1000).getUTCHours();
        const plannedHourStr = `${String(plannedHour).padStart(2, '0')}:00`;
        if (tasksByHour[plannedHourStr]) tasksByHour[plannedHourStr].planned++;

        // Real
        const realHour = new Date(task.heureCloture * 1000).getUTCHours();
        const realHourStr = `${String(realHour).padStart(2, '0')}:00`;
        if (tasksByHour[realHourStr]) {
            tasksByHour[realHourStr].real++;
            if (task.livreur) tasksByHour[realHourStr].drivers.add(task.livreur);
        }
    });

    Object.entries(tasksByHour).forEach(([hour, data]) => {
        workloadByHour.push({ hour, planned: data.planned, real: data.real });
        const driverCount = data.drivers.size;
        avgWorkloadByHour.push({ hour, avgLoad: driverCount > 0 ? data.real / driverCount : 0 });
    });


    return {
        generalKpis,
        discrepancyKpis,
        qualityKpis,
        overloadedTours,
        lateStartAnomalies,
        performanceByDriver,
        delaysByWarehouse,
        delaysByCity,
        delaysByPostalCode,
        delaysByHour: sortedDelaysByHour,
        workloadByHour,
        avgWorkloadByDriverByHour: avgWorkloadByHour
    };
}


function createEmptyAnalysisData(): AnalysisData {
    return {
        generalKpis: [],
        discrepancyKpis: [],
        qualityKpis: [],
        overloadedTours: [],
        lateStartAnomalies: [],
        performanceByDriver: [],
        delaysByWarehouse: [],
        delaysByCity: [],
        delaysByPostalCode: [],
        delaysByHour: [],
        workloadByHour: [],
        avgWorkloadByDriverByHour: []
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
        const groupKey = key === 'livreur' ? t.tournee?.livreur : t[key];
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
