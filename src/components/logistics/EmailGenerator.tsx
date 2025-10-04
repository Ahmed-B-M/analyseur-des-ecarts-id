
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
import { MergedData } from '@/lib/types';

interface EmailGeneratorProps {
  data: MergedData[];
  summaryByDepot: any[];
  summaryByCarrier: any[];
  summaryByDriver: any[];
  unassignedDrivers: any[];
}

const generateEmailBody = (
  summaryByDepot: any[],
  summaryByCarrier: any[],
  summaryByDriver: any[],
  unassignedDrivers: any[]
) => {
  let body = `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          h1, h2, h3 { color: #2c3e50; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          .card { border: 1px solid #ddd; border-radius: 5px; padding: 15px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .depot-section { margin-bottom: 30px; }
        </style>
      </head>
      <body>
        <h1>Rapport d'Analyse Qualité</h1>
        <p>Bonjour,</p>
        <p>Veuillez trouver ci-dessous le résumé de l'analyse qualité pour la période sélectionnée.</p>
  `;

  for (const depot of summaryByDepot) {
    body += `
      <div class="depot-section card">
        <h2>${depot.depot} - Note Moyenne: ${depot.averageRating}</h2>

        <h3>Synthèse par Transporteur</h3>
        <table>
          <thead><tr><th>Transporteur</th><th>Nb. Mauvaises Notes</th><th>Note Moyenne (globale)</th><th>Nb. Commentaires</th></tr></thead>
          <tbody>
            ${summaryByCarrier
              .filter(c => c.depot === depot.depot)
              .map(c => `<tr><td>${c.carrier} (${c.totalRatings})</td><td>${c.negativeRatingsCount}</td><td>${c.averageRating}</td><td>${c.commentCount}</td></tr>`)
              .join('')
            }
          </tbody>
        </table>

        <h3>Synthèse par Livreur</h3>
        <table>
          <thead><tr><th>Transporteur</th><th>Livreur</th><th>Nb. Mauvaises Notes</th><th>Note Moyenne</th><th>Catégories de Commentaires</th></tr></thead>
          <tbody>
            ${summaryByDriver
              .filter(d => d.depot === depot.depot)
              .map(d => `<tr><td>${d.carrier}</td><td>${d.driver} (${d.totalRatings})</td><td>${d.negativeRatingsCount}</td><td>${d.averageRating}</td><td>${d.categorySummary}</td></tr>`)
              .join('')
            }
          </tbody>
        </table>
      </div>
    `;
  }
  
    if (unassignedDrivers.length > 0) {
        body += `
            <div class="card">
                <h3>Livreurs sans transporteur assigné</h3>
                <table>
                    <thead><tr><th>Livreur</th><th>Dépôt(s)</th></tr></thead>
                    <tbody>
                        ${unassignedDrivers.map(d => `<tr><td>${d.driver}</td><td>${d.depots}</td></tr>`).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

  body += `
        <p>Cordialement,</p>
        <p>L'équipe Analyse de Données</p>
      </body>
    </html>
  `;

  return body;
};


const EmailGenerator = ({ data, summaryByDepot, summaryByCarrier, summaryByDriver, unassignedDrivers }: EmailGeneratorProps) => {

  const handleSendEmail = () => {
    const subject = "Rapport d'Analyse Qualité";
    const body = generateEmailBody(summaryByDepot, summaryByCarrier, summaryByDriver, unassignedDrivers);
    
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Générer l'Email du Rapport</Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Aperçu de l'Email du Rapport</DialogTitle>
        </DialogHeader>
        <div 
          className="max-h-[70vh] overflow-y-auto p-4 border rounded-md"
          dangerouslySetInnerHTML={{ __html: generateEmailBody(summaryByDepot, summaryByCarrier, summaryByDriver, unassignedDrivers) }}
        />
        <DialogFooter>
          <Button onClick={handleSendEmail}>Envoyer l'Email</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EmailGenerator;
