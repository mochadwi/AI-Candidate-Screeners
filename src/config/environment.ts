import dotenv from 'dotenv';

dotenv.config();

export const config = {
  app: {
    port: parseInt(process.env.PORT || '3000', 10),
    env: process.env.NODE_ENV || 'development'
  },
  ai: {
    apiKey: process.env.AI_API_KEY || '',
    model: process.env.AI_MODEL || 'gpt-3.5-turbo',
    baseUrl: process.env.AI_BASE_URL || '', // Default to OpenAI's default if empty
    provider: process.env.AI_PROVIDER || 'openai' // 'openai' or 'zhipu'
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
if (!config.ai.apiKey) {
  console.warn('⚠️  AI_API_KEY not configured. AI features will not work.');
}

export default config;