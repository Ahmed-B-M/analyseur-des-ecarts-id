
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
import type { DepotStats, PostalCodeStats, SuiviCommentaire } from '@/lib/types';
import { commentCategories, CategorizedComment } from '@/lib/comment-categorization';
import { Mail } from 'lucide-react';

interface EmailGeneratorProps {
  depotStats: DepotStats[];
  postalCodeStats: PostalCodeStats[];
  globalCommentData: {
    processedActions: SuiviCommentaire[];
    categorizedComments: (CategorizedComment | { id: string; comment: string; category: string })[];
  };
}

const generateEmailBody = (
  depotStats: DepotStats[],
  postalCodeStats: PostalCodeStats[],
  globalCommentData: EmailGeneratorProps['globalCommentData']
) => {
    const { processedActions, categorizedComments } = globalCommentData;

    // Recalculate comment stats for the email body
    const categoryCounts = commentCategories.reduce((acc, category) => {
        acc[category] = 0;
        return acc;
    }, {} as Record<string, number>);
    
    let totalCategorized = 0;
    categorizedComments.forEach(item => {
        const category = item.category;
        if (categoryCounts.hasOwnProperty(category)) {
            categoryCounts[category]++;
            totalCategorized++;
        }
    });

    const categoryPercentages = Object.entries(categoryCounts).map(([category, count]) => ({
        category,
        percentage: totalCategorized > 0 ? ((count / totalCategorized) * 100).toFixed(2) + '%' : '0.00%',
    })).sort((a, b) => parseFloat(b.percentage) - parseFloat(a.percentage));
    
    const actionsByCategory = (processedActions || []).reduce((acc, { categorie, actionCorrective }) => {
        if (!acc[categorie]) acc[categorie] = [];
        if (!acc[categorie].includes(actionCorrective)) acc[categorie].push(actionCorrective);
        return acc;
    }, {} as Record<string, string[]>);


  let body = `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 20px; }
          h1, h2, h3 { color: #00338D; }
          h1 { border-bottom: 2px solid #00338D; padding-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; white-space: nowrap; }
          th { background-color: #f2f2f2; font-weight: bold; }
          .card { border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .table-container { overflow-x: auto; }
          ul { padding-left: 20px; }
        </style>
      </head>
      <body>
        <h1>Rapport d'Analyse des Écarts Logistiques</h1>
        <p>Bonjour,</p>
        <p>Veuillez trouver ci-dessous un résumé de l'analyse pour la période et les filtres sélectionnés.</p>
        
        <div class="card">
          <h2>Synthèse Globale des Avis Négatifs</h2>
          <div class="table-container">
            <table>
              <thead><tr><th>Catégorie de Commentaire</th><th>Pourcentage</th><th>Actions Correctives Traitées</th></tr></thead>
              <tbody>
                ${categoryPercentages.map(({ category, percentage }) => `
                  <tr>
                    <td>${category}</td>
                    <td>${percentage}</td>
                    <td>
                      ${(actionsByCategory[category] && actionsByCategory[category].length > 0)
                          ? `<ul>${actionsByCategory[category].map(action => `<li>${action}</li>`).join('')}</ul>`
                          : `<span style="color: #888;">Aucune action</span>`
                      }
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <h2>Analyse Détaillée des Entrepôts</h2>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Entrepôt</th>
                  <th>Ponctualité Prév.</th>
                  <th>Ponctualité Réalisée</th>
                  <th>% Tournées Départ à l'heure / Arrivée en retard</th>
                  <th>% Tournées Départ OK / Retard Liv. &gt; 15min</th>
                  <th>Note Moyenne</th>
                  <th>% Dépassement Poids</th>
                  <th>Créneau le plus choisi</th>
                  <th>Créneau le plus en retard</th>
                  <th>Intensité Travail Planifié</th>
                  <th>Intensité Travail Réalisé</th>
                  <th>Créneau le plus intense</th>
                  <th>Créneau le moins intense</th>
                </tr>
              </thead>
              <tbody>
                ${depotStats.map(stat => `
                  <tr>
                    <td>${stat.entrepot}</td>
                    <td>${stat.ponctualitePrev}</td>
                    <td>${stat.ponctualiteRealisee}</td>
                    <td>${stat.tourneesPartiesHeureRetard}</td>
                    <td>${stat.tourneesRetardAccumule}</td>
                    <td>${stat.noteMoyenne}</td>
                    <td>${stat.depassementPoids}</td>
                    <td>${stat.creneauLePlusChoisi}</td>
                    <td>${stat.creneauLePlusEnRetard}</td>
                    <td>${stat.intensiteTravailPlanifie}</td>
                    <td>${stat.intensiteTravailRealise}</td>
                    <td>${stat.creneauPlusIntense}</td>
                    <td>${stat.creneauMoinsIntense}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
        
        <div class="card">
          <h2>Classement des Codes Postaux par Retards (Top 20%)</h2>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Code Postal</th>
                  <th>Entrepôt</th>
                  <th>Nb. Livraisons</th>
                  <th>% Livraisons en Retard</th>
                </tr>
              </thead>
              <tbody>
                ${postalCodeStats.map(stat => `
                  <tr>
                    <td>${stat.codePostal}</td>
                    <td>${stat.entrepot}</td>
                    <td>${stat.totalLivraisons}</td>
                    <td>${stat.livraisonsRetard}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <p>Cordialement,</p>
        <p>L'équipe Analyse de Données</p>
      </body>
    </html>
  `;

  return body;
};


const EmailGenerator = ({ depotStats, postalCodeStats, globalCommentData }: EmailGeneratorProps) => {

  const handleSendEmail = () => {
    const subject = "Rapport d'Analyse des Écarts Logistiques";
    const body = generateEmailBody(depotStats, postalCodeStats, globalCommentData);
    
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
            <Mail className="mr-2 h-4 w-4" />
            Générer l'Email du Rapport
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle>Aperçu de l'Email du Rapport</DialogTitle>
        </DialogHeader>
        <div 
          className="max-h-[70vh] overflow-y-auto p-4 border rounded-md"
          dangerouslySetInnerHTML={{ __html: generateEmailBody(depotStats, postalCodeStats, globalCommentData) }}
        />
        <DialogFooter>
          <Button onClick={handleSendEmail}>Envoyer l'Email</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EmailGenerator;
