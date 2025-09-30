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
    const { state } = useLogistics();
    const router = useRouter();
    const { analysisData } = state;

    const postalCodeData = useMemo(() => {
        if (!analysisData) return [];
        return (analysisData.postalCodeStats || []).map(d => ({
            codePostal: d.codePostal,
            entrepot: d.entrepot,
            totalLivraisons: d.totalLivraisons,
            retardPercent: parseFloat(d.livraisonsRetard.slice(0, -1))
        }));
    }, [analysisData]);

    if (!analysisData) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-gray-100 no-print">
                <div className="bg-white p-8 rounded-lg shadow-md text-center">
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Données non disponibles</h2>
                    <p className="text-gray-600 mb-6">Il semble que les données n'ont pas été chargées. Veuillez retourner à l'accueil pour importer un fichier.</p>
                    <button onClick={() => router.push('/')} className="flex items-center justify-center w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Retour à l'accueil
                    </button>
                </div>
            </div>
        );
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

            <div className="report-container">
                <header className="report-header">
                    <h1 className="report-title">Rapport d'Analyse des Dépôts</h1>
                    <span className="text-gray-500">{new Date().toLocaleDateString('fr-FR')}</span>
                </header>

                <main>
                    <section className="report-section mb-8">
                         <h2 className="section-title">Zones de Retard par Codes Postaux</h2>
                         <HotZonesChart data={postalCodeData} />
                    </section>
                    
                    <section className="report-section mb-8 page-landscape">
                        <h2 className="section-title">Analyse Détaillée des Entrepôts</h2>
                        <DepotAnalysisTable data={analysisData.depotStats} />
                    </section>

                    <section className="report-section">
                        <h2 className="section-title">Classement des Codes Postaux par Retards</h2>
                        <PostalCodeTable data={analysisData.postalCodeStats} />
                    </section>
                </main>
                
                <footer className="report-footer mt-8 pt-4 border-t text-center text-gray-500">
                    Généré par A-E-L - Analyse des Écarts Logistiques
                </footer>
            </div>
        </>
    );
}
