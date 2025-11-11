# RAG Implementation Guide

## Overview

This project implements **Retrieval-Augmented Generation (RAG)** to enhance CV and project evaluations by retrieving relevant context from ground truth documents stored in a vector database.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Evaluation Request                        │
│              (CV, Project, Job Title)                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Vector Store (ChromaDB)                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Collections:                                         │  │
│  │  • job_descriptions    (Job requirements)            │  │
│  │  • case_study_brief    (Project requirements)        │  │
│  │  • cv_scoring_rubric   (CV evaluation criteria)      │  │
│  │  • project_scoring_rubric (Project criteria)         │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Context Retrieval (Parallel)                    │
│  1. Query job requirements for CV evaluation                │
│  2. Query case study requirements for project evaluation    │
│  3. Query CV rubric for scoring criteria                    │
│  4. Query project rubric for scoring criteria               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Prompt Construction                             │
│  • Inject retrieved job context                             │
│  • Inject retrieved case study context                      │
│  • Inject CV and project content                            │
│  • Include hardcoded rubric details                         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              LLM Evaluation                                  │
│  • Evaluate CV against retrieved job requirements           │
│  • Evaluate project against case study requirements         │
│  • Apply scoring rubric                                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Structured Evaluation Result                    │
│  • CV scores + match rate                                   │
│  • Project scores                                           │
│  • Detailed feedback                                        │
│  • Overall summary                                          │
└─────────────────────────────────────────────────────────────┘
```

## Ground Truth Documents

### Directory Structure

```
ground-truth/
├── job-descriptions/
│   └── backend-product-engineer-2025.md    # Job requirements
├── case-study-brief.md                     # Project requirements
└── rubrics/
    ├── cv-scoring-rubric.md                # CV evaluation criteria
    └── project-scoring-rubric.md           # Project evaluation criteria
```

### Document Types

1. **Job Descriptions** (`job-descriptions/`)
   - Contains role requirements, responsibilities, and required skills
   - Used for CV evaluation context
   - Multiple job descriptions can be added

2. **Case Study Brief** (`case-study-brief.md`)
   - Contains project requirements, deliverables, and specifications
   - Used for project evaluation context

3. **CV Scoring Rubric** (`rubrics/cv-scoring-rubric.md`)
   - Detailed scoring criteria for CV evaluation
   - 4 parameters: Technical Skills, Experience, Achievements, Cultural Fit

4. **Project Scoring Rubric** (`rubrics/project-scoring-rubric.md`)
   - Detailed scoring criteria for project evaluation
   - 5 parameters: Correctness, Code Quality, Resilience, Documentation, Creativity

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

This installs ChromaDB and all required dependencies.

### 2. Prepare Ground Truth Documents

All documents are already in place in the `ground-truth/` directory:
- ✅ Job description
- ✅ Case study brief
- ✅ CV rubric
- ✅ Project rubric

### 3. Ingest Documents into Vector Store

Run the ingestion script to load documents into ChromaDB:

```bash
npm run ingest
```

This will:
1. Initialize ChromaDB collections
2. Split documents into semantic chunks
3. Generate embeddings using your configured AI provider
4. Store chunks in vector database

**Output:**
```
🚀 Starting full document ingestion...

📂 Ingesting job descriptions...
  ✅ Ingested backend-product-engineer-2025.md: 8 chunks
✅ Total job description chunks ingested: 8

📂 Ingesting case study brief...
✅ Case study brief ingested: 15 chunks

📂 Ingesting CV scoring rubric...
✅ CV rubric ingested: 6 chunks

📂 Ingesting project scoring rubric...
✅ Project rubric ingested: 7 chunks

✅ Document ingestion complete!
📊 Summary:
   - Job Descriptions: 8 chunks
   - Case Study Brief: 15 chunks
   - CV Rubric: 6 chunks
   - Project Rubric: 7 chunks
   - Total: 36 chunks
```

### 4. Verify Ingestion

The vector store data is persisted in `chroma_data/` directory (created automatically).

To re-ingest (clears existing data):
```bash
npm run ingest:clear
```

## How RAG Works in Evaluation

### 1. Initialization

When an evaluation request comes in:
```typescript
await vectorStore.initialize();
```

### 2. Context Retrieval (Parallel)

```typescript
const [jobContext, caseStudyContext, cvRubricContext, projectRubricContext] = 
  await Promise.all([
    vectorStore.getJobDescriptionContext(jobTitle),
    vectorStore.getCaseStudyContext(),
    vectorStore.getCVRubricContext(),
    vectorStore.getProjectRubricContext()
  ]);
```

### 3. Prompt Construction

Retrieved context is injected into the evaluation prompt:

```
=== JOB REQUIREMENTS (Ground Truth) ===
[Retrieved relevant sections from job description]

=== CASE STUDY REQUIREMENTS (Ground Truth) ===
[Retrieved relevant sections from case study brief]

=== CANDIDATE CV ===
[Actual CV content]

=== CANDIDATE PROJECT REPORT ===
[Actual project content]

[Detailed rubric with scoring criteria...]
```

### 4. LLM Evaluation

The LLM now has:
- ✅ Actual job requirements to compare CV against
- ✅ Actual case study requirements to evaluate project against
- ✅ Detailed rubric for consistent scoring
- ✅ Candidate materials to evaluate

## Configuration

### Environment Variables

```env
# AI Provider (openai or zhipu)
AI_PROVIDER=zhipu

# API Key (required for embeddings and LLM)
AI_API_KEY=your_api_key_here

# AI Model for LLM
AI_MODEL=glm-4.6

# Base URL (for custom endpoints like Zhipu)
AI_BASE_URL=https://api.z.ai/api/coding/paas/v4/

# ChromaDB Path (optional, defaults to http://localhost:8000)
CHROMA_PATH=http://localhost:8000
```

### Embedding Models

- **Zhipu AI**: Uses `embedding-2` model
- **OpenAI**: Uses `text-embedding-3-small` model

The system automatically selects the appropriate embedding model based on `AI_PROVIDER`.

## Retrieval Strategy

### Chunking

- **Semantic chunking**: Splits by paragraphs/sections
- **Chunk size**: 600-1000 characters
- **Overlap**: 100-200 characters (for context continuity)

### Similarity Search

- **Top-k**: Returns 2-3 most relevant chunks per query
- **Similarity threshold**: 0.5 (filters out irrelevant results)
- **Distance metric**: Cosine similarity (via embeddings)

### Query Types

1. **Job Description Query**:
   ```
   "Job requirements and responsibilities for {jobTitle} position"
   ```

2. **Case Study Query**:
   ```
   "Case study requirements, deliverables, and evaluation criteria"
   ```

3. **Rubric Queries**:
   ```
   "CV/Project evaluation parameters, scoring criteria, and weights"
   ```

## Benefits of RAG Implementation

### 1. **Context-Aware Evaluation**
- CV evaluated against **actual** job requirements
- Project evaluated against **actual** case study specs
- Not generic evaluation anymore

### 2. **Consistency**
- Same rubric applied to all candidates
- Retrieved from ground truth, not hallucinated

### 3. **Flexibility**
- Add new job descriptions without code changes
- Update case study requirements easily
- Modify rubrics as needed

### 4. **Transparency**
- Clear what criteria are being used
- Ground truth documents are version-controlled
- Auditable evaluation process

### 5. **Scalability**
- Handle multiple job roles
- Support different case study versions
- Easy to expand

## Troubleshooting

### Issue: "Vector store initialization failed"

**Solution**: Ensure ChromaDB is accessible
```bash
# If using local ChromaDB server
docker run -p 8000:8000 chromadb/chroma
```

Or set `CHROMA_PATH` to in-memory mode by not setting it.

### Issue: "Embedding generation failed"

**Solution**: Check AI_API_KEY is valid
```bash
# Test with a simple curl
curl -H "Authorization: Bearer $AI_API_KEY" \
  https://api.openai.com/v1/models
```

### Issue: "No context retrieved"

**Solution**: Re-run ingestion
```bash
npm run ingest:clear
```

### Issue: "Low relevance scores"

**Solution**: Documents might not match queries well
- Review query strings in `vectorStoreService.ts`
- Adjust chunk sizes in `documentIngestionService.ts`
- Add more specific content to ground truth documents

## File Reference

### Core Services

- `src/services/vectorStoreService.ts` - Vector DB operations
- `src/services/documentIngestionService.ts` - Document processing
- `src/services/aiService.ts` - RAG-enhanced evaluation
- `ground-truth/ingest.ts` - Ingestion script

### Ground Truth

- `ground-truth/job-descriptions/` - Job requirements
- `ground-truth/case-study-brief.md` - Project requirements
- `ground-truth/rubrics/` - Scoring criteria

## Testing RAG

### 1. Run Ingestion
```bash
npm run ingest
```

### 2. Start Server
```bash
npm run dev
```

### 3. Test Evaluation
```bash
curl -X POST http://localhost:3000/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "job_title": "Backend Product Engineer",
    "cv_file_id": "...",
    "project_file_id": "..."
  }'
```

### 4. Check Logs

You should see:
```
🔍 Retrieving context from vector store...
✅ Context retrieved successfully
🤖 Starting AI evaluation...
```

## Next Steps

1. ✅ **Add more job descriptions** - Support multiple roles
2. ✅ **Version control rubrics** - Track scoring changes
3. ✅ **Monitor retrieval quality** - Log similarity scores
4. ✅ **Optimize chunk sizes** - Test different strategies
5. ✅ **Add analytics** - Track which context is most useful

## References

- [ChromaDB Documentation](https://docs.trychroma.com/)
- [RAG Best Practices](https://www.anthropic.com/index/contextual-retrieval)
- [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings)
