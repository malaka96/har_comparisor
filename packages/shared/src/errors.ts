export const ERROR_CODES = {
  EMPTY_FILE: 'EMPTY_FILE',
  INVALID_JSON: 'INVALID_JSON',
  NOT_A_HAR: 'NOT_A_HAR',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  HAR_NOT_FOUND: 'HAR_NOT_FOUND',
  ENTRY_NOT_FOUND: 'ENTRY_NOT_FOUND',
  BAD_REQUEST: 'BAD_REQUEST',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL: 'INTERNAL',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** Shape of every error response from the API. */
export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
  };
}
