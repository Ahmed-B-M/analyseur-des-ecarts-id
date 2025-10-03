import { getDay } from 'date-fns';
import type { MergedData, DelayCount, DelayByHour, PerformanceByDay, PerformanceByTimeSlot, DelayHistogramBin } from '../types';

export function calculateTemporalAnalyses(
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
    }).filter(s => s.totalTasks > 0); 
}


function createDelayHistogram(tasks: MergedData[], toleranceSeconds: number): DelayHistogramBin[] {
    const toleranceMinutes = toleranceSeconds / 60;

    const bins = [
        { label: `> 60 min en avance`, min: -Infinity, max: -60, count: 0 },
        { label: `30-60 min en avance`, min: -60, max: -30, count: 0 },
        { label: `${toleranceMinutes}-30 min en avance`, min: -30, max: -toleranceMinutes, count: 0 },
        { label: 'À l\'heure', min: -toleranceMinutes, max: toleranceMinutes, count: 0 },
        { label: `${toleranceMinutes}-30 min de retard`, min: toleranceMinutes, max: 30, count: 0 },
        { label: `30-60 min de retard`, min: 30, max: 60, count: 0 },
        { label: `> 60 min de retard`, min: 60, max: Infinity, count: 0 },
    ];

    tasks.forEach(task => {
        const delayInMinutes = task.retard / 60;

        if (delayInMinutes < bins[0].max) {
            bins[0].count++;
        } else if (delayInMinutes >= bins[1].min && delayInMinutes < bins[1].max) {
            bins[1].count++;
        } else if (delayInMinutes >= bins[2].min && delayInMinutes < bins[2].max) {
            bins[2].count++;
        } else if (delayInMinutes >= bins[3].min && delayInMinutes <= bins[3].max) {
            bins[3].count++;
        } else if (delayInMinutes > bins[4].min && delayInMinutes <= bins[4].max) {
            bins[4].count++;
        } else if (delayInMinutes > bins[5].min && delayInMinutes <= bins[5].max) {
            bins[5].count++;
        } else if (delayInMinutes > bins[6].min) {
            bins[6].count++;
        }
    });

    return bins.map(b => ({ range: b.label, count: b.count }));
}
