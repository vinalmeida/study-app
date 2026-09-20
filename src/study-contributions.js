const DAYS_ON_EACH_SIDE = 182;

function dateAtNoon(value) {
  const date = new Date(value);
  date.setHours(12, 0, 0, 0);
  return date;
}

function addDays(value, amount) {
  const date = dateAtNoon(value);
  date.setDate(date.getDate() + amount);
  return date;
}

function isoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function studyIntensityLevel(minutes) {
  const total = Number(minutes);
  if (!Number.isFinite(total) || total <= 0) return 0;
  return Math.min(6, Math.ceil(total / 60));
}

export function studyMinutesByDate(entries) {
  return entries.reduce((minutesByDate, entry) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(entry.studyDate))) return minutesByDate;
    const minutes = Number(entry.durationMinutes);
    if (!Number.isFinite(minutes) || minutes <= 0) return minutesByDate;
    minutesByDate.set(entry.studyDate, (minutesByDate.get(entry.studyDate) || 0) + minutes);
    return minutesByDate;
  }, new Map());
}

export function buildStudyContributionCalendar(entries, today = new Date()) {
  const centerDate = dateAtNoon(today);
  const rangeStart = addDays(centerDate, -DAYS_ON_EACH_SIDE);
  const rangeEnd = addDays(centerDate, DAYS_ON_EACH_SIDE);
  const graphStart = addDays(rangeStart, -rangeStart.getDay());
  const graphEnd = addDays(rangeEnd, 6 - rangeEnd.getDay());
  const minutesByDate = studyMinutesByDate(entries);
  const weeks = [];
  const monthLabels = [];
  let previousMonth = -1;
  let studyDays = 0;

  for (let weekStart = graphStart, weekIndex = 0; weekStart <= graphEnd; weekStart = addDays(weekStart, 7), weekIndex += 1) {
    const week = [];

    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const date = addDays(weekStart, dayIndex);
      const dateKey = isoDate(date);
      const isInRange = date >= rangeStart && date <= rangeEnd;
      const minutes = isInRange ? minutesByDate.get(dateKey) || 0 : 0;

      if (minutes > 0) studyDays += 1;
      week.push({
        date: dateKey,
        isInRange,
        minutes,
        level: studyIntensityLevel(minutes),
      });
    }

    const firstVisibleDay = week.find((day) => day.isInRange);
    if (firstVisibleDay) {
      const labelDate = new Date(`${firstVisibleDay.date}T12:00:00`);
      const month = labelDate.getMonth();
      if (month !== previousMonth) {
        monthLabels.push({ month, weekIndex });
        previousMonth = month;
      }
    }

    weeks.push(week);
  }

  return {
    weeks,
    monthLabels,
    studyDays,
    centerDate: isoDate(centerDate),
    rangeStart: isoDate(rangeStart),
    rangeEnd: isoDate(rangeEnd),
  };
}
