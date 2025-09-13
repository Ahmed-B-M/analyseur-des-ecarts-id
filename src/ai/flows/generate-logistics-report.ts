'use server';

/**
 * @fileOverview Generates a comprehensive logistics performance report using AI.
 *
 * - generateLogisticsReport - A function that analyzes logistics data and generates a structured report.
 * - GenerateLogisticsReportInput - The input type for the generateLogisticsReport function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ReportInputSchema = z.object({
  totalTours: z.number().describe("Nombre total de tournées analysées."),
  totalTasks: z.number().describe("Nombre total de livraisons (tâches) analysées."),
  punctualityRate: z.number().describe("Taux de ponctualité global en pourcentage."),
  avgRating: z.number().describe("Note moyenne donnée par les clients."),
  totalLateTasks: z.number().describe("Nombre total de livraisons en retard."),
  totalEarlyTasks: z.number().describe("Nombre total de livraisons en avance."),
  overloadedToursCount: z.number().describe("Nombre de tournées ayant dépassé la capacité (poids ou volume)."),
  lateStartAnomaliesCount: z.number().describe("Nombre de tournées parties à l'heure mais arrivées en retard."),
  topLateDriver: z.string().optional().describe("Le livreur avec le taux de retard le plus élevé ou le plus grand nombre de retards."),
  topLateCity: z.string().optional().describe("La ville avec le plus grand nombre de retards."),
  mainReasonForNegativeFeedback: z.string().optional().describe("La cause principale (Retard, Avance, Autre) des avis clients négatifs, si analysée."),
});
export type GenerateLogisticsReportInput = z.infer<typeof ReportInputSchema>;


const ReportOutputSchema = z.object({
  title: z.string().describe("Un titre dynamique et concis pour le rapport. Par exemple: 'Rapport de Performance Logistique - Semaine 24'."),
  synthesis: z.string().describe("Une synthèse de 2 phrases maximum qui compare la performance globale aux objectifs (95% ponctualité, 4.8/5 note)."),
  keyInsights: z.array(z.object({
    icon: z.enum(['Clock', 'MapPin', 'Users', 'Truck', 'BarChart2', 'AlertTriangle']).describe("L'icône la plus pertinente pour l'insight."),
    text: z.string().describe("Un insight actionnable et concis (1 phrase) sur un point clé de l'analyse (dégradation, cause, anomalie).")
  })).describe("Une liste de 3 à 4 insights clés et percutants, chacun avec une icône et un texte court.")
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
    En tant qu'expert en analyse de données logistiques, tu dois générer les éléments pour un rapport de performance visuel destiné au client Carrefour.
    L'objectif est d'identifier les points les plus importants, les dégradations et leurs causes probables. Sois extrêmement concis et percutant.

    ## Données d'analyse pour la période :
    - Nombre total de tournées: {{{totalTours}}}
    - Nombre total de livraisons: {{{totalTasks}}}
    - Taux de ponctualité global: {{{punctualityRate}}}% (Objectif: 95%)
    - Note moyenne des clients: {{{avgRating}}}/5 (Objectif: 4.8)
    - Total livraisons en retard: {{{totalLateTasks}}}
    - Total livraisons en avance: {{{totalEarlyTasks}}}
    - Nombre de tournées en surcharge: {{{overloadedToursCount}}}
    - Anomalies (départ à l'heure, arrivée en retard): {{{lateStartAnomaliesCount}}}
    {{#if topLateDriver}}- Livreur le plus souvent en retard: {{{topLateDriver}}}{{/if}}
    {{#if topLateCity}}- Ville la plus impactée par les retards: {{{topLateCity}}}{{/if}}

    ## Tes tâches :
    1.  **Titre (title)**: Génère un titre court et informatif pour le rapport. Exemple : "Rapport de Performance Logistique - Semaine 24".
    2.  **Synthèse (synthesis)**: Rédige une synthèse de 1 à 2 phrases MAXIMUM qui compare la performance réalisée aux objectifs de 95% de ponctualité et 4.8/5 de note moyenne. Va droit au but.
    3.  **Insights Clés (keyInsights)**: Identifie 3 ou 4 points d'analyse les plus CRITIQUES et pertinents. Pour chaque point, fournis :
        *   Un insight sous forme de phrase courte et directe.
        *   L'icône la plus appropriée parmi la liste fournie ('Clock', 'MapPin', 'Users', 'Truck', 'BarChart2', 'AlertTriangle').

    ## Exemples d'insights attendus :
    - "Les retards sont principalement concentrés sur la ville de {{{topLateCity}}}, suggérant un problème géographique ou de planification locale." (Icône: 'MapPin')
    - "{{{overloadedToursCount}}} tournées en surcharge ont directement impacté la ponctualité, créant un risque opérationnel." (Icône: 'AlertTriangle')
    - "L'objectif de 95% de ponctualité semble irréalisable en raison d'une sous-estimation structurelle des temps de parcours ({{{lateStartAnomaliesCount}}} anomalies)." (Icône: 'BarChart2')
    - "Le livreur {{{topLateDriver}}} est responsable d'une part significative des retards, indiquant un besoin de suivi individuel." (Icône: 'Users')

    Le ton doit être analytique, factuel et se concentrer uniquement sur le diagnostic basé sur les chiffres fournis.
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
