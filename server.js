const WebSocket = require('ws');
const http = require('http');

const port = process.env.PORT || 3000;

// Simple HTTP server for Uptime robots to ping
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('WaifuWire Server is Awake!');
});

const wss = new WebSocket.Server({ server });

server.listen(port, () => {
  console.log(`WaifuWire V2 server started on port ${port}`);
});

// Map of userId -> Set of WebSockets (a user might have multiple tabs/windows open)
const clients = new Map();

wss.on('connection', (ws) => {
  console.log('New client connection initiated');
  let currentUserId = null;

  ws.on('message', (messageAsString) => {
    try {
      const message = JSON.parse(messageAsString);
      console.log('Received message type:', message.type);

      if (message.type === 'REGISTER') {
        currentUserId = message.userId;
        if (!clients.has(currentUserId)) {
          clients.set(currentUserId, new Set());
        }
        clients.get(currentUserId).add(ws);
        console.log(`User registered: ${currentUserId}`);
      }

      else if (message.type === 'GROUP_MSG') {
        const broadcastData = JSON.stringify({
          type: 'INCOMING_GROUP_MSG',
          payload: message.payload
        });

        // Broadcast to everyone
        clients.forEach((sockets, id) => {
          sockets.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(broadcastData);
            }
          });
        });
      }

      else if (message.type === 'DIRECT_MSG') {
        const { targetId, payload } = message;
        const sendData = JSON.stringify({
          type: 'INCOMING_DIRECT_MSG',
          payload: payload
        });

        // Send to target
        if (clients.has(targetId)) {
          clients.get(targetId).forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(sendData);
            }
          });
        }
        
        // Echo back to sender so their other tabs see it too
        if (currentUserId !== targetId && clients.has(currentUserId)) {
           clients.get(currentUserId).forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(sendData);
            }
          });
        }
      }
    } catch (err) {
      console.error('Error processing message:', err);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    if (currentUserId && clients.has(currentUserId)) {
      const userSockets = clients.get(currentUserId);
      userSockets.delete(ws);
      if (userSockets.size === 0) {
        clients.delete(currentUserId);
      }
    }
  });
});

// Keep-Alive Ping every 20 seconds
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'PING' }));
    }
  });
}, 20000);
