class SoundCloudConverter {
    constructor() {
        this.form = document.getElementById('downloadForm');
        this.urlInput = document.getElementById('url');
        this.formatSelect = document.getElementById('format');
        this.qualitySelect = document.getElementById('quality');
        this.qualityGroup = document.getElementById('qualityGroup');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.infoBtn = document.getElementById('infoBtn');
        this.btnText = this.downloadBtn.querySelector('.btn-text');
        this.btnSpinner = this.downloadBtn.querySelector('.btn-spinner');
        this.trackInfo = document.getElementById('trackInfo');
        this.progressContainer = document.getElementById('progressContainer');
        this.progressFill = document.querySelector('.progress-fill');
        this.progressText = document.querySelector('.progress-text');
        this.messageContainer = document.getElementById('messageContainer');
        
        this.isDownloading = false;
        this.progressInterval = null;
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.updateQualityVisibility();
    }
    
    bindEvents() {
        this.form.addEventListener('submit', this.handleSubmit.bind(this));
        this.infoBtn.addEventListener('click', this.getTrackInfo.bind(this));
        this.formatSelect.addEventListener('change', this.updateQualityVisibility.bind(this));
        this.urlInput.addEventListener('input', this.validateUrl.bind(this));
        this.urlInput.addEventListener('paste', this.handlePaste.bind(this));
    }
    
    updateQualityVisibility() {
        const format = this.formatSelect.value;
        this.qualityGroup.style.display = format === 'mp3' ? 'flex' : 'none';
    }
    
    validateUrl() {
        const url = this.urlInput.value.trim();
        const isValid = this.isValidSoundCloudUrl(url);
        
        this.infoBtn.disabled = !isValid;
        this.downloadBtn.disabled = !isValid;
        
        if (url && !isValid) {
            this.showMessage('Please enter a valid SoundCloud URL', 'error');
        } else {
            this.clearMessages();
        }
    }
    
    isValidSoundCloudUrl(url) {
        if (!url) return false;
        
        try {
            const urlObj = new URL(url);
            const validDomains = ['soundcloud.com', 'on.soundcloud.com', 'm.soundcloud.com'];
            return validDomains.some(domain => urlObj.hostname.includes(domain));
        } catch {
            return false;
        }
    }
    
    handlePaste(event) {
        // Small delay to allow paste to complete
        setTimeout(() => {
            this.validateUrl();
        }, 100);
    }
    
    async getTrackInfo() {
        const url = this.urlInput.value.trim();
        
        if (!this.isValidSoundCloudUrl(url)) {
            this.showMessage('Please enter a valid SoundCloud URL', 'error');
            return;
        }
        
        this.infoBtn.disabled = true;
        this.showMessage('Getting track information...', 'info');
        
        try {
            const response = await fetch('/info', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.displayTrackInfo(data.info);
                this.clearMessages();
            } else {
                this.showMessage(data.error || 'Could not get track information', 'error');
                this.hideTrackInfo();
            }
        } catch (error) {
            console.error('Error getting track info:', error);
            this.showMessage('Failed to get track information', 'error');
            this.hideTrackInfo();
        } finally {
            this.infoBtn.disabled = false;
        }
    }
    
    displayTrackInfo(info) {
        document.getElementById('trackTitle').textContent = info.title || 'Unknown Title';
        document.getElementById('trackArtist').textContent = `Artist: ${info.uploader || 'Unknown'}`;
        document.getElementById('trackDuration').textContent = `Duration: ${info.duration || 'Unknown'}`;
        
        this.trackInfo.classList.remove('hidden');
    }
    
    hideTrackInfo() {
        this.trackInfo.classList.add('hidden');
    }
    
    async handleSubmit(event) {
        event.preventDefault();
        
        if (this.isDownloading) return;
        
        const url = this.urlInput.value.trim();
        const format = this.formatSelect.value;
        const quality = this.qualitySelect.value;
        
        if (!this.isValidSoundCloudUrl(url)) {
            this.showMessage('Please enter a valid SoundCloud URL', 'error');
            return;
        }
        
        // Check if URL is a playlist
        const isPlaylist = url.toLowerCase().includes('/sets/');
        if (isPlaylist) {
            this.showMessage('Playlist detected. Download may take longer than usual.', 'info');
        }
        
        this.startDownload(isPlaylist);
        
        try {
            const formData = new FormData();
            formData.append('url', url);
            formData.append('format', format);
            if (format === 'mp3') {
                formData.append('quality', quality);
            }
            
            const response = await fetch('/', {
                method: 'POST',
                body: formData
            });
            
            if (response.ok) {
                // Handle file download
                const blob = await response.blob();
                const downloadUrl = window.URL.createObjectURL(blob);
                
                // Get filename from response headers
                const contentDisposition = response.headers.get('Content-Disposition');
                let filename = 'download.' + format;
                if (contentDisposition) {
                    // Try multiple patterns to extract filename
                    // Pattern 1: filename="..." (with quotes)
                    let filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
                    if (!filenameMatch) {
                        // Pattern 2: filename=... (without quotes)
                        filenameMatch = contentDisposition.match(/filename=([^;]+)/);
                    }
                    if (!filenameMatch) {
                        // Pattern 3: filename*=UTF-8''... (RFC 5987 encoded)
                        filenameMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/);
                    }
                    
                    if (filenameMatch) {
                        filename = decodeURIComponent(filenameMatch[1].trim());
                        // Remove any remaining quotes
                        filename = filename.replace(/^["']|["']$/g, '');
                    }
                }
                
                // Create download link
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(downloadUrl);
                
                this.showMessage('Download completed successfully!', 'success');
            } else {
                const errorData = await response.json();
                this.showMessage(errorData.error || 'Download failed', 'error');
            }
        } catch (error) {
            console.error('Download error:', error);
            this.showMessage('Download failed. Please try again.', 'error');
        } finally {
            this.stopDownload();
        }
    }
    
    startDownload(isPlaylist = false) {
        this.isDownloading = true;
        this.downloadBtn.disabled = true;
        this.btnText.classList.add('hidden');
        this.btnSpinner.classList.remove('hidden');
        
        this.progressContainer.classList.remove('hidden');
        this.simulateProgress(isPlaylist);
        
        this.clearMessages();
    }
    
    stopDownload() {
        this.isDownloading = false;
        this.downloadBtn.disabled = false;
        this.btnText.classList.remove('hidden');
        this.btnSpinner.classList.add('hidden');
        
        this.progressContainer.classList.add('hidden');
        this.progressFill.style.width = '0%';
        
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
    }
    
    simulateProgress(isPlaylist = false) {
        let progress = 0;
        const steps = [
            { progress: 20, text: 'Validating URL...' },
            { progress: 40, text: 'Connecting to SoundCloud...' },
            { progress: 60, text: 'Downloading audio...' },
            { progress: 80, text: 'Converting to ' + this.formatSelect.value.toUpperCase() + '...' },
            { progress: 95, text: 'Finalizing download...' }
        ];
        
        // Adjust timing for playlists
        const stepTime = isPlaylist ? 1500 : 1000; // Slightly longer steps for playlists
        
        let stepIndex = 0;
        
        this.progressInterval = setInterval(() => {
            if (stepIndex < steps.length) {
                const step = steps[stepIndex];
                progress = step.progress;
                this.progressFill.style.width = progress + '%';
                this.progressText.textContent = step.text;
                
                // For playlists, add additional info to the download step
                if (isPlaylist && stepIndex === 2) {
                    this.progressText.textContent = 'Downloading playlist tracks... (this may take a while)';
                }
                
                stepIndex++;
            } else {
                // Keep at 95% until actual completion
                this.progressFill.style.width = '95%';
                this.progressText.textContent = isPlaylist ?
                    'Almost ready... (processing multiple tracks)' :
                    'Almost ready...';
            }
        }, stepTime);
    }
    
    showMessage(message, type = 'info') {
        this.clearMessages();
        
        const messageEl = document.createElement('div');
        messageEl.className = `message ${type}`;
        
        const icon = this.getMessageIcon(type);
        messageEl.innerHTML = `${icon} ${message}`;
        
        this.messageContainer.appendChild(messageEl);
        
        // Auto-hide success messages
        if (type === 'success') {
            setTimeout(() => {
                this.clearMessages();
            }, 5000);
        }
    }
    
    getMessageIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || icons.info;
    }
    
    clearMessages() {
        this.messageContainer.innerHTML = '';
    }
}

// Utility functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new SoundCloudConverter();
    
    // Add some nice animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    // Observe feature cards for animation
    document.querySelectorAll('.feature-card').forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(card);
    });
});

// Handle service worker for offline functionality (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Uncomment if you want to add a service worker
        // navigator.serviceWorker.register('/sw.js');
    });
}

// Add keyboard shortcuts
document.addEventListener('keydown', (event) => {
    // Ctrl/Cmd + Enter to download
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        const downloadBtn = document.getElementById('downloadBtn');
        if (!downloadBtn.disabled) {
            downloadBtn.click();
        }
    }
    
    // Escape to clear messages
    if (event.key === 'Escape') {
        document.querySelector('.message-container').innerHTML = '';
    }
});

// Add copy URL functionality
function copyToClipboard(text) {
    if (navigator.clipboard) {
        return navigator.clipboard.writeText(text);
    } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        return Promise.resolve();
    }
}

// Handle paste from clipboard
async function pasteFromClipboard() {
    if (navigator.clipboard) {
        try {
            const text = await navigator.clipboard.readText();
            const urlInput = document.getElementById('url');
            urlInput.value = text;
            urlInput.dispatchEvent(new Event('input'));
        } catch (err) {
            console.log('Failed to read clipboard');
        }
    }
}

// Add right-click context menu for paste
document.getElementById('url').addEventListener('contextmenu', (event) => {
    // Let the default context menu show, but also trigger validation after paste
    setTimeout(() => {
        document.getElementById('url').dispatchEvent(new Event('input'));
    }, 100);
});
