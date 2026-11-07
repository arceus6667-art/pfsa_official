"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { repo, type AppStore, type User } from "@/lib/pfsa-store";
import "./admin-workspace.css";

function useStore() {
  const [store, setStore] = useState<AppStore | null>(null);
  useEffect(() => {
    const sync = () => setStore(repo.read());
    sync();
    window.addEventListener("pfsa-store-changed", sync);
    return () => window.removeEventListener("pfsa-store-changed", sync);
  }, []);
  return [store, () => setStore(repo.read())] as const;
}

export function AdminWorkspace() {
  const router = useRouter();
  const [store, refresh] = useStore();
  const [section, setSection] = useState("Candidates");
  const [domain, setDomain] = useState("");
  const [resourceTitle, setResourceTitle] = useState("");
  const [resourceUrl, setResourceUrl] = useState("");
  const user = typeof window === "undefined" ? null : repo.user();
  const mutate = (action: (state: AppStore) => void) => {
    repo.adminUpdate(action);
    refresh();
  };
  if (!user || user.role !== "admin")
    return (
      <main className="workspace-guard">
        <h1>Administrator access required</h1>
        <a href="/admin/login">Go to staff login</a>
      </main>
    );
  const candidates =
    store?.users.filter((item) => item.role === "student") ?? [];
  const domains = store?.programmes.map((item) => item.title) ?? [];
  const addResource = () => {
    if (!domain || !resourceTitle.trim()) return;
    mutate((state) =>
      state.resources.push({
        id: `resource-${Date.now()}`,
        domain,
        title: resourceTitle.trim(),
        type: resourceUrl ? "Link" : "PDF",
        url: resourceUrl || "#",
        uploadedAt: new Date().toISOString(),
      }),
    );
    setResourceTitle("");
    setResourceUrl("");
  };
  return (
    <main className="admin-workspace">
      <header>
        <div>
          <p>ADMIN DASHBOARD</p>
          <h1>Controlled academy workspace</h1>
        </div>
        <button
          onClick={() => {
            repo.setSession(null);
            router.push("/");
          }}
        >
          Sign out
        </button>
      </header>
      <nav>
        {["Candidates", "Resources", "Submissions", "Documents"].map((item) => (
          <button
            key={item}
            onClick={() => setSection(item)}
            className={section === item ? "active" : ""}
          >
            {item}
          </button>
        ))}
      </nav>
      <div className="admin-content">
        {section === "Candidates" && (
          <Candidates candidates={candidates} store={store} mutate={mutate} />
        )}
        {section === "Resources" && (
          <section className="admin-card">
            <h2>Domain resources</h2>
            <p>
              Choose one of the six internship domains and publish a link or
              uploaded resource title for enrolled students.
            </p>
            <div className="admin-form">
              <select
                value={domain}
                onChange={(event) => setDomain(event.target.value)}
              >
                <option value="">Select domain</option>
                {domains.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
              <input
                value={resourceTitle}
                onChange={(event) => setResourceTitle(event.target.value)}
                placeholder="Resource title"
              />
              <input
                value={resourceUrl}
                onChange={(event) => setResourceUrl(event.target.value)}
                placeholder="https:// resource link (optional)"
              />
              <button onClick={addResource}>Upload / publish resource</button>
            </div>
            <div className="admin-list">
              {store?.resources.map((item) => (
                <article key={item.id}>
                  <b>{item.title}</b>
                  <span>
                    {item.domain} · {item.type}
                  </span>
                  <button
                    onClick={() =>
                      mutate(
                        (state) =>
                          (state.resources = state.resources.filter(
                            (resource) => resource.id !== item.id,
                          )),
                      )
                    }
                  >
                    Remove
                  </button>
                </article>
              ))}
              {!store?.resources.length && (
                <p>No domain resources published yet.</p>
              )}
            </div>
          </section>
        )}
        {section === "Submissions" && (
          <Submissions store={store} mutate={mutate} />
        )}
        {section === "Documents" && <Documents store={store} mutate={mutate} />}
      </div>
    </main>
  );
}

function Candidates({
  candidates,
  store,
  mutate,
}: {
  candidates: User[];
  store: AppStore | null;
  mutate: (action: (state: AppStore) => void) => void;
}) {
  const update = (id: string, key: keyof User, value: string) =>
    mutate((state) => {
      const candidate = state.users.find((item) => item.id === id);
      if (candidate) candidate[key] = value as never;
    });
  return (
    <section className="admin-card">
      <h2>Candidate records</h2>
      <p>
        Manage candidate contact details and professional profiles.
      </p>
      <div className="candidate-table">
        <div className="candidate-head">
          <span>Name</span>
          <span>Email</span>
          <span>Mobile</span>
          <span>City</span>
          <span>LinkedIn</span>
          <span>GitHub</span>
        </div>
        {candidates.map((candidate) => (
          <div className="candidate-row" key={candidate.id}>
            <b>{candidate.name}</b>
            <span>{candidate.email}</span>
            <input
              value={candidate.phone || ""}
              onChange={(event) =>
                update(candidate.id, "phone", event.target.value)
              }
              placeholder="Mobile"
            />
            <input
              value={candidate.city || ""}
              onChange={(event) =>
                update(candidate.id, "city", event.target.value)
              }
              placeholder="City"
            />
            <input
              value={candidate.linkedin || ""}
              onChange={(event) =>
                update(candidate.id, "linkedin", event.target.value)
              }
              placeholder="LinkedIn URL"
            />
            <input
              value={candidate.github || ""}
              onChange={(event) =>
                update(candidate.id, "github", event.target.value)
              }
              placeholder="GitHub URL"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
function Submissions({
  store,
  mutate,
}: {
  store: AppStore | null;
  mutate: (action: (state: AppStore) => void) => void;
}) {
  return (
    <section className="admin-card">
      <h2>Submitted projects & marking</h2>
      <p>
        Review the submitted file name and 200-word description, then record
        marks and feedback.
      </p>
      <div className="admin-list">
        {store?.submissions.map((submission) => {
          const student = store.users.find(
            (item) => item.id === submission.userId,
          );
          return (
            <article key={submission.id}>
              <b>
                Week {submission.week}: {student?.name}
              </b>
              <span>
                {submission.fileName} · {submission.description}
              </span>
              <div>
                <input
                  type="number"
                  min="0"
                  max="100"
                  defaultValue={submission.marks ?? ""}
                  placeholder="Marks / 100"
                  onBlur={(event) =>
                    mutate((state) => {
                      const item = state.submissions.find(
                        (record) => record.id === submission.id,
                      );
                      if (item) {
                        item.marks = Number(event.target.value || 0);
                        item.status = "reviewed";
                      }
                    })
                  }
                />
                <button
                  onClick={() =>
                    mutate((state) => {
                      const item = state.submissions.find(
                        (record) => record.id === submission.id,
                      );
                      if (item) item.status = "reviewed";
                    })
                  }
                >
                  Mark reviewed
                </button>
              </div>
            </article>
          );
        })}
        {!store?.submissions.length && <p>No projects submitted yet.</p>}
      </div>
    </section>
  );
}
function Documents({
  store,
  mutate,
}: {
  store: AppStore | null;
  mutate: (action: (state: AppStore) => void) => void;
}) {
  const eligible =
    store?.users.filter(
      (student) =>
        student.role === "student" &&
        store.submissions.filter((record) => record.userId === student.id)
          .length >= 4,
    ) ?? [];
  return (
    <section className="admin-card">
      <h2>Completion eligibility & document payments</h2>
      <p>
        Students become eligible only after all four weekly projects are
        submitted. Payment claims remain manual-review only.
      </p>
      <div className="admin-list">
        {eligible.map((student) => (
          <article key={student.id}>
            <b>{student.name}</b>
            <span>
              All four project submissions received — documents may be issued
              after manual payment approval.
            </span>
          </article>
        ))}
        {!eligible.length && (
          <p>No students have completed all four weeks yet.</p>
        )}
        {store?.payments.map((payment) => (
          <article key={payment.id}>
            <b>
              {
                store.users.find((student) => student.id === payment.userId)
                  ?.name
              }
            </b>
            <span>
              {payment.packageKey} · {payment.status} · UTR:{" "}
              {payment.utr || "Not supplied"}
            </span>
            <button
              onClick={() =>
                mutate((state) => {
                  const item = state.payments.find(
                    (record) => record.id === payment.id,
                  );
                  if (item) item.status = "approved";
                })
              }
            >
              Approve manually
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
