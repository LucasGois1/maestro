const MS_IN_SECOND = 1_000;
const MS_IN_MINUTE = 60 * MS_IN_SECOND;
const MS_IN_HOUR = 60 * MS_IN_MINUTE;

export function formatDurationMs(ms: number | null): string {
  if (ms === null) {
    return '—';
  }
  if (!Number.isFinite(ms) || ms < 0) {
    return '—';
  }
  if (ms < MS_IN_SECOND) {
    return `${Math.round(ms).toString()}ms`;
  }
  if (ms < MS_IN_MINUTE) {
    const seconds = Math.round(ms / MS_IN_SECOND);
    return `${seconds.toString()}s`;
  }
  if (ms < MS_IN_HOUR) {
    const minutes = Math.floor(ms / MS_IN_MINUTE);
    const seconds = Math.round((ms % MS_IN_MINUTE) / MS_IN_SECOND);
    if (seconds === 0) {
      return `${minutes.toString()}m`;
    }
    return `${minutes.toString()}m ${seconds.toString()}s`;
  }
  const hours = Math.floor(ms / MS_IN_HOUR);
  const minutes = Math.round((ms % MS_IN_HOUR) / MS_IN_MINUTE);
  if (minutes === 0) {
    return `${hours.toString()}h`;
  }
  return `${hours.toString()}h ${minutes.toString()}m`;
}
