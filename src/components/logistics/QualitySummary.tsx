

"use client";
import React, { useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MergedData, SuiviCommentaire } from '@/lib/types';
import { getCarrierFromDriverName, cn } from '@/lib/utils';
import { CommentCategory, categorizeComment, commentCategories } from '@/lib/comment-categorization';
import GlobalCommentView from './GlobalCommentView';
import { CategorizedComment } from './CommentCategorizationTable';
import QualityEmailGenerator from './QualityEmailGenerator';
import { getNomDepot } from '@/lib/config-depots';
import { useLogistics } from '@/context/LogisticsContext';
import { format, parseISO, isWithinInterval } from 'date-fns';
import { fr } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';


interface QualitySummaryProps {
    data: MergedData[];
    rawData: MergedData[];
    processedActions: SuiviCommentaire[];
    savedCategorizedComments: CategorizedComment[];
    uncategorizedCommentsForSummary: any[];
}

const calculateNps = (notes: (number | null | undefined)[]) => {
    const validNotes = notes.filter((n): n is number => n !== null && n !== undefined);
    if (validNotes.length === 0) {
        return { nps: 0, promoters: 0, passives: 0, detractors: 0, total: 0, promoterPercent: '0.0', detractorPercent: '0.0', passivePercent: '0.0' };
    }
    const promoters = validNotes.filter(n => n >= 9).length;
    const detractors = validNotes.filter(n => n <= 6).length;
    const total = validNotes.length;
    const promoterPercent = (promoters / total) * 100;
    const detractorPercent = (detractors / total) * 100;
    const passivePercent = 100 - promoterPercent - detractorPercent;
    const nps = Math.round(promoterPercent - detractorPercent);
    return { 
        nps, 
        promoters, 
        passives: total - promoters - detractors, 
        detractors, 
        total,
        promoterPercent: promoterPercent.toFixed(1),
        detractorPercent: detractorPercent.toFixed(1),
        passivePercent: passivePercent.toFixed(1)
    };
};

const QualitySummary = ({ data, rawData, processedActions, savedCategorizedComments, uncategorizedCommentsForSummary }: QualitySummaryProps) => {
  const { state } = useLogistics();
  const { filters } = state;

  const dateRangeString = useMemo(() => {
    if (filters.dateRange) {
        const { from, to } = filters.dateRange;
        if (from && to) {
            if(from.getTime() === to.getTime()) return `le ${format(from, 'd MMMM yyyy', { locale: fr })}`;
            return `du ${format(from, 'd MMMM yyyy', { locale: fr })} au ${format(to, 'd MMMM yyyy', { locale: fr })}`;
        } else if (from) {
            return `depuis le ${format(from, 'd MMMM yyyy', { locale: fr })}`;
        } else if (to) {
            return `jusqu'au ${format(to, 'd MMMM yyyy', { locale: fr })}`;
        }
    }
    if (rawData && rawData.length > 0) {
        const dates = rawData.map(d => parseISO(d.date)).filter(d => !isNaN(d.getTime()));
        if (dates.length > 0) {
            const minDate = new Date(Math.min.apply(null, dates as any));
            const maxDate = new Date(Math.max.apply(null, dates as any));
             if(minDate.getTime() === maxDate.getTime()) return `le ${format(minDate, 'd MMMM yyyy', { locale: fr })}`;
            return `du ${format(minDate, 'd MMMM yyyy', { locale: fr })} au ${format(maxDate, 'd MMMM yyyy', { locale: fr })}`;
        }
    }
    return 'période sélectionnée';
  }, [filters.dateRange, rawData]);

    const verbatimsData = useMemo(() => {
    let verbatimItems = rawData.filter(item => item.verbatimData && item.verbatimData.noteRecommandation !== null);

    // Date filtering on verbatimData.dateRetrait
    if (filters.dateRange) {
        const { from, to } = filters.dateRange as DateRange;
        verbatimItems = verbatimItems.filter(item => {
            if (!item.verbatimData?.dateRetrait) return false;
            try {
                const verbatimDate = parseISO(item.verbatimData.dateRetrait);
                if (from && to) {
                    return isWithinInterval(verbatimDate, { start: from, end: to });
                } else if (from) {
                    return verbatimDate >= from;
                } else if (to) {
                    return verbatimDate <= to;
                }
                return true;
            } catch (e) {
                return false;
            }
        });
    } else if (filters.selectedDate) {
         const selectedDateStr = format(new Date(filters.selectedDate), 'yyyy-MM-dd');
         verbatimItems = verbatimItems.filter(item => {
            return item.verbatimData?.dateRetrait === selectedDateStr;
        });
    }
    
    // Apply other filters (non-date)
    return verbatimItems.filter(item => {
        if (filters.depots && filters.depots.length > 0 && !filters.depots.includes(getNomDepot(item.entrepot))) return false;
        if (filters.warehouses && filters.warehouses.length > 0 && !filters.warehouses.includes(item.warehouse)) return false;
        if (filters.carriers && filters.carriers.length > 0 && (!item.carrier || !filters.carriers.includes(item.carrier))) return false;
        if (filters.city && item.ville !== filters.city) return false;
        if (filters.codePostal && item.codePostal !== filters.codePostal) return false;
        if (filters.driverName) {
            const driverName = item.livreur?.toLowerCase() || '';
            const filterValue = filters.driverName.toLowerCase();
            if (filters.driverNameFilterType === 'suffix') {
                if (!driverName.endsWith(filterValue)) return false;
            } else { // prefix by default
                if (!driverName.startsWith(filterValue)) return false;
            }
        }
        return true;
    });
  }, [rawData, filters]);


  const allCommentsForSummary = useMemo(() => {
    const allCategorized = [...savedCategorizedComments, ...uncategorizedCommentsForSummary];
    const uniqueComments = new Map<string, any>();
    allCategorized.forEach(comment => {
        const depot = comment.entrepot ? getNomDepot(comment.entrepot) : 'Inconnu';
        if(!uniqueComments.has(comment.id)) {
            uniqueComments.set(comment.id, {
              ...comment,
              depot,
            });
        }
    });
    return Array.from(uniqueComments.values());
  }, [savedCategorizedComments, uncategorizedCommentsForSummary]);

  const commentsMap = useMemo(() => {
    const sanitizedMap = new Map<string, CommentCategory>();
    allCommentsForSummary.forEach(c => {
        const sanitizedId = c.id.replace(/[^a-zA-Z0-9-]/g, '_');
        sanitizedMap.set(sanitizedId, c.category);
    });
    return sanitizedMap;
  }, [allCommentsForSummary]);


  const negativeRatingsData = useMemo(() => {
    return data
      .filter(d => d.notation != null && d.notation <= 3)
      .map(item => {
        const commentId = `${item.nomTournee}|${item.date}|${item.entrepot}-${item.sequence || item.ordre}`;
        const sanitizedId = commentId.replace(/[^a-zA-Z0-9-]/g, '_');
        
        const definitiveCategory = commentsMap.get(sanitizedId);

        return {
          ...item,
          category: definitiveCategory || (item.commentaire ? categorizeComment(item.commentaire) : 'Autre'),
        };
      });
  }, [data, commentsMap]);

  const npsSummary = useMemo(() => {
    const allNotes = verbatimsData.map(d => d.verbatimData?.noteRecommandation);
    return calculateNps(allNotes);
  }, [verbatimsData]);


  const summaryByDepot = useMemo(() => {
    const allDataGrouped = data.reduce((acc, curr) => {
        const depot = getNomDepot(curr.entrepot);
        if (!acc[depot]) {
            acc[depot] = { totalRatingValue: 0, ratedTasksCount: 0, totalTasks: 0, onTimeTasks: 0 };
        }
        acc[depot].totalTasks++;
        if (curr.retardStatus === 'onTime') {
            acc[depot].onTimeTasks++;
        }
        if(curr.notation !== null && curr.notation !== undefined) {
          acc[depot].ratedTasksCount++;
          acc[depot].totalRatingValue += curr.notation;
        }
        return acc;
    }, {} as Record<string, { totalRatingValue: number, ratedTasksCount: number, totalTasks: number, onTimeTasks: number }>);
    
    const allCommentsInData = data.filter(d => d.commentaire);
    
    const commentCounts = allCommentsInData.reduce((acc, curr) => {
        const depot = getNomDepot(curr.entrepot);
        acc[depot] = (acc[depot] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const grouped = negativeRatingsData.reduce((acc, curr) => {
        const depot = getNomDepot(curr.entrepot);
        if(!acc[depot]) {
            acc[depot] = { negativeRatingsCount: 0 };
        }
        acc[depot].negativeRatingsCount++;
        return acc;
    }, {} as Record<string, { negativeRatingsCount: number }>);

    const npsByDepot = verbatimsData.reduce((acc, curr) => {
        const depot = getNomDepot(curr.entrepot);
        if (!acc[depot]) acc[depot] = [];
        if (curr.verbatimData?.noteRecommandation !== null && curr.verbatimData?.noteRecommandation !== undefined) {
          acc[depot].push(curr.verbatimData.noteRecommandation);
        }
        return acc;
    }, {} as Record<string, number[]>);


    return Object.keys(allDataGrouped)
      .map((depot) => {
        const depotNegativeStats = grouped[depot] || { negativeRatingsCount: 0 };
        const depotAllStats = allDataGrouped[depot];
        const depotNps = calculateNps(npsByDepot[depot] || []);
        return {
          depot,
          totalRatings: depotAllStats?.ratedTasksCount || 0,
          negativeRatingsCount: depotNegativeStats.negativeRatingsCount,
          averageRating: (depotAllStats?.ratedTasksCount || 0) > 0 ? (depotAllStats.totalRatingValue / depotAllStats.ratedTasksCount).toFixed(2) : 'N/A',
          commentCount: commentCounts[depot] || 0,
          nps: depotNps.nps,
          punctuality: (depotAllStats?.totalTasks || 0) > 0 ? (depotAllStats.onTimeTasks / depotAllStats.totalTasks) * 100 : 0,
          npsTotal: depotNps.total,
        }
      })
      .filter(item => item.negativeRatingsCount > 0)
      .sort((a, b) => b.negativeRatingsCount - a.negativeRatingsCount);
  }, [negativeRatingsData, data, verbatimsData]);


  const summaryByCarrier = useMemo(() => {
    const allDataGrouped = data.reduce((acc, curr) => {
      const depot = getNomDepot(curr.entrepot);
      const carrier = getCarrierFromDriverName(curr.livreur || '') || 'Inconnu';
      
      const key = `${depot}|${carrier}`;
      if (!acc[key]) {
        acc[key] = { totalRatingValue: 0, ratedTasksCount: 0, totalTasks: 0, onTimeTasks: 0, tourIds: new Set<string>() };
      }
      acc[key].totalTasks++;
      acc[key].tourIds.add(curr.tourneeUniqueId);
      if (curr.retardStatus === 'onTime') {
        acc[key].onTimeTasks++;
      }
      if (curr.notation !== null && curr.notation !== undefined) {
        acc[key].ratedTasksCount++;
        acc[key].totalRatingValue += curr.notation;
      }
      return acc;
    }, {} as Record<string, { totalRatingValue: number, ratedTasksCount: number, totalTasks: number, onTimeTasks: number, tourIds: Set<string> }>);

    const allCommentsInData = data.filter(d => d.commentaire);

    const commentCounts = allCommentsInData.reduce((acc, curr) => {
        const depot = getNomDepot(curr.entrepot);
        const carrier = getCarrierFromDriverName(curr.livreur || '') || 'Inconnu';
        const key = `${depot}|${carrier}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    
    const groupedNegative = negativeRatingsData.reduce((acc, curr) => {
        const depot = getNomDepot(curr.entrepot);
        const carrier = getCarrierFromDriverName(curr.livreur || '') || 'Inconnu';
        const key = `${depot}|${carrier}`;

        if (!acc[key]) {
            acc[key] = { depot, carrier, negativeRatingsCount: 0 };
        }
        acc[key].negativeRatingsCount++;
        return acc;
    }, {} as Record<string, { depot: string, carrier: string, negativeRatingsCount: number }>);

    const npsByCarrier = verbatimsData.reduce((acc, curr) => {
        const depot = getNomDepot(curr.entrepot);
        const carrier = getCarrierFromDriverName(curr.livreur || '') || 'Inconnu';
        const key = `${depot}|${carrier}`;
        if (!acc[key]) acc[key] = [];
        if (curr.verbatimData?.noteRecommandation !== null && curr.verbatimData?.noteRecommandation !== undefined) {
            acc[key].push(curr.verbatimData.noteRecommandation);
        }
        return acc;
    }, {} as Record<string, number[]>);
    
    return Object.keys(allDataGrouped).map(key => {
      const [depot, carrier] = key.split('|');
      const negativeStats = groupedNegative[key] || { depot, carrier, negativeRatingsCount: 0 };
      const allStats = allDataGrouped[key];
      const carrierNps = calculateNps(npsByCarrier[key] || []);
      return {
        ...negativeStats,
        tourCount: allStats?.tourIds.size || 0,
        totalRatings: allStats?.ratedTasksCount || 0,
        averageRating: (allStats?.ratedTasksCount || 0) > 0 ? (allStats.totalRatingValue / allStats.ratedTasksCount).toFixed(2) : 'N/A',
        commentCount: commentCounts[key] || 0,
        nps: carrierNps.nps,
        punctuality: (allStats?.totalTasks || 0) > 0 ? (allStats.onTimeTasks / allStats.totalTasks) * 100 : 0,
        npsTotal: carrierNps.total,
      }
    })
    .sort((a, b) => {
        if (a.depot < b.depot) return -1;
        if (a.depot > b.depot) return 1;
        return a.carrier.localeCompare(b.carrier);
    });
  }, [negativeRatingsData, data, verbatimsData]);


 const summaryByDriver = useMemo(() => {
    const tasksByDriver = data.reduce((acc, curr) => {
        const driver = curr.livreur;
        if (!driver) return acc;
        
        if (!acc[driver]) {
            acc[driver] = [];
        }
        acc[driver].push(curr);
        return acc;
    }, {} as Record<string, MergedData[]>);

    const npsByDriver = verbatimsData.reduce((acc, curr) => {
        const driver = curr.livreur;
        if (!driver) return acc;

        if (!acc[driver]) acc[driver] = [];
        if (curr.verbatimData?.noteRecommandation !== null && curr.verbatimData?.noteRecommandation !== undefined) {
            acc[driver].push(curr.verbatimData.noteRecommandation);
        }
        return acc;
    }, {} as Record<string, number[]>);


    return Object.entries(tasksByDriver).map(([driver, tasks]) => {
        const depot = tasks.length > 0 ? getNomDepot(tasks[0].entrepot) : 'Inconnu';
        const carrier = getCarrierFromDriverName(driver) || 'Inconnu';

        const negativeRatingTasks = tasks.filter(t => t.notation != null && t.notation <= 3);
        
        const ratedTasks = tasks.filter(d => d.notation != null);
        const totalRatingValue = ratedTasks.reduce((sum, task) => sum + (task.notation ?? 0), 0);

        const categoryCounts: Record<string, { count: number, isAttitude: boolean }> = {};
        for (const item of negativeRatingTasks) {
            if (item.commentaire) { 
                const commentId = `${item.nomTournee}|${item.date}|${item.entrepot}-${item.sequence || item.ordre}`;
                const sanitizedId = commentId.replace(/[^a-zA-Z0-9-]/g, '_');
                const category = commentsMap.get(sanitizedId) || categorizeComment(item.commentaire);
                const isAttitude = category.toLowerCase().includes('attitude') || category.toLowerCase().includes('amabilité');
                if (!categoryCounts[category]) {
                    categoryCounts[category] = { count: 0, isAttitude };
                }
                categoryCounts[category].count++;
            }
        }
        
        const categorySummary = Object.entries(categoryCounts)
            .sort(([, a], [, b]) => b.count - a.count)
            .map(([cat, { count, isAttitude }]) => ({ name: cat, count, isAttitude }));

        const driverNps = calculateNps(npsByDriver[driver] || []);
        
        const onTimeTasks = tasks.filter(t => t.retardStatus === 'onTime').length;

        return {
            depot,
            carrier,
            driver,
            totalRatings: ratedTasks.length,
            negativeRatingsCount: negativeRatingTasks.length,
            averageRating: ratedTasks.length > 0 ? (totalRatingValue / ratedTasks.length).toFixed(2) : 'N/A',
            categorySummary,
            nps: driverNps.nps,
            punctuality: tasks.length > 0 ? (onTimeTasks / tasks.length) * 100 : 0,
            npsTotal: driverNps.total,
        };
    })
    .sort((a, b) => b.negativeRatingsCount - a.negativeRatingsCount);
}, [data, commentsMap, verbatimsData]);

  
  const unassignedDrivers = useMemo(() => {
    const drivers = data.reduce((acc, curr) => {
      const driverName = curr.livreur;
      if (driverName && driverName !== 'Inconnu' && !getCarrierFromDriverName(driverName)) {
        const depot = getNomDepot(curr.entrepot);
        if (!acc[driverName]) {
          acc[driverName] = new Set<string>();
        }
        acc[driverName].add(depot);
      }
      return acc;
    }, {} as Record<string, Set<string>>);
  
    return Object.entries(drivers).map(([driver, depots]) => ({
      driver,
      depots: Array.from(depots).join(', '),
    }));
  }, [data]);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Analyse de la Qualité</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Aucune donnée à afficher pour la sélection actuelle.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className='space-y-6'>
       <div className="flex justify-end">
        <QualityEmailGenerator 
          summaryByDepot={summaryByDepot}
          summaryByCarrier={summaryByCarrier}
          summaryByDriver={summaryByDriver}
          unassignedDrivers={unassignedDrivers}
          allCommentsForSummary={allCommentsForSummary}
          npsSummary={npsSummary}
          dateRangeString={dateRangeString}
          selectedDepots={filters.depots || []}
        />
      </div>

        {npsSummary.total > 0 && (
            <Card>
                <CardHeader>
                    <CardTitle>Synthèse Net Promoter Score (NPS)</CardTitle>
                </CardHeader>
                <CardContent>
                     <div className="flex justify-around items-center gap-8 p-4 bg-muted rounded-lg">
                        <div className="text-center">
                            <p className="text-sm text-muted-foreground">NPS Global</p>
                            <p className={cn("text-5xl font-bold", npsSummary.nps >= 50 ? 'text-green-600' : npsSummary.nps >= 0 ? 'text-yellow-600' : 'text-red-600')}>{npsSummary.nps}</p>
                        </div>
                        <div className="text-sm space-y-1">
                            <p>Total des réponses : <strong>{npsSummary.total}</strong></p>
                            <p>Promoteurs (9-10) : <strong className="text-green-600">{npsSummary.promoters} ({npsSummary.promoterPercent}%)</strong></p>
                            <p>Passifs (7-8) : <strong className="text-yellow-600">{npsSummary.passives} ({npsSummary.passivePercent}%)</strong></p>
                            <p>Détracteurs (0-6) : <strong className="text-red-600">{npsSummary.detractors} ({npsSummary.detractorPercent}%)</strong></p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        )}

      <GlobalCommentView 
        processedActions={processedActions}
        categorizedComments={allCommentsForSummary}
      />

      <Card>
        <CardHeader>
          <CardTitle>Synthèses Générales de la Qualité (Focus Avis Négatifs)</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="depot">
            <TabsList>
              <TabsTrigger value="depot">Par Dépôt</TabsTrigger>
              <TabsTrigger value="carrier">Par Transporteur</TabsTrigger>
              <TabsTrigger value="driver">Par Livreur</TabsTrigger>
            </TabsList>
            <TabsContent value="depot">
              <Table>
                <TableHeader><TableRow><TableHead>Dépôt (Total Notes)</TableHead><TableHead>NPS</TableHead><TableHead>Ponctualité</TableHead><TableHead>Nb. Mauvaises Notes</TableHead><TableHead>Note Moyenne (sur toutes les notes)</TableHead><TableHead>Nb. Commentaires Associés</TableHead></TableRow></TableHeader>
                <TableBody>
                  {summaryByDepot.map(({ depot, totalRatings, negativeRatingsCount, averageRating, commentCount, nps, punctuality, npsTotal }) => (
                    <TableRow key={depot}><TableCell>{depot} ({totalRatings})</TableCell><TableCell>{npsTotal ? nps : 'N/A'}</TableCell><TableCell>{punctuality.toFixed(1)}%</TableCell><TableCell>{negativeRatingsCount}</TableCell><TableCell>{averageRating}</TableCell><TableCell>{commentCount}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
            <TabsContent value="carrier">
               <Table>
                <TableHeader><TableRow><TableHead>Dépôt</TableHead><TableHead>Transporteur</TableHead><TableHead>Nb. Tournées</TableHead><TableHead>Total Notes</TableHead><TableHead>NPS</TableHead><TableHead>Ponctualité</TableHead><TableHead>Nb. Mauvaises Notes</TableHead><TableHead>Note Moyenne</TableHead><TableHead>Nb. Commentaires</TableHead></TableRow></TableHeader>
                <TableBody>
                  {summaryByCarrier.map(({ depot, carrier, tourCount, totalRatings, negativeRatingsCount, averageRating, commentCount, nps, punctuality, npsTotal }, index) => (
                    <TableRow key={index}><TableCell>{depot}</TableCell><TableCell>{carrier}</TableCell><TableCell>{tourCount}</TableCell><TableCell>{totalRatings}</TableCell><TableCell>{npsTotal ? nps : 'N/A'}</TableCell><TableCell>{punctuality.toFixed(1)}%</TableCell><TableCell>{negativeRatingsCount}</TableCell><TableCell>{averageRating}</TableCell><TableCell>{commentCount}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
            <TabsContent value="driver">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dépôt</TableHead>
                    <TableHead>Transporteur</TableHead>
                    <TableHead>Livreur (Total Notes)</TableHead>
                    <TableHead>NPS</TableHead>
                    <TableHead>Ponctualité</TableHead>
                    <TableHead>Nb. Mauvaises Notes</TableHead>
                    <TableHead>Note Moyenne (sur toutes les notes)</TableHead>
                    <TableHead>Catégories de Commentaires</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summaryByDriver.map(({ depot, carrier, driver, totalRatings, negativeRatingsCount, averageRating, categorySummary, nps, punctuality, npsTotal }, index) => (
                    <TableRow key={index}>
                      <TableCell>{depot}</TableCell>
                      <TableCell>{carrier}</TableCell>
                      <TableCell>{driver} ({totalRatings})</TableCell>
                      <TableCell>{npsTotal ? nps : 'N/A'}</TableCell>
                      <TableCell>{punctuality.toFixed(1)}%</TableCell>
                      <TableCell>{negativeRatingsCount}</TableCell>
                      <TableCell>{averageRating}</TableCell>
                       <TableCell>
                         {categorySummary.length > 0 ? (
                            categorySummary.map((c, i) => (
                              <React.Fragment key={c.name}>
                                <span className={cn(c.isAttitude && "text-destructive font-bold")}>{c.count > 1 ? `${c.count} ${c.name}` : c.name}</span>
                                {i < categorySummary.length - 1 && ', '}
                              </React.Fragment>
                            ))
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      
      {unassignedDrivers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Livreurs sans Transporteur Assigné</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Nom du Livreur</TableHead><TableHead>Dépôt(s)</TableHead></TableRow></TableHeader>
              <TableBody>
                {unassignedDrivers.map(({ driver, depots }) => (
                  <TableRow key={driver}><TableCell>{driver}</TableCell><TableCell>{depots}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default QualitySummary;
