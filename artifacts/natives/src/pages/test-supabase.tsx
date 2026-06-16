import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function Test() {
  useEffect(() => {
    async function run() {
      const { data, error } = await supabase
        .from("organizations")
        .select("*");

      console.log("DATA:", data);
      console.log("ERROR:", error);
    }

    run();
  }, []);

  return <div>Testing Supabase connection...</div>;
}