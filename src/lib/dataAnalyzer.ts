

import type { MergedData, AnalysisData, Tournee, GlobalSummary } from './types';
import { calculateKpis, calculateDiscrepancyKpis, calculateQualityKpis } from './analysis/kpis';
import { calculateAnomalies } from './analysis/anomalies';
import { calculatePerformanceByDriver, calculatePerformanceByGeo, calculatePerformanceByGroup } from './analysis/performance';
import { calculateTemporalAnalyses } from './analysis/temporal';
import { calculateWorkloadAnalyses } from './analysis/workload';

export function analyzeData(data: MergedData[], filters: Record<string, any>): AnalysisData {
    
    const toleranceSeconds = filters.punctualityThreshold || 959;

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
    const generalKpis = calculateKpis(completedTasks, uniqueTournees, toleranceSeconds);
    const { lateTasks, earlyTasks, punctualityRate, predictedPunctualityRate, outOfTimeTasks, predictedOutOfTimeTasks } = getPunctualityStats(completedTasks, toleranceSeconds);
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
        cities: [...new Set(completedTasks.map(t => t.ville))].sort(),
        globalSummary,
        performanceByDepot,
        performanceByWarehouse,
        firstTaskLatePercentage
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
        avgWorkloadByDriverBySlot: [],
        avgWorkload: { avgPlanned: 0, avgReal: 0 },
        performanceByDayOfWeek: [],
        performanceByTimeSlot: [],
        delayHistogram: [],
        cities: [],
        globalSummary: { punctualityRatePlanned: 0, punctualityRateRealized: 0, avgDurationDiscrepancyPerTour: 0, avgWeightDiscrepancyPerTour: 0, weightOverrunPercentage: 0, durationOverrunPercentage: 0 },
        performanceByDepot: [],
        performanceByWarehouse: [],
        firstTaskLatePercentage: 0
    };
}


function getPunctualityStats(completedTasks: MergedData[], toleranceSeconds: number) {
    const lateTasks = completedTasks.filter(t => t.retardStatus === 'late');
    const earlyTasks = completedTasks.filter(t => t.retard < -toleranceSeconds);
    const outOfTimeTasks = lateTasks.length + earlyTasks.length;

    const predictedTasksOnTime = completedTasks.filter(t => t.retardPrevisionnelStatus === 'onTime');
    const predictedOutOfTimeTasks = completedTasks.length - predictedTasksOnTime.length;

    const punctualityRate = completedTasks.length > 0 ? ((completedTasks.length - outOfTimeTasks) / completedTasks.length) * 100 : 100;
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
