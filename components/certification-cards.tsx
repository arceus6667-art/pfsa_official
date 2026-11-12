"use client";
import { useEffect, useRef, useState } from 'react';
import { addRecord, uploadFile, openFile, cloud, type CloudRecord } from '@/lib/pfsa-cloud';
import { downloadOffer } from '@/lib/offer-download';
import { orderName, firstOrder, orderReady, reviewDue } from '@/lib/document-order';
import { documentPrice, PRICING_VERSION, type DocumentPackage } from '@/lib/document-pricing';
import { paymentAmount } from '@/lib/admin-report';
type Pack = DocumentPackage;
export function CertificationCards({ records, userId, email, programme, completed, busy, run }: {
 records: CloudRecord[]; userId: string; email?: string; programme?: string; completed: boolean; busy: boolean;
 run: (action: () => Promise<unknown>, success?: string) => Promise<void>;
}) {
 const [pack, setPack] = useState<Pack | null>(null);
 const [accepted, setAccepted] = useState(false);
 const [policyReady, setPolicyReady] = useState(false);
 useEffect(() => { let active = true; void Promise.all([cloud.rpc('pfsa_order_policy_version'), cloud.rpc('pfsa_pricing_version')]).then(([policy, pricing]) => { if(active) setPolicyReady(!policy.error && policy.data === 'one-payment-v1' && !pricing.error && pricing.data === PRICING_VERSION); }); return () => {active=false;}; }, []);
 const submitting = useRef(false);
 const [submitted, setSubmitted] = useState<CloudRecord | null>(null);
 const order = firstOrder(records) || submitted;
 const docs = records.filter(r => r.kind === 'document' && r.data.programme === programme && r.data.status === 'published');
 const offer = docs.find(r => r.data.type === 'Offer Letter');
 const experience = docs.find(r => ['Letter of Experience','Certificate of Experience','Letter of Completion'].includes(String(r.data.type)));
 const recommendation = docs.find(r => r.data.type === 'Letter of Recommendation');
 const download = (doc: CloudRecord) => run(() => doc.data.path ? openFile(String(doc.data.path)) : downloadOffer(doc), 'Download ready.');
 const choose = (value: Pack) => { if (!order && !busy) { setAccepted(false); setPack(value); } };
 const canBuy = completed && !busy && !order && policyReady;
 const due = order ? reviewDue(order,records) : null;
 const ready = order ? orderReady(order, docs) : false;
 return <section>
  <h2>Your internship documents</h2>
  {!policyReady && !order && <p role="status">Checkout is awaiting the academy payment protection and pricing update. Please contact Support before paying.</p>}
  {order && <div className="cloud-order-status" role="status">
   <small>YOUR DOCUMENT ORDER · {order.id.slice(0,8).toUpperCase()}</small>
   <h3>{ready ? 'Your documents are available' : order.data.order_type==='early_start'&&!completed?'Early Start payment submitted':'Congratulations on submitting your internship work!'}</h3>
   <p><strong>{orderName(String(order.data.package))}</strong> · ₹{paymentAmount(order)}</p>
   <p>{ready ? 'Download your published documents below.' : order.data.status === 'follow-up' ? 'Your order needs staff follow-up. Please contact Support; do not pay again.' : order.data.order_type==='early_start'&&!completed?'Your learning access is open. Complete all four weekly tasks. Staff will verify your payment and assess the completed work before issuing documents.':'Your payment and projects are being reviewed by our team. Payment confirmation requires staff verification.'}</p>
   <p>Estimated processing time: <strong>{order.data.order_type==='early_start'?'six hours after payment details and all four weekly submissions are received':'six hours from your payment submission'}</strong>{due ? ` (estimated by ${due.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })} IST)` : ''}. This is an estimate, subject to payment and project approval.</p>
   {!ready && due && Date.now() > due.getTime() && <p>The estimated processing time has passed. Please contact Support for an update.</p>}
   <p>Your ordered documents will be available in this portal and emailed by our team to <strong>{email || 'your registered email address'}</strong> after approval.</p>
   <p>{order.data.email_delivered_at ? `Staff recorded email delivery on ${new Date(String(order.data.email_delivered_at)).toLocaleString('en-IN')}.` : 'Email delivery: awaiting staff dispatch.'}</p>
   <strong>Order already submitted. No further payment is required or permitted.</strong>
  </div>}
  <div className="cloud-grid certification-cards">
   <article><small>INCLUDED WITH ENROLMENT</small><h3>Offer Letter</h3><p>Your domain-specific internship offer is issued when you enrol.</p><button disabled={busy || !offer} onClick={() => offer && download(offer)}>{offer ? 'Download offer letter' : 'Preparing your offer letter'}</button>{offer && <p><a href={'/verify?number=' + offer.data.number}>Verify offer →</a></p>}</article>
   <article><small>₹{documentPrice('experience')} · PDF</small><h3>Certificate of Experience</h3><p>{completed ? 'Available after payment and staff review of your four weekly projects.' : 'Complete all four weekly tasks to unlock.'}</p>{experience ? <button disabled={busy} onClick={() => download(experience)}>Download certificate</button> : <button disabled={!canBuy} onClick={() => choose('experience')}>{order ? 'Order submitted · see status above' : completed ? `Buy experience certificate · ₹${documentPrice('experience')}` : 'Locked'}</button>}</article>
   <article><small>₹{documentPrice('recommendation')} · PDF</small><h3>Letter of Recommendation</h3><p>{completed ? 'Subject to payment verification and staff assessment of your work.' : 'Complete all four weekly tasks to unlock.'}</p>{recommendation ? <button disabled={busy} onClick={() => download(recommendation)}>Download recommendation</button> : <button disabled={!canBuy} onClick={() => choose('recommendation')}>{order ? 'Order submitted · see status above' : completed ? `Buy recommendation · ₹${documentPrice('recommendation')}` : 'Locked'}</button>}</article>
  </div>
  {!order && <div className="cloud-bundle"><div><h3>Get both documents together · ₹{documentPrice('bundle')}</h3><p>Certificate of Experience + Letter of Recommendation. Choose carefully: only one document order and one payment submission are allowed.</p></div><button disabled={!canBuy} onClick={() => choose('bundle')}>{completed ? `Choose combined package · ₹${documentPrice('bundle')}` : 'Complete four tasks to unlock'}</button></div>}
  {pack && completed && !order && <form className="cloud-form" onSubmit={e => {
   e.preventDefault();
   if (!accepted || submitting.current || busy || order) return;
   const form = e.currentTarget;
   submitting.current = true;
   void run(async () => {
    const [policy, pricing] = await Promise.all([cloud.rpc('pfsa_order_policy_version'), cloud.rpc('pfsa_pricing_version')]);
    if (pricing.error || pricing.data !== PRICING_VERSION) throw new Error('Document pricing is being updated. Refresh the portal before paying.');
    if (policy.error || policy.data !== 'one-payment-v1') throw new Error('Checkout is awaiting the academy database update. Please contact Support before paying.');
    const data = new FormData(form), file = data.get('file') as File;
    const path = file?.size ? await uploadFile(file, userId) : '';
    const result = await addRecord('payment', userId, { programme: programme || '', package: pack, amount: documentPrice(pack), price_version: PRICING_VERSION, utr: String(data.get('utr') || '').trim(), path, status: 'pending', terms_accepted: 1, terms_version: 'PFSA-DOCUMENTS-2026-11-12' });
    setSubmitted(result); setPack(null); setAccepted(false);
   }, 'Your order is submitted for manual review. Please do not pay again.').finally(() => { submitting.current = false; });
  }}>
   <h3>{orderName(pack)} · ₹{documentPrice(pack)}</h3>
   <div className="cloud-payment-terms"><h3>Before you pay</h3><p>Congratulations on completing your four weekly submissions! Our team will verify your payment and assess your projects before issuing {orderName(pack)}.</p><p>Allow an estimated six hours from payment submission. Approved documents will be available in this portal and emailed to {email || 'your registered email address'}. Processing can take longer if verification needs follow-up.</p><p>Only one order is allowed. Confirm your selected package before paying. A UTR or screenshot does not automatically verify payment.</p><label className="cloud-consent"><input type="checkbox" required checked={accepted} onChange={e => setAccepted(e.target.checked)} disabled={busy}/><span>I accept these terms, including the estimated six-hour review, payment and project verification, and delivery to my registered email and portal.</span></label></div>
   {accepted && policyReady && <><p>Pay once through GPay / UPI using the academy QR, then submit your transaction reference for staff review.</p><img className="cloud-qr" src="/assets/payment-qr.png" alt="Academy UPI payment QR"/><label>Transaction reference / UTR<input name="utr" required disabled={busy}/></label><label>Payment screenshot (optional)<input name="file" type="file" accept=".png,.jpg,.jpeg,.pdf" disabled={busy}/></label></>}
   <button disabled={busy || !accepted || !policyReady}>{busy ? 'Submitting…' : 'Submit payment for review'}</button><button type="button" disabled={busy} onClick={() => { setPack(null); setAccepted(false); }}>Cancel</button>
  </form>}
 </section>;
}
