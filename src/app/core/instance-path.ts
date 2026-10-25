export function isKovaInstancePath(path: string): boolean {
  return path === '/tasktracker-prueba/' || /^\/apps\/tasktracker\/tt-[a-f0-9]{32}\/$/.test(path);
}
