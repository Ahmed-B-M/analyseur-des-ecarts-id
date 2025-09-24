
'use client';

import { useLogistics } from '@/context/LogisticsContext';
import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Printer } from 'lucide-react';
import HotZonesChart from '@/components/logistics/HotZonesChart';
import DepotAnalysisTable from '@/components/logistics/DepotAnalysisTable';
import PostalCodeTable from '@/components/logistics/PostalCodeTable';
import './report.css'; 
import { MergedData } from '@/lib/types';

export default function ReportPage() {
    const { mergedData, state } = useLogistics();
    const router = useRouter();

    const postalCodeData = useMemo(() => {
        if (!mergedData) return [];
        // This calculation should ideally be in a shared utility function
        const stats = calculatePostalCodeStats(mergedData, state.filters.punctualityThreshold);
        return stats.map(d => ({
            ...d,
            retardPercent: parseFloat(d.livraisonsRetard.slice(0, -1))
        }));
    }, [mergedData, state.filters.punctualityThreshold]);

    if (!mergedData || mergedData.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
                <p className="text-lg text-gray-600 mb-4">Aucune donnée à afficher. Veuillez d'abord charger un fichier.</p>
                <button onClick={() => router.push('/')} className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Retour à l'accueil
                </button>
            </div>
        );
    }
    
    // Dummy calculation for postal code stats to avoid breaking the component
    // This should be replaced by the actual calculation logic if you move it here
     function calculatePostalCodeStats(data: MergedData[], tolerance: number) {
        // This is a placeholder. In a real app, you'd share this logic.
        const stats: Record<string, { total: number, late: number, depot: string }> = {};
         data.forEach(item => {
             if (item.codePostal && item.tournee) {
                 if (!stats[item.codePostal]) {
                     stats[item.codePostal] = { total: 0, late: 0, depot: item.tournee.entrepot };
                 }
                 stats[item.codePostal].total++;
                 if (item.heureArriveeReelle > (item.heureFinCreneau + tolerance * 60)) {
                     stats[item.codePostal].late++;
                 }
             }
         });
         return Object.entries(stats).map(([codePostal, s]) => ({
             codePostal,
             entrepot: s.depot,
             totalLivraisons: s.total,
             livraisonsRetard: s.total > 0 ? ((s.late / s.total) * 100).toFixed(2) + '%' : '0.00%',
         }));
     }


    return (
        <>
            <div className="no-print p-4 bg-gray-800 text-white flex justify-between items-center sticky top-0 z-50">
                <div>
                    <button onClick={() => router.back()} className="flex items-center px-4 py-2 bg-gray-600 rounded-md hover:bg-gray-700">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Retour
                    </button>
                </div>
                <h2 className="text-xl font-semibold">Aperçu du Rapport</h2>
                <div>
                    <button onClick={() => window.print()} className="flex items-center px-4 py-2 bg-blue-500 rounded-md hover:bg-blue-600">
                        <Printer className="mr-2 h-4 w-4" />
                        Imprimer / Télécharger en PDF
                    </button>
                </div>
            </div>

            <div className="a4-page">
                <header className="report-header">
                    <h1>Rapport d'Analyse des Dépôts</h1>
                    <span>{new Date().toLocaleDateString('fr-FR')}</span>
                </header>

                <main>
                    <section className="report-section mb-8">
                         <HotZonesChart data={postalCodeData} />
                    </section>
                    
                    <section className="report-section mb-8">
                        <DepotAnalysisTable />
                    </section>

                    <section className="report-section">
                        <PostalCodeTable />
                    </section>
                </main>
                
                <footer className="report-footer">
                    Généré par A-E-L - Analyse des Écarts Logistiques
                </footer>
            </div>
        </>
    );
}
