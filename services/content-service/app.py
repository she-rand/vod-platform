from flask import Flask, jsonify, request
from flask_cors import CORS
import redis
import json
import os
import time
from datetime import datetime
import logging

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Configuración
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key')

# Conexión a Redis para cache
try:
    redis_client = redis.Redis(
        host=os.environ.get('REDIS_HOST', 'redis'),
        port=int(os.environ.get('REDIS_PORT', 6379)),
        db=0,
        decode_responses=True,
        socket_timeout=5,
        socket_connect_timeout=5
    )
    # Test connection
    redis_client.ping()
    logger.info("✅ Connected to Redis successfully")
except Exception as e:
    logger.warning(f"⚠️ Redis connection failed: {e}")
    redis_client = None

# Mock database - En producción sería PostgreSQL
CONTENT_DATABASE = [
    {
        "id": 1,
        "title": "The Future of Cloud Computing",
        "description": "Un documental fascinante sobre la evolución de la computación en la nube y su impacto en la tecnología moderna.",
        "duration": 7200,  # 2 horas en segundos
        "genre": ["Documentary", "Technology"],
        "thumbnail": "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&h=600&fit=crop",
        "video_url": "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4",
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
        "duration": 3600,  # 1 hora
        "genre": ["Educational", "Technology", "Programming"],
        "thumbnail": "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400&h=600&fit=crop",
        "video_url": "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_2mb.mp4",
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
        "duration": 5400,  # 1.5 horas
        "genre": ["Educational", "DevOps"],
        "thumbnail": "https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=400&h=600&fit=crop",
        "video_url": "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_5mb.mp4",
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
        "duration": 9000,  # 2.5 horas
        "genre": ["Educational", "Cloud"],
        "thumbnail": "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&h=600&fit=crop",
        "video_url": "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4",
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
        "duration": 4500,  # 1.25 horas
        "genre": ["Educational", "DevOps", "Programming"],
        "thumbnail": "https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=400&h=600&fit=crop",
        "video_url": "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_2mb.mp4",
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

# Métricas para monitoreo
metrics = {
    'requests_total': 0,
    'content_served': 0,
    'cache_hits': 0,
    'cache_misses': 0,
    'errors': 0,
    'start_time': time.time()
}

def get_from_cache(key):
    """Obtener datos del cache Redis"""
    if redis_client:
        try:
            data = redis_client.get(key)
            if data:
                metrics['cache_hits'] += 1
                return json.loads(data)
        except Exception as e:
            logger.error(f"Cache get error: {e}")
    
    metrics['cache_misses'] += 1
    return None

def set_cache(key, data, expiry=300):
    """Guardar datos en cache Redis (5 minutos por defecto)"""
    if redis_client:
        try:
            redis_client.setex(key, expiry, json.dumps(data))
        except Exception as e:
            logger.error(f"Cache set error: {e}")

@app.before_request
def before_request():
    """Middleware para tracking de requests"""
    metrics['requests_total'] += 1

@app.errorhandler(Exception)
def handle_error(e):
    """Error handler global"""
    metrics['errors'] += 1
    logger.error(f"Error: {e}")
    return jsonify({
        'error': 'Internal server error',
        'message': str(e) if app.debug else 'Something went wrong'
    }), 500

@app.route('/health')
def health():
    """Health check endpoint"""
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
            'database': 'mock'  # En producción verificar PostgreSQL
        },
        'uptime': int(time.time() - metrics['start_time'])
    })

@app.route('/metrics')
def get_metrics():
    """Endpoint de métricas para Prometheus"""
    uptime = int(time.time() - metrics['start_time'])
    
    prometheus_metrics = f"""# HELP content_service_requests_total Total requests received
# TYPE content_service_requests_total counter
content_service_requests_total {metrics['requests_total']}

# HELP content_service_content_served_total Total content items served
# TYPE content_service_content_served_total counter
content_service_content_served_total {metrics['content_served']}

# HELP content_service_cache_hits_total Cache hits
# TYPE content_service_cache_hits_total counter
content_service_cache_hits_total {metrics['cache_hits']}

# HELP content_service_cache_misses_total Cache misses
# TYPE content_service_cache_misses_total counter
content_service_cache_misses_total {metrics['cache_misses']}

# HELP content_service_errors_total Total errors
# TYPE content_service_errors_total counter
content_service_errors_total {metrics['errors']}

# HELP content_service_uptime_seconds Service uptime
# TYPE content_service_uptime_seconds gauge
content_service_uptime_seconds {uptime}

# HELP content_service_content_total Total content items available
# TYPE content_service_content_total gauge
content_service_content_total {len(CONTENT_DATABASE)}

# HELP content_service_response_time Response time histogram
# TYPE content_service_response_time histogram
content_service_response_time_bucket{{le="0.1"}} 50
content_service_response_time_bucket{{le="0.5"}} 85
content_service_response_time_bucket{{le="1.0"}} 95
content_service_response_time_bucket{{le="2.0"}} 99
content_service_response_time_bucket{{le="+Inf"}} 100
content_service_response_time_sum 15.2
content_service_response_time_count 100
"""
    
    return prometheus_metrics, 200, {'Content-Type': 'text/plain'}

@app.route('/content')
def get_content():
    """Obtener lista de contenido con filtros opcionales"""
    try:
        # Parámetros de filtrado
        genre = request.args.get('genre')
        search = request.args.get('search', '').lower()
        sort_by = request.args.get('sort', 'title')  # title, views, release_date
        limit = min(int(request.args.get('limit', 50)), 100)  # máximo 100
        offset = int(request.args.get('offset', 0))
        
        # Crear cache key
        cache_key = f"content_list_{genre}_{search}_{sort_by}_{limit}_{offset}"
        
        # Intentar obtener del cache
        cached_result = get_from_cache(cache_key)
        if cached_result:
            return jsonify(cached_result)
        
        # Filtrar contenido
        filtered_content = CONTENT_DATABASE.copy()
        
        if genre:
            filtered_content = [c for c in filtered_content if genre.lower() in [g.lower() for g in c['genre']]]
        
        if search:
            filtered_content = [
                c for c in filtered_content 
                if search in c['title'].lower() or search in c['description'].lower()
            ]
        
        # Ordenar
        if sort_by == 'views':
            filtered_content.sort(key=lambda x: x['views'], reverse=True)
        elif sort_by == 'release_date':
            filtered_content.sort(key=lambda x: x['release_date'], reverse=True)
        elif sort_by == 'likes':
            filtered_content.sort(key=lambda x: x['likes'], reverse=True)
        else:  # title
            filtered_content.sort(key=lambda x: x['title'])
        
        # Paginación
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
        
        # Guardar en cache
        set_cache(cache_key, result, 300)  # 5 minutos
        
        metrics['content_served'] += len(filtered_content)
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error getting content: {e}")
        return jsonify({'error': 'Failed to retrieve content'}), 500

@app.route('/content/<int:content_id>')
def get_content_detail(content_id):
    """Obtener detalles de un contenido específico"""
    try:
        # Cache key
        cache_key = f"content_detail_{content_id}"
        
        # Intentar cache
        cached_result = get_from_cache(cache_key)
        if cached_result:
            return jsonify(cached_result)
        
        # Buscar contenido
        content = next((c for c in CONTENT_DATABASE if c['id'] == content_id), None)
        
        if not content:
            return jsonify({'error': 'Content not found'}), 404
        
        # Añadir metadata adicional
        enhanced_content = content.copy()
        enhanced_content.update({
            'related_content': [
                c for c in CONTENT_DATABASE 
                if c['id'] != content_id and 
                any(genre in content['genre'] for genre in c['genre'])
            ][:3],  # máximo 3 relacionados
            'streaming_urls': {
                '720p': enhanced_content['video_url'],
                '1080p': enhanced_content['video_url'].replace('720', '1080'),
                '4K': enhanced_content['video_url'].replace('720', '2160')
            },
            'accessibility': {
                'closed_captions': True,
                'audio_description': True
            },
            'accessed_at': datetime.utcnow().isoformat()
        })
        
        # Guardar en cache
        set_cache(cache_key, enhanced_content, 600)  # 10 minutos
        
        metrics['content_served'] += 1
        
        return jsonify(enhanced_content)
        
    except Exception as e:
        logger.error(f"Error getting content detail: {e}")
        return jsonify({'error': 'Failed to retrieve content details'}), 500

@app.route('/genres')
def get_genres():
    """Obtener lista de géneros disponibles"""
    try:
        cache_key = "available_genres"
        
        cached_result = get_from_cache(cache_key)
        if cached_result:
            return jsonify(cached_result)
        
        # Extraer todos los géneros únicos
        all_genres = set()
        for content in CONTENT_DATABASE:
            all_genres.update(content['genre'])
        
        # Contar contenido por género
        genre_counts = {}
        for genre in all_genres:
            count = sum(1 for c in CONTENT_DATABASE if genre in c['genre'])
            genre_counts[genre] = count
        
        result = {
            'genres': sorted(list(all_genres)),
            'genre_counts': genre_counts,
            'total_genres': len(all_genres)
        }
        
        set_cache(cache_key, result, 3600)  # 1 hora
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error getting genres: {e}")
        return jsonify({'error': 'Failed to retrieve genres'}), 500

@app.route('/search/suggestions')
def search_suggestions():
    """Obtener sugerencias de búsqueda"""
    try:
        query = request.args.get('q', '').lower()
        
        if len(query) < 2:
            return jsonify({'suggestions': []})
        
        suggestions = []
        
        # Buscar en títulos
        for content in CONTENT_DATABASE:
            if query in content['title'].lower():
                suggestions.append({
                    'text': content['title'],
                    'type': 'title',
                    'content_id': content['id']
                })
        
        # Buscar en géneros
        all_genres = set()
        for content in CONTENT_DATABASE:
            all_genres.update(content['genre'])
        
        for genre in all_genres:
            if query in genre.lower():
                suggestions.append({
                    'text': genre,
                    'type': 'genre'
                })
        
        # Limitar sugerencias
        suggestions = suggestions[:8]
        
        return jsonify({
            'suggestions': suggestions,
            'query': query
        })
        
    except Exception as e:
        logger.error(f"Error getting search suggestions: {e}")
        return jsonify({'suggestions': []}), 200

@app.route('/stats')
def get_stats():
    """Obtener estadísticas del servicio"""
    try:
        total_views = sum(c['views'] for c in CONTENT_DATABASE)
        total_likes = sum(c['likes'] for c in CONTENT_DATABASE)
        avg_duration = sum(c['duration'] for c in CONTENT_DATABASE) / len(CONTENT_DATABASE)
        
        stats = {
            'total_content': len(CONTENT_DATABASE),
            'total_views': total_views,
            'total_likes': total_likes,
            'average_duration_minutes': round(avg_duration / 60, 2),
            'content_by_genre': {},
            'most_popular': sorted(CONTENT_DATABASE, key=lambda x: x['views'], reverse=True)[:3],
            'cache_performance': {
                'hits': metrics['cache_hits'],
                'misses': metrics['cache_misses'],
                'hit_ratio': round(metrics['cache_hits'] / max(metrics['cache_hits'] + metrics['cache_misses'], 1) * 100, 2)
            }
        }
        
        # Contar por género
        for content in CONTENT_DATABASE:
            for genre in content['genre']:
                stats['content_by_genre'][genre] = stats['content_by_genre'].get(genre, 0) + 1
        
        return jsonify(stats)
        
    except Exception as e:
        logger.error(f"Error getting stats: {e}")
        return jsonify({'error': 'Failed to retrieve stats'}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV') == 'development'
    
    logger.info(f"🚀 Content Service starting on port {port}")
    logger.info(f"🔧 Debug mode: {debug}")
    logger.info(f"📊 Redis: {'Connected' if redis_client else 'Disabled'}")
    
    app.run(host='0.0.0.0', port=port, debug=debug)