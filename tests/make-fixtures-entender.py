# Genera los documentos de prueba (ficticios) de «Entender»: nota escolar, WhatsApp, cartel, formulario, comunicado (PDF con texto y escaneado) y una foto borrosa.
# Uso: python3 tests/make-fixtures-entender.py   (requiere Pillow y reportlab)
import random, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
random.seed(7)
OUT = 'tests/fixtures/entender/'
D = '/usr/share/fonts/truetype/dejavu/'
def F(n, s): return ImageFont.truetype(D + n, s)
SANS, BOLD, SERIF = 'DejaVuSans.ttf', 'DejaVuSans-Bold.ttf', 'DejaVuSerif.ttf'

def foto_realista(im, giro=-2.0):
    """Simula una foto con el celular: fondo de mesa, leve giro, sombra y ruido."""
    w, h = im.size; mesa = Image.new('RGB', (w + 160, h + 160), (120, 96, 72)); mesa.paste(im.rotate(giro, expand=True, fillcolor=(120, 96, 72)).resize((w, h)), (80, 80))
    px = mesa.load(); W, H = mesa.size
    for y in range(H):
        for x in range(W):
            r, g, b = px[x, y]; s = 1 - 0.28 * (x / W) - 0.10 * (y / H); n = random.randint(-9, 9)
            px[x, y] = (max(0, min(255, int(r * s + n))), max(0, min(255, int(g * s + n))), max(0, min(255, int(b * s + n))))
    return mesa.filter(ImageFilter.GaussianBlur(0.6))

def escribir(dr, x, y, lineas, font, fill=(25, 25, 25), paso=1.5):
    for l in lineas:
        dr.text((x, y), l, font=font, fill=fill); y += int(font.size * paso)
    return y

# 1) Nota escolar (cuaderno de comunicaciones)
n = Image.new('RGB', (900, 1100), (252, 250, 240)); d = ImageDraw.Draw(n)
for y in range(80, 1100, 44): d.line([(30, y), (870, y)], fill=(190, 205, 235), width=1)
escribir(d, 60, 50, ['Escuela N° 3 · Comunicado a las familias'], F(BOLD, 30))
escribir(d, 60, 130, ['Señores padres:', 'Les informamos que el viernes 21 de noviembre', 'a las 9:30 hs se realizará la reunión de padres', 'en el aula de 3° grado.', '', 'Deben traer fotocopia del DNI del alumno', 'y el certificado de vacunas.', 'Es obligatorio confirmar la asistencia', 'hasta el miércoles 19/11 por el cuaderno.', '', 'Cooperadora: cuota de $ 2500.', 'Gracias. La Dirección.'], F(SERIF, 30), paso=1.45)
foto_realista(n).save(OUT + 'nota-escolar.jpg', quality=88)

# 2) Captura de WhatsApp
w = Image.new('RGB', (540, 960), (229, 221, 213)); d = ImageDraw.Draw(w)
d.rectangle([0, 0, 540, 90], fill=(7, 94, 84)); d.text((24, 28), 'Grupo Familias 3° B', font=F(BOLD, 28), fill='white')
def burbuja(y, lineas, hora, der=False):
    ancho = 440; alto = 40 * len(lineas) + 56; x0 = 540 - ancho - 14 if der else 14
    d.rounded_rectangle([x0, y, x0 + ancho, y + alto], 16, fill=(220, 248, 198) if der else 'white')
    escribir(d, x0 + 16, y + 12, lineas, F(SANS, 25), paso=1.5); d.text((x0 + ancho - 80, y + alto - 34), hora, font=F(SANS, 19), fill=(120, 120, 120)); return y + alto + 16
y = burbuja(110, ['Buenas tardes! Les recuerdo que', 'mañana lunes 24 hay acto en la', 'plaza a las 8:15. Llevar vianda', 'y gorra. No hay clases después', 'de las 12 hs.'], '18:42')
y = burbuja(y, ['Gracias seño! Confirmo que voy.'], '18:44', der=True)
y = burbuja(y, ['Quién trae las banderas?', 'Escribanme por privado.'], '18:51')
w.save(OUT + 'whatsapp.png')

# 3) Cartel
c = Image.new('RGB', (1000, 700), (255, 214, 0)); d = ImageDraw.Draw(c)
d.rectangle([20, 20, 980, 680], outline=(20, 20, 20), width=10)
escribir(d, 70, 60, ['CAMPAÑA DE VACUNACIÓN'], F(BOLD, 50), paso=1.2)
escribir(d, 70, 190, ['Sábado 29 de noviembre', 'de 9 a 13 hs', 'Centro de Salud Barrio Norte', 'Calle Mitre 450', 'Gratuita · Llevar libreta de vacunación'], F(BOLD, 36), paso=1.45)
foto_realista(c, 1.5).save(OUT + 'cartel.jpg', quality=88)

# 4) Formulario
f = Image.new('RGB', (900, 1000), 'white'); d = ImageDraw.Draw(f)
escribir(d, 60, 40, ['FORMULARIO DE INSCRIPCIÓN', 'Taller de huerta escolar'], F(BOLD, 34), paso=1.3)
y = 170
for campo in ['Nombre y apellido:', 'Fecha de nacimiento:', 'Teléfono de contacto:', 'Autorización del adulto responsable:']:
    d.text((60, y), campo, font=F(SANS, 26), fill='black'); d.line([(60, y + 70), (840, y + 70)], fill='black', width=2); y += 125
escribir(d, 60, y + 10, ['Entregar completo hasta el 5 de diciembre', 'en secretaría, de lunes a viernes de 8 a 12 hs.', 'Requisito: firma del padre, madre o tutor.'], F(SANS, 26), paso=1.5)
f.save(OUT + 'formulario.png')

# 5) Comunicado institucional en PDF con texto
TXT = ['Municipalidad de El Colorado — Aviso a vecinos', '', 'El martes 2 de diciembre a las 10:00 hs se realizará', 'la entrega de bolsones en el Salón Municipal,', 'ubicado en Avenida San Martín 1200.', '', 'Para retirar deben presentar el DNI y el carnet del programa.', 'Si no pueden asistir, deberán avisar hasta el viernes 28/11', 'al teléfono de la oficina.', 'No se entregan bolsones fuera de fecha.']
c = canvas.Canvas(OUT + 'comunicado.pdf', pagesize=A4); c.setFont('Helvetica-Bold', 16); y = 780
for i, l in enumerate(TXT):
    c.setFont('Helvetica-Bold' if i == 0 else 'Helvetica', 16 if i == 0 else 13); c.drawString(60, y, l); y -= 24
c.showPage(); c.save()
# 6) El mismo comunicado, escaneado (solo imagen, sin texto seleccionable)
p = Image.new('RGB', (1240, 1754), 'white'); d = ImageDraw.Draw(p)
yy = 160
for i, l in enumerate(TXT):
    d.text((120, yy), l, font=F(BOLD if i == 0 else SANS, 38 if i == 0 else 32), fill=(30, 30, 30)); yy += 62
p = ImageEnhance.Contrast(p.filter(ImageFilter.GaussianBlur(0.8))).enhance(0.95)
p.save(OUT + 'comunicado-escaneado.pdf', 'PDF', resolution=150)
# 7) Foto borrosa y oscura (no se puede leer bien)
b = Image.open(OUT + 'nota-escolar.jpg').resize((600, 730)).filter(ImageFilter.GaussianBlur(6.5)); b = ImageEnhance.Brightness(b).enhance(0.55); b.save(OUT + 'borrosa.jpg', quality=70)
# 8) Imagen sin texto (paisaje simple)
s = Image.new('RGB', (800, 600), (135, 190, 235)); d = ImageDraw.Draw(s); d.ellipse([560, 60, 680, 180], fill=(255, 230, 80)); d.polygon([(0, 600), (300, 250), (600, 600)], fill=(90, 150, 90)); s.save(OUT + 'sin-texto.png')
print('ok')
