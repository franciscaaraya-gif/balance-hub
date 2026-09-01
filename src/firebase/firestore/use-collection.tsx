'use client';

import { useState, useEffect } from 'react';
import {
  Query,
  onSnapshot,
  DocumentData,
  FirestoreError,
  QuerySnapshot,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export type WithId<T> = T & { id: string };

export interface UseCollectionResult<T> {
  data: WithId<T>[] | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to subscribe to a Firestore collection or query in real-time.
 */
export function useCollection<T = any>(
    memoizedTargetRefOrQuery: (Query<DocumentData> & {__memo?: boolean}) | null | undefined,
): UseCollectionResult<T> {
  type ResultItemType = WithId<T>;
  
  const [data, setData] = useState<ResultItemType[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!memoizedTargetRefOrQuery) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(
      memoizedTargetRefOrQuery,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const results: ResultItemType[] = [];
        snapshot.forEach((doc) => {
          results.push({ ...(doc.data() as T), id: doc.id });
        });
        setData(results);
        setError(null);
        setIsLoading(false);
      },
      async (serverError: FirestoreError) => {
        // Diagnóstico mejorado para rutas de consulta
        let reportedPath = "dynamic-query";
        const queryAny = memoizedTargetRefOrQuery as any;
        
        // Intentar extraer una ruta útil para el reporte de error de permisos
        if (queryAny.path) {
          reportedPath = queryAny.path;
        } else if (queryAny._query?.path) {
          reportedPath = queryAny._query.path.toString();
        } else if (queryAny._query?.collectionGroup) {
          reportedPath = `collectionGroup(${queryAny._query.collectionGroup})`;
        } else if (serverError.code === 'permission-denied') {
          // Si no podemos determinar la ruta exacta pero es un error de permisos,
          // usamos un marcador que ayude a identificar el fallo en reglas globales
          reportedPath = "collection-group-query";
        }

        const contextualError = new FirestorePermissionError({
          operation: 'list',
          path: reportedPath,
        });

        setError(contextualError);
        setData(null);
        setIsLoading(false);
        
        // Emitir el error contextual para el listener global
        errorEmitter.emit('permission-error', contextualError);
      }
    );

    return () => unsubscribe();
  }, [memoizedTargetRefOrQuery]);

  if(memoizedTargetRefOrQuery && !memoizedTargetRefOrQuery.__memo) {
    throw new Error('useCollection: Target was not properly memoized using useMemoFirebase.');
  }

  return { data, isLoading, error };
}