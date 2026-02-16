export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function parseTimeToMinutes(hhmm) {
  const match = /^(\d{2}):(\d{2})$/.exec(hhmm || '');
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

export function durationMinutes(startHHMM, endHHMM) {
  const start = parseTimeToMinutes(startHHMM);
  const end = parseTimeToMinutes(endHHMM);
  if (start === null || end === null) return null;
  return end >= start ? end - start : 24 * 60 - start + end;
}
