import OpenAI from 'openai';
import { config } from '../config/environment';
import { IAIProvider, EvaluationResult } from '../models';
import { AppError } from '../middleware/errorHandler';

export class OpenAIProvider implements IAIProvider {
  private client: OpenAI;
  private maxRetries: number = 3;
  private retryDelay: number = 1000; // 1 second

  constructor() {
    if (!this.isConfigured()) {
      throw new AppError('OpenAI API key not configured', 500);
    }

    this.client = new OpenAI({
      apiKey: config.ai.openaiApiKey
    });
  }

  isConfigured(): boolean {
    return !!config.ai.openaiApiKey && config.ai.openaiApiKey !== '';
  }

  async evaluate(prompt: string): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.client.chat.completions.create({
          model: config.ai.model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert technical evaluator. Always respond with valid JSON only.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3, // Lower temperature for more consistent results
          max_tokens: 1500,
          response_format: { type: 'json_object' }
        });

        const content = response.choices[0]?.message?.content;

        if (!content) {
          throw new AppError('No response from OpenAI API', 500);
        }

        return content;

      } catch (error) {
        lastError = error as Error;

        // Don't retry on certain errors
        if (error instanceof OpenAI.APIError) {
          if (error.status === 400 || error.status === 401 || error.status === 403) {
            throw new AppError(`OpenAI API error: ${error.message}`, error.status || 500);
          }
        }

        // If not the last attempt, wait before retrying
        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
          await this.sleep(delay);
        }
      }
    }

    throw new AppError(`Failed to get AI response after ${this.maxRetries} attempts: ${lastError?.message}`, 500);
  }

  async evaluateCVAndProject(
    cvText: string,
    projectText: string,
    jobTitle: string
  ): Promise<EvaluationResult> {
    const prompt = this.buildEvaluationPrompt(cvText, projectText, jobTitle);

    try {
      const response = await this.evaluate(prompt);

      // Parse and validate the response
      const result = this.parseEvaluationResult(response);

      // Validate the result
      this.validateEvaluationResult(result);

      return result;

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to evaluate CV and project', 500);
    }
  }

  private buildEvaluationPrompt(cvText: string, projectText: string, jobTitle: string): string {
    const cleanedCVText = this.cleanText(cvText);
    const cleanedProjectText = this.cleanText(projectText);

    return `You are an expert technical evaluator. Analyze the following CV and project for the position: "${jobTitle}"

CV Content:
${cleanedCVText}

Project Report Content:
${cleanedProjectText}

Provide evaluation in JSON format with the following structure:
{
  "cvMatchRate": number between 0 and 1,
  "projectScore": number between 1 and 5,
  "cvFeedback": "specific feedback with examples",
  "projectFeedback": "specific feedback with examples",
  "summary": "overall assessment"
}

Evaluation Criteria:
- CV Match Rate (0-1): How well the CV matches the job requirements
- Project Score (1-5): Quality, complexity, and relevance of the project
- Feedback: Provide constructive, specific feedback with actionable insights
- Summary: Overall assessment of the candidate's fit for the role

Focus on:
1. Technical skills and experience relevance
2. Project complexity and implementation quality
3. Problem-solving approach
4. Communication skills demonstrated
5. Overall potential for the role

Ensure the response is valid JSON only, no additional text.`;
  }

  private parseEvaluationResult(response: string): EvaluationResult {
    try {
      const parsed = JSON.parse(response);

      return {
        cvMatchRate: Number(parsed.cvMatchRate) || 0,
        projectScore: Number(parsed.projectScore) || 1,
        cvFeedback: String(parsed.cvFeedback || 'No feedback provided'),
        projectFeedback: String(parsed.projectFeedback || 'No feedback provided'),
        summary: String(parsed.summary || 'No summary provided')
      };
    } catch (error) {
      throw new AppError('Invalid JSON response from AI service', 500);
    }
  }

  private validateEvaluationResult(result: EvaluationResult): void {
    if (result.cvMatchRate < 0 || result.cvMatchRate > 1) {
      throw new AppError('Invalid cvMatchRate from AI service', 500);
    }

    if (result.projectScore < 1 || result.projectScore > 5) {
      throw new AppError('Invalid projectScore from AI service', 500);
    }

    if (!result.cvFeedback || result.cvFeedback.trim().length === 0) {
      throw new AppError('Missing cvFeedback from AI service', 500);
    }

    if (!result.projectFeedback || result.projectFeedback.trim().length === 0) {
      throw new AppError('Missing projectFeedback from AI service', 500);
    }

    if (!result.summary || result.summary.trim().length === 0) {
      throw new AppError('Missing summary from AI service', 500);
    }
  }

  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/[\r\n]+/g, ' ')
      .trim();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Factory function to create AI provider
export function createAIProvider(): IAIProvider {
  return new OpenAIProvider();
}