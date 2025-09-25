import os
import subprocess
import shutil
import logging
import uuid
import time
from datetime import datetime
from urllib.parse import urlparse
import validators
from flask import Flask, request, send_file, jsonify, render_template, session
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'dev-key-change-in-production')

# Configure CORS
CORS(app)

# Configure rate limiting
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)
limiter.init_app(app)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration
DOWNLOADS_DIR = os.environ.get('DOWNLOADS_DIR', './downloads')
MAX_FILE_SIZE = int(os.environ.get('MAX_FILE_SIZE', 100 * 1024 * 1024))  # 100MB
ALLOWED_DOMAINS = ['soundcloud.com', 'on.soundcloud.com', 'm.soundcloud.com']

# Ensure the downloads directory exists
os.makedirs(DOWNLOADS_DIR, exist_ok=True)

class DownloadError(Exception):
    """Custom exception for download errors"""
    pass

def validate_soundcloud_url(url):
    """Validate if the URL is a valid SoundCloud URL"""
    if not validators.url(url):
        return False, "Invalid URL format"
    
    parsed = urlparse(url)
    if parsed.netloc.lower() not in ALLOWED_DOMAINS:
        return False, "URL must be from SoundCloud"
    
    return True, "Valid URL"

def check_dependencies():
    """Check if required dependencies are installed"""
    missing = []
    
    if not shutil.which("yt-dlp"):
        missing.append("yt-dlp")
    
    if not shutil.which("ffmpeg"):
        missing.append("ffmpeg")
    
    return missing

def get_file_info(url):
    """Get information about the track without downloading"""
    try:
        command = [
            "yt-dlp",
            "--print", "title",
            "--print", "duration",
            "--print", "uploader",
            "--no-download",
            url
        ]
        
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=30,
            check=True
        )
        
        lines = result.stdout.strip().split('\n')
        return {
            'title': lines[0] if len(lines) > 0 else 'Unknown',
            'duration': lines[1] if len(lines) > 1 else 'Unknown',
            'uploader': lines[2] if len(lines) > 2 else 'Unknown'
        }
    except Exception as e:
        logger.error(f"Error getting file info: {e}")
        return None

def download_soundcloud_to_mp3(soundcloud_url, audio_format="mp3", quality="192"):
    """
    Downloads a SoundCloud track and converts it to the specified audio format.
    
    Args:
        soundcloud_url (str): The URL of the SoundCloud track to download
        audio_format (str): The audio format to convert to (mp3, wav, aac)
        quality (str): Audio quality for MP3 (128, 192, 256, 320)
    
    Returns:
        dict: Result containing success/error status and filename
    """
    try:
        # Validate URL
        is_valid, message = validate_soundcloud_url(soundcloud_url)
        if not is_valid:
            raise DownloadError(message)
        
        # Check dependencies
        missing_deps = check_dependencies()
        if missing_deps:
            raise DownloadError(f"Missing dependencies: {', '.join(missing_deps)}")
        
        # Generate unique filename
        job_id = str(uuid.uuid4())[:8]
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Configure audio quality options
        audio_opts = {}
        if audio_format.lower() == "mp3":
            audio_opts = {
                "preferredcodec": "mp3",
                "preferredquality": quality
            }
        
        # Construct the yt-dlp command
        output_template = f"{DOWNLOADS_DIR}/{timestamp}_{job_id}_%(title)s.%(ext)s"
        command = [
            "yt-dlp",
            "--extract-audio",
            "--audio-format", audio_format.lower(),
            "--output", output_template,
            "--no-playlist",
            "--max-filesize", str(MAX_FILE_SIZE),
            soundcloud_url
        ]
        
        # Add quality option for MP3
        if audio_format.lower() == "mp3":
            command.extend(["--audio-quality", quality])
        
        logger.info(f"Starting download: {soundcloud_url}")
        
        # Run the command with timeout
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=300,  # 5 minutes timeout
            check=True
        )
        
        # Find the downloaded file
        downloaded_files = [
            f for f in os.listdir(DOWNLOADS_DIR) 
            if f.startswith(f"{timestamp}_{job_id}") and f.endswith(f".{audio_format.lower()}")
        ]
        
        if not downloaded_files:
            raise DownloadError("File not found after download")
        
        filename = downloaded_files[0]
        file_path = os.path.join(DOWNLOADS_DIR, filename)
        
        # Check file size
        file_size = os.path.getsize(file_path)
        if file_size > MAX_FILE_SIZE:
            os.remove(file_path)
            raise DownloadError("File too large")
        
        logger.info(f"Download completed: {filename} ({file_size} bytes)")
        
        return {
            "success": True,
            "filename": filename,
            "file_size": file_size,
            "message": "Download completed successfully"
        }
        
    except subprocess.TimeoutExpired:
        raise DownloadError("Download timeout - file may be too large or connection slow")
    except subprocess.CalledProcessError as e:
        error_msg = e.stderr.decode() if e.stderr else str(e)
        if "Private video" in error_msg or "not available" in error_msg:
            raise DownloadError("Track is private or not available")
        elif "Unsupported URL" in error_msg:
            raise DownloadError("Unsupported SoundCloud URL")
        else:
            raise DownloadError(f"Download failed: {error_msg}")
    except Exception as e:
        raise DownloadError(f"Unexpected error: {str(e)}")

@app.route("/health")
def health_check():
    """Health check endpoint for deployment monitoring"""
    missing_deps = check_dependencies()
    if missing_deps:
        return jsonify({
            "status": "unhealthy",
            "missing_dependencies": missing_deps
        }), 503
    
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "dependencies": ["yt-dlp", "ffmpeg"]
    })

@app.route("/info", methods=["POST"])
@limiter.limit("10 per minute")
def get_track_info():
    """Get track information without downloading"""
    try:
        data = request.get_json()
        if not data or 'url' not in data:
            return jsonify({"error": "URL is required"}), 400
        
        url = data['url'].strip()
        is_valid, message = validate_soundcloud_url(url)
        if not is_valid:
            return jsonify({"error": message}), 400
        
        info = get_file_info(url)
        if not info:
            return jsonify({"error": "Could not retrieve track information"}), 400
        
        return jsonify({
            "success": True,
            "info": info
        })
        
    except Exception as e:
        logger.error(f"Error in get_track_info: {e}")
        return jsonify({"error": "Failed to get track information"}), 500

@app.route("/", methods=["GET", "POST"])
@limiter.limit("5 per minute", methods=["POST"])
def download_route():
    """
    Handles GET and POST requests:
    - GET: Serves the template for user input
    - POST: Handles the SoundCloud MP3 download
    """
    if request.method == "GET":
        return render_template('index.html')
    
    elif request.method == "POST":
        try:
            # Handle both JSON and form data
            if request.is_json:
                data = request.get_json()
            else:
                data = request.form
            
            soundcloud_url = data.get("url", "").strip()
            audio_format = data.get("format", "mp3").lower()
            quality = data.get("quality", "192")
            
            if not soundcloud_url:
                return jsonify({"error": "Please provide a SoundCloud URL"}), 400
            
            # Validate format
            if audio_format not in ["mp3", "wav", "aac"]:
                return jsonify({"error": "Unsupported audio format"}), 400
            
            # Validate quality for MP3
            if audio_format == "mp3" and quality not in ["128", "192", "256", "320"]:
                quality = "192"  # Default fallback
            
            logger.info(f"Download request: {soundcloud_url} -> {audio_format} ({quality})")
            
            # Download the file
            result = download_soundcloud_to_mp3(soundcloud_url, audio_format, quality)
            
            if not result["success"]:
                return jsonify({"error": result.get("message", "Download failed")}), 500
            
            filename = result["filename"]
            file_path = os.path.join(DOWNLOADS_DIR, filename)
            
            # Store download info in session for cleanup
            if 'downloads' not in session:
                session['downloads'] = []
            session['downloads'].append({
                'filename': filename,
                'timestamp': time.time()
            })
            
            # Return file for download
            def remove_file(filepath):
                try:
                    if os.path.exists(filepath):
                        os.remove(filepath)
                        logger.info(f"Cleaned up file: {os.path.basename(filepath)}")
                except Exception as e:
                    logger.error(f"Error cleaning up file {os.path.basename(filepath)}: {e}")
            
            # Schedule cleanup after sending file
            import threading
            timer = threading.Timer(60.0, remove_file, args=[file_path])
            timer.start()
            
            return send_file(
                file_path,
                as_attachment=True,
                download_name=filename,
                mimetype=f'audio/{audio_format}'
            )
            
        except DownloadError as e:
            logger.warning(f"Download error: {e}")
            return jsonify({"error": str(e)}), 400
        except Exception as e:
            logger.error(f"Unexpected error in download_route: {e}")
            return jsonify({"error": "An unexpected error occurred"}), 500

@app.route("/cleanup")
def cleanup_old_files():
    """Cleanup old files (for maintenance)"""
    try:
        current_time = time.time()
        cleaned = 0
        
        for filename in os.listdir(DOWNLOADS_DIR):
            file_path = os.path.join(DOWNLOADS_DIR, filename)
            if os.path.isfile(file_path):
                # Remove files older than 1 hour
                if current_time - os.path.getmtime(file_path) > 3600:
                    os.remove(file_path)
                    cleaned += 1
        
        return jsonify({
            "success": True,
            "cleaned_files": cleaned
        })
    except Exception as e:
        logger.error(f"Error in cleanup: {e}")
        return jsonify({"error": "Cleanup failed"}), 500

@app.errorhandler(429)
def ratelimit_handler(e):
    return jsonify({
        "error": "Rate limit exceeded. Please try again later.",
        "retry_after": e.retry_after
    }), 429

@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal server error: {error}")
    return jsonify({"error": "Internal server error"}), 500

if __name__ == "__main__":
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV') == 'development'
    
    logger.info(f"Starting Flask server on port {port}")
    app.run(debug=debug, host='0.0.0.0', port=port)
