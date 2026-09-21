import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, tableNames } from '../lib/ddb';
import { orgKey, skuKey } from '../lib/keys';
import { requireOrgId, TenantAuthError } from '../lib/tenant';
import { badRequest, ok, parseBody } from '../lib/http';
import type { BatchItemResult, Product } from '../lib/types';

interface CatalogRow {
  sku: string;
  name: string;
  barcode?: string;
  category?: string;
}

interface CatalogImportRequest {
  csv?: string;
  rows?: CatalogRow[];
}

function parseCsv(csv: string): CatalogRow[] {
  const lines = csv.trim().split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length === 0) return [];
  const [header, ...dataLines] = lines;
  const columns = header.split(',').map((c) => c.trim().toLowerCase());
  return dataLines.map((line) => {
    const cells = line.split(',').map((c) => c.trim());
    const row: Record<string, string> = {};
    columns.forEach((col, i) => {
      row[col] = cells[i] ?? '';
    });
    return {
      sku: row.sku,
      name: row.name,
      barcode: row.barcode || undefined,
      category: row.category || undefined,
    };
  });
}

async function nextCatalogVersion(orgId: string): Promise<number> {
  const result = await ddb.send(
    new QueryCommand({
      TableName: tableNames.products(),
      KeyConditionExpression: 'orgId = :orgId',
      ExpressionAttributeValues: { ':orgId': orgKey(orgId) },
      ProjectionExpression: 'catalogVersion',
    })
  );
  const items = (result.Items ?? []) as Array<Pick<Product, 'catalogVersion'>>;
  const max = items.reduce((acc, item) => Math.max(acc, item.catalogVersion ?? 0), 0);
  return max + 1;
}

export async function importCatalog(event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> {
  let orgId: string;
  try {
    orgId = requireOrgId(event);
  } catch (err) {
    if (err instanceof TenantAuthError) return badRequest(err.message);
    throw err;
  }

  const body = parseBody<CatalogImportRequest>(event);
  if (!body || (!body.csv && !body.rows)) {
    return badRequest('Request must include either csv text or a rows array');
  }
  const rows = body.rows ?? parseCsv(body.csv as string);

  const existingResult = await ddb.send(
    new QueryCommand({
      TableName: tableNames.products(),
      KeyConditionExpression: 'orgId = :orgId',
      ExpressionAttributeValues: { ':orgId': orgKey(orgId) },
    })
  );
  const existingProducts = (existingResult.Items ?? []) as Product[];
  const existingBarcodeToSku = new Map<string, string>();
  for (const p of existingProducts) {
    if (p.barcode) existingBarcodeToSku.set(p.barcode, p.sku);
  }

  const catalogVersion = await nextCatalogVersion(orgId);
  const seenSkus = new Set<string>();
  const seenBarcodes = new Map<string, string>();
  const results: BatchItemResult[] = [];
  const now = new Date().toISOString();

  for (const row of rows) {
    if (!row.sku || !row.name) {
      results.push({ id: row.sku || '(missing sku)', status: 'rejected', reason: 'sku and name are required' });
      continue;
    }
    if (seenSkus.has(row.sku)) {
      results.push({ id: row.sku, status: 'rejected', reason: 'duplicate sku within import batch' });
      continue;
    }
    if (row.barcode) {
      const dupWithinBatch = seenBarcodes.get(row.barcode);
      if (dupWithinBatch && dupWithinBatch !== row.sku) {
        results.push({ id: row.sku, status: 'rejected', reason: `barcode conflicts with sku ${dupWithinBatch} in same batch` });
        continue;
      }
      const existingOwner = existingBarcodeToSku.get(row.barcode);
      if (existingOwner && existingOwner !== row.sku) {
        results.push({ id: row.sku, status: 'rejected', reason: `barcode already assigned to existing sku ${existingOwner}` });
        continue;
      }
    }

    seenSkus.add(row.sku);
    if (row.barcode) seenBarcodes.set(row.barcode, row.sku);

    const existing = existingProducts.find((p) => p.sku === row.sku);
    const product: Product = {
      orgId: orgKey(orgId),
      sku: skuKey(row.sku),
      name: row.name,
      barcode: row.barcode,
      category: row.category,
      catalogVersion,
      referenceImageKeys: existing?.referenceImageKeys ?? [],
      active: true,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await ddb.send(new PutCommand({ TableName: tableNames.products(), Item: product }));
    results.push({ id: row.sku, status: 'accepted' });
  }

  return ok({ catalogVersion, results });
}

export async function listProducts(event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> {
  let orgId: string;
  try {
    orgId = requireOrgId(event);
  } catch (err) {
    if (err instanceof TenantAuthError) return badRequest(err.message);
    throw err;
  }

  const result = await ddb.send(
    new QueryCommand({
      TableName: tableNames.products(),
      KeyConditionExpression: 'orgId = :orgId',
      ExpressionAttributeValues: { ':orgId': orgKey(orgId) },
    })
  );
  const products = ((result.Items ?? []) as Product[]).map((p) => ({
    ...p,
    sku: p.sku.replace(/^SKU#/, ''),
    orgId: orgId,
  }));
  return ok({ products });
}
