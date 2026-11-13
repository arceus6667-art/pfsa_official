import type {Profile} from '@/lib/pfsa-cloud';

export function SupportSender({profile,userId}:{profile?:Pick<Profile,'id'|'name'|'email'>;userId:string|null}){
 return <dl className="cloud-support-sender" aria-label="Message sender">
  <div><dt>Sender name</dt><dd>{profile?.name||'Name unavailable'}</dd></div>
  <div><dt>Student ID</dt><dd>{userId||'ID unavailable'}</dd></div>
  <div><dt>Email address</dt><dd>{profile?.email?<a href={'mailto:'+encodeURIComponent(profile.email)}>{profile.email}</a>:'Email unavailable'}</dd></div>
 </dl>;
}
