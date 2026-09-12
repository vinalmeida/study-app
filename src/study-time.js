export function normalizeStudyTime(value) {
  const match = String(value ?? "").match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const [, hours, minutes, seconds = "00"] = match;
  if (Number(hours) > 23 || Number(minutes) > 59 || Number(seconds) > 59) return null;
  return `${hours}:${minutes}`;
}

export function formatStudyTimeInput(value, caretPosition = value.length, inputType = "") {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  const formatted = digits.length >= 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
  const digitsBeforeCaret = Math.min(value.slice(0, caretPosition).replace(/\D/g, "").length, 4);
  const pastSeparator = digitsBeforeCaret > 2 ||
    (digitsBeforeCaret === 2 && inputType !== "deleteContentBackward");
  return {
    value: formatted,
    caretPosition: Math.min(formatted.length, digitsBeforeCaret + Number(pastSeparator)),
  };
}
