from flask import Flask, jsonify, request
from flask_cors import CORS
import redis
import json
import os
import time
from datetime import datetime
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key')

try:
    redis_client = redis.Redis(
        host=os.environ.get('REDIS_HOST', 'redis'),
        port=int(os.environ.get('REDIS_PORT', 6379)),
        db=0,
        decode_responses=True,
        socket_timeout=5,
        socket_connect_timeout=5
    )
    redis_client.ping()
    logger.info("✅ Connected to Redis successfully")
except Exception as e:
    logger.warning(f"⚠️ Redis connection failed: {e}")
    redis_client = None

# URLS DE VIDEO QUE SÍ FUNCIONAN
CONTENT_DATABASE = [
    {
        "id": 1,
        "title": "The Future of Cloud Computing",
        "description": "Un documental fascinante sobre la evolución de la computación en la nube y su impacto en la tecnología moderna.",
        "duration": 7200,
        "genre": ["Documentary", "Technology"],
        "thumbnail": "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&h=600&fit=crop",
        "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
        "rating": "PG",
        "release_date": "2024-01-15",
        "director": "Tech Films Studio",
        "cast": ["Dr. Sarah Chen", "Prof. Michael Rodriguez"],
        "language": "Spanish",
        "subtitles": ["English", "Portuguese"],
        "views": 15420,
        "likes": 1240,
        "quality": ["720p", "1080p", "4K"]
    },
    {
        "id": 2,
        "title": "Microservices Architecture",
        "description": "Serie educativa sobre arquitecturas de microservicios, desde conceptos básicos hasta implementaciones avanzadas.",
        "duration": 3600,
        "genre": ["Educational", "Technology", "Programming"],
        "thumbnail": "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400&h=600&fit=crop",
        "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
        "rating": "G",
        "release_date": "2024-02-01",
        "director": "DevOps Academy",
        "cast": ["Alex Johnson", "Maria Garcia"],
        "language": "Spanish",
        "subtitles": ["English"],
        "views": 8730,
        "likes": 890,
        "quality": ["720p", "1080p"]
    },
    {
        "id": 3,
        "title": "Kubernetes in Action",
        "description": "Guía práctica para implementar y gestionar aplicaciones en Kubernetes, desde desarrollo hasta producción.",
        "duration": 5400,
        "genre": ["Educational", "DevOps"],
        "thumbnail": "https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=400&h=600&fit=crop",
        "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
        "rating": "PG-13",
        "release_date": "2024-01-30",
        "director": "Cloud Native Studios",
        "cast": ["David Kim", "Lisa Wang"],
        "language": "Spanish",
        "subtitles": ["English", "French"],
        "views": 12350,
        "likes": 1120,
        "quality": ["720p", "1080p", "4K"]
    },
    {
        "id": 4,
        "title": "AWS Deep Dive",
        "description": "Curso completo sobre servicios de Amazon Web Services, desde EC2 hasta servicios serverless avanzados.",
        "duration": 9000,
        "genre": ["Educational", "Cloud"],
        "thumbnail": "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&h=600&fit=crop",
        "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
        "rating": "PG",
        "release_date": "2024-03-01",
        "director": "AWS Training",
        "cast": ["Jennifer Park", "Carlos Rodriguez"],
        "language": "Spanish",
        "subtitles": ["English"],
        "views": 20150,
        "likes": 1850,
        "quality": ["720p", "1080p", "4K"]
    },
    {
        "id": 5,
        "title": "DevOps Best Practices",
        "description": "Serie sobre las mejores prácticas en DevOps, incluyendo CI/CD, monitoreo y automatización.",
        "duration": 4500,
        "genre": ["Educational", "DevOps", "Programming"],
        "thumbnail": "https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=400&h=600&fit=crop",
        "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
        "rating": "G",
        "release_date": "2024-02-15",
        "director": "DevOps Institute",
        "cast": ["Robert Chen", "Amanda Silva"],
        "language": "Spanish",
        "subtitles": ["English", "Portuguese"],
        "views": 9870,
        "likes": 980,
        "quality": ["720p", "1080p"]
    }
]

metrics = {
    'requests_total': 0,
    'content_served': 0,
    'cache_hits': 0,
    'cache_misses': 0,
    'errors': 0,
    'start_time': time.time()
}

@app.before_request
def before_request():
    metrics['requests_total'] += 1

@app.route('/health')
def health():
    redis_status = 'connected' if redis_client else 'disconnected'
    
    try:
        if redis_client:
            redis_client.ping()
            redis_status = 'healthy'
    except:
        redis_status = 'unhealthy'
    
    return jsonify({
        'status': 'healthy',
        'service': 'content-service',
        'timestamp': datetime.utcnow().isoformat(),
        'version': '1.0.0',
        'dependencies': {
            'redis': redis_status,
            'database': 'mock'
        },
        'uptime': int(time.time() - metrics['start_time'])
    })

@app.route('/metrics')
def get_metrics():
    uptime = int(time.time() - metrics['start_time'])
    
    prometheus_metrics = f"""# HELP content_service_requests_total Total requests received
# TYPE content_service_requests_total counter
content_service_requests_total {metrics['requests_total']}

# HELP content_service_content_served_total Total content items served
# TYPE content_service_content_served_total counter
content_service_content_served_total {metrics['content_served']}

# HELP content_service_uptime_seconds Service uptime
# TYPE content_service_uptime_seconds gauge
content_service_uptime_seconds {uptime}

# HELP content_service_content_total Total content items available
# TYPE content_service_content_total gauge
content_service_content_total {len(CONTENT_DATABASE)}
"""
    
    return prometheus_metrics, 200, {'Content-Type': 'text/plain'}

@app.route('/content')
def get_content():
    try:
        genre = request.args.get('genre')
        search = request.args.get('search', '').lower()
        sort_by = request.args.get('sort', 'title')
        limit = min(int(request.args.get('limit', 50)), 100)
        offset = int(request.args.get('offset', 0))
        
        filtered_content = CONTENT_DATABASE.copy()
        
        if genre:
            filtered_content = [c for c in filtered_content if genre.lower() in [g.lower() for g in c['genre']]]
        
        if search:
            filtered_content = [
                c for c in filtered_content 
                if search in c['title'].lower() or search in c['description'].lower()
            ]
        
        if sort_by == 'views':
            filtered_content.sort(key=lambda x: x['views'], reverse=True)
        elif sort_by == 'release_date':
            filtered_content.sort(key=lambda x: x['release_date'], reverse=True)
        elif sort_by == 'likes':
            filtered_content.sort(key=lambda x: x['likes'], reverse=True)
        else:
            filtered_content.sort(key=lambda x: x['title'])
        
        total = len(filtered_content)
        filtered_content = filtered_content[offset:offset + limit]
        
        result = {
            'content': filtered_content,
            'pagination': {
                'total': total,
                'limit': limit,
                'offset': offset,
                'has_more': offset + limit < total
            },
            'filters': {
                'genre': genre,
                'search': search,
                'sort_by': sort_by
            },
            'timestamp': datetime.utcnow().isoformat()
        }
        
        metrics['content_served'] += len(filtered_content)
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error getting content: {e}")
        return jsonify({'error': 'Failed to retrieve content'}), 500

@app.route('/content/<int:content_id>')
def get_content_detail(content_id):
    try:
        content = next((c for c in CONTENT_DATABASE if c['id'] == content_id), None)
        
        if not content:
            return jsonify({'error': 'Content not found'}), 404
        
        enhanced_content = content.copy()
        enhanced_content.update({
            'related_content': [
                c for c in CONTENT_DATABASE 
                if c['id'] != content_id and 
                any(genre in content['genre'] for genre in c['genre'])
            ][:3],
            'accessed_at': datetime.utcnow().isoformat()
        })
        
        metrics['content_served'] += 1
        
        return jsonify(enhanced_content)
        
    except Exception as e:
        logger.error(f"Error getting content detail: {e}")
        return jsonify({'error': 'Failed to retrieve content details'}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV') == 'development'
    
    logger.info(f"🚀 Content Service starting on port {port}")
    logger.info(f"🔧 Debug mode: {debug}")
    logger.info(f"📊 Redis: {'Connected' if redis_client else 'Disabled'}")
    
    app.run(host='0.0.0.0', port=port, debug=debug)