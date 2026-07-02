import { describe, expect, it } from 'vitest';
import {
  getClassicPortalPathForSubbieShellPath,
  getSubbieShellPathForClassicPath,
} from './subbieShellRoutes';

describe('subbie shell route mapping', () => {
  it.each([
    ['/subcontractor-portal', '/p'],
    ['/subcontractor-portal/docket/new', '/p/docket'],
    ['/subcontractor-portal/dockets', '/p/dockets'],
    ['/subcontractor-portal/work', '/p/work'],
    ['/subcontractor-portal/itps', '/p/itps'],
    // Holds & Tests has no shell surface — classic deep links land on home.
    ['/subcontractor-portal/holdpoints', '/p'],
    ['/subcontractor-portal/tests', '/p'],
    ['/subcontractor-portal/ncrs', '/p/ncrs'],
    ['/subcontractor-portal/documents', '/p/docs'],
    ['/my-company', '/p/company'],
    ['/subcontractor-portal/docket/docket%201', '/p/docket/docket%201'],
    ['/subcontractor-portal/lots/lot%201/itp', '/p/lots/lot%201/itp'],
  ])('maps classic path %s to shell path %s', (classicPath, shellPath) => {
    expect(getSubbieShellPathForClassicPath(classicPath)).toBe(shellPath);
  });

  it.each([
    ['/p', '/subcontractor-portal'],
    ['/p/', '/subcontractor-portal'],
    ['/p/docket', '/subcontractor-portal/docket/new'],
    ['/p/dockets', '/subcontractor-portal/dockets'],
    ['/p/work', '/subcontractor-portal/work'],
    ['/p/itps', '/subcontractor-portal/itps'],
    ['/p/ncrs', '/subcontractor-portal/ncrs'],
    ['/p/docs', '/subcontractor-portal/documents'],
    ['/p/company', '/my-company'],
    ['/p/docket/docket%201', '/subcontractor-portal/docket/docket%201'],
    ['/p/lots/lot%201/itp', '/subcontractor-portal/lots/lot%201/itp'],
  ])('maps shell path %s to classic path %s', (shellPath, classicPath) => {
    expect(getClassicPortalPathForSubbieShellPath(shellPath)).toBe(classicPath);
  });

  it('returns null for unknown paths', () => {
    expect(getSubbieShellPathForClassicPath('/subcontractor-portal/unknown')).toBeNull();
    expect(getClassicPortalPathForSubbieShellPath('/p/unknown')).toBeNull();
    // /p/quality no longer exists in the shell.
    expect(getClassicPortalPathForSubbieShellPath('/p/quality')).toBeNull();
  });
});
