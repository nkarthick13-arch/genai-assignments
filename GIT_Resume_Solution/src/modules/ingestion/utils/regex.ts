export const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
export const PHONE_REGEX = /(\+91[\-\s]?)?[0]?(91)?[789]\d{9}/;
export const EXPERIENCE_REGEX = /(\d+(\.\d+)?)\s*(years|yrs|year|yr)/i;

export function extractEmail(text: string): string | null {
  const match = text.match(EMAIL_REGEX);
  return match ? match[0] : null;
}

export function extractPhone(text: string): string | null {
  const match = text.match(PHONE_REGEX);
  return match ? match[0].replace(/\s+/g, '') : null;
}

export function extractExperienceYears(text: string): number | null {
  const match = text.match(EXPERIENCE_REGEX);
  if (!match) return null;

  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}
