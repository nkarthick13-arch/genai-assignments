import fs from 'fs';

const { PDFParse } = require('pdf-parse');
const MIN_TEXT_LENGTH = 50;

export class ResumeParserService {
  async extractTextFromPdf(filePath: string): Promise<string> {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const parser = new PDFParse({ data: dataBuffer, verbosity: 0 });
      const parsed = await parser.getText();
      const extractedText = parsed?.text ?? '';

      if (!extractedText.trim()) {
        throw new Error('The uploaded PDF contains no selectable text. Please upload a text-based PDF or enable OCR support.');
      }

      if (extractedText.trim().length < MIN_TEXT_LENGTH) {
        throw new Error('The uploaded PDF appears to be scanned, image-based, or has too little extractable text.');
      }

      await parser.destroy();
      return extractedText;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Resume extraction failed';
      throw new Error(message);
    }
  }
}
