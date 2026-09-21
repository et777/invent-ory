import { App } from 'aws-cdk-lib';

export interface EnvConfig {
  envName: string;
  account: string;
  region: string;
  retentionDays: number;
  maxDailySpendUsd: number;
  allowedModelVersion: string;
  workerDesiredCount: number;
  alertEmail: string;
  domainName?: string;
}

const PLACEHOLDER_MARKERS = ['REPLACE_WITH_OWNER'];

function assertNoPlaceholders(envKey: string, config: EnvConfig): void {
  if (envKey !== 'prod') {
    return;
  }
  for (const [key, value] of Object.entries(config)) {
    if (typeof value === 'string' && PLACEHOLDER_MARKERS.some((marker) => value.includes(marker))) {
      throw new Error(
        `cdk.json context "environments.prod.${key}" is still set to a placeholder ("${value}"). ` +
          'The account owner must supply a real value (account ID, region, alert email) before a prod synth/deploy is allowed.',
      );
    }
  }
}

export function loadEnvConfig(app: App): EnvConfig {
  const envKey = (app.node.tryGetContext('env') as string | undefined) ?? 'dev';
  const environments = app.node.tryGetContext('environments') as Record<string, EnvConfig> | undefined;
  const raw = environments?.[envKey];
  if (!raw) {
    throw new Error(
      `No cdk.json context found for environments.${envKey}. Pass --context env=dev or --context env=prod.`,
    );
  }
  const domainName = app.node.tryGetContext('domainName') as string | undefined;
  const config: EnvConfig = { ...raw, envName: raw.envName ?? envKey, domainName };
  assertNoPlaceholders(envKey, config);
  return config;
}

export function isProd(config: EnvConfig): boolean {
  return config.envName === 'prod';
}
