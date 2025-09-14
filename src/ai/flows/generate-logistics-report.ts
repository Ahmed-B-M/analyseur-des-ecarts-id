
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
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
    punctualityRate: z.number().describe("Son taux de ponctualité."),
    overweightToursCount: z.number().describe("Nombre de tournées en surcharge qu'il a effectuées."),
    avgDelay: z.number().describe("Son retard moyen en minutes.")
});

const WarehouseOverrunSchema = z.object({
    entrepot: z.string(),
    totalWeightOverrun: z.number().describe("Dépassement de poids total en kg."),
    totalTimeOverrun: z.number().describe("Dépassement de temps total en heures.")
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

  // Top 10 examples from detailed tables
  top10OverloadedTours: z.array(OverloadedTourSchema).describe("Top 10 des tournées en dépassement de charge."),
  top10PositiveDurationDiscrepancies: z.array(DurationDiscrepancySchema).describe("Top 10 des tournées avec les plus grands écarts de durée POSITIFS."),
  top10LateStartAnomalies: z.array(LateStartAnomalySchema).describe("Top 10 des tournées 'parties en avance, arrivées en retard'."),
  
  // New driver analysis
  topExemplaryDrivers: z.array(ExemplaryDriverSchema).describe("Top livreurs qui restent performants malgré la surcharge."),

  // New warehouse analysis
  top20percentWarehousesByOverrun: z.array(WarehouseOverrunSchema).describe("Top 20% des entrepôts avec les plus forts dépassements (poids et temps)."),

  // Data for charts - just the key facts
  topWarehouseByDelay: z.string().optional().describe("L'entrepôt avec le plus de retards."),
  topCityByDelay: z.string().optional().describe("La ville avec le plus de retards."),
});
export type GenerateLogisticsReportInput = z.infer<typeof ReportInputSchema>;

const ReportOutputSchema = z.object({
    title: z.string().describe("Titre très court et factuel. Ex: 'Rapport Opérationnel - Semaine 24'."),
    
    globalSynthesis: z.string().describe("Une synthèse globale et factuelle de toutes les données. Elle doit être détaillée, neutre, sans opinion, sans blâme et sans suggestion."),
    
    kpiComments: z.object({
        punctuality: z.string().describe("Commentaire sur la ponctualité. Ex: 'Ponctualité sous l'objectif, principalement due aux...'"),
        rating: z.string().describe("Commentaire sur le KPI des avis négatifs liés aux retards."),
        quality: z.string().describe("Commentaire sur la section 'Impact sur la Qualité', expliquant la corrélation entre les problèmes opérationnels et la satisfaction client."),
        discrepancy: z.string().describe("Commentaire sur les KPIs d'écarts (durée, service), expliquant la tendance générale."),
        inefficiency: z.string().describe("Commentaire sur la quantification des inefficacités, expliquant ce que représentent les heures perdues.")
    }),

    chartsInsights: z.object({
        temporalAnalysis: z.string().describe("Insight sur le graphique temporel heure/heure. Ex: 'Le pic de retards se situe entre 10h et 14h.'"),
        workloadAnalysis: z.string().describe("Insight sur le graphique de charge. Y a-t-il un lien entre le pic de charge (différence planifié/réel) et les pics de retards/avances ?"),
        warehouseOverrun: z.string().describe("Commentaire sur le graphique des dépassements par entrepôt, identifiant le ou les entrepôts les plus critiques.")
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
    })
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
    En tant qu'IA experte en analyse logistique, génère des commentaires concis et factuels pour un rapport VISUEL.
    
    ## Données Clés Analysées :
    - Total de tournées: {{{totalTours}}}
    - KPIs Généraux: {{{json generalKpis}}}
    - KPIs Qualité: {{{json qualityKpis}}}
    - KPIs Écarts: {{{json discrepancyKpis}}}
    - KPI "Avis négatifs liés aux retards": {{{json negativeReviewsFromLateness}}}
    - Heures de retard cumulées: {{{totalCumulativeDelayHours}}}h
    - Heures de service additionnelles: {{{totalAdditionalServiceHours}}}h
    - Pourcentage de tournées en surcharge: {{{overloadedToursPercentage}}}%
    - Top 20% des entrepôts par dépassement: {{{json top20percentWarehousesByOverrun}}}
    
    ## Instructions :
    - **title**: "Rapport de Performance Opérationnelle".
    - **globalSynthesis**: Rédige une synthèse globale et factuelle de toutes les données. L'objectif est de décrire en détail chaque indicateur sans porter de jugement.
    - **kpiComments**: Rédige un commentaire court pour chaque section (punctuality, rating, quality, discrepancy, inefficiency).
    - **chartsInsights.temporalAnalysis**: Donne l'insight principal du graphique heure par heure.
    - **chartsInsights.workloadAnalysis**: Commente le graphique de charge (planifié vs. réel) et son lien avec les retards/avances.
    - **chartsInsights.warehouseOverrun**: En te basant sur les données des "Top 20% des entrepôts par dépassement", commente quels entrepôts subissent le plus de dépassements de poids et de temps.
    - **anomaliesComments**: Rédige un commentaire court pour chaque anomalie (overloaded, duration, planning).
    - **geoDriverComments**: Rédige un commentaire court pour chaque analyse (warehouse, city, driver).

    **Sois bref et factuel pour les commentaires des sections, mais détaillé et neutre pour la synthèse globale. Ne génère que le JSON.**
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
