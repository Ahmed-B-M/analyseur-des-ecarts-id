import type { LucideProps } from "lucide-react";
import type { ForwardRefExoticComponent, RefAttributes } from "react";

export type Tournee = {
  uniqueId: string;
  nom: string;
  date: string; // YYYY-MM-DD
  entrepot: string;
  livreur: string;
  distancePrevue: number; // in km
  distanceReelle: number; // in km
  dureePrevue: number; // in seconds
  dureeReelle: number; // in seconds
  dureeReelleCalculee?: number; // in seconds, calculated from tasks
  heureDepartPrevue: number; // in seconds from midnight
  heureFinPrevue: number; // in seconds from midnight
  heureDepartReelle: number; // in seconds from midnight
  heureFinReelle: number; // in seconds from midnight
  demarre: number; // in seconds from midnight
  termine: number; // in seconds from midnight
  capaciteBacs: number;
  bacsPrevus: number;
  bacsReels: number;
  capacitePoids: number; // in kg
  poidsPrevu: number; // in kg
  poidsReel: number; 
  tempsPreparationLivreur?: number;
  tempsService?: number;
  tempsParcours?: number;
  codePostalMajoritaire?: string;
  dureeEstimeeOperationnelle?: number;
  heurePremiereLivraisonPrevue?: number;
  heurePremiereLivraisonReelle?: number;
  heureDerniereLivraisonPrevue?: number;
  heureDerniereLivraisonReelle?: number;
};

export type Tache = {
  tourneeUniqueId: string;
  nomTournee: string;
  date: string; // YYY3-MM-DD
  entrepot: string;
  livreur?: string;
  sequence?: number;
  items: number; // bacs
  codePostal: string;
  heureDebutCreneau: number; // in seconds from midnight
  heureFinCreneau: number; // in seconds from midnight
  heureArriveeApprox: number; // in seconds from midnight
  heureArriveeReelle: number; // in seconds from midnight
  heureCloture: number; // in seconds from midnight
  tempsService?: number; // in seconds
  tempsServiceReel?: number; // in seconds
  retard: number; // in seconds
  retardPrevisionnelS?: number; // in seconds
  retardStatus?: 'late' | 'early' | 'onTime';
  poids: number; // in kg
  ville: string;
  notation: number | null;
  commentaire: string | null;
  avancement?: string;
};

export type MergedData = Tache & { tournee: Tournee | null };

export type Kpi = {
  title: string;
  value: string;
  description?: string;
  icon?: ForwardRefExoticComponent<Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>>;
};

export type ComparisonKpi = {
  title: string;
  value1: string;
  label1: string;
  value2: string;
  label2: string;
  change: string;
  changeType: 'increase' | 'decrease' | 'neutral';
};

export type PerformanceByDriver = {
  key: string; // driver name
  totalTours: number;
  punctualityRate: number;
  avgDelay: number; // in minutes
  overweightToursCount: number;
  avgRating?: number;
};

export type PerformanceByGeo = {
    key: string; // city or postal code
    totalTasks: number;
    punctualityRate: number;
    avgDelay: number; // in minutes
    totalDelays: number;
}

export type OverloadedTourInfo = Tournee & {
    isOverloaded: boolean;
    depassementPoids: number;
    tauxDepassementPoids: number;
    depassementBacs: number;
    tauxDepassementBacs: number;
};

export type LateStartAnomaly = Tournee & {
  tasksInDelay: number;
  ecartDepart: number;
}

export type DurationDiscrepancy = Tournee & {
    dureeEstimee: number;
    dureeReelle: number;
    ecart: number;
    heurePremiereLivraisonPrevue: number;
    heurePremiereLivraisonReelle: number;
    heureDerniereLivraisonPrevue: number;
    heureDerniereLivraisonReelle: number;
}

export type DelayCount = {
    key: string;
    count: number;
}

export type DelayByHour = {
    hour: string;
    count: number;
}

export type WorkloadByHour = {
  hour: string;
  planned: number;
  real: number;
  delays: number;
  advances: number;
}

export type AvgWorkloadByHour = {
  hour: string;
  avgPlanned: number;
  avgReal: number;
}

export type AvgWorkload = {
  avgPlanned: number;
  avgReal: number;
}

export type PerformanceByDay = {
    day: string;
    totalTasks: number;
    punctualityRate: number;
    avgDelay: number; // in minutes
    delays: number;
    advances: number;
};

export type PerformanceByTimeSlot = {
    slot: string;
    totalTasks: number;
    punctualityRate: number;
    avgDelay: number; // in minutes
    delays: number;
    advances: number;
};

export type DelayHistogramBin = {
    range: string;
    count: number;
};


export type AnalysisData = {
  generalKpis: Kpi[];
  discrepancyKpis: ComparisonKpi[];
  qualityKpis: Kpi[];
  overloadedTours: OverloadedTourInfo[];
  durationDiscrepancies: DurationDiscrepancy[];
  lateStartAnomalies: LateStartAnomaly[];
  performanceByDriver: PerformanceByDriver[];
  performanceByCity: PerformanceByGeo[];
  performanceByPostalCode: PerformanceByGeo[];
  delaysByWarehouse: DelayCount[];
  delaysByHour: DelayByHour[];
  delaysByCity: DelayCount[];
  delaysByPostalCode: DelayCount[];
  advancesByWarehouse: DelayCount[];
  advancesByHour: DelayByHour[];
  advancesByCity: DelayCount[];
  advancesByPostalCode: DelayCount[];
  workloadByHour: WorkloadByHour[];
  avgWorkloadByDriverByHour: AvgWorkloadByHour[];
  avgWorkload: AvgWorkload;
  performanceByDayOfWeek: PerformanceByDay[];
  performanceByTimeSlot: PerformanceByTimeSlot[];
  delayHistogram: DelayHistogramBin[];
  cities: string[];
  aiAnalysisResults?: {
    totalNegative: number;
    relatedToTiming: number;
    breakdown: { reason: string; count: number }[];
  };
};

export type AiAnalysisResult = {
  reason: 'Retard' | 'Avance' | 'Autre';
};
