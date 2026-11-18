import type {SupabaseClient} from '@supabase/supabase-js';

// A failed network/auth request is not a successful "no user" response.
export async function verifiedWorkspaceUser(auth: SupabaseClient['auth']) {
 const {data, error} = await auth.getUser();
 if (error) throw error;
 return data.user;
}

// Focus, realtime and token refresh can arrive together. Share the request, and
// discard results started before an explicit sign-out or account change.
export function createWorkspaceRefreshGate() {
 let generation = 0;
 let pending: Promise<void> | null = null;
 return {
  invalidate() { generation++; pending = null; },
  run(action: (isCurrent: () => boolean) => Promise<void>, fresh = false): Promise<void> {
   if (pending) return fresh ? pending.then(() => this.run(action), () => this.run(action)) : pending;
   const started = generation;
   const job = Promise.resolve().then(() => action(() => generation === started))
    .finally(() => { if (pending === job) pending = null; });
   pending = job;
   return job;
  },
 };
}
