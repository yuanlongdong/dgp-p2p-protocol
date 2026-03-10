import { auditLog } from "./audit-log";

type GuardInput = {
  action: string;
  meta?: Record<string, unknown>;
  run: () => Promise<unknown>;
};

function isTransientTelegramError(error: unknown): boolean {
  const maybe = error as {
    code?: string;
    errno?: string;
    type?: string;
    response?: { error_code?: number };
  };

  const code = maybe.code || maybe.errno;
  if (
    code === "ECONNABORTED" ||
    code === "ECONNRESET" ||
    code === "ENETUNREACH" ||
    code === "ETIMEDOUT"
  ) {
    return true;
  }

  if (maybe.type === "system") {
    return true;
  }

  const statusCode = maybe.response?.error_code;
  if (
    typeof statusCode === "number" &&
    (statusCode === 429 || statusCode >= 500)
  ) {
    return true;
  }

  return false;
}

export async function withTelegramApiGuard(
  input: GuardInput
): Promise<boolean> {
  try {
    await input.run();
    return true;
  } catch (error) {
    if (!isTransientTelegramError(error)) {
      throw error;
    }
    const err = error instanceof Error ? error : new Error(String(error));
    auditLog("telegramApiError", {
      action: input.action,
      errorName: err.name,
      errorMessage: err.message,
      ...input.meta,
    });
    return false;
  }
}
