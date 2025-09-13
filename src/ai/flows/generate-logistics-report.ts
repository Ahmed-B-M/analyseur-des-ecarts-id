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
    L'objectif principal est de comparer la performance réalisée aux objectifs fixés (95% de ponctualité, 4.8 de note moyenne), de mettre en évidence les écarts significatifs par rapport au prévisionnel, d'identifier les indicateurs en forte dégradation et d'en trouver les causes principales. Ne propose PAS de recommandations ou de plan d'action.

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

    ## Synthèse de Performance vs. Objectifs
    Commence par une ou deux phrases qui comparent la performance aux objectifs.
    Exemple: "La performance de la période est en dessous des objectifs, avec un taux de ponctualité de {{{punctualityRate}}}% (cible: 95%) et une note moyenne de {{{avgRating}}}/10 (cible: 4.8)."
    Mets en évidence l'écart le plus significatif.

    ## Indicateurs en Dégradation et Écarts Clés
    Liste les 2 à 3 points les plus critiques où la performance s'est dégradée ou montre un écart important avec le prévisionnel. Sois factuel.
    Utilise les données fournies pour identifier ces points.
    Par exemple:
    - "Le principal point de dégradation est le taux de ponctualité, avec {{{totalLateTasks}}} livraisons en retard."
    - "{{{overloadedToursCount}}} tournées ont été effectuées en surcharge, ce qui représente un risque opérationnel."
    - "Les anomalies de type 'départ à l'heure, arrivée en retard' ({{{lateStartAnomaliesCount}}} cas) montrent une sous-estimation des temps de parcours."

    ## Analyse des Causes Principales
    Identifie et détaille les causes qui expliquent les dégradations listées ci-dessus. Fais des liens entre les différentes données.
    Par exemple:
    - "La cause majeure des retards semble être géographique, concentrée sur la ville de {{{topLateCity}}}."
    - "Les problèmes de surcharge ({{{overloadedToursCount}}} cas) sont un facteur aggravant, impactant potentiellement les temps de trajet et la ponctualité des livreurs concernés."
    - "L'analyse des retours clients (si disponible) confirme que les retards sont la principale source d'insatisfaction."
    - Mentionne le livreur problématique s'il représente un point de focalisation.

    Le ton doit être analytique, factuel et se concentrer uniquement sur le diagnostic basé sur les chiffres.
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
