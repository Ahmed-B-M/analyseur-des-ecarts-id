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
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
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
      <body className="font-body antialiased bg-background">
        {children}
      </body>
    </html>
  );
}
