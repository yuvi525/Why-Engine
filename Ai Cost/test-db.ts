import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { prisma } from './lib/prisma';
import { encrypt } from './lib/crypto';

async function setupAndTest() {
  const userId = 'f280b947-1788-4d11-a795-b37593ead4eb'; // from seed
  const openAiKey = process.env.OPENAI_API_KEY;

  if (!openAiKey) {
    console.error('OPENAI_API_KEY not found in .env.local');
    return;
  }

  const encryptedKey = encrypt(openAiKey);
  
  await prisma.user.update({
    where: { id: userId },
    data: { encryptedApiKey: encryptedKey }
  });
  console.log('Updated user with encrypted OpenAI API key.');

  // Now test the proxy again
  const apiKey = 'vk_live_afd88338cce342bf927addeba20cd3da'; // from seed
  console.log('\nTesting proxy...');
  const res = await fetch('http://localhost:3000/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Say this is a test' }]
    })
  });
  
  console.log('Status:', res.status);
  const data = await res.json();
  console.log('Response Body:', JSON.stringify(data, null, 2));
}

setupAndTest().catch(console.error);
