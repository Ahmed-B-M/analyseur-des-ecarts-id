/// <reference lib="webworker" />
import * as XLSX from 'xlsx';
import type { Tournee, Tache } from '../lib/types';

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
    if (typeof value === 'number') { // Excel time (fraction of a day)
        if (value > 1) { // Likely already seconds, but from a mis-formatted cell
             const date = XLSX.SSF.parse_date_code(value);
             if(date.H || date.M || date.S) return (date.H || 0) * 3600 + (date.M || 0) * 60 + (date.S || 0);
        }
        return Math.round(value * 24 * 60 * 60); // to seconds from midnight
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
        // Handle Excel's numeric date format
        if (typeof value === 'number' && value > 1) {
            const date = XLSX.SSF.parse_date_code(value);
            if (date.y && date.m && date.d) {
                return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
            }
        }
        // Handle string dates like "DD/MM/YYYY" or other standard formats
        if (typeof value === 'string') {
            let date: Date;
            if (value.includes('/')) {
                const parts = value.split(' ')[0].split('/');
                if (parts.length === 3) {
                    // Assuming DD/MM/YYYY
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
        continue; // Skip empty rows
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
      
      const isOptionalNullable = key === 'notation' || key === 'commentaire' || key === 'livreur';

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
              newRow[key] = newRow[key] / 1000; // Convert meters to km
           }
      } else {
          newRow[key] = String(value).trim();
      }
    }
    
    // --- Post-processing and fallback logic ---

    if (fileType === 'tournees') {
        if (newRow.nom && String(newRow.nom).toUpperCase().startsWith('R')) {
            continue; // Skip backup tours starting with 'R'
        }
        if (!newRow.heureDepartReelle && newRow.demarre) {
            newRow.heureDepartReelle = newRow.demarre;
        }
    }
    
    if (fileType === 'taches') {
        // Fallback for missing heureArriveeReelle
        if (!newRow.heureArriveeReelle && colMap['heureCloture'] !== undefined) {
             const clotureValue = row[colMap['heureCloture']];
             if (clotureValue !== null && clotureValue !== undefined) {
                newRow.heureArriveeReelle = parseTime(clotureValue);
             }
        }
        
        // Handle overnight tours
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
      // Fallback to heureDepartPrevue if demarre is also not available
      const startTime = t.heureDepartReelle || t.demarre || t.heureDepartPrevue;
      tourneeStartTimes.set(uniqueId, startTime);
      return {
        ...t,
        bacsReels: 0,
        poidsReel: 0,
        uniqueId: uniqueId,
        heureDepartReelle: startTime // Ensure this is set for dataAnalyzer
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

    self.postMessage({ type: 'success', data: { tournees, taches } });

  } catch (error: any) {
    self.postMessage({ type: 'error', error: `Erreur lors du traitement des fichiers: ${error.message}` });
  }
});
