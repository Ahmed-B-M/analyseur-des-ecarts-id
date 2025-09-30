
import type { MergedData, Tournee, PerformanceByDriver, PerformanceByGeo, PerformanceByGroup } from '../types';

export function calculatePerformanceByDriver(toursWithTasks: { tour: Tournee, tasks: MergedData[] }[]): PerformanceByDriver[] {
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

export function calculatePerformanceByGeo(tasks: MergedData[], tourneeMap: Map<string, { tour: Tournee, tasks: MergedData[] }>, key: 'ville' | 'codePostal'): PerformanceByGeo[] {
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

export function calculatePerformanceByGroup(tasks: MergedData[], tourneeMap: Map<string, { tour: Tournee, tasks: MergedData[] }>, keyGetter: (task: MergedData) => string): PerformanceByGroup[] {
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
