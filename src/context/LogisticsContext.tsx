
'use client';

import { createContext, useContext, useReducer, ReactNode, Dispatch, useEffect, useState, useMemo } from 'react';
import type { AnalysisData, MergedData } from '@/lib/types';
import { analyzeData } from '@/lib/dataAnalyzer';
import { DateRange } from 'react-day-picker';

// 1. State & Action Types
type State = {
  tourneesFile: File | null;
  tachesFile: File | null;
  isLoading: boolean;
  error: string | null;
  analysisData: AnalysisData | null;
  filters: Record<string, any>;
  rawData: MergedData[] | null;
  filteredData: MergedData[] | null;
};

type Action =
  | { type: 'SET_FILE'; fileType: 'tournees' | 'taches'; file: File | null }
  | { type: 'START_PROCESSING' }
  | { type: 'PROCESSING_SUCCESS'; data: MergedData[] }
  | { type: 'PROCESSING_ERROR'; error: string }
  | { type: 'SET_FILTERS'; filters: Record<string, any> }
  | { type: 'RESET' };

// 2. Initial State
const initialState: State = {
  tourneesFile: null,
  tachesFile: null,
  isLoading: false,
  error: null,
  analysisData: null,
  rawData: null,
  filteredData: null,
  filters: {
    punctualityThreshold: 959,
    tours100Mobile: false,
    excludeMadDelays: false,
    madDelays: [],
    lateTourTolerance: 0,
  },
};

// 3. Reducer
function logisticsReducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_FILE':
      return { ...state, [`${action.fileType}File`]: action.file, error: null };
    case 'START_PROCESSING':
      return { ...state, isLoading: true, error: null };
    case 'PROCESSING_SUCCESS':
        const initialAnalysis = analyzeData(action.data, state.filters);
        return { 
            ...state, 
            isLoading: false, 
            rawData: action.data, 
            filteredData: action.data,
            analysisData: initialAnalysis,
            error: null 
        };
    case 'PROCESSING_ERROR':
      return { ...state, isLoading: false, error: action.error, rawData: null, analysisData: null, filteredData: null };
    case 'SET_FILTERS':
      return { ...state, filters: action.filters };
    case 'RESET':
      return { ...initialState };
    default:
      return state;
  }
}

// 4. Context Definition
interface LogisticsContextProps {
  state: State;
  dispatch: Dispatch<Action>;
}

const LogisticsContext = createContext<LogisticsContextProps | undefined>(undefined);

// 5. Provider Component
export function LogisticsProvider({ children }: { children: ReactNode }) {
  const [internalState, dispatch] = useReducer(logisticsReducer, initialState);
  const [worker, setWorker] = useState<Worker | null>(null);

  useEffect(() => {
    const newWorker = new Worker(new URL('../workers/parser.worker.ts', import.meta.url));
    setWorker(newWorker);

    newWorker.onmessage = (event) => {
      const { type, data, error } = event.data;
      if (type === 'success') {
        dispatch({ type: 'PROCESSING_SUCCESS', data });
      } else {
        dispatch({ type: 'PROCESSING_ERROR', error });
      }
    };

    newWorker.onerror = (error) => {
      dispatch({ type: 'PROCESSING_ERROR', error: `Erreur du worker: ${error.message}` });
    };

    return () => newWorker.terminate();
  }, []);
  
  useEffect(() => {
    if (internalState.tourneesFile && internalState.tachesFile && worker && !internalState.rawData && !internalState.isLoading) {
      dispatch({ type: 'START_PROCESSING' });
      worker.postMessage({
        tourneesFile: internalState.tourneesFile,
        tachesFile: internalState.tachesFile
      });
    }
  }, [internalState.tourneesFile, internalState.tachesFile, internalState.rawData, internalState.isLoading, worker]);

  const state = useMemo(() => {
      if (!internalState.rawData) {
        return internalState;
      }

      // --- Pre-filtering for 100% mobile tours ---
      let dataToProcess = internalState.rawData;
      if (internalState.filters.tours100Mobile) {
          // Group all tasks by tour from the raw data
          const allTasksByTour = new Map<string, MergedData[]>();
          internalState.rawData.forEach(task => {
              if (!allTasksByTour.has(task.tourneeUniqueId)) {
                  allTasksByTour.set(task.tourneeUniqueId, []);
              }
              allTasksByTour.get(task.tourneeUniqueId)!.push(task);
          });

          // Identify tours that are 100% mobile
          const mobileTourIds = new Set<string>();
          for (const [tourId, tasks] of allTasksByTour.entries()) {
              if (tasks.every(t => t.completedBy?.toLowerCase() === 'mobile')) {
                  mobileTourIds.add(tourId);
              }
          }
          // Filter the data to only include these tours
          dataToProcess = internalState.rawData.filter(task => mobileTourIds.has(task.tourneeUniqueId));
      }
      
      const filtered = dataToProcess.filter(item => {
            if (!item.tournee) return false;
            
            // Date filters
            if (internalState.filters.selectedDate) {
               if (item.date !== internalState.filters.selectedDate) return false;
            } else if (internalState.filters.dateRange) {
              const { from, to } = internalState.filters.dateRange as DateRange;
              const itemDate = new Date(item.date);
              itemDate.setHours(0,0,0,0); // Normalize item date
              if (from) {
                const fromDate = new Date(from);
                fromDate.setHours(0,0,0,0); // Normalize from date
                if (itemDate < fromDate) return false;
              }
              if (to) {
                const toDate = new Date(to);
                toDate.setHours(23,59,59,999); // Include the end date
                if (itemDate > toDate) return false;
              }
            }

            if (internalState.filters.depot && !item.tournee.entrepot.startsWith(internalState.filters.depot)) return false;
            if (internalState.filters.entrepot && item.tournee.entrepot !== internalState.filters.entrepot) return false;
            if (internalState.filters.city && item.ville !== internalState.filters.city) return false;
            if (internalState.filters.codePostal && item.codePostal !== internalState.filters.codePostal) return false;
            if (internalState.filters.heure && new Date(item.heureCloture * 1000).getUTCHours() !== parseInt(internalState.filters.heure)) return false;
            
             // MAD Delays Filter
            if (internalState.filters.excludeMadDelays && internalState.filters.madDelays && internalState.filters.madDelays.length > 0) {
                const madSet = new Set(internalState.filters.madDelays);
                const madKey = `${item.tournee.entrepot}|${item.date}`;
                if(madSet.has(madKey)) return false;
            }
            
            return true;
      });

      // Handle "Top Postal Codes" as it requires pre-aggregation
      let dataToAnalyze = filtered;
      
      if (internalState.filters.topPostalCodes) {
            const postalCodeCounts = dataToAnalyze.reduce((acc, item) => {
                if (item.codePostal) {
                    acc[item.codePostal] = (acc[item.codePostal] || 0) + 1;
                }
                return acc;
            }, {} as Record<string, number>);

            const sortedPostalCodes = Object.keys(postalCodeCounts).sort((a, b) => postalCodeCounts[b] - postalCodeCounts[a]);
            const topCodes = new Set(sortedPostalCodes.slice(0, internalState.filters.topPostalCodes));
            
            dataToAnalyze = dataToAnalyze.filter(item => item.codePostal && topCodes.has(item.codePostal));
      }

      const analysis = analyzeData(dataToAnalyze, internalState.filters);
      return { ...internalState, filteredData: dataToAnalyze, analysisData: analysis };

  }, [internalState]);
  

  return (
    <LogisticsContext.Provider value={{ state, dispatch }}>
      {children}
    </LogisticsContext.Provider>
  );
}

// 6. Custom Hook
export function useLogistics() {
  const context = useContext(LogisticsContext);
  if (context === undefined) {
    throw new Error('useLogistics must be used within a LogisticsProvider');
  }
  // This hook now returns the dynamically computed state
  return context;
}
