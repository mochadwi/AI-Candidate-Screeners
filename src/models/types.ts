export type FileType = 'cv' | 'project';

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface FileInfo {
  id: string;
  originalName: string;
  path: string;
  type: FileType;
  size: number;
  uploadedAt: Date;
}

export interface EvaluationResult {
  cvMatchRate: number; // 0-1 scale
  projectScore: number; // 1-5 scale
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
  status: 'OK';
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
  error?: ErrorResponse['error'];
  timestamp: string;
}

// AI Provider Interface
export interface IAIProvider {
  evaluate(prompt: string): Promise<string>;
  isConfigured(): boolean;
}

// PDF Parse Result
export interface PDFParseResult {
  text: string;
  info: any;
  numpages: number;
}