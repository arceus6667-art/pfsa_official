"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { repo, tasks, type AppStore } from "@/lib/pfsa-store";

const tabs = [
  "Today",
  "Schedule",
  "Tasks",
  "Resources",
  "Certification",
  "Support",
];
const peers = [
  "Farhan Hussain",
  "Nanda Mallanagouda Mudigoudar",
  "Naaz Begum",
  "Mohd Zaid",
  "Anubhav Sharma",
  "Deepak Kumar",
  "Sandeep S",
  "Mahiya Farheen",
  "Keertana SM",
  "Mithun Thallapalli",
];

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

export function StudentWorkspace() {
  const router = useRouter();
  const [store, refresh] = useStore();
  const [tab, setTab] = useState("Today");
  const [week, setWeek] = useState(1);
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [file, setFile] = useState("");
  const [description, setDescription] = useState("");
  const [notice, setNotice] = useState("");
  const [documentPackage, setDocumentPackage] = useState(
    "₹150 · PDF Letter of Completion / Experience",
  );
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(localStorage.getItem("pfsa-student-theme") === "dark");
  }, []);
  const user = typeof window === "undefined" ? null : repo.user();
  const application = store?.applications.find(
    (item) => item.userId === user?.id,
  );
  const programme = store?.programmes.find(
    (item) => item.id === application?.programmeId,
  );
  const submissions =
    store?.submissions.filter((item) => item.userId === user?.id) ?? [];
  const offer = store?.documents.find(
    (item) => item.userId === user?.id && item.type === "Offer Letter",
  );
  const initials =
    user?.name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2) || "PF";
  const firstName = user?.name.split(" ")[0] || "Student";
  const wordCount = description.trim()
    ? description.trim().split(/\s+/).length
    : 0;
  const overall = Math.min(100, submissions.length * 25);
  const completionUnlocked = submissions.length >= 4;
  const scheduledTasks = application && (user?.startDate || store?.batchDate)
    ? tasks.map((task) => {
        const due = new Date(`${user?.startDate || store?.batchDate}T12:00:00`);
        due.setDate(due.getDate() + task.week * 7 - 1);
        return { ...task, due };
      })
    : [];
  const weekStart = new Date(calendarDate);
  weekStart.setDate(calendarDate.getDate() - calendarDate.getDay());
  const calendarDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    return date;
  });
  const moveWeek = (amount: number) =>
    setCalendarDate((current) => {
      const next = new Date(current);
      next.setDate(current.getDate() + amount * 7);
      return next;
    });
  const weekLabel = `${new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(calendarDays[0])} – ${new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(calendarDays[6])}`;
  const greeting =
    new Date().getHours() < 12
      ? "Good morning"
      : new Date().getHours() < 18
        ? "Good afternoon"
        : "Good evening";
  const dateLabel = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  const submit = () => {
    try {
      if (!application)
        throw new Error("Choose an internship before submitting a project.");
      repo.submit(application.programmeId, week, file, description);
      setNotice("Your project has been submitted for staff review.");
      setFile("");
      setDescription("");
      refresh();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to submit the project.",
      );
    }
  };
  if (!user || user.role !== "student")
    return (
      <main className="workspace-guard">
        <h1>Student access required</h1>
        <a href="/login">Go to student login</a>
      </main>
    );

  const today = (
    <>
      <section className="welcome-card">
        <p>— TODAY · {dateLabel.toUpperCase()}</p>
        <h1>
          {greeting}, {firstName.toUpperCase()}
        </h1>
        <div className="welcome-grid">
          <article>
            <span>◷ Schedule</span>
            <h2>No classes scheduled yet</h2>
            <p>Check back soon, or reach out to your mentor.</p>
          </article>
          <article>
            <div className="due-heading">
              <h2>Due Soon</h2>
              <button onClick={() => setTab("Tasks")}>View all →</button>
            </div>
            <p>
              {scheduledTasks.find((task) => task.due >= new Date())
                ? `Next assignment: ${scheduledTasks.find((task) => task.due >= new Date())?.title}`
                : "No upcoming assignments scheduled."}
            </p>
          </article>
        </div>
      </section>
      <section className="progress-layout">
        <article className="programme-card">
          <div>
            <h2>Welcome back, {firstName.toUpperCase()}! 👋</h2>
            <span>Active</span>
          </div>
          <p>
            Batch: <b>Next available batch</b> | Domain:{" "}
            <b>{programme?.title || "Not selected"}</b>
          </p>
          <div className="date-chip">
            <small>Start date</small>
            <b>{store?.batchDate || "To be set"}</b>
          </div>
          <div className="duration">
            <p>
              Duration progress{" "}
              <span>
                {Math.max(0, 28 - submissions.length * 7)} days remaining
              </span>
            </p>
            <i>
              <b style={{ width: `${overall}%` }} />
            </i>
          </div>
        </article>
        <article className="overall-card">
          <h2>Overall Progress</h2>
          <div className="progress-ring">
            <b>{overall}%</b>
          </div>
          <p>{submissions.length} / 4 Tasks Completed</p>
          <div className="milestones">
            <span>
              ☆<b>25%</b>
            </span>
            <span>
              ♢<b>50%</b>
            </span>
            <span>
              ♜<b>75%</b>
            </span>
            <span>
              ♛<b>100%</b>
            </span>
          </div>
        </article>
      </section>
      <Leaderboard />
    </>
  );
  const schedule = (
    <section className="workspace-card">
      <div className="card-title">
        <span>▦</span>
        <h1>Weekly Schedule</h1>
        <div className="calendar-controls">
          <button onClick={() => moveWeek(-1)} aria-label="Previous week">
            ‹
          </button>
          <button onClick={() => setCalendarDate(new Date())}>Today</button>
          <b>{weekLabel}</b>
          <button onClick={() => moveWeek(1)} aria-label="Next week">
            ›
          </button>
        </div>
      </div>
      <div className="workspace-schedule">
        {calendarDays.map((date, index) => (
          <article
            key={date.toISOString()}
            className={
              date.toDateString() === new Date().toDateString()
                ? "current-day"
                : ""
            }
          >
            <div>
              <b>
                {new Intl.DateTimeFormat("en-IN", { weekday: "short" }).format(
                  date,
                )}
              </b>
              <strong>{date.getDate()}</strong>
            </div>
            {scheduledTasks
              .filter((task) => task.due.toDateString() === date.toDateString())
              .map((task) => (
                <p key={task.week}>Week {task.week} Assignment: {task.title}</p>
              ))}
          </article>
        ))}
      </div>
    </section>
  );
  const task = tasks.find((item) => item.week === week);
  const taskView = (
    <section className="workspace-card">
      <div className="card-title">
        <span>☷</span>
        <h1>Weekly Internship Tasks</h1>
        <em>4-week roadmap</em>
      </div>
      <div className="workspace-tabs">
        {tasks.map((item) => (
          <button
            key={item.week}
            onClick={() => setWeek(item.week)}
            className={week === item.week ? "active" : ""}
          >
            Week {item.week}
          </button>
        ))}
      </div>
      {task && (
        <article className="assignment">
          <h2>
            Week {task.week} Assignment: {task.title}
          </h2>
          <p>{task.brief}</p>
          <p>
            Duration: 1 week · Marks: 100 · Submit a PDF report with supporting
            material.
          </p>
          <a href="/tasks/forensic-task-brief.pdf" target="_blank">
            View task brief PDF ↗
          </a>
          <label className="workspace-file">
            <input
              type="file"
              accept=".pdf,.doc,.docx,.zip"
              onChange={(event) => setFile(event.target.files?.[0]?.name || "")}
            />
            <span>Choose project file</span>
            <b>{file || "No file selected"}</b>
          </label>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={6}
            placeholder="Minimum 200 words: explain your method, observations, evidence handling and learning."
          />
          <div className="submission-row">
            <small>{wordCount}/200 words</small>
            <button
              disabled={!application || !file || wordCount < 200}
              onClick={submit}
            >
              Submit project
            </button>
          </div>
          {notice && <p className="notice">{notice}</p>}
        </article>
      )}
    </section>
  );
  const resources = (
    <section className="workspace-card">
      <div className="card-title">
        <span>▤</span>
        <h1>Recommended Resources</h1>
        <em className="green">domain specific</em>
      </div>
      <div className="workspace-resources">
        <article>
          <h2>Evidence Handling Fundamentals</h2>
          <p>Reading guide · domain-relevant reference</p>
          <button
            onClick={() =>
              setNotice(
                "Resource access is ready for the configured course material.",
              )
            }
          >
            Access resource ↗
          </button>
        </article>
        <article>
          <h2>Introduction to {programme?.title || "Forensics"}</h2>
          <p>Video · guided learning reference</p>
          <button
            onClick={() =>
              setNotice(
                "Resource access is ready for the configured course material.",
              )
            }
          >
            Access resource ↗
          </button>
        </article>
      </div>
      {store?.resources
        .filter((resource) => resource.domain === programme?.title)
        .map((resource) => (
          <article className="student-resource" key={resource.id}>
            <b>{resource.title}</b>
            <span>{resource.type} · published by staff</span>
            <a href={resource.url} target="_blank">
              Open resource ↗
            </a>
          </article>
        ))}
      {notice && <p className="notice">{notice}</p>}
    </section>
  );
  const certification = (
    <section className="workspace-card">
      <div className="card-title">
        <span>▧</span>
        <h1>Official Documents</h1>
      </div>
      <div className="workspace-documents">
        <article>
          <h2>Offer Letter</h2>
          <p>
            {offer
              ? "Your official internship offer and training outline letter is ready."
              : "Your offer letter will appear after staff assignment."}
          </p>
          {offer ? (
            <a href="/documents/offer-letter.pdf" target="_blank">
              Download offer letter
            </a>
          ) : (
            <span>Awaiting staff assignment</span>
          )}
        </article>
        <article className="disabled">
          <h2>Internship Certificate</h2>
          <p>
            {completionUnlocked
              ? "All four weekly submissions are complete. Your document packs are now eligible for staff review."
              : "Complete and submit every weekly task to unlock your certificate."}
          </p>
          <span>{completionUnlocked ? "Unlocked" : "Locked"}</span>
        </article>
      </div>
      {completionUnlocked && (
        <section className="completion-payment">
          <h2>Completion document packs</h2>
          <p>
            GPay / UPI demo payment mode. A screenshot or UTR never verifies
            payment automatically; staff must approve it.
          </p>
          <img src="/assets/payment-qr.png" alt="GPay payment QR" />
          <select
            value={documentPackage}
            onChange={(event) => setDocumentPackage(event.target.value)}
          >
            <option>₹150 · PDF Letter of Completion / Experience</option>
            <option>₹199 · PDF Experience + Recommendation</option>
            <option>₹600 · Offline India delivery pack</option>
          </select>
          <button
            onClick={() => {
              try {
                repo.claimPayment(documentPackage, "", "");
                setNotice(
                  "GPay payment claim recorded for manual staff review.",
                );
                refresh();
              } catch (error) {
                setNotice(
                  error instanceof Error
                    ? error.message
                    : "Unable to create payment claim.",
                );
              }
            }}
          >
            Submit GPay payment claim
          </button>
          {notice && <p className="notice">{notice}</p>}
        </section>
      )}
    </section>
  );
  const support = (
    <section className="workspace-card support-card">
      <h1>Student Support</h1>
      <p>
        For programme help, document queries or payment concerns, send a support
        request to the staff team.
      </p>
      <a href="/contact">Open support form</a>
    </section>
  );
  const content =
    tab === "Today"
      ? today
      : tab === "Schedule"
        ? schedule
        : tab === "Tasks"
          ? taskView
          : tab === "Resources"
            ? resources
            : tab === "Certification"
              ? certification
              : support;
  return (
    <main className={`academy-workspace ${dark ? "workspace-dark" : ""}`}>
      <header className="academy-bar">
        <div className="academy-brand">
          <img src="/assets/pfsa-logo.jpeg" alt="Pramaan Forensics Academy" />
          <span>Student Workspace</span>
        </div>
        <div className="academy-actions">
          <button
            aria-label="Switch colour theme"
            title={dark ? "Use light theme" : "Use dark theme"}
            onClick={() =>
              setDark((current) => {
                const next = !current;
                localStorage.setItem(
                  "pfsa-student-theme",
                  next ? "dark" : "light",
                );
                return next;
              })
            }
            className="workspace-theme-toggle"
          >
            {dark ? "☀" : "☾"}
          </button>
          <button
            aria-label="Open student profile"
            onClick={() => setTab("Profile")}
            className="account-chip"
          >
            <b>{initials}</b>
            <span>{firstName}</span>
          </button>
          <button
            onClick={() => {
              repo.setSession(null);
              router.push("/");
            }}
            className="sign-out"
          >
            Sign out ↗
          </button>
        </div>
      </header>
      {tab === "Profile" ? (
        <Profile
          onBack={() => setTab("Today")}
          name={user.name}
          initials={initials}
          email={user.email}
          phone={user.phone}
          linkedin={user.linkedin}
          github={user.github}
          city={user.city}
          cohort={user.cohort}
          programme={programme?.title}
          batchDate={store?.batchDate}
        />
      ) : (
        <>
          <nav className="academy-nav">
            {tabs.map((item) => (
              <button
                key={item}
                onClick={() => setTab(item)}
                className={tab === item ? "active" : ""}
              >
                {item}
              </button>
            ))}
            <button onClick={() => setTab("Profile")}>Profile</button>
          </nav>
          <div className="workspace-content">{content}</div>
        </>
      )}
    </main>
  );
}

function Leaderboard() {
  return (
    <section className="leaderboard">
      <h2>♕ Batch Leaderboard</h2>
      <div className="leaderboard-head">
        <span>Rank</span>
        <span>Student</span>
        <span>Score</span>
      </div>
      {peers.map((name, index) => (
        <div className="leaderboard-row" key={name}>
          <i className={`rank rank-${index + 1}`}>{index + 1}</i>
          <span>{name}</span>
          <b>0.0%</b>
        </div>
      ))}
    </section>
  );
}
function Profile({
  onBack,
  name,
  initials,
  email,
  phone,
  linkedin,
  github,
  city,
  cohort,
  programme,
  batchDate,
}: {
  onBack: () => void;
  name: string;
  initials: string;
  email: string;
  phone?: string;
  linkedin?: string;
  github?: string;
  city?: string;
  cohort?: string;
  programme?: string;
  batchDate?: string;
}) {
  return (
    <section className="workspace-profile">
      <div className="profile-banner">
        <div className="profile-initials">{initials}</div>
        <div>
          <h1>{name}</h1>
          <p>{programme || "Internship applicant"} · Active</p>
        </div>
        <button onClick={onBack}>← Back to workspace</button>
      </div>
      <div className="profile-details">
        {[
          ["Student ID", "PFSA-DEMO-001"],
          ["Email address", email],
          ["Phone number", phone || "Not added"],
          ["Internship domain", programme || "Not selected"],
          ["Batch cohort", cohort || "Next available batch"],
          ["Start date", batchDate || "To be set"],
          ["LinkedIn", linkedin || "Not added"],
          ["GitHub", github || "Not added"],
          ["City", city || "Not added"],
        ].map(([label, value]) => (
          <article key={label}>
            <small>{label}</small>
            <b>{value}</b>
          </article>
        ))}
      </div>
    </section>
  );
}
