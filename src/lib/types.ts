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
};

export type Tache = {
  tourneeUniqueId: string;
  nomTournee: string;
  date: string; // YYYY-MM-DD
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

export type PerformanceBy<T> = {
  key: T;
  totalTasks: number;
  punctualityRate: number;
  avgDelay: number; // in minutes
  avgRating?: number;
};

export type OverloadedTourInfo = Tournee & {
    isOverloaded: boolean;
    depassementPoids: number;
    tauxDepassementPoids: number;
    depassementBacs: number;
    tauxDepassementBacs: number;
};

export type LateStartAnomaly = Tournee & {
  tasksInDelay: number;
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
}

export type AvgWorkloadByHour = {
  hour: string;
  avgLoad: number;
}

export type AnalysisData = {
  generalKpis: Kpi[];
  discrepancyKpis: ComparisonKpi[];
  qualityKpis: Kpi[];
  overloadedTours: OverloadedTourInfo[];
  lateStartAnomalies: LateStartAnomaly[];
  performanceByDriver: PerformanceBy<string>[];
  delaysByWarehouse: DelayCount[];
  delaysByHour: DelayByHour[];
  delaysByCity: DelayCount[];
  delaysByPostalCode: DelayCount[];
  workloadByHour: WorkloadByHour[];
  avgWorkloadByDriverByHour: AvgWorkloadByHour[];
  aiAnalysisResults?: {
    totalNegative: number;
    relatedToTiming: number;
    breakdown: { reason: string; count: number }[];
  };
};

export type AiAnalysisResult = {
  reason: 'Retard' | 'Avance' | 'Autre';
};
