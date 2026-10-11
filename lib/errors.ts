/** An expected failure with a player-facing message. `route()` turns it into a JSON error response. */
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message)
  }
}
