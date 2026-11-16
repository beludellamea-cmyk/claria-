# Imágenes de ejemplo para las pruebas de visión (dibujadas con PIL; sin personas). Uso: python3 tests/make-fixtures-vision.py
from PIL import Image, ImageDraw, ImageFont
import os
OUT = os.path.join(os.path.dirname(__file__), 'fixtures', 'vision'); os.makedirs(OUT, exist_ok=True)
def f(sz, b=True):
    for p in ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' if b else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']:
        if os.path.exists(p): return ImageFont.truetype(p, sz)
    return ImageFont.load_default()
# 1) cartel de tránsito (grande, 3000 px: debe reducirse) con EXIF con GPS falso
im = Image.new('RGB', (3000, 2000), (120, 170, 220)); d = ImageDraw.Draw(im)
d.rectangle([0, 1500, 3000, 2000], fill=(90, 90, 90)); d.ellipse([1000, 300, 2000, 1300], fill='white', outline=(200, 0, 0), width=90)
d.text((1500, 800), 'E', fill='black', font=f(600), anchor='mm'); d.line([1150, 450, 1850, 1150], fill=(200, 0, 0), width=70)
d.text((1500, 1650), 'PROHIBIDO ESTACIONAR', fill='white', font=f(160), anchor='mm')
ex = Image.Exif(); ex[0x010F] = 'CamaraSecretaMarca'; ex[0x0110] = 'ModeloSecreto123'
gps = ex.get_ifd(0x8825); gps[1] = 'S'; gps[2] = (26.0, 18.0, 0.0); gps[3] = 'W'; gps[4] = (59.0, 22.0, 0.0)
im.save(os.path.join(OUT, 'cartel-transito.jpg'), quality=92, exif=ex)
# 2) captura de app (png, 390x844)
im = Image.new('RGB', (390, 844), 'white'); d = ImageDraw.Draw(im)
d.rectangle([0, 0, 390, 70], fill=(30, 100, 200)); d.text((20, 35), 'Mi Banco Demo', fill='white', font=f(24), anchor='lm')
d.rounded_rectangle([20, 100, 370, 210], 14, fill=(235, 240, 250)); d.text((36, 130), 'Saldo disponible', fill=(60, 60, 60), font=f(18, False)); d.text((36, 170), '$ 12.345,00', fill='black', font=f(34))
for i, t in enumerate(['Transferir', 'Pagar servicios', 'Mis tarjetas']):
    d.rounded_rectangle([20, 240 + i * 90, 370, 310 + i * 90], 14, fill=(30, 100, 200)); d.text((195, 275 + i * 90), t, fill='white', font=f(24), anchor='mm')
im.save(os.path.join(OUT, 'captura-app.png'))
# 3) plaza (espacio público dibujado): sol, árbol, banco, cartel
im = Image.new('RGB', (1000, 700), (170, 215, 255)); d = ImageDraw.Draw(im); d.rectangle([0, 450, 1000, 700], fill=(90, 170, 90)); d.ellipse([820, 40, 940, 160], fill=(255, 220, 60))
d.rectangle([180, 280, 220, 480], fill=(110, 70, 30)); d.ellipse([90, 120, 310, 330], fill=(30, 120, 40)); d.rectangle([520, 400, 760, 430], fill=(130, 80, 40)); d.rectangle([540, 430, 555, 480], fill=(130, 80, 40)); d.rectangle([725, 430, 740, 480], fill=(130, 80, 40))
d.rectangle([420, 300, 430, 480], fill=(80, 80, 80)); d.rectangle([340, 250, 510, 310], fill=(30, 100, 200)); d.text((425, 280), 'PLAZA', fill='white', font=f(34), anchor='mm')
im.save(os.path.join(OUT, 'plaza.jpg'), quality=90)
# 4) imagen educativa: ciclo del agua simple con texto y flechas
im = Image.new('RGB', (1000, 700), 'white'); d = ImageDraw.Draw(im); d.text((500, 40), 'EL CICLO DEL AGUA', fill=(20, 60, 140), font=f(40), anchor='mm')
d.ellipse([780, 80, 900, 200], fill=(255, 210, 50)); d.rectangle([0, 520, 1000, 700], fill=(60, 140, 220)); d.text((140, 610), 'Mar', fill='white', font=f(36), anchor='mm')
d.ellipse([380, 150, 620, 260], fill=(210, 220, 235)); d.text((500, 205), 'Nube', fill=(40, 40, 40), font=f(30), anchor='mm')
d.line([200, 500, 200, 300], fill=(0, 100, 200), width=8); d.polygon([(200, 270), (180, 310), (220, 310)], fill=(0, 100, 200)); d.text((300, 400), 'Evaporación', fill=(0, 80, 160), font=f(30), anchor='mm')
d.line([700, 270, 700, 480], fill=(0, 100, 200), width=8); d.polygon([(700, 510), (680, 470), (720, 470)], fill=(0, 100, 200)); d.text((820, 390), 'Lluvia', fill=(0, 80, 160), font=f(30), anchor='mm')
im.save(os.path.join(OUT, 'ciclo-agua.png'))
# 5) documento (aviso con texto y un dato personal falso para probar el tapado)
im = Image.new('RGB', (900, 1100), 'white'); d = ImageDraw.Draw(im); d.text((450, 80), 'AVISO DE TURNO', fill='black', font=f(44), anchor='mm')
for i, t in enumerate(['Paciente: Maria Ejemplo', 'DNI 12345678', 'Turno: martes 25 de noviembre', 'Hora: 8:30 hs', 'Llevar: orden y carnet']): d.text((60, 220 + i * 90), t, fill='black', font=f(34, False))
im.save(os.path.join(OUT, 'documento-turno.png'))
print('OK', os.listdir(OUT))
