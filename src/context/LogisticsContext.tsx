
'use client';

import { createContext, useContext, useReducer, ReactNode, Dispatch, useMemo, useEffect, useState } from 'react';
import type { Tournee, Tache, MergedData, AnalysisData } from '@/lib/types';
import { analyzeData } from '@/lib/dataAnalyzer';

// 1. State & Action Types
type State = {
  tourneesFile: File | null;
  tachesFile: File | null;
  isLoading: boolean;
  error: string | null;
  data: { tournees: Tournee[]; taches: Tache[] } | null;
  filters: Record<string, any>;
};

type Action =
  | { type: 'SET_FILE'; fileType: 'tournees' | 'taches'; file: File | null }
  | { type: 'START_PROCESSING' }
  | { type: 'PROCESSING_SUCCESS'; data: { tournees: Tournee[]; taches: Tache[] } }
  | { type: 'PROCESSING_ERROR'; error: string }
  | { type: 'SET_FILTERS'; filters: Record<string, any> }
  | { type: 'RESET' };

// 2. Initial State
const initialState: State = {
  tourneesFile: null,
  tachesFile: null,
  isLoading: false,
  error: null,
  data: null,
  filters: {
    punctualityThreshold: 15,
    tours100Mobile: false,
    excludeMadDelays: false,
    madDelays: [],
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
      if (!action.data || action.data.tournees.length === 0 || action.data.taches.length === 0) {
        return { ...state, isLoading: false, error: "Aucune donnée valide n'a été extraite. Vérifiez les fichiers." };
      }
      return { ...state, isLoading: false, data: action.data, error: null };
    case 'PROCESSING_ERROR':
      return { ...state, isLoading: false, error: action.error };
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
  mergedData: MergedData[];
  filteredData: MergedData[];
  analysisData: AnalysisData | null;
}

const LogisticsContext = createContext<LogisticsContextProps | undefined>(undefined);

// 5. Provider Component
export function LogisticsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(logisticsReducer, initialState);
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
      if (state.tourneesFile && state.tachesFile && worker && !state.data) {
        dispatch({ type: 'START_PROCESSING' });
        worker.postMessage({
            tourneesFile: state.tourneesFile,
            tachesFile: state.tachesFile,
        });
    }
  }, [state.tourneesFile, state.tachesFile, worker, state.data])

  const mergedData: MergedData[] = useMemo(() => {
    if (!state.data) return [];
    const tourneeMap = new Map(state.data.tournees.map((t) => [t.uniqueId, t]));
    return state.data.taches.map((tache, index) => ({
      ...tache,
      ordre: index + 1,
      tournee: tourneeMap.get(tache.tourneeUniqueId) || null,
    }));
  }, [state.data]);

  const filteredData = useMemo(() => {
    if (!mergedData.length) return [];
    // This could be expanded with actual filtering logic later
    return mergedData;
  }, [mergedData]);

  const analysisData: AnalysisData | null = useMemo(() => {
    if (!filteredData.length) return null;
    return analyzeData(filteredData, state.filters);
  }, [filteredData, state.filters]);

  return (
    <LogisticsContext.Provider value={{ state, dispatch, mergedData, filteredData, analysisData }}>
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
  return context;
}
