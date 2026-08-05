"use client";
import { createClient } from "@/lib/supabase-client";
import { useEffect, useState } from "react";
import type { Database } from "@/lib/database.types";
import { PUBLIC_CREATOR_SELECT } from "@/lib/creator-public";

type Creator = Database["public"]["Tables"]["creator_profiles"]["Row"];

export function useCreator(handle: string) {
  const [creator, setCreator] = useState<Creator | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function fetchCreator() {
      setLoading(true);
      // Public, by-handle lookup from the browser. Reads the safe projection
      // (lib/creator-public.ts), never the base table — `creator_profiles`
      // carries claim_code, IP tracking, date_of_birth, shipping fields and
      // Stripe identifiers, none of which belong in a browser.
      const { data, error } = await (supabase as any)
        .from("creator_public")
        .select(PUBLIC_CREATOR_SELECT)
        .eq("handle", handle)
        .maybeSingle();

      if (error) setError(error.message);
      else setCreator(data);
      setLoading(false);
    }
    if (handle) fetchCreator();
  }, [handle]);

  return { creator, loading, error };
}

export function useCurrentCreator() {
  const [creator, setCreator] = useState<Creator | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function fetchCurrentCreator() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data } = await supabase
        .from("creator_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      setCreator(data);
      setLoading(false);
    }
    fetchCurrentCreator();
  }, []);

  return { creator, loading };
}
