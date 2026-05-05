export async function callClaudeAdapter(
  apiKey: string,
  model: string,
  messages: any[],
  stream: boolean,
  rest: any
): Promise<Response> {
  // Convert OpenAI messages to Anthropic messages
  let system = ''
  const anthropicMessages = messages.filter(m => {
    if (m.role === 'system') {
      system = m.content
      return false
    }
    return true
  }).map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content
  }))

  const body = {
    model: model === 'claude-3-5-sonnet-20241022' ? 'claude-3-5-sonnet-20241022' : 'claude-3-5-haiku-20241022',
    messages: anthropicMessages,
    system: system || undefined,
    max_tokens: rest.max_tokens || 4096,
    temperature: rest.temperature,
    stream: stream
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(body)
  })

  if (!res.ok) {
    return res
  }

  if (stream) {
    // Transform Anthropic SSE to OpenAI SSE
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()
    const transformStream = new TransformStream({
      transform(chunk, controller) {
        const text = decoder.decode(chunk)
        const lines = text.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.type === 'content_block_delta' && data.delta?.text) {
                const out = {
                  choices: [{ delta: { content: data.delta.text } }]
                }
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(out)}\n\n`))
              } else if (data.type === 'message_stop') {
                controller.enqueue(encoder.encode(`data: [DONE]\n\n`))
              } else if (data.type === 'message_delta' && data.usage) {
                const out = {
                  usage: { completion_tokens: data.usage.output_tokens }
                }
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(out)}\n\n`))
              }
            } catch (e) {}
          }
        }
      }
    })
    return new Response(res.body!.pipeThrough(transformStream), {
      headers: { 'Content-Type': 'text/event-stream' }
    })
  } else {
    // Normalize response
    const data = await res.json()
    const text = data.content.map((c: any) => c.text).join('')
    const output = {
      choices: [{ message: { content: text }, finish_reason: data.stop_reason }],
      usage: {
        prompt_tokens: data.usage.input_tokens,
        completion_tokens: data.usage.output_tokens,
        total_tokens: data.usage.input_tokens + data.usage.output_tokens
      }
    }
    return new Response(JSON.stringify(output), {
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
