/** The human-readable message of anything thrown. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * A message for a "{reason}. Try again." slot. Browser errors often end with a period, so it is
 * dropped here to keep the template's own period from doubling.
 */
export function reasonText(error: unknown): string {
  return errorMessage(error)
    .trim()
    .replace(/[.\s]+$/, '');
}
