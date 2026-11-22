import type { ErrorCode } from '@har-comparisor/shared';

/** An error with a code and a message that is safe to show to the user. */
export class HarError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = 'HarError';
    this.code = code;
  }
}
