import OpenAI from "openai";
import { config } from "../config/environment";
import {
  IAIProvider,
  EvaluationResult,
  CVEvaluationResult,
  ProjectEvaluationResult,
} from "../models";
import { AppError } from "../middleware/errorHandler";
import { getVectorStore } from "./vectorStoreService";

export class OpenAIProvider implements IAIProvider {
  private client: OpenAI;
  private vectorStore = getVectorStore();
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

    // Simulate failures if enabled (for testing)
    if (config.ai.simulateFailures && Math.random() < config.ai.failureRate) {
      const simulatedErrors = [
        new Error("Simulated timeout error"),
        new Error("Simulated rate limit error"),
        new Error("Simulated network error"),
      ];
      const randomError =
        simulatedErrors[Math.floor(Math.random() * simulatedErrors.length)];
      console.warn("⚠️ Simulating failure:", randomError.message);
      throw randomError;
    }

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`🤖 LLM API call attempt ${attempt}/${this.maxRetries}`);

        // Add timeout wrapper
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(
              new Error(
                `Request timeout after ${config.ai.requestTimeout}ms`,
              ),
            );
          }, config.ai.requestTimeout);
        });

        const apiPromise = this.client.chat.completions.create({
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

        const response = await Promise.race([apiPromise, timeoutPromise]);

        const content = response.choices[0]?.message?.content;

        if (!content) {
          throw new AppError("No response from AI API", 500);
        }

        console.log("✅ LLM API call successful");
        return content;
      } catch (error) {
        lastError = error as Error;

        console.error(
          `❌ LLM API call failed (attempt ${attempt}/${this.maxRetries}):`,
          lastError.message,
        );

        // Don't retry on certain errors
        if (error instanceof OpenAI.APIError) {
          // 400 Bad Request - Invalid input, don't retry
          if (error.status === 400) {
            const providerName =
              config.ai.provider === "zhipu" ? "Zhipu AI" : "OpenAI";
            throw new AppError(
              `${providerName} API error (Bad Request): ${error.message}`,
              400,
            );
          }

          // 401 Unauthorized - Invalid API key, don't retry
          if (error.status === 401) {
            const providerName =
              config.ai.provider === "zhipu" ? "Zhipu AI" : "OpenAI";
            throw new AppError(
              `${providerName} API error (Unauthorized): Check your API key`,
              401,
            );
          }

          // 403 Forbidden - Access denied, don't retry
          if (error.status === 403) {
            const providerName =
              config.ai.provider === "zhipu" ? "Zhipu AI" : "OpenAI";
            throw new AppError(
              `${providerName} API error (Forbidden): ${error.message}`,
              403,
            );
          }

          // 429 Rate Limit - Use retry-after header if available
          if (error.status === 429) {
            const retryAfter = error.headers?.["retry-after"];
            const waitTime = retryAfter
              ? parseInt(retryAfter) * 1000
              : this.retryDelay * Math.pow(2, attempt);

            console.warn(
              `⏳ Rate limited. Waiting ${waitTime}ms before retry...`,
            );

            if (attempt < this.maxRetries) {
              await this.sleep(waitTime);
              continue;
            }

            throw new AppError(
              "Rate limit exceeded. Please try again later.",
              429,
            );
          }

          // 500/503 Server errors - Retry with backoff
          if (error.status === 500 || error.status === 503) {
            console.warn("⚠️ Server error, will retry with backoff");
          }
        }

        // Check for timeout error
        if (lastError.message.includes("timeout")) {
          console.warn("⏱️ Request timed out, will retry");
        }

        // If not the last attempt, wait before retrying
        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await this.sleep(delay);
        }
      }
    }

    const providerName =
      config.ai.provider === "zhipu" ? "Zhipu AI" : "OpenAI";
    throw new AppError(
      `Failed to get ${providerName} response after ${this.maxRetries} attempts: ${lastError?.message}`,
      500,
    );
  }

  // Step 1: CV Evaluation Chain
  async evaluateCV(
    cvText: string,
    jobTitle: string,
    jobContext: string,
    cvRubricContext: string,
  ): Promise<CVEvaluationResult> {
    const cleanedCVText = this.cleanText(cvText);

    const prompt = `You are an expert technical evaluator. Analyze the following CV for the position: "${jobTitle}"

=== JOB REQUIREMENTS (Ground Truth) ===
${jobContext || "No specific job requirements retrieved."}

=== CANDIDATE CV ===
${cleanedCVText}

=== CV EVALUATION RUBRIC (Retrieved from Ground Truth) ===
${cvRubricContext || "Use standard 1-5 scale for: Technical Skills (40%), Experience (25%), Achievements (20%), Cultural Fit (15%)"}

Provide CV evaluation in JSON format with the following structure:
{
  "cvScores": {
    "technicalSkillsMatch": number (1-5),
    "experienceLevel": number (1-5),
    "relevantAchievements": number (1-5),
    "culturalFit": number (1-5)
  },
  "cvFeedback": "specific feedback with examples from the CV, highlighting strengths and gaps"
}

IMPORTANT:
- Evaluate each parameter independently using the rubric above
- The weighted average will be calculated automatically by the system
- CV Match Rate = (technicalSkillsMatch×0.4 + experienceLevel×0.25 + relevantAchievements×0.2 + culturalFit×0.15) × 0.2
- Provide detailed, constructive feedback

Ensure the response is valid JSON only, no additional text.`;

    const response = await this.evaluate(prompt);
    const parsed = JSON.parse(response);

    // Extract CV scores
    const cvScores = {
      technicalSkillsMatch: Number(parsed.cvScores?.technicalSkillsMatch) || 1,
      experienceLevel: Number(parsed.cvScores?.experienceLevel) || 1,
      relevantAchievements: Number(parsed.cvScores?.relevantAchievements) || 1,
      culturalFit: Number(parsed.cvScores?.culturalFit) || 1,
    };

    // Calculate CV weighted average (1-5 scale)
    const cvWeightedAvg =
      cvScores.technicalSkillsMatch * 0.4 +
      cvScores.experienceLevel * 0.25 +
      cvScores.relevantAchievements * 0.2 +
      cvScores.culturalFit * 0.15;

    // Calculate CV match rate (0-1 scale: weighted average × 0.2)
    const cvMatchRate = cvWeightedAvg * 0.2;

    return {
      cvMatchRate: Number(cvMatchRate.toFixed(2)),
      cvScores,
      cvFeedback: String(parsed.cvFeedback || "No feedback provided"),
    };
  }

  // Step 2: Project Evaluation Chain
  async evaluateProject(
    projectText: string,
    caseStudyContext: string,
    projectRubricContext: string,
  ): Promise<ProjectEvaluationResult> {
    const cleanedProjectText = this.cleanText(projectText);

    const prompt = `You are an expert technical evaluator. Analyze the following project report.

=== CASE STUDY REQUIREMENTS (Ground Truth) ===
${caseStudyContext || "No specific case study requirements retrieved."}

=== CANDIDATE PROJECT REPORT ===
${cleanedProjectText}

=== PROJECT EVALUATION RUBRIC (Retrieved from Ground Truth) ===
${projectRubricContext || "Use standard 1-5 scale for: Correctness (30%), Code Quality (25%), Resilience (20%), Documentation (15%), Creativity (10%)"}

Provide project evaluation in JSON format with the following structure:
{
  "projectScores": {
    "correctness": number (1-5),
    "codeQuality": number (1-5),
    "resilience": number (1-5),
    "documentation": number (1-5),
    "creativity": number (1-5)
  },
  "projectFeedback": "specific feedback with examples from the project report, highlighting implementation quality and areas for improvement"
}

IMPORTANT:
- Evaluate each parameter independently using the rubric above
- The weighted average will be calculated automatically by the system
- Project Score = (correctness×0.3 + codeQuality×0.25 + resilience×0.2 + documentation×0.15 + creativity×0.1)
- Provide detailed, constructive feedback

Ensure the response is valid JSON only, no additional text.`;

    const response = await this.evaluate(prompt);
    const parsed = JSON.parse(response);

    // Extract project scores
    const projectScores = {
      correctness: Number(parsed.projectScores?.correctness) || 1,
      codeQuality: Number(parsed.projectScores?.codeQuality) || 1,
      resilience: Number(parsed.projectScores?.resilience) || 1,
      documentation: Number(parsed.projectScores?.documentation) || 1,
      creativity: Number(parsed.projectScores?.creativity) || 1,
    };

    // Calculate project weighted average (1-5 scale)
    const projectScore =
      projectScores.correctness * 0.3 +
      projectScores.codeQuality * 0.25 +
      projectScores.resilience * 0.2 +
      projectScores.documentation * 0.15 +
      projectScores.creativity * 0.1;

    return {
      projectScore: Number(projectScore.toFixed(2)),
      projectScores,
      projectFeedback: String(parsed.projectFeedback || "No feedback provided"),
    };
  }

  // Step 3: Final Synthesis Chain
  async synthesizeFinalAnalysis(
    cvResult: CVEvaluationResult,
    projectResult: ProjectEvaluationResult,
    jobTitle: string,
  ): Promise<string> {
    const prompt = `You are an expert technical evaluator. Synthesize a final overall assessment based on the CV and project evaluations below.

=== POSITION ===
${jobTitle}

=== CV EVALUATION RESULTS ===
Match Rate: ${cvResult.cvMatchRate} (0-1 scale)
Scores:
- Technical Skills Match: ${cvResult.cvScores.technicalSkillsMatch}/5 (40% weight)
- Experience Level: ${cvResult.cvScores.experienceLevel}/5 (25% weight)
- Relevant Achievements: ${cvResult.cvScores.relevantAchievements}/5 (20% weight)
- Cultural Fit: ${cvResult.cvScores.culturalFit}/5 (15% weight)

CV Feedback:
${cvResult.cvFeedback}

=== PROJECT EVALUATION RESULTS ===
Project Score: ${projectResult.projectScore}/5
Scores:
- Correctness: ${projectResult.projectScores.correctness}/5 (30% weight)
- Code Quality: ${projectResult.projectScores.codeQuality}/5 (25% weight)
- Resilience: ${projectResult.projectScores.resilience}/5 (20% weight)
- Documentation: ${projectResult.projectScores.documentation}/5 (15% weight)
- Creativity: ${projectResult.projectScores.creativity}/5 (10% weight)

Project Feedback:
${projectResult.projectFeedback}

Provide a concise overall summary (3-5 sentences) in JSON format:
{
  "summary": "Your synthesized assessment covering: 1) Overall candidate suitability, 2) Key strengths demonstrated, 3) Main areas for improvement, 4) Hiring recommendation"
}

Ensure the response is valid JSON only, no additional text.`;

    const response = await this.evaluate(prompt);
    const parsed = JSON.parse(response);

    return String(parsed.summary || "No summary provided");
  }

  async evaluateCVAndProject(
    cvText: string,
    projectText: string,
    jobTitle: string,
  ): Promise<EvaluationResult> {
    try {
      // Initialize vector store if needed
      await this.vectorStore.initialize();

      // Retrieve relevant context from ground truth documents
      console.log("🔍 Retrieving context from vector store...");

      const [
        jobContext,
        caseStudyContext,
        cvRubricContext,
        projectRubricContext,
      ] = await Promise.all([
        this.vectorStore.getJobDescriptionContext(jobTitle),
        this.vectorStore.getCaseStudyContext(),
        this.vectorStore.getCVRubricContext(),
        this.vectorStore.getProjectRubricContext(),
      ]);

      console.log("✅ Context retrieved successfully");

      // LLM Chain Step 1: CV Evaluation
      console.log("🔗 Chain 1/3: Evaluating CV...");
      const cvResult = await this.evaluateCV(
        cvText,
        jobTitle,
        jobContext,
        cvRubricContext,
      );
      console.log("✅ CV evaluation completed");

      // LLM Chain Step 2: Project Evaluation
      console.log("🔗 Chain 2/3: Evaluating Project...");
      const projectResult = await this.evaluateProject(
        projectText,
        caseStudyContext,
        projectRubricContext,
      );
      console.log("✅ Project evaluation completed");

      // LLM Chain Step 3: Final Synthesis
      console.log("🔗 Chain 3/3: Synthesizing final analysis...");
      const summary = await this.synthesizeFinalAnalysis(
        cvResult,
        projectResult,
        jobTitle,
      );
      console.log("✅ Final synthesis completed");

      // Combine results
      const result: EvaluationResult = {
        cvMatchRate: cvResult.cvMatchRate,
        cvScores: cvResult.cvScores,
        cvFeedback: cvResult.cvFeedback,
        projectScore: projectResult.projectScore,
        projectScores: projectResult.projectScores,
        projectFeedback: projectResult.projectFeedback,
        summary,
      };

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
    jobContext: string,
    caseStudyContext: string,
    cvRubricContext: string,
    projectRubricContext: string,
  ): string {
    const cleanedCVText = this.cleanText(cvText);
    const cleanedProjectText = this.cleanText(projectText);

    return `You are an expert technical evaluator. Analyze the following CV and project for the position: "${jobTitle}"

=== JOB REQUIREMENTS (Ground Truth) ===
${jobContext || "No specific job requirements retrieved."}

=== CASE STUDY REQUIREMENTS (Ground Truth) ===
${caseStudyContext || "No specific case study requirements retrieved."}

=== CANDIDATE CV ===
${cleanedCVText}

=== CANDIDATE PROJECT REPORT ===
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

=== CV EVALUATION RUBRIC (Retrieved from Ground Truth) ===
${cvRubricContext || "Use standard 1-5 scale for: Technical Skills (40%), Experience (25%), Achievements (20%), Cultural Fit (15%)"}

=== PROJECT EVALUATION RUBRIC (Retrieved from Ground Truth) ===
${projectRubricContext || "Use standard 1-5 scale for: Correctness (30%), Code Quality (25%), Resilience (20%), Documentation (15%), Creativity (10%)"}

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
