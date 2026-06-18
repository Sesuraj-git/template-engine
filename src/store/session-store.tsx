/**
 * A module-level store for the NextAuth `update()` function from useSession.
 * This lets non-React code (like axios interceptors) trigger a session update.
 */

type UpdateSessionFn = (data?: Record<string, unknown>) => Promise<unknown>;

let _updateSession: UpdateSessionFn | null = null;

export function registerUpdateSession(fn: UpdateSessionFn): void {
    _updateSession = fn;
}

export async function triggerSessionUpdate(
    data?: Record<string, unknown>,
): Promise<unknown> {
    if (_updateSession) {
        return _updateSession(data);
    }
    return null;
}
