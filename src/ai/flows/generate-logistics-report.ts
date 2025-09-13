
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
    executiveSummary: z.string().describe("Synthèse managériale de 2 à 3 phrases. Comparer la performance globale aux objectifs (95% ponctualité, 4.8/5 note), énoncer le principal problème et l'insight majeur de la période."),
    kpiAnalysis: z.object({
        punctuality: z.string().describe("Analyse du KPI de ponctualité. Mentionner l'objectif de 95% et commenter l'écart."),
        rating: z.string().describe("Analyse du KPI de notation client. Mentionner l'objectif de 4.8 et commenter l'écart."),
        delays: z.string().describe("Analyse du nombre de retards et d'avances. Mettre en perspective par rapport au nombre total de livraisons."),
    }),
    anomaliesAnalysis: z.object({
        overload: z.string().optional().describe("Analyse des surcharges. Commenter le nombre de tournées concernées et l'impact potentiel."),
        planning: z.string().optional().describe("Analyse des anomalies de planification (parties à l'heure, arrivées en retard). Expliquer ce que cela signifie (temps de trajet sous-estimés).")
    }),
    geoDriverAnalysis: z.object({
        city: z.string().optional().describe("Analyse des performances par ville. Pointer la ville la plus en retard et suggérer des causes locales possibles."),
        driver: z.string().optional().describe("Analyse des performances par livreur. Commenter le livreur le plus en retard et suggérer un besoin d'accompagnement.")
    }),
    customerImpactAnalysis: z.object({
        mainReason: z.string().describe("Analyse de l'impact sur les clients. Faire le lien entre la ponctualité, la note moyenne et la raison principale des avis négatifs si disponible.")
    }),
    conclusion: z.object({
        summary: z.string().describe("Résumé des 2 ou 3 problèmes principaux identifiés."),
        recommendations: z.array(z.string()).describe("Liste de 2 à 3 recommandations actionnables et concrètes pour adresser ces problèmes.")
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
    En tant qu'expert analyste en logistique pour Carrefour, tu dois rédiger une analyse complète et détaillée pour un rapport de performance destiné à la direction.
    Ton objectif est d'être analytique, percutant et de fournir des insights actionnables basés sur les données fournies.
    Rédige chaque section en phrases complètes.

    ## Données brutes pour ton analyse :
    - Nombre total de tournées: {{{totalTours}}}
    - Nombre total de livraisons: {{{totalTasks}}}
    - Taux de ponctualité global: {{{punctualityRate}}}% (Objectif: 95%)
    - Note moyenne des clients: {{{avgRating}}}/5 (Objectif: 4.8)
    - Total livraisons en retard: {{{totalLateTasks}}}
    - Total livraisons en avance: {{{totalEarlyTasks}}}
    - Nombre de tournées en surcharge (poids/volume): {{{overloadedToursCount}}}
    - Anomalies de planification (parties à l'heure, arrivées en retard): {{{lateStartAnomaliesCount}}}
    {{#if topLateDriver}}- Livreur le plus en retard: {{{topLateDriver}}}{{/if}}
    {{#if topLateCity}}- Ville la plus impactée par les retards: {{{topLateCity}}}{{/if}}
    {{#if mainReasonForNegativeFeedback}}- Raison principale des avis négatifs: {{{mainReasonForNegativeFeedback}}}{{/if}}

    ## Instructions pour chaque section du rapport :

    ### 1. Titre (title)
    Génère un titre court et informatif. Ex: "Analyse de Performance Logistique - Semaine 24".

    ### 2. Synthèse Managériale (executiveSummary)
    Rédige une synthèse de 2-3 phrases. Compare la performance aux objectifs de ponctualité (95%) et de notation (4.8). Énonce clairement le problème principal de la période (ex: "forte dégradation de la ponctualité due à des problèmes de planification") et l'insight majeur (ex: "concentrée sur le secteur Nord").

    ### 3. Analyse des KPIs Principaux (kpiAnalysis)
    - **ponctuality**: Commente le taux de ponctualité de {{{punctualityRate}}}%. Est-il au-dessus ou en dessous de l'objectif de 95%? L'écart est-il significatif ?
    - **rating**: Commente la note moyenne de {{{avgRating}}}/5. Est-elle conforme à l'objectif de 4.8 ? Fais un lien direct avec la performance de ponctualité.
    - **delays**: Analyse le nombre de retards ({{{totalLateTasks}}}) et d'avances ({{{totalEarlyTasks}}}). Mets ces chiffres en perspective par rapport au nombre total de livraisons ({{{totalTasks}}}). Par exemple, "Les {{{totalLateTasks}}} retards représentent X% du total des livraisons, indiquant un problème systémique ou ponctuel."

    ### 4. Analyse des Anomalies Opérationnelles (anomaliesAnalysis)
    - **overload**: Si {{{overloadedToursCount}}} > 0, commente ce chiffre. Exemple: "{{{overloadedToursCount}}} tournées en surcharge ont été détectées. Cela indique un problème potentiel de planification des capacités ou de non-respect des processus, impactant directement les temps de service et la ponctualité." Si 0, mentionne que c'est un point positif.
    - **planning**: Si {{{lateStartAnomaliesCount}}} > 0, commente ce chiffre. Exemple: "{{{lateStartAnomaliesCount}}} tournées, bien que parties à l'heure, ont accumulé des retards. Ceci est un indicateur fort que les temps de trajet alloués pour ces tournées sont structurellement sous-estimés, menant à des retards inévitables." Si 0, indique que la planification des temps de trajet semble correcte.

    ### 5. Analyse Géographique et par Livreur (geoDriverAnalysis)
    - **city**: Si {{{topLateCity}}} est fourni, analyse ce point. Exemple: "L'analyse géographique montre une concentration significative des retards sur la ville de {{{topLateCity}}}. Ce secteur est le plus problématique et pourrait être affecté par des conditions de trafic spécifiques, des erreurs de planification de zone ou des difficultés opérationnelles locales."
    - **driver**: Si {{{topLateDriver}}} est fourni, analyse ce point. Exemple: "Le livreur {{{topLateDriver}}} présente la plus forte concentration de retards sur la période. Un suivi individuel est recommandé pour comprendre les causes (difficultés sur le secteur, besoin de formation, etc.)."

    ### 6. Analyse de l'Impact Client (customerImpactAnalysis)
    - **mainReason**: Fais une synthèse percutante. Exemple: "L'impact sur l'expérience client est direct : la chute de la ponctualité à {{{punctualityRate}}}% se traduit par une note moyenne de {{{avgRating}}}/5. L'analyse des commentaires clients confirme que la raison principale de l'insatisfaction est '{{{mainReasonForNegativeFeedback}}}', ce qui prouve que chaque retard érodé la confiance de nos clients."

    ### 7. Conclusion et Recommandations (conclusion)
    - **summary**: Résume les 2 ou 3 problèmes fondamentaux identifiés (ex: "Problème de planification des temps de trajet, surcharge récurrente des véhicules, et une concentration des incidents sur le secteur de {{{topLateCity}}}.")
    - **recommendations**: Propose 2-3 recommandations concrètes et actionnables. Exemples : "Ré-évaluer les temps de parcours pour les tournées identifiées en anomalie", "Auditer le processus de chargement des véhicules pour les {{{overloadedToursCount}}} tournées en surcharge", "Lancer une analyse spécifique sur le secteur de {{{topLateCity}}} pour ajuster les plans de tournée".

    **Sois factuel, analytique et orienté business. Le public est la direction de Carrefour. Ne génère que la structure JSON demandée.**
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
