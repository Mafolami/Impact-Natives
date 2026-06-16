import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables.')
}

const globalKey = '__supabase_client__'
const globalStore = globalThis as Record<string, unknown>

export const supabase: SupabaseClient =
  (globalStore[globalKey] as SupabaseClient) ??
  (() => {
    const client = createClient(supabaseUrl, supabaseAnonKey)
    globalStore[globalKey] = client
    return client
  })()