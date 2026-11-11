import guides from '@/lib/domain-guides.json';
export function DomainGuides({programme}:{programme?:string}) {
 const visible=programme?guides.filter(g=>g.programme===programme):guides;
 return <section className="domain-guide-library"><h2>Four-week domain task guides</h2><p>Download your domain guide and its synthetic evidence pack. Each guide contains all four weekly checklists, deliverables and the marking rubric. Staff publish calendar deadlines separately.</p><div className="domain-guide-grid">{visible.map(g=><article key={g.programme}><small>4 WEEKS · 6-PAGE PDF</small><h3>{g.title}</h3><ol>{g.weeks.map(w=><li key={w.week}>Week {w.week}: {w.title}</li>)}</ol><div><a href={g.url} target="_blank" rel="noreferrer">Open task guide PDF ↗</a><a href={g.dataset} download>Download training data ZIP ↓</a></div></article>)}</div></section>;
}
