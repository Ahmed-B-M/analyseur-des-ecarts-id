import type { MergedData, AnalysisData, Tournee, OverloadedTourInfo, DelayCount, DelayByHour, PerformanceByDriver, PerformanceByGeo, LateStartAnomaly, WorkloadByHour, AvgWorkloadByHour, Kpi, DurationDiscrepancy } from './types';
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
    const tasksOnTime = allTasks.filter(t => Math.abs(t.retard) <= toleranceSeconds);
    const lateTasks = allTasks.filter(t => t.retard > toleranceSeconds);
    const earlyTasks = allTasks.filter(t => t.retard < -toleranceSeconds);
    const plannedLateTasks = allTasks.filter(t => t.retardPrevisionnelS && t.retardPrevisionnelS > 0);

    const punctualityRate = allTasks.length > 0 ? (tasksOnTime.length / allTasks.length) * 100 : 100;
    
    const avgRatingData = allTasks.filter(t => t.notation != null && t.notation > 0);
    const avgRating = avgRatingData.length > 0 ? avgRatingData.reduce((acc, t) => acc + t.notation!, 0) / avgRatingData.length : 0;
    
    const negativeReviews = allTasks.filter(t => t.notation != null && t.notation <= 3);
    const negativeReviewsOnLateTasks = negativeReviews.filter(t => t.retard > toleranceSeconds);
    const negativeReviewsOnEarlyTasks = negativeReviews.filter(t => t.retard < -toleranceSeconds);


    const generalKpis: Kpi[] = [
        { title: 'Taux de Ponctualité (Réalisé)', value: `${punctualityRate.toFixed(1)}%`, description: `Seuil: ${toleranceMinutes} min`, icon: Clock },
        { title: 'Tâches en Retard', value: lateTasks.length.toString(), description: `Sur ${allTasks.length} tâches`, icon: AlertTriangle },
        { title: 'Tâches en Avance', value: earlyTasks.length.toString(), description: `Sur ${allTasks.length} tâches`, icon: Smile },
        { title: 'Tâches Prévues en Retard', value: plannedLateTasks.length.toString(), description: `Retards anticipés par le système`, icon: UserCheck },
        { title: 'Notation Moyenne', value: avgRating.toFixed(2), description: `Basé sur ${avgRatingData.length} avis`, icon: Star },
        { title: 'Total Avis Négatifs (≤ 3)', value: negativeReviews.length.toString(), icon: Frown },
        { title: 'Avis Négatifs sur Tâches en Retard', value: negativeReviewsOnLateTasks.length.toString(), icon: Clock },
        { title: 'Avis Négatifs sur Tâches en Avance', value: negativeReviewsOnEarlyTasks.length.toString(), icon: Clock },
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
            tasksInDelay: tasks.filter(t => t.retard > toleranceSeconds).length,
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
        { title: 'Anomalies "Partie à l\'heure"', value: lateStartAnomalies.length.toString(), icon: UserCheck },
    ];
    
    // --- Performance & Context Analysis ---
    const performanceByDriver = calculatePerformanceByDriver(uniqueTourneesWithTasks, toleranceSeconds);
    const performanceByCity = calculatePerformanceByGeo(allTasks, 'ville', toleranceSeconds);
    const performanceByPostalCode = calculatePerformanceByGeo(allTasks, 'codePostal', toleranceSeconds);

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

function calculatePerformanceByDriver(toursWithTasks: { tour: Tournee, tasks: MergedData[] }[], toleranceSeconds: number): PerformanceByDriver[] {
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
        const onTimeTasks = allTasks.filter(t => Math.abs(t.retard) <= toleranceSeconds).length;
        const lateTasks = allTasks.filter(t => t.retard > toleranceSeconds);
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

function calculatePerformanceByGeo(tasks: MergedData[], key: 'ville' | 'codePostal', toleranceSeconds: number): PerformanceByGeo[] {
    const geoGroups = new Map<string, { totalTasks: number, lateTasks: MergedData[] }>();

    tasks.forEach(task => {
        const geoKey = task[key];
        if (!geoKey) return;

        if (!geoGroups.has(geoKey)) {
            geoGroups.set(geoKey, { totalTasks: 0, lateTasks: [] });
        }
        const group = geoGroups.get(geoKey)!;
        group.totalTasks++;
        if (task.retard > toleranceSeconds) {
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
