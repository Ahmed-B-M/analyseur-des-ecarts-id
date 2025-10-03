import type { MergedData, AnalysisData } from '../types';

export function createEmptyAnalysisData(): AnalysisData {
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


export function getPunctualityStats(completedTasks: MergedData[], toleranceSeconds: number) {
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
