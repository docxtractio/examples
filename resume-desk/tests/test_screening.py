# Date: 2026-09-06
# Author: Alok
# File: resume-desk/tests/test_screening.py
# Purpose: Verify job ranking, evidence gaps and the official SDK contract.
import base64
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock
from includes.screening import rank, profile, experience_from_dates
from app import app

class ScreeningTests(unittest.TestCase):
    def candidate(self, skills=None, years=3): return {'id':'a','raw':{'name':'A','skills':skills or ['Python','SQL'],'years_of_experience':years},'complete':True}
    def criteria(self): return {'skills':'Python, SQL','minYears':3,'skillWeight':80}
    def test_weighted_score(self):
        result=rank([self.candidate(['Python'],1.5)],self.criteria())[0]
        self.assertEqual(result['score'],50);self.assertEqual(result['missing'],['sql'])
    def test_unknown_and_partial_unranked(self):
        c=self.candidate(years=None);self.assertIsNone(rank([c],self.criteria())[0]['score'])
        c=self.candidate();c['complete']=False;self.assertIsNone(rank([c],self.criteria())[0]['rank'])
    def test_exact_matching_dedup_and_ties(self):
        criteria={'skills':'Java, Java','minYears':0,'skillWeight':100}
        rows=rank([self.candidate(['JavaScript']),self.candidate(['JavaScript'])],criteria)
        self.assertEqual([r['score'] for r in rows],[0,0]);self.assertEqual([r['rank'] for r in rows],[1,1])
    def test_sensitive_fields_do_not_affect_score(self):
        a=self.candidate();b=self.candidate();b['raw'].update(name='B',age=75,gender='female',religion='None')
        self.assertEqual(rank([a],self.criteria())[0]['score'],rank([b],self.criteria())[0]['score'])
    def test_overlapping_dates_not_double_counted(self):
        rows=[{'start_date':'2020-01-01','end_date':'2022-01-01'},{'start_date':'2021-01-01','end_date':'2023-01-01'}]
        self.assertAlmostEqual(experience_from_dates(rows),3,places=1)
        self.assertIsNone(experience_from_dates([{'start_date':'2020'}]))
    def test_nested_mapping_and_invalid_criteria(self):
        self.assertEqual(profile({'Candidate':{'Tools':['SQL']}},{'skills':'Candidate.Tools'})['skills'],['sql'])
        with self.assertRaises(ValueError): rank([],{'skills':[]})
        with self.assertRaises(ValueError): rank([],{**self.criteria(),'skillWeight':101})
    @patch('app.DocXtract')
    def test_sdk_and_upload_cleanup(self, sdk):
        paths=[]
        def extract(file,**kwargs):
            self.assertTrue(Path(file).exists());paths.append(file)
            self.assertEqual(kwargs,{'document_type':'resume','store_db':False,'model':'resume'})
            return MagicMock(data=self.candidate()['raw'],meta={},complete=True)
        sdk.return_value.extract.side_effect=extract
        with app.test_client() as client:
            response=client.post('/api/extract',json={'apiKey':'sk_test','file':{'name':'cv.pdf','content':base64.b64encode(b'%PDF-1.4 mock').decode()},'settings':{}},headers={'X-Desk-Request':'1'})
            self.assertEqual(response.status_code,200);self.assertEqual(response.json['profile']['years'],3)
            self.assertFalse(Path(paths[0]).exists())
            response=client.post('/api/connect',json={'apiKey':'sk_test'},headers={'X-Desk-Request':'1','Origin':'https://other.example'})
            self.assertEqual(response.status_code,403)
            self.assertEqual(client.get('/app.py').status_code,404)
if __name__=='__main__': unittest.main()
