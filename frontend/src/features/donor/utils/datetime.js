// Helpers between <input type="datetime-local"> values (local time, no timezone)
// and the API's ISO 8601 strings (UTC, with "Z").

const pad = (n) => String(n).padStart(2, '0');

/** Date -> "YYYY-MM-DDTHH:mm" in the browser's local time, for datetime-local inputs. */
export const toLocalInput = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** "YYYY-MM-DDTHH:mm" (local) -> ISO string with timezone, or "" if empty/invalid. */
export const fromLocalInput = (value) => {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
};

/** Local input value for "now + minutes". */
export const localInputFromNow = (minutes) => toLocalInput(Date.now() + minutes * 60 * 1000);

/** Readable local date-time for display. */
export const formatDateTime = (value) => (value ? new Date(value).toLocaleString() : '—');
