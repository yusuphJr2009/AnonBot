// Connect to server
const socket = io();

// DOM elements
const qrcodeElement = document.getElementById('qrcode');
const statusElement = document.getElementById('status-text');
const statusContainer = document.querySelector('.status');
const refreshBtn = document.getElementById('refresh-btn');

// Update status
function updateStatus(status, type = 'connecting') {
    statusElement.textContent = status;
    statusContainer.className = 'status ' + type;
}

// Generate QR Code
function generateQRCode(qrData) {
    qrcodeElement.innerHTML = '';
    QRCode.toCanvas(qrData, {
        width: 250,
        height: 250,
        margin: 1,
        color: {
            dark: '#075e54',
            light: '#ffffff'
        }
    }, function (err, canvas) {
        if (err) {
            console.error('QR generation error:', err);
            updateStatus('Error generating QR code', 'error');
            return;
        }
        qrcodeElement.appendChild(canvas);
        updateStatus('Scan the QR code with your phone', 'connecting');
    });
}

// Socket listeners
socket.on('connect', () => {
    console.log('Connected to server');
    updateStatus('Connected, waiting for QR code...', 'connecting');
});

socket.on('disconnect', () => {
    console.log('Disconnected');
    updateStatus('Connection lost. Please refresh.', 'error');
});

socket.on('qr', (qrData) => {
    console.log('QR received');
    generateQRCode(qrData);
});

socket.on('ready', () => {
    console.log('WhatsApp client ready');
    updateStatus('WhatsApp is connected and ready!', 'ready');
    qrcodeElement.innerHTML = `
        <div style="padding: 20px; color: #4caf50; font-weight: bold;">
            ✅ WhatsApp Connected Successfully!
        </div>`;
});

socket.on('authenticated', () => {
    console.log('Authentication successful');
    updateStatus('Authentication successful!', 'ready');
});

socket.on('auth_failure', () => {
    console.log('Authentication failed');
    updateStatus('Authentication failed. Please try again.', 'error');
});

socket.on('loading_screen', (percent, message) => {
    updateStatus(`Loading: ${percent}% - ${message}`, 'connecting');
});

// Refresh button
refreshBtn.addEventListener('click', () => {
    updateStatus('Requesting new QR code...', 'connecting');
    socket.emit('refresh_qr');
});

// Initial status
updateStatus('Connecting to server...', 'connecting');

