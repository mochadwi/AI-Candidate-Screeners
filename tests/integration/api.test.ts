import request from 'supertest';
import app from '../../src/index';

// Mock the services to avoid actual file operations and AI calls
jest.mock('../../src/services/fileService');
jest.mock('../../src/services/jobService');
jest.mock('../../src/services/aiService');

describe('API Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'OK',
        environment: expect.any(String),
        uptime: expect.any(Number),
        timestamp: expect.any(String)
      });
    });
  });

  describe('GET /', () => {
    it('should return API information', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'AI CV Evaluator API',
        version: '1.0.0',
        endpoints: expect.objectContaining({
          health: expect.any(String),
          upload: expect.any(Object),
          evaluate: expect.any(Object),
          result: expect.any(Object)
        })
      });
    });
  });

  describe('Error handling', () => {
    it('should handle 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/unknown-route')
        .expect(404);

      expect(response.body).toMatchObject({
        error: expect.objectContaining({
          message: expect.any(String),
          type: expect.any(String)
        }),
        timestamp: expect.any(String),
        path: '/unknown-route'
      });
    });
  });

  describe('CORS headers', () => {
    it('should include CORS headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });

  describe('Security headers', () => {
    it('should include security headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });
  });

  describe('Rate limiting', () => {
    it('should allow normal requests', async () => {
      for (let i = 0; i < 5; i++) {
        await request(app)
          .get('/health')
          .expect(200);
      }
    });
  });
});