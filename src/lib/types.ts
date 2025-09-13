import type { LucideProps } from "lucide-react";
import type { ForwardRefExoticComponent, RefAttributes } from "react";

export type Tournee = {
  uniqueId: string;
  nom: string;
  date: string; // YYYY-MM-DD
  entrepot: string;
  livreur: string;
  distancePrevue: number; // in meters
  distanceReelle: number; // in meters
  dureePrevue: number; // in seconds
  dureeReelle: number; // in seconds
  heureDepartPrevue: number; // in seconds from midnight
  heureFinPrevue: number; // in seconds from midnight
  heureDepartReelle: number; // in seconds from midnight
  heureFinReelle: number; // in seconds from midnight
  capaciteBacs: number;
  bacsPrevus: number;
  bacsReels: number;
  capacitePoids: number; // in kg
  poidsPrevu: number; // in kg
  poidsReel: number; 
};

export type Tache = {
  tourneeUniqueId: string;
  nomTournee: string;
  date: string; // YYYY-MM-DD
  entrepot: string;
  livreur: string;
  sequence: number;
  items: number; // bacs
  codePostal: string;
  heureDebutCreneau: number; // in seconds from midnight
  heureFinCreneau: number; // in seconds from midnight
  heureArriveeApprox: number; // in seconds from midnight
  heureCloture: number; // in seconds from midnight
  tempsServiceReel: number; // in seconds
  retard: number; // in seconds
  poids: number; // in kg
  ville: string;
  notation: number | null;
  commentaire: string | null;
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
  overloadCount?: number;
  avgRating?: number;
};

export type OverloadedTourInfo = Tournee & {
    poidsReel: number;
    depassementPoids: number;
    tauxDepassementPoids: number;
    bacsReels: number;
    depassementBacs: number;
    tauxDepassementBacs: number;
};

export type DelayCount = {
    key: string;
    count: number;
}

export type DelayByHour = {
    hour: string;
    count: number;
}

export type AnalysisData = {
  generalKpis: Kpi[];
  discrepancyKpis: ComparisonKpi[];
  qualityKpis: Kpi[];
  overloadedTours: OverloadedTourInfo[];
  performanceByDriver: PerformanceBy<string>[];
  performanceByCity: PerformanceBy<string>[];
  delaysByWarehouse: DelayCount[];
  delaysByHour: DelayByHour[];
  delaysByCity: DelayCount[];
  delaysByPostalCode: DelayCount[];
  aiAnalysisResults?: {
    totalNegative: number;
    relatedToTiming: number;
    breakdown: { reason: string; count: number }[];
  };
};

export type AiAnalysisResult = {
  reason: 'Retard' | 'Avance' | 'Autre';
};
