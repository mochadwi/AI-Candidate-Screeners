# AI Candidate Screeners

An AI-powered backend service for evaluating CVs and project reports using OpenAI's language models.

## Features

- PDF file upload and validation
- AI-powered CV and project evaluation with LLM chaining
- RAG (Retrieval-Augmented Generation) system with ChromaDB
- Asynchronous job processing
- RESTful API design
- Type-safe TypeScript implementation
- Modular architecture for easy extension
- Comprehensive validation and error handling

## Technology Stack

- **Backend:** Node.js, TypeScript, Express.js
- **AI Integration:** OpenAI API, Zhipu AI
- **Vector Database:** ChromaDB for RAG system
- **File Processing:** Multer, pdf-parse
- **Security:** Helmet, CORS
- **Logging:** Morgan

## Quick Start

### Prerequisites

- Node.js 18+
- Docker and Docker Compose (for ChromaDB)
- OpenAI API key or Zhipu AI API key

### Installation

1. Clone the repository

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your AI API key
   ```

4. Start ChromaDB server:
   ```bash
   # Option 1: Using Docker Compose (recommended)
   docker-compose up -d
   
   # Option 2: Using Docker directly
   docker run -d -p 8000:8000 -v ./chroma_data:/chroma/chroma chromadb/chroma:latest
   ```

5. Ingest ground truth documents into ChromaDB:
   ```bash
   npm run ingest
   ```

6. Start the development server:
   ```bash
   npm run dev
   ```

## API Endpoints

- `GET /health` - Health check
- `POST /upload` - Upload CV and project PDFs
- `POST /evaluate` - Create evaluation job
- `GET /result/:id` - Get evaluation results

## Project Structure

```
src/
├── config/         # Configuration management
├── middleware/     # Express middleware
├── models/         # TypeScript interfaces
├── routes/         # API route handlers
├── services/       # Business logic layer
└── utils/          # Utility functions
```

## Development Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run ingest` - Ingest ground truth documents into ChromaDB
- `npm run ingest:clear` - Clear and re-ingest all documents
- `npm run lint` - Run ESLint
- `npm test` - Run tests

## ChromaDB Management

**Start ChromaDB:**
```bash
docker-compose up -d
```

**Stop ChromaDB:**
```bash
docker-compose down
```

**View ChromaDB logs:**
```bash
docker-compose logs -f chromadb
```

**Clear ChromaDB data:**
```bash
# Stop the container first
docker-compose down
# Remove data
rm -rf chroma_data/
# Start again
docker-compose up -d
# Re-ingest documents
npm run ingest
```

## License

ISC
