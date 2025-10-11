
"use client";

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
import { useMemo } from 'react';
import { getCarrierFromDriverName, cn } from '@/lib/utils';
import { CommentCategory, categorizeComment, commentCategories } from '@/lib/comment-categorization';
import GlobalCommentView from './GlobalCommentView';
import { CategorizedComment } from './CommentCategorizationTable';
import QualityEmailGenerator from './QualityEmailGenerator';
import { getNomDepot } from '@/lib/config-depots';

interface QualitySummaryProps {
    data: MergedData[];
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

const QualitySummary = ({ data, processedActions, savedCategorizedComments, uncategorizedCommentsForSummary }: QualitySummaryProps) => {

  const allCommentsForSummary = useMemo(() => {
    const allCategorized = [...savedCategorizedComments, ...uncategorizedCommentsForSummary];
    const uniqueComments = new Map<string, any>();
    allCategorized.forEach(comment => {
        if(!uniqueComments.has(comment.id) && comment.entrepot) {
            uniqueComments.set(comment.id, {
              ...comment,
              depot: getNomDepot(comment.entrepot)
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

  const allDataWithNotes = useMemo(() => {
    return data.filter(d => d.notation != null);
  }, [data]);
  
  const verbatimsData = useMemo(() => {
    return data.filter(item => item.verbatimData && item.verbatimData.noteRecommandation !== null);
  }, [data]);

  const npsSummary = useMemo(() => {
    const allNotes = verbatimsData.map(d => d.verbatimData?.noteRecommandation);
    return calculateNps(allNotes);
  }, [verbatimsData]);


  const summaryByDepot = useMemo(() => {
    const allDataGrouped = allDataWithNotes.reduce((acc, curr) => {
        const depot = getNomDepot(curr.entrepot);
        if (!acc[depot]) {
            acc[depot] = { totalRatingValue: 0, ratedTasksCount: 0 };
        }
        if(curr.notation !== null) {
          acc[depot].ratedTasksCount++;
          acc[depot].totalRatingValue += curr.notation;
        }
        return acc;
    }, {} as Record<string, { totalRatingValue: number, ratedTasksCount: number }>);
    
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
        }
      })
      .filter(item => item.negativeRatingsCount > 0)
      .sort((a, b) => b.negativeRatingsCount - a.negativeRatingsCount);
  }, [negativeRatingsData, allDataWithNotes, data, verbatimsData]);


  const summaryByCarrier = useMemo(() => {
    const allDataGrouped = allDataWithNotes.reduce((acc, curr) => {
      const depot = getNomDepot(curr.entrepot);
      const carrier = getCarrierFromDriverName(curr.livreur || '') || 'Inconnu';
      const key = `${depot}|${carrier}`;
      if (!acc[key]) {
        acc[key] = { totalRatingValue: 0, ratedTasksCount: 0 };
      }
      if (curr.notation !== null) {
        acc[key].ratedTasksCount++;
        acc[key].totalRatingValue += curr.notation;
      }
      return acc;
    }, {} as Record<string, { totalRatingValue: number, ratedTasksCount: number }>);

    const allCommentsInData = data.filter(d => d.commentaire);

    const commentCounts = allCommentsInData.reduce((acc, curr) => {
        const depot = getNomDepot(curr.entrepot);
        const carrier = getCarrierFromDriverName(curr.livreur || '') || 'Inconnu';
        const key = `${depot}|${carrier}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    
    const grouped = negativeRatingsData.reduce((acc, curr) => {
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
      const negativeStats = grouped[key] || { depot, carrier, negativeRatingsCount: 0 };
      const allStats = allDataGrouped[key];
      const carrierNps = calculateNps(npsByCarrier[key] || []);
      return {
        ...negativeStats,
        totalRatings: allStats?.ratedTasksCount || 0,
        averageRating: (allStats?.ratedTasksCount || 0) > 0 ? (allStats.totalRatingValue / allStats.ratedTasksCount).toFixed(2) : 'N/A',
        commentCount: commentCounts[key] || 0,
        nps: carrierNps.nps,
      }
    })
    .sort((a, b) => {
        if (a.depot < b.depot) return -1;
        if (a.depot > b.depot) return 1;
        return a.carrier.localeCompare(b.carrier);
    });
  }, [negativeRatingsData, allDataWithNotes, data, verbatimsData]);


 const summaryByDriver = useMemo(() => {
    const tasksByDriver = negativeRatingsData.reduce((acc, curr) => {
        const driver = curr.livreur || 'Inconnu';
        if (!acc[driver]) {
            acc[driver] = [];
        }
        acc[driver].push(curr);
        return acc;
    }, {} as Record<string, typeof negativeRatingsData>);

    return Object.entries(tasksByDriver).map(([driver, tasks]) => {
        const depot = tasks.length > 0 ? getNomDepot(tasks[0].entrepot) : 'Inconnu';
        const carrier = getCarrierFromDriverName(driver) || 'Inconnu';
        
        const allDriverTasks = allDataWithNotes.filter(d => d.livreur === driver);
        const totalRatings = allDriverTasks.length;
        const totalRatingValue = allDriverTasks.reduce((sum, task) => sum + (task.notation ?? 0), 0);

        const categoryCounts: Record<string, number> = {};
        for (const item of tasks) {
             if (item.commentaire) { 
                const category = item.category || 'Autre';
                categoryCounts[category] = (categoryCounts[category] || 0) + 1;
            }
        }
        
        const categorySummary = Object.entries(categoryCounts)
            .sort(([, countA], [, countB]) => countB - countA)
            .map(([cat, count]) => `${count} ${cat}`)
            .join(', ');

        return {
            depot,
            carrier,
            driver,
            totalRatings: totalRatings,
            negativeRatingsCount: tasks.length,
            averageRating: totalRatings > 0 ? (totalRatingValue / totalRatings).toFixed(2) : 'N/A',
            categorySummary: categorySummary || '',
        };
    })
    .sort((a, b) => {
        if (!a || !b) return 0;
        if (a.depot < b.depot) return -1;
        if (a.depot > b.depot) return 1;
        if (a.carrier < b.carrier) return -1;
        if (a.carrier > b.carrier) return 1;
        if (a.driver < b.driver) return -1;
        if (a.driver > b.driver) return 1;
        return 0;
    });
}, [negativeRatingsData, allDataWithNotes]);

  
  const unassignedDrivers = useMemo(() => {
    const drivers = negativeRatingsData.reduce((acc, curr) => {
      const driverName = curr.livreur || 'Inconnu';
      if (driverName !== 'Inconnu' && !getCarrierFromDriverName(driverName)) {
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
  }, [negativeRatingsData]);

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
                <TableHeader><TableRow><TableHead>Dépôt (Total Notes)</TableHead><TableHead>NPS</TableHead><TableHead>Nb. Mauvaises Notes</TableHead><TableHead>Note Moyenne (sur toutes les notes)</TableHead><TableHead>Nb. Commentaires Associés</TableHead></TableRow></TableHeader>
                <TableBody>
                  {summaryByDepot.map(({ depot, totalRatings, negativeRatingsCount, averageRating, commentCount, nps }) => (
                    <TableRow key={depot}><TableCell>{depot} ({totalRatings})</TableCell><TableCell>{nps}</TableCell><TableCell>{negativeRatingsCount}</TableCell><TableCell>{averageRating}</TableCell><TableCell>{commentCount}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
            <TabsContent value="carrier">
              <Table>
                <TableHeader><TableRow><TableHead>Dépôt</TableHead><TableHead>Transporteur (Total Notes)</TableHead><TableHead>NPS</TableHead><TableHead>Nb. Mauvaises Notes</TableHead><TableHead>Note Moyenne (sur toutes les notes)</TableHead><TableHead>Nb. Commentaires Associés</TableHead></TableRow></TableHeader>
                <TableBody>
                  {summaryByCarrier.map(({ depot, carrier, totalRatings, negativeRatingsCount, averageRating, commentCount, nps }, index) => (
                    <TableRow key={index}><TableCell>{depot}</TableCell><TableCell>{carrier} ({totalRatings})</TableCell><TableCell>{nps}</TableCell><TableCell>{negativeRatingsCount}</TableCell><TableCell>{averageRating}</TableCell><TableCell>{commentCount}</TableCell></TableRow>
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
                    <TableHead>Nb. Mauvaises Notes</TableHead>
                    <TableHead>Note Moyenne (sur toutes les notes)</TableHead>
                    <TableHead>Catégories de Commentaires</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summaryByDriver.map(({ depot, carrier, driver, totalRatings, negativeRatingsCount, averageRating, categorySummary }, index) => (
                    <TableRow key={index}>
                      <TableCell>{depot}</TableCell>
                      <TableCell>{carrier}</TableCell>
                      <TableCell>{driver} ({totalRatings})</TableCell>
                      <TableCell>{negativeRatingsCount}</TableCell>
                      <TableCell>{averageRating}</TableCell>
                      <TableCell>{categorySummary}</TableCell>
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
