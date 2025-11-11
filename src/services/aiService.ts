import OpenAI from "openai";
import { config } from "../config/environment";
import { IAIProvider, EvaluationResult } from "../models";
import { AppError } from "../middleware/errorHandler";

export class OpenAIProvider implements IAIProvider {
  private client: OpenAI;
  private maxRetries: number = 3;
  private retryDelay: number = 1000; // 1 second

  constructor() {
    if (!this.isConfigured()) {
      throw new AppError("AI API key not configured", 500);
    }

    const clientConfig: any = {
      apiKey: config.ai.apiKey,
    };

    // Add base URL if configured
    if (config.ai.baseUrl) {
      clientConfig.baseURL = config.ai.baseUrl;
    }

    this.client = new OpenAI(clientConfig);
  }

  isConfigured(): boolean {
    return !!config.ai.apiKey && config.ai.apiKey !== "";
  }

  async evaluate(prompt: string): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.client.chat.completions.create({
          model: config.ai.model,
          messages: [
            {
              role: "system",
              content:
                "You are an expert technical evaluator. Always respond with valid JSON only.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.3, // Lower temperature for more consistent results
          max_tokens: 2500, // Increased for detailed rubric evaluation
          response_format: { type: "json_object" },
        });

        const content = response.choices[0]?.message?.content;

        if (!content) {
          throw new AppError("No response from OpenAI API", 500);
        }

        return content;
      } catch (error) {
        lastError = error as Error;

        // Don't retry on certain errors
        if (error instanceof OpenAI.APIError) {
          if (
            error.status === 400 ||
            error.status === 401 ||
            error.status === 403
          ) {
            const providerName =
              config.ai.provider === "zhipu" ? "Zhipu AI" : "OpenAI";
            throw new AppError(
              `${providerName} API error: ${error.message}`,
              error.status || 500,
            );
          }
        }

        // If not the last attempt, wait before retrying
        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
          await this.sleep(delay);
        }
      }
    }

    throw new AppError(
      `Failed to get AI response after ${this.maxRetries} attempts: ${lastError?.message}`,
      500,
    );
  }

  async evaluateCVAndProject(
    cvText: string,
    projectText: string,
    jobTitle: string,
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
      throw new AppError("Failed to evaluate CV and project", 500);
    }
  }

  private buildEvaluationPrompt(
    cvText: string,
    projectText: string,
    jobTitle: string,
  ): string {
    const cleanedCVText = this.cleanText(cvText);
    const cleanedProjectText = this.cleanText(projectText);

    return `You are an expert technical evaluator. Analyze the following CV and project for the position: "${jobTitle}"

CV Content:
${cleanedCVText}

Project Report Content:
${cleanedProjectText}

Provide evaluation in JSON format with the following structure:
{
  "cvScores": {
    "technicalSkillsMatch": number (1-5),
    "experienceLevel": number (1-5),
    "relevantAchievements": number (1-5),
    "culturalFit": number (1-5)
  },
  "projectScores": {
    "correctness": number (1-5),
    "codeQuality": number (1-5),
    "resilience": number (1-5),
    "documentation": number (1-5),
    "creativity": number (1-5)
  },
  "cvFeedback": "specific feedback with examples",
  "projectFeedback": "specific feedback with examples",
  "summary": "overall assessment (3-5 sentences covering strengths, gaps, and recommendations)"
}

CV EVALUATION RUBRIC (1-5 scale):

1. Technical Skills Match (Weight: 40%)
   - 1: Irrelevant skills
   - 2: Few overlaps with requirements
   - 3: Partial match with job requirements
   - 4: Strong match with requirements
   - 5: Excellent match + AI/LLM exposure

2. Experience Level (Weight: 25%)
   - 1: <1 year or trivial projects
   - 2: 1-2 years experience
   - 3: 2-3 years with mid-scale projects
   - 4: 3-4 years solid track record
   - 5: 5+ years with high-impact projects

3. Relevant Achievements (Weight: 20%)
   - 1: No clear achievements
   - 2: Minimal improvements
   - 3: Some measurable outcomes
   - 4: Significant contributions
   - 5: Major measurable impact

4. Cultural/Collaboration Fit (Weight: 15%)
   - 1: Not demonstrated
   - 2: Minimal evidence
   - 3: Average communication/teamwork
   - 4: Good collaboration skills
   - 5: Excellent and well-demonstrated

PROJECT EVALUATION RUBRIC (1-5 scale):

1. Correctness (Prompt & Chaining) (Weight: 30%)
   - 1: Not implemented
   - 2: Minimal attempt
   - 3: Works partially
   - 4: Works correctly
   - 5: Fully correct + thoughtful design

2. Code Quality & Structure (Weight: 25%)
   - 1: Poor quality
   - 2: Some structure
   - 3: Decent modularity
   - 4: Good structure + some tests
   - 5: Excellent quality + strong tests

3. Resilience & Error Handling (Weight: 20%)
   - 1: Missing error handling
   - 2: Minimal handling
   - 3: Partial error handling
   - 4: Solid error handling
   - 5: Robust, production-ready

4. Documentation & Explanation (Weight: 15%)
   - 1: Missing documentation
   - 2: Minimal docs
   - 3: Adequate documentation
   - 4: Clear documentation
   - 5: Excellent + insightful explanations

5. Creativity/Bonus (Weight: 10%)
   - 1: No extras
   - 2: Very basic additions
   - 3: Useful extra features
   - 4: Strong enhancements
   - 5: Outstanding creativity

IMPORTANT CALCULATION NOTES:
- Evaluate each parameter independently using the rubric above
- The weighted averages will be calculated automatically by the system
- CV Match Rate = (technicalSkillsMatch×0.4 + experienceLevel×0.25 + relevantAchievements×0.2 + culturalFit×0.15) × 0.2
- Project Score = (correctness×0.3 + codeQuality×0.25 + resilience×0.2 + documentation×0.15 + creativity×0.1)
- Provide detailed, constructive feedback for both CV and project
- Summary should be 3-5 sentences covering strengths, gaps, and recommendations

Ensure the response is valid JSON only, no additional text.`;
  }

  private parseEvaluationResult(response: string): EvaluationResult {
    try {
      const parsed = JSON.parse(response);

      // Extract CV scores
      const cvScores = {
        technicalSkillsMatch:
          Number(parsed.cvScores?.technicalSkillsMatch) || 1,
        experienceLevel: Number(parsed.cvScores?.experienceLevel) || 1,
        relevantAchievements:
          Number(parsed.cvScores?.relevantAchievements) || 1,
        culturalFit: Number(parsed.cvScores?.culturalFit) || 1,
      };

      // Extract project scores
      const projectScores = {
        correctness: Number(parsed.projectScores?.correctness) || 1,
        codeQuality: Number(parsed.projectScores?.codeQuality) || 1,
        resilience: Number(parsed.projectScores?.resilience) || 1,
        documentation: Number(parsed.projectScores?.documentation) || 1,
        creativity: Number(parsed.projectScores?.creativity) || 1,
      };

      // Calculate CV weighted average (1-5 scale)
      const cvWeightedAvg =
        cvScores.technicalSkillsMatch * 0.4 +
        cvScores.experienceLevel * 0.25 +
        cvScores.relevantAchievements * 0.2 +
        cvScores.culturalFit * 0.15;

      // Calculate CV match rate (0-1 scale: weighted average × 0.2)
      const cvMatchRate = cvWeightedAvg * 0.2;

      // Calculate project weighted average (1-5 scale)
      const projectScore =
        projectScores.correctness * 0.3 +
        projectScores.codeQuality * 0.25 +
        projectScores.resilience * 0.2 +
        projectScores.documentation * 0.15 +
        projectScores.creativity * 0.1;

      return {
        cvMatchRate: Number(cvMatchRate.toFixed(2)),
        projectScore: Number(projectScore.toFixed(2)),
        cvScores,
        projectScores,
        cvFeedback: String(parsed.cvFeedback || "No feedback provided"),
        projectFeedback: String(
          parsed.projectFeedback || "No feedback provided",
        ),
        summary: String(parsed.summary || "No summary provided"),
      };
    } catch (error) {
      throw new AppError("Invalid JSON response from AI service", 500);
    }
  }

  private validateEvaluationResult(result: EvaluationResult): void {
    // Validate CV match rate (0-1 scale)
    if (result.cvMatchRate < 0 || result.cvMatchRate > 1) {
      throw new AppError("Invalid cvMatchRate from AI service", 500);
    }

    // Validate project score (1-5 scale)
    if (result.projectScore < 1 || result.projectScore > 5) {
      throw new AppError("Invalid projectScore from AI service", 500);
    }

    // Validate CV scores (all should be 1-5)
    if (result.cvScores) {
      const cvScoreValues = Object.values(result.cvScores);
      for (const score of cvScoreValues) {
        if (score < 1 || score > 5) {
          throw new AppError("Invalid CV parameter score from AI service", 500);
        }
      }
    }

    // Validate project scores (all should be 1-5)
    if (result.projectScores) {
      const projectScoreValues = Object.values(result.projectScores);
      for (const score of projectScoreValues) {
        if (score < 1 || score > 5) {
          throw new AppError(
            "Invalid project parameter score from AI service",
            500,
          );
        }
      }
    }

    // Validate feedback
    if (!result.cvFeedback || result.cvFeedback.trim().length === 0) {
      throw new AppError("Missing cvFeedback from AI service", 500);
    }

    if (!result.projectFeedback || result.projectFeedback.trim().length === 0) {
      throw new AppError("Missing projectFeedback from AI service", 500);
    }

    // Validate summary (should be 3-5 sentences)
    if (!result.summary || result.summary.trim().length === 0) {
      throw new AppError("Missing summary from AI service", 500);
    }
  }

  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, " ")
      .replace(/[\r\n]+/g, " ")
      .trim();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Factory function to create AI provider
export function createAIProvider(): IAIProvider {
  const provider = config.ai.provider;

  if (provider === "zhipu") {
    console.log("🤖 Using Zhipu AI GLM model");
  } else {
    console.log("🤖 Using OpenAI model");
  }

  return new OpenAIProvider();
}
