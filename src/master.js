const express = require("express");
const axios = require("axios");
const { createLogger } = require("../shared/logger");
const { loadConfig } = require("../shared/config");
const { OrderedLinkedList } = require("../shared/orderedList");
const { delay } = require("../shared/util");

const config = loadConfig();
const logger = createLogger("[Master]");
const app = express();

app.use(express.json());

const messages = new OrderedLinkedList();
let counter = 0;

const secondaryHealth = new Map();
config.secondaries.forEach((sec) => {
  secondaryHealth.set(sec.name, {
    status: "healthy",
    missedHeartbeats: 0,
    lastHeartbeat: Date.now(),
    pendingMessages: [],
  });
});

async function replicateWithRetry(secondary, message, retryAttempt = 0) {
  const maxRetries = config.replication.retryDelays.length;
  const health = secondaryHealth.get(secondary.name);

  if (health.status !== "healthy") {
    logger.debug(`Skipping replication to ${secondary.name} - node is ${health.status}`);
    health.pendingMessages.push(message);
    return { secondary: secondary.name, success: false, skipped: true };
  }

  try {
    const response = await axios.post(`${secondary.url}/replicate`, message, { timeout: config.replication.timeout });

    return { secondary: secondary.name, success: true, ack: response.data };
  } catch (error) {
    logger.error(`Replication to ${secondary.name} failed: ${error.message}`);

    if (retryAttempt < maxRetries - 1) {
      return delay(config.replication.retryDelays[retryAttempt], () =>
        replicateWithRetry(secondary, message, retryAttempt + 1),
      );
    } else {
      logger.error(`Max retries reached for ${secondary.name}, queueing message for later`);
      health.pendingMessages.push(message);
      return { secondary: secondary.name, success: false, error: error.message };
    }
  }
}

function getHealthySecondaries() {
  return config.secondaries.filter((sec) => {
    const health = secondaryHealth.get(sec.name);
    return health.status === "healthy";
  });
}

function hasQuorum() {
  const healthyCount = getHealthySecondaries().length;
  const totalCount = config.secondaries.length;
  const requiredCount = Math.ceil(totalCount * config.quorum.requiredPercentage);

  logger.debug(`Quorum check: ${healthyCount}/${totalCount} healthy (required: ${requiredCount})`);
  return healthyCount >= requiredCount;
}

app.post("/messages", async (req, res) => {
  const { message, w = 1 } = req.body;

  if (!message) {
    logger.error("POST /message - No message provided");
    return res.status(400).json({ error: "Message is required" });
  }

  if (config.quorum.enabled && !hasQuorum()) {
    logger.error("No quorum available - master is in read-only mode");
    return res.status(503).json({
      error: "No quorum available",
      message: "Master is in read-only mode",
      healthySecondaries: getHealthySecondaries().length,
      totalSecondaries: config.secondaries.length,
    });
  }

  const writeConcern = parseInt(w);
  if (isNaN(writeConcern) || writeConcern < 1) {
    return res.status(400).json({ error: "Invalid write concern value" });
  }

  counter++;
  const messageId = counter;
  const messageObj = { id: messageId, message };

  const requiredAcks = writeConcern;
  if (requiredAcks === 1) {
    messages.push(messageObj);
    setImmediate(() => {
      config.secondaries.forEach((secondary) => {
        replicateWithRetry(secondary, messageObj).catch((error) =>
          logger.error(`Async replication to ${secondary.name} failed: ${error.message}`),
        );
      });
    });

    return res.json({
      success: true,
      message: "Message appended and replicated",
      messageId,
      totalMessages: messages.getCount(),
      writeConcern: requiredAcks,
    });
  }

  const waitForRequiredAcks = async () => {
    const requiredSecondaryAcks = requiredAcks - 1;

    while (true) {
      const healthyCount = [...secondaryHealth.values()].filter((sec) => sec.status === "healthy").length;
      if (requiredSecondaryAcks > healthyCount) {
        logger.warn(
          `For write concern (w=${requiredAcks}) need ${requiredSecondaryAcks} acks, but avaliable ${healthyCount} secondary. waiting 5s before retry...`,
        );
        await delay(5000, () => logger.info("Starting new attempt of replication"));
        continue;
      }

      const replicationPromises = config.secondaries.map(async (secondary) => {
        const result = await replicateWithRetry(secondary, messageObj);
        return result;
      });

      const result = await new Promise((resolve) => {
        let completed = 0;
        let successCount = 0;
        let resolved = false;

        replicationPromises.forEach((promise) => {
          promise
            .then((result) => {
              if (resolved) return;

              completed++;
              if (result.success) {
                successCount++;

                if (successCount >= requiredSecondaryAcks) {
                  resolved = true;
                  logger.info(`Sufficient ACKs received: ${successCount + 1}/${requiredAcks} (returning early)`);
                  resolve({ success: true, acksReceived: successCount + 1 });
                }
              }

              if (completed === config.secondaries.length && !resolved) {
                resolve({ success: successCount >= requiredSecondaryAcks, acksReceived: successCount + 1 });
              }
            })
            .catch(() => {
              if (resolved) return;
              completed++;
              if (completed === config.secondaries.length && !resolved) {
                resolve({ success: successCount >= requiredSecondaryAcks, acksReceived: successCount + 1 });
              }
            });
        });
      });

      if (result.success) {
        return result;
      }

      logger.warn(`Insufficient ACKs: ${result.acksReceived}/${requiredAcks}, waiting 5s before retry...`);
      await delay(5000, () => logger.info("Starting new attempt of replication"));
    }
  };

  try {
    const result = await waitForRequiredAcks();
    messages.push(messageObj);

    res.json({
      success: true,
      message: "Message appended and replicated",
      messageId,
      totalMessages: messages.getCount(),
      writeConcern: requiredAcks,
      acksReceived: result.acksReceived,
    });
  } catch (error) {
    logger.error(`Replication failed: ${error.message}`);
    res.status(500).json({ error: "Replication failed", details: error.message });
  }
});

app.get("/messages", (req, res) => {
  const messagesList = messages.list();
  res.json({
    messages: messagesList,
    count: messages.length,
    totalReceived: messages.getCount(),
  });
});

app.get("/health", (req, res) => {
  const healthStatus = {};
  secondaryHealth.forEach((health, name) => {
    healthStatus[name] = {
      status: health.status,
      missedHeartbeats: health.missedHeartbeats,
      lastHeartbeat: new Date(health.lastHeartbeat).toISOString(),
      pendingMessages: health.pendingMessages.length,
    };
  });

  const hasQuorumStatus = hasQuorum();

  res.json({
    master: "healthy",
    secondaries: healthStatus,
    quorum: hasQuorumStatus,
    readOnly: config.quorum.enabled && !hasQuorumStatus,
  });
});

app.post("/sync/:secondaryName", async (req, res) => {
  const { secondaryName } = req.params;
  const { lastMessageId = 0 } = req.body;

  logger.debug(`Sync request from ${secondaryName}, lastMessageId=${lastMessageId}`);
  const missedMessages = messages.getAllMessages().filter((m) => m.id > lastMessageId);
  logger.debug(`Sending ${missedMessages.length} missed messages to ${secondaryName}`);

  res.json({ success: true, messages: missedMessages, count: missedMessages.length });
});

function startHeartbeat() {
  setInterval(async () => {
    logger.info("Sending heartbeats to secondaries...");

    for (const secondary of config.secondaries) {
      const health = secondaryHealth.get(secondary.name);

      try {
        await axios.get(`${secondary.url}/heartbeat`, { timeout: 2000 });

        health.missedHeartbeats = 0;
        health.lastHeartbeat = Date.now();

        if (health.status === "healthy") continue;

        logger.info(`${secondary.name} is back online. Status: ${health.status} -> healthy`);
        health.status = "healthy";
        if (health.pendingMessages.length > 0) {
          logger.info(`Syncing ${health.pendingMessages.length} pending messages to ${secondary.name}`);
          const pending = [...health.pendingMessages];
          health.pendingMessages = [];

          for (const msg of pending) await replicateWithRetry(secondary, msg);
        }
      } catch (error) {
        health.missedHeartbeats++;
        health.lastHeartbeat = Date.now();

        const prevStatus = health.status;

        if (health.missedHeartbeats >= config.heartbeat.unhealthyThreshold) {
          health.status = "unhealthy";
        } else if (health.missedHeartbeats >= config.heartbeat.suspectedThreshold) {
          health.status = "suspected";
        }

        if (prevStatus !== health.status) {
          logger.warn(
            `${secondary.name} status changed: ${prevStatus} -> ${health.status} (missed ${health.missedHeartbeats} heartbeats)`,
          );
        }
      }
    }
  }, config.heartbeat.interval);
}

const PORT = process.env.PORT || config.master.port;
app.listen(PORT, () => {
  logger.info(`Master server started on port ${PORT}`);
  logger.info(`Configured secondaries: ${config.secondaries.map((s) => s.name).join(", ")}`);
  startHeartbeat();
});
