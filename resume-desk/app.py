# Date: 2026-09-06
# Author: Alok
# File: resume-desk/app.py
# Purpose: Serve Resume Desk using Flask and the official Python DocXtract SDK.
import base64
import os
import re
import tempfile
from pathlib import Path
from flask import Flask, request, jsonify, send_from_directory, Response
from docxtract import DocXtract, DocXtractError
from includes.screening import profile, job, rank
ROOT=Path(__file__).resolve().parent
app=Flask(__name__,static_folder=None)
app.config['MAX_CONTENT_LENGTH']=15*1024*1024

@app.before_request
def local_only():
    if not re.fullmatch(r'(localhost|127\.0\.0\.1)(:\d+)?',request.host): return jsonify(error='Local access only.'),403
    if request.method=='POST' and (request.headers.get('X-Desk-Request')!='1' or request.headers.get('Origin',request.host_url.rstrip('/'))!=request.host_url.rstrip('/')): return jsonify(error='Invalid request origin.'),403

@app.after_request
def headers(response):
    response.headers.update({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'"})
    return response

@app.get('/')
def index():
    html='\n'.join((ROOT/'includes'/f'{part}.php').read_text() for part in ['preheader','header','workspace','footer'])
    return Response(html.replace('{{APP}}','resume').replace('{{TITLE}}','Resume Screening Desk').replace('{{STACK}}','Python'),mimetype='text/html')

@app.get('/assets/<path:name>')
def assets(name): return send_from_directory(ROOT/'public'/'assets',name)

@app.get('/api/health')
def health(): return jsonify(ok=True,app='resume')

@app.post('/api/<action>')
def api(action):
    data=request.get_json()
    if not isinstance(data,dict): raise ValueError('Expected a JSON object.')
    settings=data.get('settings',{})
    if action=='rank': return jsonify(rows=rank(data.get('candidates',[]),data.get('criteria',{}),settings.get('mapping',{})))
    if action=='analyse': return jsonify(profile=profile(data.get('raw'),settings.get('mapping',{})))
    if action not in ('connect','extract'): return jsonify(error='Not found.'),404
    key=data.get('apiKey','')
    if not isinstance(key,str) or not key.startswith('sk_'): raise ValueError('Enter a valid DocXtract API key in Settings.')
    dx=DocXtract(key,max_retries=2)
    if action=='connect': return jsonify(models=dx.models())
    file=data.get('file',{}); ext=Path(file.get('name','')).suffix.lower()
    if ext not in ('.pdf','.jpg','.jpeg','.png'): raise ValueError('Upload a PDF, JPG, or PNG. Convert Word documents to PDF first.')
    content=base64.b64decode(file.get('content',''),validate=True)
    if not content or len(content)>10*1024*1024: raise ValueError('Files must be between 1 byte and 10 MB.')
    is_job=data.get('role')=='jd'
    options={'document_type':settings.get('jdDocumentType' if is_job else 'documentType') or 'resume','store_db':False}
    model=settings.get('jdModel' if is_job else 'model','resume')
    if model.strip(): options['model']=model.strip()
    with tempfile.TemporaryDirectory(prefix='resume-desk-') as folder:
        path=Path(folder)/('document'+ext);path.write_bytes(content);path.chmod(0o600)
        result=dx.extract(str(path),**options)
    return jsonify(raw=result.data,meta=result.meta,complete=result.complete,profile=profile(result.data,settings.get('mapping',{})),criteria=job(result.data) if is_job else None)

@app.errorhandler(Exception)
def error(exc):
    status=exc.status if isinstance(exc,DocXtractError) and 400<=exc.status<600 else getattr(exc,'code',400)
    status=status if isinstance(status,int) and 400<=status<600 else 400
    message=re.sub(r'sk_[A-Za-z0-9_-]+','[redacted]',str(exc))
    return jsonify(error=message or 'Request failed.',code=getattr(exc,'code','request_failed')),status

if __name__=='__main__':
    port=int(os.environ.get('PORT',3102))
    print(f'Resume Desk: http://127.0.0.1:{port}\nOpen the launch guide, create a profile, and connect your key. Sample data needs no key.')
    app.run(host='127.0.0.1',port=port,debug=False)
