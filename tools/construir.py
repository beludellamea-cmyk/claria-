# Construye data/pictogramas.json y assets/picto/*.png a partir del vocabulario y de IDs fijados tras revisión visual.
import json,os,sys,urllib.request,concurrent.futures as cf
sys.path.insert(0,os.path.dirname(__file__)); from vocabulario import V; from buscar import norm
cand=json.load(open('cache/candidatos.json'))
FIJADOS={'silla':3155,'ventana':2611,'gato':9881,'calle':2299,'responder':9030,'llamar':36305,'mi':12264,'cómo':22619,
 'niño':32842,'niña':27509,'dirección':38571,'gustar':37721,'DNI':5987}
AMBIGUOS={'sacar':'Tiene varios sentidos; este es «extraer, sacar algo de un lugar».','llamar':'Tiene varios sentidos; este es «llamar por teléfono».',
 'listo':'Puede significar «preparado» o «inteligente»; este es «preparado».','banco':'Puede ser la entidad financiera o un asiento; este es la entidad.',
 'tiempo':'Puede ser el tiempo que pasa o el clima; este es el tiempo que pasa.','clase':'Puede ser un grupo de estudiantes, un aula o una lección.',
 'mañana':'Puede ser «el día siguiente» o «la parte temprana del día»; este es «el día siguiente».','sol':'Puede ser el astro o el clima soleado.',
 'DNI':'Imagen de ejemplo de ARASAAC (modelo español): el DNI argentino se ve distinto.','usar':'Pictograma abstracto.','lugar':'Pictograma abstracto.'}
ROL_FUNC={'ser','estar','para','con','en'}
NOTA_SOLO_ACENTO={'sí','más','él'}; INTERROG={'qué','dónde','cuándo','cómo','quién','cuánto','por qué'}
os.makedirs('out/assets/picto',exist_ok=True); os.makedirs('out/data',exist_ok=True)
def bajar(url,reintentos=4):
    for n in range(reintentos):
        try: return urllib.request.urlopen(url,timeout=30).read()
        except Exception as e: err=e; import time; time.sleep(1+n)
    raise RuntimeError(f'No se pudo descargar {url}: {err}')
def porid(i):
    f=f'cache/id_{i}.json'
    if not os.path.exists(f) or os.path.getsize(f)==0:
        b=bajar(f'https://api.arasaac.org/v1/pictograms/es/{i}'); json.loads(b); open(f,'wb').write(b)
    return json.load(open(f))
def png(i):
    out=f'out/assets/picto/{i}.png'
    if not os.path.exists(out) or os.path.getsize(out)<200: open(out,'wb').write(bajar(f'https://static.arasaac.org/pictograms/{i}/{i}_300.png'))
entries=[]; omit=[]
for v in V:
    lema,tipo,sin=v[0],v[1],v[2]; consulta=v[3] if len(v)>3 else lema
    pid=FIJADOS.get(lema) or (cand.get(lema) or [{}])[0].get('id')
    if not pid: omit.append(lema); continue
    entries.append((lema,tipo,sin,consulta,pid))
with cf.ThreadPoolExecutor(4) as ex:
    datos=dict(zip([e[4] for e in entries],ex.map(lambda e:porid(e[4]),entries))); list(ex.map(png,set(e[4] for e in entries)))
out=[]; problemas=[]
for lema,tipo,sin,consulta,pid in entries:
    d=datos[pid]; kws=d['keywords']; claves=[norm(k['keyword']) for k in kws]
    if norm(consulta) not in claves: problemas.append((lema,pid,[k['keyword'] for k in kws]))
    k=next((k for k in kws if norm(k['keyword'])==norm(consulta)),kws[0]); mean=(k.get('meaning') or '').strip() or None
    e={'lema':lema,'tipo':tipo,'id':pid,'palabras':[x for x in kws and [k['keyword'] for k in kws][:6]]}
    if sin: e['formas']=sin
    if mean: e['significado']=mean[:240]
    if lema in AMBIGUOS: e['aviso']=AMBIGUOS[lema]
    if lema in ROL_FUNC: e['rol']='func'
    if lema in NOTA_SOLO_ACENTO: e['soloAcento']=True
    if lema in INTERROG: e['interrogativo']=True
    out.append(e)
json.dump({'version':1,'fuente':'ARASAAC (https://arasaac.org) · API consultada el 2026-11-11','licencia':'CC BY-NC-SA 4.0','autor':'Sergio Palao','origen':'ARASAAC, Gobierno de Aragón','entradas':out},open('out/data/pictogramas.json','w'),ensure_ascii=False,indent=1)
print(len(out),'entradas;','omitidas:',omit,'; sin coincidencia exacta de palabra clave:',problemas)
import glob; print('png',len(glob.glob('out/assets/picto/*.png')),sum(os.path.getsize(f) for f in glob.glob('out/assets/picto/*.png'))//1024,'KB')
