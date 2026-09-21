import { randomUUID } from 'node:crypto';
import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { requireOrgId, TenantAuthError } from '../lib/tenant';
import { loadOwnedSession } from '../lib/sessionGuard';
import { badRequest, notFound, ok, parseBody } from '../lib/http';
import { evidenceBucket } from '../lib/ddb';

const ALLOWED_CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'video/mp4', 'video/quicktime']);
const UPLOAD_EXPIRY_SECONDS = 300;

const s3 = new S3Client({});

interface EvidenceUploadRequest {
  contentType: string;
  fileExtension?: string;
}

export async function getEvidenceUploadUrl(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  let orgId: string;
  try {
    orgId = requireOrgId(event);
  } catch (err) {
    if (err instanceof TenantAuthError) return badRequest(err.message);
    throw err;
  }

  const sessionId = event.pathParameters?.id;
  if (!sessionId) return badRequest('Missing session id');

  const session = await loadOwnedSession(orgId, sessionId);
  if (!session) return notFound('Session not found');

  const body = parseBody<EvidenceUploadRequest>(event);
  if (!body?.contentType || !ALLOWED_CONTENT_TYPES.has(body.contentType)) {
    return badRequest(`contentType must be one of: ${Array.from(ALLOWED_CONTENT_TYPES).join(', ')}`);
  }

  // Key is prefixed by orgId/sessionId so a presigned URL for one org's session
  // can never be reused to write into another org's evidence path.
  const key = `${orgId}/${sessionId}/${randomUUID()}${body.fileExtension ? `.${body.fileExtension}` : ''}`;

  const url = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: evidenceBucket(), Key: key, ContentType: body.contentType }),
    { expiresIn: UPLOAD_EXPIRY_SECONDS }
  );

  return ok({ uploadUrl: url, key, expiresInSeconds: UPLOAD_EXPIRY_SECONDS });
}
