import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';

/**
 * Tenant isolation boundary: orgId is derived only from the verified JWT claims
 * attached by the API Gateway JWT authorizer, never from a request body/path/query
 * param. Every handler must call this before touching DynamoDB.
 */
export class TenantAuthError extends Error {}

export function requireOrgId(event: APIGatewayProxyEventV2WithJWTAuthorizer): string {
  const claims = event.requestContext?.authorizer?.jwt?.claims;
  const orgId = claims?.['custom:orgId'] ?? claims?.orgId;
  if (!orgId || typeof orgId !== 'string') {
    throw new TenantAuthError('Missing orgId claim on authenticated request');
  }
  return orgId;
}

export function requireActor(event: APIGatewayProxyEventV2WithJWTAuthorizer): string {
  const claims = event.requestContext?.authorizer?.jwt?.claims;
  const sub = claims?.sub;
  if (!sub || typeof sub !== 'string') {
    throw new TenantAuthError('Missing sub claim on authenticated request');
  }
  return sub;
}

/**
 * Any record fetched from a session-scoped table must carry the caller's orgId.
 * A record belonging to another org must be treated as not found, never as a
 * distinguishable 403, so tenants cannot probe for the existence of other orgs' data.
 */
export function belongsToOrg<T extends { orgId: string }>(record: T | undefined, orgId: string): record is T {
  return record !== undefined && record.orgId === orgId;
}
