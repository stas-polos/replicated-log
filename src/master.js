const express = require('express');
const axios = require('axios');
const { createLogger } = require('../shared/logger');
const { loadConfig } = require('../shared/config');

const config = loadConfig();
const logger = createLogger('[Master]');
const app = express();

app.use(express.json());

const messages = [];
let counter = 0;

app.post('/messages', async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  counter++;
  logger.info(`POST /messages - Received: "[${counter}]: ${message}"`);
  messages.push({ id: counter, message });
  
  try {
    const replicationPromises = config.secondaries.map(async (secondary) => {
      logger.debug(`Replicating to ${secondary.name} at ${secondary.url}`);
      const response = await axios.post(`${secondary.url}/replicate`, { message });
      logger.debug(`ACK received from ${secondary.name}`);
      return response.data;
    });

    await Promise.all(replicationPromises);
    res.json({
      success: true,
      message: 'Message appended and replicated',
      totalMessages: messages.length
    });
  } catch (error) {
    logger.error(`Replication failed: ${error.message}`);
    res.status(500).json({ error: 'Replication failed', details: error.messag });
  }
});

app.get('/messages', (req, res) => {
  res.json({ messages, count: messages.length });
});

const PORT = process.env.PORT || config.master.port;
app.listen(PORT, () => {
  logger.info(`Master server started on port ${PORT}`);
  logger.info(`Configured secondaries: ${config.secondaries.map(s => s.name).join(', ')}`);
});
