const columns = "id,subject_id,studied_on,minutes,kind,notes,created_at";

function isMissingStartTimeColumn(error) {
  const message = `${error?.message || ""} ${error?.details || ""}`;
  return /start_time/i.test(message) &&
    (["42703", "PGRST204"].includes(error?.code) || /does not exist|could not find/i.test(message));
}

function selectLogs(client, includeStartTime) {
  return client.from("study_logs")
    .select(`${columns}${includeStartTime ? ",start_time" : ""}`)
    .order("studied_on", { ascending: false })
    .order("id", { ascending: false });
}

export async function fetchStudyLogs(client) {
  let result = await selectLogs(client, true);
  if (isMissingStartTimeColumn(result.error)) {
    result = await selectLogs(client, false);
    if (result.error) throw result.error;
    return { rows: result.data, supportsStartTime: false };
  }
  if (result.error) throw result.error;
  return { rows: result.data, supportsStartTime: true };
}

export async function saveStudyLog(client, values, entryId, supportsStartTime) {
  const write = async (includeStartTime) => {
    const savedValues = { ...values };
    if (!includeStartTime) delete savedValues.start_time;
    const table = client.from("study_logs");
    const request = entryId
      ? table.update(savedValues).eq("id", entryId)
      : table.insert(savedValues);
    return request.select(`${columns}${includeStartTime ? ",start_time" : ""}`);
  };

  let result = await write(supportsStartTime);
  if (supportsStartTime && isMissingStartTimeColumn(result.error)) {
    result = await write(false);
    if (result.error) throw result.error;
    return { rows: result.data, supportsStartTime: false };
  }
  if (result.error) throw result.error;
  return { rows: result.data, supportsStartTime };
}
