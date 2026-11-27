import "dotenv/config";
import { readFileSync } from "node:fs";
import kafkaJS, { type SASLOptions } from "kafkajs";
const { Kafka, KafkaJSError, logLevel } = kafkaJS;
import { prisma } from "../db/prisma.js";
import { eventSchema, type InventoryEvent } from "./event.validate.js";
import { processEvent } from "./process-event.js";

export const topic = process.env.KAFKA_TOPIC || "inventory-events";
const mechanism = process.env.KAFKA_SASL_MECHANISM;
let sasl: SASLOptions | undefined;
if (mechanism) {
  const { KAFKA_USERNAME: username, KAFKA_PASSWORD: password } = process.env;
  if (
    !username ||
    !password ||
    !(
      mechanism === "plain" ||
      mechanism === "scram-sha-256" ||
      mechanism === "scram-sha-512"
    )
  )
    throw new Error("Set valid Kafka SASL settings");
  sasl = { mechanism, username, password };
}
const kafka = new Kafka({
  clientId: "stockflow",
  brokers: (process.env.KAFKA_BROKERS || "localhost:9092")
    .split(",")
    .map((s) => s.trim()),
  ssl: process.env.KAFKA_CA_FILE
    ? { ca: readFileSync(process.env.KAFKA_CA_FILE, "utf8"), rejectUnauthorized: true }
    : process.env.KAFKA_SSL === "true" || !!sasl,
  sasl,
  logLevel: logLevel.ERROR,
  retry: { retries: 8 },
});
export const producer = kafka.producer({ allowAutoTopicCreation: false });
const consumer = kafka.consumer({
  groupId: process.env.KAFKA_GROUP || "stockflow-inventory-v1",
  sessionTimeout: 60000,
  retry: { restartOnFailure: async () => true },
});
export async function publish(event: InventoryEvent) {
  await producer.send({
    topic,
    acks: -1,
    messages: [{ key: String(event.productId), value: JSON.stringify(event) }],
  });
}
export async function startBroker(notify: (eventId: string) => void) {
  if (process.env.KAFKA_CREATE_TOPIC !== "false") {
    const admin = kafka.admin();
    try {
      await admin.connect();
      await admin.createTopics({
        waitForLeaders: true,
        topics: [
          {
            topic,
            numPartitions: 3,
            replicationFactor: Number(
              process.env.KAFKA_REPLICATION_FACTOR || 1,
            ),
          },
        ],
      });
    } finally {
      await admin.disconnect();
    }
  }
  await producer.connect();
  await consumer.connect();
  await consumer.subscribe({ topic, fromBeginning: true });
  await consumer.run({
    autoCommit: false,
    eachMessage: async ({ topic: stream, partition, message, heartbeat }) => {
      let input: unknown;
      try {
        input = JSON.parse(message.value?.toString() || "null");
      } catch {
        input = null;
      }
      const parsed = eventSchema.safeParse(input);
      let eventId: string;
      try {
        if (
          parsed.success &&
          message.key?.toString() === String(parsed.data.productId)
        ) {
          const receipt = await processEvent(parsed.data);
          eventId = receipt.eventId;
        } else {
          eventId = `invalid:${stream}:${partition}:${message.offset}`;
          await prisma.processedEvent.createMany({
            skipDuplicates: true,
            data: [
              {
                eventId,
                status: "REJECTED",
                reason: "Invalid payload or product key",
              },
            ],
          });
        }
      } catch {
        // Leave the offset pending. KafkaJS can replay after a database outage.
        throw new KafkaJSError(
          "Inventory persistence failed; retrying uncommitted record",
          { retriable: true },
        );
      }
      await heartbeat();
      await consumer.commitOffsets([
        {
          topic: stream,
          partition,
          offset: (BigInt(message.offset) + 1n).toString(),
        },
      ]);
      notify(eventId);
    },
  });
}
export async function stopBroker() {
  await consumer.disconnect();
  await producer.disconnect();
}
