/**
 * useShellNcrParam — read the :ncrId route param for the /m/issues/:ncrId
 * sub-tree. Tiny wrapper so screens don't each reach into useParams with the
 * same key (mirrors useShellDocketParam / useShellLotParam).
 */
import { useParams } from 'react-router-dom';

export function useShellNcrParam(): string | undefined {
  const { ncrId } = useParams<{ ncrId: string }>();
  return ncrId;
}
