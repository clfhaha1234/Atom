// Type declaration for openai module (fallback if types not found)
declare module 'openai' {
  interface ChatCompletionMessageParam {
    role: 'system' | 'user' | 'assistant'
    content: string
  }

  interface ChatCompletionChunk {
    id: string
    choices: Array<{
      delta: { content?: string; role?: string }
      index: number
      finish_reason: string | null
    }>
  }

  interface ChatCompletionChoice {
    message: {
      content: string | null
      role: string
    }
    index: number
    finish_reason: string | null
  }

  interface ChatCompletion {
    id: string
    choices: ChatCompletionChoice[]
    created: number
    model: string
    object: string
  }

  interface Stream<T> extends AsyncIterable<T> {
    [Symbol.asyncIterator](): AsyncIterator<T>
  }

  interface ChatCompletionCreateParams {
    model: string
    messages: ChatCompletionMessageParam[]
    temperature?: number
    max_tokens?: number
    response_format?: { type: string }
    stream?: boolean
  }

  class OpenAI {
    constructor(config: { apiKey?: string; baseURL?: string })
    chat: {
      completions: {
        create(params: ChatCompletionCreateParams & { stream: true }): Promise<Stream<ChatCompletionChunk>>
        create(params: ChatCompletionCreateParams & { stream?: false }): Promise<ChatCompletion>
        create(params: ChatCompletionCreateParams): Promise<ChatCompletion | Stream<ChatCompletionChunk>>
      }
    }
  }

  export default OpenAI
  export { ChatCompletionMessageParam, ChatCompletion, ChatCompletionCreateParams, ChatCompletionChunk, Stream }
}
