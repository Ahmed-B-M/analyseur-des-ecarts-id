
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'RDP',
    description: 'Tableaux de bord pour l"analyse des performances des dépôts et des livraisons par code postal.',
};

export default function DepotAnalysisLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <div className="container mx-auto p-4">{children}</div>;
}
