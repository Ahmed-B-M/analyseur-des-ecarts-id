import type { MergedData, AnalysisData, Tournee, OverloadedTourInfo, DelayCount, DelayByHour, PerformanceByDriver, PerformanceByGeo, LateStartAnomaly, WorkloadByHour, AvgWorkloadByHour, Kpi, DurationDiscrepancy, ComparisonKpi } from './types';
import { Truck, Clock, Star, AlertTriangle, Smile, Frown, PackageCheck, Route, BarChart, Hash, Users, Sigma } from 'lucide-react';

export function analyzeData(data: MergedData[], filters: Record<string, any>): AnalysisData {
    
    const toleranceMinutes = filters.punctualityThreshold || 15;
    const toleranceSeconds = toleranceMinutes * 60;

    const allTasks = data.filter(t => t.tournee && t.avancement?.toLowerCase() === 'complétée');
    
    // --- Pre-calculation per task ---
    allTasks.forEach(task => {
        // Realized delay
        const isLate = task.retard > toleranceSeconds;
        const isEarly = task.retard < -toleranceSeconds;
        task.retardStatus = isLate ? 'late' : isEarly ? 'early' : 'onTime';
        
        // Predicted delay
        let predictedRetard = 0;
        if (task.heureArriveeApprox < task.heureDebutCreneau) {
            predictedRetard = task.heureArriveeApprox - task.heureDebutCreneau;
        } else if (task.heureArriveeApprox > task.heureFinCreneau) {
            predictedRetard = task.heureArriveeApprox - task.heureFinCreneau;
        }

        const isPredictedLate = predictedRetard > toleranceSeconds;
        const isPredictedEarly = predictedRetard < -toleranceSeconds;
        task.retardPrevisionnelS = isPredictedLate || isPredictedEarly ? predictedRetard : 0;
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
    
    // Aggregate real values and calculated durations per tour
    uniqueTourneesWithTasks.forEach(({ tour, tasks }) => {
        tour.poidsReel = tasks.reduce((sum, t) => sum + t.poids, 0);
        tour.bacsReels = tasks.reduce((sum, t) => sum + t.items, 0);
        
        if (tasks.length > 0) {
            const firstTaskByRealArrival = tasks.reduce((earliest, curr) => curr.heureArriveeReelle < earliest.heureArriveeReelle ? curr : earliest, tasks[0]);
            const lastTaskByRealCloture = tasks.reduce((latest, curr) => curr.heureCloture > latest.heureCloture ? curr : latest, tasks[0]);
            tour.dureeReelleCalculee = lastTaskByRealCloture.heureCloture - firstTaskByRealArrival.heureArriveeReelle;
            
            const firstTaskByApproxArrival = tasks.reduce((earliest, curr) => curr.heureArriveeApprox < earliest.heureArriveeApprox ? curr : earliest, tasks[0]);
            const lastTaskByApproxArrival = tasks.reduce((latest, curr) => curr.heureArriveeApprox > latest.heureArriveeApprox ? curr : latest, tasks[0]);
            tour.dureeEstimeeOperationnelle = lastTaskByApproxArrival.heureArriveeApprox - firstTaskByApproxArrival.heureArriveeApprox;
        } else {
            tour.dureeReelleCalculee = 0;
            tour.dureeEstimeeOperationnelle = 0;
        }
    });

    const uniqueTournees = uniqueTourneesWithTasks.map(t => t.tour);
    
    // --- KPI Calculations ---
    const tasksOnTime = allTasks.filter(t => t.retardStatus === 'onTime');
    const lateTasks = allTasks.filter(t => t.retardStatus === 'late');
    const earlyTasks = allTasks.filter(t => t.retardStatus === 'early');
    const outOfTimeTasks = lateTasks.length + earlyTasks.length;

    const predictedTasksOnTime = allTasks.filter(t => t.retardPrevisionnelS === 0);
    const predictedLateTasks = allTasks.filter(t => t.retardPrevisionnelS! > 0);
    const predictedOutOfTimeTasks = allTasks.length - predictedTasksOnTime.length;

    const punctualityRate = allTasks.length > 0 ? (tasksOnTime.length / allTasks.length) * 100 : 100;
    const predictedPunctualityRate = allTasks.length > 0 ? (predictedTasksOnTime.length / allTasks.length) * 100 : 100;
    
    const avgRatingData = allTasks.filter(t => t.notation != null && t.notation > 0);
    const avgRating = avgRatingData.length > 0 ? avgRatingData.reduce((acc, t) => acc + t.notation!, 0) / avgRatingData.length : 0;
    
    const negativeReviews = allTasks.filter(t => t.notation != null && t.notation <= 3);
    const negativeReviewsOnLateTasks = negativeReviews.filter(t => t.retardStatus === 'late');
    const negativeReviewsOnEarlyTasks = negativeReviews.filter(t => t.retardStatus === 'early');


    const generalKpis: Kpi[] = [
        { title: 'Taux de Ponctualité (Réalisé)', value: `${punctualityRate.toFixed(1)}%`, description: `Seuil de tolérance: ±${toleranceMinutes} min`, icon: Clock },
        { title: 'Livraisons en Retard', value: lateTasks.length.toString(), description: `> ${toleranceMinutes} min après le créneau`, icon: Frown },
        { title: 'Livraisons en Avance', value: earlyTasks.length.toString(), description: `> ${toleranceMinutes} min avant le créneau`, icon: Smile },
        { title: 'Notation Moyenne Client', value: avgRating.toFixed(2), description: `Basé sur ${avgRatingData.length} avis`, icon: Star },
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
    
    const discrepancyKpis: ComparisonKpi[] = [
        { title: 'Taux de Ponctualité', value1: `${predictedPunctualityRate.toFixed(1)}%`, label1: 'Planifié', value2: `${punctualityRate.toFixed(1)}%`, label2: 'Réalisé', change: `${(Math.abs(punctualityRate - predictedPunctualityRate)).toFixed(1)} pts`, changeType: punctualityRate < predictedPunctualityRate ? 'increase' : 'decrease' },
        { title: 'Tâches Hors Délais', value1: `${predictedOutOfTimeTasks}`, label1: 'Planifié', value2: `${outOfTimeTasks}`, label2: 'Réalisé', change: `${Math.abs(outOfTimeTasks - predictedOutOfTimeTasks)}`, changeType: outOfTimeTasks > predictedOutOfTimeTasks ? 'increase' : 'decrease' },
        { title: 'Écart de Durée Totale', value1: formatSeconds(totals.dureePrevue), label1: 'Planifié', value2: formatSeconds(totals.dureeReelleCalculee), label2: 'Réalisé', change: formatSeconds(Math.abs(totals.dureeReelleCalculee - totals.dureePrevue)), changeType: totals.dureeReelleCalculee > totals.dureePrevue ? 'increase' : 'decrease' },
        { title: 'Écart de Poids Total', value1: `${(totals.poidsPrevu / 1000).toFixed(2)} t`, label1: 'Planifié', value2: `${(totals.poidsReel / 1000).toFixed(2)} t`, label2: 'Réalisé', change: `${(Math.abs(totals.poidsReel - totals.poidsPrevu) / 1000).toFixed(2)} t`, changeType: totals.poidsReel > totals.poidsPrevu ? 'increase' : 'decrease' },
        { title: 'Écart de Kilométrage Total', value1: `${totals.distancePrevue.toFixed(1)} km`, label1: 'Planifié', value2: `${totals.distanceReelle.toFixed(1)} km`, label2: 'Réalisé', change: `${(Math.abs(totals.distanceReelle - totals.distancePrevue)).toFixed(1)} km`, changeType: totals.distanceReelle > totals.distancePrevue ? 'increase' : 'decrease' },
    ];
    
    // --- Detailed Analysis Tables ---
    const overloadedToursInfos: OverloadedTourInfo[] = uniqueTournees.map(tour => {
        const isOverloadedByWeight = tour.capacitePoids > 0 && tour.poidsReel > tour.capacitePoids;
        const isOverloadedByBins = tour.capaciteBacs > 0 && tour.bacsReels > tour.capaciteBacs;
        
        const depassementPoids = isOverloadedByWeight ? tour.poidsReel - tour.capacitePoids : 0;
        const tauxDepassementPoids = tour.capacitePoids > 0 ? (depassementPoids / tour.capacitePoids) * 100 : 0;
        const depassementBacs = isOverloadedByBins ? tour.bacsReels - tour.capaciteBacs : 0;
        const tauxDepassementBacs = tour.capaciteBacs > 0 ? (depassementBacs / tour.capaciteBacs) * 100 : 0;

        return {
            ...tour, 
            isOverloaded: isOverloadedByWeight || isOverloadedByBins,
            depassementPoids,
            tauxDepassementPoids,
            depassementBacs,
            tauxDepassementBacs,
        };
    }).filter(t => t.isOverloaded);
    
    const durationDiscrepancies: DurationDiscrepancy[] = uniqueTournees.map(tour => ({
        ...tour,
        dureeEstimee: tour.dureeEstimeeOperationnelle || 0,
        dureeReelle: tour.dureeReelleCalculee || 0,
        ecart: (tour.dureeReelleCalculee || 0) - (tour.dureeEstimeeOperationnelle || 0),
    }));

    const lateStartAnomalies: LateStartAnomaly[] = uniqueTourneesWithTasks
        .map(({tour, tasks}) => ({ 
            tour, 
            tasksInDelay: tasks.filter(t => t.retardStatus === 'late').length,
            ecartDepart: tour.heureDepartReelle - tour.heureDepartPrevue
        }))
        .filter(({ tour, tasksInDelay, ecartDepart }) => ecartDepart <= 0 && tasksInDelay > 0)
        .map(({ tour, tasksInDelay, ecartDepart }) => ({
            ...tour,
            tasksInDelay,
            ecartDepart
        }));

    // --- Quality Impact KPIs ---
    const overloadedToursIds = new Set(overloadedToursInfos.map(t => t.uniqueId));
    const negativeReviewsOnOverloadedTours = negativeReviews.filter(t => t.tournee && overloadedToursIds.has(t.tournee.uniqueId));

    const correlationDelays = negativeReviews.length > 0 ? (negativeReviewsOnLateTasks.length / negativeReviews.length) * 100 : 0;
    const correlationOverload = negativeReviews.length > 0 ? (negativeReviewsOnOverloadedTours.length / negativeReviews.length) * 100 : 0;
    
    const qualityKpis: Kpi[] = [
        { title: 'Corrélation Retards / Avis Négatifs', value: `${correlationDelays.toFixed(1)}%`, icon: BarChart },
        { title: 'Corrélation Surcharge / Avis Négatifs', value: `${correlationOverload.toFixed(1)}%`, icon: Hash },
        { title: 'Anomalies en Tournée', value: lateStartAnomalies.length.toString(), icon: Route },
    ];
    
    // --- Performance & Context Analysis ---
    const performanceByDriver = calculatePerformanceByDriver(uniqueTourneesWithTasks);
    const performanceByCity = calculatePerformanceByGeo(allTasks, 'ville');
    const performanceByPostalCode = calculatePerformanceByGeo(allTasks, 'codePostal');

    const delaysByWarehouse = countItemsBy(lateTasks, (t) => t.tournee!.entrepot);
    const delaysByCity = countItemsBy(lateTasks, (t) => t.ville);
    const delaysByPostalCode = countItemsBy(lateTasks, (t) => t.codePostal);
    const advancesByWarehouse = countItemsBy(earlyTasks, (t) => t.tournee!.entrepot);
    const advancesByCity = countItemsBy(earlyTasks, (t) => t.ville);
    const advancesByPostalCode = countItemsBy(earlyTasks, (t) => t.codePostal);
    
    const delaysByHour = countByHour(lateTasks);
    const advancesByHour = countByHour(earlyTasks);
      
    // --- Workload Charts ---
    const workloadByHour: WorkloadByHour[] = [];
    const avgWorkloadByHour: AvgWorkloadByHour[] = [];
    const tasksByHour: Record<string, { planned: number, real: number, drivers: Set<string> }> = {};

    for (let i = 0; i < 24; i++) {
        const hourStr = `${String(i).padStart(2, '0')}:00`;
        tasksByHour[hourStr] = { planned: 0, real: 0, drivers: new Set() };
    }

    allTasks.forEach(task => {
        const plannedHour = new Date(task.heureArriveeApprox * 1000).getUTCHours();
        const plannedHourStr = `${String(plannedHour).padStart(2, '0')}:00`;
        if (tasksByHour[plannedHourStr]) tasksByHour[plannedHourStr].planned++;

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
        overloadedTours: overloadedToursInfos,
        durationDiscrepancies,
        lateStartAnomalies,
        performanceByDriver,
        performanceByCity,
        performanceByPostalCode,
        delaysByWarehouse,
        delaysByCity,
        delaysByPostalCode,
        delaysByHour,
        advancesByWarehouse,
        advancesByCity,
        advancesByPostalCode,
        advancesByHour,
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
        durationDiscrepancies: [],
        lateStartAnomalies: [],
        performanceByDriver: [],
        performanceByCity: [],
        performanceByPostalCode: [],
        delaysByWarehouse: [],
        delaysByCity: [],
        delaysByPostalCode: [],
        delaysByHour: [],
        advancesByWarehouse: [],
        advancesByCity: [],
        advancesByPostalCode: [],
        advancesByHour: [],
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

function countByHour(tasks: MergedData[]): DelayByHour[] {
    const counts = tasks.reduce((acc, task) => {
        const hour = new Date(task.heureCloture * 1000).getUTCHours();
        const hourString = `${String(hour).padStart(2, '0')}:00`;
        acc[hourString] = (acc[hourString] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(counts)
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour.localeCompare(b.hour));
}

function calculatePerformanceByDriver(toursWithTasks: { tour: Tournee, tasks: MergedData[] }[]): PerformanceByDriver[] {
    const driverGroups = new Map<string, { tours: Tournee[], tasks: MergedData[], overweightTours: Set<string> }>();

    toursWithTasks.forEach(({ tour, tasks }) => {
        const driverName = tour.livreur;
        if (!driverName) return;

        if (!driverGroups.has(driverName)) {
            driverGroups.set(driverName, { tours: [], tasks: [], overweightTours: new Set() });
        }
        const group = driverGroups.get(driverName)!;
        group.tours.push(tour);
        group.tasks.push(...tasks);
        
        const isOverweight = tour.capacitePoids > 0 && tour.poidsReel > tour.capacitePoids;
        if (isOverweight) {
            group.overweightTours.add(tour.uniqueId);
        }
    });

    return Array.from(driverGroups.entries()).map(([driverName, data]) => {
        const allTasks = data.tasks;
        const totalTasks = allTasks.length;
        const onTimeTasks = allTasks.filter(t => t.retardStatus === 'onTime').length;
        const lateTasks = allTasks.filter(t => t.retardStatus === 'late');
        const sumOfDelays = lateTasks.reduce((sum, task) => sum + task.retard, 0);
        
        const ratedTasks = allTasks.filter(t => t.notation != null);
        const sumOfRatings = ratedTasks.reduce((sum, task) => sum + task.notation!, 0);

        return {
            key: driverName,
            totalTours: data.tours.length,
            punctualityRate: totalTasks > 0 ? (onTimeTasks / totalTasks) * 100 : 100,
            avgDelay: lateTasks.length > 0 ? (sumOfDelays / lateTasks.length) / 60 : 0, // in minutes
            overweightToursCount: data.overweightTours.size,
            avgRating: ratedTasks.length > 0 ? sumOfRatings / ratedTasks.length : undefined,
        }
    }).sort((a, b) => b.totalTours - a.totalTours);
}

function calculatePerformanceByGeo(tasks: MergedData[], key: 'ville' | 'codePostal'): PerformanceByGeo[] {
    const geoGroups = new Map<string, { totalTasks: number, lateTasks: MergedData[] }>();

    tasks.forEach(task => {
        const geoKey = task[key];
        if (!geoKey) return;

        if (!geoGroups.has(geoKey)) {
            geoGroups.set(geoKey, { totalTasks: 0, lateTasks: [] });
        }
        const group = geoGroups.get(geoKey)!;
        group.totalTasks++;
        if (task.retardStatus === 'late') {
            group.lateTasks.push(task);
        }
    });

    return Array.from(geoGroups.entries()).map(([geoKey, data]) => {
        const sumOfDelays = data.lateTasks.reduce((sum, task) => sum + task.retard, 0);
        return {
            key: geoKey,
            totalTasks: data.totalTasks,
            totalDelays: data.lateTasks.length,
            punctualityRate: data.totalTasks > 0 ? ((data.totalTasks - data.lateTasks.length) / data.totalTasks) * 100 : 100,
            avgDelay: data.lateTasks.length > 0 ? (sumOfDelays / data.lateTasks.length) / 60 : 0, // in minutes
        }
    }).sort((a,b) => b.totalDelays - a.totalDelays);
}


function formatSeconds(seconds: number): string {
    if (seconds < 0) seconds = 0;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m < 10 ? '0' : ''}${m}m`;
}
