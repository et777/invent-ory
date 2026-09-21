import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';

export function ok(body: unknown, statusCode = 200): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export function text(body: string, contentType = 'text/csv', statusCode = 200): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { 'content-type': contentType },
    body,
  };
}

export function badRequest(message: string): APIGatewayProxyResultV2 {
  return ok({ error: message }, 400);
}

export function conflict(message: string): APIGatewayProxyResultV2 {
  return ok({ error: message }, 409);
}

export function notFound(message = 'Not found'): APIGatewayProxyResultV2 {
  return ok({ error: message }, 404);
}

export function forbidden(message = 'Forbidden'): APIGatewayProxyResultV2 {
  return ok({ error: message }, 403);
}

export function parseBody<T>(event: APIGatewayProxyEventV2): T | undefined {
  if (!event.body) return undefined;
  const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf-8') : event.body;
  return JSON.parse(raw) as T;
}
