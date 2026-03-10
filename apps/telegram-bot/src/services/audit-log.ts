import { formatEventMessage, resolveLocale } from "../i18n";

export function auditLog(event: string, payload: Record<string, unknown>) {
  const locale = resolveLocale();
  const message = formatEventMessage(event, payload, locale);
  const line = {
    ts: new Date().toISOString(),
    event,
    ...(message ? { message } : {}),
    ...payload
  };
  // Structured logs for later grep or shipping to log backend.
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(line));
}
