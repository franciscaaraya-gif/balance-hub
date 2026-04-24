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

/** Utility type to add an 'id' field to a given type T. */
export type WithId<T> = T & { id: string };

/**
 * Interface for the return value of the useCollection hook.
 * @template T Type of the document data.
 */
export interface UseCollectionResult<T> {
  data: WithId<T>[] | null;
  isLoading: boolean;
  error: FirestoreError | Error | null;
}

/**
 * React hook to subscribe to a Firestore collection or query in real-time.
 * Handles nullable references/queries and prevents subscription to root.
 */
export function useCollection<T = any>(
    memoizedTargetRefOrQuery: (Query<DocumentData> & {__memo?: boolean}) | null | undefined,
): UseCollectionResult<T> {
  type ResultItemType = WithId<T>;
  
  const [data, setData] = useState<ResultItemType[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<FirestoreError | Error | null>(null);

  useEffect(() => {
    // Guard estricta: No suscribirse si el target es nulo o no es un objeto válido
    if (!memoizedTargetRefOrQuery || typeof memoizedTargetRefOrQuery !== 'object') {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Validación de tipo para asegurar que es un Query/CollectionReference de Firestore
    if (!('type' in memoizedTargetRefOrQuery)) {
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
        // Determinación de ruta para el error contextual
        let path = "query-global";
        if ('path' in memoizedTargetRefOrQuery) {
          path = (memoizedTargetRefOrQuery as any).path;
        } else {
          // Intentar obtener el nombre de la colección del query interno si es posible
          try {
            path = (memoizedTargetRefOrQuery as any)._query?.path?.canonicalString() || "collection-group";
          } catch (e) {
            path = "collection-group";
          }
        }

        const contextualError = new FirestorePermissionError({
          operation: 'list',
          path,
        });

        setError(contextualError);
        setData(null);
        setIsLoading(false);

        // Emitir error global para el listener de Firebase Studio
        errorEmitter.emit('permission-error', contextualError);
      }
    );

    return () => unsubscribe();
  }, [memoizedTargetRefOrQuery]);

  if(memoizedTargetRefOrQuery && !memoizedTargetRefOrQuery.__memo) {
    throw new Error('useCollection: Target was not properly memoized using useMemoFirebase. This will cause infinite loops.');
  }

  return { data, isLoading, error };
}
