// Call error: an expired session (401) goes back to login; anything else becomes a message.
export const onErr = (e: any, onAuthError: () => void, setErr: (msg: string) => void) => (e?.status === 401 ? onAuthError() : setErr(e?.message ?? String(e)));
