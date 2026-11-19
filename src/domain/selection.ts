export function toggleSelection(
  keys: string[],
  key: string,
  additive: boolean,
) {
  return !additive
    ? [key]
    : keys.includes(key)
      ? keys.filter((k) => k !== key)
      : [...keys, key];
}
export function selectionFamily(
  elements: { key: string; family: string }[],
  keys: string[],
) {
  const families = new Set(
    keys.map((k) => elements.find((e) => e.key === k)?.family).filter(Boolean),
  );
  return families.size === 1 ? [...families][0] : undefined;
}
