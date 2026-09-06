<?php
// Date: 2026-09-06
// Author: Alok
// File: po-invoice-matcher/public/api.php
// Purpose: Single routed API for connection, extraction and PO matching.
require_once __DIR__.'/../vendor/autoload.php';
require_once __DIR__.'/../includes/config.php';
require_once __DIR__.'/../includes/matching.php';
use DocXtract\DocXtract;
use DocXtract\Exception\DocXtractException;
header('Content-Type: application/json');header('Cache-Control: no-store');header('X-Content-Type-Options: nosniff');
$file=null;$folder=null;
try {
    $host=$_SERVER['HTTP_HOST']??'';
    if(!preg_match('/^(localhost|127\.0\.0\.1)(:\d+)?$/',$host)) { http_response_code(403);throw new InvalidArgumentException('Local access only.'); }
    $action=$_GET['action']??'';
    if($action==='health'&&$_SERVER['REQUEST_METHOD']==='GET') { echo json_encode(['ok'=>true,'app'=>'matcher']);exit; }
    if($_SERVER['REQUEST_METHOD']!=='POST'||($_SERVER['HTTP_X_DESK_REQUEST']??'')!=='1'||(isset($_SERVER['HTTP_ORIGIN'])&&$_SERVER['HTTP_ORIGIN']!=='http://'.$host)) { http_response_code(403);throw new InvalidArgumentException('Invalid request origin.'); }
    if((int)($_SERVER['CONTENT_LENGTH']??0)>15*1024*1024) throw new InvalidArgumentException('Request exceeds 15 MB.');
    $input=file_get_contents('php://input',false,null,0,15*1024*1024+1);
    if(strlen($input)>15*1024*1024) throw new InvalidArgumentException('Request exceeds 15 MB.');
    $body=json_decode($input,true,512,JSON_THROW_ON_ERROR);if(!is_array($body)) throw new InvalidArgumentException('Expected a JSON object.');
    $settings=$body['settings']??[];
    if($action==='match') { echo json_encode(match_documents($body['po'],$body['invoice'],$settings),JSON_THROW_ON_ERROR);exit; }
    if(!in_array($action,['connect','extract'])) { http_response_code(404);throw new InvalidArgumentException('Not found.'); }
    $key=$body['apiKey']??'';
    if(!is_string($key)||!str_starts_with($key,'sk_')) throw new InvalidArgumentException('Enter a valid DocXtract API key in Settings.');
    $dx=new DocXtract(['api_key'=>$key,'max_retries'=>2]);
    if($action==='connect') { echo json_encode(['models'=>$dx->models()],JSON_THROW_ON_ERROR);exit; }
    $upload=$body['file']??[];$ext=strtolower(pathinfo($upload['name']??'',PATHINFO_EXTENSION));
    if(!in_array($ext,['pdf','jpg','jpeg','png'])) throw new InvalidArgumentException('Upload a PDF, JPG, or PNG.');
    $bytes=base64_decode($upload['content']??'',true);
    if($bytes===false||strlen($bytes)===0||strlen($bytes)>DESK_MAX_BYTES) throw new InvalidArgumentException('Files must be between 1 byte and 10 MB.');
    $folder=sys_get_temp_dir().'/po-desk-'.bin2hex(random_bytes(12));mkdir($folder,0700);$file=$folder.'/document.'.$ext;file_put_contents($file,$bytes);chmod($file,0600);
    $po=($body['role']??'')==='po';$model=$settings[$po?'poModel':'model']??DESK_DEFAULTS[$po?'poModel':'model'];
    $options=['document_type'=>$settings[$po?'poDocumentType':'documentType']??DESK_DEFAULTS[$po?'poDocumentType':'documentType'],'store_db'=>false];if(trim($model)!=='') $options['model']=trim($model);
    set_time_limit(0);$result=$dx->extract($file,$options);
    echo json_encode(['raw'=>$result->data(),'meta'=>$result->meta(),'complete'=>$result->isComplete()],JSON_THROW_ON_ERROR);
} catch(Throwable $e) {
    if(http_response_code()<400) http_response_code($e instanceof DocXtractException?502:400);
    echo json_encode(['error'=>preg_replace('/sk_[A-Za-z0-9_-]+/','[redacted]',$e->getMessage()),'code'=>$e instanceof DocXtractException?$e->getErrorCode():'request_failed']);
} finally { if($file&&is_file($file)) unlink($file);if($folder&&is_dir($folder)) rmdir($folder); }
