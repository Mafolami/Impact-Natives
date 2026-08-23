import { supabase } from "@/lib/supabase";

export interface ProofPoint {
  id: string;
  indicator_id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export async function fetchProofPoints(indicatorId: string): Promise<ProofPoint[]> {
  const { data, error } = await supabase
    .from("indicator_proof_points")
    .select("*")
    .eq("indicator_id", indicatorId)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data as ProofPoint[];
}

export async function createProofPoint(
  indicatorId: string,
  input: { name: string; description: string | null }
): Promise<ProofPoint | null> {
  const { data, error } = await supabase
    .from("indicator_proof_points")
    .insert({ indicator_id: indicatorId, name: input.name, description: input.description })
    .select()
    .single();
  if (error || !data) return null;
  return data as ProofPoint;
}

export async function deleteProofPoint(id: string): Promise<boolean> {
  const { error } = await supabase.from("indicator_proof_points").delete().eq("id", id);
  return !error;
}
