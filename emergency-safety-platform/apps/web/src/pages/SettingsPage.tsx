import { useEffect, useState, type FormEvent } from "react";
import type { EmergencyKeywordDTO } from "@esp/types";
import { apiClient } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.js";

export function SettingsPage() {
  const { user } = useAuth();
  const [keyword, setKeyword] = useState<EmergencyKeywordDTO | null>(null);
  const [keywordInput, setKeywordInput] = useState("HELP");
  const [testPhrase, setTestPhrase] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [savedProfile, setSavedProfile] = useState(false);

  async function refreshKeyword() {
    const res = await apiClient.get<EmergencyKeywordDTO | null>("/keywords");
    setKeyword(res.data);
    if (res.data) setKeywordInput(res.data.keyword);
  }

  useEffect(() => {
    refreshKeyword();
  }, []);

  async function onSaveKeyword(e: FormEvent) {
    e.preventDefault();
    await apiClient.put("/keywords", { keyword: keywordInput, enabled: keyword?.enabled ?? true });
    await refreshKeyword();
  }

  async function toggleKeyword() {
    await apiClient.patch("/keywords/enabled", { enabled: !(keyword?.enabled ?? true) });
    await refreshKeyword();
  }

  async function deleteKeyword() {
    await apiClient.delete("/keywords");
    setKeyword(null);
  }

  async function onTest(e: FormEvent) {
    e.preventDefault();
    const res = await apiClient.post("/keywords/test", { phrase: testPhrase });
    setTestResult(res.data.matched ? "Match — this phrase would activate an emergency." : "No match.");
  }

  async function onSaveProfile(e: FormEvent) {
    e.preventDefault();
    await apiClient.patch("/users/me", { fullName, phone });
    setSavedProfile(true);
    setTimeout(() => setSavedProfile(false), 2000);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="card">
        <h2 className="mb-1 text-lg font-bold">Emergency Keyword</h2>
        <p className="mb-4 text-sm text-slate-500">
          Detecting this phrase depends on operating-system microphone/always-listening permissions on a real device. This
          prototype provides a manual test and a Demo Mode "Simulate Keyword Detection" trigger instead of always-on listening.
        </p>
        <form className="mb-4 flex gap-2" onSubmit={onSaveKeyword}>
          <input className="input" value={keywordInput} onChange={(e) => setKeywordInput(e.target.value)} maxLength={40} required />
          <button className="btn-primary">Save</button>
        </form>
        {keyword && (
          <div className="mb-4 flex items-center gap-2">
            <span className={`badge ${keyword.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>
              {keyword.enabled ? "Enabled" : "Disabled"}
            </span>
            <button className="btn-outline" onClick={toggleKeyword}>
              {keyword.enabled ? "Disable" : "Enable"}
            </button>
            <button className="btn-outline text-emergency-600" onClick={deleteKeyword}>
              Delete
            </button>
          </div>
        )}
        <form className="flex gap-2" onSubmit={onTest}>
          <input className="input" placeholder="Type a phrase to test…" value={testPhrase} onChange={(e) => setTestPhrase(e.target.value)} />
          <button className="btn-outline">Test</button>
        </form>
        {testResult && <p className="mt-2 text-sm text-slate-600">{testResult}</p>}
      </section>

      <section className="card h-fit">
        <h2 className="mb-3 text-lg font-bold">Profile</h2>
        <form className="space-y-3" onSubmit={onSaveProfile}>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Full name</label>
            <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Phone</label>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Email</label>
            <input className="input bg-slate-100" value={user?.email ?? ""} disabled />
          </div>
          <button className="btn-primary">{savedProfile ? "Saved ✓" : "Save profile"}</button>
        </form>
      </section>
    </div>
  );
}
