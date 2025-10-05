
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

const generateQualityEmailBody = ({ summaryByDepot, summaryByCarrier, summaryByDriver, unassignedDrivers }: QualityEmailGeneratorProps) => {
  const depots = summaryByDepot.map(s => s.depot);

  let depotSections = '';

  for (const depot of depots) {
    const depotSummary = summaryByDepot.find(s => s.depot === depot);
    const carriersForDepot = summaryByCarrier.filter(s => s.depot === depot && s.negativeRatingsCount > 0);
    const driversForDepot = summaryByDriver.filter(s => s.depot === depot && s.negativeRatingsCount > 0);

    if (depotSummary && depotSummary.negativeRatingsCount > 0) {
      depotSections += `
        <div class="card">
          <h2>Synthèse pour le Dépôt : ${depot}</h2>
          
          <!-- Depot Summary Card -->
          <div style="background-color: #f9f9f9; border: 1px solid #eee; border-radius: 5px; padding: 15px; margin-bottom: 20px;">
            <h3 style="margin-top: 0;">Indicateurs Clés</h3>
            <p><strong>Total des notes reçues :</strong> ${depotSummary?.totalRatings ?? 0}</p>
            <p><strong>Nombre de mauvaises notes (≤ 3) :</strong> ${depotSummary?.negativeRatingsCount ?? 0}</p>
            <p><strong>Note moyenne globale :</strong> ${depotSummary?.averageRating ?? 'N/A'}</p>
            <p><strong>Nombre de commentaires laissés :</strong> ${depotSummary?.commentCount ?? 0}</p>
          </div>

          <!-- Carrier Table -->
          ${carriersForDepot.length > 0 ? `
            <h3>Détail par Transporteur (avec mauvaises notes)</h3>
            <div class="table-container">
              <table>
                <thead><tr><th>Transporteur</th><th>Nb. Mauvaises Notes</th><th>Note Moyenne (globale)</th><th>Nb. Commentaires</th></tr></thead>
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
            <h3>Détail par Livreur (avec mauvaises notes)</h3>
            <div class="table-container">
              <table>
                <thead><tr><th>Transporteur</th><th>Livreur</th><th>Nb. Mauvaises Notes</th><th>Note Moyenne (globale)</th><th>Catégories de Commentaires</th></tr></thead>
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
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 20px; }
          h1, h2, h3 { color: #00338D; }
          h1 { border-bottom: 2px solid #00338D; padding-bottom: 10px; }
          h2 { border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-top: 25px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; font-weight: bold; }
          .card { border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); page-break-inside: avoid; }
          .table-container { overflow-x: auto; }
        </style>
      </head>
      <body>
        <h1>Rapport de Synthèse de la Qualité (Focus sur les Mauvaises Notes)</h1>
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

        <p>Cordialement,</p>
        <p>L'équipe Analyse de Données</p>
      </body>
    </html>
  `;
  return body;
};

const QualityEmailGenerator = (props: QualityEmailGeneratorProps) => {

  const handleSendEmail = () => {
    const subject = "Rapport de Synthèse de la Qualité (Focus sur les Mauvaises Notes)";
    const body = generateQualityEmailBody(props);
    
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
          dangerouslySetInnerHTML={{ __html: generateQualityEmailBody(props) }}
        />
        <DialogFooter>
          <Button onClick={handleSendEmail}>Envoyer l'Email</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default QualityEmailGenerator;
