const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');
const fs = require('fs');

const envLocal = fs.readFileSync('.env.local', 'utf8');
const envVars = {};
for (const line of envLocal.split('\n')) {
  if (line && line.includes('=') && !line.startsWith('#')) {
    const [k, v] = line.split('=');
    envVars[k.trim()] = v.trim();
  }
}

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(envVars.ENCRYPTION_KEY, 'hex');

function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

async function run() {
  const userId = 'f280b947-1788-4d11-a795-b37593ead4eb'; // from seed
  const openAiKey = envVars.OPENAI_API_KEY;
  if (!openAiKey) {
    console.error('No OpenAI API key');
    return;
  }
  const encryptedKey = encrypt(openAiKey);
  await prisma.user.update({
    where: { id: userId },
    data: { encryptedApiKey: encryptedKey }
  });
  console.log('Key saved!');
}
run();
