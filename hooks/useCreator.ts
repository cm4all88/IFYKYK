"use client";
import { createClient } from "@/lib/supabase-client";
import { useEffect, useState } from "react";
import type { Database } from "@/lib/database.types";

type Creator = Database["public"]["Tables"]["creator_profiles"]["Row"];

export function useCreator(handle: string) {
  const [creator, setCreator] = useState<Creator | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function fetchCreator() {
      setLoading(true);
      const { data, error } = await supabase
        .from("creator_profiles")
        .select("*")
        .eq("handle", handle)
        .single();

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
