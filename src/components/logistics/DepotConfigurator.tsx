"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, PlusCircle, Trash2, Save, AlertCircle } from 'lucide-react';
import { getDepotConfig, saveDepotConfig } from '@/actions/depotConfig';
import { useToast } from '@/hooks/use-toast';

type DepotConfig = { [key: string]: string[] };

export default function DepotConfigurator() {
    const [config, setConfig] = useState<DepotConfig>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [newDepot, setNewDepot] = useState('');
    const [newPrefix, setNewPrefix] = useState('');
    const { toast } = useToast();

    useEffect(() => {
        const fetchConfig = async () => {
            setIsLoading(true);
            setError(null);
            const result = await getDepotConfig();
            if (result.success && result.config) {
                setConfig(result.config);
            } else {
                setError(result.error || "Impossible de charger la configuration.");
            }
            setIsLoading(false);
        };
        fetchConfig();
    }, []);

    const handleAddRule = () => {
        if (!newDepot || !newPrefix) {
            toast({
                variant: 'destructive',
                title: 'Champs requis',
                description: "Veuillez renseigner un nom de dépôt et un préfixe.",
            });
            return;
        }

        setConfig(prev => {
            const updatedConfig = { ...prev };
            if (!updatedConfig[newDepot]) {
                updatedConfig[newDepot] = [];
            }
            if (!updatedConfig[newDepot].includes(newPrefix)) {
                updatedConfig[newDepot].push(newPrefix);
            }
            return updatedConfig;
        });
        setNewPrefix('');
    };

    const handleRemoveRule = (depot: string, prefix: string) => {
        setConfig(prev => {
            const updatedConfig = { ...prev };
            const prefixes = updatedConfig[depot].filter(p => p !== prefix);
            if (prefixes.length === 0) {
                delete updatedConfig[depot];
            } else {
                updatedConfig[depot] = prefixes;
            }
            return updatedConfig;
        });
    };

    const handleSaveChanges = async () => {
        setIsSaving(true);
        setError(null);
        const result = await saveDepotConfig(config);
        if (result.success) {
            toast({
                title: 'Succès',
                description: "Configuration sauvegardée. Veuillez rafraîchir la page pour appliquer les changements à l'analyse.",
            });
        } else {
            setError(result.error || "Une erreur inconnue est survenue.");
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description: result.error || "Impossible de sauvegarder la configuration.",
            });
        }
        setIsSaving(false);
    };

    if (isLoading) {
        return (
            <Card>
                <CardHeader><CardTitle>Configuration des Dépôts</CardTitle></CardHeader>
                <CardContent className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="ml-4 text-muted-foreground">Chargement de la configuration...</p>
                </CardContent>
            </Card>
        );
    }
    
    if (error) {
        return (
            <Card>
                <CardHeader><CardTitle>Configuration des Dépôts</CardTitle></CardHeader>
                <CardContent className="flex flex-col items-center justify-center h-64 text-destructive">
                    <AlertCircle className="w-8 h-8 mb-4" />
                    <p className="font-bold">Erreur de chargement</p>
                    <p className="text-sm">{error}</p>
                </CardContent>
            </Card>
        );
    }

    const hasNoRules = Object.keys(config).length === 0;

    return (
        <div className="space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle>Configuration des Dépôts</CardTitle>
                    <CardDescription>
                        Définissez comment les entrepôts sont regroupés en dépôts en fonction de leurs préfixes.
                        Les changements ne seront appliqués qu'après avoir rechargé les données (bouton "Réinitialiser").
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="border rounded-lg p-4 space-y-4">
                        <h3 className="font-semibold">Ajouter une nouvelle règle</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                            <Input
                                placeholder="Nom du Dépôt (ex: VLG)"
                                value={newDepot}
                                onChange={(e) => setNewDepot(e.target.value)}
                            />
                            <Input
                                placeholder="Préfixe de l'entrepôt (ex: Villeneuve)"
                                value={newPrefix}
                                onChange={(e) => setNewPrefix(e.target.value)}
                            />
                            <Button onClick={handleAddRule} className="md:w-auto">
                                <PlusCircle className="w-4 h-4 mr-2" />
                                Ajouter la Règle
                            </Button>
                        </div>
                    </div>

                    <div>
                        <h3 className="font-semibold mb-2">Règles Actuelles</h3>
                        <div className="border rounded-lg max-h-[400px] overflow-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Nom du Dépôt</TableHead>
                                        <TableHead>Préfixe de l'Entrepôt</TableHead>
                                        <TableHead className="w-12"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {hasNoRules ? (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center text-muted-foreground h-24">
                                                Aucune règle définie.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        Object.entries(config).flatMap(([depot, prefixes]) =>
                                            prefixes.map((prefix, index) => (
                                                <TableRow key={`${depot}-${prefix}`}>
                                                    {index === 0 && (
                                                        <TableCell rowSpan={prefixes.length} className="font-semibold align-top border-t">{depot}</TableCell>
                                                    )}
                                                    <TableCell className="border-t">{prefix}</TableCell>
                                                    <TableCell className="border-t">
                                                        <Button variant="ghost" size="icon" onClick={() => handleRemoveRule(depot, prefix)}>
                                                            <Trash2 className="w-4 h-4 text-destructive" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-end">
                    <Button onClick={handleSaveChanges} disabled={isSaving}>
                        {isSaving ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sauvegarde...</>
                        ) : (
                            <><Save className="w-4 h-4 mr-2" />Enregistrer les Changements</>
                        )}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
