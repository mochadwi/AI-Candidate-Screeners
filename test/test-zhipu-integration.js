#!/usr/bin/env node

/**
 * Test script to verify AI integration (OpenAI and Zhipu AI)
 * Usage:
 * 1. For OpenAI: AI_PROVIDER=openai AI_API_KEY=your_key npm run test:ai
 * 2. For Zhipu AI: AI_PROVIDER=zhipu AI_API_KEY=your_key AI_MODEL=glm-4.6 AI_BASE_URL=https://open.bigmodel.cn/api/paas/v4/ npm run test:ai
 */

const { createAIProvider } = require('../dist/services/aiService');
const { config } = require('../dist/config/environment');

async function testAIIntegration() {
  console.log('🧪 Testing AI Integration...');
  console.log(`📋 Provider: ${config.ai.provider}`);
  console.log(`🤖 Model: ${config.ai.model}`);

  if (config.ai.provider === 'zhipu') {
    console.log(`🔗 Base URL: ${config.ai.baseUrl}`);
  }

  try {
    const aiProvider = createAIProvider();

    console.log('✅ AI Provider created successfully');

    // Simple test prompt
    const testPrompt = `Analyze the following candidate information and provide feedback in JSON format:

Candidate: "John Doe - Software Engineer with 3 years of experience in React and Node.js"

Provide evaluation in JSON format with the following structure:
{
  "cvMatchRate": number between 0 and 1,
  "projectScore": number between 1 and 5,
  "cvFeedback": "specific feedback with examples",
  "projectFeedback": "specific feedback with examples",
  "summary": "overall assessment"
}

Respond with valid JSON only.`;

    console.log('📤 Sending test request...');
    const startTime = Date.now();

    const response = await aiProvider.evaluate(testPrompt);

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log('✅ Test successful!');
    console.log(`⏱️  Response time: ${duration}ms`);
    console.log('📄 Response:');
    console.log(response);

    // Try to parse the response to ensure it's valid JSON
    try {
      const parsed = JSON.parse(response);
      console.log('✅ Valid JSON response received');
      console.log('📊 Parsed response keys:', Object.keys(parsed));
    } catch (parseError) {
      console.log('⚠️  Response is not valid JSON:', parseError.message);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);

    if (error.message.includes('API key')) {
      console.log('\n💡 Make sure to set the appropriate environment variables:');
      if (config.ai.provider === 'zhipu') {
        console.log('   export AI_PROVIDER=zhipu');
        console.log('   export AI_API_KEY=your_zhipu_api_key');
        console.log('   export AI_MODEL=glm-4.6');
        console.log('   export AI_BASE_URL=https://open.bigmodel.cn/api/paas/v4/');
      } else {
        console.log('   export AI_PROVIDER=openai');
        console.log('   export AI_API_KEY=your_openai_api_key');
      }
    }

    process.exit(1);
  }
}

// Run the test
testAIIntegration();