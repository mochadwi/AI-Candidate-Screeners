import { AppError } from "../middleware/errorHandler";
import {
  CVEvaluationScores,
  ProjectEvaluationScores,
  EvaluationResult,
  CVEvaluationResult,
  ProjectEvaluationResult,
} from "../models";

export class ValidationService {
  /**
   * Validate that a score is within the expected range (1-5)
   */
  private validateScoreRange(
    score: number,
    parameterName: string,
    min: number = 1,
    max: number = 5,
  ): void {
    if (score < min || score > max) {
      throw new AppError(
        `Invalid ${parameterName}: ${score}. Must be between ${min} and ${max}`,
        400,
      );
    }

    if (!Number.isFinite(score)) {
      throw new AppError(`Invalid ${parameterName}: not a finite number`, 400);
    }
  }

  /**
   * Validate CV evaluation scores
   */
  validateCVScores(scores: CVEvaluationScores): void {
    this.validateScoreRange(
      scores.technicalSkillsMatch,
      "Technical Skills Match",
    );
    this.validateScoreRange(scores.experienceLevel, "Experience Level");
    this.validateScoreRange(
      scores.relevantAchievements,
      "Relevant Achievements",
    );
    this.validateScoreRange(scores.culturalFit, "Cultural Fit");

    // Validate weighted calculation
    const calculatedWeightedAvg =
      scores.technicalSkillsMatch * 0.4 +
      scores.experienceLevel * 0.25 +
      scores.relevantAchievements * 0.2 +
      scores.culturalFit * 0.15;

    if (calculatedWeightedAvg < 1 || calculatedWeightedAvg > 5) {
      throw new AppError(
        `Invalid CV weighted average: ${calculatedWeightedAvg.toFixed(2)}. Must be between 1 and 5`,
        500,
      );
    }
  }

  /**
   * Validate project evaluation scores
   */
  validateProjectScores(scores: ProjectEvaluationScores): void {
    this.validateScoreRange(scores.correctness, "Correctness");
    this.validateScoreRange(scores.codeQuality, "Code Quality");
    this.validateScoreRange(scores.resilience, "Resilience");
    this.validateScoreRange(scores.documentation, "Documentation");
    this.validateScoreRange(scores.creativity, "Creativity");

    // Validate weighted calculation
    const calculatedWeightedAvg =
      scores.correctness * 0.3 +
      scores.codeQuality * 0.25 +
      scores.resilience * 0.2 +
      scores.documentation * 0.15 +
      scores.creativity * 0.1;

    if (calculatedWeightedAvg < 1 || calculatedWeightedAvg > 5) {
      throw new AppError(
        `Invalid project weighted average: ${calculatedWeightedAvg.toFixed(2)}. Must be between 1 and 5`,
        500,
      );
    }
  }

  /**
   * Validate feedback text is substantive
   */
  validateFeedback(
    feedback: string,
    fieldName: string,
    minLength: number = 50,
  ): void {
    if (!feedback || typeof feedback !== "string") {
      throw new AppError(`Missing or invalid ${fieldName}`, 400);
    }

    const trimmedFeedback = feedback.trim();

    if (trimmedFeedback.length < minLength) {
      throw new AppError(
        `${fieldName} too short: ${trimmedFeedback.length} characters. Minimum ${minLength} characters required for substantive feedback.`,
        400,
      );
    }

    // Check for generic/placeholder feedback
    const genericPhrases = [
      "no feedback provided",
      "not available",
      "n/a",
      "todo",
      "placeholder",
    ];

    const lowerFeedback = trimmedFeedback.toLowerCase();
    for (const phrase of genericPhrases) {
      if (lowerFeedback.includes(phrase)) {
        throw new AppError(
          `${fieldName} appears to be a placeholder or generic response`,
          400,
        );
      }
    }
  }

  /**
   * Validate CV match rate
   */
  validateCVMatchRate(matchRate: number, scores: CVEvaluationScores): void {
    this.validateScoreRange(matchRate, "CV Match Rate", 0, 1);

    // Validate the calculation is correct
    const expectedWeightedAvg =
      scores.technicalSkillsMatch * 0.4 +
      scores.experienceLevel * 0.25 +
      scores.relevantAchievements * 0.2 +
      scores.culturalFit * 0.15;

    const expectedMatchRate = Number((expectedWeightedAvg * 0.2).toFixed(2));
    const actualMatchRate = Number(matchRate.toFixed(2));

    if (Math.abs(expectedMatchRate - actualMatchRate) > 0.01) {
      throw new AppError(
        `CV Match Rate calculation mismatch. Expected: ${expectedMatchRate}, Got: ${actualMatchRate}`,
        500,
      );
    }
  }

  /**
   * Validate project score
   */
  validateProjectScore(
    projectScore: number,
    scores: ProjectEvaluationScores,
  ): void {
    this.validateScoreRange(projectScore, "Project Score", 1, 5);

    // Validate the calculation is correct
    const expectedScore =
      scores.correctness * 0.3 +
      scores.codeQuality * 0.25 +
      scores.resilience * 0.2 +
      scores.documentation * 0.15 +
      scores.creativity * 0.1;

    const expectedRounded = Number(expectedScore.toFixed(2));
    const actualRounded = Number(projectScore.toFixed(2));

    if (Math.abs(expectedRounded - actualRounded) > 0.01) {
      throw new AppError(
        `Project Score calculation mismatch. Expected: ${expectedRounded}, Got: ${actualRounded}`,
        500,
      );
    }
  }

  /**
   * Validate complete CV evaluation result
   */
  validateCVEvaluationResult(result: CVEvaluationResult): void {
    if (!result.cvScores) {
      throw new AppError("Missing CV scores", 400);
    }

    this.validateCVScores(result.cvScores);
    this.validateCVMatchRate(result.cvMatchRate, result.cvScores);
    this.validateFeedback(result.cvFeedback, "CV Feedback");
  }

  /**
   * Validate complete project evaluation result
   */
  validateProjectEvaluationResult(result: ProjectEvaluationResult): void {
    if (!result.projectScores) {
      throw new AppError("Missing project scores", 400);
    }

    this.validateProjectScores(result.projectScores);
    this.validateProjectScore(result.projectScore, result.projectScores);
    this.validateFeedback(result.projectFeedback, "Project Feedback");
  }

  /**
   * Validate complete evaluation result (all three chains)
   */
  validateEvaluationResult(result: EvaluationResult): void {
    // Validate CV part
    if (!result.cvScores) {
      throw new AppError("Missing CV scores in final result", 400);
    }
    this.validateCVScores(result.cvScores);
    this.validateCVMatchRate(result.cvMatchRate, result.cvScores);
    this.validateFeedback(result.cvFeedback, "CV Feedback");

    // Validate Project part
    if (!result.projectScores) {
      throw new AppError("Missing project scores in final result", 400);
    }
    this.validateProjectScores(result.projectScores);
    this.validateProjectScore(result.projectScore, result.projectScores);
    this.validateFeedback(result.projectFeedback, "Project Feedback");

    // Validate Summary
    this.validateFeedback(result.summary, "Overall Summary", 100);
  }

  /**
   * Validate input text before processing
   */
  validateInputText(text: string, fieldName: string): void {
    if (!text || typeof text !== "string") {
      throw new AppError(`Missing or invalid ${fieldName}`, 400);
    }

    const trimmedText = text.trim();

    if (trimmedText.length === 0) {
      throw new AppError(`${fieldName} is empty`, 400);
    }

    if (trimmedText.length < 100) {
      throw new AppError(
        `${fieldName} too short: ${trimmedText.length} characters. Minimum 100 characters required.`,
        400,
      );
    }

    // Check for very long documents (potential abuse or errors)
    if (trimmedText.length > 50000) {
      throw new AppError(
        `${fieldName} too long: ${trimmedText.length} characters. Maximum 50000 characters allowed.`,
        400,
      );
    }
  }

  /**
   * Validate job title
   */
  validateJobTitle(jobTitle: string): void {
    if (!jobTitle || typeof jobTitle !== "string") {
      throw new AppError("Missing or invalid job title", 400);
    }

    const trimmedTitle = jobTitle.trim();

    if (trimmedTitle.length === 0) {
      throw new AppError("Job title is empty", 400);
    }

    if (trimmedTitle.length < 3) {
      throw new AppError("Job title too short", 400);
    }

    if (trimmedTitle.length > 200) {
      throw new AppError("Job title too long (max 200 characters)", 400);
    }
  }
}

// Singleton instance
let validationServiceInstance: ValidationService | null = null;

export function getValidationService(): ValidationService {
  if (!validationServiceInstance) {
    validationServiceInstance = new ValidationService();
  }
  return validationServiceInstance;
}
