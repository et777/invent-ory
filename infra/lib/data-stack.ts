import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { EnvConfig, isProd } from './config';

export interface DataStackProps extends StackProps {
  config: EnvConfig;
}

export class DataStack extends Stack {
  public readonly productsTable: dynamodb.Table;
  public readonly sessionsTable: dynamodb.Table;
  public readonly observationsTable: dynamodb.Table;
  public readonly countEventsTable: dynamodb.Table;
  public readonly reviewTasksTable: dynamodb.Table;
  public readonly evidenceBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    const { config } = props;
    const prod = isProd(config);
    const removalPolicy = prod ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY;

    const tableDefaults: Partial<dynamodb.TableProps> = {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true,
      removalPolicy,
    };

    // orgId partitions the catalog per tenant; sku is the natural item key within a catalog version.
    this.productsTable = new dynamodb.Table(this, 'ProductsTable', {
      ...tableDefaults,
      tableName: `invent-ory-${config.envName}-Products`,
      partitionKey: { name: 'orgId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sku', type: dynamodb.AttributeType.STRING },
    });

    // orgId partitions sessions per tenant; sessionId identifies one scan session.
    this.sessionsTable = new dynamodb.Table(this, 'SessionsTable', {
      ...tableDefaults,
      tableName: `invent-ory-${config.envName}-Sessions`,
      partitionKey: { name: 'orgId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
    });

    // sessionId scopes observations to one session; objectId is the session-local physical-object ID
    // (never a filename or frame number), stable across offline retries.
    this.observationsTable = new dynamodb.Table(this, 'ObservationsTable', {
      ...tableDefaults,
      tableName: `invent-ory-${config.envName}-Observations`,
      partitionKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'objectId', type: dynamodb.AttributeType.STRING },
    });

    // eventId is written with a conditional put (attribute_not_exists) by the API layer so that
    // retried batches cannot double-count; this table is the immutable ledger, not a mutable summary.
    this.countEventsTable = new dynamodb.Table(this, 'CountEventsTable', {
      ...tableDefaults,
      tableName: `invent-ory-${config.envName}-CountEvents`,
      partitionKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'eventId', type: dynamodb.AttributeType.STRING },
    });

    this.reviewTasksTable = new dynamodb.Table(this, 'ReviewTasksTable', {
      ...tableDefaults,
      tableName: `invent-ory-${config.envName}-ReviewTasks`,
      partitionKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'taskId', type: dynamodb.AttributeType.STRING },
    });

    this.evidenceBucket = new s3.Bucket(this, 'EvidenceBucket', {
      bucketName: `invent-ory-${config.envName}-evidence-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: false,
      removalPolicy,
      autoDeleteObjects: !prod,
      lifecycleRules: [
        {
          id: 'expire-evidence',
          enabled: true,
          expiration: Duration.days(config.retentionDays),
        },
      ],
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
    });
  }
}
