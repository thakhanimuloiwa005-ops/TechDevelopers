import { useEffect, useState, type FormEvent } from "react";
import type { TrustedMemberDTO } from "@esp/types";
import { apiClient } from "../api/client.js";

export function TrustedMembersPage() {
  const [members, setMembers] = useState<TrustedMemberDTO[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [relationship, setRelationship] = useState("Friend");
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const res = await apiClient.get<TrustedMemberDTO[]>("/trusted-members");
    setMembers(res.data);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiClient.post("/trusted-members", { name, email, relationship, priority: members.length + 1 });
      setName("");
      setEmail("");
      await refresh();
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(message ?? "Could not add trusted member");
    }
  }

  async function toggleEnabled(member: TrustedMemberDTO) {
    await apiClient.patch(`/trusted-members/${member.id}`, { enabled: !member.enabled });
    await refresh();
  }

  async function remove(member: TrustedMemberDTO) {
    await apiClient.delete(`/trusted-members/${member.id}`);
    await refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <section className="card">
        <h2 className="mb-3 text-lg font-bold">Your Trusted Network</h2>
        {members.length === 0 && <p className="text-sm text-slate-400">No trusted members yet.</p>}
        <ul className="space-y-2">
          {members.map((member) => (
            <li key={member.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
              <div>
                <p className="font-semibold text-slate-800">
                  {member.name} <span className="text-xs font-normal text-slate-400">· {member.relationship}</span>
                </p>
                <p className="text-xs text-slate-500">{member.email}</p>
                <span className={`badge mt-1 ${member.status === "ACCEPTED" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                  {member.status === "ACCEPTED" ? "Linked account" : "Invitation pending"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">priority {member.priority}</span>
                <button className="btn-outline" onClick={() => toggleEnabled(member)}>
                  {member.enabled ? "Disable" : "Enable"}
                </button>
                <button className="btn-outline text-emergency-600" onClick={() => remove(member)}>
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card h-fit">
        <h2 className="mb-3 text-lg font-bold">Add Trusted Member</h2>
        <form className="space-y-3" onSubmit={onAdd}>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <p className="mt-1 text-xs text-slate-400">If this email already has an account, it's linked instantly.</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Relationship</label>
            <input className="input" value={relationship} onChange={(e) => setRelationship(e.target.value)} required />
          </div>
          {error && <p className="text-sm text-emergency-600">{error}</p>}
          <button className="btn-primary w-full">Add trusted member</button>
        </form>
      </section>
    </div>
  );
}
