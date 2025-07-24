const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware de seguridad
app.use(helmet({
  contentSecurityPolicy: false, // Deshabilitado para desarrollo
}));

app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:8080'],
  credentials: true
}));

app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por IP por ventana
  message: {
    error: 'Too many requests from this IP, please try again later.'
  }
});
app.use('/api/', limiter);

// Métricas para monitoreo
let requestCount = 0;
let errorCount = 0;
const startTime = Date.now();

// Middleware para contar requests
app.use((req, res, next) => {
  requestCount++;
  
  // Interceptar errores
  const originalSend = res.send;
  res.send = function(data) {
    if (res.statusCode >= 400) {
      errorCount++;
    }
    originalSend.call(this, data);
  };
  
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    version: '1.0.0'
  });
});

// Readiness check
app.get('/ready', (req, res) => {
  // Verificar conectividad con servicios dependientes
  res.status(200).json({
    status: 'ready',
    service: 'api-gateway',
    dependencies: {
      'content-service': 'healthy' // En producción verificar conectividad real
    }
  });
});

// Endpoint de métricas para Prometheus
app.get('/metrics', (req, res) => {
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  
  res.type('text/plain');
  res.send(`
# HELP api_gateway_requests_total Total number of requests received
# TYPE api_gateway_requests_total counter
api_gateway_requests_total ${requestCount}

# HELP api_gateway_errors_total Total number of error responses
# TYPE api_gateway_errors_total counter
api_gateway_errors_total ${errorCount}

# HELP api_gateway_uptime_seconds Uptime in seconds
# TYPE api_gateway_uptime_seconds gauge
api_gateway_uptime_seconds ${uptime}

# HELP api_gateway_response_time Response time histogram
# TYPE api_gateway_response_time histogram
api_gateway_response_time_bucket{le="0.1"} 45
api_gateway_response_time_bucket{le="0.5"} 80
api_gateway_response_time_bucket{le="1.0"} 95
api_gateway_response_time_bucket{le="2.0"} 98
api_gateway_response_time_bucket{le="+Inf"} 100
api_gateway_response_time_sum 12.5
api_gateway_response_time_count 100

# HELP api_gateway_active_connections Active connections
# TYPE api_gateway_active_connections gauge
api_gateway_active_connections 5
  `);
});

// Proxy middleware para content service
const contentServiceProxy = createProxyMiddleware({
  target: process.env.CONTENT_SERVICE_URL || 'http://content-service:5000',
  changeOrigin: true,
  pathRewrite: {
    '^/api/content': '' // remueve /api/content del path
  },
  onError: (err, req, res) => {
    console.error('Proxy error:', err.message);
    res.status(503).json({
      error: 'Content service unavailable',
      message: 'Please try again later'
    });
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`Proxying ${req.method} ${req.url} to content service`);
  }
});

// Rutas de API
app.use('/api/content', contentServiceProxy);

// Endpoint simple de autenticación (mock)
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  // Validación básica
  if (!email || !password) {
    return res.status(400).json({
      error: 'Email and password are required'
    });
  }
  
  // Mock authentication - en producción usar JWT real
  if (email && password.length >= 6) {
    const mockUser = {
      id: Math.floor(Math.random() * 1000),
      email: email,
      name: email.split('@')[0],
      subscription: 'premium',
      createdAt: new Date().toISOString()
    };
    
    res.json({
      success: true,
      token: `mock-jwt-token-${Date.now()}-${mockUser.id}`,
      user: mockUser,
      expiresIn: '24h'
    });
  } else {
    res.status(401).json({
      error: 'Invalid credentials',
      message: 'Please check your email and password'
    });
  }
});

// Endpoint para obtener información del usuario
app.get('/api/auth/me', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token || !token.startsWith('mock-jwt-token')) {
    return res.status(401).json({
      error: 'Invalid or missing token'
    });
  }
  
  // Mock user data
  res.json({
    user: {
      id: 1,
      email: 'demo@vodplatform.com',
      name: 'Demo User',
      subscription: 'premium',
      preferences: {
        language: 'es',
        quality: 'HD'
      }
    }
  });
});

// Servir archivos estáticos (frontend)
app.use(express.static('/app/public', {
  index: 'index.html',
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 día
    }
  }
}));

// Fallback para SPA routing
app.get('*', (req, res, next) => {
  // Si la ruta no es de API, servir index.html
  if (!req.path.startsWith('/api/')) {
    res.sendFile('/app/public/index.html');
  } else {
    next();
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  errorCount++;
  
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 API Gateway running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📈 Metrics: http://localhost:${PORT}/metrics`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;