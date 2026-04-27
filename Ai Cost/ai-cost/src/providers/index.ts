import { providerRegistry } from './registry';
import { OpenAIProvider } from './openai.provider';
import { AnthropicProvider } from './anthropic.provider';
import { BedrockProvider } from './bedrock.provider';

// Initialize instances
const openai = new OpenAIProvider();
const anthropic = new AnthropicProvider();
const bedrock = new BedrockProvider();

// Register at boot
providerRegistry.register(openai, ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo', 'o1-preview']);
providerRegistry.register(anthropic, ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229']);
providerRegistry.register(bedrock, ['amazon.titan-text-express-v1', 'meta.llama3-70b-instruct-v1:0']);

export { providerRegistry, OpenAIProvider, AnthropicProvider, BedrockProvider };
export * from './provider.interface';
