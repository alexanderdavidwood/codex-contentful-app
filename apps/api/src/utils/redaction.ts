const REDACTED = "[REDACTED]";

export function createRedactor(secrets: Array<string | undefined>) {
  const activeSecrets = secrets.filter((value): value is string => Boolean(value && value.trim()));

  return (value: string) => {
    let sanitized = value;
    for (const secret of activeSecrets) {
      sanitized = sanitized.split(secret).join(REDACTED);
    }
    return sanitized;
  };
}
