
import type { Tournee, MergedData, OverloadedTourInfo, DurationDiscrepancy, LateStartAnomaly } from '../types';

export function calculateAnomalies(
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
        const isOverloadedByWeight = tour.poidsPrevu > 0 && tour.poidsReel > (tour.poidsPrevu * 1.1); // 10% tolerance vs planned
        const isOverloadedByBins = tour.bacsPrevus > 0 && tour.bacsReels > tour.bacsPrevus;
        const isOverloadedByTime = tour.dureePrevue > 0 && tour.dureeReelleCalculee! > (tour.dureePrevue * 1.2); // 20% tolerance

        const depassementPoids = tour.poidsReel - tour.poidsPrevu;
        const tauxDepassementPoids = tour.poidsPrevu > 0 ? (depassementPoids / tour.poidsPrevu) * 100 : 0;
        const depassementBacs = tour.bacsReels - tour.bacsPrevus;
        const tauxDepassementBacs = tour.bacsPrevus > 0 ? (depassementBacs / tour.bacsPrevus) * 100 : 0;

        return {
            ...tour, 
            isOverloaded: isOverloadedByWeight || isOverloadedByBins || isOverloadedByTime,
            depassementPoids: depassementPoids,
            tauxDepassementPoids: tauxDepassementPoids,
            depassementBacs: depassementBacs,
            tauxDepassementBacs: tauxDepassementBacs,
        };
    }).filter(t => t.isOverloaded)
      .sort((a,b) => b.tauxDepassementPoids - a.tauxDepassementPoids || b.tauxDepassementBacs - a.tauxDepassementBacs);
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
