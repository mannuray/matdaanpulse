import { AsyncLocalStorage } from 'async_hooks';
import { v4 as uuidv4 } from 'uuid';

interface RequestContext {
  requestId: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

/** Get the current request ID from async context, or 'no-ctx' if not in a request */
export function getRequestId(): string {
  return requestContext.getStore()?.requestId || 'no-ctx';
}

const REQUEST_ID_RE = /^[\w-]{1,64}$/;

/** Accept a client-supplied X-Request-ID only if it is short and safe; otherwise generate one. */
export function resolveRequestId(incoming: string | string[] | undefined): string {
  return typeof incoming === 'string' && REQUEST_ID_RE.test(incoming) ? incoming : uuidv4();
}
