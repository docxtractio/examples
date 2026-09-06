<?php
// Date: 2026-09-06
// Author: Alok
// File: po-invoice-matcher/includes/matching.php
// Purpose: Normalize documents and compare uniquely identified lines and totals.
function read_field(array $data, string $paths): mixed {
    $norm=fn($s)=>strtolower(preg_replace('/[^a-z0-9]/i','',(string)$s));
    foreach(explode('|',$paths) as $path) {
        $value=$data;
        foreach(explode('.',$path) as $part) { $found=null; if(is_array($value)) foreach($value as $key=>$v) if($norm($key)===$norm($part)) { $found=$v; break; } $value=$found; }
        if($value!==null && $value!=='') return $value;
    }
    return null;
}
function numeric(mixed $value): ?float {
    if(is_int($value)||is_float($value)) return is_finite((float)$value)?(float)$value:null;
    if(!is_string($value)||trim($value)==='') return null;
    $s=preg_replace('/^(?:USD|INR|EUR|GBP|[$₹€£])\s*|\s*(?:USD|INR|EUR|GBP)$/iu','',trim($value));
    if(preg_match('/^\((.*)\)$/',$s,$m)) $s='-'.$m[1];
    if(str_contains($s,',')&&!preg_match('/^-?\d{1,3}(,\d{3})+(\.\d+)?$/',$s)) return null;
    $s=str_replace(',','',$s); return preg_match('/^-?\d+(\.\d+)?$/',$s)?(float)$s:null;
}
function document(array $raw, array $mapping=[]): array {
    $map=array_replace(['number'=>'invoice_number|po_number|purchase_order_number|document_number','poReference'=>'po_number|purchase_order_number|purchase_order_reference','currency'=>'currency|currency_code','vendor'=>'vendor.name|supplier.name|vendor_name|supplier_name','subtotal'=>'subtotal|sub_total|taxable_amount','tax'=>'tax|total_tax|tax_amount','total'=>'total|grand_total|total_amount','items'=>'line_items|items','sku'=>'sku|item_code|product_code','description'=>'description|item_description|name','quantity'=>'quantity|qty','rate'=>'rate|unit_price|price','amount'=>'amount|line_total|total','lineTax'=>'tax|tax_amount|total_tax'],$mapping);
    $out=[];
    foreach(['number','poReference','currency','vendor','subtotal','tax','total'] as $k) $out[$k]=read_field($raw,$map[$k]);
    foreach(['subtotal','tax','total'] as $k) $out[$k]=numeric($out[$k]);
    if($out['tax']===null) { $parts=array_filter(array_map(fn($k)=>numeric(read_field($raw,$k)),['cgst','sgst','igst','vat']),fn($v)=>$v!==null); if($parts) $out['tax']=round(array_sum($parts),2); }
    $rows=read_field($raw,$map['items']);$out['items']=[];
    foreach(is_array($rows)?$rows:[] as $row) {
        if(!is_array($row)) continue;
        $item=[];foreach(['sku','description','quantity','rate','amount','lineTax'] as $k) $item[$k]=read_field($row,$map[$k]);
        foreach(['quantity','rate','amount','lineTax'] as $k) $item[$k]=numeric($item[$k]);
        $out['items'][]=$item;
    }
    return $out;
}
function match_documents(array $poRaw, array $invoiceRaw, array $settings=[]): array {
    $t=numeric($settings['tolerance']??0.01);$qt=numeric($settings['quantityTolerance']??0);
    if($t===null||$qt===null||$t<0||$qt<0||$t>100||$qt>100) throw new InvalidArgumentException('Tolerances must be between 0 and 100.');
    $po=document($poRaw,$settings['poMapping']??[]);$invoice=document($invoiceRaw,$settings['mapping']??[]);$checks=[];$rows=[];
    $norm=fn($v)=>preg_replace('/\s+/u',' ',strtolower(trim(is_scalar($v)?(string)$v:'')));
    $check=function($label,$expected,$actual,$tolerance=0) use(&$checks) {
        $missing=$expected===null||$actual===null||$expected===''||$actual==='';
        $difference=!$missing&&is_numeric($expected)&&is_numeric($actual)?round((float)$actual-(float)$expected,6):null;
        $passed=!$missing&&($difference!==null?abs($difference)<=$tolerance+1e-9:$expected===$actual);
        $entry=['label'=>$label,'expected'=>$expected,'actual'=>$actual,'difference'=>$difference,'passed'=>$passed,'message'=>$missing?'Missing value':($passed?'Match':'Mismatch')];$checks[]=$entry;return $entry;
    };
    $check('Currency',$norm($po['currency']),$norm($invoice['currency']));
    $check('PO reference',$norm($po['number']),$norm($invoice['poReference']));
    $check('Vendor',$norm($po['vendor']),$norm($invoice['vendor']));
    foreach(['subtotal','tax','total'] as $k) $check(ucfirst($k),$po[$k],$invoice[$k],$t);
    $used=[];
    foreach($po['items'] as $i=>$p) {
        $candidates=[];$identity=$norm($p['sku'])!==''?'sku':'description';$value=$norm($p[$identity]);
        $duplicates=count(array_filter($po['items'],fn($item)=>$norm($item[$identity])===$value));
        foreach($invoice['items'] as $j=>$v) {
            $same=$value!==''&&$norm($v[$identity])===$value;
            if($identity==='sku'&&$norm($v['sku'])===''&&$norm($p['description'])!=='') $same=$norm($p['description'])===$norm($v['description']);
            if($same) $candidates[]=$j;
        }
        if(!$value||count($candidates)!==1||$duplicates!==1||isset($used[$candidates[0]])) {
            $reason=!$value?'Missing line identity':(count($candidates)===0?'Missing on invoice':'Ambiguous duplicate; review manually');
            $rows[]=['description'=>$p['description'],'po'=>$p,'invoice'=>null,'checks'=>[],'status'=>$reason]; continue;
        }
        $j=$candidates[0];$used[$j]=true;$v=$invoice['items'][$j];$line=[];
        foreach(['quantity'=>'Quantity','rate'=>'Unit price','amount'=>'Line amount','lineTax'=>'Line tax'] as $k=>$label) $line[]=$check('Line '.($i+1).': '.$label,$p[$k],$v[$k],$k==='quantity'?$qt:$t);
        $rows[]=['description'=>$p['description'],'po'=>$p,'invoice'=>$v,'checks'=>$line,'status'=>count(array_filter($line,fn($c)=>!$c['passed']))?'Mismatch / missing value':'Matched'];
    }
    foreach($invoice['items'] as $j=>$v) if(!isset($used[$j])) $rows[]=['description'=>$v['description'],'po'=>null,'invoice'=>$v,'checks'=>[],'status'=>'Unmatched invoice line'];
    if(!$po['items']||!$invoice['items']) $check('Line items present',true,false);
    $exceptions=count(array_filter($checks,fn($c)=>!$c['passed']))+count(array_filter($rows,fn($r)=>!$r['checks']));
    return ['po'=>$po,'invoice'=>$invoice,'checks'=>$checks,'rows'=>$rows,'exceptions'=>$exceptions,'status'=>$exceptions?'Review required':'Matched'];
}
