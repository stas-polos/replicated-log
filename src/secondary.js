const express = require("express");
const axios = require("axios");
const { createLogger } = require("../shared/logger");
const { loadConfig } = require("../shared/config");
const { OrderedLinkedList } = require("../shared/orderedList");
const { delay } = require("../shared/util");

const config = loadConfig();
const secondaryName = process.env.SECONDARY_NAME || "secondary";
const masterUrl = process.env.MASTER_URL || `http://master:3000`;
const logger = createLogger(`[Secondary-(${secondaryName})]`);
const app = express();

app.use(express.json());

const messages = new OrderedLinkedList();

function getSecondaryConfig() {
  const secondary = config.secondaries.find((s) => s.name === secondaryName);
  return secondary || { delay: config.replication.secondaryDelay };
}

function simulateRandomError() {
  const errorProbability = 0.2;
  return Math.random() < errorProbability;
}

app.post("/replicate", async (req, res) => {
  const message = req.body;

  if (!message.id || !message.message) {
    logger.error("POST /replicate - Invalid message format");
    return res.status(400).json({ error: "Invalid message format" });
  }

  if (messages.has(message.id)) {
    logger.warn(`Duplicate message detected: id=${message.id}. Skipping.`);
    return res.json({
      success: true,
      ack: true,
      secondary: secondaryName,
      duplicate: true,
      totalMessages: messages.getCount(),
    });
  }

  if (simulateRandomError()) {
    return res.status(500).json({ error: "Simulated internal server error" });
  }

  const secondaryConfig = getSecondaryConfig();
  logger.info(`Delay for ${process.env.SECONDARY_NAME} -> ${process.env.SECONDARY_DELAY}`);
  await delay(process.env.SECONDARY_DELAY || secondaryConfig.delay, () => messages.push(message));

  res.json({
    success: true,
    ack: true,
    secondary: secondaryName,
    totalMessages: messages.getCount(),
  });
});

app.get("/messages", (req, res) => {
  const messagesList = messages.list();
  res.json({
    messages: messagesList,
    count: messagesList.length,
    secondary: secondaryName,
  });
});

app.get("/heartbeat", (req, res) => {
  res.json({ status: "healthy", count: messages.getCount(), secondary: secondaryName, timestamp: Date.now() });
});

async function syncWithMaster() {
  try {
    const allMessages = messages.getAllMessages();
    const lastMessageId = allMessages.length > 0 ? Math.max(...allMessages.map((m) => m.id)) : 0;

    const response = await axios.post(`${masterUrl}/sync/${secondaryName}`, { lastMessageId }, { timeout: 5000 });
    const missedMessages = response.data.messages || [];

    missedMessages.map((msg) => {
      if (!messages.has(msg.id)) messages.push(msg);
    });
  } catch (error) {
    logger.error(`Failed to sync with master: ${error.message}`);
  }
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
  const secondaryConfig = getSecondaryConfig();
  logger.info(`Secondary server (${secondaryName}) started on port ${PORT}`);
  logger.info(`ACK delay: ${secondaryConfig.delay}ms`);

  await delay(2000, () => logger.info("Start sync with master"));
  await syncWithMaster();
  // sync each 30s
  setInterval(syncWithMaster, 30000);
});
