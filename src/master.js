const express = require("express");
const axios = require("axios");
const { createLogger } = require("../shared/logger");
const { loadConfig } = require("../shared/config");
const { OrderedLinkedList } = require("../shared/orderedList");
const { raceAcks } = require("../shared/util");

const config = loadConfig();
const logger = createLogger("[Master]");
const app = express();

app.use(express.json());

const messages = new OrderedLinkedList();
let counter = 0;

app.post("/messages", async (req, res) => {
  const { message, w = 1 } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  const writeConcern = parseInt(w);
  if (isNaN(writeConcern) || writeConcern < 1) {
    return res.status(400).json({ error: "Invalid write concern value" });
  }

  const maxW = config.secondaries.length + 1;
  if (writeConcern > maxW) {
    logger.warn(
      `Write concern w=${writeConcern} exceeds available nodes (max: ${maxW}), will wait for secondaries to join`,
    );
  }

  counter++;
  messages.push({ id: counter, message });
  const requiredAcks = writeConcern;

  if (writeConcern === 1) {
    config.secondaries.forEach((secondary) => {
      axios
        .post(`${secondary.url}/replicate`, { id: counter, message })
        .catch((error) => logger.error(`Async replication to ${secondary.name} failed: ${error.message}`));
    });

    return res.json({
      success: true,
      message: "Message appended and replicated",
      messageId: counter,
      totalMessages: messages.getCount(),
      writeConcern,
    });
  }

  const waitForRequiredAcks = async () => {
    const requiredSecondaryAcks = requiredAcks - 1;
    let attempt = 0; // just for attempt count tracking

    while (true) {
      attempt++;
      logger.debug(`Attempt ${attempt}: Waiting for ${requiredSecondaryAcks} secondary ACKs...`);

      const replications = config.secondaries.map((sec) =>
        axios
          .post(`${sec.url}/replicate`, { id: counter, message })
          .then(() => ({ secondary: sec.name, success: true }))
          .catch((err) => ({
            secondary: sec.name,
            success: false,
            error: err.message,
          })),
      );

      const result = await raceAcks(replications, requiredSecondaryAcks);
      if (!result.success) {
        logger.warn(`Insufficient ACKs: ${result.acksReceived}/${requiredAcks}. Retrying in 5s...`);
        await delay(5000);
        continue;
      }
      return result;
    }
  };

  try {
    await waitForRequiredAcks();
    res.json({
      success: true,
      message: "Message appended and replicated",
      messageId: counter,
      totalMessages: messages.getCount(),
      writeConcern: writeConcern,
    });
  } catch (error) {
    logger.error(`Replication failed: ${error.message}`);
    res.status(500).json({ error: "Replication failed", details: error.message });
  }
});

app.get("/messages", (req, res) => {
  res.json({ messages: messages.list(), count: messages.getCount() });
});

const PORT = process.env.PORT || config.master.port;
app.listen(PORT, () => {
  logger.info(`Master server started on port ${PORT}`);
  logger.info(`Configured secondaries: ${config.secondaries.map((s) => s.name).join(", ")}`);
});
