
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
  retardStatus?: 'late' | 'early' | 'onTime' | 'tooEarly';
  retardPrevisionnelStatus?: 'late' | 'early' | 'onTime' | 'tooEarly';
  poids: number; // in kg
  ville: string;
  notation: number | null;
  commentaire: string | null;
  avancement: string;
  completedBy?: string;
  ordre: number;
  carrier?: string | null;
};

export type MergedData = Tache & { tournee: Tournee | null };

export type Kpi = {
  title: string;
  value: string;
  description?: string;
  icon?: string;
};

export type ComparisonKpi = {
  title:string;
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
    punctualityRatePlanned: number;
    punctualityRateRealized: number;
    avgDurationDiscrepancy: number; // in seconds
    avgWeightDiscrepancy: number; // in kg
    lateWithBadReviewPercentage: number;
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

export type AvgWorkloadBySlot = {
  slot: string;
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

export type GlobalSummary = {
    punctualityRatePlanned: number;
    punctualityRateRealized: number;
    avgDurationDiscrepancyPerTour: number; // in seconds
    avgWeightDiscrepancyPerTour: number; // in kg
    weightOverrunPercentage: number; // as percentage
    durationOverrunPercentage: number; // as percentage
};

export type PerformanceByGroup = {
    key: string; // group name (e.g., depot name)
    totalTasks: number;
    punctualityRatePlanned: number;
    punctualityRateRealized: number;
    avgDurationDiscrepancy: number; // in seconds
    avgWeightDiscrepancy: number; // in kg
    lateWithBadReviewPercentage: number;
};

export type WeeklyAnalysis = {
    weekLabel: string;
    dateRange: { from: Date; to: Date };
    analysis: AnalysisData;
};

export type DepotWeeklyAnalysis = {
    depot: string;
    weeklyData: {
        weekLabel: string;
        analysis: PerformanceByGroup | null;
    }[];
};


export type ComparisonData = {
    kpiTitle: string;
    values: { weekLabel: string; value: number | string }[];
};

export type MadDelayData = {
  id: string; // warehouse|date
  warehouse: string;
  date: string;
  tourCount: number;
}

export type CustomReportConfig = {
    sections: {
        globalKpis?: boolean;
        discrepancyAnalysis?: boolean;
        qualityImpact?: boolean;
        anomalies?: boolean;
        temporalAnalysis?: boolean;
        geoAnalysis?: boolean;
        weeklyComparison?: boolean;
    };
    filters: {
        depots: string[];
        warehouses: string[];
    };
    selectedWeeks: string[];
    tone: 'Neutre et Factuel' | 'Orienté Solutions';
}

export type DepotStats = {
    entrepot: string;
    ponctualitePrev: string;
    ponctualiteRealisee: string;
    tourneesPartiesHeureRetard: string;
    tourneesRetardAccumule: string;
    noteMoyenne: string;
    depassementPoids: string;
    creneauLePlusChoisi: string;
    creneauLePlusEnRetard: string;
    intensiteTravailPlanifie: string;
    intensiteTravailRealise: string;
    creneauPlusIntense: string;
    creneauMoinsIntense: string;
};

export type PostalCodeStats = {
    codePostal: string;
    entrepot: string;
    totalLivraisons: number;
    livraisonsRetard: string;
    lateCount: number;
};

export type SaturationData = {
  hour: string;
  gap: number;
}

export type CustomerPromiseData = {
  hour: string;
  customerPromise: number;
  urbantzPlan: number;
  realized: number;
  late: number;
}

export type ActualSlotDistribution = {
    warehouse: string;
    slot: string;
    count: number;
    percentage: string;
};

export type SimulatedPromiseData = {
    hour: string;
    customerPromise: number;
    urbantzPlan: number;
    realized: number;
    late: number;
};

export type SuiviCommentaire = {
    date: string;
    livreur: string;
    entrepot: string;
    nomTournee: string;
    sequence: number | undefined;
    commentaire: string;
    categorie: string;
    actionCorrective: string;
    statut: "À traiter" | "En cours" | "Résolu";
    traiteLe: string;
};


export type AnalysisData = {
  // Lists for Filters
  depots: string[];
  warehouses: string[];
  cities: string[];

  // KPIs and Summaries
  generalKpis: Kpi[];
  discrepancyKpis: ComparisonKpi[];
  qualityKpis: (Kpi | ComparisonKpi)[];
  globalSummary: GlobalSummary;

  // Anomaly Detections
  overloadedTours: OverloadedTourInfo[];
  durationDiscrepancies: DurationDiscrepancy[];
  lateStartAnomalies: LateStartAnomaly[];
  
  // Performance Breakdowns by Group
  performanceByDriver: PerformanceByDriver[];
  performanceByCity: PerformanceByGeo[];
  performanceByPostalCode: PerformanceByGeo[];
  performanceByDepot: PerformanceByGroup[];
  performanceByWarehouse: PerformanceByGroup[];
  
  // Temporal Analysis
  performanceByDayOfWeek: PerformanceByDay[];
  performanceByTimeSlot: PerformanceByTimeSlot[];
  workloadByHour: WorkloadByHour[];
  avgWorkloadByDriverBySlot: AvgWorkloadBySlot[];
  avgWorkload: AvgWorkload;
  
  // Delay/Advance Analysis
  delaysByWarehouse: DelayCount[];
  delaysByHour: DelayByHour[];
  advancesByWarehouse: DelayCount[];
  advancesByHour: DelayByHour[];
  delayHistogram: DelayHistogramBin[];
  
  // Specific Metrics
  firstTaskLatePercentage: number;

  // Table-specific stats
  depotStats: DepotStats[];
  warehouseStats: DepotStats[];
  postalCodeStats: PostalCodeStats[];

  // Chart-specific data
  saturationData: SaturationData[];
  customerPromiseData: CustomerPromiseData[];
  actualSlotDistribution: ActualSlotDistribution[];
  simulatedPromiseData: SimulatedPromiseData[];
  rawData: MergedData[];
  filteredData: MergedData[];
};

export type VisualReportData = {
    analysis: AnalysisData;
    ai: {
        title?: string;
        globalSynthesis?: string;
        kpiComments?: Record<string, string>;
        temporalAnalysisComments?: Record<string, string>;
        anomaliesComments?: Record<string, string>;
        geoDriverComments?: Record<string, string>;
        recommendations?: {
            planning?: string;
            operations?: string;
            quality?: string;
        };
    };
    filters: any;
    extra: {
        top10Overloaded?: OverloadedTourInfo[];
        overloadedToursPercentage?: number;
        negativeReviewsKpi?: Kpi;
    };
    config: CustomReportConfig;
    weeklyAnalyses?: WeeklyAnalysis[];
    depotWeeklyAnalyses?: DepotWeeklyAnalysis[];
};
