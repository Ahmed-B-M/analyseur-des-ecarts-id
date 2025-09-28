
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Rapport RD',
    description: 'Rapport RD pour l\'analyse des performances des dépôts et des livraisons par code postal.',
};

export default function RapportRDLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <div className="container mx-auto p-4">{children}</div>;
}
