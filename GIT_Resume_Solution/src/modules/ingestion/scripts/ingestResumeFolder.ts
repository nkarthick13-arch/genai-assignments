import fs from 'fs/promises';
import path from 'path';
import mammoth from 'mammoth';
import { getDatabase } from '../../../config/database';
import { AlgorithmResumeParser } from '../services/AlgorithmResumeParser';
import { EmbeddingService } from '../services/EmbeddingService';
import { ResumeParserService } from '../services/ResumeParserService';
import { ResumeIngestionRepository, StoredResumeDocument } from '../repositories/ResumeIngestionRepository';
import { cleanResumeText } from '../utils/textCleaner';

const BATCH_SIZE = 25;
const nonResumeNamePattern = /job\s*description|conditional\s*offer|offer\s*letter|pan\s*card/i;

async function listFiles(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(entryPath) : entry.isFile() ? [entryPath] : [];
  }));

  return nestedFiles.flat();
}

async function extractText(filePath: string): Promise<string> {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.pdf') {
    return new ResumeParserService().extractTextFromPdf(filePath);
  }

  if (extension === '.docx') {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  throw new Error(`Unsupported file type: ${extension || 'no extension'}`);
}

async function main(): Promise<void> {
  const sourceDirectory = path.resolve(process.argv[2] ?? 'Resumes');
  const files = await listFiles(sourceDirectory);
  const supportedFiles = files.filter((filePath) => ['.pdf', '.docx'].includes(path.extname(filePath).toLowerCase()));
  const excludedFiles = supportedFiles.filter((filePath) => nonResumeNamePattern.test(path.basename(filePath)));
  const resumeFiles = supportedFiles.filter((filePath) => !nonResumeNamePattern.test(path.basename(filePath)));
  const repository = new ResumeIngestionRepository();
  const parser = new AlgorithmResumeParser();
  const embeddingService = new EmbeddingService();
  let imported = 0;
  let alreadyStored = 0;
  let failed = 0;
  const failures: Array<{ fileName: string; reason: string }> = [];

  try {
    const database = await repository.connect();
    const existingNames = new Set(
      (await database.collection('resumes')
        .find({ fileName: { $in: resumeFiles.map((filePath) => path.basename(filePath)) } })
        .project<{ fileName: string }>({ fileName: 1 })
        .toArray())
        .map((document) => document.fileName),
    );
    const seenNames = new Set<string>();
    const pending: StoredResumeDocument[] = [];

    for (const [index, filePath] of resumeFiles.entries()) {
      const fileName = path.basename(filePath);
      if (existingNames.has(fileName) || seenNames.has(fileName)) {
        alreadyStored += 1;
        continue;
      }
      seenNames.add(fileName);

      try {
        const rawText = await extractText(filePath);
        const cleanedText = cleanResumeText(rawText);
        if (!cleanedText) {
          throw new Error('No extractable text');
        }

        const resume = parser.parseResume(cleanedText);
        const embedding = embeddingService.generateEmbedding({
          name: resume.name,
          role: resume.role ?? undefined,
          skills: resume.skills,
          company: resume.company ?? undefined,
          rawText: cleanedText,
        });

        pending.push({
          fileName,
          rawText: cleanedText,
          ...resume,
          embedding,
          embeddingModel: 'mistral-embed',
          embeddingDimension: embedding.length,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      } catch (error) {
        failed += 1;
        failures.push({
          fileName,
          reason: error instanceof Error ? error.message : 'Unknown extraction error',
        });
      }

      if (pending.length === BATCH_SIZE || index === resumeFiles.length - 1) {
        if (pending.length > 0) {
          const result = await database.collection('resumes').insertMany(pending, { ordered: false });
          imported += result.insertedCount;
          pending.length = 0;
          console.log(`Imported ${imported} resumes in batches of ${BATCH_SIZE}.`);
        }
      }
    }

    if (pending.length > 0) {
      const result = await database.collection('resumes').insertMany(pending, { ordered: false });
      imported += result.insertedCount;
    }

    console.log(JSON.stringify({
      sourceDirectory,
      totalFiles: files.length,
      imported,
      alreadyStored,
      skippedNonResumeDocuments: excludedFiles.length,
      unsupportedFiles: files.length - supportedFiles.length,
      failed,
      failures,
      collectionCount: await database.collection('resumes').countDocuments(),
    }, null, 2));
  } finally {
    await repository.close();
  }
}

main().catch((error: unknown) => {
  console.error('Resume folder import failed:', error instanceof Error ? error.message : 'Unknown error');
  process.exitCode = 1;
});