# Date: 2026-09-06
# Author: Alok
# File: resume-desk/includes/screening.py
# Purpose: Normalize job and resume facts and produce explainable rankings.
import re
from datetime import date

def field(data, paths):
    norm = lambda s: re.sub(r'[^a-z0-9]', '', str(s).lower())
    for path in str(paths or '').split('|'):
        value = data
        for part in path.split('.'):
            value = next((v for k, v in value.items() if norm(k) == norm(part)), None) if isinstance(value, dict) else None
        if value is not None and value != '': return value
    return None

def skills(value):
    if isinstance(value, dict): value = list(value.values())
    if isinstance(value, list): return sorted(set(s for v in value for s in skills(v)))
    return sorted(set(v.strip().lower() for v in re.split(r'[,;\n|]', value) if v.strip())) if isinstance(value, str) else []

def number(value):
    if isinstance(value, bool) or value is None: return None
    match = re.fullmatch(r'\s*(\d+(?:\.\d+)?)\s*(?:years?)?\s*', str(value), re.I)
    return float(match[1]) if match else None

def experience_from_dates(rows):
    if not isinstance(rows, list) or not rows: return None
    intervals = []
    def parse(value, end=False):
        if str(value).lower().strip() in ('present', 'current', 'now'): return date.today().toordinal()
        try: return date.fromisoformat(str(value)[:10]).toordinal()
        except ValueError: return None
    for row in rows:
        if not isinstance(row,dict): return None
        start, end = parse(field(row,'start_date|from')), parse(field(row,'end_date|to'),True)
        if start is None or end is None or end < start or end > date.today().toordinal(): return None
        intervals.append((start,end))
    merged=[]
    for start,end in sorted(intervals):
        if merged and start <= merged[-1][1]: merged[-1][1]=max(merged[-1][1],end)
        else: merged.append([start,end])
    return round(sum(end-start for start,end in merged)/365.25,2)

def profile(raw, mapping=None):
    if not isinstance(raw,dict): raise ValueError('Extraction data must be a JSON object.')
    paths = {'name':'name|full_name|candidate.name|personal_details.name', 'skills':'skills|technical_skills|core_skills', 'years':'years_of_experience|total_experience_years|total_years_experience', 'experience':'work_experience|experience|employment_history'}
    paths.update(mapping or {})
    get=lambda k:field(raw,paths[k])
    years=number(get('years')); source='Reported total'
    if years is None: years=experience_from_dates(get('experience')); source='Non-overlapping dated roles' if years is not None else 'Not available'
    name=get('name'); name=name if isinstance(name,str) else 'Unnamed candidate'
    return {'name':name or 'Unnamed candidate','skills':skills(get('skills')),'years':years,'experienceSource':source,'experience':get('experience')}

def job(raw):
    return {'skills':skills(field(raw,'required_skills|skills|technical_skills')), 'minYears':number(field(raw,'minimum_experience_years|min_years|years_of_experience|experience_years'))}

def rank(candidates, criteria, mapping=None):
    required=skills(criteria.get('skills',[])); minimum=number(criteria.get('minYears')); weight=number(criteria.get('skillWeight'))
    if not required: raise ValueError('Enter at least one required skill after reviewing the job description.')
    if minimum is None or minimum>80 or weight is None or weight>100: raise ValueError('Minimum years must be 0–80 and skill weight 0–100.')
    rows=[]
    for candidate in candidates:
        p=profile(candidate.get('raw'), mapping); matched=sorted(set(required)&set(p['skills'])); missing=sorted(set(required)-set(p['skills']))
        issues=[]
        if candidate.get('complete') is False: issues.append('Partial extraction; review missing pages before ranking.')
        if not p['skills']: issues.append('No structured skills found; review extraction or mapping.')
        if minimum>0 and p['years'] is None: issues.append('Experience is unknown; review dated roles or enter reported years.')
        skill_score=len(matched)/len(required)*100; exp_score=100 if minimum==0 else min((p['years'] or 0)/minimum,1)*100
        score=None if issues else round(skill_score*weight/100+exp_score*(100-weight)/100,2)
        rows.append({'id':candidate.get('id'),'name':p['name'],'profile':p,'matched':matched,'missing':missing,'skillScore':round(skill_score,2),'experienceScore':round(exp_score,2),'score':score,'issues':issues,'rank':None})
    rows.sort(key=lambda r: (r['score'] is None,-(r['score'] or 0)))
    previous=None; place=None
    for i,row in enumerate(rows,1):
        if row['score'] is None: continue
        if previous != row['score']: place=i
        row['rank']=place; previous=row['score']
    return rows
