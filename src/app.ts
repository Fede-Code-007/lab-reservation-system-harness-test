import Fastify from 'fastify';
import type { FastifyError, LogLevel } from 'fastify';
import { TypeBoxValidatorCompiler, type TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { Db } from './db/database.js';
import { AppError, ERROR_CODES, toErrorBody } from './errors/index.js';
import { registerEquipmentRoutes } from './modules/equipment/equipment.routes.js';
import { registerReservationsRoutes } from './modules/reservations/reservations.routes.js';
import type { TypeboxApp } from './types.js';

export interface BuildAppOptions {
  db: Db;
  logger?: boolean;
  logLevel?: string;
}

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

function toLogLevel(value: string): LogLevel {
  const level = LOG_LEVELS.find((candidate) => candidate === value);
  if (level === undefined) {
    throw new Error(`LOG_LEVEL inválido: "${value}". Valores permitidos: ${LOG_LEVELS.join(', ')}.`);
  }
  return level;
}

export function buildApp(options: BuildAppOptions): TypeboxApp {
  const logger = options.logger ?? false;
  const app = Fastify({
    logger: logger ? { level: toLogLevel(options.logLevel ?? 'info') } : false,
  })
    .setValidatorCompiler(TypeBoxValidatorCompiler)
    .withTypeProvider<TypeBoxTypeProvider>();

  // SPEC.md §8 no define cuerpo para `POST /reservations/:id/cancel`. Se acepta
  // cualquier `Content-Type` y el cuerpo se ignora, para que un cliente no
  // reciba un 415 (código HTTP ausente en la especificación) al invocar un
  // endpoint sin cuerpo. Los parsers específicos de Fastify (JSON y texto
  // plano) siguen teniendo prioridad.
  app.addContentTypeParser('*', { parseAs: 'string' }, (_request, _payload, done) => {
    done(null, undefined);
  });

  app.setErrorHandler<FastifyError>((error, request, reply) => {
    if (error instanceof AppError) {
      reply.status(error.statusCode).send(toErrorBody(error));
      return;
    }

    if (error.validation) {
      reply.status(400).send({
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Los datos de la solicitud son inválidos.',
        },
      });
      return;
    }

    const statusCode = error.statusCode ?? 500;
    if (statusCode >= 400 && statusCode < 500) {
      reply.status(statusCode).send({
        error: {
          code: statusCode === 404 ? ERROR_CODES.NOT_FOUND : ERROR_CODES.VALIDATION_ERROR,
          message: error.message,
        },
      });
      return;
    }

    request.log.error({ err: error }, 'Error no controlado');
    reply.status(500).send({
      error: {
        code: ERROR_CODES.INTERNAL_ERROR,
        message: 'Ocurrió un error interno.',
      },
    });
  });

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: {
        code: ERROR_CODES.NOT_FOUND,
        message: `La ruta ${request.method} ${request.url} no existe.`,
      },
    });
  });

  registerEquipmentRoutes(app, options.db);
  registerReservationsRoutes(app, options.db);

  return app;
}
