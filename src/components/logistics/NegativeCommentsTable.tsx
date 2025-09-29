
'use client';

import { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, ChevronLeft, ChevronRight, MessageCircleWarning, Sparkles, Loader2, Info } from 'lucide-react';
import type { MergedData } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { useToast } from '@/hooks/use-toast';
import { analyzeNegativeComments } from '@/actions/comments';
import { Badge } from '../ui/badge';


const ITEMS_PER_PAGE = 25;

type SortKey = keyof MergedData | `tournee.${keyof NonNullable<MergedData['tournee']>}`;


const CategoryKeywordTable = ({ data, aiCategorizedData }: { data: Record<string, number>, aiCategorizedData: Record<string, number> | null }) => {
    const displayData = aiCategorizedData || data;
    const total = Object.values(displayData).reduce((a, b) => a + b, 0);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Catégorisation des Commentaires</CardTitle>
                <CardDescription>
                    {aiCategorizedData ? "Résultats de l'analyse IA." : "Estimations basées sur des mots-clés."}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Catégorie</TableHead>
                            <TableHead className="text-right">Nombre</TableHead>
                            <TableHead className="text-right">%</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {Object.entries(displayData).map(([category, count]) => (
                            <TableRow key={category}>
                                <TableCell className="font-medium capitalize">{category}</TableCell>
                                <TableCell className="text-right">{count}</TableCell>
                                <TableCell className="text-right">{total > 0 ? ((count / total) * 100).toFixed(1) : 0}%</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
};


export default function NegativeCommentsTable({ data }: { data: MergedData[] }) {
    const { toast } = useToast();
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [aiCategorizedData, setAiCategorizedData] = useState<Record<string, number> | null>(null);

    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>({ key: 'notation', direction: 'asc' });

    const negativeCommentsData = useMemo(() => {
        return data.filter(item => item.notation != null && item.notation <= 3 && item.commentaire);
    }, [data]);

    const filteredData = useMemo(() => {
        return negativeCommentsData.filter(item => {
            const search = searchTerm.toLowerCase();
            return (
                item.nomTournee?.toLowerCase().includes(search) ||
                item.livreur?.toLowerCase().includes(search) ||
                item.ville?.toLowerCase().includes(search) ||
                item.codePostal?.toLowerCase().includes(search) ||
                item.date?.toLowerCase().includes(search) ||
                item.entrepot?.toLowerCase().includes(search) ||
                item.commentaire?.toLowerCase().includes(search)
            );
        });
    }, [negativeCommentsData, searchTerm]);

    const sortedData = useMemo(() => {
        if (!sortConfig) return filteredData;

        return [...filteredData].sort((a, b) => {
            let aValue: any, bValue: any;
            if (sortConfig.key.startsWith('tournee.')) {
                const subKey = sortConfig.key.split('.')[1] as keyof NonNullable<MergedData['tournee']>;
                aValue = a.tournee?.[subKey];
                bValue = b.tournee?.[subKey];
            } else {
                aValue = a[sortConfig.key as keyof MergedData];
                bValue = b[sortConfig.key as keyof MergedData];
            }

            if (aValue == null) return 1;
            if (bValue == null) return -1;
            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredData, sortConfig]);

    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        const end = start + ITEMS_PER_PAGE;
        return sortedData.slice(start, end);
    }, [sortedData, currentPage]);

    const totalPages = Math.ceil(sortedData.length / ITEMS_PER_PAGE);

    const handleSort = (key: SortKey) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
        setCurrentPage(1);
    };

    const renderSortIcon = (key: SortKey) => {
        if (!sortConfig || sortConfig.key !== key) {
            return <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />;
        }
        return sortConfig.direction === 'asc' ? '▲' : '▼';
    }

    const keywordCategorization = useMemo(() => {
        const categories: Record<string, number> = { 'Retard': 0, 'Avance': 0, 'Qualité Produit': 0, 'Comportement Livreur': 0, 'Autre': 0 };
        const keywords = {
            'Retard': ['retard', 'tard', 'attendu', 'pas arrivé', 'en retard'],
            'Avance': ['avance', 'tôt', 'trop tôt', 'pas prêt'],
            'Qualité Produit': ['manquant', 'abimé', 'cassé', 'frais', 'produit', 'qualité'],
            'Comportement Livreur': ['livreur', 'comportement', 'aimable', 'désagréable', 'poli'],
        };

        negativeCommentsData.forEach(item => {
            const comment = item.commentaire!.toLowerCase();
            let found = false;
            for (const [category, words] of Object.entries(keywords)) {
                if (words.some(word => comment.includes(word))) {
                    categories[category]++;
                    found = true;
                    break;
                }
            }
            if (!found) categories['Autre']++;
        });
        return categories;
    }, [negativeCommentsData]);

    const handleAiAnalysis = async () => {
        if (negativeCommentsData.length === 0) return;
        setIsAnalyzing(true);
        try {
            const commentsToAnalyze = negativeCommentsData.map(item => ({ id: `${item.tourneeUniqueId}-${item.sequence}`, text: item.commentaire || '' }));
            const results = await analyzeNegativeComments(commentsToAnalyze);

            const breakdown = results.reduce((acc, result) => {
                const category = result.category || 'Autre';
                acc[category] = (acc[category] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

            setAiCategorizedData(breakdown);
            toast({
                title: "Analyse IA terminée",
                description: `${commentsToAnalyze.length} commentaires ont été catégorisés.`,
            });

        } catch (error) {
            console.error("AI Analysis failed:", error);
            toast({
                variant: "destructive",
                title: "Erreur d'analyse IA",
                description: "La catégorisation des commentaires a échoué. Veuillez réessayer.",
            });
        } finally {
            setIsAnalyzing(false);
        }
    };


    if (data.length === 0) {
        return (
             <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <MessageCircleWarning />
                        Liste des Avis Négatifs (Note ≤ 3)
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center justify-center text-center p-8 bg-card rounded-lg border">
                        <Info className="w-12 h-12 text-muted-foreground mb-4" />
                        <h3 className="text-xl font-semibold">Aucune donnée à afficher</h3>
                        <p className="text-muted-foreground mt-1">Aucune donnée n'est disponible. Veuillez vérifier les fichiers importés.</p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <MessageCircleWarning />
                            <span>Liste des Avis Négatifs (Note ≤ 3) - {negativeCommentsData.length} commentaire(s) trouvé(s)</span>
                        </div>
                        <Button onClick={handleAiAnalysis} disabled={isAnalyzing || negativeCommentsData.length === 0}>
                            {isAnalyzing ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analyse en cours...</>
                            ) : (
                                <><Sparkles className="mr-2 h-4 w-4" />Analyser avec l'IA</>
                            )}
                        </Button>
                    </CardTitle>
                    <CardDescription>
                        Explorez les commentaires des clients ayant donné une note de 3 ou moins. Utilisez l'analyse IA pour une catégorisation automatique.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                     <div className="grid md:grid-cols-3 gap-6">
                        <div className="md:col-span-1">
                             <CategoryKeywordTable data={keywordCategorization} aiCategorizedData={aiCategorizedData} />
                        </div>
                        <div className="md:col-span-2 space-y-4">
                            <Input
                                placeholder="Rechercher un commentaire, un livreur, une ville..."
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                className="max-w-md"
                            />
                            <div className="rounded-md border h-[400px] overflow-y-auto relative">
                                <Table>
                                    <TableHeader className="sticky top-0 bg-secondary">
                                        <TableRow>
                                            <TableHead onClick={() => handleSort('date')} className="cursor-pointer">Date {renderSortIcon('date')}</TableHead>
                                            <TableHead onClick={() => handleSort('livreur')} className="cursor-pointer">Livreur {renderSortIcon('livreur')}</TableHead>
                                            <TableHead onClick={() => handleSort('ville')} className="cursor-pointer">Ville {renderSortIcon('ville')}</TableHead>
                                            <TableHead onClick={() => handleSort('notation')} className="cursor-pointer">Note {renderSortIcon('notation')}</TableHead>
                                            <TableHead>Commentaire</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {paginatedData.length > 0 ? paginatedData.map((item, index) => (
                                            <TableRow key={`${item.tourneeUniqueId}-${item.sequence}-${index}`}>
                                                <TableCell>{item.date}</TableCell>
                                                <TableCell>{item.livreur}</TableCell>
                                                <TableCell>{item.ville}, {item.codePostal}</TableCell>
                                                <TableCell>
                                                    <Badge variant={item.notation === 3 ? "secondary" : "destructive"}>
                                                        {item.notation}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="max-w-sm whitespace-pre-wrap">{item.commentaire}</TableCell>
                                            </TableRow>
                                        )) : (
                                            <TableRow><TableCell colSpan={5} className="text-center h-24">Aucun commentaire négatif trouvé pour les filtres actuels.</TableCell></TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                            {totalPages > 1 && <div className="flex items-center justify-between">
                                <div className="text-sm text-muted-foreground">
                                    Page {currentPage} sur {totalPages} ({sortedData.length} résultats)
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4" /> Précédent</Button>
                                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages}>Suivant <ChevronRight className="h-4 w-4" /></Button>
                                </div>
                            </div>}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}


    