import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { DataStack } from '../lib/data-stack';
import { AuthStack } from '../lib/auth-stack';
import { ApiStack } from '../lib/api-stack';
import { WebStack } from '../lib/web-stack';
import { EnvConfig } from '../lib/config';

function testConfig(): EnvConfig {
  return {
    envName: 'dev',
    account: '111111111111',
    region: 'ca-central-1',
    retentionDays: 30,
    maxDailySpendUsd: 10,
    allowedModelVersion: 'synthetic-v0',
    workerDesiredCount: 0,
    alertEmail: 'test@example.com',
  };
}

function buildApp() {
  const app = new App();
  const config = testConfig();
  const env = { account: config.account, region: config.region };

  // Mirror bin/infra.ts's Tags.of(app) call so the test exercises the same tagging path as the real app.
  require('aws-cdk-lib').Tags.of(app).add('project', 'inventory');

  const dataStack = new DataStack(app, 'TestData', { env, config });
  const authStack = new AuthStack(app, 'TestAuth', { env, config });
  const apiStack = new ApiStack(app, 'TestApi', {
    env,
    config,
    userPool: authStack.userPool,
    userPoolClient: authStack.userPoolClient,
    productsTable: dataStack.productsTable,
    sessionsTable: dataStack.sessionsTable,
    observationsTable: dataStack.observationsTable,
    countEventsTable: dataStack.countEventsTable,
    reviewTasksTable: dataStack.reviewTasksTable,
    evidenceBucket: dataStack.evidenceBucket,
  });
  const webStack = new WebStack(app, 'TestWeb', { env, config });

  return { dataStack, authStack, apiStack, webStack };
}

describe('tagging', () => {
  it('tags every DynamoDB table and S3 bucket with project=inventory', () => {
    const { dataStack, webStack } = buildApp();

    const dataTemplate = Template.fromStack(dataStack);
    dataTemplate.allResourcesProperties('AWS::DynamoDB::Table', {
      Tags: Match.arrayWith([{ Key: 'project', Value: 'inventory' }]),
    });
    dataTemplate.allResourcesProperties('AWS::S3::Bucket', {
      Tags: Match.arrayWith([{ Key: 'project', Value: 'inventory' }]),
    });

    const webTemplate = Template.fromStack(webStack);
    webTemplate.allResourcesProperties('AWS::S3::Bucket', {
      Tags: Match.arrayWith([{ Key: 'project', Value: 'inventory' }]),
    });
  });
});

describe('S3 public access', () => {
  it('blocks all public access on every bucket', () => {
    const { dataStack, webStack } = buildApp();

    for (const stack of [dataStack, webStack]) {
      const template = Template.fromStack(stack);
      template.allResourcesProperties('AWS::S3::Bucket', {
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true,
        },
      });
    }
  });
});

describe('API authorization', () => {
  it('attaches a JWT authorizer (not anonymous access) to the HTTP API', () => {
    const { apiStack } = buildApp();
    const template = Template.fromStack(apiStack);

    template.hasResourceProperties('AWS::ApiGatewayV2::Authorizer', {
      AuthorizerType: 'JWT',
    });

    const api = template.findResources('AWS::ApiGatewayV2::Api');
    const apiLogicalIds = Object.keys(api);
    expect(apiLogicalIds.length).toBeGreaterThan(0);
  });
});
