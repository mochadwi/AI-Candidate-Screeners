# AI Candidate Screeners

An AI-powered backend service for evaluating CVs and project reports using OpenAI's language models.

## Features

- PDF file upload and validation
- AI-powered CV and project evaluation
- Asynchronous job processing
- RESTful API design
- Type-safe TypeScript implementation
- Modular architecture for easy extension

## Technology Stack

- **Backend:** Node.js, TypeScript, Express.js
- **AI Integration:** OpenAI API
- **File Processing:** Multer, pdf-parse
- **Security:** Helmet, CORS
- **Logging:** Morgan

## Quick Start

### Prerequisites

- Node.js 18+
- OpenAI API key

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your OpenAI API key
   ```

4. Start the development server:
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
- `npm run lint` - Run ESLint

## License

ISC
