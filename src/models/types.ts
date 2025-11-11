export type FileType = "cv" | "project";

export type JobStatus = "pending" | "processing" | "completed" | "failed";

export interface FileInfo {
  id: string;
  originalName: string;
  path: string;
  type: FileType;
  size: number;
  uploadedAt: Date;
}

export interface CVEvaluationScores {
  technicalSkillsMatch: number; // 1-5 scale, weight: 40%
  experienceLevel: number; // 1-5 scale, weight: 25%
  relevantAchievements: number; // 1-5 scale, weight: 20%
  culturalFit: number; // 1-5 scale, weight: 15%
}

export interface ProjectEvaluationScores {
  correctness: number; // 1-5 scale, weight: 30%
  codeQuality: number; // 1-5 scale, weight: 25%
  resilience: number; // 1-5 scale, weight: 20%
  documentation: number; // 1-5 scale, weight: 15%
  creativity: number; // 1-5 scale, weight: 10%
}

export interface EvaluationResult {
  cvMatchRate: number; // 0-1 scale (weighted average × 0.2)
  projectScore: number; // 1-5 scale (weighted average)
  cvScores?: CVEvaluationScores; // Detailed CV parameter scores
  projectScores?: ProjectEvaluationScores; // Detailed project parameter scores
  cvFeedback: string;
  projectFeedback: string;
  summary: string;
}

export interface Job {
  id: string;
  title: string;
  cvFileId: string;
  projectFileId: string;
  status: JobStatus;
  result?: EvaluationResult;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface CreateJobRequest {
  title: string;
  cvFileId: string;
  projectFileId: string;
}

export interface UploadResponse {
  cvFile: {
    id: string;
    originalName: string;
    size: number;
  };
  projectFile: {
    id: string;
    originalName: string;
    size: number;
  };
}

export interface CreateJobResponse {
  jobId: string;
  status: JobStatus;
  message: string;
}

export interface JobStatusResponse {
  jobId: string;
  status: JobStatus;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  result?: EvaluationResult;
  error?: string;
}

export interface HealthResponse {
  status: "OK";
  timestamp: string;
  uptime: number;
  environment: string;
}

export interface ErrorResponse {
  error: {
    message: string;
    code?: string;
    details?: any;
  };
  timestamp: string;
  path?: string;
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ErrorResponse["error"];
  timestamp: string;
}

// AI Provider Interface
export interface IAIProvider {
  evaluate(prompt: string): Promise<string>;
  evaluateCVAndProject(
    cvText: string,
    projectText: string,
    jobTitle: string,
  ): Promise<EvaluationResult>;
  isConfigured(): boolean;
}

// PDF Parse Result
export interface PDFParseResult {
  text: string;
  info: any;
  numpages: number;
}
