// index.js - Render optimized
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

// Render-specific Puppeteer configuration
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
    '--single-process' // This may be needed for Render's environment
  ],
  executablePath: process.env.CHROMIUM_PATH || undefined // Render provides this
};

// Create WhatsApp client with Render-optimized settings
const client = new Client({
  authStrategy: new LocalAuth({
    clientId: "whatsapp-bot" // Use a fixed clientId for better session handling
  }),
  puppeteer: puppeteerOptions,
  webVersionCache: {
    type: 'remote',
    remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
  }
});

// Store QR code in memory (since file system is ephemeral)
let currentQR = null;
let isAuthenticated = false;

// When client is ready
client.once('ready', () => {
  console.log('✅ WhatsApp Client is ready!');
  isAuthenticated = true;
  io.emit('ready');
});

// When QR code is received
client.on('qr', (qr) => {
  console.log('📱 QR Code received');
  currentQR = qr;
  isAuthenticated = false;
  io.emit('qr', qr);
});

// When authenticated
client.on('authenticated', () => {
  console.log('🔐 Client authenticated');
  isAuthenticated = true;
  io.emit('authenticated');
});

// When authentication fails
client.on('auth_failure', (msg) => {
  console.log('❌ Authentication failed:', msg);
  isAuthenticated = false;
  io.emit('auth_failure', msg);
});

// When disconnected
client.on('disconnected', (reason) => {
  console.log('🔌 Client disconnected:', reason);
  isAuthenticated = false;
  currentQR = null;
  io.emit('disconnected', reason);
  
  // Auto-restart after disconnect
  setTimeout(() => {
    console.log('🔄 Attempting to restart client...');
    client.initialize();
  }, 5000);
});

// Loading screen updates
client.on('loading_screen', (percent, message) => {
  console.log(`🔄 Loading: ${percent}% - ${message}`);
  io.emit('loading_screen', percent, message);
});

// Message handling (your existing code)
client.on('message_create', (message) => {
  console.log(`📩 New message: ${message.body}`);
});

client.on('message_create', async (message) => {
  if (message.body === '!ping') {
    await client.sendMessage(message.from, 'pong');
  }
});

client.on('message_create', async (message) => {
  if (message.body === '!pingreply') {
    await message.reply('pong');
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('🌐 Client connected to website');
  
  // Send current status to new connection
  if (isAuthenticated) {
    socket.emit('ready');
  } else if (currentQR) {
    socket.emit('qr', currentQR);
  }
  
  // Handle refresh QR request
  socket.on('refresh_qr', () => {
    console.log('🔄 Refreshing QR code by request');
    if (isAuthenticated) {
      client.logout();
    }
    client.initialize();
  });
  
  socket.on('disconnect', () => {
    console.log('🌐 Client disconnected from website');
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    whatsapp: isAuthenticated ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start client with error handling
async function initializeClient() {
  try {
    await client.initialize();
    console.log('🚀 WhatsApp client initialization started');
  } catch (error) {
    console.error('❌ Failed to initialize client:', error);
    // Retry after 10 seconds
    setTimeout(initializeClient, 10000);
  }
}

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
  console.log(`📱 Open your browser and navigate to the provided Render URL`);
  initializeClient();
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🔄 SIGTERM received, shutting down gracefully');
  await client.destroy();
  server.close(() => {
    console.log('💤 Process terminated');
    process.exit(0);
  });
});
