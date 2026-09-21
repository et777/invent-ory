import { mockClient } from 'aws-sdk-client-mock';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const KEY_FIELDS: Record<string, [string, string]> = {
  Products: ['orgId', 'sku'],
  Sessions: ['orgId', 'sessionId'],
  Observations: ['sessionId', 'objectId'],
  CountEvents: ['sessionId', 'eventId'],
  ReviewTasks: ['sessionId', 'taskId'],
};

type StoredItem = Record<string, unknown>;

export class FakeDynamo {
  private readonly store = new Map<string, StoredItem>();

  private storeKey(tableName: string, item: Record<string, unknown>): string {
    const [pk, sk] = KEY_FIELDS[tableName];
    return `${tableName}#${JSON.stringify([item[pk], item[sk]])}`;
  }

  install(): void {
    const ddbMock = mockClient(DynamoDBDocumentClient);

    ddbMock.on(GetCommand).callsFake((input) => {
      const key = this.storeKey(input.TableName as string, input.Key as Record<string, unknown>);
      return { Item: this.store.get(key) };
    });

    ddbMock.on(PutCommand).callsFake((input) => {
      const tableName = input.TableName as string;
      const item = input.Item as Record<string, unknown>;
      const key = this.storeKey(tableName, item);
      const existing = this.store.get(key);
      const condition = input.ConditionExpression as string | undefined;

      if (condition) {
        const [sortAttr] = KEY_FIELDS[tableName].slice(1);
        const notExists = `attribute_not_exists(${sortAttr})`;
        if (condition === notExists) {
          if (existing) throw new ConditionalCheckFailedException({ message: 'conditional failed', $metadata: {} });
        } else if (condition.includes(' OR revision = ')) {
          const expected = (input.ExpressionAttributeValues as Record<string, unknown>)?.[':expectedRevision'];
          const passes = !existing || existing.revision === expected;
          if (!passes) throw new ConditionalCheckFailedException({ message: 'conditional failed', $metadata: {} });
        }
      }

      this.store.set(key, item);
      return {};
    });

    ddbMock.on(QueryCommand).callsFake((input) => {
      const tableName = input.TableName as string;
      const values = (input.ExpressionAttributeValues ?? {}) as Record<string, unknown>;
      const filters = Object.entries(values).map(([placeholder, value]) => [placeholder.slice(1), value] as const);

      const items = Array.from(this.store.entries())
        .filter(([key]) => key.startsWith(`${tableName}#`))
        .map(([, item]) => item)
        .filter((item) => filters.every(([attr, value]) => item[attr] === value));

      return { Items: items };
    });
  }

  seed(tableName: string, item: StoredItem): void {
    this.store.set(this.storeKey(tableName, item), item);
  }

  reset(): void {
    this.store.clear();
  }
}
