/**
 * useShellLotParam — read the :lotId route param for the /m/lots/:lotId sub-tree.
 * Tiny wrapper so screens don't each reach into useParams with the same key.
 */
import { useParams } from 'react-router-dom';

export function useShellLotParam(): string | undefined {
  const { lotId } = useParams<{ lotId: string }>();
  return lotId;
}
