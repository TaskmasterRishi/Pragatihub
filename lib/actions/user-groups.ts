import { supabase } from "@/lib/Supabase";

export type JoinUserGroupInput = {
  userId: string;
  groupId: string;
};

export async function isUserInGroup(input: JoinUserGroupInput) {
  const { data, error } = await supabase
    .from("user_groups")
    .select("user_id, group_id")
    .eq("user_id", input.userId)
    .eq("group_id", input.groupId)
    .maybeSingle();

  return { data, error };
}

export async function joinUserGroup(input: JoinUserGroupInput) {
  const { data, error } = await supabase
    .from("user_groups")
    .insert({
      user_id: input.userId,
      group_id: input.groupId,
    })
    .select()
    .single();

  return { data, error };
}
