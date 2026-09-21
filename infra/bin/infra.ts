#!/usr/bin/env node
import 'source-map-support/register';
import { App, Tags } from 'aws-cdk-lib';
import { loadEnvConfig } from '../lib/config';
import { DataStack } from '../lib/data-stack';
import { AuthStack } from '../lib/auth-stack';
import { ApiStack } from '../lib/api-stack';
import { ObservabilityStack } from '../lib/observability-stack';
import { WebStack } from '../lib/web-stack';

const app = new App();

// Applied at the App level so every stack/construct added anywhere in this app inherits the tag —
// a new stack cannot be added without it.
Tags.of(app).add('project', 'inventory');

const config = loadEnvConfig(app);
const env = { account: config.account, region: config.region };
const stackPrefix = `InventOry-${config.envName}`;

const dataStack = new DataStack(app, `${stackPrefix}-Data`, { env, config });
const authStack = new AuthStack(app, `${stackPrefix}-Auth`, { env, config });

const apiStack = new ApiStack(app, `${stackPrefix}-Api`, {
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

new ObservabilityStack(app, `${stackPrefix}-Observability`, {
  env,
  config,
  httpApi: apiStack.httpApi,
  lambdaFunctions: apiStack.lambdaFunctions,
});

new WebStack(app, `${stackPrefix}-Web`, {
  env,
  config,
});
