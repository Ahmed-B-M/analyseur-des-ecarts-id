import type { LucideProps } from "lucide-react";
import type { ForwardRefExoticComponent, RefAttributes } from "react";

export type Tournee = {
  uniqueId: string;
  nom: string;
  date: string; // YYYY-MM-DD
  entrepot: string;
  livreur: string;
  poidsPrevu: number;
  bacsPrevus: number;
  kmPrevus: number;
  dureePrevue: number; // in seconds
  heureDepartPrevue: number; // in seconds from midnight
};

export type Tache = {
  tourneeUniqueId: string;
  nomTournee: string;
  date: string; // YYYY-MM-DD
  entrepot: string;
  heurePrevue: number; // in seconds from midnight
  heureRealisee: number; // in seconds from midnight
  poidsReal: number;
  ville: string;
  codePostal: string;
  notation: number | null;
  commentaire: string | null;
  statut: 'complete' | 'incomplete';
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

export type TimeSlotAnalysis = {
  timeSlot: string;
  plannedTasks: number;
  completedTasks: number;
};

export type AnalysisData = {
  generalKpis: Kpi[];
  discrepancyKpis: ComparisonKpi[];
  qualityKpis: Kpi[];
  overloadedTours: Tournee[];
  performanceByDriver: PerformanceBy<string>[];
  performanceByCity: PerformanceBy<string>[];
  performanceByPostalCode: PerformanceBy<string>[];
  delaysByWarehouse: { warehouse: string; count: number }[];
  delaysByTimeSlot: { timeSlot: string; count: number }[];
  timeSlotAnalysis: TimeSlotAnalysis[];
  aiAnalysisResults?: {
    totalNegative: number;
    relatedToTiming: number;
    breakdown: { reason: string; count: number }[];
  };
};

export type AiAnalysisResult = {
  reason: 'Retard' | 'Avance' | 'Autre';
};
