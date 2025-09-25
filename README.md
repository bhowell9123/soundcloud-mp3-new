# 🎵 SoundCloud to MP3 Converter

A modern, fast, and user-friendly web application for converting SoundCloud tracks to high-quality audio files. Built with Flask and featuring a responsive design that works perfectly on all devices.

![SoundCloud Converter](https://img.shields.io/badge/SoundCloud-Converter-orange?style=for-the-badge&logo=soundcloud)
![Python](https://img.shields.io/badge/Python-3.11+-blue?style=for-the-badge&logo=python)
![Flask](https://img.shields.io/badge/Flask-2.3+-green?style=for-the-badge&logo=flask)

## ✨ Features

### 🚀 **Fast & Reliable**
- High-speed downloads with optimized processing
- Robust error handling and retry mechanisms
- Production-ready with Gunicorn WSGI server

### 🎨 **Modern UI/UX**
- Beautiful, responsive design that works on all devices
- Dark theme with smooth animations and transitions
- Real-time progress tracking and user feedback
- Mobile-optimized with touch-friendly controls

### 🔧 **Advanced Functionality**
- Support for multiple audio formats (MP3, WAV, AAC)
- Configurable quality settings for MP3 (128-320 kbps)
- Track information preview before download
- Automatic file cleanup for privacy and storage management

### 🛡️ **Security & Performance**
- Rate limiting to prevent abuse
- Input validation and sanitization
- CSRF protection and security headers
- Efficient memory usage and resource management

### 📱 **User Experience**
- One-click downloads with automatic file delivery
- Keyboard shortcuts for power users
- Comprehensive error messages and user guidance
- Accessibility features and high contrast support

## 🚀 Quick Start

### Prerequisites

- Python 3.11 or higher
- FFmpeg (for audio conversion)
- yt-dlp (automatically installed)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/soundcloud-to-mp3-converter.git
   cd soundcloud-to-mp3-converter
   ```

2. **Create a virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Install FFmpeg**
   
   **macOS (Homebrew):**
   ```bash
   brew install ffmpeg
   ```
   
   **Ubuntu/Debian:**
   ```bash
   sudo apt update
   sudo apt install ffmpeg
   ```
   
   **Windows:**
   Download from [FFmpeg official website](https://ffmpeg.org/download.html) and add to PATH.

5. **Configure environment (optional)**
   ```bash
   cp .env.example .env
   # Edit .env with your preferred settings
   ```

6. **Run the application**
   ```bash
   python app.py
   ```

   Visit `http://localhost:5000` in your browser.

## 🐳 Docker Deployment

### Build and run with Docker

```bash
# Build the image
docker build -t soundcloud-converter .

# Run the container
docker run -p 5000:5000 soundcloud-converter
```

### Using Docker Compose

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      - FLASK_ENV=production
      - SECRET_KEY=your-secret-key
    volumes:
      - ./downloads:/app/downloads
```

## ☁️ Deploy to Render

### One-Click Deploy

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

### Manual Deployment

1. **Fork this repository**

2. **Connect to Render**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New +" → "Web Service"
   - Connect your GitHub repository

3. **Configure the service**
   - **Name**: `soundcloud-to-mp3-converter`
   - **Environment**: `Python 3`
   - **Build Command**: 
     ```bash
     pip install --upgrade pip && pip install -r requirements.txt && pip install --upgrade yt-dlp
     ```
   - **Start Command**: 
     ```bash
     gunicorn --config gunicorn.conf.py app:app
     ```

4. **Set environment variables**
   ```
   FLASK_ENV=production
   SECRET_KEY=your-random-secret-key
   PORT=5000
   ```

5. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment to complete

## 🔧 Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `FLASK_ENV` | `production` | Flask environment mode |
| `SECRET_KEY` | `dev-key-change-in-production` | Flask secret key for sessions |
| `PORT` | `5000` | Port to run the application |
| `DOWNLOADS_DIR` | `./downloads` | Directory for temporary file storage |
| `MAX_FILE_SIZE` | `104857600` | Maximum file size in bytes (100MB) |
| `LOG_LEVEL` | `INFO` | Logging level |
| `ALLOWED_DOMAINS` | `soundcloud.com,on.soundcloud.com,m.soundcloud.com` | Allowed SoundCloud domains |

### Production Settings

For production deployment, ensure you:

1. **Set a strong SECRET_KEY**
   ```bash
   export SECRET_KEY=$(python -c 'import secrets; print(secrets.token_hex())')
   ```

2. **Configure proper logging**
   ```bash
   export LOG_LEVEL=WARNING
   ```

3. **Set up HTTPS** (handled by Render automatically)

4. **Configure rate limiting** (built-in, no additional setup needed)

## 📖 API Documentation

### Health Check
```http
GET /health
```
Returns the application health status and dependency information.

### Track Information
```http
POST /info
Content-Type: application/json

{
  "url": "https://soundcloud.com/artist/track"
}
```
Returns track metadata without downloading.

### Download Track
```http
POST /
Content-Type: application/x-www-form-urlencoded

url=https://soundcloud.com/artist/track
format=mp3
quality=192
```
Downloads and converts the track to the specified format.

## 🛠️ Development

### Project Structure

```
soundcloud-converter/
├── app.py                 # Main Flask application
├── requirements.txt       # Python dependencies
├── gunicorn.conf.py      # Gunicorn configuration
├── Dockerfile            # Docker configuration
├── render.yaml           # Render deployment config
├── templates/
│   └── index.html        # Main HTML template
├── static/
│   ├── css/
│   │   └── styles.css    # Responsive CSS styles
│   └── js/
│       └── app.js        # Frontend JavaScript
└── downloads/            # Temporary file storage
```

### Running in Development Mode

```bash
export FLASK_ENV=development
python app.py
```

This enables:
- Debug mode with auto-reload
- Detailed error messages
- Development logging

### Code Quality

The project follows Python best practices:

- **PEP 8** code style
- **Type hints** for better code documentation
- **Comprehensive error handling**
- **Security best practices**
- **Performance optimization**

## 🔒 Security Features

- **Input validation** for all user inputs
- **Rate limiting** to prevent abuse
- **CSRF protection** for form submissions
- **Secure file handling** with automatic cleanup
- **Domain validation** for SoundCloud URLs only
- **File size limits** to prevent resource exhaustion

## 🚨 Troubleshooting

### Common Issues

**1. "yt-dlp not found" error**
```bash
pip install --upgrade yt-dlp
```

**2. "ffmpeg not found" error**
- Install FFmpeg using your system's package manager
- Ensure FFmpeg is in your system PATH

**3. Download fails with "Private video" error**
- The track is private or requires authentication
- Only public SoundCloud tracks are supported

**4. Application won't start on Render**
- Check the build logs for dependency installation errors
- Ensure all environment variables are set correctly
- Verify the start command in render.yaml

### Performance Optimization

For high-traffic deployments:

1. **Use Redis for rate limiting**
   ```bash
   export REDIS_URL=redis://your-redis-instance
   ```

2. **Increase worker processes**
   ```python
   # In gunicorn.conf.py
   workers = multiprocessing.cpu_count() * 2 + 1
   ```

3. **Configure CDN** for static assets

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

### Development Setup

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests if applicable
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## ⚠️ Disclaimer

This tool is for personal use only. Please respect artists' rights and SoundCloud's terms of service. Users are responsible for ensuring they have the right to download and use the content.

## 🙏 Acknowledgments

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) for the powerful download engine
- [FFmpeg](https://ffmpeg.org/) for audio conversion capabilities
- [Flask](https://flask.palletsprojects.com/) for the web framework
- [Render](https://render.com/) for easy deployment platform

---

**Made with ❤️ for music lovers**

For support or questions, visit [liveocnj.com](https://liveocnj.com)
