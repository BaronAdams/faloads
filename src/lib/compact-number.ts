/** Compact display only: the original numeric value is never rounded in storage. */
export function compactNumber(value: number, limit = 5) {
  const full = String(value).replace(".", ",");
  if (full.length <= limit) return full;
  for (let decimals = 4; decimals >= 0; decimals--) {
    const rounded = Number(value.toFixed(decimals));
    const text = String(rounded).replace(".", ",");
    if (text.length <= limit && (rounded !== 0 || value === 0)) return text;
  }
  for (let precision = 3; precision >= 0; precision--) {
    const text = value
      .toExponential(precision)
      .replace(/\.0+(?=e)/, "")
      .replace("e+", "e")
      .replace(".", ",");
    if (text.length <= limit) return text;
  }
  return value.toExponential(0).replace("e+", "e");
}
