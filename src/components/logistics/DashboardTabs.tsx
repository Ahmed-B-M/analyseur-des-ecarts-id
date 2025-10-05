
'use client';

import { useState, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { DateRangePicker } from './DateRangePicker';
import { BarChart2, Calendar, List, LayoutDashboard, TrendingUp, MessageCircleWarning, FileSpreadsheet, StarOff, Settings, ShieldCheck, MessageSquare, ClipboardCheck, FileText, Tags } from 'lucide-react';
import AnalysisDashboard from './AnalysisDashboard';
import DetailedDataView from './DetailedDataView';
import CalendarView from './CalendarView';
import ComparisonView from './ComparisonView';
import DepotComparison from './DepotComparison';
import NegativeCommentsTable from './NegativeCommentsTable';
import NegativeRatingsSummary from './NegativeRatingsSummary';
import QualitySummary from './QualitySummary';
import HotZonesChart from './HotZonesChart';
import DepotAnalysisTable from './DepotAnalysisTable';
import PostalCodeTable from './PostalCodeTable';
import SlotAnalysisChart from './SlotAnalysisChart';
import GlobalCommentView from './GlobalCommentView';
import type { AnalysisData, MergedData, SuiviCommentaire } from '@/lib/types';
import DepotConfigurator from './DepotConfigurator';
import CommentProcessing from './CommentProcessing';
import { Badge } from '@/components/ui/badge';
import ActionFollowUpView from './ActionFollowUpView';
import { useCollection, useMemoFirebase } from '@/firebase';
import { useFirestore } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { SuiviCommentaireWithId } from './ActionFollowUpView';
import { CategorizedComment } from './CommentCategorizationTable';
import CommentCategorizationView from './CommentCategorizationView';


interface DashboardTabsProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
    analysisData: AnalysisData;
    filteredData: MergedData[];
    rawData: MergedData[];
    filters: Record<string, any>;
    setFilters: (filters: Record<string, any>) => void;
    applyFilterAndSwitchTab: (filter: Record<string, any>) => void;
}

export default function DashboardTabs({
    activeTab,
    setActiveTab,
    analysisData,
    filteredData,
    rawData,
    filters,
    setFilters,
    applyFilterAndSwitchTab
}: DashboardTabsProps) {

    const firestore = useFirestore();

    const suiviCollectionRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'suiviCommentaires');
    }, [firestore]);

    const categorizedCommentsCollectionRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'commentCategories');
    }, [firestore]);

    const { data: existingSuivis, isLoading: isLoadingSuivis } = useCollection<SuiviCommentaireWithId>(suiviCollectionRef);
    const { data: savedCategorizedComments, isLoading: isLoadingCategories } = useCollection<CategorizedComment>(categorizedCommentsCollectionRef);

    const processedCommentIds = useMemo(() => {
        if (!existingSuivis) return new Set();
        return new Set(existingSuivis.map(s => `${s.nomTournee}|${s.date}|${s.entrepot}-${s.sequence}`));
    }, [existingSuivis]);

    const chartData = analysisData ? (analysisData.postalCodeStats || []).map(item => ({
        codePostal: item.codePostal,
        entrepot: item.entrepot,
        totalLivraisons: item.totalLivraisons,
        retardPercent: parseFloat(item.livraisonsRetard.slice(0, -1)),
    })) : [];

    const unprocessedCommentsCount = useMemo(() => {
        if (isLoadingSuivis) return 0; // Don't count until we know what's processed
        return filteredData.filter(d => {
            const commentId = `${d.nomTournee}|${d.date}|${d.entrepot}-${d.sequence || d.ordre}`;
            return d.commentaire && d.notation != null && d.notation <= 3 && !processedCommentIds.has(commentId);
        }).length;
    }, [filteredData, processedCommentIds, isLoadingSuivis]);
    
    const uncategorizedCommentsCount = useMemo(() => {
        if (isLoadingCategories) return 0;
        const savedIds = new Set(savedCategorizedComments?.map(c => c.id) || []);
        return filteredData.filter(d => 
            d.notation != null && d.notation <= 3 && d.commentaire && !savedIds.has(`${d.nomTournee}|${d.date}|${d.entrepot}-${d.sequence || d.ordre}`)
        ).length;
    }, [filteredData, savedCategorizedComments, isLoadingCategories]);

    return (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="space-y-2">
                <TabsList>
                    <TabsTrigger value="dashboard"><BarChart2 className="w-4 h-4 mr-2" />Tableau de Bord</TabsTrigger>
                    <TabsTrigger value="comparison"><TrendingUp className="w-4 h-4 mr-2" />Analyse Comparative</TabsTrigger>
                    <TabsTrigger value="depotComparison"><LayoutDashboard className="w-4 h-4 mr-2" />Comparaison Dépôts</TabsTrigger>
                     <TabsTrigger value="negativeComments">
                        <MessageCircleWarning className="w-4 h-4 mr-2" />
                        Catégoriser Avis
                        {uncategorizedCommentsCount > 0 && <Badge className="ml-2">{uncategorizedCommentsCount}</Badge>}
                    </TabsTrigger>
                    <TabsTrigger value="allCategories"><Tags className="w-4 h-4 mr-2" />Toutes les catégories</TabsTrigger>
                    <TabsTrigger value="negativeRatings"><StarOff className="w-4 h-4 mr-2" />Notes Négatives</TabsTrigger>
                    <TabsTrigger value="quality"><ShieldCheck className="w-4 h-4 mr-2" />Synthèse Qualité</TabsTrigger>
                </TabsList>
                 <TabsList>
                    <TabsTrigger value="commentProcessing">
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Traitement Avis
                        {unprocessedCommentsCount > 0 && <Badge className="ml-2">{unprocessedCommentsCount}</Badge>}
                    </TabsTrigger>
                    <TabsTrigger value="actionFollowUp"><ClipboardCheck className="w-4 h-4 mr-2" />Suivi Actions</TabsTrigger>
                    <TabsTrigger value="calendar"><Calendar className="w-4 h-4 mr-2" />Analyse par Période</TabsTrigger>
                    <TabsTrigger value="data"><List className="w-4 h-4 mr-2" />Données Détaillées</TabsTrigger>
                    <TabsTrigger value="rdp"><LayoutDashboard className="w-4 h-4 mr-2" />RDP</TabsTrigger>
                    <TabsTrigger value="reportRD"><FileText className="w-4 h-4 mr-2" />Rapport RD</TabsTrigger>
                    <TabsTrigger value="settings"><Settings className="w-4 h-4 mr-2" />Paramètres</TabsTrigger>
                </TabsList>
            </div>

             <TabsContent value="actionFollowUp" className="mt-6">
                <ActionFollowUpView />
            </TabsContent>
            <TabsContent value="reportRD" className="mt-6 space-y-6">
                <GlobalCommentView data={filteredData} processedActions={existingSuivis || []} categorizedComments={savedCategorizedComments || []} />
                <HotZonesChart data={chartData} />
                <DepotAnalysisTable data={analysisData.warehouseStats} />
                <PostalCodeTable data={analysisData.postalCodeStats} />
            </TabsContent>
            <TabsContent value="commentProcessing" className="mt-6">
                <CommentProcessing 
                    data={filteredData} 
                />
            </TabsContent>
            
            <TabsContent value="dashboard" className="mt-6">
                <AnalysisDashboard 
                    analysisData={analysisData}
                    onFilterAndSwitch={applyFilterAndSwitchTab}
                />
            </TabsContent>
            <TabsContent value="comparison" className="mt-6">
                <ComparisonView
                    allData={filteredData}
                    filters={filters}
                />
            </TabsContent>
            <TabsContent value="depotComparison" className="mt-6">
                <DepotComparison
                    allData={filteredData}
                    filters={filters}
                    depots={analysisData.depots}
                />
            </TabsContent>
            <TabsContent value="negativeComments" className="mt-6">
                <NegativeCommentsTable data={filteredData} savedCategorizedComments={savedCategorizedComments || []} />
            </TabsContent>
            <TabsContent value="allCategories" className="mt-6">
                <CommentCategorizationView />
            </TabsContent>
            <TabsContent value="negativeRatings" className="mt-6">
                <NegativeRatingsSummary data={filteredData} />
            </TabsContent>
            <TabsContent value="quality" className="mt-6">
                <QualitySummary data={filteredData} processedActions={existingSuivis || []} categorizedComments={savedCategorizedComments || []} />
            </TabsContent>
            <TabsContent value="calendar" className="mt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-1">
                            <CalendarView 
                            data={rawData}
                            onDateSelect={(date) => {
                                setFilters({ ...filters, selectedDate: date, dateRange: undefined });
                            }}
                            onWeekSelect={(week) => {}}
                        />
                    </div>
                    <div className="md:col-span-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Analyse par Période Personnalisée</CardTitle>
                                <CardDescription>
                                Sélectionnez une plage de dates pour mettre à jour l'ensemble du tableau de bord.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <DateRangePicker 
                                    className="max-w-sm"
                                    onDateChange={(range) => setFilters({ ...filters, dateRange: range, selectedDate: undefined })}
                                    date={filters.dateRange}
                                />
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </TabsContent>
            <TabsContent value="data" className="mt-6">
                <DetailedDataView data={filteredData} />
            </TabsContent>
            <TabsContent value="rdp" className="mt-6 space-y-6">
                <HotZonesChart data={chartData} />
                <DepotAnalysisTable data={analysisData.depotStats} />
                <PostalCodeTable data={analysisData.postalCodeStats} />
                <SlotAnalysisChart data={filteredData} />
            </TabsContent>
            <TabsContent value="settings" className="mt-6">
                <DepotConfigurator />
            </TabsContent>
        </Tabs>
    )
}
