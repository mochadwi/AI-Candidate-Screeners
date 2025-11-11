import fs from 'fs/promises';
import path from 'path';
import { getVectorStore, DocumentChunk } from './vectorStoreService';
import { AppError } from '../middleware/errorHandler';

export class DocumentIngestionService {
  private vectorStore = getVectorStore();
  private groundTruthDir = path.join(process.cwd(), 'ground-truth');

  /**
   * Split text into semantic chunks
   */
  private splitIntoChunks(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
    const chunks: string[] = [];
    const paragraphs = text.split('\n\n').filter(p => p.trim().length > 0);

    let currentChunk = '';

    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length <= chunkSize) {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = paragraph;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Ingest job descriptions
   */
  async ingestJobDescriptions(): Promise<number> {
    try {
      console.log('📂 Ingesting job descriptions...');
      const jobDescDir = path.join(this.groundTruthDir, 'job-descriptions');
      const files = await fs.readdir(jobDescDir);
      const mdFiles = files.filter(f => f.endsWith('.md'));

      let totalChunks = 0;

      for (const file of mdFiles) {
        const filePath = path.join(jobDescDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const textChunks = this.splitIntoChunks(content);

        const documentChunks: DocumentChunk[] = textChunks.map((text, index) => ({
          id: `job-desc-${file}-${index}`,
          text,
          metadata: {
            source: file,
            doc_type: 'job-description',
            chunk_index: index
          }
        }));

        await this.vectorStore.addDocuments(
          this.vectorStore.getCollectionNames().JOB_DESCRIPTIONS,
          documentChunks
        );

        totalChunks += documentChunks.length;
        console.log(`  ✅ Ingested ${file}: ${documentChunks.length} chunks`);
      }

      console.log(`✅ Total job description chunks ingested: ${totalChunks}`);
      return totalChunks;
    } catch (error) {
      console.error('❌ Failed to ingest job descriptions:', error);
      throw new AppError('Job description ingestion failed', 500);
    }
  }

  /**
   * Ingest case study brief
   */
  async ingestCaseStudyBrief(): Promise<number> {
    try {
      console.log('📂 Ingesting case study brief...');
      const filePath = path.join(this.groundTruthDir, 'case-study-brief.md');
      const content = await fs.readFile(filePath, 'utf-8');
      const textChunks = this.splitIntoChunks(content, 800, 150);

      const documentChunks: DocumentChunk[] = textChunks.map((text, index) => ({
        id: `case-study-${index}`,
        text,
        metadata: {
          source: 'case-study-brief.md',
          doc_type: 'case-study-brief',
          chunk_index: index
        }
      }));

      await this.vectorStore.addDocuments(
        this.vectorStore.getCollectionNames().CASE_STUDY,
        documentChunks
      );

      console.log(`✅ Case study brief ingested: ${documentChunks.length} chunks`);
      return documentChunks.length;
    } catch (error) {
      console.error('❌ Failed to ingest case study brief:', error);
      throw new AppError('Case study brief ingestion failed', 500);
    }
  }

  /**
   * Ingest CV scoring rubric
   */
  async ingestCVRubric(): Promise<number> {
    try {
      console.log('📂 Ingesting CV scoring rubric...');
      const filePath = path.join(this.groundTruthDir, 'rubrics', 'cv-scoring-rubric.md');
      const content = await fs.readFile(filePath, 'utf-8');
      const textChunks = this.splitIntoChunks(content, 600, 100);

      const documentChunks: DocumentChunk[] = textChunks.map((text, index) => ({
        id: `cv-rubric-${index}`,
        text,
        metadata: {
          source: 'cv-scoring-rubric.md',
          doc_type: 'cv-rubric',
          chunk_index: index
        }
      }));

      await this.vectorStore.addDocuments(
        this.vectorStore.getCollectionNames().CV_RUBRIC,
        documentChunks
      );

      console.log(`✅ CV rubric ingested: ${documentChunks.length} chunks`);
      return documentChunks.length;
    } catch (error) {
      console.error('❌ Failed to ingest CV rubric:', error);
      throw new AppError('CV rubric ingestion failed', 500);
    }
  }

  /**
   * Ingest project scoring rubric
   */
  async ingestProjectRubric(): Promise<number> {
    try {
      console.log('📂 Ingesting project scoring rubric...');
      const filePath = path.join(this.groundTruthDir, 'rubrics', 'project-scoring-rubric.md');
      const content = await fs.readFile(filePath, 'utf-8');
      const textChunks = this.splitIntoChunks(content, 600, 100);

      const documentChunks: DocumentChunk[] = textChunks.map((text, index) => ({
        id: `project-rubric-${index}`,
        text,
        metadata: {
          source: 'project-scoring-rubric.md',
          doc_type: 'project-rubric',
          chunk_index: index
        }
      }));

      await this.vectorStore.addDocuments(
        this.vectorStore.getCollectionNames().PROJECT_RUBRIC,
        documentChunks
      );

      console.log(`✅ Project rubric ingested: ${documentChunks.length} chunks`);
      return documentChunks.length;
    } catch (error) {
      console.error('❌ Failed to ingest project rubric:', error);
      throw new AppError('Project rubric ingestion failed', 500);
    }
  }

  /**
   * Ingest all ground truth documents
   */
  async ingestAll(): Promise<{
    jobDescriptions: number;
    caseStudy: number;
    cvRubric: number;
    projectRubric: number;
    total: number;
  }> {
    console.log('🚀 Starting full document ingestion...\n');

    // Initialize vector store
    await this.vectorStore.initialize();

    // Ingest all documents
    const jobDescriptions = await this.ingestJobDescriptions();
    const caseStudy = await this.ingestCaseStudyBrief();
    const cvRubric = await this.ingestCVRubric();
    const projectRubric = await this.ingestProjectRubric();

    const total = jobDescriptions + caseStudy + cvRubric + projectRubric;

    console.log('\n✅ Document ingestion complete!');
    console.log(`📊 Summary:`);
    console.log(`   - Job Descriptions: ${jobDescriptions} chunks`);
    console.log(`   - Case Study Brief: ${caseStudy} chunks`);
    console.log(`   - CV Rubric: ${cvRubric} chunks`);
    console.log(`   - Project Rubric: ${projectRubric} chunks`);
    console.log(`   - Total: ${total} chunks\n`);

    return {
      jobDescriptions,
      caseStudy,
      cvRubric,
      projectRubric,
      total
    };
  }

  /**
   * Check if documents are already ingested
   */
  async isIngested(): Promise<boolean> {
    try {
      await this.vectorStore.initialize();

      // Try to query each collection
      const jobQuery = await this.vectorStore.query(
        this.vectorStore.getCollectionNames().JOB_DESCRIPTIONS,
        'test',
        1
      );

      return jobQuery.length > 0;
    } catch {
      return false;
    }
  }
}

// Singleton instance
let ingestionServiceInstance: DocumentIngestionService | null = null;

export function getDocumentIngestionService(): DocumentIngestionService {
  if (!ingestionServiceInstance) {
    ingestionServiceInstance = new DocumentIngestionService();
  }
  return ingestionServiceInstance;
}
