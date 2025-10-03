import type { MergedData, AnalysisData, Tournee } from './types';
import { getDay } from 'date-fns';
import { calculateKpis, calculateDiscrepancyKpis, calculateQualityKpis } from './analysis/kpis';
import { calculateAnomalies } from './analysis/anomalies';
import { calculatePerformanceByDriver, calculatePerformanceByGeo, calculatePerformanceByGroup } from './analysis/performance';
import { calculateTemporalAnalyses } from './analysis/temporal';
import { calculateWorkloadAnalyses } from './analysis/workload';
import { calculateDepotStats, calculatePostalCodeStats, calculateSaturationData, calculateCustomerPromiseData, calculateSimulationData } from './analysis/stats';
import { createEmptyAnalysisData, getPunctualityStats } from './analysis/utils';

export function analyzeData(data: MergedData[], filters: Record<string, any>): AnalysisData {
    const toleranceSeconds = filters.punctualityThreshold || 900;
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
            task.retard = cloture - debutCreneau;
        } else if (cloture > finCreneau + toleranceSeconds) {
            task.retardStatus = 'late';
            task.retard = cloture - finCreneau;
        } else {
            task.retardStatus = 'onTime';
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
    const { lateTasks, earlyTasks, punctualityRate, predictedPunctualityRate, outOfTimeTasks, predictedOutOfTimeTasks } = getPunctualityStats(completedTasks, toleranceSeconds);

    const generalKpis = calculateKpis(completedTasks, uniqueTournees, toleranceSeconds);
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

    const globalSummary = {
        punctualityRatePlanned: predictedPunctualityRate,
        punctualityRateRealized: punctualityRate,
        avgDurationDiscrepancyPerTour: uniqueTournees.length > 0 ? (totals.dureeReelleCalculee - totals.dureePrevue) / uniqueTournees.length : 0,
        avgWeightDiscrepancyPerTour: uniqueTournees.length > 0 ? (totals.poidsReel - totals.poidsPrevu) / uniqueTournees.length : 0,
        weightOverrunPercentage: totals.poidsPrevu > 0 ? ((totals.poidsReel - totals.poidsPrevu) / totals.poidsPrevu) * 100 : 0,
        durationOverrunPercentage: totals.dureePrevue > 0 ? ((totals.dureeReelleCalculee - totals.dureePrevue) / totals.dureePrevue) * 100 : 0,
    };
    
    const depotStats = calculateDepotStats(completedTasks, toleranceSeconds, lateTourTolerance);
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
