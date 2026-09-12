export function normalizeStudyTime(value) {
  const match = String(value ?? "").match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const [, hours, minutes, seconds = "00"] = match;
  if (Number(hours) > 23 || Number(minutes) > 59 || Number(seconds) > 59) return null;
  return `${hours}:${minutes}:${seconds}`;
}

export function calculateEndTime(startTime, durationMinutes) {
  const normalized = normalizeStudyTime(startTime);
  if (!normalized || !Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 1440) {
    return null;
  }
  const [hours, minutes, seconds] = normalized.split(":").map(Number);
  const totalSeconds = hours * 3600 + minutes * 60 + seconds + durationMinutes * 60;
  const endSeconds = totalSeconds % 86400;
  return {
    time: [Math.floor(endSeconds / 3600), Math.floor((endSeconds % 3600) / 60), endSeconds % 60]
      .map((part) => String(part).padStart(2, "0"))
      .join(":"),
    nextDay: totalSeconds >= 86400,
  };
}
