import { Database } from "@/types/database.types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

type AccessTokenProvider = () => Promise<string | null>;

let accessTokenProvider: AccessTokenProvider | null = null;

export function setSupabaseAccessTokenProvider(
  provider: AccessTokenProvider | null,
) {
  accessTokenProvider = provider;
}

export async function getSupabaseAccessToken() {
  if (!accessTokenProvider) return null;
  try {
    return await accessTokenProvider();
  } catch {
    return null;
  }
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  accessToken: getSupabaseAccessToken,
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
