import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { config } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(__dirname, 'transcribe_whisper.py');

export interface WhisperWord {
  start: number;
  end: number;
  text: string;
  confidence: number;
}

export interface WhisperSegment {
  start: number;
  end: number;
  text: string;
  words: WhisperWord[];
}

export interface WhisperResult {
  language: string;
  segments: WhisperSegment[];
}

export async function transcribe(audioPath: string): Promise<WhisperResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(config.pythonBin, [
      SCRIPT,
      audioPath,
      config.whisperModel,
      config.whisperDevice,
      config.whisperComputeType,
      config.whisperLanguage,
    ]);

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`whisper exited ${code}: ${stderr.slice(-500) || stdout.slice(-500)}`));
      }
      try {
        const parsed = JSON.parse(stdout.trim()) as WhisperResult & { error?: string };
        if (parsed.error) return reject(new Error(parsed.error));
        resolve({ language: parsed.language, segments: parsed.segments ?? [] });
      } catch (e) {
        reject(new Error(`whisper output parse failed: ${(e as Error).message}`));
      }
    });
  });
}
