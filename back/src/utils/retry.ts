import { logger } from './logger.js'

export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  initialDelay: number = 2000,
  label: string = 'operação'
): Promise<T> {
  let lastError: Error

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      logger.warn(`${label} falhou (tentativa ${attempt}/${maxAttempts}): ${lastError.message}`)
      if (attempt < maxAttempts) {
        const delay = initialDelay * attempt
        logger.info(`Aguardando ${delay}ms antes de tentar novamente...`)
        await new Promise(r => setTimeout(r, delay))
      }
    }
  }

  throw lastError!
}