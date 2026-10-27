# BREACH Våpen – setter før/etter-panelene sammen. Bruk: python3 looks_compose.py v2
import sys, os, shutil
from PIL import Image, ImageDraw
tag = sys.argv[1] if len(sys.argv) > 1 else 'v2'
D = '/workspace/breach/game/src/weapons/shots/looks/'; OUT = '/workspace/breach/game/src/weapons/shots/'; REV = '/workspace/breach/reviews/img/vapen-looks/'
os.makedirs(REV, exist_ok=True)
def lab(im, t):
    c = Image.new('RGB', (im.width, im.height + 18), (18, 20, 23)); c.paste(im, (0, 18)); ImageDraw.Draw(c).text((6, 3), t, fill=(230, 230, 230)); return c
def row(ims, gap=6):
    w = sum(i.width for i in ims) + gap * (len(ims) - 1); h = max(i.height for i in ims)
    c = Image.new('RGB', (w, h), (40, 44, 50)); x = 0
    for i in ims: c.paste(i, (x, 0)); x += i.width + gap
    return c
def col(ims, gap=6):
    w = max(i.width for i in ims); h = sum(i.height for i in ims) + gap * (len(ims) - 1)
    c = Image.new('RGB', (w, h), (40, 44, 50)); y = 0
    for i in ims: c.paste(i, (0, y)); y += i.height + gap
    return c
outs = []
for s in ['east', 'mixed']:
    for z in [1, 2]:
        b = Image.open(f'{D}{tag}-{s}-{z}x-before.png').convert('RGB'); a = Image.open(f'{D}{tag}-{s}-{z}x-after.png').convert('RGB')
        name = f'looks-{s}-{z}x.png'
        if z == 1:  # 1×: ekte piksler + nærmeste-nabo ×2 for å se detaljene
            p = col([row([lab(b, 'BEFORE 1x (temp rifle)'), lab(a, 'AFTER 1x: AR-9 / S-12 / M-4')]),
                     row([lab(b.resize((b.width * 2, b.height * 2), Image.NEAREST), 'before 1x, nearest x2'), lab(a.resize((a.width * 2, a.height * 2), Image.NEAREST), 'after 1x, nearest x2')])])
        else:
            p = row([lab(b, 'BEFORE 2x (temp rifle)'), lab(a, 'AFTER 2x: AR-9 / S-12 / M-4')])
        p.save(OUT + name); shutil.copy(OUT + name, REV + name); outs.append(OUT + name)
print('\n'.join(outs))
