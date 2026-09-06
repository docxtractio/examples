<?php
// Date: 2026-09-06
// Author: Alok
// File: po-invoice-matcher/router.php
// Purpose: Local development router exposing only public assets and API.
$path=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH);
if($path==='/') { require_once __DIR__.'/public/index.php';return true; }
if(preg_match('#^/api/(health|connect|extract|match)$#',$path,$m)) { $_GET['action']=$m[1];require_once __DIR__.'/public/api.php';return true; }
$file=realpath(__DIR__.'/public'.$path);$assets=realpath(__DIR__.'/public/assets');
if(str_starts_with($path,'/assets/')&&$file&&str_starts_with($file,$assets.DIRECTORY_SEPARATOR)&&is_file($file)) return false;
http_response_code(404);echo 'Not found';return true;
