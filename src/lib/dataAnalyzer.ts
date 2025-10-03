

import type { MergedData, AnalysisData, Tournee, GlobalSummary, DepotStats, PostalCodeStats, SaturationData, CustomerPromiseData, ActualSlotDistribution, SimulatedPromiseData, Kpi, ComparisonKpi, OverloadedTourInfo, LateStartAnomaly, DurationDiscrepancy, PerformanceByDriver, PerformanceByGeo, PerformanceByGroup, DelayCount, DelayByHour, PerformanceByDay, PerformanceByTimeSlot, DelayHistogramBin, WorkloadByHour, AvgWorkloadBySlot, AvgWorkload } from './types';
import { getDay } from 'date-fns';


export function analyzeData(data: MergedData[], filters: Record<string, any>): AnalysisData {
    
    const toleranceMinutes = 15;
    const toleranceSeconds = toleranceMinutes * 60;
    const lateTourTolerance = filters.lateTourTolerance || 0;

    const completedTasks = data.filter(t => t.tournee && t.avancement?.toLowerCase() === 'complétée' && t.heureCloture > 0 && t.heureDebutCreneau > 0 && t.heureFinCreneau > 0);
    
    if (completedTasks.length === 0) {
        return createEmptyAnalysisData();
    }

    // --- Pre-calculation per task ---
    completedTasks.forEach(task => {
        const cloture = task.heureCloture;
        const debutCreneau = task.heureDebutCreneau;
        const finCreneau = task.heureFinCreneau;

        // Strict status calculation
        if (cloture < debutCreneau - toleranceSeconds) {
            task.retardStatus = 'early';
        } else if (cloture > finCreneau + toleranceSeconds) {
            task.retardStatus = 'late';
        } else {
            task.retardStatus = 'onTime';
        }

        // Consistent delay calculation for sorting/metrics
        if (task.retardStatus === 'early') {
            task.retard = cloture - debutCreneau;
        } else {
            task.retard = cloture - finCreneau;
        }
        
        // Predicted delay in seconds
        let predictedRetardSeconds = 0;
        const approx = task.heureArriveeApprox;
        
        if (approx < debutCreneau - toleranceSeconds) {
            task.retardPrevisionnelStatus = 'early';
            predictedRetardSeconds = approx - debutCreneau;
        } else if (approx > finCreneau + toleranceSeconds) {
            task.retardPrevisionnelStatus = 'late';
            predictedRetardSeconds = approx - finCreneau;
        } else {
            task.retardPrevisionnelStatus = 'onTime';
            predictedRetardSeconds = approx - finCreneau;
        }
        task.retardPrevisionnelS = predictedRetardSeconds;
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


    // Aggregate real values and calculated durations per tour
    tourneeMap.forEach(({ tour, tasks }) => {
        if (tasks.length === 0) return;

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

    // --- Calculations ---
    const generalKpis = calculateKpis(completedTasks, uniqueTournees, toleranceMinutes);
    const { lateTasks, earlyTasks, punctualityRate, predictedPunctualityRate, outOfTimeTasks, predictedOutOfTimeTasks } = getPunctualityStats(completedTasks);
    const discrepancyKpis = calculateDiscrepancyKpis(uniqueTournees, punctualityRate, predictedPunctualityRate, outOfTimeTasks, predictedOutOfTimeTasks);
    
    const { overloadedTours, durationDiscrepancies, lateStartAnomalies } = calculateAnomalies(tourneeMap, uniqueTournees);
    const qualityKpis = calculateQualityKpis(completedTasks, overloadedTours, lateStartAnomalies, uniqueTournees.length);

    const performanceByDriver = calculatePerformanceByDriver(Array.from(tourneeMap.values()));
    const performanceByCity = calculatePerformanceByGeo(completedTasks, tourneeMap, 'ville');
    const performanceByPostalCode = calculatePerformanceByGeo(completedTasks, tourneeMap, 'codePostal');
    const performanceByDepot = calculatePerformanceByGroup(completedTasks, tourneeMap, (task) => task.tournee!.entrepot.split(' ')[0]);
    const performanceByWarehouse = calculatePerformanceByGroup(completedTasks, tourneeMap, (task) => task.tournee!.entrepot);

    const { 
        delaysByWarehouse, delaysByCity, delaysByPostalCode, delaysByHour,
        advancesByWarehouse, advancesByCity, advancesByPostalCode, advancesByHour,
        performanceByDayOfWeek, performanceByTimeSlot, delayHistogram
    } = calculateTemporalAnalyses(lateTasks, earlyTasks, completedTasks, toleranceSeconds);

    const { workloadByHour, avgWorkloadByDriverBySlot, avgWorkload } = calculateWorkloadAnalyses(completedTasks);

    const firstTaskLatePercentage = uniqueTournees.length > 0 ? (lateStartAnomalies.length / uniqueTournees.length) * 100 : 0;
    
    const totals = uniqueTournees.reduce((acc, tour) => {
        acc.dureePrevue += tour.dureeEstimeeOperationnelle || 0;
        acc.dureeReelleCalculee += tour.dureeReelleCalculee || 0;
        acc.poidsPrevu += tour.poidsPrevu || 0;
        acc.poidsReel += tour.poidsReel || 0;
        return acc;
    }, { dureePrevue: 0, dureeReelleCalculee: 0, poidsPrevu: 0, poidsReel: 0 });

    const globalSummary: GlobalSummary = {
        punctualityRatePlanned: predictedPunctualityRate,
        punctualityRateRealized: punctualityRate,
        avgDurationDiscrepancyPerTour: uniqueTournees.length > 0 ? (totals.dureeReelleCalculee - totals.dureePrevue) / uniqueTournees.length : 0,
        avgWeightDiscrepancyPerTour: uniqueTournees.length > 0 ? (totals.poidsReel - totals.poidsPrevu) / uniqueTournees.length : 0,
        weightOverrunPercentage: totals.poidsPrevu > 0 ? ((totals.poidsReel - totals.poidsPrevu) / totals.poidsPrevu) * 100 : 0,
        durationOverrunPercentage: totals.dureePrevue > 0 ? ((totals.dureeReelleCalculee - totals.dureePrevue) / totals.dureePrevue) * 100 : 0,
    };
    
    const depotStats = calculateDepotStats(completedTasks, toleranceMinutes, lateTourTolerance);
    const postalCodeStats = calculatePostalCodeStats(completedTasks);
    const saturationData = calculateSaturationData(completedTasks);
    const customerPromiseData = calculateCustomerPromiseData(completedTasks);
    const { actualSlotDistribution, simulatedPromiseData } = calculateSimulationData(completedTasks);


    return {
        generalKpis,
        discrepancyKpis,
        qualityKpis,
        overloadedTours: overloadedTours,
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
        avgWorkloadByDriverBySlot,
        avgWorkload,
        performanceByDayOfWeek,
        performanceByTimeSlot,
        delayHistogram,
        cities: [...new Set(completedTasks.map(t => t.ville))].filter(Boolean).sort(),
        depots: [...new Set(completedTasks.map(t => t.tournee!.entrepot.split(' ')[0]))].filter(Boolean).sort(),
        warehouses: [...new Set(completedTasks.map(t => t.tournee!.entrepot))].filter(Boolean).sort(),
        globalSummary,
        performanceByDepot,
        performanceByWarehouse,
        firstTaskLatePercentage,
        depotStats,
        postalCodeStats,
        saturationData,
        customerPromiseData,
        actualSlotDistribution,
        simulatedPromiseData,
    };
}

// #region KPI Calculations
function calculateKpis(completedTasks: MergedData[], uniqueTournees: Tournee[], toleranceMinutes: number): Kpi[] {
    const punctualityRate = getPunctualityStats(completedTasks).punctualityRate;
    const lateTasks = completedTasks.filter(t => t.retardStatus === 'late');
    const earlyTasks = completedTasks.filter(t => t.retardStatus === 'early');
    const avgRatingData = completedTasks.filter(t => t.notation != null && t.notation > 0);
    const avgRating = avgRatingData.length > 0 ? avgRatingData.reduce((acc, t) => acc + t.notation!, 0) / avgRatingData.length : 0;
    const negativeReviews = completedTasks.filter(t => t.notation != null && t.notation <= 3);

    return [
        { title: 'Tournées Analysées', value: uniqueTournees.length.toString(), icon: 'Truck' },
        { title: 'Livraisons Analysées', value: completedTasks.length.toString(), icon: 'ListChecks' },
        { title: `Taux de Ponctualité (Réalisé)`, value: `${punctualityRate.toFixed(1)}%`, description: `Seuil de tolérance: ±${toleranceMinutes} min`, icon: 'Clock' },
        { title: 'Notation Moyenne Client', value: avgRating.toFixed(2), description: `Basé sur ${avgRatingData.length} avis (sur 5)`, icon: 'Star' },
        { title: 'Livraisons en Retard', value: lateTasks.length.toString(), description: `> ${toleranceMinutes} min après le créneau`, icon: 'Frown' },
        { title: 'Livraisons en Avance', value: earlyTasks.length.toString(), description: `< ${toleranceMinutes} min avant le créneau`, icon: 'Smile' },
        { title: 'Avis Négatifs', value: negativeReviews.length.toString(), description: 'Note client de 1 à 3 / 5', icon: 'MessageSquareX' },
    ];
}

function calculateDiscrepancyKpis(
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

function calculateQualityKpis(
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
// #endregion

// #region Anomaly Calculations
function calculateAnomalies(
    tourneeMap: Map<string, { tour: Tournee, tasks: MergedData[] }>,
    uniqueTournees: Tournee[]
) {
    const overloadedTours = calculateOverloadedTours(uniqueTournees);
    const durationDiscrepancies = calculateDurationDiscrepancies(uniqueTournees);
    const lateStartAnomalies = calculateLateStartAnomalies(tourneeMap);
    
    return {
        overloadedTours,
        durationDiscrepancies,
        lateStartAnomalies,
    };
}

function calculateOverloadedTours(uniqueTournees: Tournee[]): OverloadedTourInfo[] {
    return uniqueTournees.map(tour => {
        // La surcharge est définie comme le poids réel dépassant la capacité du véhicule.
        const isOverloaded = tour.capacitePoids > 0 && tour.poidsReel > tour.capacitePoids;

        const depassementPoids = tour.poidsReel - tour.capacitePoids;
        const tauxDepassementPoids = tour.capacitePoids > 0 ? (depassementPoids / tour.capacitePoids) * 100 : 0;
        
        // Les calculs de bacs sont conservés pour information mais ne définissent plus la surcharge.
        const depassementBacs = tour.bacsReels - tour.bacsPrevus;
        const tauxDepassementBacs = tour.bacsPrevus > 0 ? (depassementBacs / tour.bacsPrevus) * 100 : 0;

        return {
            ...tour, 
            isOverloaded: isOverloaded,
            depassementPoids: depassementPoids,
            tauxDepassementPoids: tauxDepassementPoids,
            depassementBacs: depassementBacs,
            tauxDepassementBacs: tauxDepassementBacs,
        };
    }).filter(t => t.isOverloaded)
      .sort((a,b) => b.depassementPoids - a.depassementPoids);
}

function calculateDurationDiscrepancies(uniqueTournees: Tournee[]): DurationDiscrepancy[] {
    return uniqueTournees.map(tour => ({
        ...tour,
        dureeEstimee: tour.dureeEstimeeOperationnelle || 0,
        dureeReelle: tour.dureeReelleCalculee || 0,
        ecart: (tour.dureeReelleCalculee || 0) - (tour.dureeEstimeeOperationnelle || 0),
        heurePremiereLivraisonPrevue: tour.heurePremiereLivraisonPrevue || 0,
        heurePremiereLivraisonReelle: tour.heurePremiereLivraisonReelle || 0,
        heureDerniereLivraisonPrevue: tour.heureDerniereLivraisonPrevue || 0,
        heureDerniereLivraisonReelle: tour.heureDerniereLivraisonReelle || 0,
    })).filter(t => t.ecart > 0).sort((a, b) => b.ecart - a.ecart);
}

function calculateLateStartAnomalies(tourneeMap: Map<string, { tour: Tournee, tasks: MergedData[] }>): LateStartAnomaly[] {
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
        
        const isOverweight = tour.poidsPrevu > 0 && tour.poidsReel > tour.poidsPrevu;
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

function calculatePerformanceByGeo(tasks: MergedData[], tourneeMap: Map<string, { tour: Tournee, tasks: MergedData[] }>, key: 'ville' | 'codePostal'): PerformanceByGeo[] {
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

function calculatePerformanceByGroup(tasks: MergedData[], tourneeMap: Map<string, { tour: Tournee, tasks: MergedData[] }>, keyGetter: (task: MergedData) => string): PerformanceByGroup[] {
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
    }).sort((a, b) => (b.punctualityRatePlanned - a.punctualityRateRealized) - (a.punctualityRatePlanned - a.punctualityRateRealized));
}
// #endregion

// #region Temporal Calculations
function calculateTemporalAnalyses(
    lateTasks: MergedData[],
    earlyTasks: MergedData[],
    completedTasks: MergedData[],
    toleranceSeconds: number
) {
    const delaysByWarehouse = countItemsBy(lateTasks, (t) => t.tournee!.entrepot);
    const delaysByCity = countItemsBy(lateTasks, (t) => t.ville);
    const delaysByPostalCode = countItemsBy(lateTasks, (t) => t.codePostal);
    const advancesByWarehouse = countItemsBy(earlyTasks, (t) => t.tournee!.entrepot);
    const advancesByCity = countItemsBy(earlyTasks, (t) => t.ville);
    const advancesByPostalCode = countItemsBy(earlyTasks, (t) => t.codePostal);
    
    const delaysByHour = countByHour(lateTasks);
    const advancesByHour = countByHour(earlyTasks);

    const performanceByDayOfWeek = calculatePerformanceByDayOfWeek(completedTasks);
    const performanceByTimeSlot = calculatePerformanceByTimeSlot(completedTasks);
    const delayHistogram = createDelayHistogram(completedTasks, toleranceSeconds);

    return {
        delaysByWarehouse,
        delaysByCity,
        delaysByPostalCode,
        delaysByHour,
        advancesByWarehouse,
        advancesByCity,
        advancesByPostalCode,
        advancesByHour,
        performanceByDayOfWeek,
        performanceByTimeSlot,
        delayHistogram,
    }
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
        const hour = new Date(task.heureArriveeReelle * 1000).getUTCHours();
        const hourString = `${String(hour).padStart(2, '0')}:00`;
        acc[hourString] = (acc[hourString] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(counts)
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour.localeCompare(b.hour));
}

function calculatePerformanceByDayOfWeek(tasks: MergedData[]): PerformanceByDay[] {
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
        const sumOfDelays = data.lateTasks.reduce((sum, task) => sum + (task.retard / 60), 0);

        return {
            day: dayNames[parseInt(dayIndex)],
            totalTasks,
            punctualityRate: totalTasks > 0 ? ((totalTasks - delays) / totalTasks) * 100 : 100,
            avgDelay: delays > 0 ? (sumOfDelays / delays) : 0,
            delays,
            advances
        };
    });
}

function calculatePerformanceByTimeSlot(tasks: MergedData[]): PerformanceByTimeSlot[] {
    const slots: Record<string, { totalTasks: number; lateTasks: MergedData[]; earlyTasks: MergedData[] }> = {
      'Matin (06-12h)': { totalTasks: 0, lateTasks: [], earlyTasks: [] },
      'Après-midi (12-18h)': { totalTasks: 0, lateTasks: [], earlyTasks: [] },
      'Soir (18-00h)': { totalTasks: 0, lateTasks: [], earlyTasks: [] }
    };

    tasks.forEach(task => {
        const startHour = Math.floor(task.heureDebutCreneau / 3600);
        let slotKey: string | null = null;
        if (startHour >= 6 && startHour < 12) {
            slotKey = 'Matin (06-12h)';
        } else if (startHour >= 12 && startHour < 18) {
            slotKey = 'Après-midi (12-18h)';
        } else if (startHour >= 18 && startHour < 24) {
            slotKey = 'Soir (18-00h)';
        }
        
        if (slotKey && slots[slotKey]) {
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
        const sumOfDelays = data.lateTasks.reduce((sum, task) => sum + (task.retard / 60), 0);

        return {
            slot: slotName,
            totalTasks,
            punctualityRate: totalTasks > 0 ? ((totalTasks - delays) / totalTasks) * 100 : 100,
            avgDelay: delays > 0 ? (sumOfDelays / delays) : 0,
            delays,
            advances
        };
    }).filter(s => s.totalTasks > 0); // Only return slots with data
}


function createDelayHistogram(tasks: MergedData[], toleranceSeconds: number): DelayHistogramBin[] {
    const toleranceMinutes = toleranceSeconds / 60;
    const bins: { [key: string]: { min: number, max: number, count: number } } = {
        '> 60 min en avance': { min: -Infinity, max: -60.01, count: 0 },
        '30-60 min en avance': { min: -60, max: -30.01, count: 0 },
        [`${toleranceMinutes}-30 min en avance`]: { min: -30, max: -toleranceMinutes - 0.01, count: 0 },
        'À l\'heure': { min: -toleranceMinutes, max: toleranceMinutes, count: 0 },
        [`${toleranceMinutes}-30 min de retard`]: { min: toleranceMinutes + 0.01, max: 30, count: 0 },
        '30-60 min de retard': { min: 30.01, max: 60, count: 0 },
        '> 60 min de retard': { min: 60.01, max: Infinity, count: 0 },
    };

    tasks.forEach(task => {
        // Use the pre-calculated `retard` field which is now consistent
        const delayInMinutes = task.retard / 60;

        for (const key in bins) {
            if (delayInMinutes >= bins[key].min && delayInMinutes <= bins[key].max) {
                bins[key].count++;
                break;
            }
        }
    });
    
    const sortedBinKeys = [
        '> 60 min en avance',
        '30-60 min en avance',
        `${toleranceMinutes}-30 min en avance`,
        'À l\'heure',
        `${toleranceMinutes}-30 min de retard`,
        '30-60 min de retard',
        '> 60 min de retard'
    ];

    return sortedBinKeys.map(key => ({
        range: key,
        count: bins[key].count
    }));
}
// #endregion

// #region Workload Calculations
function calculateWorkloadAnalyses(completedTasks: MergedData[]) {
    const workloadByHour = calculateWorkloadByHour(completedTasks);
    const { avgWorkloadByDriverBySlot, avgWorkload } = calculateAvgWorkloadBySlot(completedTasks);

    return {
        workloadByHour,
        avgWorkloadByDriverBySlot,
        avgWorkload,
    }
}

function calculateWorkloadByHour(completedTasks: MergedData[]): WorkloadByHour[] {
    const tasksByHour: Record<string, { planned: number, real: number, delays: number, advances: number }> = {};
    for (let i = 0; i < 24; i++) {
        const hourStr = `${String(i).padStart(2, '0')}:00`;
        tasksByHour[hourStr] = { planned: 0, real: 0, delays: 0, advances: 0 };
    }

    completedTasks.forEach(task => {
        const realHourIndex = new Date(task.heureCloture * 1000).getUTCHours();
        const realHourStr = `${String(realHourIndex).padStart(2, '0')}:00`;
        if (tasksByHour[realHourStr]) {
            tasksByHour[realHourStr].real++;
        }
        
        const arrivalHourIndex = new Date(task.heureArriveeReelle * 1000).getUTCHours();
        const arrivalHourStr = `${String(arrivalHourIndex).padStart(2, '0')}:00`;
        if (tasksByHour[arrivalHourStr]) {
            if (task.retardStatus === 'late') tasksByHour[arrivalHourStr].delays++;
            else if (task.retardStatus === 'early') tasksByHour[arrivalHourStr].advances++;
        }

        const plannedHourIndex = new Date(task.heureArriveeApprox * 1000).getUTCHours();
        const plannedHourStr = `${String(plannedHourIndex).padStart(2, '0')}:00`;
        if (tasksByHour[plannedHourStr]) {
            tasksByHour[plannedHourStr].planned++;
        }
    });

    return Object.entries(tasksByHour).map(([hour, data]) => ({ hour, ...data }));
}

function calculateAvgWorkloadBySlot(completedTasks: MergedData[]): { avgWorkloadByDriverBySlot: AvgWorkloadBySlot[], avgWorkload: AvgWorkload } {
    const tasksBySlot: Record<string, { planned: number, real: number, plannedTours: Set<string>, realTours: Set<string> }> = {};
    for (let i = 0; i < 24; i += 2) {
        const start = String(i).padStart(2, '0');
        const end = String(i + 2).padStart(2, '0');
        tasksBySlot[`${start}h-${end}h`] = { planned: 0, real: 0, plannedTours: new Set(), realTours: new Set() };
    }

    completedTasks.forEach(task => {
        const realHourIndex = new Date(task.heureArriveeReelle * 1000).getUTCHours();
        const realSlotIndex = Math.floor(realHourIndex / 2) * 2;
        const realSlotKey = `${String(realSlotIndex).padStart(2, '0')}h-${String(realSlotIndex + 2).padStart(2, '0')}h`;
        if (tasksBySlot[realSlotKey]) {
            tasksBySlot[realSlotKey].real++;
            tasksBySlot[realSlotKey].realTours.add(task.tourneeUniqueId);
        }

        const plannedHourIndex = new Date(task.heureArriveeApprox * 1000).getUTCHours();
        const plannedSlotIndex = Math.floor(plannedHourIndex / 2) * 2;
        const plannedSlotKey = `${String(plannedSlotIndex).padStart(2, '0')}h-${String(plannedSlotIndex + 2).padStart(2, '0')}h`;
        if (tasksBySlot[plannedSlotKey]) {
            tasksBySlot[plannedSlotKey].planned++;
            tasksBySlot[plannedSlotKey].plannedTours.add(task.tourneeUniqueId);
        }
    });

    const avgWorkloadByDriverBySlot = Object.entries(tasksBySlot).map(([slot, data]) => {
        const plannedTourCount = data.plannedTours.size;
        const realTourCount = data.realTours.size;
        return {
            slot,
            avgPlanned: plannedTourCount > 0 ? data.planned / plannedTourCount : 0,
            avgReal: realTourCount > 0 ? data.real / realTourCount : 0
        };
    });

    const totalAvgPlanned = avgWorkloadByDriverBySlot.reduce((sum, item) => sum + item.avgPlanned, 0);
    const totalAvgReal = avgWorkloadByDriverBySlot.reduce((sum, item) => sum + item.avgReal, 0);
    const avgWorkload: AvgWorkload = {
      avgPlanned: avgWorkloadByDriverBySlot.length > 0 ? totalAvgPlanned / avgWorkloadByDriverBySlot.filter(s => s.avgPlanned > 0).length : 0,
      avgReal: avgWorkloadByDriverBySlot.length > 0 ? totalAvgReal / avgWorkloadByDriverBySlot.filter(s => s.avgReal > 0).length : 0
    }

    return { avgWorkloadByDriverBySlot, avgWorkload };
}
// #endregion

function calculateDepotStats (data: MergedData[], toleranceMinutes: number, lateTourTolerance: number): DepotStats[] {
    const depotNames = [...new Set(data.map(item => item.tournee?.entrepot).filter(Boolean) as string[])];
    
    return depotNames.map(depotName => {
        const depotData = data.filter(item => item.tournee?.entrepot === depotName);
        if (depotData.length === 0) {
            return null;
        }

        const totalDeliveries = depotData.length;

        // Ponctualité Prév. 
        const predictedTasksOnTime = depotData.filter(d => d.retardPrevisionnelStatus === 'onTime').length;
        const ponctualitePrev = totalDeliveries > 0 ? (predictedTasksOnTime / totalDeliveries) * 100 : 0;


        // Ponctualité Réalisée 
        const realizedOnTime = depotData.filter(d => d.retardStatus === 'onTime').length;
        const ponctualiteRealisee = totalDeliveries > 0 ? (realizedOnTime / totalDeliveries) * 100 : 0;
        
        // % Dépassement de Poids
        const tasksByTour = depotData.reduce((acc, task) => {
            if (!acc[task.tourneeUniqueId]) {
                acc[task.tourneeUniqueId] = { tasks: [], tour: task.tournee };
            }
            acc[task.tourneeUniqueId].tasks.push(task);
            return acc;
        }, {} as Record<string, { tasks: MergedData[], tour: MergedData['tournee'] }>);

        let overweightToursCount = 0;
        Object.values(tasksByTour).forEach(({ tasks, tour }) => {
            if (tour) {
                const totalTasksWeight = tasks.reduce((sum, task) => sum + task.poids, 0);
                if (totalTasksWeight > tour.capacitePoids) {
                    overweightToursCount++;
                }
            }
        });
        const totalTours = Object.keys(tasksByTour).length;
        const depassementPoids = totalTours > 0 ? (overweightToursCount / totalTours) * 100 : 0;
        
        // % des tournées parties à l'heure ET arrivées en retard
        const lateTourToleranceMinutes = lateTourTolerance;
        const onTimeDepartureLateArrivalTours = Object.values(tasksByTour).filter(({ tour, tasks }) => {
           if (!tour || tour.heureDepartReelle > tour.heureDepartPrevue) return false;
           const firstTask = tasks.sort((a,b) => a.ordre - b.ordre)[0];
           const firstTaskDelayMinutes = (firstTask.retard) / 60;
           return firstTask && firstTaskDelayMinutes > lateTourToleranceMinutes;
        }).length;
        const tourneesPartiesHeureRetard = totalTours > 0 ? (onTimeDepartureLateArrivalTours / totalTours) * 100 : 0;

        // % des tournées parties à l'heure avec une livraison ayant plus de 15min de retard
        const significantDelayTours = Object.values(tasksByTour).filter(({ tour, tasks }) => {
            // Condition 1: La tournée doit partir à l'heure
            if (!tour || tour.heureDepartReelle > tour.heureDepartPrevue) {
                return false;
            }

            // Condition 2: Au moins une livraison doit avoir plus de 15 minutes de retard
            const hasSignificantDelay = tasks.some(task => {
                const delayInMinutes = (task.heureCloture - task.heureFinCreneau) / 60;
                return delayInMinutes > toleranceMinutes;
            });

            return hasSignificantDelay;
        }).length;

        const tourneesRetardAccumule = totalTours > 0 ? (significantDelayTours / totalTours) * 100 : 0;


        // % des notes négatives (1-3) qui sont arrivées en retard
        const negativeRatings = depotData.filter(d => d.notation != null && d.notation >= 1 && d.notation <= 3);
        const negativeRatingsLate = negativeRatings.filter(d => d.retardStatus === 'late');
        const notesNegativesRetard = negativeRatings.length > 0 ? (negativeRatingsLate.length / negativeRatings.length) * 100 : 0;

        
        // Créneau le plus choisi et créneau le plus en retard
        const slotStats: Record<string, { total: number, late: number }> = {};
        depotData.forEach(task => {
            const startTime = new Date(task.heureDebutCreneau * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
            const endTime = new Date(task.heureFinCreneau * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
            const slotKey = `${startTime}-${endTime}`;

            if (!slotStats[slotKey]) {
                slotStats[slotKey] = { total: 0, late: 0 };
            }
            slotStats[slotKey].total++;
            if (task.retardStatus === 'late') {
                slotStats[slotKey].late++;
            }
        });

        let creneauLePlusChoisi = "N/A";
        if (Object.keys(slotStats).length > 0) {
            const [slot, stats] = Object.entries(slotStats).reduce((a, b) => a[1].total > b[1].total ? a : b);
            const percentage = (stats.total / totalDeliveries) * 100;
            creneauLePlusChoisi = `${slot} (${percentage.toFixed(2)}%)`;
        }
        
        let creneauLePlusEnRetard = "N/A";
        const lateSlots = Object.entries(slotStats).filter(([, stats]) => stats.late > 0);
        if (lateSlots.length > 0) {
            const [worstSlot, worstSlotStats] = lateSlots.reduce((a, b) => a[1].late > b[1].late ? a : b);
            const percentage = (worstSlotStats.late / worstSlotStats.total) * 100;
            creneauLePlusEnRetard = `${worstSlot} (${percentage.toFixed(2)}% de retards)`;
        }


        // Intensité du travail par créneau (limité de 06h à 22h)
        const tasksBySlot: Record<string, { planned: number, real: number, plannedTours: Set<string>, realTours: Set<string> }> = {};
        for (let i = 6; i < 22; i += 2) {
            const start = String(i).padStart(2, '0');
            const end = String(i + 2).padStart(2, '0');
            tasksBySlot[`${start}h-${end}h`] = { planned: 0, real: 0, plannedTours: new Set(), realTours: new Set() };
        }

        depotData.forEach(task => {
            const realHourIndex = new Date(task.heureCloture * 1000).getUTCHours();
            const realSlotIndex = Math.floor(realHourIndex / 2) * 2;
            const realSlotKey = `${String(realSlotIndex).padStart(2, '0')}h-${String(realSlotIndex + 2).padStart(2, '0')}h`;
            if (tasksBySlot[realSlotKey]) {
                tasksBySlot[realSlotKey].real++;
                tasksBySlot[realSlotKey].realTours.add(task.tourneeUniqueId);
            }

            const plannedHourIndex = new Date(task.heureArriveeApprox * 1000).getUTCHours();
            const plannedSlotIndex = Math.floor(plannedHourIndex / 2) * 2;
            const plannedSlotKey = `${String(plannedSlotIndex).padStart(2, '0')}h-${String(plannedSlotIndex + 2).padStart(2, '0')}h`;
            if (tasksBySlot[plannedSlotKey]) {
                tasksBySlot[plannedSlotKey].planned++;
                tasksBySlot[plannedSlotKey].plannedTours.add(task.tourneeUniqueId);
            }
        });

        const slotIntensities = Object.entries(tasksBySlot).map(([slotKey, slotData]) => {
            const avgPlanned = slotData.plannedTours.size > 0 ? slotData.planned / slotData.plannedTours.size : 0;
            const avgReal = slotData.realTours.size > 0 ? slotData.real / slotData.realTours.size : 0;
            return { slotKey, avgPlanned, avgReal };
        }).filter(intensity => intensity.avgPlanned > 0 || intensity.avgReal > 0);

        const totalAvgPlanned = slotIntensities.reduce((sum, item) => sum + item.avgPlanned, 0);
        const totalAvgReal = slotIntensities.reduce((sum, item) => sum + item.avgReal, 0);
        const intensiteTravailPlanifie = slotIntensities.length > 0 ? totalAvgPlanned / slotIntensities.length : 0;
        const intensiteTravailRealise = slotIntensities.length > 0 ? totalAvgReal / slotIntensities.length : 0;

        let creneauPlusIntense = "N/A";
        let creneauMoinsIntense = "N/A";

        if (slotIntensities.length > 0) {
            const mostIntense = slotIntensities.reduce((max, current) => current.avgReal > max.avgReal ? current : max, slotIntensities[0]);
            creneauPlusIntense = `${mostIntense.slotKey} (${mostIntense.avgReal.toFixed(2)})`;

            const leastIntense = slotIntensities.reduce((min, current) => current.avgReal < min.avgReal ? current : min, slotIntensities[0]);
            creneauMoinsIntense = `${leastIntense.slotKey} (${leastIntense.avgReal.toFixed(2)})`;
        }

        return {
            entrepot: depotName,
            ponctualitePrev: `${ponctualitePrev.toFixed(2)}%`,
            ponctualiteRealisee: `${ponctualiteRealisee.toFixed(2)}%`,
            tourneesPartiesHeureRetard: `${tourneesPartiesHeureRetard.toFixed(2)}%`,
            tourneesRetardAccumule: `${tourneesRetardAccumule.toFixed(2)}%`,
            notesNegativesRetard: `${notesNegativesRetard.toFixed(2)}%`,
            depassementPoids: `${depassementPoids.toFixed(2)}%`,
            creneauLePlusChoisi,
            creneauLePlusEnRetard,
            intensiteTravailPlanifie: intensiteTravailPlanifie.toFixed(2),
            intensiteTravailRealise: intensiteTravailRealise.toFixed(2),
            creneauPlusIntense,
            creneauMoinsIntense,
        };
    }).filter(Boolean) as DepotStats[];
}


function calculatePostalCodeStats(data: MergedData[]): PostalCodeStats[] {
    const postalCodeStats: Record<string, { total: number; late: number; depot: string }> = {};

    data.forEach(item => {
        if (item.codePostal && item.tournee) {
            if (!postalCodeStats[item.codePostal]) {
                postalCodeStats[item.codePostal] = { total: 0, late: 0, depot: item.tournee.entrepot };
            }
            postalCodeStats[item.codePostal].total++;
            if (item.retardStatus === 'late') {
                postalCodeStats[item.codePostal].late++;
            }
        }
    });

    return Object.entries(postalCodeStats)
        .map(([codePostal, stats]) => ({
            codePostal,
            entrepot: stats.depot,
            totalLivraisons: stats.total,
            livraisonsRetard: stats.total > 0 ? ((stats.late / stats.total) * 100).toFixed(2) + '%' : '0.00%',
        }))
        .sort((a, b) => parseFloat(b.livraisonsRetard) - parseFloat(a.livraisonsRetard));
};

function calculateSaturationData(filteredData: MergedData[]): SaturationData[] {
    const hourlyBuckets: Record<string, { demand: number; capacity: number }> = {};
    for (let i = 6; i < 23; i++) {
        const hour = i.toString().padStart(2, '0');
        hourlyBuckets[`${hour}:00`] = { demand: 0, capacity: 0 };
    }

    (filteredData || []).forEach(task => {
        const startHour = new Date(task.heureDebutCreneau * 1000).getUTCHours();
        const endHour = new Date(task.heureFinCreneau * 1000).getUTCHours();
        for (let i = startHour; i < endHour; i++) {
            const hourKey = `${i.toString().padStart(2, '0')}:00`;
            if (hourlyBuckets[hourKey]) {
                hourlyBuckets[hourKey].demand++;
            }
        }

        const closureHour = new Date(task.heureCloture * 1000).getUTCHours();
        const capacityHourKey = `${closureHour.toString().padStart(2, '0')}:00`;
        if (hourlyBuckets[capacityHourKey]) {
            hourlyBuckets[capacityHourKey].capacity++;
        }
    });
    
    const data = Object.entries(hourlyBuckets)
        .map(([hour, data]) => ({ hour, ...data }));
        
    return data
        .filter(item => item.demand > 0 || item.capacity > 0)
        .map(item => ({ hour: item.hour, gap: item.demand - item.capacity }));
}

function calculateCustomerPromiseData(filteredData: MergedData[]): CustomerPromiseData[] {
    if (!filteredData) return [];

    const buckets: Record<string, { customerPromise: number; urbantzPlan: number; realized: number; late: number }> = {};
    const startTimestamp = new Date();
    startTimestamp.setUTCHours(6, 0, 0, 0);
    const endTimestamp = new Date();
    endTimestamp.setUTCHours(23, 0, 0, 0);

    for (let i = startTimestamp.getTime(); i < endTimestamp.getTime(); i += 60 * 1000) {
        const d = new Date(i);
        const hour = String(d.getUTCHours()).padStart(2, '0');
        const minute = String(d.getUTCMinutes()).padStart(2, '0');
        buckets[`${hour}:${minute}`] = { customerPromise: 0, urbantzPlan: 0, realized: 0, late: 0 };
    }

    const deliveriesBySlot = filteredData.reduce((acc, task) => {
        const start = new Date(task.heureDebutCreneau * 1000);
        const end = new Date(task.heureFinCreneau * 1000);
        const key = `${start.toISOString()}-${end.toISOString()}`;
        if (!acc[key]) {
            acc[key] = { count: 0, start, end };
        }
        acc[key].count++;
        return acc;
    }, {} as Record<string, { count: number; start: Date; end: Date }>);

    Object.values(deliveriesBySlot).forEach(slot => {
        const durationMinutes = (slot.end.getTime() - slot.start.getTime()) / (1000 * 60);
        if (durationMinutes === 0) return;
        const weightPerMinute = slot.count / durationMinutes;

        for (let i = 0; i < durationMinutes; i++) {
            const intervalStart = new Date(slot.start.getTime() + i * 60 * 1000);
            const hour = String(intervalStart.getUTCHours()).padStart(2, '0');
            const minute = String(intervalStart.getUTCMinutes()).padStart(2, '0');
            const bucketKey = `${hour}:${minute}`;
            
            if (buckets[bucketKey]) {
                buckets[bucketKey].customerPromise += weightPerMinute;
            }
        }
    });

    filteredData.forEach(task => {
        // Urbantz Plan
        const approxDate = new Date(task.heureArriveeApprox * 1000);
        const approxHour = String(approxDate.getUTCHours()).padStart(2, '0');
        const approxMinute = String(approxDate.getUTCMinutes()).padStart(2, '0');
        const approxBucketKey = `${approxHour}:${approxMinute}`;
        if (buckets[approxBucketKey]) {
            buckets[approxBucketKey].urbantzPlan++;
        }

        // Realized
        const closureDate = new Date(task.heureCloture * 1000);
        const closureHour = String(closureDate.getUTCHours()).padStart(2, '0');
        const closureMinute = String(closureDate.getUTCMinutes()).padStart(2, '0');
        const closureBucketKey = `${closureHour}:${closureMinute}`;
        if (buckets[closureBucketKey]) {
            buckets[closureBucketKey].realized++;
            if (task.retardStatus === 'late') {
                buckets[closureBucketKey].late++;
            }
        }
    });
    
    return Object.entries(buckets).map(([hour, data]) => ({ ...data, hour }));
}

// Helper to format time from minutes for simulation
const formatTime = (minutes: number) => {
    const h = Math.floor(minutes / 60).toString().padStart(2, '0');
    const m = (minutes % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
};

function calculateSimulationData(data: MergedData[]): { actualSlotDistribution: ActualSlotDistribution[], simulatedPromiseData: SimulatedPromiseData[] } {
    if (!data || data.length === 0) {
        return { actualSlotDistribution: [], simulatedPromiseData: [] };
    }

    // --- Actual Slot Distribution ---
    const dataByWarehouse = data.reduce((acc, task) => {
        const warehouse = task.tournee?.entrepot;
        if (warehouse) {
            if (!acc[warehouse]) acc[warehouse] = [];
            acc[warehouse].push(task);
        }
        return acc;
    }, {} as Record<string, MergedData[]>);

    const actualSlotDistribution: ActualSlotDistribution[] = [];
    for (const warehouse in dataByWarehouse) {
        const tasks = dataByWarehouse[warehouse];
        const totalOrders = tasks.length;
        const ordersBySlot = tasks.reduce((acc, task) => {
            const start = new Date(task.heureDebutCreneau * 1000);
            const end = new Date(task.heureFinCreneau * 1000);
            const slotKey = `${start.getUTCHours().toString().padStart(2, '0')}:${start.getUTCMinutes().toString().padStart(2, '0')}-${end.getUTCHours().toString().padStart(2, '0')}:${end.getUTCMinutes().toString().padStart(2, '0')}`;
            if (!acc[slotKey]) acc[slotKey] = 0;
            acc[slotKey]++;
            return acc;
        }, {} as Record<string, number>);
        
        Object.keys(ordersBySlot).sort().forEach(slot => {
            const count = ordersBySlot[slot];
            actualSlotDistribution.push({
                warehouse,
                slot,
                count,
                percentage: ((count / totalOrders) * 100).toFixed(2) + '%'
            });
        });
    }

    // --- Simulated Promise Data ---
    const totalOrders = data.length;
    const originalDistribution: Record<number, number> = {};
    for (let i = 6; i < 22; i++) originalDistribution[i] = 0;
    data.forEach(task => {
        const startHour = new Date(task.heureDebutCreneau * 1000).getUTCHours();
        if (originalDistribution[startHour] !== undefined) {
            originalDistribution[startHour]++;
        }
    });

    const newSlots: { start: number; key: string }[] = [];
    for (let i = 6 * 60; i < 22 * 60; i += 30) {
        newSlots.push({ start: i, key: `${formatTime(i)}-${formatTime(i + 120)}` });
    }

    const simulatedCounts: Record<string, number> = {};
    let simulatedTotal = 0;
    newSlots.forEach(slot => {
        const startHour = Math.floor(slot.start / 60);
        const nextHour = startHour + 1;
        const proportion = (slot.start % 60) / 60;
        const dist1 = originalDistribution[startHour] || 0;
        const dist2 = originalDistribution[nextHour] || 0;
        simulatedCounts[slot.key] = dist1 * (1 - proportion) + dist2 * proportion;
        simulatedTotal += simulatedCounts[slot.key];
    });
    
    if (simulatedTotal > 0) {
        const normalizationFactor = totalOrders / simulatedTotal;
        for (const key in simulatedCounts) {
            simulatedCounts[key] *= normalizationFactor;
        }
    }

    let totalPlanOffset = 0, totalRealizedOffset = 0, lateCount = 0;
    data.forEach(task => {
        totalPlanOffset += (task.heureArriveeApprox - task.heureDebutCreneau);
        totalRealizedOffset += (task.heureCloture - task.heureArriveeApprox);
        if (task.retardStatus === 'late') {
            lateCount++;
        }
    });
    const avgPlanOffsetMinutes = data.length > 0 ? (totalPlanOffset / data.length) / 60 : 0;
    const avgRealizedOffsetMinutes = data.length > 0 ? (totalRealizedOffset / data.length) / 60 : 0;
    const lateProbability = data.length > 0 ? lateCount / data.length : 0;

    const buckets: Record<string, { customerPromise: number; urbantzPlan: number; realized: number; late: number }> = {};
    for (let i = 6 * 60; i < 23 * 60; i++) {
        buckets[formatTime(i)] = { customerPromise: 0, urbantzPlan: 0, realized: 0, late: 0 };
    }

    for (const slotKey in simulatedCounts) {
        const ordersInSlot = simulatedCounts[slotKey];
        const [startStr] = slotKey.split('-');
        const [startH, startM] = startStr.split(':').map(Number);
        const startMinutes = startH * 60 + startM;
        const duration = 120;
        const weightPerMinute = ordersInSlot / duration;

        for (let i = 0; i < duration; i++) {
            const currentMinute = startMinutes + i;
            const promiseKey = formatTime(currentMinute);
            if (buckets[promiseKey]) {
                buckets[promiseKey].customerPromise += weightPerMinute;
                const planKey = formatTime(currentMinute + avgPlanOffsetMinutes);
                if (buckets[planKey]) buckets[planKey].urbantzPlan += weightPerMinute;
                const realizedKey = formatTime(currentMinute + avgPlanOffsetMinutes + avgRealizedOffsetMinutes);
                if (buckets[realizedKey]) {
                    buckets[realizedKey].realized += weightPerMinute;
                    if (Math.random() < lateProbability) {
                       buckets[realizedKey].late += weightPerMinute;
                    }
                }
            }
        }
    }
    
    const simulatedPromiseData = Object.entries(buckets).map(([hour, data]) => ({ ...data, hour }));

    return { actualSlotDistribution, simulatedPromiseData };
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
        avgWorkloadByDriverBySlot: [],
        avgWorkload: { avgPlanned: 0, avgReal: 0 },
        performanceByDayOfWeek: [],
        performanceByTimeSlot: [],
        delayHistogram: [],
        cities: [],
        depots: [],
        warehouses: [],
        globalSummary: { punctualityRatePlanned: 0, punctualityRateRealized: 0, avgDurationDiscrepancyPerTour: 0, avgWeightDiscrepancyPerTour: 0, weightOverrunPercentage: 0, durationOverrunPercentage: 0 },
        performanceByDepot: [],
        performanceByWarehouse: [],
        firstTaskLatePercentage: 0,
        depotStats: [],
        postalCodeStats: [],
        saturationData: [],
        customerPromiseData: [],
        actualSlotDistribution: [],
        simulatedPromiseData: [],
    };
}


function getPunctualityStats(completedTasks: MergedData[]) {
    const lateTasks = completedTasks.filter(t => t.retardStatus === 'late');
    const earlyTasks = completedTasks.filter(t => t.retardStatus === 'early');
    const onTimeTasks = completedTasks.filter(t => t.retardStatus === 'onTime');

    const outOfTimeTasks = lateTasks.length + earlyTasks.length;

    const predictedTasksOnTime = completedTasks.filter(t => t.retardPrevisionnelStatus === 'onTime');
    const predictedOutOfTimeTasks = completedTasks.length - predictedTasksOnTime.length;

    const punctualityRate = completedTasks.length > 0 ? (onTimeTasks.length / completedTasks.length) * 100 : 100;
    const predictedPunctualityRate = completedTasks.length > 0 ? (predictedTasksOnTime.length / completedTasks.length) * 100 : 100;

    return {
        lateTasks,
        earlyTasks,
        outOfTimeTasks,
        predictedOutOfTimeTasks,
        punctualityRate,
        predictedPunctualityRate,
    };
}

export function formatSeconds(seconds: number): string {
    if (seconds < 0) seconds = 0;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m < 10 ? '0' : ''}${m}m`;
}

    


