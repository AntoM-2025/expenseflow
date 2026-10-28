// Each section publishes its result immediately, independently of other requests.
export async function loadSection<T>(
  section: string,
  signal: AbortSignal,
  onData: (data: T[]) => void,
  onError: (message: string) => void,
  onDone: () => void,
): Promise<void> {
  try {
    const response = await fetch(`/api/${section}`, { signal });
    if (!response.ok) {
      throw new Error(response.status === 401
        ? `Unable to retrieve ${section}: session expired. Please log in again.`
        : `Unable to retrieve ${section} (HTTP ${response.status}). Please reload to retry.`);
    }
    const data: unknown = await response.json();
    if (!Array.isArray(data)) throw new Error(`Invalid ${section} response. Please reload to retry.`);
    if (!signal.aborted) onData(data as T[]);
  } catch (error) {
    if (!signal.aborted) onError(error instanceof Error ? error.message : `Unable to retrieve ${section}`);
  } finally {
    if (!signal.aborted) onDone();
  }
}
