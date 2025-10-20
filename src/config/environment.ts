import dotenv from 'dotenv';

dotenv.config();

export const config = {
  app: {
    port: parseInt(process.env.PORT || '3000', 10),
    env: process.env.NODE_ENV || 'development'
  },
  ai: {
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo'
  },
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB
    uploadDir: process.env.UPLOAD_DIR || './uploads'
  },
  cors: {
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000']
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info'
  }
};

// Validate required environment variables
if (!config.ai.openaiApiKey) {
  console.warn('⚠️  OPENAI_API_KEY not configured. AI features will not work.');
}

export default config;