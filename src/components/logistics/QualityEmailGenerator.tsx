
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
}

const generateQualityEmailBody = (
    summaryByDepot: Summary[],
    summaryByCarrier: CarrierSummary[],
    summaryByDriver: DriverSummary[],
    unassignedDrivers: UnassignedDriver[]
) => {
  const depots = summaryByDepot.map(s => s.depot);

  let depotSections = '';

  for (const depot of depots) {
    const depotSummary = summaryByDepot.find(s => s.depot === depot);
    const carriersForDepot = summaryByCarrier.filter(s => s.depot === depot && s.negativeRatingsCount > 0);
    const driversForDepot = summaryByDriver.filter(s => s.depot === depot && s.negativeRatingsCount > 0);

    if (depotSummary && depotSummary.negativeRatingsCount > 0) {
      depotSections += `
        <div class="card">
          <h2>${depot}</h2>
          
          <!-- Depot Summary Card -->
          <div class="summary-card">
            <div class="summary-item"><strong>${depotSummary?.totalRatings ?? 0}</strong><span>Total des notes</span></div>
            <div class="summary-item"><strong>${depotSummary?.negativeRatingsCount ?? 0}</strong><span>Mauvaises notes (≤ 3)</span></div>
            <div class="summary-item"><strong>${depotSummary?.averageRating ?? 'N/A'}</strong><span>Note moyenne</span></div>
            <div class="summary-item"><strong>${depotSummary?.commentCount ?? 0}</strong><span>Commentaires</span></div>
          </div>

          <!-- Carrier Table -->
          ${carriersForDepot.length > 0 ? `
            <h3>Détail par Transporteur</h3>
            <div class="table-container">
              <table>
                <thead><tr><th>Transporteur (Total Notes)</th><th>Nb. Mauvaises Notes</th><th>Note Moyenne</th><th>Nb. Commentaires</th></tr></thead>
                <tbody>
                  ${carriersForDepot.map(s => `
                    <tr>
                      <td>${s.carrier} (${s.totalRatings})</td>
                      <td>${s.negativeRatingsCount}</td>
                      <td>${s.averageRating}</td>
                      <td>${s.commentCount}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}

          <!-- Driver Table -->
          ${driversForDepot.length > 0 ? `
            <h3>Détail par Livreur</h3>
            <div class="table-container">
              <table>
                <thead><tr><th>Transporteur</th><th>Livreur (Total Notes)</th><th>Nb. Mauvaises Notes</th><th>Note Moyenne</th><th>Catégories de Commentaires</th></tr></thead>
                <tbody>
                  ${driversForDepot.map(s => `
                    <tr>
                      <td>${s.carrier}</td>
                      <td>${s.driver} (${s.totalRatings})</td>
                      <td>${s.negativeRatingsCount}</td>
                      <td>${s.averageRating}</td>
                      <td>${s.categorySummary}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}
        </div>
      `;
    }
  }

  let body = `
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Rapport de Synthèse de la Qualité</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap');

          body {
            font-family: 'Roboto', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f4f7f6;
          }
          .container {
            max-width: 800px;
            margin: 20px auto;
            padding: 20px;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            padding-bottom: 20px;
            border-bottom: 2px solid #005A9C;
          }
          .header img {
            max-width: 150px;
            margin-bottom: 10px;
          }
          h1 {
            color: #00338D;
            font-size: 26px;
            margin: 0;
          }
          h2 {
            color: #00338D;
            border-bottom: 1px solid #e0e0e0;
            padding-bottom: 10px;
            margin-top: 30px;
            font-size: 22px;
          }
          h3 {
            color: #333;
            font-size: 18px;
            margin-top: 25px;
            margin-bottom: 10px;
          }
          .card {
            background-color: #ffffff;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 25px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.05);
            page-break-inside: avoid;
          }
          .summary-card {
            background-color: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
          }
          .summary-item {
            background-color: #ffffff;
            padding: 15px;
            border-radius: 6px;
            border: 1px solid #e0e0e0;
            text-align: center;
          }
          .summary-item strong {
            display: block;
            font-size: 20px;
            color: #005A9C;
          }
          .summary-item span {
            font-size: 14px;
            color: #555;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            font-size: 14px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.03);
          }
          th, td {
            border: 1px solid #e0e0e0;
            padding: 12px 15px;
            text-align: left;
          }
          th {
            background-color: #005A9C;
            color: #ffffff;
            font-weight: bold;
            text-transform: uppercase;
            font-size: 12px;
          }
          tbody tr:nth-child(even) {
            background-color: #f8f9fa;
          }
          tbody tr:hover {
            background-color: #e9ecef;
          }
          .table-container {
            overflow-x: auto;
          }
          .footer {
            margin-top: 30px;
            text-align: center;
            font-style: italic;
            color: #888;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <!-- Replace with your actual logo URL -->
            <img src="https://www.corp-visuels.com/fr/wp-content/uploads/2018/01/logo-la-poste-2012.png" alt="Logo">
            <h1>Rapport de Synthèse de la Qualité</h1>
            <span>(Focus sur les Mauvaises Notes)</span>
          </div>

          <p>Bonjour,</p>
          <p>Veuillez trouver ci-dessous les synthèses de la qualité par dépôt pour la période sélectionnée, en se concentrant sur les entités avec au moins une mauvaise note.</p>
          
          ${depotSections}

          ${unassignedDrivers.length > 0 ? `
            <div class="card">
              <h2>Livreurs sans Transporteur Assigné</h2>
              <p>La performance de ces livreurs est incluse dans les totaux des dépôts mais ne peut être affectée à un transporteur. Veuillez vérifier leur nommage.</p>
              <div class="table-container">
                <table>
                  <thead><tr><th>Nom du Livreur</th><th>Dépôt(s) d'apparition</th></tr></thead>
                  <tbody>
                    ${unassignedDrivers.map(s => `
                      <tr><td>${s.driver}</td><td>${s.depots}</td></tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          ` : ''}

          <div class="footer">
            <p>Cordialement,</p>
            <p>L'équipe Analyse de Données</p>
            <p>&copy; ${new Date().getFullYear()} Votre Entreprise. Tous droits réservés.</p>
          </div>
        </div>
      </body>
    </html>
  `;
  return body;
};

const QualityEmailGenerator = ({ summaryByDepot, summaryByCarrier, summaryByDriver, unassignedDrivers }: QualityEmailGeneratorProps) => {

  const handleSendEmail = () => {
    const subject = "Rapport de Synthèse de la Qualité (Focus sur les Mauvaises Notes)";
    const body = generateQualityEmailBody(summaryByDepot, summaryByCarrier, summaryByDriver, unassignedDrivers);
    
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
          dangerouslySetInnerHTML={{ __html: generateQualityEmailBody(summaryByDepot, summaryByCarrier, summaryByDriver, unassignedDrivers) }}
        />
        <DialogFooter>
          <Button onClick={handleSendEmail}>Envoyer l'Email</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default QualityEmailGenerator;
