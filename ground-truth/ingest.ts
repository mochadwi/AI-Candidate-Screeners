#!/usr/bin/env ts-node

/**
 * Document Ingestion Script
 *
 * This script ingests all ground truth documents into the vector database.
 * Run this script once to populate the vector store with:
 * - Job descriptions
 * - Case study brief
 * - CV scoring rubric
 * - Project scoring rubric
 *
 * Usage:
 *   npm run ingest
 *   or
 *   npx ts-node ground-truth/ingest.ts
 */

import dotenv from 'dotenv';
import path from 'path';
import { getDocumentIngestionService } from '../src/services/documentIngestionService';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║     Ground Truth Document Ingestion Script                ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  try {
    // Check if AI API key is configured
    if (!process.env.AI_API_KEY) {
      console.error('❌ ERROR: AI_API_KEY not found in environment variables');
      console.error('   Please set AI_API_KEY in your .env file\n');
      process.exit(1);
    }

    console.log('⚙️  Configuration:');
    console.log(`   AI Provider: ${process.env.AI_PROVIDER || 'openai'}`);
    console.log(`   AI Model: ${process.env.AI_MODEL || 'gpt-3.5-turbo'}`);
    console.log(`   Ground Truth Path: ${path.join(process.cwd(), 'ground-truth')}\n`);

    // Get ingestion service
    const ingestionService = getDocumentIngestionService();

    // Check if already ingested
    const isIngested = await ingestionService.isIngested();
    if (isIngested) {
      console.log('⚠️  Warning: Documents appear to be already ingested.');
      console.log('   This will add duplicates. Consider clearing collections first.\n');
    }

    // Start ingestion
    const startTime = Date.now();
    const result = await ingestionService.ingestAll();
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║                  Ingestion Complete! 🎉                    ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');
    console.log(`⏱️  Total time: ${duration}s`);
    console.log(`📦 Total chunks: ${result.total}\n`);
    console.log('✅ The vector store is now ready for RAG-enhanced evaluations!\n');

    process.exit(0);
  } catch (error) {
    console.error('\n╔═══════════════════════════════════════════════════════════╗');
    console.error('║                  Ingestion Failed! ❌                      ║');
    console.error('╚═══════════════════════════════════════════════════════════╝\n');
    console.error('Error details:', error);
    console.error('\nPlease check:');
    console.error('  1. AI_API_KEY is set correctly in .env');
    console.error('  2. All ground truth documents exist in ground-truth/ directory');
    console.error('  3. ChromaDB is accessible (if using external instance)\n');
    process.exit(1);
  }
}

// Run the script
main();
