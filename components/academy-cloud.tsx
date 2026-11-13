"use client";
import { useEffect, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import {
  cloud,
  googleSignInConfigured,
  addRecord,
  uploadFile,
  openFile,
  type CloudRecord,
  type Profile,
} from "@/lib/pfsa-cloud";
import { programmes, packages } from "@/lib/pfsa-data";
import "./academy-cloud.css";
import { DomainGuides } from "./domain-guides";
import {AuthAccess} from "./auth-access";
import {confirmDocumentName,ensureDocumentIdentity} from "@/lib/auth-flow";
import {AdminReports} from "./admin-reports";
import {readAllRows} from "@/lib/admin-pagination";
import {CertificationCards} from "./certification-cards";
import {profileChanges} from "@/lib/profile-fields";
import { orderName, orderReady, reviewDue } from "@/lib/document-order";
import {rememberProgramme,completePendingApplication,countWords} from "@/lib/application-flow";
import {downloadOffer} from '@/lib/offer-download';
import {staffLoginEmail} from '@/lib/staff-login';
import {SupportPanel,useSupportConversations} from './support-conversations';
import {AdminDomainAssignment} from './admin-domain-assignment';
import {StartChoiceScreen} from './start-choice';
import {canSubmitWork,untilStart,type StartChoice,type StartOptions} from '@/lib/start-choice';

const studentTabs = [
  "Today",
  "Schedule",
  "Tasks",
  "Resources",
  "Certification",
  "Support",
  "Profile",
];
const adminTabs = [
  "Overview",
  "Students & records",
  "Batches",
  "Weekly tracking",
  "Candidates",
  "Applications",
  "Tasks",
  "Resources",
  "Submissions",
  "Documents",
  "Payments",
  "Support",
];
const fmt = (date: Date) =>
  date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const field = (form: HTMLFormElement, key: string) =>
  String(new FormData(form).get(key) || "").trim();
export function AcademyCloud({
  page = "student",
}: {
  page?:
    | "student"
    | "admin"
    | "login"
    | "register"
    | "admin-login"
    | "internships"
    | "verify";
}) {
  const [user, setUser] = useState<User | null>(null),
    [profiles, setProfiles] = useState<Profile[]>([]),
    [records, setRecords] = useState<CloudRecord[]>([]),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [tab, setTab] = useState(page === "admin" ? "Overview" : "Today"),
    [dark, setDark] = useState(false),
    [anchor, setAnchor] = useState(new Date()),
    [week, setWeek] = useState(1),
    [search, setSearch] = useState(""), [descriptionText,setDescriptionText]=useState("");
  const [startChoice,setStartChoice]=useState<StartChoice|null>(null),[startOptions,setStartOptions]=useState<StartOptions|null>(null),[clock,setClock]=useState(Date.now());
  const [candidatePage,setCandidatePage]=useState(1);
  const matchingCandidates=profiles.filter(p=>(p.name+' '+p.email+' '+p.id).toLowerCase().includes(search.toLowerCase()));
  const candidatePages=Math.max(1,Math.ceil(matchingCandidates.length/10)),visibleCandidatePage=Math.min(candidatePage,candidatePages);
  const visibleCandidates=matchingCandidates.slice((visibleCandidatePage-1)*10,visibleCandidatePage*10);
  useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),30000);return()=>clearInterval(timer);},[]);
  const learningOpen=canSubmitWork(startChoice,clock);
  const isAdmin = user?.app_metadata?.pfsa_role === "admin";
  const supportState=useSupportConversations(user?.id,isAdmin);
  const me = profiles.find((p) => p.id === user?.id);
  const application = records.find(
    (r) => r.kind === "application" && r.user_id === user?.id,
  );
  const own = records.filter((r) => r.user_id === user?.id),
    submissions = own.filter(
      (r) =>
        r.kind === "submission" &&
        r.data.programme === application?.data.programme,
    );
  const completed =
    new Set(submissions.map((r) => Number(r.data.week))).size === 4;
  const programme = programmes.find(
    (p) => p.id === application?.data.programme,
  );
  const offer = own.find(r => r.kind === 'document' && r.data.type === 'Offer Letter' && r.data.status === 'published' && r.data.programme === programme?.id);
  const tasks = records.filter(
    (r) =>
      r.kind === "task" && r.data.programme === application?.data.programme,
  );
  tasks.sort((a,b)=>Number(a.data.week)-Number(b.data.week));
  const activeTask = tasks.find((r) => Number(r.data.week) === week);
  useEffect(()=>{setDescriptionText('');},[week]);
  const refresh = async () => {
    const {
      data: { user: current },
      error,
    } = await cloud.auth.getUser();
    if (error && current) throw error;
    setUser(current);
    if (!current) {
      setLoading(false);
      return;
    }
    if(page==="student" && current.app_metadata.pfsa_role!=="admin") { if(!await ensureDocumentIdentity(current))return;await completePendingApplication(current.id); }
    if(current.app_metadata.pfsa_role==='admin') {
      const [p,r]=await Promise.all([
        readAllRows<Profile>((from,to)=>cloud.rpc('pfsa_admin_students').range(from,to)),
        readAllRows<CloudRecord>((from,to)=>cloud.from('pfsa_records').select('*').order('created_at',{ascending:false}).order('id').range(from,to))
      ]);
      setProfiles(p);setRecords(r);
    } else {
      const [p,r]=await Promise.all([cloud.from('pfsa_profiles').select('*').order('name'),cloud.from('pfsa_records').select('*').order('created_at',{ascending:false})]);
      if(p.error||r.error)throw p.error||r.error;
      setProfiles(p.data||[]);setRecords(r.data||[]);
      if(page==='student'){
       const [selection,options]=await Promise.all([cloud.from('pfsa_start_selections').select('*').eq('user_id',current.id).maybeSingle(),cloud.rpc('pfsa_start_options')]);
       if(selection.error||options.error)throw selection.error||options.error;
       setStartChoice(selection.data);setStartOptions(options.data);
      }
    }
    setLoading(false);
  };
  useEffect(() => {
    const selected=new URLSearchParams(window.location.search).get("programme");
    if(selected) rememberProgramme(selected);
    setDark(localStorage.getItem("pfsa-theme") === "dark");
    const sync = () =>
      refresh().catch((e) => {
        setNotice(e.message);
        setLoading(false);
      });
    sync();
    const {
      data: { subscription },
    } = cloud.auth.onAuthStateChange(() => {
      setTimeout(sync, 0);
    });
    const channel = cloud
      .channel("pfsa-workspace")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pfsa_records" },
        sync,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pfsa_profiles" },
        sync,
      )
      .subscribe();
    window.addEventListener("focus", sync);
    return () => {
      subscription.unsubscribe();
      cloud.removeChannel(channel);
      window.removeEventListener("focus", sync);
    };
  }, []);
  const run = async (
    action: () => Promise<unknown>,
    success = "Saved successfully.",
  ) => {
    setBusy(true);
    setNotice("");
    try {
      await action();
      await refresh();
      setNotice(success);
    } catch (e) {
      setNotice(
        e && typeof e==='object' && 'message' in e ? String(e.message) : "Unable to save. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  const update = async (record: CloudRecord, patch: CloudRecord["data"]) => {
    const { error } = await cloud
      .from("pfsa_records")
      .update({ data: { ...record.data, ...patch } })
      .eq("id", record.id);
    if (error) throw error;
  };
  const auth = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    await run(
      async () => {
        const email = page==='admin-login'?staffLoginEmail(field(form,'email')):field(form, "email"),
          password = field(form, "password");
        if (page === "register") {
          const { data, error } = await cloud.auth.signUp({
            email,
            password,
            options: {
              data: { name: field(form, "name") },
              emailRedirectTo: window.location.origin + "/login",
            },
          });
          if (error) throw error;
          if (!data.session) {
            setNotice(
              "Check your email to confirm your account, then sign in.",
            );
            return;
          }
        } else {
          const { error } = await cloud.auth.signInWithPassword({
            email,
            password,
          });
          if (error) throw error;
        }
        const {
          data: { user: u },
        } = await cloud.auth.getUser();
        if (u) {
          const { data: existing, error: readError } = await cloud
            .from("pfsa_profiles")
            .select("id,name,name_confirmed_at")
            .eq("id", u.id)
            .maybeSingle();
          if (readError) throw readError;
          if (!existing) {
            const { error } = await cloud
              .from("pfsa_profiles")
              .insert({
                id: u.id,
                name:
                  field(form, "name") ||
                  u.user_metadata.name ||
                  u.email?.split("@")[0],
                email: u.email,
              });
            if (error) throw error;
          }
          if(u.app_metadata.pfsa_role!=="admin") {
            if(!existing?.name_confirmed_at && !(u.app_metadata.providers||[]).includes('google')) {
              const name=field(form,'name')||existing?.name||u.user_metadata.name;
              if(name)await confirmDocumentName(name);
            }
            if(!await ensureDocumentIdentity(u))return;
            await completePendingApplication(u.id);
          }
        window.location.assign(
            u.app_metadata.pfsa_role === "admin" ? "/admin" : "/student",
          );
        }
      },
      page === "register"
        ? "Check your email to confirm your account."
        : "Signed in.",
    );
  };
  const uploadForm = async (
    form: HTMLFormElement,
    kind: "resource" | "task" | "document",
  ) => {
    const candidate = field(form, "candidate"),
      target = profiles.find((p) => p.id === candidate);
    const file = new FormData(form).get("file") as File;
    if (kind === "resource" && !file?.size && !field(form, "url"))
      throw new Error("Choose a file or enter a resource URL.");
    if (kind === "document" && !file?.name.toLowerCase().endsWith(".pdf"))
      throw new Error("Issued documents must be PDF files.");
    const path = file?.size ? await uploadFile(file, user!.id) : "";
    const data: CloudRecord["data"] = {
      title: field(form, "title"),
      programme: field(form, "programme"),
      path,
      url: field(form, "url"),
    };
    if (kind === "task") {
      data.week = Number(field(form, "week"));
      data.due = field(form, "due");
      data.description = field(form, "description");
    }
    if (kind === "document") {
      data.type = field(form, "type");
      data.number = "PFSA-" + crypto.randomUUID().slice(0, 12).toUpperCase();
      data.candidate = target?.name || "";
      data.status = "draft";
      if (!path) throw new Error("Upload the issued document PDF.");
    }
    await addRecord(kind, kind === "document" ? candidate : user!.id, data);
    form.reset();
  };
  const renderFile = (record: CloudRecord) =>
    record.data.type==='Offer Letter' && record.data.generated && !record.data.path ? <button onClick={()=>run(()=>downloadOffer(record),'Offer downloaded.')} disabled={busy}>Download offer letter</button> : record.data.url && !record.data.path ? (
      <a href={String(record.data.url)} target="_blank" rel="noreferrer">
        Open guide PDF ↗
      </a>
    ) : (
      <button
        type="button"
        onClick={() =>
          run(() => openFile(String(record.data.path)), "File opened.")
        }
        disabled={!record.data.path || busy}
      >
        Open file ↗
      </button>
    );
  const resourceForm = (kind: "resource" | "task" | "document") => (
    <form
      className="cloud-form"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        run(() => uploadForm(form, kind));
      }}
    >
      <label>
        Title
        <input name="title" required />
      </label>
      <label>
        Domain
        <select name="programme" required>
          {programmes.map((p) => (
            <option value={p.id} key={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </label>
      {kind === "task" && (
        <>
          <label>
            Week
            <select name="week">
              {[1, 2, 3, 4].map((w) => (
                <option key={w}>{w}</option>
              ))}
            </select>
          </label>
          <label>
            Deadline
            <input name="due" type="date" required />
          </label>
          <label>
            Instructions
            <textarea name="description" required />
          </label>
        </>
      )}
      {kind === "document" && (
        <>
          <label>
            Candidate
            <select name="candidate" required>
              <option value="">Select candidate</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.email}
                </option>
              ))}
            </select>
          </label>
          <label>
            Document type
            <select name="type">
              <option>Offer Letter</option>
              <option>Letter of Experience</option>
              <option>Letter of Completion</option>
              <option>Letter of Recommendation</option>
              <option>Letter of Excellence</option>
            </select>
          </label>
        </>
      )}
      <label className="cloud-upload">
        Upload from your device
        <input
          type="file"
          name="file"
          accept=".pdf,.doc,.docx,.zip,.png,.jpg,.jpeg"
          required={kind !== "resource"}
        />
        <small>PDF, Word, ZIP or image · up to 10 MB</small>
      </label>
      {kind === "resource" && (
        <label>
          Or resource URL
          <input name="url" type="url" placeholder="https://" />
        </label>
      )}
      <button disabled={busy}>Save {kind}</button>
    </form>
  );
  const profileForm = (p: Profile) => (
    <form
      className="cloud-form"
      key={p.id}
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        run(async () => {
          const changes=profileChanges(key=>field(form,key),isAdmin);
          const { error } = isAdmin
            ? await cloud.from('pfsa_profiles').upsert({id:p.id,email:p.email,...changes},{onConflict:'id'})
            : await cloud.from('pfsa_profiles').update(changes).eq('id',p.id);
          if (error) throw error;
        });
      }}
    >
      <h3>{p.name}</h3>
      <p>
        {p.email} · Student ID: {p.id}
      </p>
      {(
        [
          "name",
          "phone",
          "city",
          "linkedin",
          "github",
          "cohort",
          "start_date",
        ] as const
      ).map((key) => (
        <label key={key}>
          {key === 'cohort' ? 'Batch' : key.replace("_", " ")}
          <input
            name={key}
            defaultValue={p[key] || ""}
            type={
              key === "start_date"
                ? "date"
                : key === "linkedin" || key === "github"
                  ? "url"
                  : "text"
            }
            required={key === "name"}
            readOnly={!isAdmin && ['name','cohort','start_date'].includes(key)}
          />
          {!isAdmin && ['cohort','start_date'].includes(key) && <small>Assigned by academy staff</small>}
        </label>
      ))}
      <button disabled={busy}>Save profile</button>
    </form>
  );
  if (["login", "register", "admin-login"].includes(page)) return <AuthAccess page={page} busy={busy} notice={notice} onPassword={auth} google={()=>void run(async()=>{const {error}=await cloud.auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.origin+'/auth/callback',scopes:'email profile'}});if(error)throw error;},'Redirecting to Google…')}/>;
  if (page === "verify")
    return (
      <main className="cloud-auth">
        <a href="/">← Academy home</a>
        <section>
          <h1>Verify academy document</h1>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const number = field(e.currentTarget, "number");
              run(async () => {
                const { data, error } = await cloud.rpc("pfsa_verify", {
                  document_number: number,
                });
                if (error) throw error;
                setSearch(
                  data?.length
                    ? `${data[0].candidate} · ${data[0].type} · ${data[0].number}`
                    : "No published document found.",
                );
              }, "Verification complete.");
            }}
          >
            <label>
              Document number
              <input name="number" required />
            </label>
            <button disabled={busy}>Verify</button>
          </form>
          <p>{search}</p>
          <p role="status">{notice}</p>
        </section>
      </main>
    );
  if (page === "internships")
    return (
      <main className="cloud-catalogue">
        <a href="/">← Academy home</a>
        <h1>Choose your forensic learning pathway</h1>
        <p>
          One internship per student. Applications are reviewed by the academy.
        </p>
        <p role="status">{notice}</p>
        <div className="cloud-grid">
          {programmes.map((p) => (
            <article key={p.id}>
              <small>{p.domain}</small>
              <h2>{p.title}</h2>
              <p>{p.description}</p>
              <p>Four weeks · Virtual</p>
              <button
                disabled={busy || loading || !!application}
                onClick={() => {
                  rememberProgramme(p.id);
                  if (!user) {
                    window.location.assign("/login?programme="+encodeURIComponent(p.id));
                    return;
                  }
                  run(
                    async () => { if(await completePendingApplication(user.id))window.location.assign("/student"); },
                    "Application submitted.",
                  );
                }}
              >
                {application?.data.programme === p.id
                  ? "✓ Applied"
                  : application
                    ? "Already enrolled"
                    : "Apply now"}
              </button>
            </article>
          ))}
        </div>
        <DomainGuides />
        <a href="/student">Open student workspace →</a>
      </main>
    );
  if (loading)
    return (
      <main className="cloud-auth">
        <h1>Loading your workspace…</h1>
      </main>
    );
  if (!user)
    return (
      <main className="cloud-auth">
        <h1>Sign in to your academy account</h1>
        <a href={page === "admin" ? "/admin/login" : "/login"}>
          Continue to sign in →
        </a>
      </main>
    );
  if (page === "admin" && !isAdmin)
    return (
      <main className="cloud-auth">
        <h1>Staff access required</h1>
        <p>Your account does not have the academy staff role.</p>
        <a href="/student">Open student workspace</a>
      </main>
    );
  if(page==='student'&&!isAdmin&&application&&!startChoice)return <StartChoiceScreen userId={user.id} name={me?.name||'student'} domain={programme?.title||String(application.data.programme)} options={startOptions} onDone={refresh} dark={dark} error={notice}/>;
  const start = new Date(anchor);
  start.setDate(start.getDate() - start.getDay());
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    return date;
  });
  return (
    <main
      className={`cloud-shell ${isAdmin ? "staff-shell" : ""} ${dark ? "cloud-dark" : ""}`}
    >
      <header>
        <a className="cloud-brand" href={isAdmin ? "/admin" : "/student"}>
          <img src="/assets/pfsa-logo.jpeg" alt="Pramaan Forensics Academy" />
          <b>{isAdmin ? "Academy administration" : "Student Workspace"}</b>
        </a>
        <div>
          <button
            aria-label="Change colour theme"
            onClick={() => {
              setDark(!dark);
              localStorage.setItem("pfsa-theme", dark ? "light" : "dark");
            }}
          >
            {dark ? "☀" : "☾"}
          </button>
          <button title={me?.name || user.email} onClick={() => setTab(isAdmin ? "Candidates" : "Profile")}>
            {me?.name || user.email}
          </button>
          <button
            onClick={() =>
              run(async () => {
                await cloud.auth.signOut();
                window.location.assign("/login");
              })
            }
          >
            Sign out
          </button>
        </div>
      </header>
      <nav>
        {(isAdmin ? adminTabs : studentTabs).map((t) => (
          <button
            className={tab === t ? "active" : ""}
            key={t}
            onClick={() => {
              setTab(t);
              setNotice("");
            }}
          >
            {t}{t==='Support'&&supportState.unread.length>0&&<span className="support-nav-badge" aria-label={supportState.unread.length+' unread support replies'}>{supportState.unread.length}</span>}
          </button>
        ))}
      </nav>
      <div className="cloud-main">
        {!isAdmin&&startChoice&&!startChoice.legacy_access&&<div className="cloud-order-status"><strong>{startChoice.mode==='early'?'Early Start · learning access open':'Regular Start · '+untilStart(startChoice.start_at,clock)}</strong><p>{startChoice.mode==='early'?'Your ₹400 document bundle payment is recorded for manual review. Complete the four weekly tasks before document issuance.':'Your workspace and offer letter are available. Task submissions open on your assigned batch date.'}</p></div>}
        <div className="cloud-heading">
          <div>
            <small>
              {isAdmin
                ? "ACADEMY OPERATIONS"
                : programme?.title || "YOUR LEARNING JOURNEY"}
            </small>
            <h1>{tab}</h1>
          </div>
          <button
            onClick={() => run(refresh, "Workspace refreshed.")}
            disabled={busy}
          >
            Refresh
          </button>
        </div>
        {notice && (
          <p className="cloud-notice" role="status">
            {notice}
          </p>
        )}
        {isAdmin && ["Overview","Students & records","Batches","Weekly tracking"].includes(tab) && <AdminReports view={tab} profiles={profiles} records={records} busy={busy} run={run}/>}
        {isAdmin && tab === "Candidates" && (
          <section>
            <h2>Candidate directory</h2>
            <input
              placeholder="Search name, email or student ID"
              value={search}
              onChange={(e) => {setSearch(e.target.value);setCandidatePage(1);}}
            />
            <div className="cloud-controls admin-candidate-pages"><p>{matchingCandidates.length?`Showing ${(visibleCandidatePage-1)*10+1}–${Math.min(visibleCandidatePage*10,matchingCandidates.length)} of ${matchingCandidates.length} candidates`:'No candidates match your search.'}</p><button type="button" disabled={visibleCandidatePage===1} onClick={()=>setCandidatePage(visibleCandidatePage-1)}>Previous candidates</button><span>Page {visibleCandidatePage} of {candidatePages}</span><button type="button" disabled={visibleCandidatePage===candidatePages} onClick={()=>setCandidatePage(visibleCandidatePage+1)}>Next candidates</button></div>
            {visibleCandidates
              .map(p=><article className="admin-candidate-record" key={p.id}>{profileForm(p)}<AdminDomainAssignment profile={p} application={records.find(r=>r.kind==='application'&&r.user_id===p.id)} busy={busy} onSaved={refresh}/></article>)}
            {!profiles.length && <p>No registered candidates yet.</p>}
          </section>
        )}
        {isAdmin && ["Resources", "Tasks", "Documents"].includes(tab) && (
          <section>
            <h2>
              {tab === "Tasks"
                ? "Publish a dated weekly task"
                : tab === "Documents"
                  ? "Upload and issue a candidate document"
                  : "Publish domain learning material"}
            </h2>
            {resourceForm(
              tab === "Tasks"
                ? "task"
                : tab === "Documents"
                  ? "document"
                  : "resource",
            )}
            {records
              .filter(
                (r) =>
                  r.kind ===
                  (tab === "Tasks"
                    ? "task"
                    : tab === "Documents"
                      ? "document"
                      : "resource"),
              )
              .map((r) => (
                <article className="cloud-row" key={r.id}>
                  <div>
                    <b>{r.data.title}</b>
                    <p>
                      {r.data.number || r.data.programme} ·{" "}
                      {r.data.status || "Available"}{" "}
                      {r.data.due ? `· ${r.data.due}` : ""}
                    </p>
                  </div>
                  {renderFile(r)}
                  {r.kind === "document" && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          if (r.data.type !== "Offer Letter") {
                            const done = records.filter(
                              (x) =>
                                x.kind === "submission" &&
                                x.user_id === r.user_id &&
                                x.data.programme === r.data.programme &&
                                x.data.status === "reviewed",
                            );
                            const paid = records.some(
                              (x) =>
                                x.kind === "payment" &&
                                x.user_id === r.user_id &&
                                x.data.status === "approved",
                            );
                            if (
                              new Set(done.map((x) => x.data.week)).size !==
                                4 ||
                              !paid
                            )
                              throw new Error(
                                "Four reviewed weekly projects and an approved payment are required.",
                              );
                          }
                          await update(r, {
                            status:
                              r.data.status === "published"
                                ? "revoked"
                                : "published",
                          });
                        })
                      }
                    >
                      {r.data.status === "published" ? "Revoke" : "Publish"}
                    </button>
                  )}
                </article>
              ))}
          </section>
        )}
        {isAdmin && tab === "Applications" && (
          <section>
            <h2>Application review</h2>
            {records
              .filter((r) => r.kind === "application")
              .map((r) => (
                <article className="cloud-row" key={r.id}>
                  <div>
                    <b>{profiles.find((p) => p.id === r.user_id)?.name}</b>
                    <p>
                      {programmes.find((p) => p.id === r.data.programme)?.title}{" "}
                      · {r.data.status}
                    </p><p>Start option: {r.data.start_mode||'Not selected yet'}</p>
                  </div>
                  <button
                    disabled={busy}
                    onClick={() => run(() => update(r, { status: "approved" }))}
                  >
                    Approve
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => run(() => update(r, { status: "rejected" }))}
                  >
                    Reject
                  </button>
                </article>
              ))}
          </section>
        )}
        {isAdmin && tab === "Submissions" && (
          <section>
            <h2>Project assessment</h2>
            {records
              .filter((r) => r.kind === "submission")
              .map((r) => (
                <form
                  className="cloud-assessment"
                  key={r.id}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    run(() =>
                      update(r, {
                        marks: Number(field(form, "marks")),
                        feedback: field(form, "feedback"),
                        status: "reviewed",
                      }),
                    );
                  }}
                >
                  <h3>
                    {profiles.find((p) => p.id === r.user_id)?.name} · Week{" "}
                    {r.data.week}
                  </h3>
                  {renderFile(r)}
                  <p className="cloud-description">{r.data.description}</p>
                  <label>
                    Marks / 100
                    <input
                      name="marks"
                      type="number"
                      min="0"
                      max="100"
                      required
                      defaultValue={r.data.marks}
                    />
                  </label>
                  <label>
                    Feedback
                    <textarea name="feedback" defaultValue={r.data.feedback} />
                  </label>
                  <button disabled={busy}>Save assessment</button>
                </form>
              ))}
            {!records.some((r) => r.kind === "submission") && (
              <p>No projects have been submitted.</p>
            )}
          </section>
        )}
        {isAdmin && tab === "Payments" && (
          <section>
            <h2>Manual UPI review</h2>
            <p>
              Check the payment against your bank / GPay account before
              approval.
            </p>
            {records
              .filter((r) => r.kind === "payment")
              .map((r) => (
                <article className="cloud-row" key={r.id}>
                  <div>
                    <b>
                      {profiles.find((p) => p.id === r.user_id)?.name} · ₹
                      {r.data.amount || r.data.package} · {orderName(String(r.data.package))}
                    </b>
                    <p>
                      {r.data.order_type==='early_start'?'Early Start bundle · ':''}UTR / Payment ID: {r.data.utr} · {r.data.status}
                    </p>
                    <p>{r.data.address}</p>
                    <p>Estimated completion (after all required submissions): {reviewDue(r,records.filter(s=>s.user_id===r.user_id))?.toLocaleString('en-IN', {timeZone:'Asia/Kolkata'})||'Awaiting all four submissions'} · Terms: {r.data.terms_accepted_at ? 'Accepted ' + r.data.terms_accepted_at : 'Legacy order'}</p>
                    <p>Email: {profiles.find(p => p.id === r.user_id)?.email} · {r.data.email_delivered_at ? 'Staff recorded dispatch' : 'Awaiting staff email dispatch'}</p>
                    {orderReady(r, records.filter(d => d.user_id === r.user_id)) && <div className="cloud-controls">
                      <a href={'mailto:' + encodeURIComponent(profiles.find(p => p.id === r.user_id)?.email || '') + '?subject=' + encodeURIComponent('Your PFSA internship documents') + '&body=' + encodeURIComponent('Congratulations on completing your internship! Your ' + orderName(String(r.data.package)) + ' are ready. Please find your documents in the PFSA portal: https://pramaan-forensics-academy.arceus6667.chatgpt.site/student\n\nPFSA Academy Team')}>Prepare document delivery email ↗</a>
                      <button disabled={busy || !!r.data.email_delivered_at} onClick={() => { if(window.confirm('Have you actually sent the ordered documents to this student’s registered email? This records your confirmation; it does not send an email.')) void run(() => update(r, {email_delivered_at:new Date().toISOString()}), 'Email dispatch recorded.'); }}>Confirm email was sent</button>
                    </div>}
                  </div>
                  {renderFile(r)}
                  <button
                    disabled={busy}
                    onClick={() => run(() => update(r, { status: "approved" }))}
                  >
                    Approve payment
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      run(() => update(r, { status: "follow-up" }))
                    }
                  >
                    Follow up
                  </button>
                </article>
              ))}
          </section>
        )}
        {tab === "Support" && <SupportPanel records={records} profiles={profiles} userId={user.id} isAdmin={isAdmin} busy={busy} run={run} state={supportState}/>}
        {!isAdmin && tab === "Profile" && (
          <section>
            {me ? (
              profileForm(me)
            ) : (
              <p>
                Your profile is being prepared. Sign out and back in if it does
                not appear.
              </p>
            )}
          </section>
        )}
        {!isAdmin && tab === "Today" && (
          <>
            <section>
              <small>{fmt(new Date())}</small>
              <h2>Welcome back, {me?.name || "student"}</h2>
              <p>{programme?.title || "Choose an internship to begin."}</p>
              <div className="cloud-grid">
                <article>
                  <small>Application</small>
                  <h3>{application?.data.status || "Not applied"}</h3>
                  {!application&&<a href="/internships">Explore internships →</a>}
                </article>
                <article>
                  <small>Weekly work</small>
                  <h3>{submissions.length} / 4 submitted</h3>
                  <button onClick={() => setTab("Tasks")}>Open tasks</button>
                </article>
                <article>
                  <small>Offer Letter</small>
                  <h3>Your internship offer</h3>
                  {offer ? <button disabled={busy} onClick={() => run(() => offer.data.path ? openFile(String(offer.data.path)) : downloadOffer(offer), 'Offer letter download ready.')}>Download your offer letter</button> : <p>{application ? 'Your offer letter is being prepared.' : 'Enrol in an internship to receive your offer letter.'}</p>}
                </article>
              </div>
            </section>
            <section>
              <h2>Upcoming deadlines</h2>
              {tasks
                .filter(
                  (t) =>
                    String(t.data.due) >= new Date().toISOString().slice(0, 10),
                )
                .map((t) => (
                  <p key={t.id}>
                    Week {t.data.week} · {t.data.title} · {t.data.due}
                  </p>
                ))}
              {!tasks.length && (
                <p>Your academy will publish your task deadlines here.</p>
              )}
            </section>
          </>
        )}
        {!isAdmin && tab === "Schedule" && (
          <section>
            {!isAdmin&&startChoice&&!startChoice.legacy_access&&<div className="cloud-order-status"><strong>{startChoice.mode==='early'?'Early Start · learning access open':'Regular Start · '+untilStart(startChoice.start_at,clock)}</strong><p>{startChoice.mode==='early'?'Your ₹400 document bundle payment is recorded for manual review. Complete the four weekly tasks before document issuance.':'Your workspace and offer letter are available. Task submissions open on your assigned batch date.'}</p></div>}
        <div className="cloud-heading">
              <h2>Weekly Schedule</h2>
              <div className="cloud-controls">
                <button
                  onClick={() => {
                    const d = new Date(anchor);
                    d.setDate(d.getDate() - 7);
                    setAnchor(d);
                  }}
                >
                  ‹
                </button>
                <button onClick={() => setAnchor(new Date())}>Today</button>
                <input
                  type="date"
                  aria-label="Jump to date"
                  onChange={(e) =>
                    e.target.value &&
                    setAnchor(new Date(e.target.value + "T12:00:00"))
                  }
                />
                <span>
                  {fmt(days[0])} – {fmt(days[6])}
                </span>
                <button
                  onClick={() => {
                    const d = new Date(anchor);
                    d.setDate(d.getDate() + 7);
                    setAnchor(d);
                  }}
                >
                  ›
                </button>
              </div>
            </div>
            <div className="cloud-calendar">
              {days.map((d) => (
                <article key={d.toISOString()}>
                  <small>
                    {d.toLocaleDateString("en-IN", { weekday: "short" })}
                  </small>
                  <h3>{d.getDate()}</h3>
                  {tasks
                    .filter(
                      (t) =>
                        t.data.due ===
                        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
                    )
                    .map((t) => (
                      <button
                        key={t.id}
                        onClick={() => {
                          setWeek(Number(t.data.week));
                          setTab("Tasks");
                        }}
                      >
                        Week {t.data.week}: {t.data.title}
                      </button>
                    ))}
                </article>
              ))}
            </div>
          </section>
        )}
        {!isAdmin && tab === "Tasks" && (
          <section>
            <DomainGuides programme={programme?.id} />
            <h2>Four-week internship roadmap</h2>
            <div className="cloud-controls cloud-week-tabs">
              {[1, 2, 3, 4].map((w) => (
                <button
                  className={w === week ? "active" : ""}
                  key={w}
                  onClick={() => setWeek(w)}
                >
                  Week {w}
                </button>
              ))}
            </div>
            {!learningOpen ? <p role="status">Your Regular Start batch opens on {startChoice?new Date(startChoice.start_at).toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata'}):'your assigned date'}. {startChoice?untilStart(startChoice.start_at,clock):'Choose your start option first.'}.</p> : activeTask ? (
              <>
                <h3>{activeTask.data.title}</h3>
                <p>{activeTask.data.description}</p>
                <p>Deadline: {activeTask.data.due}</p>
                {renderFile(activeTask)}
                {submissions.find((r) => Number(r.data.week) === week) ? (
                  <article>
                    <h3>Submitted</h3>
                    <p>
                      {
                        submissions.find((r) => Number(r.data.week) === week)
                          ?.data.status
                      }
                    </p>
                    <p>
                      Marks:{" "}
                      {submissions.find((r) => Number(r.data.week) === week)
                        ?.data.marks ?? "Awaiting review"}
                    </p>
                    <p>
                      {
                        submissions.find((r) => Number(r.data.week) === week)
                          ?.data.feedback
                      }
                    </p>
                  </article>
                ) : (
                  <form
                    className="cloud-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.currentTarget;
                      run(async () => {
                        const description = field(form, "description");
                        if (countWords(description) < 200)
                          throw new Error("Please enter at least 200 words.");
                        const file = new FormData(form).get("file") as File;
                        const path = await uploadFile(file, user.id);
                        await addRecord("submission", user.id, {
                          programme: programme!.id,
                          week,
                          path,
                          filename: file.name,
                          description,
                          status: "submitted",
                        });
                      }, "Project submitted for assessment.");
                    }}
                  >
                    <label className="cloud-upload">
                      Choose project work
                      <input
                        type="file"
                        name="file"
                        accept=".pdf,.doc,.docx,.zip,.txt,.csv,.json,.xlsx,.pptx,.sql,.sqlite,.db,.png,.jpg,.jpeg,.webp"
                        required
                      />
                    </label>
                    <label>
                      Project description (minimum 200 words)
                      <textarea name="description" required rows={8} value={descriptionText} onChange={e=>setDescriptionText(e.target.value)} aria-describedby="description-count"/><small id="description-count" aria-live="polite">{countWords(descriptionText)} / 200 words minimum</small>
                    </label>
                    <button disabled={busy||countWords(descriptionText)<200}>Submit project</button>
                  </form>
                )}
              </>
            ) : (
              <p>Your academy has not published a task for this week yet.</p>
            )}
          </section>
        )}
        {!isAdmin && tab === "Resources" && (
          <section>
            <DomainGuides programme={programme?.id} />
            <h2>Domain resources</h2>
            {records
              .filter(
                (r) =>
                  r.kind === "resource" && r.data.programme === programme?.id,
              )
              .map((r) => (
                <article className="cloud-row" key={r.id}>
                  <h3>{r.data.title}</h3>
                  {r.data.path ? (
                    renderFile(r)
                  ) : (
                    <a
                      href={String(r.data.url)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open resource ↗
                    </a>
                  )}
                </article>
              ))}
            {!records.some(
              (r) =>
                r.kind === "resource" && r.data.programme === programme?.id,
            ) && <p>No resources have been published for your domain.</p>}
          </section>
        )}
        {!isAdmin && tab === "Certification" && <CertificationCards records={own} userId={user.id} email={me?.email || user.email} programme={programme?.id} completed={completed} busy={busy} run={run}/>}

      </div>
    </main>
  );
}
