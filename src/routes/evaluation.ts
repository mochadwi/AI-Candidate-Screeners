import { Router, Request, Response, NextFunction } from "express";
import { JobService } from "../services/jobService";
import { FileService } from "../services/fileService";
import { PDFService } from "../services/pdfService";
import { createAIProvider } from "../services/aiService";
import { AppError } from "../middleware/errorHandler";
import { CreateJobRequest, CreateJobResponse, FileType } from "../models";

const router = Router();
const jobService = new JobService();
const fileService = new FileService();
const pdfService = new PDFService();

// Create evaluation job
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, cvFileId, projectFileId }: CreateJobRequest = req.body;

    // Validate input
    if (!title || !title.trim()) {
      throw new AppError("Job title is required", 400);
    }

    if (!cvFileId || !projectFileId) {
      throw new AppError("Both CV and project file IDs are required", 400);
    }

    // Validate file IDs exist
    const cvFileInfo = await fileService.validateFileExists(cvFileId, "cv");
    const projectFileInfo = await fileService.validateFileExists(
      projectFileId,
      "project",
    );

    if (!cvFileInfo) {
      throw new AppError("CV file not found or invalid", 404);
    }

    if (!projectFileInfo) {
      throw new AppError("Project file not found or invalid", 404);
    }

    // Create job
    const job = await jobService.createJob({
      title: title.trim(),
      cvFileId,
      projectFileId,
    });

    console.log(`🎯 Evaluation Route: Creating job with title: ${title}`);
    console.log(`📁 Evaluation Route: CV File ID: ${cvFileId}`);
    console.log(`📁 Evaluation Route: Project File ID: ${projectFileId}`);

    // Start async evaluation with proper error handling
    processEvaluationAsync(
      job.id,
      cvFileInfo.path,
      projectFileInfo.path,
      title,
    ).catch((error) => {
      console.error(
        `🚨 Unhandled async evaluation error for job ${job.id}:`,
        error,
      );
    });

    console.log(
      `🚀 Evaluation Route: Created job ${job.id}, returning response`,
    );

    const response: CreateJobResponse = {
      jobId: job.id,
      status: job.status,
      message: "Evaluation job created successfully",
    };

    res.status(201).json({
      success: true,
      data: response,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// Async evaluation processing
async function processEvaluationAsync(
  jobId: string,
  cvFilePath: string,
  projectFilePath: string,
  jobTitle: string,
): Promise<void> {
  try {
    console.log(`🔄 Starting evaluation for job ${jobId}`);

    // Update job status to processing
    await jobService.updateJobStatus(jobId, "processing");
    console.log(`✅ Job ${jobId} status updated to processing`);

    // Extract text from PDFs
    console.log(`📄 Extracting text from CV: ${cvFilePath}`);
    console.log(`📄 Extracting text from project: ${projectFilePath}`);

    const [cvText, projectText] = await Promise.all([
      pdfService.extractTextFromPDF(cvFilePath),
      pdfService.extractTextFromPDF(projectFilePath),
    ]);

    console.log(`✅ CV text extracted: ${cvText?.length || 0} characters`);
    console.log(
      `✅ Project text extracted: ${projectText?.length || 0} characters`,
    );

    // Validate extracted text
    if (!cvText || cvText.trim().length === 0) {
      throw new Error("No text could be extracted from CV PDF");
    }

    if (!projectText || projectText.trim().length === 0) {
      throw new Error("No text could be extracted from project PDF");
    }

    // Get AI evaluation
    console.log(`🤖 Starting AI evaluation for job ${jobId}`);
    const aiProvider = createAIProvider();
    const evaluationResult = await aiProvider.evaluateCVAndProject(
      cvText,
      projectText,
      jobTitle,
    );
    console.log(`✅ AI evaluation completed for job ${jobId}`);

    // Update job with results
    await jobService.updateJobStatus(jobId, "completed", evaluationResult);

    console.log(`✅ Evaluation completed for job ${jobId}`);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    console.error(`❌ Evaluation failed for job ${jobId}:`, errorMessage);
    console.error(`❌ Error details:`, error);

    // Update job with error
    await jobService.updateJobStatus(jobId, "failed", undefined, errorMessage);

    console.error(`❌ Job ${jobId} updated with failed status`);
  }
}

export default router;
