import { MODEL_CONFIG } from '../models/config'

export type Provider = 'openai' | 'claude'

export function detectProvider(apiKey: string): Provider {
  if (apiKey.startsWith('sk-ant-')) {
    return 'claude'
  }
  return 'openai'
}
