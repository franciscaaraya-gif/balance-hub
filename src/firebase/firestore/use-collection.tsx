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
        // Obtenemos la ruta si existe (consultas estándar) o una etiqueta para consultas de grupo
        const path = (memoizedTargetRefOrQuery as any).path || "collection-group";

        const contextualError = new FirestorePermissionError({
          operation: 'list',
          path: path,
        });

        setError(contextualError);
        setData(null);
        setIsLoading(false);
        
        // Emitimos el error para que el listener global lo capture y lo muestre
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