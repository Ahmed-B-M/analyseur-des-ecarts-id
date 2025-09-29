'use server';

import { analyzeCustomerFeedback, AnalyzeCustomerFeedbackOutput } from '@/ai/flows/analyze-customer-feedback-for-delivery-issues';

export type AnalysisResult = AnalyzeCustomerFeedbackOutput;

export async function runFeedbackAnalysis(comment: string): Promise<AnalysisResult> {
  try {
    const result = await analyzeCustomerFeedback({ commentaire: comment });
    return result;
  } catch (error) {
    console.error("Error running feedback analysis action:", error);
    throw new Error("Failed to analyze feedback.");
  }
}
