<?php
// Date: 2026-09-06
// Author: Alok
// File: po-invoice-matcher/public/index.php
// Purpose: Render the reusable desk view components.
header('Cache-Control: no-store');header('X-Content-Type-Options: nosniff');header('X-Frame-Options: DENY');
header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");
ob_start();
foreach(['preheader','header','workspace','footer'] as $part) require_once __DIR__.'/../includes/'.$part.'.php';
echo str_replace(['{{APP}}','{{TITLE}}','{{STACK}}'],['matcher','PO vs Invoice Matcher','PHP'],ob_get_clean());
