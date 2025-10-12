
"use client";

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Mail } from 'lucide-react';
import { useMemo } from 'react';
import { commentCategories, CommentCategory } from '@/lib/comment-categorization';

interface Summary {
  depot: string;
  totalRatings: number;
  negativeRatingsCount: number;
  averageRating: string;
  commentCount: number;
  nps: number;
}

interface CarrierSummary {
    depot: string;
    carrier: string;
    totalRatings: number;
    averageRating: string;
    negativeRatingsCount: number;
    commentCount: number;
    nps: number;
}

interface DriverSummary {
    depot: string;
    carrier: string;
    driver: string;
    totalRatings: number;
    averageRating: string;
    negativeRatingsCount: number;
    categorySummary: string;
    nps: number;
}

interface UnassignedDriver {
    driver: string;
    depots: string;
}

interface NpsSummary {
    nps: number;
    promoters: number;
    passives: number;
    detractors: number;
    total: number;
    promoterPercent: string;
    detractorPercent: string;
    passivePercent: string;
}

interface QualityEmailGeneratorProps {
  summaryByDepot: Summary[];
  summaryByCarrier: CarrierSummary[];
  summaryByDriver: DriverSummary[];
  unassignedDrivers: UnassignedDriver[];
  allCommentsForSummary: { id: string, comment: string, category: CommentCategory, depot: string }[];
  npsSummary: NpsSummary;
}

const getRatingColor = (rating: string) => {
    const numericRating = parseFloat(rating);
    if (isNaN(numericRating)) return '#333'; // Default color
    if (numericRating < 4.71) return '#dc3545'; // Red
    if (numericRating < 4.8) return '#ffc107'; // Yellow
    return '#28a745'; // Green
};

const getNpsColor = (nps: number) => {
    if (nps < 60) return '#dc3545'; // Red
    if (nps < 70) return '#ffc107'; // Yellow
    return '#28a745'; // Green
};


const generateQualityEmailBody = (
    summaryByDepot: Summary[],
    summaryByCarrier: CarrierSummary[],
    summaryByDriver: DriverSummary[],
    unassignedDrivers: UnassignedDriver[],
    allCommentsForSummary: QualityEmailGeneratorProps['allCommentsForSummary'],
    npsSummary: NpsSummary
) => {
  const depots = summaryByDepot.map(s => s.depot);

  let npsSection = '';
  if (npsSummary && npsSummary.total > 0) {
      npsSection = `
        <!-- NPS Global Card -->
        <tr>
          <td style="padding: 20px 0;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border: 1px solid #ddd; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <tr>
                <td style="padding: 20px;">
                  <h2 style="font-family: 'Roboto', Arial, sans-serif; color: #00338D; padding-bottom: 10px; margin-top: 0; font-size: 20px; border-bottom: 1px solid #eee;">Synthèse Net Promoter Score (NPS)</h2>
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td style="padding: 15px; text-align: center; vertical-align: top;">
                        <span style="font-family: 'Roboto', Arial, sans-serif; font-size: 14px; color: #555;">NPS Global</span>
                        <br>
                        <strong style="font-family: 'Roboto', Arial, sans-serif; font-size: 48px; color: ${npsSummary.nps >= 50 ? '#28a745' : npsSummary.nps >= 0 ? '#ffc107' : '#dc3545'}; line-height: 1.2;">${npsSummary.nps}</strong>
                      </td>
                      <td style="padding-left: 20px; vertical-align: top;">
                        <table role="presentation" border="0" cellpadding="8" cellspacing="0" width="100%">
                          <tr><td style="font-family: 'Roboto', Arial, sans-serif; font-size: 14px; color: #555;">Total des réponses:</td><td style="font-family: 'Roboto', Arial, sans-serif; font-size: 14px; color: #333; font-weight: bold;">${npsSummary.total}</td></tr>
                          <tr><td style="font-family: 'Roboto', Arial, sans-serif; font-size: 14px; color: #28a745;">Promoteurs (9-10):</td><td style="font-family: 'Roboto', Arial, sans-serif; font-size: 14px; color: #333; font-weight: bold;">${npsSummary.promoters} (${npsSummary.promoterPercent}%)</td></tr>
                          <tr><td style="font-family: 'Roboto', Arial, sans-serif; font-size: 14px; color: #ffc107;">Passifs (7-8):</td><td style="font-family: 'Roboto', Arial, sans-serif; font-size: 14px; color: #333; font-weight: bold;">${npsSummary.passives} (${npsSummary.passivePercent}%)</td></tr>
                          <tr><td style="font-family: 'Roboto', Arial, sans-serif; font-size: 14px; color: #dc3545;">Détracteurs (0-6):</td><td style="font-family: 'Roboto', Arial, sans-serif; font-size: 14px; color: #333; font-weight: bold;">${npsSummary.detractors} (${npsSummary.detractorPercent}%)</td></tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `;
  }

  let depotSections = '';

  for (const depot of depots) {
    const depotSummary = summaryByDepot.find(s => s.depot === depot);
    const carriersForDepot = summaryByCarrier.filter(s => s.depot === depot && s.negativeRatingsCount > 0);
    const driversForDepot = summaryByDriver.filter(s => s.depot === depot && s.negativeRatingsCount > 0);

    if (depotSummary && depotSummary.negativeRatingsCount > 0) {
      
      const commentsForDepot = allCommentsForSummary.filter(c => c.depot === depot);
      const categoryCounts: Record<CommentCategory, number> = commentCategories.reduce((acc, cat) => ({...acc, [cat]: 0}), {} as Record<CommentCategory, number>);

      let totalCategorizedComments = 0;
      commentsForDepot.forEach(comment => {
        if (comment.category && categoryCounts.hasOwnProperty(comment.category)) {
          categoryCounts[comment.category]++;
          totalCategorizedComments++;
        }
      });

      const categoryPercentages = commentCategories.map(category => ({
          category,
          count: categoryCounts[category],
          percentage: totalCategorizedComments > 0 ? (categoryCounts[category] / totalCategorizedComments) * 100 : 0
      })).filter(item => item.count > 0).sort((a, b) => b.percentage - a.percentage);

      const depotCategorySummaryTable = categoryPercentages.length > 0 ? `
        <h3 style="font-family: 'Roboto', Arial, sans-serif; color: #333; font-size: 18px; margin-top: 20px; margin-bottom: 10px;">Répartition des Catégories (${totalCategorizedComments} commentaires)</h3>
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 14px; border-collapse: collapse;">
          <thead>
            <tr>
              <th style="font-family: 'Roboto', Arial, sans-serif; padding: 10px; text-align: left; background-color: #f2f2f2; border-bottom: 2px solid #ddd;">Catégorie</th>
              <th style="font-family: 'Roboto', Arial, sans-serif; padding: 10px; text-align: left; background-color: #f2f2f2; border-bottom: 2px solid #ddd;">Pourcentage</th>
              <th style="font-family: 'Roboto', Arial, sans-serif; padding: 10px; text-align: left; background-color: #f2f2f2; border-bottom: 2px solid #ddd;">Nombre</th>
            </tr>
          </thead>
          <tbody>
            ${categoryPercentages.map((item, index) => `
              <tr style="background-color: ${index % 2 === 0 ? '#f8f9fa' : '#ffffff'};">
                <td style="font-family: 'Roboto', Arial, sans-serif; padding: 10px; border-top: 1px solid #ddd;">${item.category}</td>
                <td style="font-family: 'Roboto', Arial, sans-serif; padding: 10px; border-top: 1px solid #ddd;">${item.percentage.toFixed(1)}%</td>
                <td style="font-family: 'Roboto', Arial, sans-serif; padding: 10px; border-top: 1px solid #ddd;">${item.count}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '';
     
      const summaryCard = `
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px;">
          <tr>
            <td align="center" style="padding: 10px;">
              <strong style="font-family: 'Roboto', Arial, sans-serif; font-size: 24px; color: ${getNpsColor(depotSummary?.nps ?? 0)}; line-height: 1.2;">${depotSummary?.nps ?? 'N/A'}</strong>
              <br><span style="font-family: 'Roboto', Arial, sans-serif; font-size: 14px; color: #555;">NPS</span>
            </td>
            <td align="center" style="padding: 10px;">
              <strong style="font-family: 'Roboto', Arial, sans-serif; font-size: 24px; color: ${getRatingColor(depotSummary?.averageRating ?? '0')}; line-height: 1.2;">${depotSummary?.averageRating ?? 'N/A'}</strong>
              <br><span style="font-family: 'Roboto', Arial, sans-serif; font-size: 14px; color: #555;">Note moyenne</span>
            </td>
            <td align="center" style="padding: 10px;">
              <strong style="font-family: 'Roboto', Arial, sans-serif; font-size: 24px; color: #005A9C; line-height: 1.2;">${depotSummary?.negativeRatingsCount ?? 0}</strong>
              <br><span style="font-family: 'Roboto', Arial, sans-serif; font-size: 14px; color: #555;">Mauvaises notes (≤ 3)</span>
            </td>
             <td align="center" style="padding: 10px;">
              <strong style="font-family: 'Roboto', Arial, sans-serif; font-size: 24px; color: #005A9C; line-height: 1.2;">${depotSummary?.totalRatings ?? 0}</strong>
              <br><span style="font-family: 'Roboto', Arial, sans-serif; font-size: 14px; color: #555;">Total des notes</span>
            </td>
            <td align="center" style="padding: 10px;">
              <strong style="font-family: 'Roboto', Arial, sans-serif; font-size: 24px; color: #005A9C; line-height: 1.2;">${depotSummary?.commentCount ?? 0}</strong>
              <br><span style="font-family: 'Roboto', Arial, sans-serif; font-size: 14px; color: #555;">Commentaires</span>
            </td>
          </tr>
        </table>
      `;
      
      const thStyles = `font-family: 'Roboto', Arial, sans-serif; padding: 12px; text-align: left; background-color: #f2f2f2; border-bottom: 2px solid #ddd; font-weight: bold;`;
      const tdStyles = (index: number) => `font-family: 'Roboto', Arial, sans-serif; padding: 12px; border-top: 1px solid #ddd; background-color: ${index % 2 === 0 ? '#f8f9fa' : '#ffffff'};`;

      const carrierTable = carriersForDepot.length > 0 ? `
        <h3 style="font-family: 'Roboto', Arial, sans-serif; color: #333; font-size: 18px; margin-top: 25px; margin-bottom: 10px;">Détail par Transporteur</h3>
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 14px; border-collapse: collapse;">
          <thead>
            <tr>
              <th style="${thStyles}">Transporteur (Total Notes)</th>
              <th style="${thStyles}">NPS</th>
              <th style="${thStyles}">Note Moyenne</th>
              <th style="${thStyles}">Nb. Mauvaises Notes</th>
              <th style="${thStyles}">Nb. Commentaires</th>
            </tr>
          </thead>
          <tbody>
            ${carriersForDepot.map((s, index) => `
              <tr>
                <td style="${tdStyles(index)}">${s.carrier} (${s.totalRatings})</td>
                <td style="font-weight:bold; color: ${getNpsColor(s.nps)}; ${tdStyles(index)}">${s.nps}</td>
                <td style="font-weight:bold; color: ${getRatingColor(s.averageRating)}; ${tdStyles(index)}">${s.averageRating}</td>
                <td style="${tdStyles(index)}">${s.negativeRatingsCount}</td>
                <td style="${tdStyles(index)}">${s.commentCount}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '';

      const driverTable = driversForDepot.length > 0 ? `
        <h3 style="font-family: 'Roboto', Arial, sans-serif; color: #333; font-size: 18px; margin-top: 25px; margin-bottom: 10px;">Détail par Livreur</h3>
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 14px; border-collapse: collapse;">
          <thead>
            <tr>
              <th style="${thStyles}">Transporteur</th>
              <th style="${thStyles}">Livreur (Total Notes)</th>
              <th style="${thStyles}">NPS</th>
              <th style="${thStyles}">Note Moyenne</th>
              <th style="${thStyles}">Nb. Mauvaises Notes</th>
              <th style="${thStyles}">Catégories de Commentaires</th>
            </tr>
          </thead>
          <tbody>
            ${driversForDepot.map((s, index) => `
              <tr>
                <td style="${tdStyles(index)}">${s.carrier}</td>
                <td style="${tdStyles(index)}">${s.driver} (${s.totalRatings})</td>
                <td style="font-weight:bold; color: ${getNpsColor(s.nps)}; ${tdStyles(index)}">${s.nps}</td>
                <td style="font-weight:bold; color: ${getRatingColor(s.averageRating)}; ${tdStyles(index)}">${s.averageRating}</td>
                <td style="${tdStyles(index)}">${s.negativeRatingsCount}</td>
                <td style="${tdStyles(index)}">${s.categorySummary}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '';

      depotSections += `
        <!-- Depot Card -->
        <tr>
          <td style="padding: 20px 0;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border: 1px solid #ddd; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <tr>
                <td style="padding: 20px;">
                  <h2 style="font-family: 'Roboto', Arial, sans-serif; color: #00338D; padding-bottom: 10px; margin-top: 0; font-size: 22px; border-bottom: 1px solid #eee;">${depot}</h2>
                  ${summaryCard}
                  ${depotCategorySummaryTable}
                  ${carrierTable}
                  ${driverTable}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `;
    }
  }

  const unassignedDriversSection = unassignedDrivers.length > 0 ? `
    <!-- Unassigned Drivers Card -->
    <tr>
      <td style="padding: 20px 0;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border: 1px solid #ddd; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 20px;">
              <h2 style="font-family: 'Roboto', Arial, sans-serif; color: #00338D; padding-bottom: 10px; margin-top: 0; font-size: 20px; border-bottom: 1px solid #eee;">Livreurs sans Transporteur Assigné</h2>
              <p style="font-family: 'Roboto', Arial, sans-serif; line-height: 1.6; color: #555;">La performance de ces livreurs est incluse dans les totaux des dépôts mais ne peut être affectée à un transporteur. Veuillez vérifier leur nommage.</p>
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 14px; margin-top: 15px; border-collapse: collapse;">
                <thead>
                  <tr>
                    <th style="font-family: 'Roboto', Arial, sans-serif; padding: 10px; text-align: left; background-color: #f2f2f2; border-bottom: 2px solid #ddd;">Nom du Livreur</th>
                    <th style="font-family: 'Roboto', Arial, sans-serif; padding: 10px; text-align: left; background-color: #f2f2f2; border-bottom: 2px solid #ddd;">Dépôt(s) d'apparition</th>
                  </tr>
                </thead>
                <tbody>
                  ${unassignedDrivers.map((s, index) => `
                    <tr style="background-color: ${index % 2 === 0 ? '#f8f9fa' : '#ffffff'};">
                      <td style="font-family: 'Roboto', Arial, sans-serif; padding: 10px; border-top: 1px solid #ddd;">${s.driver}</td>
                      <td style="font-family: 'Roboto', Arial, sans-serif; padding: 10px; border-top: 1px solid #ddd;">${s.depots}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  ` : '';

  let body = `
    <!DOCTYPE html>
    <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Rapport de Synthèse de la Qualité</title>
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap" rel="stylesheet">
      </head>
      <body style="font-family: 'Roboto', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f7f6;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="padding: 20px 0;">
              <table align="center" border="0" cellpadding="0" cellspacing="0" width="800" style="max-width: 800px; margin: 0 auto; background-color: #ffffff;">
                <!-- Header -->
                <tr>
                  <td style="text-align: center; padding: 20px; border-bottom: 2px solid #005A9C;">
                    <h1 style="font-family: 'Roboto', Arial, sans-serif; color: #00338D; font-size: 26px; margin: 0;">Rapport de Synthèse de la Qualité</h1>
                    <span style="font-family: 'Roboto', Arial, sans-serif; font-size: 16px; color: #555;">(Focus sur les Mauvaises Notes & NPS)</span>
                  </td>
                </tr>
                <!-- Content -->
                <tr>
                  <td style="padding: 20px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td>
                          <p style="font-family: 'Roboto', Arial, sans-serif; line-height: 1.6; color: #333;">Bonjour,</p>
                          <p style="font-family: 'Roboto', Arial, sans-serif; line-height: 1.6; color: #333;">Veuillez trouver ci-dessous les synthèses de la qualité par dépôt pour la période sélectionnée, en se concentrant sur les entités avec au moins une mauvaise note.</p>
                        </td>
                      </tr>
                      ${npsSection}
                      ${depotSections}
                      ${unassignedDriversSection}
                    </table>
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="padding: 30px; text-align: center; font-style: italic; color: #888; font-size: 12px;">
                    <p style="margin: 0;">Cordialement,</p>
                    <p style="margin: 5px 0;">L'équipe Analyse de Données</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
  return body;
};

const QualityEmailGenerator = ({ summaryByDepot, summaryByCarrier, summaryByDriver, unassignedDrivers, allCommentsForSummary, npsSummary }: QualityEmailGeneratorProps) => {

  const handleSendEmail = () => {
    const subject = "Rapport de Synthèse de la Qualité (Focus sur les Mauvaises Notes & NPS)";
    const body = generateQualityEmailBody(summaryByDepot, summaryByCarrier, summaryByDriver, unassignedDrivers, allCommentsForSummary, npsSummary);
    
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
            <Mail className="mr-2 h-4 w-4" />
            Générer l'Email de Synthèse
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle>Aperçu de l'Email de Synthèse Qualité</DialogTitle>
        </DialogHeader>
        <div 
          className="max-h-[70vh] overflow-y-auto p-4 border rounded-md"
          dangerouslySetInnerHTML={{ __html: generateQualityEmailBody(summaryByDepot, summaryByCarrier, summaryByDriver, unassignedDrivers, allCommentsForSummary, npsSummary) }}
        />
        <DialogFooter>
          <Button onClick={handleSendEmail}>Envoyer l'Email</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default QualityEmailGenerator;
