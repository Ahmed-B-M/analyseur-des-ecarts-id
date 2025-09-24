
import * as XLSX from 'xlsx';

type SheetData = {
  data: any[];
  sheetName: string;
};

// Renames columns for a more friendly export
const renameHeaders = (data: any[], headerMap: Record<string, string>) => {
    return data.map(row => {
        const newRow: Record<string, any> = {};
        for (const key in row) {
            if (headerMap[key]) {
                newRow[headerMap[key]] = row[key];
            } else {
                newRow[key] = row[key];
            }
        }
        return newRow;
    });
};


export const exportToXlsx = (sheets: SheetData[], fileName: string) => {
  const wb = XLSX.utils.book_new();

  sheets.forEach(({ data, sheetName }) => {
    
    // A header map for depot analysis table for cleaner export
    const depotHeaderMap: Record<string, string> = {
        entrepot: 'Entrepôt',
        ponctualitePrev: 'Ponctualité Prév. (%)',
        ponctualiteRealisee: 'Ponctualité Réalisée (%)',
        tourneesPartiesHeureRetard: '% Tournées Départ à l\'heure / Arrivée en retard',
        notesNegativesRetard: '% Notes Négatives (1-3) en Retard',
        depassementPoids: '% Dépassement de Poids',
        intensiteTravailPlanifie: 'Intensité Travail Planifié (moy. 2h)',
        intensiteTravailRealise: 'Intensité Travail Réalisé (moy. 2h)',
        creneauPlusIntense: 'Créneau le plus intense',
        creneauMoinsIntense: 'Créneau le moins intense'
    };
    
    // A header map for postal code table
     const postalHeaderMap: Record<string, string> = {
        codePostal: 'Code Postal',
        entrepot: 'Entrepôt',
        totalLivraisons: 'Nb. Livraisons',
        livraisonsRetard: '% Livraisons en Retard',
    };

    const headerMap = sheetName.includes('Entrepôts') ? depotHeaderMap : postalHeaderMap;
    const renamedData = renameHeaders(data, headerMap);

    // Sanitize data before creating the sheet
    const processedData = renamedData.map(row => {
      const newRow: { [key: string]: any } = {};
      for (const key in row) {
        let value = row[key];
        // Extract number from intensity slots like "08h-10h (2.50)"
        if (typeof value === 'string') {
           const match = value.match(/\(([^)]+)\)/);
           if(match) {
               value = parseFloat(match[1]);
           }
        }
        // Convert percentage strings to actual numbers for Excel formatting
        if (typeof value === 'string' && value.endsWith('%')) {
          newRow[key] = parseFloat(value.replace('%', '')) / 100;
        } else {
          newRow[key] = value;
        }
      }
      return newRow;
    });

    const ws = XLSX.utils.json_to_sheet(processedData);

    // Apply percentage format to relevant columns
    if (processedData.length > 0) {
        const headers = Object.keys(processedData[0]);
        headers.forEach((header, index) => {
            if (header.includes('%')) {
                 for (let R = 1; R <= processedData.length; R++) {
                    const cell_address = { c: index, r: R };
                    const cell_ref = XLSX.utils.encode_cell(cell_address);
                    if (ws[cell_ref] && typeof ws[cell_ref].v === 'number') {
                        ws[cell_ref].z = '0.00%'; // Excel format string for percentage
                    }
                }
            }
        });
    }

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  XLSX.writeFile(wb, `${fileName}.xlsx`);
};
