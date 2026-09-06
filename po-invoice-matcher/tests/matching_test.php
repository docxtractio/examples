<?php
// Date: 2026-09-06
// Author: Alok
// File: po-invoice-matcher/tests/matching_test.php
// Purpose: Verify PO reconciliation, ambiguity, missing facts and tolerances.
require_once __DIR__.'/../includes/matching.php';
$count=0;
function check(bool $value,string $label): void { global $count;if(!$value) throw new RuntimeException($label);$count++;echo "PASS $label\n"; }
function sample(): array { return ['po_number'=>'PO1','currency'=>'USD','vendor'=>['name'=>'Vendor'],'subtotal'=>20,'tax'=>2,'total'=>22,'line_items'=>[['sku'=>'A','description'=>'Item','quantity'=>2,'rate'=>10,'amount'=>20,'tax'=>2]]]; }
$p=sample();check(match_documents($p,$p)['status']==='Matched','matching pair');
$i=$p;$i['line_items'][0]['quantity']=3;check(match_documents($p,$i)['exceptions']===1,'quantity mismatch even when totals agree');
$i=$p;$i['line_items'][0]['rate']=10.005;check(match_documents($p,$i)['status']==='Matched','amount tolerance applied');
$i=$p;unset($i['tax']);check(match_documents($p,$i)['status']==='Review required','missing tax never treated as zero');
$i=$p;$i['line_items'][]=$i['line_items'][0];check(str_contains(match_documents($p,$i)['rows'][0]['status'],'Ambiguous'),'duplicate invoice SKU flagged');
$i=$p;$i['line_items'][0]['sku']='B';check(match_documents($p,$i)['rows'][0]['status']==='Missing on invoice','conflicting SKUs not paired by row order');
$i=$p;unset($i['line_items'][0]['sku']);check(match_documents($p,$i)['status']==='Matched','unique exact description fallback');
$i=$p;$i['currency']='EUR';check(match_documents($p,$i)['status']==='Review required','cross currency review');
check(match_documents([],[])['status']==='Review required','empty extractions cannot match');
check(numeric('1,23')===null&&numeric('1,234.50')===1234.5&&numeric(true)===null,'strict numeric parsing');
try { match_documents($p,$p,['tolerance'=>-1]);check(false,'reject negative tolerance'); } catch(InvalidArgumentException $e) { check(true,'reject negative tolerance'); }
echo "$count assertions passed.\n";
