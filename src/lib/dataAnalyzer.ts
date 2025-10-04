
import type { MergedData, AnalysisData, Tournee, DepotStats } from './types';
import { getDay } from 'date-fns';
import { getNomDepot } from './config-depots';

// #region Main Analysis Function
export function analyzeData(data: MergedData[], filters: Record<string, any>): AnalysisData {
    const toleranceSeconds = filters.punctualityThreshold || 900;
    const lateTourTolerance = filters.lateTourTolerance || 0;

    const completedTasks = data.filter(t => t.tournee && t.avancement?.toLowerCase() === 'complétée' && t.heureCloture > 0 && t.heureDebutCreneau > 0 && t.heureFinCreneau > 0);
    
    if (completedTasks.length === 0) {
        return createEmptyAnalysisData();
    }

    // --- Pre-calculation per task ---
    completedTasks.forEach(task => {
        const { heureCloture, heureDebutCreneau, heureFinCreneau } = task;

        if (heureCloture < heureDebutCreneau - toleranceSeconds) {
            task.retardStatus = 'early';
        } else if (heureCloture > heureFinCreneau + toleranceSeconds) {
            task.retardStatus = 'late';
        } else {
            task.retardStatus = 'onTime';
        }
        
        if (task.retardStatus === 'early') {
            task.retard = heureCloture - heureDebutCreneau;
        } else {
            task.retard = heureCloture - heureFinCreneau;
        }

        // Predicted delay
        const approx = task.heureArriveeApprox;
        if (approx < heureDebutCreneau - toleranceSeconds) {
            task.retardPrevisionnelStatus = 'early';
            task.retardPrevisionnelS = approx - heureDebutCreneau;
        } else if (approx > heureFinCreneau + toleranceSeconds) {
            task.retardPrevisionnelStatus = 'late';
            task.retardPrevisionnelS = approx - heureFinCreneau;
        } else {
            task.retardPrevisionnelStatus = 'onTime';
            task.retardPrevisionnelS = approx - heureFinCreneau;
        }
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

    const uniqueTournees = Array.from(tourneeMap.values())
        .filter(data => data.tasks.length > 0)
        .map(data => data.tour);

    tourneeMap.forEach(({ tour, tasks }) => {
        if (tasks.length > 0) {
            tour.poidsReel = tasks.reduce((sum, t) => sum + t.poids, 0);
            tour.bacsReels = tasks.reduce((sum, t) => sum + t.items, 0);
            const firstRealTask = tasks.sort((a,b) => a.heureArriveeReelle - b.heureArriveeReelle)[0];
            const lastRealTask = tasks.sort((a,b) => a.heureCloture - b.heureCloture).slice(-1)[0];
            tour.dureeReelleCalculee = lastRealTask.heureCloture - firstRealTask.heureArriveeReelle;
        } else {
            tour.dureeReelleCalculee = 0;
        }
    });

    // --- Calculations ---
    const { lateTasks, earlyTasks, punctualityRate, predictedPunctualityRate, outOfTimeTasks, predictedOutOfTimeTasks } = getPunctualityStats(completedTasks, toleranceSeconds);

    const generalKpis = calculateKpis(completedTasks, uniqueTournees, toleranceSeconds);
    const discrepancyKpis = calculateDiscrepancyKpis(uniqueTournees, punctualityRate, predictedPunctualityRate, outOfTimeTasks, predictedOutOfTimeTasks);
    
    const { overloadedTours, durationDiscrepancies, lateStartAnomalies } = calculateAnomalies(tourneeMap, uniqueTournees);
    const qualityKpis = calculateQualityKpis(completedTasks, overloadedTours, lateStartAnomalies, uniqueTournees.length);

    const performanceByDriver = calculatePerformanceByDriver(Array.from(tourneeMap.values()));
    const performanceByCity = calculatePerformanceByGeo(completedTasks, tourneeMap, 'ville');
    const performanceByPostalCode = calculatePerformanceByGeo(completedTasks, tourneeMap, 'codePostal');
    const performanceByDepot = calculatePerformanceByGroup(completedTasks, tourneeMap, (task) => getNomDepot(task.tournee!.entrepot));
    const performanceByWarehouse = calculatePerformanceByGroup(completedTasks, tourneeMap, (task) => task.tournee!.entrepot);

    const temporalAnalyses = calculateTemporalAnalyses(lateTasks, earlyTasks, completedTasks, toleranceSeconds);
    const workloadAnalyses = calculateWorkloadAnalyses(completedTasks);

    const firstTaskLatePercentage = uniqueTournees.length > 0 ? (lateStartAnomalies.length / uniqueTournees.length) * 100 : 0;
    
    const globalSummary = calculateGlobalSummary(uniqueTournees, predictedPunctualityRate, punctualityRate);
    
    const depotStats = calculateDepotStats(completedTasks, toleranceSeconds, lateTourTolerance);
    const warehouseStats = calculateWarehouseStats(completedTasks, toleranceSeconds, lateTourTolerance);
    const postalCodeStats = calculatePostalCodeStats(completedTasks);
    const saturationData = calculateSaturationData(completedTasks);
    const customerPromiseData = calculateCustomerPromiseData(completedTasks);
    const simulationData = calculateSimulationData(completedTasks);

    return {
        generalKpis,
        discrepancyKpis,
        qualityKpis,
        overloadedTours,
        durationDiscrepancies,
        lateStartAnomalies,
        performanceByDriver,
        performanceByCity,
        performanceByPostalCode,
        ...temporalAnalyses,
        ...workloadAnalyses,
        cities: [...new Set(completedTasks.map(t => t.ville))].filter(Boolean).sort(),
        depots: [...new Set(completedTasks.map(t => getNomDepot(t.tournee!.entrepot)))].filter(Boolean).sort(),
        warehouses: [...new Set(completedTasks.map(t => t.tournee!.entrepot))].filter(Boolean).sort(),
        globalSummary,
        performanceByDepot,
        performanceByWarehouse,
        firstTaskLatePercentage,
        depotStats,
        warehouseStats,
        postalCodeStats,
        saturationData,
        customerPromiseData,
        ...simulationData,
        rawData: data,
        filteredData: completedTasks,
    };
}
// #endregion

// #region KPI Calculations
function calculateKpis(completedTasks: MergedData[], uniqueTournees: Tournee[], toleranceSeconds: number): AnalysisData['generalKpis'] {
    const punctualityRate = getPunctualityStats(completedTasks, toleranceSeconds).punctualityRate;
    const lateTasks = completedTasks.filter(t => t.retardStatus === 'late');
    const earlyTasks = completedTasks.filter(t => t.retardStatus === 'early');
    const avgRatingData = completedTasks.filter(t => t.notation != null && t.notation > 0);
    const avgRating = avgRatingData.length > 0 ? avgRatingData.reduce((acc, t) => acc + t.notation!, 0) / avgRatingData.length : 0;
    const negativeReviews = completedTasks.filter(t => t.notation != null && t.notation <= 3);

    return [
        { title: 'Tournées Analysées', value: uniqueTournees.length.toString(), icon: 'Truck' },
        { title: 'Livraisons Analysées', value: completedTasks.length.toString(), icon: 'ListChecks' },
        { title: `Taux de Ponctualité (Réalisé)`, value: `${punctualityRate.toFixed(1)}%`, description: `Seuil: +/- 15 min`, icon: 'Clock' },
        { title: 'Notation Moyenne Client', value: avgRating.toFixed(2), description: `sur ${avgRatingData.length} avis`, icon: 'Star' },
        { title: 'Livraisons en Retard', value: lateTasks.length.toString(), description: `> 15 min après créneau`, icon: 'Frown' },
        { title: 'Livraisons en Avance', value: earlyTasks.length.toString(), description: `< 15 min avant créneau`, icon: 'Smile' },
        { title: 'Avis Négatifs', value: negativeReviews.length.toString(), description: 'Note de 1 à 3 / 5', icon: 'MessageSquareX' },
    ];
}

function calculateDiscrepancyKpis(uniqueTournees: Tournee[], punctualityRate: number, predictedPunctualityRate: number, outOfTimeTasks: number, predictedOutOfTimeTasks: number): AnalysisData['discrepancyKpis'] {
    const totals = uniqueTournees.reduce((acc, tour) => {
        acc.dureePrevue += tour.dureePrevue || 0;
        acc.dureeReelleCalculee += tour.dureeReelleCalculee || 0;
        acc.poidsPrevu += tour.poidsPrevu || 0;
        acc.poidsReel += tour.poidsReel || 0;
        acc.distancePrevue += tour.distancePrevue || 0;
        acc.distanceReelle += tour.distanceReelle || 0;
        return acc;
    }, { dureePrevue: 0, dureeReelleCalculee: 0, poidsPrevu: 0, poidsReel: 0, distancePrevue: 0, distanceReelle: 0 });

    return [
        { title: 'Taux de Ponctualité', value1: `${predictedPunctualityRate.toFixed(1)}%`, label1: 'Planifié', value2: `${punctualityRate.toFixed(1)}%`, label2: 'Réalisé', change: `${(Math.abs(punctualityRate - predictedPunctualityRate)).toFixed(1)} pts`, changeType: punctualityRate < predictedPunctualityRate ? 'increase' : 'decrease' },
        { title: 'Écart de Durée Totale', value1: formatSeconds(totals.dureePrevue), label1: 'Planifié', value2: formatSeconds(totals.dureeReelleCalculee), label2: 'Réalisé', change: formatSeconds(Math.abs(totals.dureeReelleCalculee - totals.dureePrevue)), changeType: totals.dureeReelleCalculee > totals.dureePrevue ? 'increase' : 'decrease' },
        { title: 'Écart de Poids Total', value1: `${(totals.poidsPrevu / 1000).toFixed(2)} t`, label1: 'Planifié', value2: `${(totals.poidsReel / 1000).toFixed(2)} t`, label2: 'Réalisé', change: `${(Math.abs(totals.poidsReel - totals.poidsPrevu) / 1000).toFixed(2)} t`, changeType: totals.poidsReel > totals.poidsPrevu ? 'increase' : 'decrease' },
    ];
}

function calculateQualityKpis(completedTasks: MergedData[], overloadedTours: AnalysisData['overloadedTours'], lateStartAnomalies: AnalysisData['lateStartAnomalies'], totalTours: number): AnalysisData['qualityKpis'] {
    const negativeReviews = completedTasks.filter(t => t.notation != null && t.notation <= 3);
    const overloadedToursIds = new Set(overloadedTours.map(t => t.uniqueId));
    
    const ratedTasksOnOverloadedTours = completedTasks.filter(t => t.notation != null && t.tournee && overloadedToursIds.has(t.tournee.uniqueId));
    const ratedTasksOnNonOverloadedTours = completedTasks.filter(t => t.notation != null && (!t.tournee || !overloadedToursIds.has(t.tournee.uniqueId)));

    const negativeReviewsOnOverloadedTours = ratedTasksOnOverloadedTours.filter(t => t.notation! <= 3);
    const negativeReviewsOnNonOverloadedTours = ratedTasksOnNonOverloadedTours.filter(t => t.notation! <= 3);

    const rateBadReviewsOverloaded = ratedTasksOnOverloadedTours.length > 0 ? (negativeReviewsOnOverloadedTours.length / ratedTasksOnOverloadedTours.length) * 100 : 0;
    const rateBadReviewsNonOverloaded = ratedTasksOnNonOverloadedTours.length > 0 ? (negativeReviewsOnNonOverloadedTours.length / ratedTasksOnNonOverloadedTours.length) * 100 : 0;

    const badReviewsOnOverloadKpi = {
        title: "Taux d'Avis Négatifs (Surcharge vs. Standard)",
        value1: `${rateBadReviewsOverloaded.toFixed(1)}%`, label1: 'Surchargées',
        value2: `${rateBadReviewsNonOverloaded.toFixed(1)}%`, label2: 'Standard',
        change: `${(rateBadReviewsOverloaded - rateBadReviewsNonOverloaded).toFixed(1)} pts`,
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
// #endregion

// #region Anomaly Calculations
function calculateAnomalies(tourneeMap: Map<string, { tour: Tournee, tasks: MergedData[] }>, uniqueTournees: Tournee[]) {
    const overloadedTours = calculateOverloadedTours(uniqueTournees);
    const durationDiscrepancies = calculateDurationDiscrepancies(uniqueTournees);
    const lateStartAnomalies = calculateLateStartAnomalies(tourneeMap);
    
    return { overloadedTours, durationDiscrepancies, lateStartAnomalies };
}

function calculateOverloadedTours(uniqueTournees: Tournee[]): AnalysisData['overloadedTours'] {
    return uniqueTournees.map(tour => ({
        ...tour,
        depassementPoids: tour.poidsReel - tour.capacitePoids,
    })).filter(t => t.capacitePoids > 0 && t.poidsReel > t.capacitePoids)
      .sort((a,b) => b.depassementPoids - a.depassementPoids);
}

function calculateDurationDiscrepancies(uniqueTournees: Tournee[]): AnalysisData['durationDiscrepancies'] {
    return uniqueTournees.map(tour => ({
        ...tour,
        ecart: (tour.dureeReelleCalculee || 0) - (tour.dureePrevue || 0),
    })).filter(t => t.ecart > 0).sort((a, b) => b.ecart - a.ecart);
}

function calculateLateStartAnomalies(tourneeMap: Map<string, { tour: Tournee, tasks: MergedData[] }>): AnalysisData['lateStartAnomalies'] {
    return Array.from(tourneeMap.values())
         .filter(({ tour, tasks }) => {
             const startDeparture = tour.heureDepartReelle;
             const plannedDeparture = tour.heureDepartPrevue;
             const hasLateTasks = tasks.some(t => t.retardStatus === 'late');
             return startDeparture > 0 && plannedDeparture > 0 && startDeparture <= plannedDeparture && hasLateTasks;
         })
         .map(({tour, tasks}) => ({
             ...tour,
             tasksInDelay: tasks.filter(t => t.retardStatus === 'late').length
         }))
        .sort((a, b) => b.tasksInDelay - a.tasksInDelay);
}
// #endregion

// #region Performance Calculations
function calculatePerformanceByDriver(toursWithTasks: { tour: Tournee, tasks: MergedData[] }[]): AnalysisData['performanceByDriver'] {
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
        
        if (tour.capacitePoids > 0 && tour.poidsReel > tour.capacitePoids) {
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

function calculatePerformanceByGeo(tasks: MergedData[], tourneeMap: Map<string, { tour: Tournee, tasks: MergedData[] }>, key: 'ville' | 'codePostal'): AnalysisData['performanceByCity'] {
    const geoGroups = new Map<string, { tasks: MergedData[], tournees: Set<string> }>();

    tasks.forEach(task => {
        const geoKey = task[key];
        if (!geoKey || !task.tournee) return;

        if (!geoGroups.has(geoKey)) {
            geoGroups.set(geoKey, { tasks: [], tournees: new Set() });
        }
        geoGroups.get(geoKey)!.tasks.push(task);
        geoGroups.get(geoKey)!.tournees.add(task.tournee.uniqueId);
    });

    return Array.from(geoGroups.entries()).map(([geoKey, data]) => {
        const totalTasks = data.tasks.length;
        const onTimeTasks = data.tasks.filter(t => t.retardStatus === 'onTime').length;
        const onTimePlannedTasks = data.tasks.filter(t => t.retardPrevisionnelStatus === 'onTime').length;
        const lateTasks = data.tasks.filter(t => t.retardStatus === 'late');
        const lateTasksWithBadReview = lateTasks.filter(t => t.notation != null && t.notation <= 3);
        const groupTournees = Array.from(data.tournees).map(id => tourneeMap.get(id)?.tour).filter(Boolean) as Tournee[];
        const totalDurationDiscrepancy = groupTournees.reduce((sum, tour) => sum + ((tour.dureeReelleCalculee || 0) - (tour.dureePrevue || 0)), 0);
        const totalWeightDiscrepancy = groupTournees.reduce((sum, tour) => sum + (tour.poidsReel - tour.poidsPrevu), 0);

        return {
            key: geoKey,
            totalTasks,
            punctualityRatePlanned: totalTasks > 0 ? (onTimePlannedTasks / totalTasks) * 100 : 100,
            punctualityRateRealized: totalTasks > 0 ? (onTimeTasks / totalTasks) * 100 : 100,
            avgDurationDiscrepancy: data.tournees.size > 0 ? totalDurationDiscrepancy / data.tournees.size : 0,
            avgWeightDiscrepancy: data.tournees.size > 0 ? totalWeightDiscrepancy / data.tournees.size : 0,
            lateWithBadReviewPercentage: lateTasks.length > 0 ? (lateTasksWithBadReview.length / lateTasks.length) * 100 : 0
        };
    }).sort((a,b) => (b.punctualityRatePlanned - b.punctualityRateRealized) - (a.punctualityRatePlanned - a.punctualityRateRealized));
}

function calculatePerformanceByGroup(tasks: MergedData[], tourneeMap: Map<string, { tour: Tournee, tasks: MergedData[] }>, keyGetter: (task: MergedData) => string): AnalysisData['performanceByDepot'] {
    const groups = new Map<string, { tasks: MergedData[], tournees: Set<string> }>();

    tasks.forEach(task => {
        if (!task.tournee) return;
        const key = keyGetter(task);
        if (!key) return;

        if (!groups.has(key)) groups.set(key, { tasks: [], tournees: new Set() });
        groups.get(key)!.tasks.push(task);
        groups.get(key)!.tournees.add(task.tournee.uniqueId);
    });

    return Array.from(groups.entries()).map(([key, data]) => {
        const totalTasks = data.tasks.length;
        const onTimeTasks = data.tasks.filter(t => t.retardStatus === 'onTime').length;
        const onTimePlannedTasks = data.tasks.filter(t => t.retardPrevisionnelStatus === 'onTime').length;
        const lateTasks = data.tasks.filter(t => t.retardStatus === 'late');
        const lateTasksWithBadReview = lateTasks.filter(t => t.notation != null && t.notation <= 3);
        const groupTournees = Array.from(data.tournees).map(id => tourneeMap.get(id)?.tour).filter(Boolean) as Tournee[];
        const totalDurationDiscrepancy = groupTournees.reduce((sum, tour) => sum + ((tour.dureeReelleCalculee || 0) - (tour.dureePrevue || 0)), 0);
        const totalWeightDiscrepancy = groupTournees.reduce((sum, tour) => sum + (tour.poidsReel - tour.poidsPrevu), 0);

        return {
            key,
            totalTasks,
            punctualityRatePlanned: totalTasks > 0 ? (onTimePlannedTasks / totalTasks) * 100 : 100,
            punctualityRateRealized: totalTasks > 0 ? (onTimeTasks / totalTasks) * 100 : 100,
            avgDurationDiscrepancy: data.tournees.size > 0 ? totalDurationDiscrepancy / data.tournees.size : 0,
            avgWeightDiscrepancy: data.tournees.size > 0 ? totalWeightDiscrepancy / data.tournees.size : 0,
            lateWithBadReviewPercentage: lateTasks.length > 0 ? (lateTasksWithBadReview.length / lateTasks.length) * 100 : 0
        };
    }).sort((a, b) => (b.punctualityRatePlanned - b.punctualityRateRealized) - (a.punctualityRatePlanned - a.punctualityRateRealized));
}
// #endregion

// #region Temporal Calculations
function calculateTemporalAnalyses(lateTasks: MergedData[], earlyTasks: MergedData[], completedTasks: MergedData[], toleranceSeconds: number) {
    const delaysByWarehouse = countItemsBy(lateTasks, (t) => t.tournee!.entrepot);
    const advancesByWarehouse = countItemsBy(earlyTasks, (t) => t.tournee!.entrepot);
    const delaysByHour = countByHour(lateTasks, 'heureArriveeReelle');
    const advancesByHour = countByHour(earlyTasks, 'heureArriveeReelle');
    const performanceByDayOfWeek = calculatePerformanceByDayOfWeek(completedTasks);
    const performanceByTimeSlot = calculatePerformanceByTimeSlot(completedTasks);
    const delayHistogram = createDelayHistogram(completedTasks, toleranceSeconds);

    return {
        delaysByWarehouse,
        delaysByHour,
        advancesByWarehouse,
        advancesByHour,
        performanceByDayOfWeek,
        performanceByTimeSlot,
        delayHistogram,
    }
}

function countItemsBy(tasks: MergedData[], keyGetter: (task: MergedData) => string): AnalysisData['delaysByWarehouse'] {
    const counts = tasks.reduce((acc, task) => {
        const key = keyGetter(task);
        if (key) acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return Object.entries(counts).map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
}

function countByHour(tasks: MergedData[], timeField: keyof MergedData): AnalysisData['delaysByHour'] {
    const counts = tasks.reduce((acc, task) => {
        const timeValue = task[timeField] as number;
        if (timeValue > 0) {
            const hour = new Date(timeValue * 1000).getUTCHours();
            const hourString = `${String(hour).padStart(2, '0')}:00`;
            acc[hourString] = (acc[hourString] || 0) + 1;
        }
        return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(counts).map(([hour, count]) => ({ hour, count })).sort((a, b) => a.hour.localeCompare(b.hour));
}

function calculatePerformanceByDayOfWeek(tasks: MergedData[]): AnalysisData['performanceByDayOfWeek'] {
    const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const daysData: Record<number, { totalTasks: number; lateTasks: MergedData[]; earlyTasks: MergedData[] }> = {};
    for (let i = 0; i < 7; i++) daysData[i] = { totalTasks: 0, lateTasks: [], earlyTasks: [] };

    tasks.forEach(task => {
        if (task.date) {
            const dayIndex = getDay(new Date(task.date)); // Sunday = 0
            daysData[dayIndex].totalTasks++;
            if (task.retardStatus === 'late') daysData[dayIndex].lateTasks.push(task);
            else if (task.retardStatus === 'early') daysData[dayIndex].earlyTasks.push(task);
        }
    });

    return Object.entries(daysData).map(([dayIndex, data]) => {
        const sumOfDelays = data.lateTasks.reduce((sum, task) => sum + (task.retard / 60), 0);
        return {
            day: dayNames[parseInt(dayIndex)],
            totalTasks: data.totalTasks,
            punctualityRate: data.totalTasks > 0 ? ((data.totalTasks - data.lateTasks.length) / data.totalTasks) * 100 : 100,
            avgDelay: data.lateTasks.length > 0 ? (sumOfDelays / data.lateTasks.length) : 0,
            delays: data.lateTasks.length,
            advances: data.earlyTasks.length,
        };
    });
}

function calculatePerformanceByTimeSlot(tasks: MergedData[]): AnalysisData['performanceByTimeSlot'] {
    const slots: Record<string, { totalTasks: number; lateTasks: MergedData[]; earlyTasks: MergedData[] }> = {
      'Matin (06-12h)': { totalTasks: 0, lateTasks: [], earlyTasks: [] },
      'Après-midi (12-18h)': { totalTasks: 0, lateTasks: [], earlyTasks: [] },
      'Soir (18-00h)': { totalTasks: 0, lateTasks: [], earlyTasks: [] }
    };

    tasks.forEach(task => {
        const startHour = Math.floor(task.heureDebutCreneau / 3600);
        let slotKey: string | null = null;
        if (startHour >= 6 && startHour < 12) slotKey = 'Matin (06-12h)';
        else if (startHour >= 12 && startHour < 18) slotKey = 'Après-midi (12-18h)';
        else if (startHour >= 18 && startHour < 24) slotKey = 'Soir (18-00h)';
        
        if (slotKey) {
            slots[slotKey].totalTasks++;
            if (task.retardStatus === 'late') slots[slotKey].lateTasks.push(task);
            else if (task.retardStatus === 'early') slots[slotKey].earlyTasks.push(task);
        }
    });

    return Object.entries(slots).map(([slotName, data]) => {
        const sumOfDelays = data.lateTasks.reduce((sum, task) => sum + (task.retard / 60), 0);
        return {
            slot: slotName,
            totalTasks: data.totalTasks,
            punctualityRate: data.totalTasks > 0 ? ((data.totalTasks - data.lateTasks.length) / data.totalTasks) * 100 : 100,
            avgDelay: data.lateTasks.length > 0 ? (sumOfDelays / data.lateTasks.length) : 0,
            delays: data.lateTasks.length,
            advances: data.earlyTasks.length,
        };
    }).filter(s => s.totalTasks > 0);
}

function createDelayHistogram(tasks: MergedData[], toleranceSeconds: number): AnalysisData['delayHistogram'] {
    const bins = [
        { label: `> 60 min avance`, range: [-Infinity, -3601], count: 0 },
        { label: `30-60 min avance`, range: [-3600, -1801], count: 0 },
        { label: `15-30 min avance`, range: [-1800, -toleranceSeconds -1], count: 0 },
        { label: 'À l\'heure', range: [-toleranceSeconds, toleranceSeconds], count: 0 },
        { label: `15-30 min retard`, range: [toleranceSeconds + 1, 1800], count: 0 },
        { label: `30-60 min retard`, range: [1801, 3600], count: 0 },
        { label: `> 60 min retard`, range: [3601, Infinity], count: 0 },
    ];

    tasks.forEach(task => {
        const retard = task.retard;
        for (const bin of bins) {
            if (retard >= bin.range[0] && retard <= bin.range[1]) {
                bin.count++;
                break;
            }
        }
    });

    return bins.map(b => ({ range: b.label, count: b.count }));
}
// #endregion

// #region Workload Calculations
function calculateWorkloadAnalyses(completedTasks: MergedData[]) {
    const workloadByHour = calculateWorkloadByHour(completedTasks);
    const { avgWorkloadByDriverBySlot, avgWorkload } = calculateAvgWorkloadBySlot(completedTasks);
    return { workloadByHour, avgWorkloadByDriverBySlot, avgWorkload };
}

function calculateWorkloadByHour(completedTasks: MergedData[]): AnalysisData['workloadByHour'] {
    const tasksByHour: Record<string, { planned: number, real: number, delays: number, advances: number }> = {};
    for (let i = 0; i < 24; i++) tasksByHour[`${String(i).padStart(2, '0')}:00`] = { planned: 0, real: 0, delays: 0, advances: 0 };

    completedTasks.forEach(task => {
        const realHour = new Date(task.heureCloture * 1000).getUTCHours();
        const arrivalHour = new Date(task.heureArriveeReelle * 1000).getUTCHours();
        const plannedHour = new Date(task.heureArriveeApprox * 1000).getUTCHours();

        tasksByHour[`${String(realHour).padStart(2, '0')}:00`].real++;
        tasksByHour[`${String(plannedHour).padStart(2, '0')}:00`].planned++;
        if (task.retardStatus === 'late') tasksByHour[`${String(arrivalHour).padStart(2, '0')}:00`].delays++;
        else if (task.retardStatus === 'early') tasksByHour[`${String(arrivalHour).padStart(2, '0')}:00`].advances++;
    });

    return Object.entries(tasksByHour).map(([hour, data]) => ({ hour, ...data }));
}

function calculateAvgWorkloadBySlot(completedTasks: MergedData[]): { avgWorkloadByDriverBySlot: AnalysisData['avgWorkloadByDriverBySlot'], avgWorkload: AnalysisData['avgWorkload'] } {
    const tasksBySlot: Record<string, { planned: number, real: number, plannedTours: Set<string>, realTours: Set<string> }> = {};
    for (let i = 0; i < 24; i += 2) tasksBySlot[`${String(i).padStart(2, '0')}h-${String(i + 2).padStart(2, '0')}h`] = { planned: 0, real: 0, plannedTours: new Set(), realTours: new Set() };

    completedTasks.forEach(task => {
        const realHourIndex = new Date(task.heureArriveeReelle * 1000).getUTCHours();
        const realSlotKey = `${String(Math.floor(realHourIndex / 2) * 2).padStart(2, '0')}h-${String(Math.floor(realHourIndex / 2) * 2 + 2).padStart(2, '0')}h`;
        if (tasksBySlot[realSlotKey]) {
            tasksBySlot[realSlotKey].real++;
            tasksBySlot[realSlotKey].realTours.add(task.tourneeUniqueId);
        }

        const plannedHourIndex = new Date(task.heureArriveeApprox * 1000).getUTCHours();
        const plannedSlotKey = `${String(Math.floor(plannedHourIndex / 2) * 2).padStart(2, '0')}h-${String(Math.floor(plannedHourIndex / 2) * 2 + 2).padStart(2, '0')}h`;
        if (tasksBySlot[plannedSlotKey]) {
            tasksBySlot[plannedSlotKey].planned++;
            tasksBySlot[plannedSlotKey].plannedTours.add(task.tourneeUniqueId);
        }
    });

    const avgWorkloadByDriverBySlot = Object.entries(tasksBySlot).map(([slot, data]) => ({
        slot,
        avgPlanned: data.plannedTours.size > 0 ? data.planned / data.plannedTours.size : 0,
        avgReal: data.realTours.size > 0 ? data.real / data.realTours.size : 0
    }));

    const totalAvgPlanned = avgWorkloadByDriverBySlot.reduce((sum, item) => sum + item.avgPlanned, 0);
    const totalAvgReal = avgWorkloadByDriverBySlot.reduce((sum, item) => sum + item.avgReal, 0);
    const avgWorkload = {
      avgPlanned: avgWorkloadByDriverBySlot.length > 0 ? totalAvgPlanned / avgWorkloadByDriverBySlot.filter(s => s.avgPlanned > 0).length : 0,
      avgReal: avgWorkloadByDriverBySlot.length > 0 ? totalAvgReal / avgWorkloadByDriverBySlot.filter(s => s.avgReal > 0).length : 0
    }

    return { avgWorkloadByDriverBySlot, avgWorkload };
}
// #endregion

// #region Advanced Stats Calculations
function calculateGlobalSummary(uniqueTournees: Tournee[], predictedPunctualityRate: number, punctualityRate: number): AnalysisData['globalSummary'] {
    const totals = uniqueTournees.reduce((acc, tour) => {
        acc.dureePrevue += tour.dureePrevue || 0;
        acc.dureeReelleCalculee += tour.dureeReelleCalculee || 0;
        acc.poidsPrevu += tour.poidsPrevu || 0;
        acc.poidsReel += tour.poidsReel || 0;
        return acc;
    }, { dureePrevue: 0, dureeReelleCalculee: 0, poidsPrevu: 0, poidsReel: 0 });

    return {
        punctualityRatePlanned: predictedPunctualityRate,
        punctualityRateRealized: punctualityRate,
        avgDurationDiscrepancyPerTour: uniqueTournees.length > 0 ? (totals.dureeReelleCalculee - totals.dureePrevue) / uniqueTournees.length : 0,
        avgWeightDiscrepancyPerTour: uniqueTournees.length > 0 ? (totals.poidsReel - totals.poidsPrevu) / uniqueTournees.length : 0,
        weightOverrunPercentage: totals.poidsPrevu > 0 ? ((totals.poidsReel - totals.poidsPrevu) / totals.poidsPrevu) * 100 : 0,
        durationOverrunPercentage: totals.dureePrevue > 0 ? ((totals.dureeReelleCalculee - totals.dureePrevue) / totals.dureePrevue) * 100 : 0,
    };
}

function calculateDepotStats (data: MergedData[], toleranceSeconds: number, lateTourTolerance: number): AnalysisData['depotStats'] {
    const depotNames = [...new Set(data.map(item => getNomDepot(item.tournee?.entrepot)).filter(Boolean) as string[])];
    
    return depotNames.map(depotName => {
        const depotData = data.filter(item => getNomDepot(item.tournee?.entrepot) === depotName);
        if (depotData.length === 0) return null;

        const totalDeliveries = depotData.length;
        const predictedTasksOnTime = depotData.filter(d => d.retardPrevisionnelStatus === 'onTime').length;
        const ponctualitePrev = totalDeliveries > 0 ? (predictedTasksOnTime / totalDeliveries) * 100 : 0;
        const realizedOnTime = depotData.filter(d => d.retardStatus === 'onTime').length;
        const ponctualiteRealisee = totalDeliveries > 0 ? (realizedOnTime / totalDeliveries) * 100 : 0;
        
        const tasksByTour = depotData.reduce((acc, task) => {
            if (!acc[task.tourneeUniqueId]) acc[task.tourneeUniqueId] = { tasks: [], tour: task.tournee };
            acc[task.tourneeUniqueId].tasks.push(task);
            return acc;
        }, {} as Record<string, { tasks: MergedData[], tour: MergedData['tournee'] }>);

        const overweightToursCount = Object.values(tasksByTour).filter(({ tour, tasks }) => tour && tasks.reduce((s,t) => s + t.poids, 0) > tour.capacitePoids).length;
        const totalTours = Object.keys(tasksByTour).length;
        const depassementPoids = totalTours > 0 ? (overweightToursCount / totalTours) * 100 : 0;
        
        const onTimeDepartureLateArrivalTours = Object.values(tasksByTour).filter(({ tour, tasks }) => {
           if (!tour || tour.heureDepartReelle > tour.heureDepartPrevue) return false;
           const firstTask = tasks.sort((a,b) => a.ordre - b.ordre)[0];
           return firstTask && (firstTask.retard / 60) > lateTourTolerance;
        }).length;
        const tourneesPartiesHeureRetard = totalTours > 0 ? (onTimeDepartureLateArrivalTours / totalTours) * 100 : 0;

        const significantDelayTours = Object.values(tasksByTour).filter(({ tour, tasks }) => 
            tour && tour.heureDepartReelle <= tour.heureDepartPrevue && tasks.some(t => t.retardStatus === 'late')
        ).length;
        const tourneesRetardAccumule = totalTours > 0 ? (significantDelayTours / totalTours) * 100 : 0;

        const negativeRatings = depotData.filter(d => d.notation != null && d.notation <= 3);
        const negativeRatingsLate = negativeRatings.filter(d => d.retardStatus === 'late');
        const notesNegativesRetard = negativeRatings.length > 0 ? (negativeRatingsLate.length / negativeRatings.length) * 100 : 0;
        
        const slotStats: Record<string, { total: number, late: number }> = {};
        depotData.forEach(task => {
            const slotKey = `${formatTime(task.heureDebutCreneau)}-${formatTime(task.heureFinCreneau)}`;
            if (!slotStats[slotKey]) slotStats[slotKey] = { total: 0, late: 0 };
            slotStats[slotKey].total++;
            if (task.retardStatus === 'late') slotStats[slotKey].late++;
        });

        let creneauLePlusChoisi = "N/A";
        if (Object.keys(slotStats).length > 0) {
            const [slot, stats] = Object.entries(slotStats).reduce((a, b) => a[1].total > b[1].total ? a : b);
            creneauLePlusChoisi = `${slot} (${((stats.total / totalDeliveries) * 100).toFixed(1)}%)`;
        }
        
        let creneauLePlusEnRetard = "N/A";
        const lateSlots = Object.entries(slotStats).filter(([, stats]) => stats.late > 0);
        if (lateSlots.length > 0) {
            const [worstSlot, worstSlotStats] = lateSlots.reduce((a, b) => (a[1].late / a[1].total) > (b[1].late / b[1].total) ? a : b);
            creneauLePlusEnRetard = `${worstSlot} (${((worstSlotStats.late / worstSlotStats.total) * 100).toFixed(1)}%)`;
        }

        const { avgWorkloadByDriverBySlot, avgWorkload } = calculateAvgWorkloadBySlot(depotData);
        let creneauPlusIntense = "N/A", creneauMoinsIntense = "N/A";
        const realIntensities = avgWorkloadByDriverBySlot.filter(s => s.avgReal > 0);
        if (realIntensities.length > 0) {
            const mostIntense = realIntensities.reduce((max, curr) => curr.avgReal > max.avgReal ? curr : max);
            creneauPlusIntense = `${mostIntense.slot} (${mostIntense.avgReal.toFixed(2)})`;
            const leastIntense = realIntensities.reduce((min, curr) => curr.avgReal < min.avgReal ? curr : min);
            creneauMoinsIntense = `${leastIntense.slot} (${leastIntense.avgReal.toFixed(2)})`;
        }

        return {
            entrepot: depotName,
            ponctualitePrev: `${ponctualitePrev.toFixed(1)}%`,
            ponctualiteRealisee: `${ponctualiteRealisee.toFixed(1)}%`,
            tourneesPartiesHeureRetard: `${tourneesPartiesHeureRetard.toFixed(1)}%`,
            tourneesRetardAccumule: `${tourneesRetardAccumule.toFixed(1)}%`,
            notesNegativesRetard: `${notesNegativesRetard.toFixed(1)}%`,
            depassementPoids: `${depassementPoids.toFixed(1)}%`,
            creneauLePlusChoisi, creneauLePlusEnRetard,
            intensiteTravailPlanifie: avgWorkload.avgPlanned.toFixed(2),
            intensiteTravailRealise: avgWorkload.avgReal.toFixed(2),
            creneauPlusIntense, creneauMoinsIntense,
        };
    }).filter(Boolean) as AnalysisData['depotStats'];
}

function calculateWarehouseStats(data: MergedData[], toleranceSeconds: number, lateTourTolerance: number): DepotStats[] {
    const warehouseNames = [...new Set(data.map(item => item.entrepot).filter(Boolean) as string[])];
    
    return warehouseNames.map(warehouseName => {
        const warehouseData = data.filter(item => item.entrepot === warehouseName);
        if (warehouseData.length === 0) return null;

        const totalDeliveries = warehouseData.length;
        const predictedTasksOnTime = warehouseData.filter(d => d.retardPrevisionnelStatus === 'onTime').length;
        const ponctualitePrev = totalDeliveries > 0 ? (predictedTasksOnTime / totalDeliveries) * 100 : 0;
        const realizedOnTime = warehouseData.filter(d => d.retardStatus === 'onTime').length;
        const ponctualiteRealisee = totalDeliveries > 0 ? (realizedOnTime / totalDeliveries) * 100 : 0;
        
        const tasksByTour = warehouseData.reduce((acc, task) => {
            if (!acc[task.tourneeUniqueId]) acc[task.tourneeUniqueId] = { tasks: [], tour: task.tournee };
            acc[task.tourneeUniqueId].tasks.push(task);
            return acc;
        }, {} as Record<string, { tasks: MergedData[], tour: MergedData['tournee'] }>);

        const overweightToursCount = Object.values(tasksByTour).filter(({ tour, tasks }) => tour && tasks.reduce((s,t) => s + t.poids, 0) > tour.capacitePoids).length;
        const totalTours = Object.keys(tasksByTour).length;
        const depassementPoids = totalTours > 0 ? (overweightToursCount / totalTours) * 100 : 0;
        
        const onTimeDepartureLateArrivalTours = Object.values(tasksByTour).filter(({ tour, tasks }) => {
           if (!tour || tour.heureDepartReelle > tour.heureDepartPrevue) return false;
           const firstTask = tasks.sort((a,b) => a.ordre - b.ordre)[0];
           return firstTask && (firstTask.retard / 60) > lateTourTolerance;
        }).length;
        const tourneesPartiesHeureRetard = totalTours > 0 ? (onTimeDepartureLateArrivalTours / totalTours) * 100 : 0;

        const significantDelayTours = Object.values(tasksByTour).filter(({ tour, tasks }) => 
            tour && tour.heureDepartReelle <= tour.heureDepartPrevue && tasks.some(t => t.retardStatus === 'late')
        ).length;
        const tourneesRetardAccumule = totalTours > 0 ? (significantDelayTours / totalTours) * 100 : 0;

        const ratedTasks = warehouseData.filter(d => d.notation != null && d.notation > 0);
        const sumOfRatings = ratedTasks.reduce((sum, task) => sum + task.notation!, 0);
        const noteMoyenne = ratedTasks.length > 0 ? (sumOfRatings / ratedTasks.length).toFixed(2) : "N/A";
        
        const slotStats: Record<string, { total: number, late: number }> = {};
        warehouseData.forEach(task => {
            const slotKey = `${formatTime(task.heureDebutCreneau)}-${formatTime(task.heureFinCreneau)}`;
            if (!slotStats[slotKey]) slotStats[slotKey] = { total: 0, late: 0 };
            slotStats[slotKey].total++;
            if (task.retardStatus === 'late') slotStats[slotKey].late++;
        });

        let creneauLePlusChoisi = "N/A";
        if (Object.keys(slotStats).length > 0) {
            const [slot, stats] = Object.entries(slotStats).reduce((a, b) => a[1].total > b[1].total ? a : b);
            creneauLePlusChoisi = `${slot} (${((stats.total / totalDeliveries) * 100).toFixed(1)}%)`;
        }
        
        let creneauLePlusEnRetard = "N/A";
        const lateSlots = Object.entries(slotStats).filter(([, stats]) => stats.late > 0);
        if (lateSlots.length > 0) {
            const [worstSlot, worstSlotStats] = lateSlots.reduce((a, b) => (a[1].late / a[1].total) > (b[1].late / b[1].total) ? a : b);
            creneauLePlusEnRetard = `${worstSlot} (${((worstSlotStats.late / worstSlotStats.total) * 100).toFixed(1)}%)`;
        }

        const { avgWorkloadByDriverBySlot, avgWorkload } = calculateAvgWorkloadBySlot(warehouseData);
        let creneauPlusIntense = "N/A", creneauMoinsIntense = "N/A";
        const realIntensities = avgWorkloadByDriverBySlot.filter(s => s.avgReal > 0);
        if (realIntensities.length > 0) {
            const mostIntense = realIntensities.reduce((max, curr) => curr.avgReal > max.avgReal ? curr : max);
            creneauPlusIntense = `${mostIntense.slot} (${mostIntense.avgReal.toFixed(2)})`;
            const leastIntense = realIntensities.reduce((min, curr) => curr.avgReal < min.avgReal ? curr : min);
            creneauMoinsIntense = `${leastIntense.slot} (${leastIntense.avgReal.toFixed(2)})`;
        }

        return {
            entrepot: warehouseName,
            ponctualitePrev: `${ponctualitePrev.toFixed(1)}%`,
            ponctualiteRealisee: `${ponctualiteRealisee.toFixed(1)}%`,
            tourneesPartiesHeureRetard: `${tourneesPartiesHeureRetard.toFixed(1)}%`,
            tourneesRetardAccumule: `${tourneesRetardAccumule.toFixed(1)}%`,
            noteMoyenne: noteMoyenne,
            depassementPoids: `${depassementPoids.toFixed(1)}%`,
            creneauLePlusChoisi, creneauLePlusEnRetard,
            intensiteTravailPlanifie: avgWorkload.avgPlanned.toFixed(2),
            intensiteTravailRealise: avgWorkload.avgReal.toFixed(2),
            creneauPlusIntense, creneauMoinsIntense,
        };
    }).filter(Boolean) as DepotStats[];
}


function calculatePostalCodeStats(data: MergedData[]): AnalysisData['postalCodeStats'] {
    const postalCodeStats: Record<string, { total: number; late: number; depot: string }> = {};
    data.forEach(item => {
        if (item.codePostal && item.tournee) {
            if (!postalCodeStats[item.codePostal]) postalCodeStats[item.codePostal] = { total: 0, late: 0, depot: item.tournee.entrepot };
            postalCodeStats[item.codePostal].total++;
            if (item.retardStatus === 'late') postalCodeStats[item.codePostal].late++;
        }
    });
    return Object.entries(postalCodeStats).map(([codePostal, stats]) => ({
        codePostal,
        entrepot: stats.depot,
        totalLivraisons: stats.total,
        livraisonsRetard: stats.total > 0 ? `${((stats.late / stats.total) * 100).toFixed(1)}%` : '0.0%',
    })).sort((a, b) => parseFloat(b.livraisonsRetard) - parseFloat(a.livraisonsRetard));
};

function calculateSaturationData(filteredData: MergedData[]): AnalysisData['saturationData'] {
    const hourlyBuckets: Record<string, { demand: number; capacity: number }> = {};
    for (let i = 6; i < 23; i++) hourlyBuckets[`${i.toString().padStart(2, '0')}:00`] = { demand: 0, capacity: 0 };
    (filteredData || []).forEach(task => {
        const startHour = new Date(task.heureDebutCreneau * 1000).getUTCHours();
        const endHour = new Date(task.heureFinCreneau * 1000).getUTCHours();
        for (let i = startHour; i < endHour; i++) {
            const hourKey = `${i.toString().padStart(2, '0')}:00`;
            if (hourlyBuckets[hourKey]) hourlyBuckets[hourKey].demand++;
        }
        const closureHour = new Date(task.heureCloture * 1000).getUTCHours();
        if (hourlyBuckets[`${closureHour.toString().padStart(2, '0')}:00`]) hourlyBuckets[`${closureHour.toString().padStart(2, '0')}:00`].capacity++;
    });
    return Object.entries(hourlyBuckets).filter(([,d]) => d.demand > 0 || d.capacity > 0).map(([hour, data]) => ({ hour, gap: data.demand - data.capacity }));
}

function calculateCustomerPromiseData(filteredData: MergedData[]): AnalysisData['customerPromiseData'] {
    if (!filteredData) return [];
    const buckets: Record<string, { customerPromise: number; urbantzPlan: number; realized: number; late: number }> = {};
    for (let i = 6*60; i < 23*60; i++) buckets[formatTime(i)] = { customerPromise: 0, urbantzPlan: 0, realized: 0, late: 0 };

    filteredData.reduce((acc, task) => {
        const key = `${formatTime(task.heureDebutCreneau)}-${formatTime(task.heureFinCreneau)}`;
        if (!acc[key]) acc[key] = { count: 0, start: task.heureDebutCreneau, end: task.heureFinCreneau };
        acc[key].count++;
        return acc;
    }, {} as Record<string, { count: number; start: number; end: number }>);

    Object.values(filteredData.reduce((acc, task) => {
        const key = `${task.heureDebutCreneau}-${task.heureFinCreneau}`;
        if (!acc[key]) acc[key] = { count: 0, start: task.heureDebutCreneau, end: task.heureFinCreneau };
        acc[key].count++;
        return acc;
    }, {} as Record<string, { count: number; start: number; end: number }>)).forEach(slot => {
        const durationMinutes = (slot.end - slot.start) / 60;
        if (durationMinutes <= 0) return;
        const weightPerMinute = slot.count / durationMinutes;
        for (let i = 0; i < durationMinutes; i++) {
            const bucketKey = formatTime(slot.start + i * 60);
            if (buckets[bucketKey]) buckets[bucketKey].customerPromise += weightPerMinute;
        }
    });

    filteredData.forEach(task => {
        const approxKey = formatTime(task.heureArriveeApprox);
        if (buckets[approxKey]) buckets[approxKey].urbantzPlan++;
        const closureKey = formatTime(task.heureCloture);
        if (buckets[closureKey]) {
            buckets[closureKey].realized++;
            if (task.retardStatus === 'late') buckets[closureKey].late++;
        }
    });
    return Object.entries(buckets).map(([hour, data]) => ({ ...data, hour }));
}

function calculateSimulationData(data: MergedData[]): { actualSlotDistribution: AnalysisData['actualSlotDistribution'], simulatedPromiseData: AnalysisData['simulatedPromiseData'] } {
    if (!data || data.length === 0) return { actualSlotDistribution: [], simulatedPromiseData: [] };
    
    const dataByWarehouse = data.reduce((acc, task) => {
        const warehouse = task.tournee?.entrepot;
        if (warehouse) {
            if (!acc[warehouse]) acc[warehouse] = [];
            acc[warehouse].push(task);
        }
        return acc;
    }, {} as Record<string, MergedData[]>);

    const actualSlotDistribution: AnalysisData['actualSlotDistribution'] = Object.entries(dataByWarehouse).flatMap(([warehouse, tasks]) => {
        const totalOrders = tasks.length;
        const ordersBySlot = tasks.reduce((acc, task) => {
            const slotKey = `${formatTime(task.heureDebutCreneau)}-${formatTime(task.heureFinCreneau)}`;
            acc[slotKey] = (acc[slotKey] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        return Object.entries(ordersBySlot).sort((a,b) => a[0].localeCompare(b[0])).map(([slot, count]) => ({
            warehouse, slot, count, percentage: `${((count / totalOrders) * 100).toFixed(1)}%`
        }));
    });
    
    const { simulatedPromiseData } = { simulatedPromiseData: [] as any[] }; // Placeholder
    return { actualSlotDistribution, simulatedPromiseData };
}

// #endregion

// #region Utility Functions
function createEmptyAnalysisData(): AnalysisData {
    return {
        generalKpis: [], discrepancyKpis: [], qualityKpis: [], overloadedTours: [],
        durationDiscrepancies: [], lateStartAnomalies: [], performanceByDriver: [],
        performanceByCity: [], performanceByPostalCode: [], delaysByWarehouse: [],
        delaysByHour: [], advancesByWarehouse: [], advancesByHour: [], workloadByHour: [],
        avgWorkloadByDriverBySlot: [], avgWorkload: { avgPlanned: 0, avgReal: 0 },
        performanceByDayOfWeek: [], performanceByTimeSlot: [], delayHistogram: [],
        cities: [], depots: [], warehouses: [],
        globalSummary: { punctualityRatePlanned: 0, punctualityRateRealized: 0, avgDurationDiscrepancyPerTour: 0, avgWeightDiscrepancyPerTour: 0, weightOverrunPercentage: 0, durationOverrunPercentage: 0 },
        performanceByDepot: [], performanceByWarehouse: [], firstTaskLatePercentage: 0,
        depotStats: [], warehouseStats: [], postalCodeStats: [], saturationData: [], customerPromiseData: [],
        actualSlotDistribution: [], simulatedPromiseData: [], rawData: [], filteredData: []
    };
}

function getPunctualityStats(completedTasks: MergedData[], toleranceSeconds: number) {
    const lateTasks = completedTasks.filter(t => t.retardStatus === 'late');
    const earlyTasks = completedTasks.filter(t => t.retardStatus === 'early');
    const onTimeTasks = completedTasks.filter(t => t.retardStatus === 'onTime');
    const predictedOnTime = completedTasks.filter(t => t.retardPrevisionnelStatus === 'onTime');

    return {
        lateTasks, earlyTasks,
        outOfTimeTasks: lateTasks.length + earlyTasks.length,
        predictedOutOfTimeTasks: completedTasks.length - predictedOnTime.length,
        punctualityRate: completedTasks.length > 0 ? (onTimeTasks.length / completedTasks.length) * 100 : 100,
        predictedPunctualityRate: completedTasks.length > 0 ? (predictedOnTime.length / completedTasks.length) * 100 : 100,
    };
}

function formatSeconds(seconds: number): string {
    if (seconds < 0) seconds = 0;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m < 10 ? '0' : ''}${m}m`;
}

function formatTime(seconds: number): string {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const date = new Date(seconds * 1000);
    const h = date.getUTCHours().toString().padStart(2, '0');
    const m = date.getUTCMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
}
// #endregion
