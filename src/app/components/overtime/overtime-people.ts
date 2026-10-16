export function personKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('es');
}

export function personNames(members: string[], entries: string[]): Map<string, string> {
  const names = new Map<string, string>();
  // Team names take precedence over historical free-text names.
  for (const name of [...members, ...entries]) {
    const key = personKey(name);
    if (key && !names.has(key)) names.set(key, name.trim().replace(/\s+/g, ' '));
  }
  return names;
}
