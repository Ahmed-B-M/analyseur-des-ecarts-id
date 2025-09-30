
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


function createDelayHistogram(tasks: MergedData[], toleranceSeconds: number): DelayHistogramBin[] {
    const toleranceMinutes = Math.round(toleranceSeconds / 60);
    const bins: { [key: string]: { min: number, max: number, count: number } } = {
        '> 60 min en avance': { min: -Infinity, max: -3601, count: 0 },
        '30-60 min en avance': { min: -3600, max: -1801, count: 0 },
        [`${toleranceMinutes}-30 min en avance`]: { min: -1800, max: -toleranceSeconds -1, count: 0 },
        'À l\'heure': { min: -toleranceSeconds, max: toleranceSeconds, count: 0 },
        [`${toleranceMinutes}-30 min de retard`]: { min: toleranceSeconds + 1, max: 1800, count: 0 },
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
