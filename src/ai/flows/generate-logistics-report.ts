
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import type { CustomReportConfig } from '@/lib/types';


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

const ReportConfigSchema = z.object({
    sections: z.object({
        globalKpis: z.boolean().optional(),
        discrepancyAnalysis: z.boolean().optional(),
        qualityImpact: z.boolean().optional(),
        anomalies: z.boolean().optional(),
        temporalAnalysis: z.boolean().optional(),
        geoAnalysis: z.boolean().optional(),
        weeklyComparison: z.boolean().optional(),
    }).describe("Sections cochées par l'utilisateur à inclure dans le rapport."),
    filters: z.object({
        depots: z.array(z.string()),
        warehouses: z.array(z.string()),
    }).describe("Filtres appliqués pour le rapport."),
    selectedWeeks: z.array(z.string()).describe("Semaines sélectionnées pour l'analyse comparative."),
    tone: z.enum(['Neutre et Factuel', 'Orienté Solutions']).describe("Ton du rapport demandé par l'utilisateur.")
});

const AnalysisDataSchema = z.object({
    generalKpis: z.array(KpiSchema).optional().describe("KPIs généraux."),
    discrepancyKpis: z.array(ComparisonKpiSchema).optional().describe("KPIs comparant le planifié et le réalisé."),
    negativeReviewsFromLateness: KpiSchema.optional().describe("KPI spécifique sur les avis négatifs dus aux retards."),
    overloadedToursPercentage: z.number().optional().describe("Pourcentage de tournées en surcharge."),
    durationDiscrepancyPercentage: z.number().optional().describe("Pourcentage de tournées avec écart de durée positif significatif."),
    planningAnomalyPercentage: z.number().optional().describe("Pourcentage de tournées en anomalie de planification."),
    top10OverloadedTours: z.array(OverloadedTourSchema).optional().describe("Top des tournées en dépassement de charge."),
    performanceByDayOfWeek: z.array(PerformanceByDaySchema).optional().describe("Performance par jour de la semaine."),
    performanceByTimeSlot: z.array(PerformanceByTimeSlotSchema).optional().describe("Performance par créneau horaire."),
    delayHistogram: z.array(DelayHistogramSchema).optional().describe("Histogramme de répartition des écarts."),
    topWarehouseByDelay: z.string().optional().describe("L'entrepôt avec le plus de retards."),
    topCityByDelay: z.string().optional().describe("La ville avec le plus de retards."),
});

const ReportInputSchema = z.object({
  config: ReportConfigSchema.describe("Configuration du rapport demandée par l'utilisateur."),
  analysis: AnalysisDataSchema.describe("Données d'analyse calculées à partir des filtres de l'utilisateur.")
});
export type GenerateLogisticsReportInput = z.infer<typeof ReportInputSchema>;

const ReportOutputSchema = z.object({
    title: z.string().describe("Titre très court et factuel. Ex: 'Rapport Opérationnel - Semaine 24' ou 'Analyse des Dépôts Sud'."),
    
    globalSynthesis: z.string().describe("Une synthèse globale et factuelle de toutes les données fournies. Elle doit être détaillée, neutre, sans opinion, sans blâme et sans suggestion, en se basant sur TOUTES les données fournies."),
    
    kpiComments: z.object({
        punctuality: z.string().optional().describe("Commentaire sur la ponctualité. Ex: 'Ponctualité sous l'objectif, principalement due aux...'"),
        rating: z.string().optional().describe("Commentaire sur le KPI des avis négatifs liés aux retards."),
        quality: z.string().optional().describe("Commentaire sur la section 'Impact sur la Qualité', expliquant la corrélation entre les problèmes opérationnels et la satisfaction client."),
        discrepancy: z.string().optional().describe("Commentaire sur les KPIs d'écarts (durée, service), expliquant la tendance générale."),
    }).optional(),

    temporalAnalysisComments: z.object({
        byDay: z.string().optional().describe("Analyse de la performance par jour de la semaine. Quel jour est le plus critique ? Y a-t-il une tendance ?"),
        bySlot: z.string().optional().describe("Analyse de la performance par créneau horaire. Quel créneau est le plus difficile ?"),
        histogram: z.string().optional().describe("Analyse de l'histogramme des écarts. La majorité des livraisons sont-elles en avance, à l'heure, ou en retard ?")
    }).optional(),

    anomaliesComments: z.object({
        overloaded: z.string().optional().describe("Commentaire sur les dépassements de charge, mentionnant l'impact."),
    }).optional(),
    
    geoDriverComments: z.object({
        warehouse: z.string().optional().describe("Commentaire sur l'analyse par entrepôt. Ex: 'L'entrepôt de [Nom] concentre le plus de difficultés.'"),
        city: z.string().optional().describe("Commentaire sur l'analyse par ville. Ex: 'La ville de [Nom] présente des défis de circulation.'"),
    }).optional(),

    recommendations: z.object({
      planning: z.string().optional().describe("Recommandation liée à la planification (ex: réévaluer les temps de parcours)."),
      operations: z.string().optional().describe("Recommandation opérationnelle (ex: focus sur un entrepôt)."),
      quality: z.string().optional().describe("Recommandation visant à améliorer la qualité de service perçue par le client."),
    }).optional(),
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
    En tant qu'IA experte en analyse logistique, génère un rapport VISUEL, factuel et synthétique basé sur les sélections de l'utilisateur.

    ## Contexte et Demande Utilisateur :
    - **Configuration du rapport**: L'utilisateur a choisi d'inclure les sections suivantes: {{{json config.sections}}}.
    - **Filtres**: Le rapport se concentre sur les filtres suivants: {{{json config.filters}}}.
    - **Ton attendu**: Le ton doit être '{{{config.tone}}}'. Si 'Neutre et Factuel', ne fais AUCUNE suggestion et ne blâme personne (surtout pas la planification). Contente-toi de décrire les faits. Si 'Orienté Solutions', tu peux proposer des recommandations.

    ## Données Clés Analysées (uniquement si présentes dans l'input):
    - KPIs Généraux: {{{json analysis.generalKpis}}}
    - KPIs Écarts: {{{json analysis.discrepancyKpis}}}
    - KPI "Avis négatifs liés aux retards": {{{json analysis.negativeReviewsFromLateness}}}
    - Pourcentage de tournées en surcharge: {{{analysis.overloadedToursPercentage}}}%
    - Pourcentage d'anomalies de planification: {{{analysis.planningAnomalyPercentage}}}%
    - Top tournées en surcharge : {{{json analysis.top10OverloadedTours}}}
    - Entrepôt avec le plus de retards : {{{analysis.topWarehouseByDelay}}}
    - Ville avec le plus de retards : {{{analysis.topCityByDelay}}}
    - Performance par jour: {{{json analysis.performanceByDayOfWeek}}}
    - Performance par créneau: {{{json analysis.performanceByTimeSlot}}}
    - Répartition des écarts: {{{json analysis.delayHistogram}}}
    
    ## Instructions Détaillées :
    - **title**: Génère un titre court et factuel basé sur les filtres. Ex: "Rapport Opérationnel - Dépôts Nord" ou "Analyse des Surcharges - Semaines 23, 24".
    - **globalSynthesis**: Rédige une synthèse managériale et factuelle de la situation. Sois exhaustif sur les données fournies et respecte le ton demandé.
    
    - **kpiComments**: Pour chaque section incluse, génère un commentaire court et percutant. S'il n'y a pas de données pour une section, ne génère pas le commentaire correspondant.
        - **punctuality**: Commente le taux de ponctualité global.
        - **rating**: Impact des retards sur les avis négatifs.
        - **quality**: Corrélation entre problèmes opérationnels et satisfaction client.
        - **discrepancy**: Analyse des écarts planifié/réalisé.
        
    - **temporalAnalysisComments**:
        - **byDay**: Quel est le jour de la semaine avec le plus de retards ?
        - **bySlot**: Quel créneau horaire est le plus problématique ?
        - **histogram**: Quelle est la tendance générale des écarts (retard, avance, à l'heure) ?
        
    - **anomaliesComments**:
        - **overloaded**: Commente l'anomalie de dépassement de charge.
        
    - **geoDriverComments**:
        - **warehouse**: Nomme l'entrepôt le plus critique basé sur les données.
        - **city**: Nomme la ville la plus critique.

    - **recommendations**: Uniquement si le ton est 'Orienté Solutions', propose 1 à 3 recommandations concrètes et actionnables. Sinon, laisse cet objet vide.

    **Règle d'or : Ne génère des commentaires que pour les sections demandées par l'utilisateur (config.sections). Sois bref, factuel et respecte scrupuleusement le ton demandé. NE PAS inclure de commentaires sur la planification si le ton est neutre. Génère uniquement le JSON.**
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

    

    