/** Quotes a CSV field. A leading = + - @ or tab would run as a formula when opened in a spreadsheet, so it gets a leading apostrophe. */
export function csvField(value: string | number): string {
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const csvRow = (fields: (string | number)[]) => fields.map(csvField).join(",");
