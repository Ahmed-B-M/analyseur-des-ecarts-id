
import type { MergedData, AnalysisData, Tournee, GlobalSummary, DepotStats, PostalCodeStats, SaturationData, CustomerPromiseData, ActualSlotDistribution, SimulatedPromiseData } from './types';
import { calculateKpis, calculateDiscrepancyKpis, calculateQualityKpis } from './analysis/kpis';
import { calculateAnomalies } from './analysis/anomalies';
import { calculatePerformanceByDriver, calculatePerformanceByGeo, calculatePerformanceByGroup } from './analysis/performance';
import { calculateTemporalAnalyses } from './analysis/temporal';
import { calculateWorkloadAnalyses } from './analysis/workload';

export function analyzeData(data: MergedData[], filters: Record<string, any>): AnalysisData {
    
    const toleranceSeconds = filters.punctualityThreshold || 900;
    const lateTourTolerance = filters.lateTourTolerance || 0;

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
    
    const depotStats = calculateDepotStats(completedTasks, toleranceSeconds, lateTourTolerance);
    const postalCodeStats = calculatePostalCodeStats(completedTasks, toleranceSeconds);
    const saturationData = calculateSaturationData(completedTasks);
    const customerPromiseData = calculateCustomerPromiseData(completedTasks, toleranceSeconds);
    const { actualSlotDistribution, simulatedPromiseData } = calculateSimulationData(completedTasks, toleranceSeconds);


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

function calculateDepotStats (data: MergedData[], toleranceSeconds: number, lateTourTolerance: number): DepotStats[] {
    const depotNames = [...new Set(data.map(item => item.tournee?.entrepot).filter(Boolean) as string[])];
    
    return depotNames.map(depotName => {
        const depotData = data.filter(item => item.tournee?.entrepot === depotName);
        if (depotData.length === 0) {
            return null;
        }

        const totalDeliveries = depotData.length;

        // Ponctualité Prév. (aligné avec dataAnalyzer.ts)
        const predictedTasksOnTime = depotData.filter(d => {
            let predictedRetard = 0;
            if (d.heureArriveeApprox < d.heureDebutCreneau) {
                predictedRetard = d.heureArriveeApprox - d.heureDebutCreneau;
            } else if (d.heureArriveeApprox > d.heureFinCreneau) {
                predictedRetard = d.heureArriveeApprox - d.heureFinCreneau;
            }
            return Math.abs(predictedRetard) <= toleranceSeconds;
        }).length;
        const ponctualitePrev = totalDeliveries > 0 ? (predictedTasksOnTime / totalDeliveries) * 100 : 0;


        // Ponctualité Réalisée (incluant les avances de plus de 15 min comme non ponctuelles)
        const realizedOnTime = depotData.filter(d => {
            return Math.abs(d.retard) <= toleranceSeconds;
        }).length;
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
        const lateTourToleranceSeconds = lateTourTolerance * 60;
        const onTimeDepartureLateArrivalTours = Object.values(tasksByTour).filter(({ tour, tasks }) => {
           if (!tour || tour.heureDepartReelle > tour.heureDepartPrevue) return false;
           const firstTask = tasks.sort((a,b) => a.ordre - b.ordre)[0];
           return firstTask && firstTask.retard > lateTourToleranceSeconds;
        }).length;
        const tourneesPartiesHeureRetard = totalTours > 0 ? (onTimeDepartureLateArrivalTours / totalTours) * 100 : 0;

        // % des tournées parties à l'heure avec une livraison ayant plus de 15min de retard
        const significantDelayTours = Object.values(tasksByTour).filter(({ tour, tasks }) => {
            // Condition 1: La tournée doit partir à l'heure
            if (!tour || tour.heureDepartReelle > tour.heureDepartPrevue) {
                return false;
            }

            // Condition 2: Au moins une livraison doit avoir plus de 15 minutes de retard
            const fifteenMinutesInSeconds = 15 * 60;
            const hasSignificantDelay = tasks.some(task =>
                task.retard > fifteenMinutesInSeconds
            );

            return hasSignificantDelay;
        }).length;

        const tourneesRetardAccumule = totalTours > 0 ? (significantDelayTours / totalTours) * 100 : 0;


        // % des notes négatives (1-3) qui sont arrivées en retard
        const negativeRatings = depotData.filter(d => d.notation && d.notation >= 1 && d.notation <= 3);
        const negativeRatingsLate = negativeRatings.filter(d => d.retard > toleranceSeconds);
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
            if (task.retard > toleranceSeconds) {
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


function calculatePostalCodeStats(data: MergedData[], toleranceSeconds: number): PostalCodeStats[] {
    const postalCodeStats: Record<string, { total: number; late: number; depot: string }> = {};

    data.forEach(item => {
        if (item.codePostal && item.tournee) {
            if (!postalCodeStats[item.codePostal]) {
                postalCodeStats[item.codePostal] = { total: 0, late: 0, depot: item.tournee.entrepot };
            }
            postalCodeStats[item.codePostal].total++;
            // Le retard est défini par un dépassement du créneau horaire du client + la tolérance
            if (item.retard > toleranceSeconds) {
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

function calculateCustomerPromiseData(filteredData: MergedData[], punctualityThreshold: number): CustomerPromiseData[] {
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

    const lateToleranceSeconds = (punctualityThreshold || 900);

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
            if (task.retard > lateToleranceSeconds) {
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

function calculateSimulationData(data: MergedData[], punctualityThreshold: number): { actualSlotDistribution: ActualSlotDistribution[], simulatedPromiseData: SimulatedPromiseData[] } {
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
    const lateToleranceSeconds = punctualityThreshold * 60;
    data.forEach(task => {
        totalPlanOffset += (task.heureArriveeApprox - task.heureDebutCreneau);
        totalRealizedOffset += (task.heureCloture - task.heureArriveeApprox);
        if (task.heureCloture > task.heureFinCreneau + lateToleranceSeconds) {
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
