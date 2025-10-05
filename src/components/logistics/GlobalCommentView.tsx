
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { MergedData, SuiviCommentaire } from '@/lib/types';
import { categorizeComment, commentCategories } from '@/lib/comment-categorization';

interface GlobalCommentViewProps {
    data: MergedData[];
    processedActions: SuiviCommentaire[];
}

const GlobalCommentView: React.FC<GlobalCommentViewProps> = ({ data, processedActions }) => {
    const negativeComments = data.filter(item => item.commentaire && item.notation != null && item.notation <= 3);

    const categoryCounts = commentCategories.reduce((acc, category) => {
        acc[category] = 0;
        return acc;
    }, {} as Record<string, number>);
    
    let totalCategorized = 0;
    negativeComments.forEach(item => {
        const category = categorizeComment(item.commentaire);
        if (categoryCounts.hasOwnProperty(category)) {
            categoryCounts[category]++;
            totalCategorized++;
        }
    });

    const categoryPercentages = Object.entries(categoryCounts).map(([category, count]) => ({
        category,
        percentage: totalCategorized > 0 ? ((count / totalCategorized) * 100).toFixed(2) + '%' : '0.00%',
    })).sort((a, b) => {
        const percentageA = parseFloat(a.percentage);
        const percentageB = parseFloat(b.percentage);
        return percentageB - percentageA;
    });

    const actionsByCategory = (processedActions || []).reduce((acc, { categorie, actionCorrective }) => {
        if (!acc[categorie]) {
            acc[categorie] = [];
        }
        // Avoid duplicate actions for the same category
        if (!acc[categorie].includes(actionCorrective)) {
            acc[categorie].push(actionCorrective);
        }
        return acc;
    }, {} as Record<string, string[]>);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Synthèse Globale des Avis Négatifs</CardTitle>
                <CardDescription>
                    Répartition des catégories de commentaires et actions correctives mises en place.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Catégorie de Commentaire</TableHead>
                            <TableHead>Pourcentage</TableHead>
                            <TableHead>Actions Correctives Traitées</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {categoryPercentages.map(({ category, percentage }) => (
                            <TableRow key={category}>
                                <TableCell>{category}</TableCell>
                                <TableCell>{percentage}</TableCell>
                                <TableCell>
                                    {actionsByCategory[category] && actionsByCategory[category].length > 0 ? (
                                        <ul className="list-disc pl-5">
                                            {actionsByCategory[category].map((action, index) => (
                                                <li key={index}>{action}</li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <span className="text-gray-500">Aucune action traitée</span>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
};

export default GlobalCommentView;
