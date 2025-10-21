import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config/environment';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';
import { rateLimit, requestLogger, securityHeaders } from './middleware/validationMiddleware';
import uploadRoutes from './routes/upload';
import evaluationRoutes from './routes/evaluation';
import resultsRoutes from './routes/results';
import healthRoutes from './routes/health';

const app = express();

// Security middleware
app.use(helmet());

// Custom security headers
app.use(securityHeaders);

// CORS configuration
app.use(cors({
  origin: config.cors.allowedOrigins,
  credentials: true
}));

// Rate limiting
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later'
}));

// Request logging (custom, more detailed than morgan)
app.use(requestLogger({
  logBody: config.app.env === 'development',
  logHeaders: false,
  excludePaths: ['/health']
}));

// Fallback to morgan for standard HTTP logging
app.use(morgan('combined'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.app.env
  });
});

// API routes
app.use('/upload', uploadRoutes);
app.use('/evaluate', evaluationRoutes);
app.use('/result', resultsRoutes);
app.use('/health', healthRoutes);

app.get('/', (req, res) => {
  res.json({
    message: 'AI CV Evaluator API',
    version: '1.0.0',
    endpoints: {
      health: {
        basic: 'GET /health',
        detailed: 'GET /health/detailed',
        ready: 'GET /health/ready',
        live: 'GET /health/live',
        metrics: 'GET /health/metrics'
      },
      upload: {
        cv: 'POST /upload/cv',
        project: 'POST /upload/project'
      },
      evaluate: {
        create: 'POST /evaluate',
        stats: 'GET /evaluate/stats',
        jobs: 'GET /evaluate/jobs',
        cancel: 'DELETE /evaluate/:jobId'
      },
      result: {
        single: 'GET /result/:jobId',
        batch: 'POST /result/batch',
        byStatus: 'GET /result/status/:status',
        recent: 'GET /result/recent/completed',
        search: 'GET /result/search?q=query'
      }
    }
  });
});

// Error handling middleware
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = config.app.port || 3000;

const startServer = async () => {
  try {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Environment: ${config.app.env}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('👋 SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Only start server if this file is run directly
if (require.main === module) {
  startServer();
}

// Export app for testing
export default app;