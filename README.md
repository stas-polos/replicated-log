## Replicated log

For launch project need run command:
```bash
docker compose up
```

For tests:
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

echo ""
```
