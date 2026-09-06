// Date: 2026-09-06
// Author: Alok
// File: po-invoice-matcher/public/assets/main.js
// Purpose: Shared safe rendering, local storage, API calls and export utilities.
'use strict';
window.Desk = (() => {
 const escape = v => String(v ?? '—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money = v => typeof v==='number' && Number.isFinite(v) ? v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) : '—';
 const read = (storage,key,fallback) => { try { const value=JSON.parse(storage.getItem(key));return value??fallback; } catch { return fallback; } };
 const save = (storage,key,value) => { try { storage.setItem(key,JSON.stringify(value));return true; } catch { notice('Browser storage is full or unavailable. Export your results before closing this tab.','warning');return false; } };
 function notice(message,type='info') { $('#feedback').removeClass('d-none alert-info alert-danger alert-success alert-warning').addClass('alert-'+type).text(message); }
 async function api(action,payload) {
  let response;try { response=await fetch('/api/'+action,{method:'POST',headers:{'Content-Type':'application/json','X-Desk-Request':'1'},body:JSON.stringify(payload)}); } catch { throw new Error('Cannot reach the local app. Check that its server is still running.'); }
  let data;try { data=await response.json(); } catch { throw new Error('The server did not return JSON. Check the terminal and restart the app.'); }
  if(!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);return data;
 }
 const fileData = file => new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve({name:file.name,content:reader.result.split(',')[1]});reader.onerror=()=>reject(new Error('Could not read '+file.name));reader.readAsDataURL(file);});
 function download(name,content,type) { const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000); }
 function csv(rows) { if(!rows.length)return '';const keys=[...new Set(rows.flatMap(row=>Object.keys(row)))];const cell=value=>{let s=value==null?'':typeof value==='object'?JSON.stringify(value):String(value);if(typeof value!=='number'&&/^[\s]*[=+\-@]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};return '\ufeff'+[keys,...rows.map(row=>keys.map(k=>row[k]))].map(row=>row.map(cell).join(',')).join('\r\n'); }
 const pill = (text,ok=false,error=false) => `<span class="status-pill ${error?'error':ok?'ok':'review'}">${escape(text)}</span>`;
 const empty = (title,description,icon='file-earmark-text') => `<div class="empty-state"><i class="bi bi-${icon}" aria-hidden="true"></i><strong>${escape(title)}</strong><p>${escape(description)}</p></div>`;
 const table = (head,rows) => `<div class="table-responsive"><table class="table"><thead><tr>${head.map(h=>`<th scope="col">${escape(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
 const checks = rows => `<div class="checks">${rows.map(c=>`<div class="check ${c.passed?'passed':'failed'}"><i class="bi bi-${c.passed?'check-circle':'exclamation-circle'}" aria-hidden="true"></i><span>${escape(c.label)}</span><span class="values">Expected ${escape(typeof c.expected==='number'?money(c.expected):c.expected)} · Actual ${escape(typeof c.actual==='number'?money(c.actual):c.actual)}${c.difference!=null?' · Δ '+money(c.difference):''}</span></div>`).join('')}</div>`;
 const tags = (items,style='') => `<div class="skill-tags">${(items || []).map(v=>`<span class="skill-tag ${style}">${escape(v)}</span>`).join('') || '—'}</div>`;
 return {escape,money,read,save,notice,api,fileData,download,csv,pill,empty,table,checks,tags};
})();
