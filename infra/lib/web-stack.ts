import { CfnOutput, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { EnvConfig, isProd } from './config';

export interface WebStackProps extends StackProps {
  config: EnvConfig;
}

export class WebStack extends Stack {
  public readonly webBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: WebStackProps) {
    super(scope, id, props);

    const { config } = props;
    const prod = isProd(config);

    // Bucket and distribution live in the same stack: the OAC bucket policy that
    // withOriginAccessControl attaches needs the distribution's ARN, which would create a
    // cross-stack cyclic dependency if the bucket lived in DataStack alongside the other tables.
    this.webBucket = new s3.Bucket(this, 'WebBucket', {
      bucketName: `invent-ory-${config.envName}-web-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: false,
      removalPolicy: prod ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      autoDeleteObjects: !prod,
    });

    const distribution = new cloudfront.Distribution(this, 'WebDistribution', {
      comment: `invent-ory ${config.envName} review console`,
      defaultRootObject: 'index.html',
      defaultBehavior: {
        // S3BucketOrigin uses Origin Access Control by default (not the deprecated OAI).
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.webBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      errorResponses: [
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' },
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html' },
      ],
      domainNames: config.domainName ? [config.domainName] : undefined,
    });

    new CfnOutput(this, 'WebUrl', { value: `https://${distribution.distributionDomainName}` });
  }
}
