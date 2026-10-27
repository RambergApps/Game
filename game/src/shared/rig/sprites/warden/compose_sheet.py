# Lager shots/v3-trekvart-retninger.png fra atlaset – samme komposisjon som sprite34.js (skygge → bein → torso).
import json, math, re, os
from PIL import Image, ImageDraw, ImageFont
D = os.path.dirname(os.path.abspath(__file__))
M = json.loads(re.search(r'MANIFEST = (\{.*\});', open(os.path.join(D, 'manifest.js')).read()).group(1))
A = Image.open(os.path.join(D, 'warden.png')).convert('RGBA'); SA = Image.open(os.path.join(D, 'warden_shadow.png')).convert('RGBA')
S = M['scale']; CW, CH = M['cell']; AX, AY = M['anchor']; SW, SH = M['shadowCell']; SAX, SAY = M['shadowAnchor']
def cell(set_, d, f=0):
    c, r = M['sets'][set_]['cells'][f'{d}_{f}']; return A.crop((c*CW*S, r*CH*S, (c+1)*CW*S, (r+1)*CH*S))
def scell(set_, d, f=0):
    c, r = M['sets'][set_]['cells'][f'{d}_{f}']; im = SA.crop((c*SW, r*SH, (c+1)*SW, (r+1)*SH)).resize((SW*S, SH*S), Image.BILINEAR)
    a = im.split()[3].point(lambda v: int(v*.42)); im.putalpha(a); return im
def figure(legs, ld, f, torso, td, z=2):
    # returnerer bilde i 2×-oppløsning (atlas native), ankret i (AX*S, AY*S)
    W, H = CW*S, CH*S; im = Image.new('RGBA', (W, H), (0,0,0,0))
    sh = scell(legs, ld, f); im.alpha_composite(sh.crop((0,0,min(SW*S, W+ (SAX-AX)*S), min(SH*S, H))), dest=(max(0,(AX-SAX)*S), (AY-SAY)*S)) if (AX-SAX)>=0 else None
    if AX - SAX < 0:
        ox = (SAX-AX)*S; im.alpha_composite(sh.crop((ox, 0, ox+W, min(SH*S, H-(AY-SAY)*S))), dest=(0,(AY-SAY)*S))
    im.alpha_composite(cell(legs, ld, f))
    oy = 0; ox = 0
    if legs == 'legs_walk':
        dz = M['walkTorsoDz'][f]; sw = M['walkSway'][f]; hip = ld*2*math.pi/M['sets'][legs]['dirs']
        oy = -dz*.75 + math.cos(hip)*sw; ox = -math.sin(hip)*sw
    t = cell(torso, td); im.alpha_composite(t, dest=(round(ox*S), round(oy*S))) if ox >= 0 and oy >= 0 else im.alpha_composite(t.crop((max(0,-round(ox*S)), max(0,-round(oy*S)), W, H)), dest=(max(0,round(ox*S)), max(0,round(oy*S))))
    return im if z == 2 else im.resize((im.width*z//2, im.height*z//2), Image.LANCZOS if z < 2 else Image.BILINEAR)
def ground(w, h):
    g = Image.new('RGBA', (w, h), (52, 50, 44, 255)); d = ImageDraw.Draw(g)
    for y in range(0, h, 64):
        for x in range(0, w, 64):
            if (x//64 + y//64) % 2: d.rectangle((x, y, x+63, y+63), fill=(56, 54, 47, 255))
    return g
try: FONT = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 18); FS = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 13)
except Exception: FONT = FS = ImageFont.load_default()
DIRN = ['Ø', 'SØ', 'S', 'SV', 'V', 'NV', 'N', 'NØ']
rows2 = [('IDLE 2× – 8 retninger (bein 8, torso samme retning)', [('legs_idle', i, 0, 'torso_stand', 2*i) for i in range(8)]),
         ('WALK 2× – 8 retninger (ramme 2 av 8)', [('legs_walk', i, 2, 'torso_stand', 2*i) for i in range(8)]),
         ('COVER/CROUCH 2× – 8 retninger', [('legs_crouch', i, 0, 'torso_crouch', 2*i) for i in range(8)]),
         ('WALK-SYKLUS 2× – retning SØ, ramme 0–7', [('legs_walk', 1, f, 'torso_stand', 2) for f in range(8)]),
         ('TORSO 16 retninger 2× (bein idle Ø) – sikte 0°…337.5°', [('legs_idle', 0, 0, 'torso_stand', i) for i in range(0, 16)])]
cw2, ch2 = CW*S, CH*S
W = 16*cw2//2*2 if False else 8*cw2 + 40
W = max(W, 16*(cw2*3//4) + 40)
rows4 = [('IDLE 4×', [('legs_idle', i, 0, 'torso_stand', 2*i) for i in range(8)]),
         ('WALK 4× (ramme 2)', [('legs_walk', i, 2, 'torso_stand', 2*i) for i in range(8)]),
         ('COVER/CROUCH 4×', [('legs_crouch', i, 0, 'torso_crouch', 2*i) for i in range(8)])]
cw4, ch4 = cw2*2, ch2*2
W = max(W, 8*cw4 + 40)
H = 60 + len(rows2)*(ch2+34) + len(rows4)*(ch4+34) + 20
out = ground(W, H); d = ImageDraw.Draw(out)
d.text((20, 16), 'Warden v3 – trekvart (PROJ 37°, zScale 0.75) – forhåndsrendret 3D-volummodell, samme atlas som sprite34.js', font=FONT, fill=(235, 230, 215))
y = 60
for title, figs in rows2:
    d.text((20, y), title, font=FS, fill=(220, 210, 190)); y += 20
    step = cw2 if len(figs) <= 8 else (W-40)//len(figs)
    for k, f in enumerate(figs):
        out.alpha_composite(figure(*f), dest=(20 + k*step + (step-cw2)//2 if step >= cw2 else 20 + k*step - (cw2-step)//2, y))
        if len(figs) == 8 and 'SYKLUS' not in title: d.text((20 + k*step + 4, y + ch2 - 14), DIRN[k], font=FS, fill=(160, 160, 150))
    y += ch2 + 14
for title, figs in rows4:
    d.text((20, y), title, font=FS, fill=(220, 210, 190)); y += 20
    for k, f in enumerate(figs):
        out.alpha_composite(figure(*f, z=4), dest=(20 + k*cw4, y)); d.text((20 + k*cw4 + 6, y + ch4 - 18), DIRN[k], font=FS, fill=(160, 160, 150))
    y += ch4 + 14
out.convert('RGB').save('/workspace/breach/shots/v3-trekvart-retninger.png', optimize=True)
print(out.size)
