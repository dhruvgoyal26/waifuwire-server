const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const port = process.env.PORT || 3000;

// Simple HTTP server for Uptime robots to ping and serving popup files
const server = http.createServer((req, res) => {
  // Resolve static file paths securely
  const urlPath = req.url === '/' ? '/popup.html' : req.url;
  const filePath = path.join(__dirname, 'public', urlPath);
  const resolvedPath = path.resolve(filePath);
  const publicDir = path.resolve(path.join(__dirname, 'public'));

  // Prevent directory traversal attacks
  if (!resolvedPath.startsWith(publicDir)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  const extname = String(path.extname(filePath)).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
  };

  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('WaifuWire Server is Awake!');
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${error.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
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
  ws.isAlive = true;

  ws.on('message', (messageAsString) => {
    try {
      const message = JSON.parse(messageAsString);
      
      if (message.type === 'PONG') {
        ws.isAlive = true;
        return;
      }

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

      else if (message.type === 'CUSTOM_GROUP_MSG') {
        const { groupId, groupName, members, payload } = message;
        const broadcastData = JSON.stringify({
          type: 'INCOMING_CUSTOM_GROUP_MSG',
          groupId: groupId,
          groupName: groupName,
          members: members,
          payload: payload
        });

        // Route strictly to the user IDs present in members
        members.forEach(memberId => {
          if (clients.has(memberId)) {
            clients.get(memberId).forEach(client => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(broadcastData);
              }
            });
          }
        });
      }

      else if (message.type === 'LEAVE_GROUP') {
        const { groupId, leavingUserId, members } = message;
        const broadcastData = JSON.stringify({
          type: 'INCOMING_LEAVE_GROUP',
          groupId: groupId,
          leavingUserId: leavingUserId
        });

        // Notify other members of the group
        members.forEach(memberId => {
          if (memberId !== leavingUserId && clients.has(memberId)) {
            clients.get(memberId).forEach(client => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(broadcastData);
              }
            });
          }
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
        } else {
          // Notify sender that target is offline
          if (clients.has(currentUserId)) {
            const errorMsg = JSON.stringify({
              type: 'USER_OFFLINE',
              payload: {
                targetId: targetId,
                action: payload.action
              }
            });
            clients.get(currentUserId).forEach(client => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(errorMsg);
              }
            });
          }
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
    if (ws.isAlive === false) {
      return ws.terminate();
    }
    ws.isAlive = false;
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'PING' }));
    }
  });
}, 20000);
