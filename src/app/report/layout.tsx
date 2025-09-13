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
      <head>
        {/* Les liens de polices sont déjà dans le layout principal, pas besoin de les répéter */}
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
      </head>
      {/* Le <body> est déjà fourni par le layout racine, on injecte juste le contenu */}
      {children}
    </>
  );
}
