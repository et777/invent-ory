import * as path from 'path';
import { CfnOutput, Duration, Stack, StackProps } from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { EnvConfig } from './config';

export interface ApiStackProps extends StackProps {
  config: EnvConfig;
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
  productsTable: dynamodb.Table;
  sessionsTable: dynamodb.Table;
  observationsTable: dynamodb.Table;
  countEventsTable: dynamodb.Table;
  reviewTasksTable: dynamodb.Table;
  evidenceBucket: s3.Bucket;
}

const HANDLERS_DIR = path.join(__dirname, '..', '..', 'api', 'src', 'handlers');

export class ApiStack extends Stack {
  public readonly httpApi: apigwv2.HttpApi;
  public readonly lambdaFunctions: lambda.IFunction[] = [];

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const {
      config,
      userPool,
      userPoolClient,
      productsTable,
      sessionsTable,
      observationsTable,
      countEventsTable,
      reviewTasksTable,
      evidenceBucket,
    } = props;

    // Names must match api/src/lib/ddb.ts's requireEnv() lookups exactly.
    const commonEnv = {
      PRODUCTS_TABLE: productsTable.tableName,
      SESSIONS_TABLE: sessionsTable.tableName,
      OBSERVATIONS_TABLE: observationsTable.tableName,
      COUNT_EVENTS_TABLE: countEventsTable.tableName,
      REVIEW_TASKS_TABLE: reviewTasksTable.tableName,
      EVIDENCE_BUCKET: evidenceBucket.bucketName,
      ALLOWED_MODEL_VERSION: config.allowedModelVersion,
      ENV_NAME: config.envName,
    };

    // One Lambda per route handler (not per file) so each function's IAM grants stay scoped to
    // exactly the tables/bucket that handler touches.
    const mkFn = (routeId: string, file: string, exportName: string): NodejsFunction =>
      new NodejsFunction(this, routeId, {
        runtime: lambda.Runtime.NODEJS_20_X,
        timeout: Duration.seconds(15),
        memorySize: 256,
        bundling: { minify: true, sourceMap: true },
        environment: commonEnv,
        entry: path.join(HANDLERS_DIR, file),
        handler: exportName,
      });

    const importCatalogFn = mkFn('ImportCatalogFn', 'catalog.ts', 'importCatalog');
    productsTable.grantReadWriteData(importCatalogFn);

    const listProductsFn = mkFn('ListProductsFn', 'catalog.ts', 'listProducts');
    productsTable.grantReadData(listProductsFn);

    const createSessionFn = mkFn('CreateSessionFn', 'sessions.ts', 'createSession');
    sessionsTable.grantWriteData(createSessionFn);

    const getSessionFn = mkFn('GetSessionFn', 'sessions.ts', 'getSession');
    sessionsTable.grantReadData(getSessionFn);

    const finalizeSessionFn = mkFn('FinalizeSessionFn', 'sessions.ts', 'finalizeSession');
    sessionsTable.grantReadWriteData(finalizeSessionFn);
    reviewTasksTable.grantReadData(finalizeSessionFn);

    const batchObservationsFn = mkFn('BatchObservationsFn', 'observations.ts', 'batchObservations');
    sessionsTable.grantReadData(batchObservationsFn);
    observationsTable.grantReadWriteData(batchObservationsFn);

    const batchEventsFn = mkFn('BatchEventsFn', 'events.ts', 'batchEvents');
    sessionsTable.grantReadData(batchEventsFn);
    countEventsTable.grantReadWriteData(batchEventsFn);

    const evidenceUploadUrlFn = mkFn('EvidenceUploadUrlFn', 'evidence.ts', 'getEvidenceUploadUrl');
    sessionsTable.grantReadData(evidenceUploadUrlFn);
    evidenceBucket.grantPut(evidenceUploadUrlFn);

    const getSummaryFn = mkFn('GetSummaryFn', 'summary.ts', 'getSummary');
    sessionsTable.grantReadData(getSummaryFn);
    countEventsTable.grantReadData(getSummaryFn);

    const getExportFn = mkFn('GetExportFn', 'summary.ts', 'getExport');
    sessionsTable.grantReadData(getExportFn);
    countEventsTable.grantReadData(getExportFn);

    const listReviewTasksFn = mkFn('ListReviewTasksFn', 'review.ts', 'listReviewTasks');
    sessionsTable.grantReadData(listReviewTasksFn);
    reviewTasksTable.grantReadData(listReviewTasksFn);

    const postReviewDecisionsFn = mkFn('PostReviewDecisionsFn', 'review.ts', 'postReviewDecisions');
    sessionsTable.grantReadData(postReviewDecisionsFn);
    reviewTasksTable.grantReadWriteData(postReviewDecisionsFn);
    countEventsTable.grantReadWriteData(postReviewDecisionsFn);

    this.lambdaFunctions.push(
      importCatalogFn,
      listProductsFn,
      createSessionFn,
      getSessionFn,
      finalizeSessionFn,
      batchObservationsFn,
      batchEventsFn,
      evidenceUploadUrlFn,
      getSummaryFn,
      getExportFn,
      listReviewTasksFn,
      postReviewDecisionsFn,
    );

    const authorizer = new HttpJwtAuthorizer(
      'CognitoAuthorizer',
      `https://cognito-idp.${this.region}.amazonaws.com/${userPool.userPoolId}`,
      {
        jwtAudience: [userPoolClient.userPoolClientId],
        identitySource: ['$request.header.Authorization'],
      },
    );

    this.httpApi = new apigwv2.HttpApi(this, 'HttpApi', {
      apiName: `invent-ory-${config.envName}`,
      defaultAuthorizer: authorizer,
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [apigwv2.CorsHttpMethod.GET, apigwv2.CorsHttpMethod.POST],
        allowHeaders: ['Authorization', 'Content-Type'],
      },
    });

    const route = (routePath: string, method: apigwv2.HttpMethod, fn: NodejsFunction, integrationId: string) => {
      this.httpApi.addRoutes({
        path: routePath,
        methods: [method],
        integration: new HttpLambdaIntegration(integrationId, fn),
      });
    };

    route('/catalog/import', apigwv2.HttpMethod.POST, importCatalogFn, 'ImportCatalogIntegration');
    route('/catalog/products', apigwv2.HttpMethod.GET, listProductsFn, 'ListProductsIntegration');

    route('/sessions', apigwv2.HttpMethod.POST, createSessionFn, 'CreateSessionIntegration');
    route('/sessions/{id}', apigwv2.HttpMethod.GET, getSessionFn, 'GetSessionIntegration');
    route('/sessions/{id}/finalize', apigwv2.HttpMethod.POST, finalizeSessionFn, 'FinalizeSessionIntegration');

    route('/sessions/{id}/observations:batch', apigwv2.HttpMethod.POST, batchObservationsFn, 'BatchObservationsIntegration');
    route('/sessions/{id}/events:batch', apigwv2.HttpMethod.POST, batchEventsFn, 'BatchEventsIntegration');
    route('/sessions/{id}/evidence-upload-url', apigwv2.HttpMethod.POST, evidenceUploadUrlFn, 'EvidenceUploadUrlIntegration');

    route('/sessions/{id}/summary', apigwv2.HttpMethod.GET, getSummaryFn, 'GetSummaryIntegration');
    route('/sessions/{id}/export', apigwv2.HttpMethod.GET, getExportFn, 'GetExportIntegration');

    route('/sessions/{id}/review-tasks', apigwv2.HttpMethod.GET, listReviewTasksFn, 'ListReviewTasksIntegration');
    route('/sessions/{id}/review-decisions', apigwv2.HttpMethod.POST, postReviewDecisionsFn, 'PostReviewDecisionsIntegration');

    new CfnOutput(this, 'ApiBaseUrl', { value: this.httpApi.apiEndpoint });
    new CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId });
    new CfnOutput(this, 'EvidenceBucketName', { value: evidenceBucket.bucketName });
  }
}
