export function auditLog(event: string, payload: Record<string, unknown>) {
  const line = {
    ts: new Date().toISOString(),
    event,
    ...payload
  };
  // Structured logs for later grep or shipping to log backend.
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(line));
}
