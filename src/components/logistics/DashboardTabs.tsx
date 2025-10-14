'use client';

import { useState, useMemo, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { BarChart2, Calendar, List, LayoutDashboard, TrendingUp, MessageCircleWarning, FileSpreadsheet, StarOff, Settings, ShieldCheck, MessageSquare, ClipboardCheck, FileText, Tags, Mail, HeartPulse } from 'lucide-react';
import AnalysisDashboard from './AnalysisDashboard';
import DetailedDataView from './DetailedDataView';
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
import type { AnalysisData, MergedData, SuiviCommentaire, WeeklyAnalysis } from '@/lib/types';
import DepotConfigurator from './DepotConfigurator';
import CommentProcessing from './CommentProcessing';
import { Badge } from '@/components/ui/badge';
import ActionFollowUpView from './ActionFollowUpView';
import { useCollection, useMemoFirebase } from '@/firebase';
import { useFirestore } from '@/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import type { SuiviCommentaireWithId } from './ActionFollowUpView';
import { CategorizedComment } from './CommentCategorizationTable';
import CommentCategorizationView from './CommentCategorizationView';
import { categorizeComment } from '@/lib/comment-categorization';
import EmailGenerator from './EmailGenerator';
import DeliveryVolumeChart from './DeliveryVolumeChart';
import { GlobalKpiSection } from './dashboard/GlobalKpiSection';
import { QualityImpactSection } from './dashboard/QualityImpactSection';
import { WorkloadAnalysisSection } from './dashboard/WorkloadAnalysisSection';
import { getWeek, startOfWeek, endOfWeek, parseISO, isWithinInterval } from 'date-fns';
import { analyzeData } from '@/lib/dataAnalyzer';
import { DateRange } from 'react-day-picker';
import NpsAnalysisView from './NpsAnalysisView';


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
    const [rdpWeeklyAnalyses, setRdpWeeklyAnalyses] = useState<WeeklyAnalysis[]>([]);

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

    useEffect(() => {
        if (activeTab !== 'rdp' || !filteredData || filteredData.length === 0) return;

        const processRdpData = () => {
            // Use filteredData which already respects depot/warehouse filters etc.
            let dataForWeeklyAnalysis = filteredData;
            
            // Further filter by date if dateRange is present
            if (filters.dateRange) {
                const { from, to } = filters.dateRange as DateRange;
                if (from && to) {
                    dataForWeeklyAnalysis = dataForWeeklyAnalysis.filter(item => {
                        try {
                            return isWithinInterval(parseISO(item.date), { start: from, end: to });
                        } catch(e) { return false; }
                    });
                }
            }


            const weeks: Record<string, MergedData[]> = {};
            dataForWeeklyAnalysis.forEach(item => {
                try {
                    const date = parseISO(item.date);
                    const weekNumber = getWeek(date, { weekStartsOn: 1 });
                    const year = date.getFullYear();
                    const weekKey = `${year}-W${String(weekNumber).padStart(2, '0')}`;
                    if (!weeks[weekKey]) weeks[weekKey] = [];
                    weeks[weekKey].push(item);
                } catch (e) {}
            });

            const sortedWeekKeys = Object.keys(weeks).sort().slice(-8); // Get last 8 weeks for RDP
            const analyses: WeeklyAnalysis[] = sortedWeekKeys.map(weekKey => {
                const weekData = weeks[weekKey];
                return {
                    weekLabel: weekKey,
                    dateRange: { from: startOfWeek(parseISO(weekData[0].date), { weekStartsOn: 1 }), to: endOfWeek(parseISO(weekData[0].date), { weekStartsOn: 1 }) },
                    // Re-run analysis on this specific week's data
                    analysis: analyzeData(weekData, filters),
                };
            });
            setRdpWeeklyAnalyses(analyses);
        }

        processRdpData();

    }, [activeTab, filteredData, filters]);
    
    const processedCommentIds = useMemo(() => {
        if (!existingSuivis) return new Set();
        return new Set(existingSuivis.map(s => `${s.nomTournee}|${s.date}|${s.entrepot}-${s.sequence}`));
    }, [existingSuivis]);

    // Sanitize an ID the same way as when saving
    const sanitizeId = (id: string) => id.replace(/[^a-zA-Z0-9-]/g, '_');

    const unprocessedCommentsCount = useMemo(() => {
        if (isLoadingSuivis) return 0; // Don't count until we know what's processed
        return filteredData.filter(d => {
            const commentId = `${d.nomTournee}|${d.date}|${d.entrepot}-${d.sequence || d.ordre}`;
            return d.commentaire && d.notation != null && d.notation <= 3 && !processedCommentIds.has(commentId);
        }).length;
    }, [filteredData, processedCommentIds, isLoadingSuivis]);
    
    const uncategorizedCommentsCount = useMemo(() => {
        if (isLoadingCategories || !savedCategorizedComments) {
            return 0;
        }

        const savedIds = new Set(savedCategorizedComments.map(c => sanitizeId(c.id)));
    
        return filteredData.filter(d => {
            if (!(d.notation != null && d.notation <= 3 && d.commentaire)) return false;
            const commentId = `${d.nomTournee}|${d.date}|${d.entrepot}-${d.sequence || d.ordre}`;
            return !savedIds.has(sanitizeId(commentId));
        }).length;
    }, [filteredData, savedCategorizedComments, isLoadingCategories]);

    const uncategorizedCommentsForSummary = useMemo(() => {
        if (isLoadingCategories || !savedCategorizedComments) return [];
        const savedIds = new Set(savedCategorizedComments.map(c => sanitizeId(c.id)));
        return filteredData
            .filter(d => {
                if (!(d.notation != null && d.notation <= 3 && d.commentaire)) return false;
                const commentId = `${d.nomTournee}|${d.date}|${d.entrepot}-${d.sequence || d.ordre}`;
                return !savedIds.has(sanitizeId(commentId));
            })
            .map(item => ({
                id: `${item.nomTournee}|${item.date}|${item.entrepot}-${item.sequence || item.ordre}`,
                comment: item.commentaire!,
                category: categorizeComment(item.commentaire!),
                date: item.date,
            }));
    }, [filteredData, savedCategorizedComments, isLoadingCategories]);

    const filteredCommentsForEmail = useMemo(() => {
        if (!filteredData) return { processedActions: [], categorizedComments: [] };
        const validDates = new Set(filteredData.map(d => d.date));
        
        const filteredProcessed = (existingSuivis || []).filter(action => validDates.has(action.date));
        const filteredCategorized = (savedCategorizedComments || []).filter(comment => validDates.has(comment.date));
        
        const allRelevantComments = [...filteredCategorized];
        
        const uncategorizedFiltered = uncategorizedCommentsForSummary.filter(c => c.date && validDates.has(c.date));
        const categorizedIds = new Set(allRelevantComments.map(c => c.id));

        uncategorizedFiltered.forEach(c => {
            if (!categorizedIds.has(c.id)) {
                allRelevantComments.push(c as CategorizedComment);
            }
        });

        return {
            processedActions: filteredProcessed,
            categorizedComments: allRelevantComments,
        }
    }, [filteredData, existingSuivis, savedCategorizedComments, uncategorizedCommentsForSummary]);


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
                    <TabsTrigger value="nps"><HeartPulse className="w-4 h-4 mr-2" />Analyse NPS &amp; Verbatims</TabsTrigger>
                    <TabsTrigger value="commentProcessing">
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Traitement Avis
                        {unprocessedCommentsCount > 0 && <Badge className="ml-2">{unprocessedCommentsCount}</Badge>}
                    </TabsTrigger>
                    <TabsTrigger value="actionFollowUp"><ClipboardCheck className="w-4 h-4 mr-2" />Suivi Actions</TabsTrigger>
                    <TabsTrigger value="data"><List className="w-4 h-4 mr-2" />Données Détaillées</TabsTrigger>
                    <TabsTrigger value="rdp"><LayoutDashboard className="w-4 h-4 mr-2" />RDP</TabsTrigger>
                    <TabsTrigger value="reportRD"><FileText className="w-4 h-4 mr-2" />Rapport RD</TabsTrigger>
                    <TabsTrigger value="settings"><Settings className="w-4 h-4 mr-2" />Paramètres</TabsTrigger>
                </TabsList>
            </div>

            <TabsContent value="nps" className="mt-6">
                <NpsAnalysisView data={rawData || []} />
            </TabsContent>
             <TabsContent value="actionFollowUp" className="mt-6">
                <ActionFollowUpView />
            </TabsContent>
            <TabsContent value="reportRD" className="mt-6 space-y-6">
                <div className="flex justify-end">
                    <EmailGenerator 
                        warehouseStats={analysisData.warehouseStats}
                        postalCodeStats={analysisData.postalCodeStats}
                        globalCommentData={filteredCommentsForEmail}
                    />
                </div>
                <GlobalCommentView 
                    processedActions={filteredCommentsForEmail.processedActions} 
                    categorizedComments={filteredCommentsForEmail.categorizedComments} 
                />
                <HotZonesChart data={analysisData.postalCodeStats} />
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
                    allData={rawData}
                    filters={filters}
                />
            </TabsContent>
            <TabsContent value="depotComparison" className="mt-6">
                <DepotComparison
                    allData={rawData}
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
                <QualitySummary 
                    data={filteredData} 
                    processedActions={filteredCommentsForEmail.processedActions} 
                    savedCategorizedComments={filteredCommentsForEmail.categorizedComments}
                    uncategorizedCommentsForSummary={uncategorizedCommentsForSummary}
                />
            </TabsContent>
            <TabsContent value="data" className="mt-6">
                <DetailedDataView data={filteredData} />
            </TabsContent>
            <TabsContent value="rdp" className="mt-6 space-y-6">
                <GlobalKpiSection
                    generalKpis={analysisData.generalKpis}
                    discrepancyKpis={analysisData.discrepancyKpis}
                />
                <QualityImpactSection qualityKpis={analysisData.qualityKpis} />
                <ComparisonView weeklyAnalyses={rdpWeeklyAnalyses} isForReport={true} />
                <WorkloadAnalysisSection
                    workloadByHour={analysisData.workloadByHour}
                    avgWorkload={analysisData.avgWorkload}
                    avgWorkloadByDriverBySlot={analysisData.avgWorkloadByDriverBySlot}
                />
                <DeliveryVolumeChart data={filteredData} />
                <HotZonesChart data={analysisData.postalCodeStats} />
                <DepotAnalysisTable data={analysisData.warehouseStats} />
                <PostalCodeTable data={analysisData.postalCodeStats} />
            </TabsContent>
            <TabsContent value="settings" className="mt-6">
                <DepotConfigurator />
            </TabsContent>
        </Tabs>
    )
}
