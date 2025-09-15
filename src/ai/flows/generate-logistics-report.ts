
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import {
    Kpi
} from '@/lib/types';

// Schemas for complex objects to be used in the input
const KpiSchema = z.object({
  title: z.string(),
  value: z.string(),
  description: z.string().optional(),
});

const ComparisonKpiSchema = z.object({
  title: z.string(),
  value1: z.string(),
  label1: z.string(),
  value2: z.string(),
  label2: z.string(),
  change: z.string(),
});

const OverloadedTourSchema = z.object({
  date: z.string(),
  nom: z.string(),
  livreur: z.string(),
  entrepot: z.string(),
  poidsPrevu: z.number(),
  poidsReel: z.number(),
  tauxDepassementPoids: z.number(),
});

const DurationDiscrepancySchema = z.object({
  date: z.string(),
  nom: z.string(),
  livreur: z.string(),
  entrepot: z.string(),
  ecart: z.number(), // in seconds
  dureeEstimee: z.number(), // in seconds
  dureeReelle: z.number(), // in seconds
});

const LateStartAnomalySchema = z.object({
  date: z.string(),
  nom: z.string(),
  livreur: z.string(),
  entrepot: z.string(),
  tasksInDelay: z.number(),
  heureDepartPrevue: z.number(), // in seconds from midnight
  heureDepartReelle: z.number(), // in seconds from midnight
});

const ExemplaryDriverSchema = z.object({
    key: z.string().describe("Nom du livreur."),
    punctualityRate: z.number().describe("Son taux de ponctualité en pourcentage."),
    overweightToursCount: z.number().describe("Nombre de tournées en surcharge qu'il a effectuées."),
    avgDelay: z.number().describe("Son retard moyen en minutes.")
});

const WarehouseOverrunSchema = z.object({
    entrepot: z.string(),
    totalWeightOverrun: z.number().describe("Dépassement de poids total en kg."),
    totalTimeOverrun: z.number().describe("Dépassement de temps total en heures.")
});

const GlobalSummarySchema = z.object({
    punctualityRatePlanned: z.number(),
    punctualityRateRealized: z.number(),
    avgDurationDiscrepancyPerTour: z.number(),
    avgWeightDiscrepancyPerTour: z.number(),
});

const PerformanceByDaySchema = z.object({
    day: z.string(),
    delays: z.number(),
    advances: z.number(),
    avgDelay: z.number(),
});

const PerformanceByTimeSlotSchema = z.object({
    slot: z.string(),
    delays: z.number(),
    advances: z.number(),
    avgDelay: z.number(),
});

const DelayHistogramSchema = z.object({
    range: z.string(),
    count: z.number(),
});


const ReportInputSchema = z.object({
  totalTours: z.number(),
  generalKpis: z.array(KpiSchema).describe("KPIs généraux."),
  qualityKpis: z.array(KpiSchema).describe("KPIs sur l'impact qualité."),
  negativeReviewsFromLateness: KpiSchema.describe("KPI spécifique sur les avis négatifs dus aux retards."),
  discrepancyKpis: z.array(ComparisonKpiSchema).describe("KPIs comparant le planifié et le réalisé."),
  
  // Inefficiency KPIs
  totalCumulativeDelayHours: z.number().describe("Total des heures de retard cumulées."),
  totalAdditionalServiceHours: z.number().describe("Total des heures de service additionnelles (écarts de durée positifs)."),

  // Anomaly percentages
  overloadedToursPercentage: z.number().describe("Pourcentage de tournées en surcharge sur le total."),
  durationDiscrepancyPercentage: z.number().describe("Pourcentage de tournées avec écart de durée positif significatif."),
  planningAnomalyPercentage: z.number().describe("Pourcentage de tournées en anomalie de planification."),
  firstTaskLatePercentage: z.number().describe("Pourcentage de tournées parties à l'heure mais arrivées en retard au premier client."),

  // Top 10 examples from detailed tables
  top10OverloadedTours: z.array(OverloadedTourSchema).describe("Top 10 des tournées en dépassement de charge."),
  top10PositiveDurationDiscrepancies: z.array(DurationDiscrepancySchema).describe("Top 10 des tournées avec les plus grands écarts de durée POSITIFS."),
  top10LateStartAnomalies: z.array(LateStartAnomalySchema).describe("Top 10 des tournées 'parties en avance, arrivées en retard'."),
  
  // New driver analysis
  topExemplaryDrivers: z.array(ExemplaryDriverSchema).describe("Top livreurs qui restent performants (haute ponctualité) malgré la surcharge."),

  // New warehouse analysis
  top20percentWarehousesByOverrun: z.array(WarehouseOverrunSchema).describe("Top 20% des entrepôts avec les plus forts dépassements (poids et temps)."),

  // Data for charts - just the key facts
  topWarehouseByDelay: z.string().optional().describe("L'entrepôt avec le plus de retards."),
  topCityByDelay: z.string().optional().describe("La ville avec le plus de retards."),
  
  // New data
  globalSummary: GlobalSummarySchema.describe("Synthèse des écarts globaux par groupe."),
  performanceByDayOfWeek: z.array(PerformanceByDaySchema).describe("Performance par jour de la semaine."),
  performanceByTimeSlot: z.array(PerformanceByTimeSlotSchema).describe("Performance par créneau horaire."),
  delayHistogram: z.array(DelayHistogramSchema).describe("Histogramme de répartition des écarts."),
});
export type GenerateLogisticsReportInput = z.infer<typeof ReportInputSchema>;

const ReportOutputSchema = z.object({
    title: z.string().describe("Titre très court et factuel. Ex: 'Rapport Opérationnel - Semaine 24'."),
    
    globalSynthesis: z.string().describe("Une synthèse globale et factuelle de toutes les données. Elle doit être détaillée, neutre, sans opinion, sans blâme et sans suggestion, en se basant sur TOUTES les données fournies (surtout les KPIs, pourcentages d'anomalies, et la synthèse globale)."),
    
    kpiComments: z.object({
        punctuality: z.string().describe("Commentaire sur la ponctualité. Ex: 'Ponctualité sous l'objectif, principalement due aux...'"),
        rating: z.string().describe("Commentaire sur le KPI des avis négatifs liés aux retards."),
        quality: z.string().describe("Commentaire sur la section 'Impact sur la Qualité', expliquant la corrélation entre les problèmes opérationnels et la satisfaction client."),
        discrepancy: z.string().describe("Commentaire sur les KPIs d'écarts (durée, service), expliquant la tendance générale."),
        inefficiency: z.string().describe("Commentaire sur la quantification des inefficacités, expliquant ce que représentent les heures perdues.")
    }),

    chartsInsights: z.object({
        workloadAnalysis: z.string().describe("Insight sur le graphique de charge. Y a-t-il un lien entre le pic de charge (différence planifié/réel) et les pics de retards/avances ?"),
        warehouseOverrun: z.string().describe("Commentaire sur le graphique des dépassements par entrepôt, identifiant le ou les entrepôts les plus critiques.")
    }),

    temporalAnalysisComments: z.object({
        byDay: z.string().describe("Analyse de la performance par jour de la semaine. Quel jour est le plus critique ? Y a-t-il une tendance ?"),
        bySlot: z.string().describe("Analyse de la performance par créneau horaire. Quel créneau est le plus difficile ?"),
        histogram: z.string().describe("Analyse de l'histogramme des écarts. La majorité des livraisons sont-elles en avance, à l'heure, ou en retard ? Quelle est l'ampleur des retards ?")
    }),

    anomaliesComments: z.object({
        overloaded: z.string().describe("Commentaire sur les dépassements de charge, mentionnant l'impact."),
        duration: z.string().describe("Commentaire sur les écarts de durée, expliquant ce que cela signifie (temps de service, etc.)."),
        planning: z.string().describe("Commentaire sur les anomalies de planification (départ en avance/arrivée en retard)."),
    }),
    
    geoDriverComments: z.object({
        warehouse: z.string().describe("Commentaire sur l'analyse par entrepôt. Ex: 'L'entrepôt de [Nom] concentre le plus de difficultés.'"),
        city: z.string().describe("Commentaire sur l'analyse par ville. Ex: 'La ville de [Nom] présente des défis de circulation.'"),
        driver: z.string().describe("Commentaire sur l'analyse des livreurs exemplaires, soulignant que la performance est possible malgré les contraintes."),
    }),

    recommendations: z.object({
      planning: z.string().describe("Recommandation liée à la planification (ex: réévaluer les temps de parcours, ajuster les capacités des véhicules)."),
      operations: z.string().describe("Recommandation opérationnelle (ex: focus sur un entrepôt, formation des livreurs)."),
      quality: z.string().describe("Recommandation visant à améliorer la qualité de service perçue par le client."),
    }),
});
export type GenerateLogisticsReportOutput = z.infer<typeof ReportOutputSchema>;


export async function generateLogisticsReport(input: GenerateLogisticsReportInput): Promise<GenerateLogisticsReportOutput> {
  const report = await generateLogisticsReportFlow(input);
  return report;
}

const prompt = ai.definePrompt({
  name: 'generateLogisticsReportPrompt',
  input: { schema: ReportInputSchema },
  output: { schema: ReportOutputSchema },
  prompt: `
    En tant qu'IA experte en analyse logistique, génère un rapport VISUEL complet, factuel et orienté action.
    
    ## Données Clés Analysées :
    - Total de tournées: {{{totalTours}}}
    - KPIs Généraux: {{{json generalKpis}}}
    - KPIs Qualité: {{{json qualityKpis}}}
    - KPIs Écarts: {{{json discrepancyKpis}}}
    - KPI "Avis négatifs liés aux retards": {{{json negativeReviewsFromLateness}}}
    - Synthèse Globale: {{{json globalSummary}}}
    - Heures de retard cumulées: {{{totalCumulativeDelayHours}}}h
    - Heures de service additionnelles: {{{totalAdditionalServiceHours}}}h
    - Pourcentage de tournées en surcharge: {{{overloadedToursPercentage}}}%
    - Pourcentage d'anomalies de planification: {{{planningAnomalyPercentage}}}%
    - Pourcentage d'anomalies 1ère tâche: {{{firstTaskLatePercentage}}}%
    - Top 20% des entrepôts par dépassement: {{{json top20percentWarehousesByOverrun}}}
    - Entrepôt avec le plus de retards : {{{topWarehouseByDelay}}}
    - Ville avec le plus de retards : {{{topCityByDelay}}}
    - Top livreurs exemplaires : {{{json topExemplaryDrivers}}}
    - Performance par jour: {{{json performanceByDayOfWeek}}}
    - Performance par créneau: {{{json performanceByTimeSlot}}}
    - Répartition des écarts: {{{json delayHistogram}}}
    
    ## Instructions Détaillées :
    - **title**: "Rapport de Performance Opérationnelle".
    - **globalSynthesis**: Rédige une synthèse managériale et factuelle de la situation. Sois exhaustif et mentionne les chiffres clés (ponctualité, retard moyen, écart de durée, % anomalies, etc.).
    
    - **kpiComments**: Pour chaque section, un commentaire court et percutant.
        - **punctuality**: Commente le taux de ponctualité global.
        - **rating**: Impact des retards sur les avis négatifs.
        - **quality**: Corrélation entre problèmes opérationnels (surcharge, etc.) et satisfaction client.
        - **discrepancy**: Analyse des écarts planifié/réalisé (durée, poids).
        - **inefficiency**: Explique ce que les heures perdues représentent.
        
    - **chartsInsights**:
        - **workloadAnalysis**: Lien entre charge de travail et retards/avances.
        - **warehouseOverrun**: Identifie les entrepôts les plus critiques en combinant les dépassements de poids et de temps.

    - **temporalAnalysisComments**:
        - **byDay**: Quel est le jour de la semaine avec le plus de retards et le retard moyen le plus élevé ?
        - **bySlot**: Quel créneau horaire est le plus problématique ?
        - **histogram**: La majorité des écarts sont-ils des retards ou des avances ? Quelle est la tranche de retard la plus fréquente ?
        
    - **anomaliesComments**: Commente chaque anomalie et son impact.
        - **overloaded**: Dépassement de charge.
        - **duration**: Écarts de durée.
        - **planning**: Parti à l'heure, arrivé en retard.
        
    - **geoDriverComments**: Analyse analytique pour chaque sujet.
        - **warehouse**: En te basant sur 'topWarehouseByDelay' et 'top20percentWarehousesByOverrun', nomme l'entrepôt le plus critique et explique pourquoi.
        - **city**: Nomme la ville la plus critique et suggère des causes.
        - **driver**: Souligne que la performance est possible malgré les contraintes, en te basant sur les 'topExemplaryDrivers'.

    - **recommendations**: Propose 3 recommandations concrètes et actionnables, basées sur les analyses précédentes.
        - **planning**: Suggère une action pour améliorer la planification. Ex: "Réévaluer les temps de parcours pour la ville de [Nom de la ville] où les anomalies de planification sont fréquentes." ou "Ajuster la capacité de poids allouée pour les tournées de l'entrepôt [Nom de l'entrepôt] pour réduire la surcharge."
        - **operations**: Suggère une action opérationnelle. Ex: "Mettre en place un suivi spécifique sur l'entrepôt [Nom de l'entrepôt] qui concentre le plus de difficultés (dépassements, retards)."
        - **quality**: Suggère une action orientée client. Ex: "Lancer une campagne de communication proactive vers les clients des zones à fort taux de retard pour gérer les attentes."

    **Sois bref et factuel pour les commentaires, mais détaillé pour la synthèse globale et les recommandations. Ne génère que le JSON.**
    `,
});

const generateLogisticsReportFlow = ai.defineFlow(
  {
    name: 'generateLogisticsReportFlow',
    inputSchema: ReportInputSchema,
    outputSchema: ReportOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);

    