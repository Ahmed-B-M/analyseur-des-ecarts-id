
import type { MergedData, WorkloadByHour, AvgWorkloadBySlot, AvgWorkload } from '../types';

export function calculateWorkloadAnalyses(completedTasks: MergedData[]) {
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
