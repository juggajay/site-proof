/**
 * useShellDocketParam — read the :docketId route param for the /m/dockets/:docketId
 * sub-tree. Tiny wrapper so screens don't each reach into useParams with the same
 * key (mirrors useShellLotParam in the lots sub-tree).
 */
import { useParams } from 'react-router-dom';

export function useShellDocketParam(): string | undefined {
  const { docketId } = useParams<{ docketId: string }>();
  return docketId;
}
