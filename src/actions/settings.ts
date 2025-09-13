'use server';

import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Saves the Gemini API key to a local .env file.
 * NOTE: This is only suitable for a local development environment.
 * In production, environment variables should be managed securely by the hosting provider.
 */
export async function saveApiKey(apiKey: string) {
  if (!apiKey || typeof apiKey !== 'string') {
    throw new Error('Invalid API key provided.');
  }

  try {
    const envFilePath = path.resolve(process.cwd(), '.env');
    
    let envFileContent = '';
    try {
      envFileContent = await fs.readFile(envFilePath, 'utf-8');
    } catch (e: any) {
      if (e.code !== 'ENOENT') {
        throw e; // Rethrow if it's not a "file not found" error
      }
      // If file does not exist, we'll create it.
    }

    const lines = envFileContent.split('\n');
    let keyFound = false;
    const newLines = lines.map((line) => {
      if (line.startsWith('GEMINI_API_KEY=')) {
        keyFound = true;
        return `GEMINI_API_KEY=${apiKey}`;
      }
      return line;
    });

    if (!keyFound) {
      newLines.push(`GEMINI_API_KEY=${apiKey}`);
    }

    await fs.writeFile(envFilePath, newLines.join('\n'), 'utf-8');

    return { success: true, message: 'API key saved.' };
  } catch (error) {
    console.error('Failed to save API key:', error);
    throw new Error('Could not save API key to .env file on the server.');
  }
}

    