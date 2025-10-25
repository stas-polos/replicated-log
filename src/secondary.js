const express = require("express");
const { createLogger } = require("../shared/logger");
const { loadConfig } = require("../shared/config");
const { OrderedLinkedList } = require("../shared/orderedList");
const { delay } = require("../shared/util");

const config = loadConfig();
const secondaryName = process.env.SECONDARY_NAME || "secondary";
const logger = createLogger(`[Secondary-(${secondaryName})]`);
const app = express();

app.use(express.json());

const messages = new OrderedLinkedList();

function getSecondaryConfig() {
  const secondary = config.secondaries.find((s) => s.name === secondaryName);
  return secondary || { delay: config.replication.delay };
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

  const secondaryConfig = getSecondaryConfig();
  await delay(secondaryConfig.delay, () => messages.push(message));

  res.json({
    success: true,
    ack: true,
    secondary: secondaryName,
    totalMessages: messages.getCount(),
  });
});

app.get("/messages", (req, res) => {
  res.json({
    messages: messages.list(),
    count: messages.getCount(),
    secondary: secondaryName,
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  const secondaryConfig = getSecondaryConfig();
  logger.info(`Secondary server (${secondaryName}) started on port ${PORT}`);
  logger.info(`ACK delay: ${secondaryConfig.delay}ms`);
});
