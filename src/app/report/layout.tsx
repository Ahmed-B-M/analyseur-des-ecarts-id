import type {Metadata} from 'next';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Rapport d\'Analyse Logistique',
  description: 'Rapport d\'analyse de la performance logistique.',
};

export default function ReportLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      {/* Les styles d'impression sont placés ici pour être valides dans la structure HTML */}
      <style>
          {`
            @media print {
              body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .no-print {
                display: none !important;
              }
            }
          `}
      </style>
      {/* Le <body> est déjà fourni par le layout racine, on injecte juste le contenu */}
      {children}
    </>
  );
}
