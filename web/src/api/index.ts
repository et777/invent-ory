import type { InventoryApi } from './client'
import { HttpInventoryApi } from './client'
import { MockInventoryApi } from './mockClient'

const useMock = (import.meta.env.VITE_USE_MOCK as string | undefined) !== 'false'

export const api: InventoryApi = useMock ? new MockInventoryApi() : new HttpInventoryApi()

export * from './types'
export * from './client'
