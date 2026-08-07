import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';
import { apiUrl } from '@/lib/config';
import { queryKeys } from '@/lib/queryKeys';

export type OrthoStatus = 'uploading' | 'queued' | 'tiling' | 'ready' | 'failed';

export interface OrthoLayerListItem {
  id: string;
  name: string;
  capturedAt: string | null;
  status: OrthoStatus;
  boundsWgs84: [number, number, number, number] | null;
  minZoom: number | null;
  maxZoom: number | null;
  tileCount: number | null;
  tileUrlTemplate: string | null;
  diagnostics: { error?: string } | null;
  lastFailureReason: string | null;
}

export interface ReadyOrthoLayer extends OrthoLayerListItem {
  status: 'ready';
  boundsWgs84: [number, number, number, number];
  minZoom: number;
  maxZoom: number;
  tileUrlTemplate: string;
}

function isReadyOrtho(ortho: OrthoLayerListItem): ortho is ReadyOrthoLayer {
  return (
    ortho.status === 'ready' &&
    Array.isArray(ortho.boundsWgs84) &&
    ortho.boundsWgs84.length === 4 &&
    ortho.boundsWgs84.every(Number.isFinite) &&
    Number.isInteger(ortho.minZoom) &&
    Number.isInteger(ortho.maxZoom) &&
    typeof ortho.tileUrlTemplate === 'string'
  );
}

export function readyOrthoLayers(orthos: OrthoLayerListItem[] | undefined): ReadyOrthoLayer[] {
  return (orthos ?? []).filter(isReadyOrtho);
}

export function orthoTileUrl(ortho: ReadyOrthoLayer): string {
  return apiUrl(ortho.tileUrlTemplate);
}

export function useOrthoLayers(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.orthoLayers(projectId ?? 'none'),
    queryFn: async () => {
      const data = await apiFetch<{ orthos: OrthoLayerListItem[] }>(
        `/api/projects/${encodeURIComponent(projectId!)}/orthos`,
      );
      return data.orthos ?? [];
    },
    enabled: Boolean(projectId),
    staleTime: 30_000,
    refetchInterval: (query) =>
      (query.state.data as OrthoLayerListItem[] | undefined)?.some((ortho) =>
        ['uploading', 'queued', 'tiling'].includes(ortho.status),
      )
        ? 10_000
        : false,
  });
}
