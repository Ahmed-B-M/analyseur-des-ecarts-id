
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
}

interface CarrierSummary {
    depot: string;
    carrier: string;
    totalRatings: number;
    averageRating: string;
    negativeRatingsCount: number;
    commentCount: number;
}

interface DriverSummary {
    depot: string;
    carrier: string;
    driver: string;
    totalRatings: number;
    averageRating: string;
    negativeRatingsCount: number;
    categorySummary: string;
}

interface UnassignedDriver {
    driver: string;
    depots: string;
}

interface QualityEmailGeneratorProps {
  summaryByDepot: Summary[];
  summaryByCarrier: CarrierSummary[];
  summaryByDriver: DriverSummary[];
  unassignedDrivers: UnassignedDriver[];
  allCommentsForSummary: { id: string, comment: string, category: CommentCategory }[];
}

const generateQualityEmailBody = (
    summaryByDepot: Summary[],
    summaryByCarrier: CarrierSummary[],
    summaryByDriver: DriverSummary[],
    unassignedDrivers: UnassignedDriver[],
    allCommentsForSummary: QualityEmailGeneratorProps['allCommentsForSummary']
) => {
  const depots = summaryByDepot.map(s => s.depot);

  // --- Start: Global Category Summary Calculation ---
  const categoryCounts: Record<CommentCategory, number> = commentCategories.reduce((acc, cat) => {
    acc[cat] = 0;
    return acc;
  }, {} as Record<CommentCategory, number>);

  let totalCategorizedComments = 0;
  allCommentsForSummary.forEach(comment => {
    if (comment.category && categoryCounts.hasOwnProperty(comment.category)) {
      categoryCounts[comment.category]++;
      totalCategorizedComments++;
    }
  });

  const categoryPercentages = commentCategories.map(category => {
    const count = categoryCounts[category];
    return {
      category,
      count,
      percentage: totalCategorizedComments > 0 ? (count / totalCategorizedComments) * 100 : 0
    };
  }).filter(item => item.count > 0).sort((a, b) => b.percentage - a.percentage);


  const globalCategorySummaryTable = categoryPercentages.length > 0 ? `
    <div style="background-color: #ffffff; padding: 20px 0; margin-bottom: 25px; border-bottom: 1px solid #e0e0e0;">
      <h2 style="color: #00338D; padding-bottom: 10px; margin-top: 0; font-size: 22px;">Répartition des Catégories de Commentaires</h2>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="border-collapse: collapse; border-spacing: 0; width: 100%; font-size: 14px;">
        <thead>
          <tr>
            <th style="padding: 12px 15px; text-align: left; background-color: #005A9C; color: #ffffff; font-weight: bold; text-transform: uppercase; font-size: 12px; border-style: none;">Catégorie</th>
            <th style="padding: 12px 15px; text-align: left; background-color: #005A9C; color: #ffffff; font-weight: bold; text-transform: uppercase; font-size: 12px; border-style: none;">Pourcentage</th>
            <th style="padding: 12px 15px; text-align: left; background-color: #005A9C; color: #ffffff; font-weight: bold; text-transform: uppercase; font-size: 12px; border-style: none;">Nombre</th>
          </tr>
        </thead>
        <tbody>
          ${categoryPercentages.map((item, index) => `
            <tr>
              <td style="padding: 12px 15px; background-color: ${index % 2 === 0 ? '#f8f9fa' : '#ffffff'}; border-style: none; border-top: 1px solid #dddddd;">${item.category}</td>
              <td style="padding: 12px 15px; background-color: ${index % 2 === 0 ? '#f8f9fa' : '#ffffff'}; border-style: none; border-top: 1px solid #dddddd;">${item.percentage.toFixed(2)}%</td>
              <td style="padding: 12px 15px; background-color: ${index % 2 === 0 ? '#f8f9fa' : '#ffffff'}; border-style: none; border-top: 1px solid #dddddd;">${item.count}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  ` : '';
  // --- End: Global Category Summary Calculation ---

  let depotSections = '';

  for (const depot of depots) {
    const depotSummary = summaryByDepot.find(s => s.depot === depot);
    const carriersForDepot = summaryByCarrier.filter(s => s.depot === depot && s.negativeRatingsCount > 0);
    const driversForDepot = summaryByDriver.filter(s => s.depot === depot && s.negativeRatingsCount > 0);

    if (depotSummary && depotSummary.negativeRatingsCount > 0) {
      
      const summaryCard = `
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px;">
          <tr>
            <td style="padding: 10px 0;">
              <table role="presentation" border="0" cellpadding="5" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding: 10px;">
                    <strong style="font-size: 20px; color: #005A9C; line-height: 1.2;">${depotSummary?.totalRatings ?? 0}</strong>
                    <br>
                    <span style="font-size: 14px; color: #555;">Total des notes</span>
                  </td>
                  <td align="center" style="padding: 10px;">
                    <strong style="font-size: 20px; color: #005A9C; line-height: 1.2;">${depotSummary?.negativeRatingsCount ?? 0}</strong>
                    <br>
                    <span style="font-size: 14px; color: #555;">Mauvaises notes (≤ 3)</span>
                  </td>
                  <td align="center" style="padding: 10px;">
                    <strong style="font-size: 20px; color: #005A9C; line-height: 1.2;">${depotSummary?.averageRating ?? 'N/A'}</strong>
                    <br>
                    <span style="font-size: 14px; color: #555;">Note moyenne</span>
                  </td>
                  <td align="center" style="padding: 10px;">
                    <strong style="font-size: 20px; color: #005A9C; line-height: 1.2;">${depotSummary?.commentCount ?? 0}</strong>
                    <br>
                    <span style="font-size: 14px; color: #555;">Commentaires</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      `;

      const tableStyles = `border-collapse: collapse; border-spacing: 0; width: 100%; font-size: 14px;`;
      const thStyles = `padding: 12px 15px; text-align: left; background-color: #005A9C; color: #ffffff; font-weight: bold; text-transform: uppercase; font-size: 12px; border-style: none;`;
      const tdStyles = (index: number) => `padding: 12px 15px; background-color: ${index % 2 === 0 ? '#f8f9fa' : '#ffffff'}; border-style: none; border-top: 1px solid #dddddd;`;


      const carrierTable = carriersForDepot.length > 0 ? `
        <h3 style="color: #333; font-size: 18px; margin-top: 25px; margin-bottom: 10px;">Détail par Transporteur</h3>
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="${tableStyles}">
          <thead>
            <tr>
              <th style="${thStyles}">Transporteur (Total Notes)</th>
              <th style="${thStyles}">Nb. Mauvaises Notes</th>
              <th style="${thStyles}">Note Moyenne</th>
              <th style="${thStyles}">Nb. Commentaires</th>
            </tr>
          </thead>
          <tbody>
            ${carriersForDepot.map((s, index) => `
              <tr>
                <td style="${tdStyles(index)}">${s.carrier} (${s.totalRatings})</td>
                <td style="${tdStyles(index)}">${s.negativeRatingsCount}</td>
                <td style="${tdStyles(index)}">${s.averageRating}</td>
                <td style="${tdStyles(index)}">${s.commentCount}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '';

      const driverTable = driversForDepot.length > 0 ? `
        <h3 style="color: #333; font-size: 18px; margin-top: 25px; margin-bottom: 10px;">Détail par Livreur</h3>
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="${tableStyles}">
          <thead>
            <tr>
              <th style="${thStyles}">Transporteur</th>
              <th style="${thStyles}">Livreur (Total Notes)</th>
              <th style="${thStyles}">Nb. Mauvaises Notes</th>
              <th style="${thStyles}">Note Moyenne</th>
              <th style="${thStyles}">Catégories de Commentaires</th>
            </tr>
          </thead>
          <tbody>
            ${driversForDepot.map((s, index) => `
              <tr>
                <td style="${tdStyles(index)}">${s.carrier}</td>
                <td style="${tdStyles(index)}">${s.driver} (${s.totalRatings})</td>
                <td style="${tdStyles(index)}">${s.negativeRatingsCount}</td>
                <td style="${tdStyles(index)}">${s.averageRating}</td>
                <td style="${tdStyles(index)}">${s.categorySummary}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '';

      depotSections += `
        <div style="background-color: #ffffff; padding: 20px 0; margin-bottom: 25px; border-bottom: 1px solid #e0e0e0;">
          <h2 style="color: #00338D; padding-bottom: 10px; margin-top: 0; font-size: 22px;">${depot}</h2>
          ${summaryCard}
          ${carrierTable}
          ${driverTable}
        </div>
      `;
    }
  }

  const unassignedDriversSection = unassignedDrivers.length > 0 ? `
    <div style="background-color: #ffffff; padding: 20px 0; margin-bottom: 25px;">
      <h2 style="color: #00338D; padding-bottom: 10px; margin-top: 0; font-size: 22px;">Livreurs sans Transporteur Assigné</h2>
      <p style="font-family: 'Roboto', Arial, sans-serif; line-height: 1.6; color: #333;">La performance de ces livreurs est incluse dans les totaux des dépôts mais ne peut être affectée à un transporteur. Veuillez vérifier leur nommage.</p>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; border-spacing: 0; font-size: 14px;">
        <thead>
          <tr>
            <th style="padding: 12px 15px; text-align: left; background-color: #005A9C; color: #ffffff; font-weight: bold; text-transform: uppercase; font-size: 12px; border-style: none;">Nom du Livreur</th>
            <th style="padding: 12px 15px; text-align: left; background-color: #005A9C; color: #ffffff; font-weight: bold; text-transform: uppercase; font-size: 12px; border-style: none;">Dépôt(s) d'apparition</th>
          </tr>
        </thead>
        <tbody>
          ${unassignedDrivers.map((s, index) => `
            <tr>
              <td style="padding: 12px 15px; background-color: ${index % 2 === 0 ? '#f8f9fa' : '#ffffff'}; border-style: none; border-top: 1px solid #dddddd;">${s.driver}</td>
              <td style="padding: 12px 15px; background-color: ${index % 2 === 0 ? '#f8f9fa' : '#ffffff'}; border-style: none; border-top: 1px solid #dddddd;">${s.depots}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  ` : '';

  let body = `
    <!DOCTYPE html>
    <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Rapport de Synthèse de la Qualité</title>
      </head>
      <body style="font-family: 'Roboto', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f7f6;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="padding: 20px 0;">
              <table align="center" border="0" cellpadding="0" cellspacing="0" width="800" style="max-width: 800px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
                <!-- Header -->
                <tr>
                  <td style="text-align: center; padding: 20px; border-bottom: 2px solid #005A9C;">
                    <img src="https://www.corp-visuels.com/fr/wp-content/uploads/2018/01/logo-la-poste-2012.png" alt="Logo" style="max-width: 150px; margin-bottom: 10px;">
                    <h1 style="color: #00338D; font-size: 26px; margin: 0;">Rapport de Synthèse de la Qualité</h1>
                    <span style="font-size: 16px; color: #555;">(Focus sur les Mauvaises Notes)</span>
                  </td>
                </tr>
                <!-- Content -->
                <tr>
                  <td style="padding: 20px;">
                    <p style="font-family: 'Roboto', Arial, sans-serif; line-height: 1.6; color: #333;">Bonjour,</p>
                    <p style="font-family: 'Roboto', Arial, sans-serif; line-height: 1.6; color: #333;">Veuillez trouver ci-dessous les synthèses de la qualité par dépôt pour la période sélectionnée, en se concentrant sur les entités avec au moins une mauvaise note.</p>
                    
                    ${globalCategorySummaryTable}
                    ${depotSections}
                    ${unassignedDriversSection}
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="padding: 30px; text-align: center; font-style: italic; color: #888; font-size: 12px;">
                    <p style="margin: 0;">Cordialement,</p>
                    <p style="margin: 5px 0;">L'équipe Analyse de Données</p>
                    <p style="margin: 0;">&copy; ${new Date().getFullYear()} Votre Entreprise. Tous droits réservés.</p>
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

const QualityEmailGenerator = ({ summaryByDepot, summaryByCarrier, summaryByDriver, unassignedDrivers, allCommentsForSummary }: QualityEmailGeneratorProps) => {

  const handleSendEmail = () => {
    const subject = "Rapport de Synthèse de la Qualité (Focus sur les Mauvaises Notes)";
    const body = generateQualityEmailBody(summaryByDepot, summaryByCarrier, summaryByDriver, unassignedDrivers, allCommentsForSummary);
    
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
          dangerouslySetInnerHTML={{ __html: generateQualityEmailBody(summaryByDepot, summaryByCarrier, summaryByDriver, unassignedDrivers, allCommentsForSummary) }}
        />
        <DialogFooter>
          <Button onClick={handleSendEmail}>Envoyer l'Email</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default QualityEmailGenerator;
