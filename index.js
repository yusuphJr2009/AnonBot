const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Puppeteer configuration for Render
const puppeteerOptions = {
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--disable-gpu',
    '--single-process'
  ],
  executablePath: process.env.CHROMIUM_PATH || undefined
};

const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'whatsapp-bot' }),
  puppeteer: puppeteerOptions,
  webVersionCache: {
    type: 'remote',
    remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
  }
});

let currentQR = null;
let isAuthenticated = false;

// WhatsApp events
client.once('ready', () => {
  console.log('✅ WhatsApp Client ready');
  isAuthenticated = true;
  io.emit('ready');
});

client.on('qr', (qr) => {
  console.log('📱 QR Code generated');
  currentQR = qr;
  isAuthenticated = false;
  io.emit('qr', qr);
});

client.on('authenticated', () => {
  console.log('🔐 Authenticated');
  isAuthenticated = true;
  io.emit('authenticated');
});

client.on('auth_failure', (msg) => {
  console.log('❌ Auth failure:', msg);
  isAuthenticated = false;
  io.emit('auth_failure', msg);
});

client.on('disconnected', (reason) => {
  console.log('🔌 Disconnected:', reason);
  isAuthenticated = false;
  currentQR = null;
  io.emit('disconnected', reason);

  setTimeout(() => {
    console.log('🔄 Restarting client...');
    client.initialize();
  }, 5000);
});

client.on('loading_screen', (percent, message) => {
  console.log(`🔄 Loading: ${percent}% - ${message}`);
  io.emit('loading_screen', percent, message);
});

// Simple message handling for now
client.on('message_create', async (message) => {
  if (message.body === '!ping') {
    await client.sendMessage(message.from, 'pong');
  }
  if (message.body === '!pingreply') {
    await message.reply('pong');
  }
});

// WebSocket
io.on('connection', (socket) => {
  console.log('🌐 Web client connected');

  if (isAuthenticated) socket.emit('ready');
  else if (currentQR) socket.emit('qr', currentQR);

  socket.on('refresh_qr', () => {
    console.log('🔄 Manual QR refresh');
    if (isAuthenticated) client.logout();
    client.initialize();
  });

  socket.on('disconnect', () => console.log('🌐 Web client disconnected'));
});

// Endpoints
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    whatsapp: isAuthenticated ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Init function
async function initializeClient() {
  try {
    await client.initialize();
    console.log('🚀 WhatsApp client initializing');
  } catch (err) {
    console.error('❌ Initialization failed:', err);
    setTimeout(initializeClient, 10000);
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
  initializeClient();
});

process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received — closing');
  await client.destroy();
  server.close(() => process.exit(0));
});
