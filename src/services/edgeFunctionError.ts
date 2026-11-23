import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js'

export interface ParsedEdgeErrorDetail {
  status?: number
  code?: string
  serverMessage?: string
  isFetchError: boolean
  isRelayError: boolean
}

export async function parseEdgeFunctionError(
  error: unknown,
  logTag: string,
): Promise<ParsedEdgeErrorDetail> {
  if (
    error instanceof FunctionsFetchError ||
    (error instanceof Error && error.name === 'FunctionsFetchError')
  ) {
    console.error(`[${logTag}] Falha de rede ou CORS ao chamar Edge Function:`, error)
    return { isFetchError: true, isRelayError: false }
  }

  if (
    error instanceof FunctionsRelayError ||
    (error instanceof Error && error.name === 'FunctionsRelayError')
  ) {
    const relayRes = (error as { context?: unknown }).context
    const status = relayRes instanceof Response ? relayRes.status : undefined
    console.error(`[${logTag}] Erro no relay do Supabase:`, status, error)
    return { status, isFetchError: false, isRelayError: true }
  }

  const rawContext = (error as { context?: unknown } | null)?.context
  if (error instanceof FunctionsHttpError || rawContext instanceof Response) {
    const response = rawContext as Response
    const status = response.status
    let rawText = ''
    let serverMessage = ''
    let code = ''

    try {
      rawText = await response.clone().text()
      if (rawText) {
        const parsed = JSON.parse(rawText) as {
          error?: unknown
          message?: unknown
          code?: unknown
        }
        if (typeof parsed.error === 'string' && parsed.error.trim()) {
          serverMessage = parsed.error.trim()
        } else if (typeof parsed.message === 'string' && parsed.message.trim()) {
          serverMessage = parsed.message.trim()
        }
        if (typeof parsed.code === 'string' && parsed.code.trim()) {
          code = parsed.code.trim()
        }
      }
    } catch {
      if (rawText && !rawText.trim().startsWith('<')) {
        serverMessage = rawText.trim().slice(0, 240)
      }
    }

    console.error(`[${logTag}] Edge Function retornou HTTP`, status, {
      code: code || undefined,
      detail: serverMessage || rawText || (error instanceof Error ? error.message : undefined),
    })

    return {
      status,
      code: code || undefined,
      serverMessage: serverMessage || undefined,
      isFetchError: false,
      isRelayError: false,
    }
  }

  console.error(`[${logTag}] Erro inesperado:`, error)
  return {
    serverMessage: error instanceof Error && error.message ? error.message : undefined,
    isFetchError: false,
    isRelayError: false,
  }
}
