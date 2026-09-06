// Date: 2026-09-06
// Author: Alok
// File: invoice-desk/includes/config.js
// Purpose: Invoice defaults and limits.
export const config = {port: Number(process.env.PORT || 3101), maxBytes: 10 * 1024 * 1024, model: '', documentType: 'invoice', tolerance: 0.01};
