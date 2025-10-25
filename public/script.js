// Connect to backend
const socket = io();

// Elements
const qrcodeElement = document.getElementById('qrcode');
const statusElement = document.getElementById('status-text');
const statusContainer = document.querySelector('.status');
const refreshBtn = document.getElementById('refresh-btn');

// Update status visually
function updateStatus(text, type = 'connecting') {
  statusElement.textContent = text;
  statusContainer.className = `status ${type}`;
}

// Generate QR code
function generateQRCode(qrData) {
  qrcodeElement.innerHTML = '';
  new QRCode(qrcodeElement, {
    text: qrData,
    width: 250,
    height: 250,
    colorDark: '#075e54',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.H
  });
  updateStatus('Scan the QR code with your phone', 'connecting');
}

// SOCKET LISTENERS
socket.on('connect', () => {
  console.log('🌐 Connected to server');
  updateStatus('Connected — waiting for QR code...', 'connecting');
});

socket.on('disconnect', () => {
  console.log('❌ Disconnected');
  updateStatus('Connection lost. Please refresh.', 'error');
});

socket.on('qr', (qrData) => {
  console.log('📱 QR code received');
  generateQRCode(qrData);
});

socket.on('authenticated', () => {
  console.log('🔐 Authenticated');
  updateStatus('Authentication successful!', 'ready');
});

socket.on('ready', () => {
  console.log('✅ WhatsApp ready');
  updateStatus('WhatsApp Connected Successfully!', 'ready');
  qrcodeElement.innerHTML = `
    <div style="padding: 20px; color: #4caf50; font-weight: bold;">
      ✅ WhatsApp Connected Successfully!
    </div>`;
});

socket.on('auth_failure', () => {
  console.log('❌ Authentication failed');
  updateStatus('Authentication failed. Try again.', 'error');
});

socket.on('loading_screen', (percent, message) => {
  updateStatus(`Loading: ${percent}% - ${message}`, 'connecting');
});

// Refresh QR
refreshBtn.addEventListener('click', () => {
  updateStatus('Requesting new QR code...', 'connecting');
  socket.emit('refresh_qr');
});

// Initialize default state
updateStatus('Connecting to server...', 'connecting');
