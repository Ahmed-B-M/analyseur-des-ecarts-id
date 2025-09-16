
import type { MergedData, AnalysisData, Tournee, OverloadedTourInfo, DelayCount, DelayByHour, PerformanceByDriver, PerformanceByGeo, LateStartAnomaly, WorkloadByHour, AvgWorkloadByHour, Kpi, DurationDiscrepancy, ComparisonKpi, AvgWorkload, PerformanceByDay, PerformanceByTimeSlot, DelayHistogramBin, GlobalSummary, PerformanceByGroup } from './types';
import { fr } from 'date-fns/locale';
import { format, getDay } from 'date-fns';

export function analyzeData(data: MergedData[], filters: Record<string, any>): AnalysisData {
    
    const toleranceMinutes = filters.punctualityThreshold || 15;
    const toleranceSeconds = toleranceMinutes * 60;

    const completedTasks = data.filter(t => t.tournee && t.avancement?.toLowerCase() === 'complétée');
    
    if (completedTasks.length === 0) {
        return createEmptyAnalysisData();
    }

    // --- Pre-calculation per task ---
    completedTasks.forEach(task => {
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
        task.retardPrevisionnelS = predictedRetard;

        const isPredictedLate = predictedRetard > toleranceSeconds;
        const isPredictedEarly = predictedRetard < -toleranceSeconds;
        task.retardPrevisionnelStatus = isPredictedLate ? 'late' : isPredictedEarly ? 'early' : 'onTime';
    });
    
    const tourneeMap = new Map<string, { tour: Tournee, tasks: MergedData[] }>();
    completedTasks.forEach(task => {
        if (task.tournee) {
            if (!tourneeMap.has(task.tournee.uniqueId)) {
                tourneeMap.set(task.tournee.uniqueId, { tour: { ...task.tournee }, tasks: [] });
            }
            tourneeMap.get(task.tournee.uniqueId)!.tasks.push(task);
        }
    });

    // Aggregate real values and calculated durations per tour
    tourneeMap.forEach(({ tour, tasks }) => {
        tour.poidsReel = tasks.reduce((sum, t) => sum + t.poids, 0);
        tour.bacsReels = tasks.reduce((sum, t) => sum + t.items, 0);
        
        if (tasks.length > 0) {
            const plannedTasks = [...tasks].sort((a,b) => a.heureArriveeApprox - b.heureArriveeApprox);
            const firstPlannedTask = plannedTasks[0];
            const lastPlannedTask = plannedTasks[tasks.length - 1];
            
            const realTasks = [...tasks].sort((a,b) => a.heureArriveeReelle - b.heureArriveeReelle);
            const firstRealTask = realTasks[0];
            const lastRealTask = realTasks[tasks.length - 1];

            tour.dureeEstimeeOperationnelle = lastPlannedTask.heureArriveeApprox - firstPlannedTask.heureArriveeApprox;
            tour.dureeReelleCalculee = lastRealTask.heureCloture - firstRealTask.heureArriveeReelle;
            
            tour.heurePremiereLivraisonPrevue = firstPlannedTask.heureArriveeApprox;
            tour.heurePremiereLivraisonReelle = firstRealTask.heureArriveeReelle;
            tour.heureDerniereLivraisonPrevue = lastPlannedTask.heureArriveeApprox;
            tour.heureDerniereLivraisonReelle = lastRealTask.heureCloture;

        } else {
            tour.dureeReelleCalculee = 0;
            tour.dureeEstimeeOperationnelle = 0;
            tour.heurePremiereLivraisonPrevue = 0;
            tour.heurePremiereLivraisonReelle = 0;
            tour.heureDerniereLivraisonPrevue = 0;
            tour.heureDerniereLivraisonReelle = 0;
        }
    });

    const uniqueTournees = Array.from(tourneeMap.values()).map(data => data.tour);

    // --- KPI Calculations ---
    const tasksOnTime = completedTasks.filter(t => t.retardStatus === 'onTime');
    const lateTasks = completedTasks.filter(t => t.retardStatus === 'late');
    const earlyTasks = completedTasks.filter(t => t.retardStatus === 'early');
    const outOfTimeTasks = lateTasks.length + earlyTasks.length;

    const predictedTasksOnTime = completedTasks.filter(t => t.retardPrevisionnelStatus === 'onTime');
    const predictedOutOfTimeTasks = completedTasks.length - predictedTasksOnTime.length;

    const punctualityRate = completedTasks.length > 0 ? (tasksOnTime.length / completedTasks.length) * 100 : 100;
    const predictedPunctualityRate = completedTasks.length > 0 ? (predictedTasksOnTime.length / completedTasks.length) * 100 : 100;
    
    const avgRatingData = completedTasks.filter(t => t.notation != null && t.notation > 0);
    const avgRating = avgRatingData.length > 0 ? avgRatingData.reduce((acc, t) => acc + t.notation!, 0) / avgRatingData.length : 0;
    
    const negativeReviews = completedTasks.filter(t => t.notation != null && t.notation <= 3);

    const generalKpis: Kpi[] = [
        { title: 'Tournées Analysées', value: uniqueTournees.length.toString(), icon: 'Truck' },
        { title: 'Livraisons Analysées', value: completedTasks.length.toString(), icon: 'ListChecks' },
        { title: 'Taux de Ponctualité (Réalisé)', value: `${punctualityRate.toFixed(1)}%`, description: `Seuil de tolérance: ±${toleranceMinutes} min`, icon: 'Clock' },
        { title: 'Notation Moyenne Client', value: avgRating.toFixed(2), description: `Basé sur ${avgRatingData.length} avis (sur 5)`, icon: 'Star' },
        { title: 'Livraisons en Retard', value: lateTasks.length.toString(), description: `> ${toleranceMinutes} min après le créneau`, icon: 'Frown' },
        { title: 'Livraisons en Avance', value: earlyTasks.length.toString(), description: `< -${toleranceMinutes} min avant le créneau`, icon: 'Smile' },
        { title: 'Avis Négatifs', value: negativeReviews.length.toString(), description: 'Note client de 1 à 3 / 5', icon: 'MessageSquareX' },
    ];
    
    // --- Discrepancy KPIs ---
    const totals = uniqueTournees.reduce((acc, tour) => {
        acc.dureePrevue += tour.dureeEstimeeOperationnelle || 0;
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
        { title: 'Écart de Kilométrage Total', value1: `${totals.distancePrevue.toFixed(1)} km`, label1: 'Planifié', value2: `${totals.distanceReelle.toFixed(1)} km`, label2: 'Réalisé', change: `${(Math.abs(totals.distanceReelle - totals.distancePrevue)).toFixed(1)} km`, changeType: totals.distanceReelle > totals.distanceReelle ? 'increase' : 'decrease' },
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
    }).filter(t => t.isOverloaded)
      .sort((a,b) => b.tauxDepassementPoids - a.tauxDepassementPoids || b.tauxDepassementBacs - a.tauxDepassementBacs);
    
    const durationDiscrepancies: DurationDiscrepancy[] = uniqueTournees.map(tour => ({
        ...tour,
        dureeEstimee: tour.dureeEstimeeOperationnelle || 0,
        dureeReelle: tour.dureeReelleCalculee || 0,
        ecart: (tour.dureeReelleCalculee || 0) - (tour.dureeEstimeeOperationnelle || 0),
        heurePremiereLivraisonPrevue: tour.heurePremiereLivraisonPrevue || 0,
        heurePremiereLivraisonReelle: tour.heurePremiereLivraisonReelle || 0,
        heureDerniereLivraisonPrevue: tour.heureDerniereLivraisonPrevue || 0,
        heureDerniereLivraisonReelle: tour.heureDerniereLivraisonReelle || 0,
    })).filter(t => t.ecart > 0).sort((a, b) => b.ecart - a.ecart);


    const lateStartAnomalies: LateStartAnomaly[] = Array.from(tourneeMap.values())
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
        }))
        .sort((a, b) => b.tasksInDelay - a.tasksInDelay);

    // --- Quality Impact KPIs ---
    const overloadedToursIds = new Set(overloadedToursInfos.map(t => t.uniqueId));
    
    const tasksOnOverloadedTours = completedTasks.filter(t => t.tournee && overloadedToursIds.has(t.tournee.uniqueId));
    const tasksOnNonOverloadedTours = completedTasks.filter(t => !t.tournee || !overloadedToursIds.has(t.tournee.uniqueId));

    const negativeReviewsOnOverloadedTours = tasksOnOverloadedTours.filter(t => t.notation != null && t.notation <= 3);
    const negativeReviewsOnNonOverloadedTours = tasksOnNonOverloadedTours.filter(t => t.notation != null && t.notation <= 3);

    const rateBadReviewsOverloaded = tasksOnOverloadedTours.length > 0 ? (negativeReviewsOnOverloadedTours.length / tasksOnOverloadedTours.length) * 100 : 0;
    const rateBadReviewsNonOverloaded = tasksOnNonOverloadedTours.length > 0 ? (negativeReviewsOnNonOverloadedTours.length / tasksOnNonOverloadedTours.length) * 100 : 0;

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
    
    const qualityKpis: (Kpi | ComparisonKpi)[] = [
        { title: 'Corrélation Retards / Avis Négatifs', value: `${correlationDelays.toFixed(1)}%`, icon: 'BarChart' },
        badReviewsOnOverloadKpi,
        { title: 'Anomalies en Tournée', value: lateStartAnomalies.length.toString(), icon: 'Route' },
    ];
    
    // --- Performance & Context Analysis ---
    const performanceByDriver = calculatePerformanceByDriver(Array.from(tourneeMap.values()), toleranceSeconds);
    const performanceByCity = calculatePerformanceByGeo(completedTasks, tourneeMap, 'ville', toleranceSeconds);
    const performanceByPostalCode = calculatePerformanceByGeo(completedTasks, tourneeMap, 'codePostal', toleranceSeconds);

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
    const tasksByHour: Record<string, { 
        planned: number, 
        real: number, 
        delays: number, 
        advances: number, 
        plannedTours: Set<string>, 
        realTours: Set<string> 
    }> = {};

    for (let i = 0; i < 24; i++) {
        const hourStr = `${String(i).padStart(2, '0')}:00`;
        tasksByHour[hourStr] = { planned: 0, real: 0, delays: 0, advances: 0, plannedTours: new Set(), realTours: new Set() };
    }

    completedTasks.forEach(task => {
        // Realized
        const realHourIndex = new Date(task.heureCloture * 1000).getUTCHours();
        const realHourStr = `${String(realHourIndex).padStart(2, '0')}:00`;
        if (tasksByHour[realHourStr]) {
            tasksByHour[realHourStr].real++;
            tasksByHour[realHourStr].realTours.add(task.tourneeUniqueId);
            if (task.retardStatus === 'late') {
                tasksByHour[realHourStr].delays++;
            } else if (task.retardStatus === 'early') {
                tasksByHour[realHourStr].advances++;
            }
        }

        // Planned (based on approximate arrival time)
        const plannedHourIndex = new Date(task.heureArriveeApprox * 1000).getUTCHours();
        const plannedHourStr = `${String(plannedHourIndex).padStart(2, '0')}:00`;
        if (tasksByHour[plannedHourStr]) {
            tasksByHour[plannedHourStr].planned++;
            tasksByHour[plannedHourStr].plannedTours.add(task.tourneeUniqueId);
        }
    });

    Object.entries(tasksByHour).forEach(([hour, data]) => {
        workloadByHour.push({ hour, planned: data.planned, real: data.real, delays: data.delays, advances: data.advances });
        
        const plannedTourCount = data.plannedTours.size;
        const realTourCount = data.realTours.size;
        
        avgWorkloadByHour.push({ 
            hour, 
            avgPlanned: plannedTourCount > 0 ? data.planned / plannedTourCount : 0,
            avgReal: realTourCount > 0 ? data.real / realTourCount : 0 
        });
    });

    const totalAvgPlanned = avgWorkloadByHour.reduce((sum, item) => sum + item.avgPlanned, 0);
    const totalAvgReal = avgWorkloadByHour.reduce((sum, item) => sum + item.avgReal, 0);
    const avgWorkload: AvgWorkload = {
      avgPlanned: avgWorkloadByHour.length > 0 ? totalAvgPlanned / avgWorkloadByHour.filter(h => h.avgPlanned > 0).length : 0,
      avgReal: avgWorkloadByHour.length > 0 ? totalAvgReal / avgWorkloadByHour.filter(h => h.avgReal > 0).length : 0
    }
    
    // --- New Analyses ---
    const performanceByDayOfWeek = calculatePerformanceByDayOfWeek(completedTasks, toleranceSeconds);
    const performanceByTimeSlot = calculatePerformanceByTimeSlot(completedTasks);
    const delayHistogram = createDelayHistogram(completedTasks);

    // --- New Summary Tables Data ---
    const globalSummary: GlobalSummary = {
        punctualityRatePlanned: predictedPunctualityRate,
        punctualityRateRealized: punctualityRate,
        avgDurationDiscrepancyPerTour: uniqueTournees.length > 0 ? (totals.dureeReelleCalculee - totals.dureePrevue) / uniqueTournees.length : 0,
        avgWeightDiscrepancyPerTour: uniqueTournees.length > 0 ? (totals.poidsReel - totals.poidsPrevu) / uniqueTournees.length : 0,
        weightOverrunPercentage: totals.poidsPrevu > 0 ? ((totals.poidsReel - totals.poidsPrevu) / totals.poidsPrevu) * 100 : 0,
        durationOverrunPercentage: totals.dureePrevue > 0 ? ((totals.dureeReelleCalculee - totals.dureePrevue) / totals.dureePrevue) * 100 : 0,
    };
    
    const performanceByDepot = calculatePerformanceByGroup(completedTasks, tourneeMap, (task) => task.tournee!.entrepot.split(' ')[0], toleranceSeconds);
    const performanceByWarehouse = calculatePerformanceByGroup(completedTasks, tourneeMap, (task) => task.tournee!.entrepot, toleranceSeconds);


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
        avgWorkloadByDriverByHour: avgWorkloadByHour,
        avgWorkload,
        performanceByDayOfWeek,
        performanceByTimeSlot,
        delayHistogram,
        cities: [...new Set(completedTasks.map(t => t.ville))].sort(),
        globalSummary,
        performanceByDepot,
        performanceByWarehouse
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
        avgWorkloadByDriverByHour: [],
        avgWorkload: { avgPlanned: 0, avgReal: 0 },
        performanceByDayOfWeek: [],
        performanceByTimeSlot: [],
        delayHistogram: [],
        cities: [],
        globalSummary: { punctualityRatePlanned: 0, punctualityRateRealized: 0, avgDurationDiscrepancyPerTour: 0, avgWeightDiscrepancyPerTour: 0, weightOverrunPercentage: 0, durationOverrunPercentage: 0 },
        performanceByDepot: [],
        performanceByWarehouse: []
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

function calculatePerformanceByGeo(tasks: MergedData[], tourneeMap: Map<string, { tour: Tournee, tasks: MergedData[] }>, key: 'ville' | 'codePostal', toleranceSeconds: number): PerformanceByGeo[] {
    const geoGroups = new Map<string, { tasks: MergedData[], tournees: Set<string> }>();

    tasks.forEach(task => {
        const geoKey = task[key];
        if (!geoKey || !task.tournee) return;

        if (!geoGroups.has(geoKey)) {
            geoGroups.set(geoKey, { tasks: [], tournees: new Set() });
        }
        const group = geoGroups.get(geoKey)!;
        group.tasks.push(task);
        group.tournees.add(task.tournee.uniqueId);
    });

    return Array.from(geoGroups.entries()).map(([geoKey, data]) => {
        const totalTasks = data.tasks.length;
        const onTimeTasks = data.tasks.filter(t => t.retardStatus === 'onTime').length;
        const onTimePlannedTasks = data.tasks.filter(t => t.retardPrevisionnelStatus === 'onTime').length;
        
        const lateTasks = data.tasks.filter(t => t.retardStatus === 'late');
        const lateTasksWithBadReview = lateTasks.filter(t => t.notation != null && t.notation <= 3);

        const groupTournees = Array.from(data.tournees).map(id => tourneeMap.get(id)?.tour).filter(Boolean) as Tournee[];

        const totalDurationDiscrepancy = groupTournees.reduce((sum, tour) => sum + ((tour.dureeReelleCalculee || 0) - (tour.dureeEstimeeOperationnelle || 0)), 0);
        const totalWeightDiscrepancy = groupTournees.reduce((sum, tour) => sum + (tour.poidsReel - tour.poidsPrevu), 0);

        return {
            key: geoKey,
            totalTasks: totalTasks,
            punctualityRatePlanned: totalTasks > 0 ? (onTimePlannedTasks / totalTasks) * 100 : 100,
            punctualityRateRealized: totalTasks > 0 ? (onTimeTasks / totalTasks) * 100 : 100,
            avgDurationDiscrepancy: data.tournees.size > 0 ? totalDurationDiscrepancy / data.tournees.size : 0,
            avgWeightDiscrepancy: data.tournees.size > 0 ? totalWeightDiscrepancy / data.tournees.size : 0,
            lateWithBadReviewPercentage: lateTasks.length > 0 ? (lateTasksWithBadReview.length / lateTasks.length) * 100 : 0
        };
    }).sort((a,b) => (b.punctualityRatePlanned - b.punctualityRateRealized) - (a.punctualityRatePlanned - a.punctualityRateRealized));
}

function calculatePerformanceByGroup(tasks: MergedData[], tourneeMap: Map<string, { tour: Tournee, tasks: MergedData[] }>, keyGetter: (task: MergedData) => string, toleranceSeconds: number): PerformanceByGroup[] {
    const groups = new Map<string, { tasks: MergedData[], tournees: Set<string> }>();

    tasks.forEach(task => {
        if (!task.tournee) return;
        const key = keyGetter(task);
        if (!key) return;

        if (!groups.has(key)) {
            groups.set(key, { tasks: [], tournees: new Set() });
        }
        const group = groups.get(key)!;
        group.tasks.push(task);
        group.tournees.add(task.tournee.uniqueId);
    });

    return Array.from(groups.entries()).map(([key, data]) => {
        const totalTasks = data.tasks.length;
        const onTimeTasks = data.tasks.filter(t => t.retardStatus === 'onTime').length;
        const onTimePlannedTasks = data.tasks.filter(t => t.retardPrevisionnelStatus === 'onTime').length;
        
        const lateTasks = data.tasks.filter(t => t.retardStatus === 'late');
        const lateTasksWithBadReview = lateTasks.filter(t => t.notation != null && t.notation <= 3);

        const groupTournees = Array.from(data.tournees).map(id => tourneeMap.get(id)?.tour).filter(Boolean) as Tournee[];

        const totalDurationDiscrepancy = groupTournees.reduce((sum, tour) => sum + ((tour.dureeReelleCalculee || 0) - (tour.dureeEstimeeOperationnelle || 0)), 0);
        const totalWeightDiscrepancy = groupTournees.reduce((sum, tour) => sum + (tour.poidsReel - tour.poidsPrevu), 0);

        return {
            key: key,
            totalTasks: totalTasks,
            punctualityRatePlanned: totalTasks > 0 ? (onTimePlannedTasks / totalTasks) * 100 : 100,
            punctualityRateRealized: totalTasks > 0 ? (onTimeTasks / totalTasks) * 100 : 100,
            avgDurationDiscrepancy: data.tournees.size > 0 ? totalDurationDiscrepancy / data.tournees.size : 0,
            avgWeightDiscrepancy: data.tournees.size > 0 ? totalWeightDiscrepancy / data.tournees.size : 0,
            lateWithBadReviewPercentage: lateTasks.length > 0 ? (lateTasksWithBadReview.length / lateTasks.length) * 100 : 0
        };
    }).sort((a, b) => (b.punctualityRatePlanned - b.punctualityRateRealized) - (a.punctualityRatePlanned - a.punctualityRateRealized));
}


function calculatePerformanceByDayOfWeek(tasks: MergedData[], toleranceSeconds: number): PerformanceByDay[] {
    const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const daysData: Record<number, { totalTasks: number; lateTasks: MergedData[]; earlyTasks: MergedData[] }> = {};

    for (let i = 0; i < 7; i++) {
        daysData[i] = { totalTasks: 0, lateTasks: [], earlyTasks: [] };
    }

    tasks.forEach(task => {
        if (task.date) {
            const dayIndex = getDay(new Date(task.date)); // Sunday = 0, Monday = 1...
            daysData[dayIndex].totalTasks++;
            if (task.retardStatus === 'late') {
                daysData[dayIndex].lateTasks.push(task);
            } else if (task.retardStatus === 'early') {
                daysData[dayIndex].earlyTasks.push(task);
            }
        }
    });

    return Object.entries(daysData).map(([dayIndex, data]) => {
        const totalTasks = data.totalTasks;
        const delays = data.lateTasks.length;
        const advances = data.earlyTasks.length;
        const sumOfDelays = data.lateTasks.reduce((sum, task) => sum + task.retard, 0);

        return {
            day: dayNames[parseInt(dayIndex)],
            totalTasks,
            punctualityRate: totalTasks > 0 ? ((totalTasks - delays) / totalTasks) * 100 : 100,
            avgDelay: delays > 0 ? (sumOfDelays / delays) / 60 : 0,
            delays,
            advances
        };
    });
}

function calculatePerformanceByTimeSlot(tasks: MergedData[]): PerformanceByTimeSlot[] {
    const slots: Record<string, { totalTasks: number; lateTasks: MergedData[]; earlyTasks: MergedData[] }> = {};

    // Create 2-hour slots from 00:00 to 22:00
    for (let i = 0; i < 24; i += 2) {
        const start = String(i).padStart(2, '0');
        const end = String(i + 2).padStart(2, '0');
        slots[`${start}h-${end}h`] = { totalTasks: 0, lateTasks: [], earlyTasks: [] };
    }

    tasks.forEach(task => {
        const startHour = Math.floor(task.heureDebutCreneau / 3600);
        // Find the correct 2-hour slot
        const slotHour = Math.floor(startHour / 2) * 2;
        const startSlot = String(slotHour).padStart(2, '0');
        const endSlot = String(slotHour + 2).padStart(2, '0');
        const slotKey = `${startSlot}h-${endSlot}h`;

        if (slots[slotKey]) {
            slots[slotKey].totalTasks++;
            if (task.retardStatus === 'late') {
                slots[slotKey].lateTasks.push(task);
            } else if (task.retardStatus === 'early') {
                slots[slotKey].earlyTasks.push(task);
            }
        }
    });

    return Object.entries(slots).map(([slotName, data]) => {
        const totalTasks = data.totalTasks;
        const delays = data.lateTasks.length;
        const advances = data.earlyTasks.length;
        const sumOfDelays = data.lateTasks.reduce((sum, task) => sum + task.retard, 0);

        return {
            slot: slotName,
            totalTasks,
            punctualityRate: totalTasks > 0 ? ((totalTasks - delays) / totalTasks) * 100 : 100,
            avgDelay: delays > 0 ? (sumOfDelays / delays) / 60 : 0,
            delays,
            advances
        };
    }).filter(s => s.totalTasks > 0); // Only return slots with data
}


function createDelayHistogram(tasks: MergedData[]): DelayHistogramBin[] {
    const bins: { [key: string]: { min: number, max: number, count: number } } = {
        '> 60 min en avance': { min: -Infinity, max: -3601, count: 0 },
        '30-60 min en avance': { min: -3600, max: -1801, count: 0 },
        '15-30 min en avance': { min: -1800, max: -901, count: 0 },
        'À l\'heure (-15 à +15 min)': { min: -900, max: 900, count: 0 },
        '15-30 min de retard': { min: 901, max: 1800, count: 0 },
        '30-60 min de retard': { min: 1801, max: 3600, count: 0 },
        '> 60 min de retard': { min: 3601, max: Infinity, count: 0 },
    };

    tasks.forEach(task => {
        for (const key in bins) {
            if (task.retard >= bins[key].min && task.retard <= bins[key].max) {
                bins[key].count++;
                break;
            }
        }
    });
    
    const sortedBinKeys = [
        '> 60 min en avance',
        '30-60 min en avance',
        '15-30 min en avance',
        'À l\'heure (-15 à +15 min)',
        '15-30 min de retard',
        '30-60 min de retard',
        '> 60 min de retard'
    ];

    return sortedBinKeys.map(key => ({
        range: key,
        count: bins[key].count
    }));
}



function formatSeconds(seconds: number): string {
    if (seconds < 0) seconds = 0;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m < 10 ? '0' : ''}${m}m`;
}

    
