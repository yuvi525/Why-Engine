import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Try root .env then local .env
const rootEnvPath = path.resolve(process.cwd(), '../../.env');
const localEnvPath = path.resolve(process.cwd(), '.env');

if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
} else if (fs.existsSync(localEnvPath)) {
  dotenv.config({ path: localEnvPath });
}

const IS_DEMO = process.env.DEMO_MODE === 'true';

const req = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION'];
const missing = req.filter(k => !process.env[k]);

if (!IS_DEMO && missing.length > 0) {
  throw new Error(`CRITICAL STARTUP ERROR: Missing required environment variables: ${missing.join(', ')}`);
}

if (!IS_DEMO && !process.env.OPENAI_API_KEY) {
  console.warn('WARN: OPENAI_API_KEY is missing. Fallback to OpenAI will fail.');
}

if (!IS_DEMO && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.warn('WARN: GOOGLE_APPLICATION_CREDENTIALS is missing. Vertex AI primary routing will fail.');
}

export const config = {
  PORT: process.env.PORT || '3001',
  NODE_ENV: process.env.NODE_ENV || 'development',
  DB_PATH: process.env.DB_PATH || './vela.db',
  DEMO_MODE: IS_DEMO,
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || 'demo',
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || 'demo',
  AWS_REGION: process.env.AWS_REGION || 'us-east-1',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  VERTEX_PROJECT: process.env.VERTEX_PROJECT,
  VERTEX_LOCATION: process.env.VERTEX_LOCATION,
  DEFAULT_DAILY_BUDGET_USD: parseFloat(process.env.DEFAULT_DAILY_BUDGET_USD || '5.00'),
};

