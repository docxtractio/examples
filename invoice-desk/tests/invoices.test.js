// Date: 2026-09-06
// Author: Alok
// File: invoice-desk/tests/invoices.test.js
// Purpose: Verify invoice arithmetic, missing data and API SDK contracts.
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {analyse,number} from '../includes/invoices.js';
import {createServer} from '../server.js';
const valid=()=>({invoice_number:'1',vendor:{name:'Vendor'},currency:'USD',line_items:[{description:'Item',quantity:2,rate:10,amount:20}],subtotal:20,tax:2,total:22});
test('valid arithmetic and zero tax pass',()=>{assert.equal(analyse(valid()).status,'Validated');assert.equal(analyse({...valid(),tax:0,total:20}).status,'Validated');});
test('wrong quantity calculation is flagged even when header balances',()=>{const d=valid();d.line_items[0].quantity=3;assert.equal(analyse(d).issues[0].code,'total_mismatch');});
test('missing tax, quantities and totals cannot validate',()=>{const d=valid();delete d.tax;assert.equal(analyse(d).status,'Review required');d.line_items[0].quantity='';assert.equal(analyse(d).checks[0].passed,false);assert.equal(analyse({}).status,'Review required');});
test('discount, shipping, rounding and split taxes reconcile',()=>{const d=valid();delete d.tax;Object.assign(d,{cgst:1,sgst:1,discount:2,shipping:3,round_off:0.5,total:23.5});assert.equal(analyse(d).status,'Validated');});
test('mapping supports nested alternative schema and explicit nulls',()=>{const d={Header:{...valid()},Rows:valid().line_items};const mapping=Object.fromEntries(['number','vendor','currency','subtotal','tax','total'].map(k=>[k,'Header.'+({number:'invoice_number',vendor:'vendor.name'}[k]||k)]));mapping.items='Rows';assert.equal(analyse(d,{mapping}).status,'Validated');});
test('numeric parsing rejects ambiguous comma decimals and booleans',()=>{assert.equal(number('1,234.50'),1234.5);assert.equal(number('1,23'),null);assert.equal(number(true),null);assert.equal(number('(5.00)'),-5);assert.equal(number(''),null);});
test('invalid tolerance is rejected',()=>assert.throws(()=>analyse(valid(),{tolerance:-1})));
test('local API enforces origins, uses documented options and cleans uploads',async()=>{let temp,options,key;class Mock{constructor(config){key=config.apiKey;}async models(){return ['invoice'];}async extract(file,opts){temp=file;options=opts;assert.ok(existsSync(temp));return {data:valid(),meta:{},complete:true};}}const server=createServer(Mock);await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;const post=(action,data,headers={})=>fetch(base+'/api/'+action,{method:'POST',headers:{'Content-Type':'application/json','X-Desk-Request':'1',...headers},body:JSON.stringify(data)});try{let r=await post('extract',{apiKey:'sk_test',file:{name:'invoice.pdf',content:Buffer.from('%PDF-1.4 mock').toString('base64')},settings:{documentType:'invoice',model:''}});assert.equal(r.status,200);assert.equal((await r.json()).status,'Validated');assert.deepEqual(options,{document_type:'invoice',store_db:false});assert.equal(key,'sk_test');await new Promise(r=>setTimeout(r,30));assert.equal(existsSync(temp),false);r=await post('connect',{apiKey:'sk_test'},{Origin:'https://other.example'});assert.equal(r.status,403);r=await fetch(base+'/server.js');assert.equal(r.status,404);r=await post('extract',{apiKey:'sk_test',file:{name:'script.php',content:'YWJj'}});assert.equal(r.status,400);r=await post('connect',{apiKey:'invalid'});assert.equal(r.status,400);}finally{await new Promise(r=>server.close(r));}});
