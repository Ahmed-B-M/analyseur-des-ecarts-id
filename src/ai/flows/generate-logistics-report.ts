
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
  nom: z.string(),
  livreur: z.string(),
  tauxDepassementPoids: z.number(),
});

const DurationDiscrepancySchema = z.object({
  nom: z.string(),
  livreur: z.string(),
  ecart: z.number(), // in seconds
  dureeEstimee: z.number(), // in seconds
  dureeReelle: z.number(), // in seconds
});

const LateStartAnomalySchema = z.object({
  nom: z.string(),
  livreur: z.string(),
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

const ReportInputSchema = z.object({
  totalTours: z.number(),
  generalKpis: z.array(KpiSchema).describe("KPIs généraux."),
  negativeReviewsFromLateness: KpiSchema.describe("KPI spécifique sur les avis négatifs dus aux retards."),
  discrepancyKpis: z.array(ComparisonKpiSchema).describe("KPIs comparant le planifié et le réalisé."),
  
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

  // Data for charts - just the key facts
  topWarehouseByDelay: z.string().optional().describe("L'entrepôt avec le plus de retards."),
  topCityByDelay: z.string().optional().describe("La ville avec le plus de retards."),
});
export type GenerateLogisticsReportInput = z.infer<typeof ReportInputSchema>;

const ReportOutputSchema = z.object({
    title: z.string().describe("Titre très court et factuel. Ex: 'Rapport Opérationnel - Semaine 24'."),
    
    executiveSummary: z.string().describe("Synthèse managériale (1-2 phrases) sur l'impact de la planification sur la ponctualité."),
    
    kpiComments: z.object({
        punctuality: z.string().describe("Commentaire sur la ponctualité. Ex: 'Ponctualité sous l'objectif, principalement due aux...'"),
        rating: z.string().describe("Commentaire sur le KPI des avis négatifs liés aux retards."),
    }),

    chartsInsights: z.object({
        temporalAnalysis: z.string().describe("Insight sur le graphique temporel heure/heure. Ex: 'Le pic de retards se situe entre 10h et 14h.'"),
        workloadAnalysis: z.string().describe("Insight sur la comparaison charge planifiée vs. réelle. Ex: 'La charge réelle est constamment supérieure à la planification.'"),
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
    En tant qu'IA experte en analyse logistique, génère des commentaires concis pour un rapport VISUEL destiné à des directeurs opérationnels. L'objectif est d'expliquer les données des graphiques et tableaux sans être verbeux. Sois analytique et va droit au but.

    ## Données Clés Analysées :
    - Total de tournées: {{{totalTours}}}
    - KPI "Avis négatifs liés aux retards": {{{json negativeReviewsFromLateness}}}
    - Pourcentage de tournées en surcharge: {{{overloadedToursPercentage}}}%
    - Pourcentage de tournées avec écart de durée > 15min: {{{durationDiscrepancyPercentage}}}%
    - Pourcentage de tournées en anomalie de planification: {{{planningAnomalyPercentage}}}%
    - Top 10 Dépassements de Charge: {{{json top10OverloadedTours}}}
    - Top 10 Écarts de Durée (Positifs): {{{json top10PositiveDurationDiscrepancies}}}
    - Top 10 Anomalies (Départ Avance/Arrivée Retard): {{{json top10LateStartAnomalies}}}
    - Top Livreur performants malgré la surcharge: {{{json topExemplaryDrivers}}}
    - Pire Entrepôt (retards): {{{topWarehouseByDelay}}}
    - Pire Ville (retards): {{{topCityByDelay}}}

    ## Instructions par Section :
    - **title**: "Rapport de Performance Opérationnelle".
    - **executiveSummary**: En 1-2 phrases, explique comment les écarts de planification (charge, durée) impactent la ponctualité globale.
    - **kpiComments.punctuality**: Commente la ponctualité en la liant à la satisfaction client.
    - **kpiComments.rating**: Explique ce que le chiffre des "avis négatifs liés aux retards" signifie pour l'image de marque.
    - **chartsInsights.temporalAnalysis**: Donne l'insight principal du graphique heure par heure. Quel est le créneau le plus critique ?
    - **chartsInsights.workloadAnalysis**: Commente le graphique de charge planifiée vs. réelle. Y a-t-il un décalage constant ?
    - **anomaliesComments.overloaded**: Résume l'impact des {{{overloadedToursPercentage}}}% de tournées en surcharge sur le matériel et les livreurs.
    - **anomaliesComments.duration**: Explique pourquoi {{{durationDiscrepancyPercentage}}}% des tournées qui durent plus longtemps que prévu est un problème de planification (temps de service sous-estimé).
    - **anomaliesComments.planning**: Explique ce que l'anomalie "départ en avance, arrivée en retard" révèle sur l'estimation des temps de trajet.
    - **geoDriverComments.warehouse**: Identifie l'entrepôt le plus problématique ({{{topWarehouseByDelay}}}) et ce que cela suggère.
    - **geoDriverComments.city**: Identifie la ville la plus problématique ({{{topCityByDelay}}}) et ce que cela suggère (trafic, etc.).
    - **geoDriverComments.driver**: En te basant sur les 'Top Livreur', rédige un commentaire expliquant que malgré des conditions difficiles (surcharge), une haute performance est possible, suggérant que le problème n'est pas forcément humain mais lié à la planification.

    **Sois bref et factuel. Tes textes sont des légendes pour des visuels. Ne génère que le JSON.**
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
