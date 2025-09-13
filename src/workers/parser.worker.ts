/// <reference lib="webworker" />
import * as XLSX from 'xlsx';
import type { Tournee, Tache } from '../lib/types';

// Updated header aliases to match the user's new file structure
const headerAliases: Record<string, Record<string, string[]>> = {
  tournees: {
    date: ['Date'],
    entrepot: ['Entrepôt'],
    nom: ['Nom'],
    livreur: ['Livreur'],
    distancePrevue: ['Distance (m)'],
    distanceReelle: ['Distance réelle (m)'],
    heureDepartReelle: ['Heure de départ réelle du livreur', 'Démarré'],
    heureFinReelle: ['Terminé'],
    dureePrevue: ['Durée (s)'],
    dureeReelle: ['Durée réelle de la tournée (s)'],
    heureDepartPrevue: ['Départ'],
    heureFinPrevue: ['Fin'],
    capaciteBacs: ['Capacité Bac (bacs)'],
    bacsPrevus: ['Bac (bacs)'],
    capacitePoids: ['Capacité Poids (kg)'],
    poidsPrevu: ['Poids (kg)'],
  },
  taches: {
    date: ['Date'],
    entrepot: ['Entrepôt'],
    livreur: ['Livreur'],
    nomTournee: ['Tournée'],
    sequence: ['Séquence'],
    items: ['Items'],
    codePostal: ['Code postal'],
    heureDebutCreneau: ['Départ'],
    heureFinCreneau: ['Arrivée'],
    heureArriveeApprox: ['Arrivée approximative'],
    heureCloture: ['Heure de clôture'],
    tempsServiceReel: ['Temps de service réel'],
    retard: ['Retard (s)'],
    poids: ['Poids'],
    ville: ['Ville'],
    notation: ['Notez votre livraison'],
    commentaire: ["Qu'avez vous pensé de la livraison de votre commande?"],
  },
};

function findHeader(header: string, fileType: 'tournees' | 'taches'): string | null {
    for (const key in headerAliases[fileType]) {
        if (headerAliases[fileType][key].map(h => h.toLowerCase().trim()).includes(header.toLowerCase().trim())) {
            return key;
        }
    }
    return null;
}

function parseTime(value: any): number {
    if (typeof value === 'number') { // Excel time (fraction of a day)
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
    if (typeof value === 'number') { // Excel date
        const date = XLSX.SSF.parse_date_code(value);
        return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
    }
    if (typeof value === 'string') {
        if (value.includes('/')) {
            const parts = value.split(' ')[0].split('/');
            if(parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        if (value.match(/^\d{4}-\d{2}-\d{2}/)) {
             return value.split(' ')[0];
        }
    }
    return '';
}


function normalizeData(data: any[][], fileType: 'tournees' | 'taches'): any[] {
  if (data.length < 2) return [];

  const headers = data[0].map(h => String(h));
  const headerMap: Record<number, string> = {};
  for (let i = 0; i < headers.length; i++) {
      const foundKey = findHeader(headers[i], fileType);
      if (foundKey) {
        headerMap[i] = foundKey;
      }
  }

  const numericKeys = [
      'distancePrevue', 'distanceReelle', 'dureePrevue', 'dureeReelle',
      'capaciteBacs', 'bacsPrevus', 'capacitePoids', 'poidsPrevu',
      'sequence', 'items', 'tempsServiceReel', 'retard', 'poids', 'notation'
  ];
  const timeKeys = [
      'heureDepartReelle', 'heureFinReelle', 'heureDepartPrevue', 'heureFinPrevue',
      'heureDebutCreneau', 'heureFinCreneau', 'heureArriveeApprox', 'heureCloture'
  ];

  const normalized = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const newRow: any = {};
    let hasData = false;
    
    for (const colIndex in headerMap) {
      const key = headerMap[colIndex];
      let value = row[colIndex];
      if (value !== null && value !== undefined && value !== '') hasData = true;

      if (key === 'date') {
          newRow[key] = parseDate(value);
      } else if (timeKeys.includes(key)) {
          newRow[key] = parseTime(value);
      } else if (numericKeys.includes(key)) {
          const num = parseFloat(String(value).replace(',', '.'));
          newRow[key] = isNaN(num) ? (key === 'notation' ? null : 0) : num;
      } else {
          newRow[key] = value ? String(value).trim() : (key === 'commentaire' ? null : '');
      }
    }
    if (hasData) {
      normalized.push(newRow);
    }
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
    const rawTaches = normalizeData(tachesJson, 'taches');
    
    const tournees: Tournee[] = rawTournees.map((t: any) => ({
      ...t,
      uniqueId: `${t.nom}-${t.date}-${t.entrepot}`
    }));

    const taches: Tache[] = rawTaches.map((t: any) => ({
      ...t,
      tourneeUniqueId: `${t.nomTournee}-${t.date}-${t.entrepot}`
    }));

    self.postMessage({ type: 'success', data: { tournees, taches } });

  } catch (error: any) {
    self.postMessage({ type: 'error', error: `Erreur lors du traitement des fichiers: ${error.message}` });
  }
});
