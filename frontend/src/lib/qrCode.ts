import { toString } from 'qrcode';

export { escapeHtml } from './html';

export async function generateQrSvg(text: string, size: number): Promise<string> {
  return toString(text, {
    type: 'svg',
    width: size,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  });
}
