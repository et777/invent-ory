import { Stack, StackProps, Duration } from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as budgets from 'aws-cdk-lib/aws-budgets';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { SnsAction } from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import { EnvConfig } from './config';

export interface ObservabilityStackProps extends StackProps {
  config: EnvConfig;
  httpApi: apigwv2.HttpApi;
  lambdaFunctions: lambda.IFunction[];
}

export class ObservabilityStack extends Stack {
  // Placeholder queue for Phase 5's async recognition path (worker desired count is 0 until
  // benchmarks justify GPU/ECS capacity); wiring it now so the DLQ alarm and IAM shape exist early.
  public readonly recognitionQueue: sqs.Queue;
  public readonly recognitionDlq: sqs.Queue;
  public readonly alertTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: ObservabilityStackProps) {
    super(scope, id, props);

    const { config, httpApi, lambdaFunctions } = props;

    this.alertTopic = new sns.Topic(this, 'AlertTopic', {
      topicName: `invent-ory-${config.envName}-alerts`,
    });
    this.alertTopic.addSubscription(new subscriptions.EmailSubscription(config.alertEmail));

    this.recognitionDlq = new sqs.Queue(this, 'RecognitionDlq', {
      queueName: `invent-ory-${config.envName}-recognition-dlq`,
      retentionPeriod: Duration.days(14),
    });

    this.recognitionQueue = new sqs.Queue(this, 'RecognitionQueue', {
      queueName: `invent-ory-${config.envName}-recognition`,
      visibilityTimeout: Duration.minutes(5),
      deadLetterQueue: { queue: this.recognitionDlq, maxReceiveCount: 5 },
    });

    new cloudwatch.Alarm(this, 'RecognitionDlqNotEmptyAlarm', {
      alarmName: `invent-ory-${config.envName}-recognition-dlq-not-empty`,
      metric: this.recognitionDlq.metricApproximateNumberOfMessagesVisible({ period: Duration.minutes(5) }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      alarmDescription: 'Async recognition dead-letter queue has messages that failed processing.',
    }).addAlarmAction(new SnsAction(this.alertTopic));

    for (const fn of lambdaFunctions) {
      new cloudwatch.Alarm(this, `${fn.node.id}ErrorsAlarm`, {
        alarmName: `invent-ory-${config.envName}-${fn.node.id}-errors`,
        metric: fn.metricErrors({ period: Duration.minutes(5) }),
        threshold: 1,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        alarmDescription: `Lambda errors detected for ${fn.node.id}.`,
      }).addAlarmAction(new SnsAction(this.alertTopic));
    }

    new cloudwatch.Alarm(this, 'Api5xxAlarm', {
      alarmName: `invent-ory-${config.envName}-api-5xx`,
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: '5xx',
        dimensionsMap: { ApiId: httpApi.apiId },
        statistic: 'Sum',
        period: Duration.minutes(5),
      }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      alarmDescription: 'API Gateway is returning 5xx responses.',
    }).addAlarmAction(new SnsAction(this.alertTopic));

    new budgets.CfnBudget(this, 'DailySpendBudget', {
      budget: {
        budgetName: `invent-ory-${config.envName}-daily-spend`,
        budgetType: 'COST',
        timeUnit: 'DAILY',
        budgetLimit: {
          amount: config.maxDailySpendUsd,
          unit: 'USD',
        },
      },
      notificationsWithSubscribers: [
        {
          notification: {
            notificationType: 'ACTUAL',
            comparisonOperator: 'GREATER_THAN',
            threshold: 80,
            thresholdType: 'PERCENTAGE',
          },
          subscribers: [{ subscriptionType: 'EMAIL', address: config.alertEmail }],
        },
      ],
    });
  }
}
