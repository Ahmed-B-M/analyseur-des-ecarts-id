
import { processAndAnalyzeData } from '../lib/data-provider';
import * as XLSX from 'xlsx';
import type { Tournee, Tache, MergedData } from '../lib/types';
import { getNomDepot } from '../lib/config-depots';


const headerAliases: Record<string, Record<string, string[]>> = {
  tournees: {
    nom: ['nom', 'Tournée', 'tournée'],
    date: ['date', 'Date'],
    entrepot: ['entrepôt', 'entrepot'],
    livreur: ['livreur', 'Livreur'],
    dureePrevue: ['durée (s)'],
    dureeReelle: ['durée réelle de la tournée (s)'],
    capaciteBacs: ['capacité bac (bacs)'],
    bacsPrevus: ['bac (bacs)'],
    capacitePoids: ['capacité poids (kg)'],
    poidsPrevu: ['poids (kg)'],
    distancePrevue: ['kilométrage (km)', 'distance (m)'],
    distanceReelle: ['kilométrage réel (km)'],
    heureDepartPrevue: ['départ'],
    heureFinPrevue: ['fin'],
    heureDepartReelle: ['heure de départ réelle du livreur'],
    demarre: ['démarré'],
    termine: ['terminé'],
    tempsPreparationLivreur: ['temps de préparation livreur (s)'],
    tempsService: ['temps de service (s)'],
    tempsParcours: ['temps de parcours (s)'],
    codePostalMajoritaire: ['code postal majoritaire']
  },
  taches: {
    nomTournee: ['Tournée', 'tournée', 'tournee'],
    date: ['Date', 'date', 'jour'],
    entrepot: ['Entrepôt', 'entrepot'],
    livreur: ['Livreur', 'livreur'],
    sequence: ['Séquence', 'séquence'],
    avancement: ['Avancement', 'avancement'],
    completedBy: ['Complété par', 'complété par'],
    poids: ['Poids', 'poids', 'poids (kg)'],
    items: ['Items', 'items'],
    heureDebutCreneau: ['Départ', 'départ'],
    heureFinCreneau: ['Arrivée', 'arrivée'],
    heureArriveeApprox: ['Arrivée approximative'],
    heureArriveeReelle: ["Heure d'arrivée sur site", "heure d'arrivee sur site"],
    heureCloture: ['Heure de clôture', 'heure de clôture'],
    tempsService: ['temps de service', 'temps de service (s)'],
    tempsServiceReel: ['temps de service réel'],
    retard: ['Retard (s)', 'retard (s)'],
    ville: ['Ville', 'ville'],
    codePostal: ['Code postal', 'code postal'],
    notation: ['Notez votre livraison'],
    commentaire: ["Qu'avez vous pensé de la livraison de votre commande?"],
  },
};

function findHeader(header: string, fileType: 'tournees' | 'taches'): string | null {
    if (!header) return null;
    const lowerHeader = header.toLowerCase().trim();
    for (const key in headerAliases[fileType]) {
        if (headerAliases[fileType][key].map(h => h.toLowerCase().trim()).includes(lowerHeader)) {
            return key;
        }
    }
    return null;
}

function parseTime(value: any): number {
    if (typeof value === 'number') { 
        if (value > 1) {
             const date = XLSX.SSF.parse_date_code(value);
             if(date.H || date.M || date.S) return (date.H || 0) * 3600 + (date.M || 0) * 60 + (date.S || 0);
        }
        return Math.round(value * 24 * 60 * 60); 
    }
    if (typeof value === 'string') {
        const parts = value.split(':').map(Number);
        if (parts.length >= 2) {
            return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
        }
    }
    return 0;
}

function parseDate(value: any): string {
    if (!value) return '';
    try {
        if (typeof value === 'number' && value > 1) {
            const date = XLSX.SSF.parse_date_code(value);
            if (date.y && date.m && date.d) {
                return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
            }
        }
        if (typeof value === 'string') {
            let date: Date;
            if (value.includes('/')) {
                const parts = value.split(' ')[0].split('/');
                if (parts.length === 3) {
                    date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                } else {
                    date = new Date(value);
                }
            } else {
                date = new Date(value);
            }
            if (!isNaN(date.getTime())) {
                return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            }
        }
    } catch(e) {
      console.error(`Failed to parse date: ${value}`, e);
    }
    return '';
}


function normalizeData(data: any[][], fileType: 'tournees' | 'taches', tourneeStartTimes?: Map<string, number>): any[] {
  if (data.length < 2) return [];

  const headers = data[0].map(h => String(h).trim());
  const headerMap: Record<number, string> = {};
  const foundHeaders = new Set<string>();
  
  const colMap: Record<string, number> = {};

  for (let i = 0; i < headers.length; i++) {
      const foundKey = findHeader(headers[i], fileType);
      if (foundKey) {
        headerMap[i] = foundKey;
        foundHeaders.add(foundKey);
        colMap[foundKey] = i;
      }
  }

  const mandatoryHeaders = {
    tournees: ['nom', 'date', 'entrepot'],
    taches: ['nomTournee', 'date', 'entrepot']
  };

  const missingMandatoryHeaders = mandatoryHeaders[fileType].filter(h => !foundHeaders.has(h));
  if (missingMandatoryHeaders.length > 0) {
      const aliasExamples = missingMandatoryHeaders.map(h => {
        const aliases = headerAliases[fileType][h];
        return aliases && aliases.length > 0 ? `'${aliases[0]}'` : h;
      }).join('; ');
      throw new Error(`En-têtes obligatoires manquants dans le fichier ${fileType}: ${missingMandatoryHeaders.join(', ')}. Exemples attendus: ${aliasExamples}.`);
  }

  const numericKeys = [
      'distancePrevue', 'distanceReelle', 'dureePrevue', 'dureeReelle',
      'capaciteBacs', 'bacsPrevus', 'capacitePoids', 'poidsPrevu', 'poids',
      'sequence', 'items', 'tempsServiceReel', 'retard', 'notation',
      'tempsPreparationLivreur', 'tempsService', 'tempsParcours'
  ];
  const timeKeys = [
      'heureDepartReelle', 'heureFinReelle', 'heureDepartPrevue', 'heureFinPrevue',
      'heureDebutCreneau', 'heureFinCreneau', 'heureArriveeApprox', 'heureCloture', 'heureArriveeReelle',
      'demarre', 'termine'
  ];

  const normalized = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.every(cell => cell === null || cell === '')) {
        continue;
    }
      
    const newRow: any = {};

    let hasMandatoryData = true;
    for (const header of mandatoryHeaders[fileType]) {
        const colIndex = Object.keys(headerMap).find(k => headerMap[parseInt(k)] === header);
        if (colIndex === undefined || row[parseInt(colIndex)] === null || String(row[parseInt(colIndex)]).trim() === '') {
            hasMandatoryData = false;
            break;
        }
    }
    if (!hasMandatoryData) {
        continue;
    }
    
    for (const colIndex in headerMap) {
      const key = headerMap[colIndex];
      let value = row[colIndex];
      
      const isOptionalNullable = ['notation', 'commentaire', 'livreur', 'completedBy'].includes(key);

      if (value === null || value === undefined || String(value).toLowerCase().trim() === 'null' || String(value).trim() === '') {
        newRow[key] = isOptionalNullable ? null : 0;
        continue;
      }

      if (key === 'date') {
          newRow[key] = parseDate(value);
      } else if (timeKeys.includes(key)) {
          newRow[key] = parseTime(value);
      } else if (numericKeys.includes(key)) {
          const num = parseFloat(String(value).replace(',', '.'));
          newRow[key] = isNaN(num) ? (isOptionalNullable ? null : 0) : num;
           if (key === 'distancePrevue' && headers[colIndex].toLowerCase().includes('(m)')) {
              newRow[key] = newRow[key] / 1000;
           }
      } else {
          newRow[key] = String(value).trim();
      }
    }
    
    if (fileType === 'tournees') {
        if (newRow.nom && String(newRow.nom).toUpperCase().startsWith('R')) {
            continue;
        }
        if (!newRow.heureDepartReelle && newRow.demarre) {
            newRow.heureDepartReelle = newRow.demarre;
        }
    }
    
    if (fileType === 'taches') {
        if (!newRow.heureArriveeReelle && colMap['heureCloture'] !== undefined) {
             const clotureValue = row[colMap['heureCloture']];
             if (clotureValue !== null && clotureValue !== undefined) {
                newRow.heureArriveeReelle = parseTime(clotureValue);
             }
        }
        
        if (tourneeStartTimes) {
            const uniqueId = `${newRow.nomTournee}|${newRow.date}|${newRow.entrepot}`;
            const tourneeStartTime = tourneeStartTimes.get(uniqueId);
            const twelveHoursInSeconds = 12 * 3600;

            if (tourneeStartTime && newRow.heureCloture < tourneeStartTime - twelveHoursInSeconds) {
                newRow.heureCloture += 24 * 3600;
                newRow.heureArriveeReelle += 24 * 3600;
            }
        }
    }

    normalized.push(newRow);
  }
  return normalized;
}

function mergeData(tournees: Tournee[], taches: Tache[]): MergedData[] {
  const tourneeMap = new Map(tournees.map((t) => [t.uniqueId, t]));
  return taches.map((tache, index) => {
    const tournee = tourneeMap.get(tache.tourneeUniqueId) || null;
    return {
      ...tache,
      ordre: index + 1,
      tournee: tournee,
      depot: getNomDepot(tache.entrepot), 
    };
  });
}


self.addEventListener('message', async (event: MessageEvent) => {
  try {
    const { tourneesFile, tachesFile } = event.data;

    const [tourneesBuffer, tachesBuffer] = await Promise.all([
      tourneesFile.arrayBuffer(),
      tachesFile.arrayBuffer()
    ]);
    
    const tourneesWb = XLSX.read(tourneesBuffer, { type: 'buffer' });
    const tachesWb = XLSX.read(tachesBuffer, { type: 'buffer' });

    const tourneesSheet = tourneesWb.Sheets[tourneesWb.SheetNames[0]];
    const tachesSheet = tachesWb.Sheets[tachesWb.SheetNames[0]];

    const tourneesJson = XLSX.utils.sheet_to_json(tourneesSheet, { header: 1, defval: null });
    const tachesJson = XLSX.utils.sheet_to_json(tachesSheet, { header: 1, defval: null });

    const rawTournees = normalizeData(tourneesJson, 'tournees');
    
    if (rawTournees.length === 0) {
        throw new Error("Aucune donnée de tournée n'a pu être lue. Vérifiez le fichier des tournées et ses en-têtes.");
    }
    
    const tourneeStartTimes = new Map<string, number>();
    const tournees: Tournee[] = rawTournees.map((t: any) => {
      const uniqueId = `${t.nom}|${t.date}|${t.entrepot}`;
      const startTime = t.heureDepartReelle || t.demarre || t.heureDepartPrevue;
      tourneeStartTimes.set(uniqueId, startTime);
      return {
        ...t,
        bacsReels: 0,
        poidsReel: 0,
        uniqueId: uniqueId,
        heureDepartReelle: startTime
      };
    });

    const rawTaches = normalizeData(tachesJson, 'taches', tourneeStartTimes);

    if (rawTaches.length === 0) {
        throw new Error("Aucune donnée de tâche n'a pu être lue. Vérifiez le fichier des tâches et ses en-têtes.");
    }
    
    const taches: Tache[] = rawTaches.map((t: any) => ({
      ...t,
      tourneeUniqueId: `${t.nomTournee}|${t.date}|${t.entrepot}`
    }));

    const mergedData = mergeData(tournees, taches);
    
    if (!mergedData || mergedData.length === 0) {
       throw new Error("La fusion des données a échoué. Aucune donnée n'a été générée.");
    }

    self.postMessage({ type: 'success', data: mergedData });

  } catch (error: any) {
    self.postMessage({ type: 'error', error: `Erreur lors du traitement des fichiers: ${error.message}` });
  }
});
