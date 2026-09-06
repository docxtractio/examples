// Date: 2026-09-06
// Author: Alok
// File: invoice-desk/server.js
// Purpose: Serve Invoice Desk and call the official server-side DocXtract SDK.
import http from 'node:http';
import {readFile, mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DocXtract} from '@docxtract/sdk';
import {config} from './includes/config.js';
import {analyse} from './includes/invoices.js';
const root = path.dirname(fileURLToPath(import.meta.url));
const headers = {'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', 'X-Frame-Options':'DENY', 'Referrer-Policy':'no-referrer', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'"};
const json = (res, status, data) => { res.writeHead(status, {...headers,'Content-Type':'application/json'}); res.end(JSON.stringify(data)); };
async function body(req) { let size=0, chunks=[]; for await(const chunk of req) { size+=chunk.length; if(size>15*1024*1024) throw new Error('Request exceeds 15 MB.'); chunks.push(chunk); } return JSON.parse(Buffer.concat(chunks).toString()); }
export function createServer(Client = DocXtract) { return http.createServer(async(req,res) => {
 let folder;
 try {
  const url = new URL(req.url, 'http://localhost'), host = req.headers.host || '';
  if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return json(res,403,{error:'Local access only.'});
  if(req.method==='GET' && url.pathname==='/api/health') return json(res,200,{ok:true,app:'invoice'});
  if(req.method==='GET' && url.pathname==='/') { const parts=await Promise.all(['preheader','header','workspace','footer'].map(n=>readFile(path.join(root,'includes',n+'.php'),'utf8'))); res.writeHead(200,{...headers,'Content-Type':'text/html; charset=utf-8'}); return res.end(parts.join('\n').replaceAll('{{APP}}','invoice').replaceAll('{{TITLE}}','Invoice Desk').replaceAll('{{STACK}}','Node.js')); }
  if(req.method==='GET' && /^\/assets\/[\w./-]+$/.test(url.pathname)) { const file=path.resolve(root,'public','.'+url.pathname); if(!file.startsWith(path.join(root,'public','assets')+path.sep)) return json(res,404,{error:'Not found.'}); const types={'.css':'text/css','.js':'text/javascript','.woff2':'font/woff2','.woff':'font/woff'}; const data=await readFile(file);res.writeHead(200,{...headers,'Content-Type':types[path.extname(file)]||'application/octet-stream'});return res.end(data); }
  if(req.method!=='POST' || !['/api/connect','/api/extract','/api/analyse'].includes(url.pathname)) return json(res,404,{error:'Not found.'});
  if(req.headers['x-desk-request']!=='1' || (req.headers.origin && req.headers.origin!==`http://${host}`)) return json(res,403,{error:'Invalid request origin.'});
  const data=await body(req);
  if(url.pathname==='/api/analyse') return json(res,200,analyse(data.raw,data.settings));
  if(typeof data.apiKey!=='string' || !data.apiKey.startsWith('sk_')) return json(res,400,{error:'Enter a valid DocXtract API key in Settings.'});
  const dx = new Client({apiKey:data.apiKey, maxRetries:2});
  if(url.pathname==='/api/connect') return json(res,200,{models:await dx.models()});
  const {file,settings={}}=data, ext=path.extname(file?.name || '').toLowerCase();
  if(!['.pdf','.png','.jpg','.jpeg'].includes(ext) || typeof file?.content!=='string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(file.content)) throw new Error('Upload a PDF, JPG, or PNG.');
  const bytes=Buffer.from(file.content,'base64'); if(!bytes.length || bytes.length>config.maxBytes) throw new Error('Files must be between 1 byte and 10 MB.');
  folder=await mkdtemp(path.join(tmpdir(),'invoice-desk-')); const filename=path.join(folder,'document'+ext); await writeFile(filename,bytes,{mode:0o600});
  const options={document_type:settings.documentType || config.documentType,store_db:false}; if(settings.model?.trim()) options.model=settings.model.trim();
  const result=await dx.extract(filename,options);
  return json(res,200,{raw:result.data,meta:result.meta,complete:result.complete,...analyse(result.data,settings)});
 } catch(error) { const status=error.code==='ENOENT'?404:error.status>=400&&error.status<600?error.status:400; json(res,status,{error:error.message?.replace(/sk_[A-Za-z0-9_-]+/g,'[redacted]') || 'Request failed.',code:error.code || 'request_failed'}); }
 finally { if(folder) await rm(folder,{recursive:true,force:true}); }
}); }
if(process.argv[1]===fileURLToPath(import.meta.url)) createServer().listen(config.port,'127.0.0.1',()=>console.log(`Invoice Desk: http://127.0.0.1:${config.port}\nOpen the launch guide, create a profile, connect your key, then upload invoices.\nTry sample data without an API key.`));
