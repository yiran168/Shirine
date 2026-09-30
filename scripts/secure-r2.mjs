// Run only after both application deployments succeed. The bound R2 bucket
// serves assets through /api/blob; direct public domains bypass that ACL.
const account=process.env.CLOUDFLARE_ACCOUNT_ID;
const token=process.env.CLOUDFLARE_API_TOKEN;
const bucket=process.env.R2_BUCKET_NAME || "shirine-storage";
if(!account||!token)throw new Error("Cloudflare credentials are required to verify R2 privacy");
const base=`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/r2/buckets/${encodeURIComponent(bucket)}/domains`;
async function call(suffix,method="GET",body){
  const response=await fetch(base+suffix,{method,headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
  const data=await response.json();
  if(!response.ok||!data.success)throw new Error(`R2 privacy API failed (${response.status}): ${JSON.stringify(data.errors||[])}`);
  return data.result;
}
const managed=await call('/managed');
const custom=await call('/custom');
if(managed.enabled)await call('/managed','PUT',{enabled:false});
for(const domain of custom.domains||[])if(domain.enabled)await call(`/custom/${encodeURIComponent(domain.domain)}`,'PUT',{enabled:false});
const verified=await call('/managed');
const domains=await call('/custom');
if(verified.enabled||(domains.domains||[]).some(d=>d.enabled))throw new Error('R2 still has public access enabled');
console.log(`R2 bucket ${bucket}: public r2.dev and custom-domain access disabled; Worker binding retained.`);
