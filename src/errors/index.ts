export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  OVERLAP: 'OVERLAP',
  ALREADY_CANCELLED: 'ALREADY_CANCELLED',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export interface ErrorBody {
  error: {
    code: ErrorCode;
    message: string;
  };
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;

  constructor(code: ErrorCode, message: string, statusCode: number) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Los datos de la solicitud son inválidos.') {
    super(ERROR_CODES.VALIDATION_ERROR, message, 400);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'El recurso solicitado no existe.') {
    super(ERROR_CODES.NOT_FOUND, message, 404);
  }
}

export class OverlapError extends AppError {
  constructor(message = 'La unidad ya tiene una reserva activa para ese intervalo.') {
    super(ERROR_CODES.OVERLAP, message, 409);
  }
}

export class AlreadyCancelledError extends AppError {
  constructor(message = 'La reserva ya se encuentra cancelada.') {
    super(ERROR_CODES.ALREADY_CANCELLED, message, 409);
  }
}

export class NotImplementedError extends AppError {
  constructor(feature: string) {
    super(ERROR_CODES.NOT_IMPLEMENTED, `${feature} todavía no está implementado.`, 501);
  }
}

export function toErrorBody(error: AppError): ErrorBody {
  return {
    error: {
      code: error.code,
      message: error.message,
    },
  };
}
