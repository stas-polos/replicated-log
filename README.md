## Replicated log

For launch project need run command:

```bash
docker compose up
```

Iteration 1:

```bash
#!/bin/bash

echo "1. Sending message to master (should block for ~2 seconds)..."
time curl -X POST http://localhost:4000/messages \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello from"}' \
  -s | jq .

echo ""
echo "2. Getting messages from master node"
curl http://localhost:4000/messages -s | jq .

echo ""
echo "3. Getting messages from secondary1 node"
curl http://localhost:3001/messages -s | jq .

echo ""
echo "4. Getting messages from secondary2 node"
curl http://localhost:3002/messages -s | jq .
```


Iteration 3:
Example logs:
```
secondary2  | [2025-10-25T11:32:53.147Z] [[Secondary-(secondary2)]] INFO: Secondary server (secondary2) started on port 3002
secondary2  | [2025-10-25T11:32:53.149Z] [[Secondary-(secondary2)]] INFO: ACK delay: 5000ms
secondary1  | [2025-10-25T11:32:53.270Z] [[Secondary-(secondary1)]] INFO: Secondary server (secondary1) started on port 3001
secondary1  | [2025-10-25T11:32:53.271Z] [[Secondary-(secondary1)]] INFO: ACK delay: 0ms
master      | [2025-10-25T11:32:53.410Z] [[Master]] INFO: Master server started on port 3000
master      | [2025-10-25T11:32:53.411Z] [[Master]] INFO: Configured secondaries: secondary1, secondary2
secondary2  | [2025-10-25T11:32:55.150Z] [[Secondary-(secondary2)]] INFO: Start sync with master
secondary1  | [2025-10-25T11:32:55.272Z] [[Secondary-(secondary1)]] INFO: Start sync with master
master      | [2025-10-25T11:32:58.420Z] [[Master]] INFO: Sending heartbeats to secondaries...
master      | [2025-10-25T11:33:03.433Z] [[Master]] INFO: Sending heartbeats to secondaries...
master      | [2025-10-25T11:33:08.446Z] [[Master]] INFO: Sending heartbeats to secondaries...
master      | [2025-10-25T11:33:11.918Z] [[Master]] ERROR: Replication to secondary1 failed: Request failed with status code 500
master      | [2025-10-25T11:33:12.931Z] [[Master]] ERROR: Replication to secondary1 failed: Request failed with status code 500
master      | [2025-10-25T11:33:13.459Z] [[Master]] INFO: Sending heartbeats to secondaries...
master      | [2025-10-25T11:33:13.750Z] [[Master]] ERROR: Replication to secondary2 failed: timeout of 5000ms exceeded
secondary2  | [2025-10-25T11:33:14.755Z] [[Secondary-(secondary2)]] WARN: Duplicate message detected: id=1. Skipping.
master      | [2025-10-25T11:33:14.943Z] [[Master]] INFO: Sufficient ACKs received: 2/2 (returning early)
master      | [2025-10-25T11:33:16.917Z] [[Master]] ERROR: Replication to secondary2 failed: timeout of 5000ms exceeded
secondary2  | [2025-10-25T11:33:17.927Z] [[Secondary-(secondary2)]] WARN: Duplicate message detected: id=2. Skipping.
master      | [2025-10-25T11:33:18.463Z] [[Master]] INFO: Sending heartbeats to secondaries...
master      | [2025-10-25T11:33:23.465Z] [[Master]] INFO: Sending heartbeats to secondaries...
master      | [2025-10-25T11:33:28.470Z] [[Master]] INFO: Sending heartbeats to secondaries...
master      | [2025-10-25T11:33:33.476Z] [[Master]] INFO: Sending heartbeats to secondaries...
master      | [2025-10-25T11:33:38.479Z] [[Master]] INFO: Sending heartbeats to secondaries...
master      | [2025-10-25T11:33:43.487Z] [[Master]] INFO: Sending heartbeats to secondaries...
secondary2 exited with code 137
master      | [2025-10-25T11:33:48.494Z] [[Master]] INFO: Sending heartbeats to secondaries...
master      | [2025-10-25T11:33:53.502Z] [[Master]] INFO: Sending heartbeats to secondaries...
master      | [2025-10-25T11:33:53.522Z] [[Master]] WARN: secondary2 status changed: healthy -> suspected (missed 2 heartbeats)
master      | [2025-10-25T11:33:57.738Z] [[Master]] WARN: For write concern (w=3) need 2 acks, but avaliable 1 secondary. waiting 5s before retry...
master      | [2025-10-25T11:33:58.509Z] [[Master]] INFO: Sending heartbeats to secondaries...
master      | [2025-10-25T11:34:00.456Z] [[Master]] ERROR: Replication to secondary2 failed: getaddrinfo ENOTFOUND secondary2
master      | [2025-10-25T11:34:01.467Z] [[Master]] ERROR: Replication to secondary2 failed: getaddrinfo ENOTFOUND secondary2
master      | [2025-10-25T11:34:02.739Z] [[Master]] INFO: Starting new attempt of replication
master      | [2025-10-25T11:34:02.740Z] [[Master]] WARN: For write concern (w=3) need 2 acks, but avaliable 1 secondary. waiting 5s before retry...
master      | [2025-10-25T11:34:03.479Z] [[Master]] ERROR: Replication to secondary2 failed: getaddrinfo ENOTFOUND secondary2
master      | [2025-10-25T11:34:03.516Z] [[Master]] INFO: Sending heartbeats to secondaries...
master      | [2025-10-25T11:34:03.527Z] [[Master]] WARN: secondary2 status changed: suspected -> unhealthy (missed 4 heartbeats)
master      | [2025-10-25T11:34:07.497Z] [[Master]] ERROR: Replication to secondary2 failed: getaddrinfo ENOTFOUND secondary2
master      | [2025-10-25T11:34:07.744Z] [[Master]] INFO: Starting new attempt of replication
master      | [2025-10-25T11:34:07.745Z] [[Master]] WARN: For write concern (w=3) need 2 acks, but avaliable 1 secondary. waiting 5s before retry...
master      | [2025-10-25T11:34:08.523Z] [[Master]] INFO: Sending heartbeats to secondaries...
master      | [2025-10-25T11:34:12.747Z] [[Master]] INFO: Starting new attempt of replication
master      | [2025-10-25T11:34:12.748Z] [[Master]] WARN: For write concern (w=3) need 2 acks, but avaliable 1 secondary. waiting 5s before retry...
master      | [2025-10-25T11:34:13.525Z] [[Master]] INFO: Sending heartbeats to secondaries...
master      | [2025-10-25T11:34:13.540Z] [[Master]] INFO: secondary2 is back online. Status: unhealthy -> healthy
master      | [2025-10-25T11:34:17.752Z] [[Master]] INFO: Starting new attempt of replication
master      | [2025-10-25T11:34:18.528Z] [[Master]] INFO: Sending heartbeats to secondaries...
master      | [2025-10-25T11:34:22.799Z] [[Master]] ERROR: Replication to secondary2 failed: timeout of 5000ms exceeded
master      | [2025-10-25T11:34:23.533Z] [[Master]] INFO: Sending heartbeats to secondaries...
master      | [2025-10-25T11:34:23.804Z] [[Master]] INFO: Sufficient ACKs received: 3/3 (returning early)
master      | [2025-10-25T11:34:28.541Z] [[Master]] INFO: Sending heartbeats to secondaries...
master      | [2025-10-25T11:34:33.552Z] [[Master]] INFO: Sending heartbeats to secondaries...
master      | [2025-10-25T11:34:38.557Z] [[Master]] INFO: Sending heartbeats to secondaries...
master      | [2025-10-25T11:34:43.562Z] [[Master]] INFO: Sending heartbeats to secondaries...
```
