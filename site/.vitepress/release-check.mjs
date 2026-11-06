// Included inline in every rendered page so cached HTML can discover a new release.
export function releaseCheck(version, base) {
  return `(()=>{if(!/^https?:$/.test(location.protocol))return;const current=${JSON.stringify(version)};fetch(${JSON.stringify(base + 'release.json')}+'?t='+Date.now(),{cache:'no-store'}).then(r=>r.ok?r.json():null).then(release=>{if(!release||typeof release.version!=='string'||release.version===current)return;const url=new URL(location.href);if(url.searchParams.get('v')===release.version)return;url.searchParams.set('v',release.version);location.replace(url.href)}).catch(()=>{})})();`;
}
