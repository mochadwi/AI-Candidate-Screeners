// Test setup file
import { config } from '../src/config/environment';

// Mock UUID
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-123'),
}));

// Override environment for testing
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';

// Mock OpenAI API key for testing
process.env.OPENAI_API_KEY = 'test-api-key';

// Suppress console logs during tests unless explicitly needed
if (process.env.NODE_ENV === 'test') {
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
}

// Global test timeout
jest.setTimeout(10000);