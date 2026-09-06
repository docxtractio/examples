// Date: 2026-09-06
// Author: Alok
// File: po-invoice-matcher/public/assets/samples.js
// Purpose: Synthetic sample extraction data for offline demonstrations.
'use strict';
window.DeskSamples = {
 invoice:[
  {name:'Northstar-INV-1042.pdf',raw:{invoice_number:'INV-1042',invoice_date:'2026-09-01',vendor:{name:'Northstar Supplies'},currency:'USD',line_items:[{sku:'DSK-01',description:'Desk organizers',quantity:10,rate:25,amount:250},{sku:'NTB-02',description:'Recycled notebooks',quantity:20,rate:8,amount:160}],subtotal:410,tax:41,total:451}},
  {name:'Acme-INV-2088.pdf',raw:{invoice_number:'INV-2088',invoice_date:'2026-09-02',vendor:{name:'Acme Studio'},currency:'USD',line_items:[{sku:'MON-27',description:'27-inch monitors',quantity:3,rate:200,amount:650}],subtotal:650,tax:65,total:715}},
  {name:'Cedar-INV-3091.pdf',raw:{invoice_number:'INV-3091',invoice_date:'2026-09-03',vendor:{name:'Cedar Office'},currency:'USD',line_items:[{description:'Printer paper',quantity:12,rate:5,amount:60}],subtotal:60,total:66}}
 ],
 resume:[
  {name:'Alex-Morgan-CV.pdf',raw:{name:'Alex Morgan',skills:['Python','SQL','REST APIs','Docker'],years_of_experience:5,work_experience:[{title:'Backend Engineer',company:'Example Systems',start_date:'2021-01-01',end_date:'2026-01-01'}]}},
  {name:'Sam-Rivera-CV.pdf',raw:{name:'Sam Rivera',skills:['Python','SQL','Tableau'],years_of_experience:2,work_experience:[{title:'Data Analyst',company:'Sample Analytics'}]}},
  {name:'Jordan-Lee-CV.pdf',raw:{name:'Jordan Lee',skills:['Python','REST APIs'],work_experience:[{title:'Developer',company:'Demo Labs'}]}}
 ],
 criteria:{text:'Backend Engineer\nRequired skills: Python, SQL, REST APIs\nMinimum experience: 3 years\nBuild and maintain reliable services and data integrations.',skills:'Python, SQL, REST APIs',minYears:3,skillWeight:80},
 pair:{
  po:{name:'PO-2026-014.pdf',raw:{po_number:'PO-2026-014',vendor:{name:'Northstar Supplies'},currency:'USD',line_items:[{sku:'MON-27',description:'27-inch monitor',quantity:4,rate:200,amount:800,tax:80},{sku:'KBD-01',description:'Wireless keyboard',quantity:4,rate:40,amount:160,tax:16}],subtotal:960,tax:96,total:1056}},
  invoice:{name:'INV-2026-082.pdf',raw:{invoice_number:'INV-2026-082',po_number:'PO-2026-014',vendor:{name:'Northstar Supplies'},currency:'USD',line_items:[{sku:'MON-27',description:'27-inch monitor',quantity:5,rate:200,amount:1000,tax:100},{sku:'KBD-01',description:'Wireless keyboard',quantity:4,rate:45,amount:180,tax:18}],subtotal:1180,tax:118,total:1298}}
 }
};
