import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';

process.env.PRODUCTS_TABLE = 'Products';
process.env.SESSIONS_TABLE = 'Sessions';
process.env.OBSERVATIONS_TABLE = 'Observations';
process.env.COUNT_EVENTS_TABLE = 'CountEvents';
process.env.REVIEW_TASKS_TABLE = 'ReviewTasks';
process.env.EVIDENCE_BUCKET = 'evidence-bucket';

export function makeEvent(opts: {
  orgId?: string;
  sub?: string;
  pathParameters?: Record<string, string>;
  body?: unknown;
  queryStringParameters?: Record<string, string>;
}): APIGatewayProxyEventV2WithJWTAuthorizer {
  return {
    version: '2.0',
    routeKey: '$default',
    rawPath: '/',
    rawQueryString: '',
    headers: {},
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api',
      domainName: 'test.local',
      domainPrefix: 'test',
      http: { method: 'POST', path: '/', protocol: 'HTTP/1.1', sourceIp: '127.0.0.1', userAgent: 'jest' },
      requestId: 'req-1',
      routeKey: '$default',
      stage: '$default',
      time: new Date().toISOString(),
      timeEpoch: Date.now(),
      authorizer: {
        jwt: {
          claims:
            opts.orgId === undefined && opts.sub === undefined
              ? {}
              : { 'custom:orgId': opts.orgId ?? 'org-a', sub: opts.sub ?? 'user-1' },
          scopes: [],
        },
      },
    } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer['requestContext'],
    pathParameters: opts.pathParameters,
    queryStringParameters: opts.queryStringParameters,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    isBase64Encoded: false,
  };
}
