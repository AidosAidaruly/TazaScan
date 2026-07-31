export type FieldErrors = Record<string, string>

export class ApiError extends Error {
  readonly statusCode: number
  readonly fieldErrors: FieldErrors

  constructor(
    statusCode: number,
    message: string,
    fieldErrors: FieldErrors = {},
  ) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.fieldErrors = fieldErrors
  }
}
