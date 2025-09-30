
'use client';

import { createContext, useContext, useReducer, ReactNode, Dispatch, useEffect, useState, useMemo } from 'react';
import type { AnalysisData, MergedData } from '@/lib/types';
import { analyzeData } from '@/lib/dataAnalyzer';

// 1. State & Action Types
type State = {
  tourneesFile: File | null;
  tachesFile: File | null;
  isLoading: boolean;
  error: string | null;
  analysisData: AnalysisData | null;
  filters: Record<string, any>;
};

type Action =
  | { type: 'SET_FILE'; fileType: 'tournees' | 'taches'; file: File | null }
  | { type: 'START_PROCESSING' }
  | { type: 'PROCESSING_SUCCESS'; data: AnalysisData }
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
      return { ...state, isLoading: false, analysisData: action.data, error: null };
    case 'PROCESSING_ERROR':
      return { ...state, isLoading: false, error: action.error, analysisData: null };
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
  mergedData: MergedData[] | null;
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
        const analyzed = analyzeData(data, state.filters);
        dispatch({ type: 'PROCESSING_SUCCESS', data: { ...analyzed, rawData: data, filteredData: data } });
      } else {
        dispatch({ type: 'PROCESSING_ERROR', error });
      }
    };

    newWorker.onerror = (error) => {
      dispatch({ type: 'PROCESSING_ERROR', error: `Erreur du worker: ${error.message}` });
    };

    return () => newWorker.terminate();
  }, [state.filters]);
  
  useEffect(() => {
    if (state.tourneesFile && state.tachesFile && worker && !state.analysisData && !state.isLoading) {
      dispatch({ type: 'START_PROCESSING' });
      worker.postMessage({
        tourneesFile: state.tourneesFile,
        tachesFile: state.tachesFile
      });
    }
  }, [state.tourneesFile, state.tachesFile, state.analysisData, state.isLoading, worker]);

  const { mergedData, analysisData } = useMemo(() => {
    if (!state.analysisData || !state.analysisData.rawData) {
        return { mergedData: null, analysisData: null };
    }
    const filtered = state.analysisData.rawData.filter(item => {
        if (!item.tournee) return false;
        if (state.filters.depot && !item.tournee.entrepot.startsWith(state.filters.depot)) return false;
        if (state.filters.entrepot && item.tournee.entrepot !== state.filters.entrepot) return false;
        if (state.filters.city && item.ville !== state.filters.city) return false;
        if (state.filters.codePostal && item.codePostal !== state.filters.codePostal) return false;
        return true;
    });

    const analyzed = analyzeData(filtered, state.filters);
    return { mergedData: filtered, analysisData: { ...analyzed, rawData: state.analysisData.rawData, filteredData: filtered } };
  }, [state.analysisData, state.filters]);
  

  return (
    <LogisticsContext.Provider value={{ state: { ...state, analysisData }, dispatch, mergedData }}>
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
