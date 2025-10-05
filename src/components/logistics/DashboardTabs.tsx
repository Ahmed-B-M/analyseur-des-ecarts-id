'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { DateRangePicker } from './DateRangePicker';
import { BarChart2, Calendar, List, LayoutDashboard, TrendingUp, MessageCircleWarning, FileSpreadsheet, StarOff, Settings, ShieldCheck, MessageSquare, ClipboardCheck, FileText } from 'lucide-react';
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
import type { AnalysisData, MergedData } from '@/lib/types';
import DepotConfigurator from './DepotConfigurator';
import CommentProcessing from './CommentProcessing';
import { Badge } from '@/components/ui/badge';
import ActionFollowUpView from './ActionFollowUpView';

// Define a type for the processed actions for clarity
interface ProcessedAction {
  id: string;
  category: string;
  action: string;
}

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
    const [processedActions, setProcessedActions] = useState<ProcessedAction[]>([]);

    const handleCommentProcessed = (action: ProcessedAction) => {
        // Add the new action and prevent duplicates
        if (!processedActions.find(p => p.id === action.id)) {
            setProcessedActions(prev => [...prev, action]);
        }
    };

    const processedCommentIds = processedActions.map(p => p.id);

    const chartData = analysisData ? (analysisData.postalCodeStats || []).map(item => ({
        codePostal: item.codePostal,
        entrepot: item.entrepot,
        totalLivraisons: item.totalLivraisons,
        retardPercent: parseFloat(item.livraisonsRetard.slice(0, -1)),
    })) : [];

    const unprocessedCommentsCount = filteredData.filter(d => {
        const commentId = `${d.tourneeUniqueId}-${d.sequence || d.ordre}`; // Consistent ID generation
        return d.commentaire && d.notation != null && d.notation <= 3 && !processedCommentIds.includes(commentId);
    }).length;

    return (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="space-y-2">
                <TabsList>
                    <TabsTrigger value="dashboard"><BarChart2 className="w-4 h-4 mr-2" />Tableau de Bord</TabsTrigger>
                    <TabsTrigger value="comparison"><TrendingUp className="w-4 h-4 mr-2" />Analyse Comparative</TabsTrigger>
                    <TabsTrigger value="depotComparison"><LayoutDashboard className="w-4 h-4 mr-2" />Comparaison Dépôts</TabsTrigger>
                    <TabsTrigger value="negativeComments"><MessageCircleWarning className="w-4 h-4 mr-2" />Avis Négatifs</TabsTrigger>
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

            {/* TabsContent remains the same, but props passed to children will be updated */}
             <TabsContent value="actionFollowUp" className="mt-6">
                <ActionFollowUpView />
            </TabsContent>
            <TabsContent value="reportRD" className="mt-6 space-y-6">
                <GlobalCommentView data={filteredData} processedActions={processedActions} /> 
                <HotZonesChart data={chartData} />
                <DepotAnalysisTable data={analysisData.warehouseStats} />
                <PostalCodeTable data={analysisData.postalCodeStats} />
            </TabsContent>
            <TabsContent value="commentProcessing" className="mt-6">
                <CommentProcessing 
                    data={filteredData} 
                    onCommentProcessed={handleCommentProcessed}
                    processedCommentIds={processedCommentIds}
                />
            </TabsContent>
            
            {/* Other TabsContent sections */}
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
                <NegativeCommentsTable data={filteredData} />
            </TabsContent>
            <TabsContent value="negativeRatings" className="mt-6">
                <NegativeRatingsSummary data={filteredData} />
            </TabsContent>
            <TabsContent value="quality" className="mt-6">
                <QualitySummary data={filteredData} />
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
