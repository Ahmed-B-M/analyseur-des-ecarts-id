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
    En tant qu'expert en analyse de données logistiques pour Carrefour, tu dois générer les éléments pour un rapport de performance visuel destiné à la direction.
    Ton objectif est d'être percutant, analytique et d'aller à l'essentiel pour identifier les problèmes, leurs causes et leurs impacts.

    ## Structure du rapport à générer :
    1.  **Titre (title)**: Génère un titre court et informatif pour le rapport.
    2.  **Synthèse (synthesis)**: Rédige une synthèse managériale de 1 à 2 phrases MAXIMUM. Compare la performance aux objectifs (95% ponctualité, 4.8/5 note) et énonce le principal problème de la période.
    3.  **Insights Clés (keyInsights)**: Identifie 3 ou 4 points d'analyse les plus CRITIQUES et actionnables. Pour chaque point, fournis un texte court et une icône pertinente parmi la liste fournie.

    ## Données brutes pour ton analyse :
    - Nombre total de tournées: {{{totalTours}}}
    - Nombre total de livraisons: {{{totalTasks}}}
    - Taux de ponctualité global: {{{punctualityRate}}}% (Objectif: 95%)
    - Note moyenne des clients: {{{avgRating}}}/5 (Objectif: 4.8)
    - Total livraisons en retard: {{{totalLateTasks}}}
    - Total livraisons en avance: {{{totalEarlyTasks}}}
    - Nombre de tournées en surcharge (poids/volume): {{{overloadedToursCount}}}
    - Anomalies de planification (parties à l'heure, arrivées en retard): {{{lateStartAnomaliesCount}}}
    {{#if topLateDriver}}- Livreur le plus en retard: {{{topLateDriver}}}{{#if}}
    {{#if topLateCity}}- Ville la plus impactée par les retards: {{{topLateCity}}}{{#if}}

    ## Comment raisonner pour générer les insights :

    ### A. Analyse des écarts (Poids & Temps)
    - **Surcharge** : Si {{{overloadedToursCount}}} > 0, c'est un point majeur. Formule un insight comme : "{{{overloadedToursCount}}} tournées en surcharge ont directement impacté la ponctualité, indiquant un problème de planification ou de respect des process." (Icône: 'AlertTriangle')
    - **Anomalies de temps** : Si {{{lateStartAnomaliesCount}}} > 0, cela signifie que les temps de trajet sont sous-estimés. Insight possible : "{{{lateStartAnomaliesCount}}} tournées parties à l'heure mais arrivées en retard révèlent une sous-estimation structurelle des temps de parcours." (Icône: 'BarChart2')

    ### B. Analyse Géographique et Individuelle
    - **Villes** : Si {{{topLateCity}}} est pertinent (nombre de retards élevé), formule un insight : "Les retards se concentrent fortement sur la ville de {{{topLateCity}}}, suggérant un problème local (trafic, planification de secteur)." (Icône: 'MapPin')
    - **Livreurs** : Si {{{topLateDriver}}} est identifié, cela peut indiquer un besoin de suivi. Insight : "Le livreur {{{topLateDriver}}} concentre une part significative des retards, un accompagnement individuel est à envisager." (Icône: 'Users')

    ### C. Impact sur la Qualité Client
    - Fais le lien entre la ponctualité et la note. Si la ponctualité est basse ET la note est basse, c'est un insight crucial. Exemple : "La chute du taux de ponctualité à {{{punctualityRate}}}% coïncide avec une note moyenne faible de {{{avgRating}}}/5, confirmant l'impact direct des retards sur la satisfaction." (Icône: 'Clock')
    - Utilise le motif principal des retours négatifs si disponible.

    **Instructions finales :**
    - Choisis les 3-4 insights les plus percutants basés sur l'ampleur des chiffres.
    - Sois factuel, concis et orienté business. Le public est la direction de Carrefour.
    - Ne génère que les éléments demandés dans le schéma de sortie (title, synthesis, keyInsights).
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
