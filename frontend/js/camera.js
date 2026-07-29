let currentStream = null;
let cameraPage = null;

// Initialize camera on page load
document.addEventListener('DOMContentLoaded', function() {
    cameraPage = document.getElementById('camera-page');
    if (cameraPage) {
        initCamera();
    }
});

// Navigation handler - STOP camera when leaving
document.addEventListener('click', function(e) {
    const navLink = e.target.closest('a[data-page]');
    if (navLink) {
        stopCamera();
    }
});

function initCamera() {
    navigator.mediaDevices.getUserMedia({ 
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false 
    })
    .then(stream => {
        currentStream = stream;
        const video = document.getElementById('video');
        if (video) {
            video.srcObject = stream;
            console.log('✅ Camera started');
        }
    })
    .catch(err => {
        console.error('❌ Camera error:', err);
        alert('Cannot access camera. Check permissions.');
    });
}

function stopCamera() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => {
            track.stop();
            console.log('🛑 Stopped:', track.kind, 'track');
        });
        currentStream = null;
        
        const video = document.getElementById('video');
        if (video) {
            video.srcObject = null;
        }
    }
}

// Also stop when page is hidden
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        stopCamera();
    }
});

// Clean up on page unload
window.addEventListener('beforeunload', function() {
    stopCamera();
});
