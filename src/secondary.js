const express = require('express');
const { createLogger } = require('../shared/logger');
const { loadConfig } = require('../shared/config');

const config = loadConfig();
const secondaryName = process.env.SECONDARY_NAME || 'secondary';
const logger = createLogger(`[Secondary-(${secondaryName}])`);
const app = express();

app.use(express.json());

const messages = [];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

app.post('/replicate', async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }
  
  await sleep(config.replication.secondaryDelay);
  messages.push(message);

  res.json({
    success: true,
    ack: true,
    secondary: secondaryName,
    totalMessages: messages.length
  });
});

app.get('/messages', (req, res) => {
  res.json({ messages, count: messages.length, secondary: secondaryName });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  logger.info(`Secondary server (${secondaryName}) started on port ${PORT}`);
  logger.info(`Replication delay: ${config.replication.secondaryDelay}ms`);
});
