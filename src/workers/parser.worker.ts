/// <reference lib="webworker" />
import * as XLSX from 'xlsx';
import type { Tournee, Tache } from '../lib/types';

const headerAliases: Record<string, Record<string, string[]>> = {
  tournees: {
    nom: ['Tournée', 'tournée', 'nom'],
    date: ['Date', 'date'],
    entrepot: ['Entrepôt', 'entrepot', 'warehouse'],
    livreur: ['Livreur', 'livreur', 'driver'],
    poidsPrevu: ['Poids Prévu (kg)', 'poids prevu', 'poids_prevu'],
    bacsPrevus: ['Bacs Prévus', 'bacs prevus', 'bacs_prevus'],
    kmPrevus: ['KM Prévus', 'km prevus', 'km_prevus'],
    dureePrevue: ['Durée Prévue', 'duree prevue', 'duree_prevue'],
    heureDepartPrevue: ['Heure Départ Prévue', 'heure depart prevue', 'heure_depart_prevue'],
  },
  taches: {
    nomTournee: ['Tournée', 'tournée', 'nom'],
    date: ['Date', 'date'],
    entrepot: ['Entrepôt', 'entrepot', 'warehouse'],
    heurePrevue: ['Heure Prévue', 'heure prevue', 'heure_prevue'],
    heureRealisee: ['Heure Réalisée', 'heure realisee', 'heure_realisee'],
    poidsReal: ['Poids Réel (kg)', 'poids reel', 'poids_reel'],
    ville: ['Ville', 'ville', 'city'],
    codePostal: ['Code Postal', 'code postal', 'postal_code'],
    notation: ['Notation', 'notation', 'rating'],
    commentaire: ['Commentaire', 'commentaire', 'comment'],
    statut: ['Statut', 'statut', 'status'],
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

function normalizeData(data: any[][], fileType: 'tournees' | 'taches'): any[] {
  if (data.length < 2) return [];

  const headers = data[0];
  const headerMap: Record<number, string> = {};
  for (let i = 0; i < headers.length; i++) {
      const foundKey = findHeader(String(headers[i]), fileType);
      if (foundKey) {
        headerMap[i] = foundKey;
      }
  }

  const normalized = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const newRow: any = {};
    let hasData = false;
    for (const colIndex in headerMap) {
      const key = headerMap[colIndex];
      let value = row[colIndex];
      hasData = hasData || (value !== null && value !== undefined && value !== '');
      
      if (['date', 'heurePrevue', 'heureRealisee', 'heureDepartPrevue'].includes(key)) {
          if (typeof value === 'number') { // Excel date/time format
              if (value > 1) { // It's a date
                  const date = XLSX.SSF.parse_date_code(value);
                  newRow[key] = `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
              } else { // It's a time
                  newRow[key] = Math.round(value * 24 * 60 * 60); // to seconds
              }
          } else if (typeof value === 'string') {
              if (key === 'date' && value.match(/\d{2}\/\d{2}\/\d{4}/)) {
                  const parts = value.split('/');
                  newRow[key] = `${parts[2]}-${parts[1]}-${parts[0]}`;
              } else if (value.match(/\d{2}:\d{2}:\d{2}/) || value.match(/\d{2}:\d{2}/)) {
                  const parts = value.split(':').map(Number);
                  newRow[key] = (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
              } else {
                 newRow[key] = value;
              }
          }
      } else if (['poidsPrevu', 'bacsPrevus', 'kmPrevus', 'dureePrevue', 'poidsReal', 'notation'].includes(key)) {
          newRow[key] = parseFloat(value) || (key === 'notation' ? null : 0);
          if (key === 'dureePrevue' && newRow[key] > 0 && newRow[key] < 100) { // Assume it's in hours if small number
              newRow[key] *= 3600;
          }
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
      tourneeUniqueId: `${t.nomTournee}-${t.date}-${t.entrepot}`,
      statut: t.statut?.toLowerCase() === 'complete' ? 'complete' : 'incomplete'
    }));

    self.postMessage({ type: 'success', data: { tournees, taches } });

  } catch (error: any) {
    self.postMessage({ type: 'error', error: error.message });
  }
});
