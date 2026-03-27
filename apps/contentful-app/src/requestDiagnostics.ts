export type RequestDiagnosticEntry = {
  id: string;
  startedAt: string;
  completedAt?: string;
  method: string;
  url: string;
  origin: string;
  requestHeaders: Record<string, string>;
  requestBodyPreview?: string;
  status?: number;
  ok?: boolean;
  durationMs?: number;
  responseBodyPreview?: string;
  errorName?: string;
  errorMessage?: string;
};

type Listener = (entries: RequestDiagnosticEntry[]) => void;

const MAX_ENTRIES = 30;
const entries: RequestDiagnosticEntry[] = [];
const listeners = new Set<Listener>();

function emit() {
  const snapshot = [...entries].reverse();
  listeners.forEach((listener) => listener(snapshot));
}

function truncate(value: string, maxLength = 600) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}…`;
}

export function recordRequestDiagnostic(entry: RequestDiagnosticEntry) {
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) {
    entries.splice(0, entries.length - MAX_ENTRIES);
  }

  emit();
}

export function subscribeToRequestDiagnostics(listener: Listener) {
  listeners.add(listener);
  listener([...entries].reverse());
  return () => {
    listeners.delete(listener);
  };
}

export function clearRequestDiagnostics() {
  entries.length = 0;
  emit();
}

export function toRequestBodyPreview(body: RequestInit["body"]) {
  if (typeof body === "string") {
    return truncate(body);
  }

  return undefined;
}

export function toResponseBodyPreview(body: string) {
  return truncate(body);
}

export function getRequestDiagnosticsReport() {
  return JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      location: window.location.href,
      origin: window.location.origin,
      userAgent: window.navigator.userAgent,
      entries: [...entries].reverse(),
    },
    null,
    2,
  );
}
