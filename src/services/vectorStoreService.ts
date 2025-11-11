import { ChromaClient, Collection } from "chromadb";
import OpenAI from "openai";
import { config } from "../config/environment";
import { AppError } from "../middleware/errorHandler";

export interface DocumentChunk {
  id: string;
  text: string;
  metadata: {
    source: string;
    doc_type:
      | "job-description"
      | "case-study-brief"
      | "cv-rubric"
      | "project-rubric";
    chunk_index: number;
  };
}

export interface RetrievalResult {
  text: string;
  score: number;
  metadata: DocumentChunk["metadata"];
}

export class VectorStoreService {
  private client: ChromaClient;
  private openaiClient: OpenAI;
  private collections: Map<string, Collection> = new Map();

  // Collection names
  private readonly COLLECTIONS = {
    JOB_DESCRIPTIONS: "job_descriptions",
    CASE_STUDY: "case_study_brief",
    CV_RUBRIC: "cv_scoring_rubric",
    PROJECT_RUBRIC: "project_scoring_rubric",
  };

  constructor() {
    // Initialize ChromaDB client (requires server running on http://localhost:8000)
    this.client = new ChromaClient({
      path: process.env.CHROMA_PATH || "http://localhost:8000",
    });

    // Initialize OpenAI client for embeddings
    const clientConfig: any = {
      apiKey: config.ai.apiKey,
    };

    if (config.ai.baseUrl) {
      clientConfig.baseURL = config.ai.baseUrl;
    }

    this.openaiClient = new OpenAI(clientConfig);
  }

  /**
   * Initialize all collections
   */
  async initialize(): Promise<void> {
    try {
      console.log("🔧 Initializing vector store collections...");

      // Get or create collections with custom embedding function
      for (const [key, name] of Object.entries(this.COLLECTIONS)) {
        const collection = await this.client.getOrCreateCollection({
          name,
          metadata: { description: `Collection for ${key}` },
          embeddingFunction: {
            generate: async (texts: string[]) => {
              // Generate embeddings for all texts using our embedding method
              const embeddings = await Promise.all(
                texts.map((text) => this.generateEmbedding(text)),
              );
              return embeddings;
            },
          },
        });
        this.collections.set(name, collection);
        console.log(`✅ Collection "${name}" ready`);
      }

      console.log("✅ Vector store initialized");
    } catch (error) {
      console.error("❌ Failed to initialize vector store:", error);
      throw new AppError("Vector store initialization failed", 500);
    }
  }

  /**
   * Generate embeddings for text using OpenAI/Zhipu
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Use appropriate embedding model based on provider
      const embeddingModel =
        config.ai.provider === "zhipu"
          ? "embedding-2"
          : "text-embedding-3-small";

      const response = await this.openaiClient.embeddings.create({
        model: embeddingModel,
        input: text,
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error("❌ Embedding generation failed:", error);
      throw new AppError("Failed to generate embeddings", 500);
    }
  }

  /**
   * Add documents to a collection
   */
  async addDocuments(
    collectionName: string,
    chunks: DocumentChunk[],
  ): Promise<void> {
    try {
      const collection = this.collections.get(collectionName);
      if (!collection) {
        throw new AppError(`Collection ${collectionName} not found`, 404);
      }

      console.log(`📝 Adding ${chunks.length} chunks to ${collectionName}...`);

      // Generate embeddings for all chunks
      const embeddings: number[][] = [];
      for (const chunk of chunks) {
        const embedding = await this.generateEmbedding(chunk.text);
        embeddings.push(embedding);
      }

      // Add to collection
      await collection.add({
        ids: chunks.map((c) => c.id),
        embeddings,
        documents: chunks.map((c) => c.text),
        metadatas: chunks.map((c) => c.metadata as any),
      });

      console.log(`✅ Added ${chunks.length} chunks to ${collectionName}`);
    } catch (error) {
      console.error(`❌ Failed to add documents to ${collectionName}:`, error);
      throw error instanceof AppError
        ? error
        : new AppError("Failed to add documents to vector store", 500);
    }
  }

  /**
   * Query a collection for relevant documents
   */
  async query(
    collectionName: string,
    queryText: string,
    topK: number = 3,
  ): Promise<RetrievalResult[]> {
    try {
      const collection = this.collections.get(collectionName);
      if (!collection) {
        throw new AppError(`Collection ${collectionName} not found`, 404);
      }

      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(queryText);

      // Query collection
      const results = await collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: topK,
      });

      // Format results
      const retrievalResults: RetrievalResult[] = [];

      if (results.documents && results.documents[0]) {
        for (let i = 0; i < results.documents[0].length; i++) {
          const document = results.documents[0][i];
          const distance = results.distances?.[0]?.[i] || 1;
          const metadata = results.metadatas?.[0]?.[
            i
          ] as DocumentChunk["metadata"];

          // Convert distance to similarity score (lower distance = higher similarity)
          const score = 1 - Math.min(distance, 1);

          if (document && metadata) {
            retrievalResults.push({
              text: document,
              score,
              metadata,
            });
          }
        }
      }

      return retrievalResults;
    } catch (error) {
      console.error(`❌ Query failed for ${collectionName}:`, error);
      throw error instanceof AppError
        ? error
        : new AppError("Vector store query failed", 500);
    }
  }

  /**
   * Retrieve job description context for CV evaluation
   */
  async getJobDescriptionContext(
    jobTitle: string,
    topK: number = 3,
  ): Promise<string> {
    const queryText = `Job requirements and responsibilities for ${jobTitle} position`;
    const results = await this.query(
      this.COLLECTIONS.JOB_DESCRIPTIONS,
      queryText,
      topK,
    );

    return results
      .filter((r) => r.score > 0.5) // Only include relevant results
      .map((r) => r.text)
      .join("\n\n");
  }

  /**
   * Retrieve case study brief context for project evaluation
   */
  async getCaseStudyContext(topK: number = 3): Promise<string> {
    const queryText =
      "Case study requirements, deliverables, and evaluation criteria";
    const results = await this.query(
      this.COLLECTIONS.CASE_STUDY,
      queryText,
      topK,
    );

    return results
      .filter((r) => r.score > 0.5)
      .map((r) => r.text)
      .join("\n\n");
  }

  /**
   * Retrieve CV scoring rubric context
   */
  async getCVRubricContext(topK: number = 2): Promise<string> {
    const queryText = "CV evaluation parameters, scoring criteria, and weights";
    const results = await this.query(
      this.COLLECTIONS.CV_RUBRIC,
      queryText,
      topK,
    );

    return results
      .filter((r) => r.score > 0.5)
      .map((r) => r.text)
      .join("\n\n");
  }

  /**
   * Retrieve project scoring rubric context
   */
  async getProjectRubricContext(topK: number = 2): Promise<string> {
    const queryText =
      "Project evaluation parameters, scoring criteria, and weights";
    const results = await this.query(
      this.COLLECTIONS.PROJECT_RUBRIC,
      queryText,
      topK,
    );

    return results
      .filter((r) => r.score > 0.5)
      .map((r) => r.text)
      .join("\n\n");
  }

  /**
   * Clear all documents from a collection
   */
  async clearCollection(collectionName: string): Promise<void> {
    try {
      await this.client.deleteCollection({ name: collectionName });
      const collection = await this.client.createCollection({
        name: collectionName,
      });
      this.collections.set(collectionName, collection);
      console.log(`🗑️ Cleared collection: ${collectionName}`);
    } catch (error) {
      console.error(`❌ Failed to clear collection ${collectionName}:`, error);
      throw new AppError("Failed to clear collection", 500);
    }
  }

  /**
   * Get collection names
   */
  getCollectionNames() {
    return this.COLLECTIONS;
  }
}

// Singleton instance
let vectorStoreInstance: VectorStoreService | null = null;

export function getVectorStore(): VectorStoreService {
  if (!vectorStoreInstance) {
    vectorStoreInstance = new VectorStoreService();
  }
  return vectorStoreInstance;
}
