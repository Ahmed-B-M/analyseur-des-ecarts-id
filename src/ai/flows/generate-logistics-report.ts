'use server';

/**
 * @fileOverview Generates a comprehensive logistics performance report using AI.
 *
 * - generateLogisticsReport - A function that analyzes logistics data and generates a structured report.
 * - GenerateLogisticsReportInput - The input type for the generateLogisticsReport function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Define a simplified schema for the input to keep the prompt clean and focused.
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


export async function generateLogisticsReport(input: GenerateLogisticsReportInput): Promise<string> {
  const report = await generateLogisticsReportFlow(input);
  return report;
}

const prompt = ai.definePrompt({
  name: 'generateLogisticsReportPrompt',
  input: { schema: ReportInputSchema },
  output: { format: 'text' },
  prompt: `
    En tant qu'expert en analyse de données logistiques, tu dois rédiger un rapport de performance basé sur les données suivantes.
    Le rapport doit être structuré, clair, et aller droit au but. Utilise le format Markdown pour la mise en forme.

    Données d'analyse pour la période :
    - Nombre total de tournées: {{{totalTours}}}
    - Nombre total de livraisons: {{{totalTasks}}}
    - Taux de ponctualité global: {{{punctualityRate}}}%
    - Note moyenne des clients: {{{avgRating}}}/10
    - Total livraisons en retard: {{{totalLateTasks}}}
    - Total livraisons en avance: {{{totalEarlyTasks}}}
    - Nombre de tournées en surcharge: {{{overloadedToursCount}}}
    - Nombre d'anomalies (départ à l'heure, arrivée en retard): {{{lateStartAnomaliesCount}}}
    {{#if topLateDriver}}- Livreur le plus souvent en retard: {{{topLateDriver}}}{{/if}}
    {{#if topLateCity}}- Ville la plus impactée par les retards: {{{topLateCity}}}{{/if}}
    {{#if mainReasonForNegativeFeedback}}- Cause principale des avis négatifs (IA): {{{mainReasonForNegativeFeedback}}}{{/if}}

    Rédige le rapport en suivant IMPÉRATIVEMENT la structure ci-dessous, en utilisant des titres Markdown (##):

    ## Synthèse de la Performance
    Commence par une ou deux phrases qui résument l'état général de la performance logistique (par exemple, "La performance est mitigée avec une bonne satisfaction client mais des problèmes de ponctualité...").

    ## Points Clés Positifs
    Liste 2 à 3 points forts basés sur les données. Cherche les aspects positifs (ex: bonne note client, faible nombre de tournées en surcharge, etc.).

    ## Problèmes Principaux et Impacts
    Liste 2 à 3 problèmes les plus impactants identifiés dans les données. Pour chaque point, explique brièvement l'impact probable.
    Par exemple:
    - "Un nombre élevé de retards ({{{totalLateTasks}}}) impacte directement la satisfaction client, comme le suggère l'analyse des retours."
    - "Les {{{overloadedToursCount}}} tournées en surcharge peuvent entraîner une usure prématurée des véhicules et des risques de sécurité."
    - Mentionne spécifiquement la ville et le livreur les plus problématiques s'ils sont fournis, car ce sont des points d'action clairs.

    ## Recommandations Stratégiques
    Propose 2 à 3 recommandations concrètes et actionnables pour adresser les problèmes identifiés. Les recommandations doivent être directement liées aux données.
    Par exemple:
    - Si les retards sont élevés dans une ville: "Lancer une analyse spécifique des tournées pour {{{topLateCity}}} afin de réévaluer les temps de trajet et les conditions de circulation."
    - Si un livreur est souvent en retard: "Organiser un point d'accompagnement avec {{{topLateDriver}}} pour comprendre les difficultés rencontrées sur ses tournées."
    - Si la surcharge est un problème: "Mettre en place un contrôle de poids et volume systématique avant le départ des tournées."

    Le ton doit être professionnel, factuel et orienté vers l'action.
    `,
});

const generateLogisticsReportFlow = ai.defineFlow(
  {
    name: 'generateLogisticsReportFlow',
    inputSchema: ReportInputSchema,
    outputSchema: z.string(),
  },
  async (input) => {
    const { text } = await prompt(input);
    return text;
  }
);
