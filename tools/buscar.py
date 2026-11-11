import json, os, sys, unicodedata, urllib.request, urllib.parse, concurrent.futures as cf
sys.path.insert(0,os.path.dirname(__file__)); from vocabulario import V
CACHE='cache'; os.makedirs(CACHE,exist_ok=True)
norm=lambda s:''.join(c for c in unicodedata.normalize('NFD',s.lower()) if unicodedata.category(c)!='Mn').strip()
def api(q):
    f=f'{CACHE}/q_{norm(q).replace(" ","_")}.json'
    if os.path.exists(f): return json.load(open(f))
    for _ in range(3):
        try:
            d=json.load(urllib.request.urlopen('https://api.arasaac.org/v1/pictograms/es/search/'+urllib.parse.quote(q.lower()),timeout=25))
            json.dump(d,open(f,'w')); return d
        except Exception as e: err=e
    print('ERR',q,err); return []
def candidatos(lema,consulta=None):
    d=api(consulta or lema); lema=consulta or lema; out=[]
    for p in d:
        kws=[k['keyword'] for k in p['keywords']]
        if norm(lema) in [norm(k) for k in kws] and not p.get('violence'):
            out.append({'id':p['_id'],'kw':kws,'schematic':bool(p.get('schematic')),'primario':norm(kws[0])==norm(lema),'cat':p.get('categories',[])})
    out.sort(key=lambda c:(c['schematic'],not c['primario'],len(c['kw'])))
    return out
if __name__=='__main__':
    with cf.ThreadPoolExecutor(6) as ex: res=list(ex.map(lambda v:(v[0],candidatos(v[0],v[3] if len(v)>3 else None)),V))
    json.dump({l:c for l,c in res},open('cache/candidatos.json','w'),ensure_ascii=False)
    sin=[l for l,c in res if not c]; print(len(V),'lemas;',len(sin),'sin candidato exacto:',sin)
