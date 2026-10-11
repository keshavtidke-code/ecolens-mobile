import { AxiosError } from "axios";
import { FRIENDLY, statusFallbackMessage } from "./errorMessages";
import type { ApiErrorBody } from "./types";

export type ApiErrorKind = "network" | "timeout" | "auth" | "validation" | "rate_limit" | "server" | "client" | "unknown";

/** The only error type screens deal with. Always has a message that is safe to show to the user. */
export class ApiError extends Error {
  readonly status: number | null;
  readonly code: string;
  readonly details: unknown;
  readonly requestId: string | null;
  readonly retryAfterSeconds: number | null;

  constructor(init: {
    message: string;
    code: string;
    status?: number | null;
    details?: unknown;
    requestId?: string | null;
    retryAfterSeconds?: number | null;
  }) {
    super(init.message);
    this.name = "ApiError";
    this.code = init.code;
    this.status = init.status ?? null;
    this.details = init.details;
    this.requestId = init.requestId ?? null;
    this.retryAfterSeconds = init.retryAfterSeconds ?? null;
  }

  get kind(): ApiErrorKind {
    if (this.code === "network_error") return "network";
    if (this.code === "timeout" || this.status === 504) return "timeout";
    if (this.status === 401) return "auth";
    if (this.status === 422) return "validation";
    if (this.status === 429) return "rate_limit";
    if (this.status !== null && this.status >= 500) return "server";
    if (this.status !== null && this.status >= 400) return "client";
    return "unknown";
  }

  /** True when retrying the same request later may succeed (offline, timeout, 5xx, 429). */
  get retryable(): boolean {
    return ["network", "timeout", "server", "rate_limit"].includes(this.kind);
  }

  get isOffline(): boolean {
    return this.kind === "network";
  }

  /** The request was aborted on purpose (user left the screen / pressed stop). Never show this as an error. */
  get isCancelled(): boolean {
    return this.code === "cancelled";
  }
}

function validationMessage(details: unknown): string | null {
  if (!Array.isArray(details) || details.length === 0) return null;
  const first = details[0] as { field?: string; message?: string };
  if (!first?.message) return null;
  const cleaned = first.message.replace(/^Value error,\s*/i, "");
  return first.field ? `${first.field}: ${cleaned}` : cleaned;
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (error instanceof AxiosError) {
    if (error.code === "ERR_CANCELED") {
      return new ApiError({ message: FRIENDLY.cancelled as string, code: "cancelled" });
    }
    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
      return new ApiError({ message: FRIENDLY.timeout as string, code: "timeout" });
    }
    if (!error.response) {
      return new ApiError({ message: FRIENDLY.network_error as string, code: "network_error" });
    }
    const { status, data, headers } = error.response;
    const body = (data && typeof data === "object" ? data : {}) as Partial<ApiErrorBody>;
    const code = body.code ?? `http_${status}`;
    const retryHeader = Number(headers?.["retry-after"]);
    const detailRetry = (body.details as { retry_after_seconds?: unknown } | null | undefined)?.retry_after_seconds;
    const retryAfter =
      Number.isFinite(retryHeader) && retryHeader > 0 ? retryHeader : typeof detailRetry === "number" ? detailRetry : null;

    let message: string;
    if (status === 422) {
      message = validationMessage(body.details) ?? "Please check what you entered.";
    } else if (status === 429) {
      message = retryAfter ? `You're sending messages too quickly. Try again in ${retryAfter}s.` : (FRIENDLY.rate_limited as string);
    } else {
      message = body.message ?? FRIENDLY[code] ?? statusFallbackMessage(status);
    }
    return new ApiError({
      message,
      code,
      status,
      details: body.details,
      requestId: body.request_id ?? null,
      retryAfterSeconds: retryAfter,
    });
  }

  const message = error instanceof Error ? error.message : "Something went wrong.";
  return new ApiError({ message, code: "unknown_error" });
}
