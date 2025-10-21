// Mock for OpenAI library
const mockChatCompletions = {
  create: jest.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content: JSON.stringify({
            cvMatchRate: 0.8,
            projectScore: 4,
            cvFeedback: 'Strong technical skills',
            projectFeedback: 'Well-implemented solution',
            summary: 'Good candidate'
          })
        }
      }
    ]
  })
};

const mockOpenAI = jest.fn().mockImplementation(() => ({
  chat: {
    completions: mockChatCompletions
  }
}));

// Mock APIError class
mockOpenAI.APIError = class extends Error {
  constructor(message: string, public status?: number, public code?: string) {
    super(message);
    this.name = 'APIError';
  }
};

export default mockOpenAI;