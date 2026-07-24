/**
 * Standardized API response builder for Express handlers in WordPot.
 */

/**
 * Build successful JSON API response payload.
 * @param {*} data
 * @param {string} [message="Success"]
 * @returns {{ ok: true, message: string, data: * }}
 */
export function successResponse(data, message = "Success") {
  return {
    ok: true,
    message,
    data,
  };
}

/**
 * Build error JSON API response payload.
 * @param {string} error
 * @param {number} [code=400]
 * @returns {{ ok: false, error: string, code: number }}
 */
export function errorResponse(error = "Bad Request", code = 400) {
  return {
    ok: false,
    error,
    code,
  };
}
