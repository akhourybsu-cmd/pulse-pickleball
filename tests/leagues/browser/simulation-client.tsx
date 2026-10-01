import { createContext, useContext, type ReactNode } from "react";
type Row = Record<string, any>;
let currentUser = "";
const Context = createContext("");
export function QaAuth({
  user,
  children,
}: {
  user: string;
  children: ReactNode;
}) {
  currentUser = user;
  return <Context.Provider value={user}>{children}</Context.Provider>;
}
export const useAuthState = () => ({
  user: { id: useContext(Context) },
  profile: null,
  loading: false,
});
export const isSkillAssessmentEnabled = () => false;
const send = async (action: Row) => {
  const response = await fetch("/__league-sim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...action, user: currentUser }),
  });
  return response.json();
};
export const supabase = {
  auth: {
    getUser: async () => ({ data: { user: { id: currentUser } }, error: null }),
    getSession: async () => ({
      data: { session: { user: { id: currentUser } } },
    }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  },
  rpc: (name: string, args: Row) => send({ kind: "rpc", name, args }),
  functions: {
    invoke: (name: string, { body }: Row) =>
      send({ kind: "function", name, args: body }),
  },
  from: (table: string) => {
    const steps: unknown[] = [];
    let throwErrors = false;
    const query: Row = {};
    for (const method of [
      "select",
      "eq",
      "neq",
      "is",
      "in",
      "not",
      "order",
      "limit",
      "range",
      "or",
      "ilike",
      "single",
      "maybeSingle",
      "insert",
      "update",
      "upsert",
      "delete",
    ])
      query[method] = (...args: unknown[]) => {
        steps.push([method, args]);
        return query;
      };
    query.abortSignal = () => query;
    query.throwOnError = () => {
      throwErrors = true;
      return query;
    };
    query.then = (
      resolve: (value: unknown) => unknown,
      reject: (error: unknown) => unknown
    ) =>
      send({ kind: "query", table, steps })
        .then((result) => {
          if (throwErrors && result.error)
            throw new Error(result.error.message);
          return result;
        })
        .then(resolve, reject);
    return query;
  },
  channel: () => {
    const channel = { on: () => channel, subscribe: () => channel };
    return channel;
  },
  removeChannel: async () => {},
};
