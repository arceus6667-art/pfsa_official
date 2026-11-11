from pathlib import Path
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.utils import ImageReader
from pypdf import PdfReader
import json, csv, hashlib, zipfile, shutil, sqlite3, html

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT.parents[1] / 'outputs' / 'domain-guides'
PUBLIC = ROOT / 'public' / 'guides'
OUT.mkdir(parents=True, exist_ok=True)
PUBLIC.mkdir(parents=True, exist_ok=True)
DATA = {
 'computer-cyber': ('Computer & Cyber Forensics', 'A fictional office export contains a document inventory and activity log. Determine what the export supports about a report revision, without claiming access to an original disk.', [
  ('Evidence intake and integrity', ['Inventory every file in the supplied training ZIP; assign evidence IDs CC-01 onward and record size, SHA-256, source and collection time.', 'Create separate originals and working folders. Hash before analysis and explain why copying an export is not a forensic disk acquisition.', 'Write a chain-of-custody table with custodian, action, timestamp, purpose and integrity result.'], 'evidence_register.csv, sha256_manifest.csv, preservation_notes.pdf'),
  ('File metadata examination', ['Examine file_inventory.csv without editing the preserved copy. List each document version, supplied metadata and missing original-file properties.', 'Compare report v1 and v2 metadata to the activity log. Identify conflicting or ambiguous records without assuming which source is correct.', 'Build an observation table with evidence ID, exact row reference, observation, interpretation and confidence.'], 'metadata_comparison.csv and examination_notes.pdf'),
  ('Correlated activity timeline', ['Normalize all supplied timestamps to UTC and retain their original forms in a second column.', 'Create a minimum eight-event timeline linking log records to inventory entries; flag events with no independent corroboration.', 'Test two explanations for the report revision: expected editing and an unverified account action. List what evidence would distinguish them.'], 'timeline.csv, two_hypotheses.pdf and annotated references'),
  ('Case report and peer handover', ['Produce a 4-6 page report answering whether the supplied export supports a revision, who or what is named in logs, and what cannot be concluded.', 'Include scope, methods, tool versions, hash checks, evidence citations, alternative explanations and limitations.', 'Add a one-page handover checklist another student can reproduce from the training ZIP.'], 'final_report.pdf, timeline.csv, hash_manifest.csv and handover.pdf')]),
 'mobile': ('Mobile Device Forensics', 'A fictional consented logical export contains messages, app activity and a device summary. The exercise evaluates logical-export interpretation, not handset unlocking or deleted-data recovery.', [
  ('Logical export preservation', ['Inventory device.json, messages.csv and app_events.csv. Record device label, export type, timezone and fields absent from the export.', 'Hash every supplied file; prepare an evidence register and a consent/scope statement for the fictional training device.', 'Draw the difference between a logical export, a physical extraction and an original device; state which one is available here.'], 'device_profile.pdf, evidence_register.csv and hash_manifest.csv'),
  ('Messages and app activity', ['Map message ID, sender label, direction, timestamp and text into an examination worksheet; use synthetic labels only.', 'Identify duplicate message IDs and explain the risk of counting duplicates as independent events.', 'Compare app events with message activity. Mark correlation separately from proof of a person using the device.'], 'message_worksheet.csv, duplicate_log.csv and observations.pdf'),
  ('Timezone and event correlation', ['Convert the +05:30 timestamps to UTC and preserve both representations.', 'Construct a timeline of at least eight distinct events, explicitly retaining any duplicates or uncertain ordering in notes.', 'Evaluate whether app activity corroborates a message event; explain why a logical export cannot establish deleted content or complete device history.'], 'mobile_timeline.csv and correlation_matrix.pdf'),
  ('Mobile evidence report', ['Write a 4-6 page report including fictional scope, export limitations, findings and evidence-row citations.', 'Redact synthetic message text from the executive summary unless relevant; describe how real participant data would be minimized.', 'Package the timeline, hashes, duplicate decisions and a reproducible handover checklist.'], 'mobile_report.pdf, timeline.csv and appendix.zip')]),
 'network': ('Network Forensics', 'A fictional training network provides flow metadata and DNS events. All addresses are documentation ranges and domains use .example. No live capture or scanning is required.', [
  ('Network evidence inventory', ['Inventory flows.csv and dns.csv, hash both and document collection assumptions.', 'Draw a topology using the two client addresses and named resolver; distinguish source/destination fields from device ownership.', 'Create a field dictionary including timestamp timezone, ports, byte counts and direction. State that packet payloads are not included.'], 'network_map.pdf, field_dictionary.csv and evidence_register.csv'),
  ('Baseline and outlier description', ['Group the supplied flows by source, destination and service; calculate event count and bytes for each group.', 'Describe the largest transfer relative to the rest of this small dataset; do not call it exfiltration based solely on size.', 'Match DNS responses to flows within a documented time window, marking multiple possible matches and missing queries.'], 'flow_summary.csv, dns_mapping.csv and interpretation_notes.pdf'),
  ('Flow and DNS timeline', ['Merge DNS and flow events into a UTC timeline with original record IDs.', 'Select one unusual sequence and compare a routine backup explanation with an unverified transfer explanation.', 'List the packet, endpoint and application evidence needed to resolve uncertainty; identify what metadata alone cannot reveal.'], 'network_timeline.csv, hypothesis_matrix.pdf and evidence_gaps.pdf'),
  ('Network investigation report', ['Prepare a 4-6 page report with a topology, aggregate tables, one chart and the selected event sequence.', 'Cite row IDs for every finding and distinguish measured values from assumptions.', 'Provide reproducible grouping/filter criteria and integrity checks so a reviewer can rebuild the results.'], 'network_report.pdf, analysis_tables.csv and reproducibility_notes.pdf')]),
 'cloud': ('Cloud Forensics', 'A provider-neutral fictional cloud audit export contains identity, object access and configuration events. It is a supplied log exercise with no need for credentials or live tenant access.', [
  ('Cloud audit scope and preservation', ['Inventory audit.jsonl and assets.csv; hash files and record the fictional tenant boundary.', 'Map event ID, principal, action, target, result and timestamp. Separate user principals from service accounts.', 'Write a preservation plan covering retention, export method and missing provider-side context.'], 'cloud_scope.pdf, evidence_register.csv and field_map.csv'),
  ('Identity and configuration review', ['Classify supplied events into authentication, object access and configuration changes.', 'Build a principal-action matrix and identify denied actions separately from successful access.', 'Review the configuration-change event and list what before/after state evidence would be required to judge its effect.'], 'principal_matrix.csv, access_review.csv and configuration_notes.pdf'),
  ('Object-access timeline', ['Correlate authentication, object reads and configuration events using event IDs and UTC time.', 'Compare a scheduled automation explanation with an unverified account-use explanation for the service activity.', 'Document gaps caused by export scope, log delay, shared credentials or absent content records; do not infer file contents from a read event.'], 'cloud_timeline.csv and confidence_assessment.pdf'),
  ('Cloud case report', ['Write a 4-6 page provider-neutral report describing scope, identity context, chronology and observed changes.', 'Cite the exact audit event IDs supporting each finding and note that these logs are fictional teaching data.', 'Deliver a handover pack with hashes, field map, principal matrix, queries or filters, and unresolved questions.'], 'cloud_report.pdf and cloud_appendix.zip')]),
 'database': ('Database Forensics', 'A fictional SQLite order ledger includes an audit trail. Examine a preserved copy using read-only access and compare recorded changes with final rows; this is not a production database investigation.', [
  ('Read-only database intake', ['Inventory training.db and schema.sql, compute SHA-256 values and preserve originals.', 'Open only a working copy in read-only mode. List tables, column meanings, primary keys and relationships.', 'Record engine/tool versions and explain the absence of transaction logs, original host context and a historical snapshot.'], 'schema_map.pdf, evidence_register.csv and read_only_method.pdf'),
  ('Integrity and consistency checks', ['Count rows by table and check duplicate order IDs, null required fields and references to missing customers.', 'Compare recorded order totals to quantities and unit prices, keeping the exact SELECT statements used.', 'Distinguish intentionally unusual training records from conclusions about misconduct; explain limitations of the supplied schema.'], 'checks.sql, integrity_results.csv and discrepancy_notes.pdf'),
  ('Audit trail reconstruction', ['Join audit records to orders using their identifiers and sort changes by timestamp.', 'Compare before_value, after_value and the final order amount. Flag a missing or inconsistent audit transition.', 'Explain why an application-level audit record is not a complete database transaction log or proof of actor identity.'], 'audit_timeline.csv, reconstruction.sql and limitations.pdf'),
  ('Database findings report', ['Write a 4-6 page report with schema, read-only method, integrity checks and a reconstruction of two selected orders.', 'Include query text, result excerpts, row IDs and the difference between observed inconsistency and attribution.', 'Re-hash the preserved original and provide a reproducibility appendix for all SELECT queries.'], 'database_report.pdf, queries.sql and results.zip')]),
 'iot': ('IoT & Digital Device Forensics', 'A fictional sensor export combines device inventory, telemetry and gateway events. Work only with supplied files; no hardware access, radio capture or device modification is needed.', [
  ('Device ecosystem mapping', ['Inventory devices.csv, telemetry.csv and gateway.csv; compute file hashes and assign evidence IDs.', 'Draw device-to-gateway relationships and list the device clock assumptions and measurement units.', 'Describe an appropriate preservation plan for a real device, while stating no actual hardware acquisition occurs in this exercise.'], 'ecosystem_map.pdf, evidence_register.csv and preservation_plan.pdf'),
  ('Telemetry quality review', ['Group readings by device and compute count, minimum, maximum and time gaps.', 'Identify duplicate sequence numbers, missing intervals and the deliberately offset sensor clock.', 'Decide whether each anomaly may reflect collection loss, clock drift or a device event; keep observations and hypotheses separate.'], 'telemetry_summary.csv, quality_flags.csv and reasoning.pdf'),
  ('Gateway and device correlation', ['Normalize time using a clearly stated clock-offset assumption; preserve raw device timestamps.', 'Correlate gateway reconnect events with telemetry gaps and flag matches that depend on an assumption.', 'Create a chronology with confidence and evidence references. Explain why a reconnect is not automatically evidence of tampering.'], 'iot_timeline.csv, clock_assumptions.pdf and correlation_table.csv'),
  ('IoT case report', ['Prepare a 4-6 page report with ecosystem diagram, telemetry quality results and correlated gateway chronology.', 'Explain the impact of clock differences, absent firmware history and unavailable physical-device context.', 'Include hashes, transformation notes, anomaly definitions and an independent-review checklist.'], 'iot_report.pdf and iot_appendix.zip')])
}

def write_csv(path, fields, rows):
 with path.open('w',newline='',encoding='utf-8') as f:
  writer=csv.writer(f);writer.writerow(fields);writer.writerows(rows)

def datasets(key, folder):
 folder.mkdir(parents=True,exist_ok=True)
 (folder/'README.txt').write_text('PFSA SYNTHETIC TRAINING DATA - v1.0\nAll identities, devices and events are fictional. Preserve originals, hash each file, and work on copies. Files are exports, not original media.\n',encoding='utf-8')
 stamp=lambda n:f'2026-11-17T09:{n:02d}:00Z'
 if key=='computer-cyber':
  write_csv(folder/'file_inventory.csv',['record_id','filename','version','modified_utc','size_bytes'],[[f'F{i}',f'report_v{1 if i<5 else 2}.txt',1 if i<5 else 2,stamp(i*3),100+i*17] for i in range(1,9)])
  write_csv(folder/'activity.csv',['event_id','timestamp','account_label','action','file_record'],[[f'A{i}',stamp(i*3+1),'analyst-A' if i<6 else 'service-B','open' if i%2 else 'save',f'F{i}'] for i in range(1,9)])
 elif key=='mobile':
  (folder/'device.json').write_text(json.dumps({'device':'TRAINING-PHONE-01','export':'logical teaching export','timezone':'+05:30','missing':['deleted_content','physical_image','complete_OS_history']},indent=2))
  write_csv(folder/'messages.csv',['message_id','timestamp','sender','direction','text'],[[f'M{i if i<8 else 7}',f'2026-11-17T14:{i*3:02d}:00+05:30','contact-A','in' if i%2 else 'out',f'Training message {i}'] for i in range(1,9)])
  write_csv(folder/'app_events.csv',['event_id','timestamp','app','event'],[[f'P{i}',stamp(i*3),'training-messenger','foreground' if i%2 else 'background'] for i in range(1,9)])
 elif key=='network':
  write_csv(folder/'flows.csv',['flow_id','timestamp','src','dst','dst_port','bytes'],[[f'N{i}',stamp(i*3),'192.0.2.10' if i%2 else '192.0.2.11','198.51.100.20',443,800000 if i==7 else i*250] for i in range(1,9)])
  write_csv(folder/'dns.csv',['event_id','timestamp','client','query','response'],[[f'D{i}',stamp(i*3-1),'192.0.2.10','storage.training.example','198.51.100.20'] for i in range(1,9)])
 elif key=='cloud':
  events=[{'event_id':f'C{i}','timestamp':stamp(i*3),'principal':'user-A' if i<5 else 'service-B','action':['sign_in','object_read','object_read','config_change'][i%4],'target':'training-bucket/object-A','result':'denied' if i==6 else 'success'} for i in range(1,13)]
  (folder/'audit.jsonl').write_text('\n'.join(json.dumps(e) for e in events)+'\n')
  write_csv(folder/'assets.csv',['asset_id','type','owner_label'],[['training-bucket','object_store','team-A'],['object-A','training_text','team-A']])
 elif key=='database':
  schema='CREATE TABLE customers(id INTEGER PRIMARY KEY,label TEXT); CREATE TABLE orders(id INTEGER PRIMARY KEY,customer_id INTEGER,quantity INTEGER,unit_price REAL,total REAL); CREATE TABLE audit(id INTEGER PRIMARY KEY,order_id INTEGER,ts TEXT,before_value REAL,after_value REAL,actor TEXT);'
  (folder/'schema.sql').write_text(schema)
  db=folder/'training.db'
  if db.exists():db.unlink()
  c=sqlite3.connect(db);c.executescript(schema)
  c.executemany('INSERT INTO customers VALUES(?,?)',[(1,'customer-A'),(2,'customer-B')])
  c.executemany('INSERT INTO orders VALUES(?,?,?,?,?)',[(1,1,2,100,180),(2,2,1,200,200),(3,99,2,50,100)])
  c.executemany('INSERT INTO audit VALUES(?,?,?,?,?,?)',[(1,1,stamp(5),200,190,'clerk-A'),(2,1,stamp(10),190,180,'clerk-A'),(3,2,stamp(15),180,190,'service-B')]);c.commit();c.close()
 else:
  write_csv(folder/'devices.csv',['device_id','gateway','clock_offset_seconds','unit'],[['sensor-A','gateway-1',0,'Celsius'],['sensor-B','gateway-1',120,'Celsius']])
  write_csv(folder/'telemetry.csv',['reading_id','device_id','timestamp','sequence','value'],[[f'T{i}','sensor-A' if i%2 else 'sensor-B',stamp(i*3),7 if i==8 else i,21+i/10] for i in range(1,13) if i!=6])
  write_csv(folder/'gateway.csv',['event_id','timestamp','device_id','event'],[['G1',stamp(16),'sensor-B','disconnect'],['G2',stamp(22),'sensor-B','reconnect'],['G3',stamp(28),'sensor-A','heartbeat']])
 files=list(folder.iterdir())
 write_csv(folder/'manifest.csv',['filename','sha256','size_bytes'],[[p.name,hashlib.sha256(p.read_bytes()).hexdigest(),p.stat().st_size] for p in files])
 archive=PUBLIC/f'{key}-training-data.zip'
 with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
  for p in folder.iterdir():z.write(p,p.name)

styles=getSampleStyleSheet()
styles.add(ParagraphStyle(name='GuideTitle',fontName='Helvetica-Bold',fontSize=26,leading=31,textColor=colors.HexColor('#142542'),spaceAfter=20))
styles.add(ParagraphStyle(name='GuideSub',fontName='Helvetica-Bold',fontSize=17,leading=22,textColor=colors.HexColor('#956b20'),spaceAfter=13))
styles.add(ParagraphStyle(name='GuideBody',fontName='Helvetica',fontSize=10.5,leading=16,spaceAfter=11))
styles.add(ParagraphStyle(name='GuideSmall',fontName='Helvetica',fontSize=9,leading=13,spaceAfter=8))
def P(text,style='GuideBody'):return Paragraph(html.escape(text),styles[style])
def chrome(canvas,doc):
 canvas.setStrokeColor(colors.HexColor('#c49b50'));canvas.setLineWidth(1);canvas.line(42,799,553,799)
 canvas.setFont('Helvetica-Bold',9);canvas.setFillColor(colors.HexColor('#142542'));canvas.drawString(42,813,'PRAMAAN FORENSICS ACADEMY')
 canvas.setFont('Helvetica',8);canvas.drawString(42,28,'PFSA | Training task guide | v1.0 | 11 November 2026');canvas.drawRightString(553,28,str(doc.page))

manifest=[]
for key,(title,scenario,weeks) in DATA.items():
 datasets(key,OUT/'datasets'/key)
 story=[Spacer(1,22),P(title,'GuideTitle'),P('Four-week internship task & guidance guide','GuideSub'),P(scenario),P('Working format','GuideSub'),P('Four independent weekly submissions, each assessed out of 100. Each upload must include a PDF report and a separate description of at least 200 words in the student portal. Complete weeks 1-4 in order; early completion is permitted. Calendar deadlines are set by academy staff, not inferred from this guide.'),P('What you need','GuideSub'),P('A laptop, spreadsheet editor, PDF exporter and a SHA-256 hashing utility. The database domain also needs a SQLite viewer that supports read-only mode. Use only the accompanying synthetic dataset and document every transformation.'),P('Evidence pack','GuideSub'),P(f'Download {key}-training-data.zip beside this PDF on the website. The ZIP includes source exports, a README and a SHA-256 manifest. These are deliberately small teaching exports, not a complete forensic image. All identities and events are fictional.'),P('Learning outcomes','GuideSub'),P('Preserve integrity; document a reproducible examination; correlate evidence cautiously; separate observation from inference; communicate supported findings and limitations.'),PageBreak()]
 for number,(heading,steps,deliverables) in enumerate(weeks,1):
  story += [P(f'WEEK {number}','GuideSub'),P(heading,'GuideTitle'),P('Goal: '+['Establish scope and a verifiable evidence baseline.','Examine source records and document defensible observations.','Correlate sources and evaluate competing explanations.','Present a reproducible, evidence-supported conclusion.'][number-1]),P('Task checklist','GuideSub')]
  for index,step in enumerate(steps,1):story.append(P(f'{index}. {step}'))
  story += [P('Required hand-in','GuideSub'),P(deliverables),P('Portal description','GuideSub'),P('Write at least 200 words in your own language explaining your method, source files and row/event IDs, observations, assumptions, uncertainty and learning. Put this text in the description box as well as any report appendix. Do not use filler to satisfy the word count.'),P('Quality checks before upload','GuideSub'),P('Keep the original evidence unchanged. Preserve raw timestamps and units. Identify tool versions and filters. Cite evidence IDs in findings. Recompute hashes of preserved files and include the result. Name your main file PFSA_<student-id>_'+key+f'_W{number}.pdf. Supporting tables may be placed in one ZIP. Keep the uploaded file below 10 MB.'),P('Week assessment: integrity 20 | method 25 | analysis 25 | evidence references 20 | clarity 10','GuideSmall'),PageBreak()]
 story += [P('Assessment & handover','GuideTitle'),P('Each week: 100 marks','GuideSub')]
 rows=[['Criterion','Marks','Expected evidence'],['Integrity and scope','20','Hashes, scope, preserved originals'],['Method and reproducibility','25','Clear steps, versions, filters or queries'],['Analysis and reasoning','25','Supported observations and alternatives'],['Evidence references','20','Exact file and row/event references'],['Communication','10','Clear report and 200-word portal narrative']]
 table=Table(rows,colWidths=[142,44,310]);table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#142542')),('TEXTCOLOR',(0,0),(-1,0),colors.white),('FONTNAME',(0,0),(-1,0),'Helvetica-Bold'),('FONTSIZE',(0,0),(-1,-1),9),('VALIGN',(0,0),(-1,-1),'TOP'),('TOPPADDING',(0,0),(-1,-1),10),('BOTTOMPADDING',(0,0),(-1,-1),10),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.HexColor('#f4f6fa'),colors.white])]))
 story += [table,Spacer(1,20),P('Academic integrity','GuideSub'),P('State which tools or writing assistance you used. Submit your own analysis and explain any reused template. A confident unsupported claim is weaker than a clearly stated uncertainty. This guide does not confer professional licensing, accreditation or an official affiliation.'),P('Completion documents','GuideSub'),P('Four submitted weeks unlock the document request stage. Assessment, payment confirmation and publication remain staff-controlled. A recommendation depends on evaluation; it is not automatic.'),P('Further reading','GuideSub'),P('NIST SP 800-86: Guide to Integrating Forensic Techniques into Incident Response.\nhttps://csrc.nist.gov/pubs/sp/800/86/final','GuideSmall')]
 if key=='mobile':story.append(P('NIST SP 800-101 Rev. 1: Guidelines on Mobile Device Forensics.\nhttps://csrc.nist.gov/pubs/sp/800/101/r1/final','GuideSmall'))
 story += [P('These publications are background reading. PFSA authored the task sequence and synthetic evidence pack; NIST has not endorsed this programme.','GuideSmall')]
 path=PUBLIC/f'{key}-task-guide.pdf'
 SimpleDocTemplate(str(path),pagesize=(595.28,841.89),rightMargin=46,leftMargin=46,topMargin=63,bottomMargin=48,title=f'{title} - PFSA four-week task guide',author='Pramaan Forensics Academy').build(story,onFirstPage=chrome,onLaterPages=chrome)
 reader=PdfReader(path)
 assert len(reader.pages)==6,(key,len(reader.pages))
 assert all(page.extract_text().strip() for page in reader.pages)
 shutil.copy2(path,OUT/path.name)
 shutil.copy2(PUBLIC/f'{key}-training-data.zip',OUT/f'{key}-training-data.zip')
 manifest.append({'programme':key,'title':title,'url':f'/guides/{key}-task-guide.pdf','dataset':f'/guides/{key}-training-data.zip','weeks':[{'week':i,'title':w[0],'description':' '.join(w[1]),'deliverables':w[2]} for i,w in enumerate(weeks,1)]})
(ROOT/'lib'/'domain-guides.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print('Generated and text-verified: 6 guides, 36 pages, 6 synthetic evidence packs.')
