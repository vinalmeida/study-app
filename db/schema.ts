export const schema = {
  subjects: ["id", "user_id", "name", "color", "deleted_at", "created_at"],
  studyEntries: ["id", "user_id", "subject_id", "study_date", "duration_minutes", "study_type", "notes", "created_at"],
} as const;
