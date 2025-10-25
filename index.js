// index.js (updated)
const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files (your HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// Create a new client instance with LocalAuth for persistence
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// When the client is ready, run this code (only once)
client.once('ready', () => {
    console.log('Client is ready!');
    io.emit('ready');
});

// When the client received QR-Code
client.on('qr', (qr) => {
    console.log('QR RECEIVED');
    // Emit QR code to all connected clients
    io.emit('qr', qr);
});

// When client is authenticated
client.on('authenticated', () => {
    console.log('Client authenticated');
    io.emit('authenticated');
});

// When authentication fails
client.on('auth_failure', () => {
    console.log('Authentication failed');
    io.emit('auth_failure');
});

// When the client is loading the screen
client.on('loading_screen', (percent, message) => {
    console.log('Loading screen:', percent, message);
    io.emit('loading_screen', percent, message);
});

// Log all incoming messages
client.on('message_create', (message) => {
    console.log(`📩 New message: ${message.body}`);
});

// Respond with "pong" if user sends "!ping"
client.on('message_create', async (message) => {
    if (message.body === '!ping') {
        await client.sendMessage(message.from, 'pong');
    }
});

// Alternatively, reply directly (appears as a reply bubble)
client.on('message_create', async (message) => {
    if (message.body === '!pingreply') {
        await message.reply('pong');
    }
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('Client connected to website');
    
    // If client is already ready, notify the new connection
    if (client.info) {
        socket.emit('ready');
    }
    
    // Handle refresh QR request
    socket.on('refresh_qr', () => {
        console.log('Refreshing QR code by request');
        client.initialize();
    });
    
    socket.on('disconnect', () => {
        console.log('Client disconnected from website');
    });
});

// Start your client
client.initialize();

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser`);
});
