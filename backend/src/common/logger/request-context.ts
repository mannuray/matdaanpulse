import { AsyncLocalStorage } from 'async_hooks';

interface RequestContext {
  requestId: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

/** Get the current request ID from async context, or 'no-ctx' if not in a request */
export function getRequestId(): string {
  return requestContext.getStore()?.requestId || 'no-ctx';
}
