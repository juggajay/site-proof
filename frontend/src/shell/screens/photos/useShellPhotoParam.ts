/**
 * useShellPhotoParam — read the :documentId route param for the
 * /m/photos/:documentId sub-tree. Tiny wrapper so screens don't each reach into
 * useParams with the same key (mirrors useShellNcrParam / useShellLotParam).
 */
import { useParams } from 'react-router-dom';

export function useShellPhotoParam(): string | undefined {
  const { documentId } = useParams<{ documentId: string }>();
  return documentId;
}
