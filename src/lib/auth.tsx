import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async (u: User | null) => {
      if (!active) return;
      setUser(u);
      if (u) {
        const email = (u.email || "").toLowerCase();
        const isAdminEmail =
          email === "rafael22esteves@gmail.com" || email.endsWith("@elizalingerie.com.br");

        try {
          const { data } = await supabase.rpc("has_role", { _user_id: u.id, _role: "admin" });
          if (active) setIsAdmin(Boolean(data) || isAdminEmail);
        } catch {
          if (active) setIsAdmin(isAdminEmail);
        }
      } else setIsAdmin(false);
      if (active) setLoading(false);
    };
    supabase.auth.getUser().then(({ data }) => load(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED")
        load(session?.user ?? null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, isAdmin, loading };
}
