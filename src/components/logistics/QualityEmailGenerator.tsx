
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
  let body = `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 20px; }
          h1, h2, h3 { color: #00338D; }
          h1 { border-bottom: 2px solid #00338D; padding-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; font-weight: bold; }
          .card { border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .table-container { overflow-x: auto; }
        </style>
      </head>
      <body>
        <h1>Rapport de Synthèse de la Qualité</h1>
        <p>Bonjour,</p>
        <p>Veuillez trouver ci-dessous les synthèses de la qualité basées sur les notes des clients pour la période sélectionnée.</p>
        
        <div class="card">
          <h2>Synthèse par Dépôt</h2>
          <div class="table-container">
            <table>
              <thead><tr><th>Dépôt</th><th>Nb. Mauvaises Notes</th><th>Note Moyenne (globale)</th><th>Nb. Commentaires</th></tr></thead>
              <tbody>
                ${summaryByDepot.map(s => `
                  <tr>
                    <td>${s.depot} (${s.totalRatings})</td>
                    <td>${s.negativeRatingsCount}</td>
                    <td>${s.averageRating}</td>
                    <td>${s.commentCount}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
        
        <div class="card">
          <h2>Synthèse par Transporteur</h2>
          <div class="table-container">
            <table>
              <thead><tr><th>Dépôt</th><th>Transporteur</th><th>Nb. Mauvaises Notes</th><th>Note Moyenne (globale)</th><th>Nb. Commentaires</th></tr></thead>
              <tbody>
                ${summaryByCarrier.map(s => `
                  <tr>
                    <td>${s.depot}</td>
                    <td>${s.carrier} (${s.totalRatings})</td>
                    <td>${s.negativeRatingsCount}</td>
                    <td>${s.averageRating}</td>
                    <td>${s.commentCount}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <h2>Détail par Livreur</h2>
          <div class="table-container">
            <table>
              <thead><tr><th>Dépôt</th><th>Transporteur</th><th>Livreur</th><th>Nb. Mauvaises Notes</th><th>Note Moyenne (globale)</th><th>Catégories de Commentaires</th></tr></thead>
              <tbody>
                ${summaryByDriver.map(s => `
                  <tr>
                    <td>${s.depot}</td>
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
        </div>

        ${unassignedDrivers.length > 0 ? `
          <div class="card">
            <h2>Livreurs sans Transporteur Assigné</h2>
            <div class="table-container">
              <table>
                <thead><tr><th>Nom du Livreur</th><th>Dépôt(s)</th></tr></thead>
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
    const subject = "Rapport de Synthèse de la Qualité";
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
