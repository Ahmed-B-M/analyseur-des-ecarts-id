import type { MergedData, DepotStats, PostalCodeStats, SaturationData, CustomerPromiseData, ActualSlotDistribution, SimulatedPromiseData } from '../types';

export function calculateDepotStats (data: MergedData[], toleranceSeconds: number, lateTourTolerance: number): DepotStats[] {
    const depotNames = [...new Set(data.map(item => item.tournee?.entrepot).filter(Boolean) as string[])];
    
    return depotNames.map(depotName => {
        const depotData = data.filter(item => item.tournee?.entrepot === depotName);
        if (depotData.length === 0) {
            return null;
        }

        const totalDeliveries = depotData.length;
        const toleranceMinutes = toleranceSeconds / 60;

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


export function calculatePostalCodeStats(data: MergedData[]): PostalCodeStats[] {
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

export function calculateSaturationData(filteredData: MergedData[]): SaturationData[] {
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

export function calculateCustomerPromiseData(filteredData: MergedData[]): CustomerPromiseData[] {
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

export function calculateSimulationData(data: MergedData[]): { actualSlotDistribution: ActualSlotDistribution[], simulatedPromiseData: SimulatedPromiseData[] } {
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
