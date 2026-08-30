import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import type { TranscriptItem } from "../contract.js";
import type { Store } from "./store.js";

export class DynamoStore implements Store {
  constructor(
    private readonly table: string,
    private readonly client: DynamoDBDocumentClient = DynamoDBDocumentClient.from(
      new DynamoDBClient({}),
      { marshallOptions: { removeUndefinedValues: true } },
    ),
  ) {}

  async get(videoId: string): Promise<TranscriptItem | null> {
    const answer = await this.client.send(
      new GetCommand({ TableName: this.table, Key: { video_id: videoId } }),
    );
    return (answer.Item as TranscriptItem | undefined) ?? null;
  }

  async put(item: TranscriptItem): Promise<void> {
    await this.client.send(new PutCommand({ TableName: this.table, Item: item }));
  }
}
