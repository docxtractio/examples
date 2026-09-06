// Date: 2026-09-06
// Author: Alok
// File: invoice-desk/includes/invoices.js
// Purpose: Normalize invoice fields and explain arithmetic exceptions.
export const aliases = {
 number: 'invoice_number|invoice_no|invoiceNumber', vendor: 'vendor.name|supplier.name|vendor_name|supplier_name|vendor', currency: 'currency|currency_code',
 date: 'invoice_date|date', subtotal: 'subtotal|sub_total|taxable_amount', tax: 'tax|total_tax|tax_amount', total: 'total|grand_total|invoice_total|total_amount',
 discount: 'discount|discount_amount', shipping: 'shipping|shipping_amount|freight', rounding: 'rounding|round_off', items: 'line_items|items|invoice_items',
 description: 'description|item_description|name', sku: 'sku|item_code|product_code', quantity: 'quantity|qty', rate: 'rate|unit_price|price', amount: 'amount|line_total|total', itemDiscount: 'discount|discount_amount'
};
const key = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
export function field(data, paths) {
 for (const path of String(paths || '').split('|')) {
  let value = data;
  for (const part of path.split('.')) { const k = value && typeof value === 'object' ? Object.keys(value).find(k => key(k) === key(part)) : undefined; value = k === undefined ? undefined : value[k]; }
  if (value !== undefined && value !== null && value !== '') return value;
 }
 return null;
}
export function number(value) {
 if (typeof value === 'number') return Number.isFinite(value) ? value : null;
 if (typeof value !== 'string' || !value.trim()) return null;
 let s = value.trim().replace(/^(?:USD|INR|EUR|GBP|[$₹€£])\s*/i, '').replace(/\s*(?:USD|INR|EUR|GBP)$/i, '');
 if (/^\(.*\)$/.test(s)) s = '-' + s.slice(1, -1);
 if (s.includes(',') && !/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) return null;
 s = s.replaceAll(',', ''); return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null;
}
const round = n => Math.round((n + Number.EPSILON) * 100) / 100;
export function analyse(raw, settings = {}) {
 const map = {...aliases, ...(settings.mapping || {})}, get = (name, source = raw) => field(source, map[name]);
 const tolerance = Number(settings.tolerance ?? 0.01);
 if (!Number.isFinite(tolerance) || tolerance < 0 || tolerance > 100) throw new Error('Tolerance must be between 0 and 100.');
 if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Extraction data must be a JSON object.');
 const issues = [], checks = [], add = (code, message) => issues.push({code, message});
 const test = (label, actual, expected) => { const difference = actual == null || expected == null ? null : round(actual - expected); const passed = difference != null && Math.abs(difference) <= tolerance + 1e-9; checks.push({label, actual, expected, difference, passed}); if (!passed) add(difference == null ? 'missing_value' : 'total_mismatch', difference == null ? `${label}: required value is missing or not numeric.` : `${label}: difference ${difference.toFixed(2)} exceeds ${tolerance}.`); };
 const invoice = Object.fromEntries(['number','vendor','currency','date'].map(k => [k, get(k)]));
 if (typeof invoice.vendor === 'object' && invoice.vendor) invoice.vendor = null;
 for (const k of ['number','vendor','currency']) if (!invoice[k]) add('missing_field', `Missing ${k}; review the extracted fields or mapping.`);
 for (const k of ['subtotal','tax','total']) invoice[k] = number(get(k));
 if (invoice.tax == null) { const taxes = ['cgst','sgst','igst','vat'].map(k => number(field(raw,k))).filter(v => v != null); if (taxes.length) invoice.tax = round(taxes.reduce((a,b) => a+b, 0)); }
 for (const k of ['discount','shipping','rounding']) { const v = get(k); invoice[k] = v == null ? 0 : number(v); if (v != null && invoice[k] == null) add('invalid_number', `${k} is not a valid number.`); }
 const rows = get('items');
 invoice.items = Array.isArray(rows) ? rows.map((row, index) => {
  const item = {description: get('description', row), sku: get('sku', row)};
  for (const k of ['quantity','rate','amount']) item[k] = number(get(k,row));
  const discount = get('itemDiscount',row); item.discount = discount == null ? 0 : number(discount);
  test(`Line ${index+1}: quantity × price − discount`, item.amount, [item.quantity,item.rate,item.discount].every(v => v != null) ? round(item.quantity*item.rate-item.discount) : null);
  if (!item.description) add('missing_field', `Line ${index+1}: missing description.`);
  return item;
 }) : [];
 if (!invoice.items.length) add('missing_items', 'No line items found. Review the document or line-item mapping.');
 const sum = invoice.items.length && invoice.items.every(i => i.amount != null) ? round(invoice.items.reduce((s,i) => s+i.amount,0)) : null;
 test('Line items → subtotal', invoice.subtotal, sum);
 const parts = ['subtotal','tax','discount','shipping','rounding'];
 test('Subtotal + tax − discount + shipping + rounding → total', invoice.total, parts.every(k => invoice[k] != null) ? round(invoice.subtotal+invoice.tax-invoice.discount+invoice.shipping+invoice.rounding) : null);
 return {invoice, checks, issues, status: issues.length ? 'Review required' : 'Validated'};
}
