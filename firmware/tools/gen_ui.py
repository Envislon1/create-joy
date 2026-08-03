"""Generate 240x320 TFT page PNGs for MindBuddy ESP32 device.
Matches the dark-theme mockup style: teal accents on charcoal panels.
Outputs to /mnt/documents/sdcard/ui/*.png (RGB565-friendly).
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os, math, struct, wave

OUT = "/mnt/documents/sdcard/ui"
AUD = "/mnt/documents/sdcard/audio"
os.makedirs(OUT, exist_ok=True)
os.makedirs(AUD, exist_ok=True)

FDIR = "/nix/store/xbs17gmksi0pljxcs4l6gshklzpmv8gr-dejavu-fonts-2.37/share/fonts/truetype"
def F(sz, bold=False):
    name = "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"
    return ImageFont.truetype(f"{FDIR}/{name}", sz)

# Palette (from mockups)
BG        = (11, 17, 25)
PANEL     = (26, 35, 48)
PANEL2    = (34, 44, 58)
BORDER    = (45, 58, 76)
TEAL      = (52, 214, 160)
TEAL_DIM  = (28, 90, 74)
PURPLE    = (139, 127, 245)
PURPLE_DIM= (58, 48, 92)
RED       = (224, 85, 95)
RED_DIM   = (80, 30, 38)
YELLOW    = (245, 184, 73)
YELLOW_DIM= (80, 58, 24)
WHITE     = (240, 245, 250)
TEXT      = (220, 228, 236)
MUTED     = (140, 155, 172)
DIM       = (95, 108, 125)

W, H = 240, 320

def new_page():
    im = Image.new("RGB", (W, H), BG)
    d  = ImageDraw.Draw(im)
    return im, d

def rrect(d, xy, r, fill=None, outline=None, width=1):
    d.rounded_rectangle(xy, radius=r, fill=fill, outline=outline, width=width)

def status_bar(d, wifi=True, batt=True):
    d.text((8, 4), "09:41", font=F(11, True), fill=TEXT)
    # wifi arcs
    if wifi:
        cx, cy = 218, 12
        for r, c in [(6, TEAL), (4, TEAL), (2, TEAL)]:
            d.arc((cx-r, cy-r, cx+r, cy+r), 210, 330, fill=c, width=1)
    if batt:
        d.rounded_rectangle((225, 6, 236, 14), 1, outline=TEXT, width=1)
        d.rectangle((236, 8, 237, 12), fill=TEXT)
        d.rectangle((227, 8, 234, 12), fill=TEAL)

def back_arrow(d, x=8, y=32):
    d.text((x, y-2), "‹", font=F(20, True), fill=TEXT)

def home_pill(d):
    cx, cy = W//2, H-14
    r = 12
    d.ellipse((cx-r, cy-r, cx+r, cy+r), outline=BORDER, width=1, fill=PANEL)
    # home glyph
    d.polygon([(cx-5, cy+1),(cx, cy-5),(cx+5, cy+1)], outline=MUTED)
    d.rectangle((cx-4, cy+1, cx+4, cy+5), outline=MUTED)

def title(d, text, x=24, y=30):
    d.text((x, y), text, font=F(14, True), fill=WHITE)

# ---------- Splash ----------
def splash():
    im, d = new_page()
    # gradient wash
    for i in range(H):
        t = i/H
        r = int(11 + 20*t); g = int(17 + 40*t); b = int(25 + 30*t)
        d.line((0,i,W,i), fill=(r,g,b))
    # logo circle
    cx, cy = W//2, 120
    for r in range(50, 0, -1):
        a = int(60*(r/50))
        d.ellipse((cx-r, cy-r, cx+r, cy+r), outline=(52,214,160,a) if False else None,
                  fill=None)
    d.ellipse((cx-38, cy-38, cx+38, cy+38), fill=PANEL2, outline=TEAL, width=2)
    d.text((cx-18, cy-14), "MB", font=F(28, True), fill=TEAL)
    d.text((W//2-52, 180), "MindBuddy", font=F(22, True), fill=WHITE)
    d.text((W//2-64, 210), "your calm companion", font=F(11), fill=MUTED)
    # loader dots
    for i, x in enumerate([100,120,140]):
        d.ellipse((x-3, 260, x+3, 266), fill=TEAL if i==1 else DIM)
    d.text((W//2-24, 296), "fw 1.0.0", font=F(9), fill=DIM)
    im.save(f"{OUT}/splash.png")

# ---------- Wifi setup ----------
def wifi_setup():
    im, d = new_page()
    status_bar(d)
    title(d, "Wi-Fi Setup", 12, 30)
    # wifi icon
    cx, cy = W//2, 90
    for r, c in [(28, TEAL), (20, TEAL), (12, TEAL)]:
        d.arc((cx-r, cy-r+10, cx+r, cy+r+10), 200, 340, fill=c, width=3)
    d.ellipse((cx-3, cy+16, cx+3, cy+22), fill=TEAL)
    steps = [
        ("1", "Join Wi-Fi \"MindBuddy-Setup\""),
        ("2", "Portal opens automatically"),
        ("3", "Pick network + enter password"),
    ]
    y = 150
    for n, s in steps:
        rrect(d, (12, y, 228, y+36), 8, fill=PANEL, outline=BORDER)
        d.ellipse((20, y+8, 40, y+28), fill=TEAL_DIM, outline=TEAL)
        d.text((26, y+10), n, font=F(12, True), fill=TEAL)
        d.text((50, y+12), s, font=F(10), fill=TEXT)
        y += 44
    im.save(f"{OUT}/wifi_setup.png")

# ---------- Home ----------
def home():
    im, d = new_page()
    status_bar(d)
    d.text((12, 28), "GOOD EVENING", font=F(8, True), fill=MUTED)
    d.text((12, 40), "MindBuddy", font=F(20, True), fill=WHITE)
    d.text((12, 66), "How are you feeling today?", font=F(10), fill=MUTED)
    # mood emojis
    moods = [("😔", False),("😕", False),("😐", False),("🙂", True),("😊", False)]
    # emoji fonts may not render, use colored circles + face
    faces = [("😔",(230,150,90)),("😕",(230,170,90)),("😐",(230,200,90)),
             ("🙂",(255,205,80)),("😊",(255,215,120))]
    for i,(_,col) in enumerate(faces):
        cx = 26 + i*47
        cy = 100
        sel = (i==3)
        if sel:
            rrect(d, (cx-18, cy-14, cx+18, cy+14), 9, fill=TEAL_DIM, outline=TEAL)
        d.ellipse((cx-10, cy-10, cx+10, cy+10), fill=col)
        # eyes
        d.ellipse((cx-5, cy-3, cx-3, cy-1), fill=(30,30,30))
        d.ellipse((cx+3, cy-3, cx+5, cy-1), fill=(30,30,30))
        # mouth by index
        if i==0:
            d.arc((cx-4, cy+2, cx+4, cy+8), 200, 340, fill=(30,30,30), width=1)
        elif i==1:
            d.line((cx-3, cy+4, cx+3, cy+4), fill=(30,30,30))
        elif i==2:
            d.line((cx-3, cy+4, cx+3, cy+4), fill=(30,30,30))
        else:
            d.arc((cx-4, cy, cx+4, cy+7), 20, 160, fill=(30,30,30), width=1)

    # 6 tiles grid
    tiles = [
        ("Modes",  PURPLE, PURPLE_DIM, "brain"),
        ("Chat",   TEAL,   TEAL_DIM,   "chat"),
        ("Music",  YELLOW, YELLOW_DIM, "note"),
        ("Reminder", TEAL, TEAL_DIM,   "bell"),
        ("SOS",    RED,    RED_DIM,    "warn"),
        ("Settings",MUTED, PANEL2,     "gear"),
    ]
    for i, (name, col, dim, icon) in enumerate(tiles):
        c = i % 3; r = i // 3
        x = 12 + c*72; y = 130 + r*62
        rrect(d, (x, y, x+64, y+54), 10, fill=dim, outline=col, width=1)
        # icon
        ix, iy = x+32, y+20
        if icon=="brain":
            d.ellipse((ix-9, iy-8, ix+9, iy+8), outline=col, width=2)
            d.line((ix, iy-8, ix, iy+8), fill=col, width=1)
        elif icon=="chat":
            rrect(d, (ix-10, iy-7, ix+10, iy+5), 4, outline=col, width=2)
            d.polygon([(ix-3, iy+5),(ix+3, iy+5),(ix, iy+9)], fill=col)
        elif icon=="note":
            d.line((ix+5, iy-8, ix+5, iy+6), fill=col, width=2)
            d.ellipse((ix-2, iy+4, ix+6, iy+9), fill=col)
        elif icon=="bell":
            d.pieslice((ix-8, iy-8, ix+8, iy+6), 180, 360, fill=col)
            d.rectangle((ix-9, iy+5, ix+9, iy+7), fill=col)
            d.ellipse((ix-2, iy+7, ix+2, iy+11), fill=col)
        elif icon=="warn":
            d.polygon([(ix, iy-9),(ix+9, iy+7),(ix-9, iy+7)], outline=col, width=2)
            d.line((ix, iy-3, ix, iy+2), fill=col, width=2)
            d.ellipse((ix-1, iy+4, ix+1, iy+6), fill=col)
        elif icon=="gear":
            d.ellipse((ix-8, iy-8, ix+8, iy+8), outline=col, width=2)
            d.ellipse((ix-3, iy-3, ix+3, iy+3), fill=col)
        d.text((x+6, y+38), name, font=F(9, True), fill=WHITE)
    # quote card
    rrect(d, (12, H-58, 228, H-30), 8, fill=PANEL, outline=BORDER)
    d.text((18, H-52), '"You are stronger than', font=F(9), fill=TEAL)
    d.text((18, H-40), ' you think."', font=F(9), fill=TEAL)
    home_pill(d)
    im.save(f"{OUT}/home.png")

# ---------- Chat ----------
def chat():
    im, d = new_page()
    status_bar(d)
    back_arrow(d)
    # avatar
    d.ellipse((26, 28, 46, 48), fill=TEAL_DIM, outline=TEAL)
    d.text((30, 30), "MB", font=F(10, True), fill=TEAL)
    d.text((52, 28), "MindBuddy", font=F(12, True), fill=WHITE)
    d.ellipse((52, 46, 56, 50), fill=TEAL)
    d.text((60, 44), "Anxiety Mode", font=F(8), fill=TEAL)
    # bubbles
    def bubble(y, text, user=False):
        lines = text.split("\n")
        h = 8 + 12*len(lines)
        w = min(180, max(60, max(len(l) for l in lines)*5 + 16))
        if user:
            x2 = 228; x1 = x2 - w
            rrect(d, (x1, y, x2, y+h), 8, fill=TEAL)
            col = (10, 30, 24)
        else:
            x1 = 12; x2 = x1 + w
            rrect(d, (x1, y, x2, y+h), 8, fill=PANEL, outline=BORDER)
            col = TEXT
        for i, ln in enumerate(lines):
            d.text((x1+8, y+5+i*12), ln, font=F(9), fill=col)
        return y + h + 6
    y = 62
    y = bubble(y, "Hi! I'm MindBuddy.\nHow are you feeling?")
    y = bubble(y, "A bit anxious today...", user=True)
    y = bubble(y, "Let's try a breathing\nexercise. Inhale 4,\nhold 4, exhale 6.")
    y = bubble(y, "Okay, that helped.", user=True)
    # input bar
    rrect(d, (12, 278, 200, 300), 11, fill=PANEL, outline=BORDER)
    d.text((22, 285), "Type a message...", font=F(9), fill=DIM)
    d.ellipse((206, 278, 228, 300), fill=TEAL)
    d.polygon([(212,289),(224,283),(220,289),(224,295)], fill=(10,30,24))
    home_pill(d)
    im.save(f"{OUT}/chat.png")

# ---------- Modes ----------
def modes():
    im, d = new_page()
    status_bar(d)
    back_arrow(d)
    title(d, "Select Mode", 22, 30)
    d.text((12, 50), "Choose your support focus", font=F(9), fill=MUTED)
    items = [
        ("Anxiety",   "Calm your mind",     TEAL,   TEAL_DIM),
        ("Depression","Mood lifting",       PURPLE, PURPLE_DIM),
        ("PTSD",      "Safe space",         TEAL,   TEAL_DIM),
        ("ADHD",      "Focus & structure",  YELLOW, YELLOW_DIM),
        ("Bipolar",   "Balance & steady",   RED,    RED_DIM),
        ("General",   "Everyday care",      MUTED,  PANEL2),
    ]
    for i,(name, sub, col, dim) in enumerate(items):
        c = i%2; r = i//2
        x = 12 + c*112; y = 68 + r*72
        rrect(d, (x, y, x+108, y+64), 8, fill=PANEL, outline=BORDER)
        # icon chip
        rrect(d, (x+8, y+8, x+34, y+34), 6, fill=dim)
        d.ellipse((x+13, y+13, x+29, y+29), outline=col, width=2)
        d.text((x+8, y+38), name, font=F(10, True), fill=WHITE)
        d.text((x+8, y+50), sub, font=F(8), fill=MUTED)
    home_pill(d)
    im.save(f"{OUT}/modes.png")

# ---------- Reminders / Meds ----------
def reminders():
    im, d = new_page()
    status_bar(d)
    back_arrow(d)
    title(d, "Medication Reminders", 22, 30)
    items = [
        ("Sertraline 50mg", "08:00", True),
        ("Alprazolam 0.5mg","12:00", True),
        ("Melatonin 5mg",   "21:00", False),
    ]
    y = 60
    for name, tm, on in items:
        rrect(d, (12, y, 228, y+42), 8, fill=PANEL, outline=TEAL if on else BORDER)
        # bell
        ix, iy = 26, y+21
        d.pieslice((ix-8, iy-8, ix+8, iy+6), 180, 360, fill=TEAL if on else DIM)
        d.rectangle((ix-9, iy+5, ix+9, iy+7), fill=TEAL if on else DIM)
        d.text((44, y+8), name, font=F(10, True), fill=WHITE)
        d.text((44, y+22), tm, font=F(9), fill=MUTED)
        # toggle
        tw = 26; th = 14
        tx = 168; ty = y+14
        rrect(d, (tx, ty, tx+tw, ty+th), 7, fill=TEAL if on else PANEL2, outline=BORDER)
        cx = tx+tw-7 if on else tx+7
        d.ellipse((cx-5, ty+2, cx+5, ty+12), fill=WHITE)
        # x
        d.text((208, y+15), "×", font=F(14), fill=DIM)
        y += 50
    # add button
    rrect(d, (12, y+4, 228, y+34), 8, fill=TEAL)
    d.text((94, y+11), "+ Add", font=F(11, True), fill=(10,30,24))
    home_pill(d)
    im.save(f"{OUT}/reminders.png")

# ---------- Music ----------
def music():
    im, d = new_page()
    status_bar(d)
    back_arrow(d)
    title(d, "Music", 22, 30)
    # album art
    rrect(d, (70, 60, 170, 160), 14, fill=PURPLE_DIM, outline=PURPLE)
    # headphones icon
    cx, cy = 120, 108
    d.arc((cx-24, cy-20, cx+24, cy+20), 180, 360, fill=PURPLE, width=3)
    rrect(d, (cx-26, cy-4, cx-16, cy+16), 3, fill=PURPLE)
    rrect(d, (cx+16, cy-4, cx+26, cy+16), 3, fill=PURPLE)
    d.text((W//2-40, 174), "Ocean Waves", font=F(13, True), fill=WHITE)
    d.text((W//2-36, 192), "Nature Sounds", font=F(9), fill=MUTED)
    # progress
    d.rectangle((20, 216, 220, 220), fill=PANEL2)
    d.rectangle((20, 216, 100, 220), fill=PURPLE)
    d.ellipse((96, 213, 104, 223), fill=WHITE)
    d.text((20, 226), "1:44", font=F(8), fill=MUTED)
    d.text((204, 226), "4:32", font=F(8), fill=MUTED)
    # controls
    d.polygon([(66,254),(80,246),(80,262)], fill=WHITE); d.rectangle((62,246,66,262), fill=WHITE)
    d.ellipse((100,240,140,280), fill=PURPLE)
    d.polygon([(114,252),(114,268),(130,260)], fill=WHITE)
    d.polygon([(174,254),(160,246),(160,262)], fill=WHITE); d.rectangle((174,246,178,262), fill=WHITE)
    d.text((20, 292), "UP NEXT", font=F(8, True), fill=MUTED)
    home_pill(d)
    im.save(f"{OUT}/music.png")

# ---------- Dial ----------
def dial():
    im, d = new_page()
    status_bar(d)
    back_arrow(d)
    title(d, "Dialer", 22, 30)
    rrect(d, (12, 54, 228, 82), 6, fill=PANEL, outline=BORDER)
    d.text((22, 62), "+234 ...", font=F(14, True), fill=WHITE)
    keys = [("1",""),("2","ABC"),("3","DEF"),
            ("4","GHI"),("5","JKL"),("6","MNO"),
            ("7","PQRS"),("8","TUV"),("9","WXYZ"),
            ("*",""),("0","+"),("#","")]
    for i,(k, sub) in enumerate(keys):
        c = i%3; r = i//3
        x = 20 + c*70; y = 92 + r*40
        d.ellipse((x, y, x+56, y+32), fill=PANEL, outline=BORDER)
        d.text((x+22 if k not in ("*","#") else x+24, y+6), k, font=F(14, True), fill=WHITE)
        if sub:
            d.text((x+16, y+22), sub, font=F(6), fill=MUTED)
    rrect(d, (60, 260, 180, 288), 14, fill=TEAL)
    # phone icon
    d.text((88, 267), "📞 Call", font=F(11, True), fill=(10,30,24))
    home_pill(d)
    im.save(f"{OUT}/dial.png")

# ---------- SMS ----------
def sms():
    im, d = new_page()
    status_bar(d)
    back_arrow(d)
    title(d, "Messages", 22, 30)
    tabs = [("Inbox", True),("Outbox", False),("New", False)]
    x = 12
    for name, sel in tabs:
        w = 68
        rrect(d, (x, 52, x+w, 72), 10, fill=TEAL_DIM if sel else PANEL,
              outline=TEAL if sel else BORDER)
        d.text((x+w//2 - len(name)*3, 57), name, font=F(9, True),
               fill=TEAL if sel else MUTED)
        x += w + 4
    convos = [
        ("D","Dr. Patel","Next appt Friday 10am","09:15",TEAL),
        ("M","Mom","Just checking in!","Yest",PURPLE),
        ("C","Crisis Line","You're not alone.","Mon",RED),
    ]
    y = 84
    for init, name, msg, tm, col in convos:
        rrect(d, (12, y, 228, y+52), 8, fill=PANEL, outline=BORDER)
        d.ellipse((20, y+10, 46, y+36), fill=col)
        d.text((28, y+15), init, font=F(11, True), fill=WHITE)
        d.text((54, y+8), name, font=F(10, True), fill=WHITE)
        d.text((54, y+24), msg, font=F(8), fill=MUTED)
        d.text((196, y+8), tm, font=F(8), fill=MUTED)
        d.ellipse((214, y+26, 220, y+32), fill=TEAL)
        y += 58
    home_pill(d)
    im.save(f"{OUT}/sms.png")

# ---------- Call Log ----------
def calllog():
    im, d = new_page()
    status_bar(d)
    back_arrow(d)
    title(d, "Call Log", 22, 30)
    tabs = ["All","In","Out","Miss"]
    x = 12
    for i,t in enumerate(tabs):
        w = 50
        sel = i==0
        rrect(d, (x, 52, x+w, 72), 10, fill=TEAL_DIM if sel else PANEL,
              outline=TEAL if sel else BORDER)
        d.text((x+w//2 - len(t)*3, 57), t, font=F(9, True),
               fill=TEAL if sel else MUTED)
        x += w + 4
    items = [
        ("Unknown","+1 555-0199","08:45","missed",RED,"in"),
        ("Mom","+1 555-0134","Yest 12:07","",PURPLE,"out"),
        ("Crisis Line","988","Mon 8:20","",TEAL,"in"),
        ("Dr. Patel","+1 555-0102","Sun","missed",RED,"in"),
    ]
    y = 82
    for name, num, tm, tag, col, dirn in items:
        rrect(d, (12, y, 228, y+48), 8, fill=PANEL, outline=BORDER)
        d.ellipse((20, y+12, 44, y+36), fill=(col[0]//3, col[1]//3, col[2]//3), outline=col)
        # arrow
        cx, cy = 32, 24+y
        if dirn=="in":
            d.polygon([(cx-4,cy-4),(cx+4,cy+4),(cx-4,cy+4)], fill=col)
        else:
            d.polygon([(cx+4,cy-4),(cx-4,cy+4),(cx+4,cy+4)], fill=col)
        d.text((52, y+8), name, font=F(10, True), fill=WHITE)
        d.text((52, y+22), num, font=F(8), fill=MUTED)
        d.text((176, y+8), tm, font=F(8), fill=MUTED)
        if tag:
            d.text((192, y+22), tag, font=F(8, True), fill=RED)
        y += 54
    home_pill(d)
    im.save(f"{OUT}/calllog.png")

# ---------- SOS ----------
def sos():
    im, d = new_page()
    status_bar(d)
    back_arrow(d)
    d.text((60, 30), "SOS Crisis Support", font=F(12, True), fill=RED)
    # big red button
    cx, cy = W//2, 100
    d.ellipse((cx-42, cy-42, cx+42, cy+42), fill=(90,20,26))
    d.ellipse((cx-36, cy-36, cx+36, cy+36), fill=RED)
    d.text((cx-16, cy-14), "📞", font=F(16), fill=WHITE)
    d.text((cx-24, cy+2), "CALL", font=F(10, True), fill=WHITE)
    d.text((cx-24, cy+14), "HELP", font=F(10, True), fill=WHITE)
    d.text((W//2-70, 154), "→ Dr. Patel  +1 555-0102", font=F(9), fill=RED)
    # two buttons
    rrect(d, (12, 170, 118, 196), 12, fill=RED_DIM, outline=RED)
    d.text((32, 177), "Dial Pad", font=F(10, True), fill=RED)
    rrect(d, (124, 170, 228, 196), 12, fill=PURPLE_DIM, outline=PURPLE)
    d.text((140, 177), "Contacts (2/5)", font=F(9, True), fill=PURPLE)
    d.text((12, 206), "EMERGENCY CONTACTS", font=F(8, True), fill=MUTED)
    contacts = [("D","Dr. Patel","+1 555-0102", True, RED),
                ("M","Mom","+1 555-0134", False, PURPLE)]
    y = 220
    for init, name, num, on, col in contacts:
        rrect(d, (12, y, 228, y+38), 8, fill=PANEL,
              outline=col if on else BORDER)
        d.ellipse((20, y+8, 42, y+30), fill=col if on else DIM)
        d.text((26, y+12), init, font=F(10, True), fill=WHITE)
        d.text((52, y+8), name, font=F(10, True), fill=col if on else WHITE)
        d.text((52, y+22), num, font=F(8), fill=MUTED)
        tw = 24; th = 12; tx = 188; ty = y+13
        rrect(d, (tx, ty, tx+tw, ty+th), 6, fill=col if on else PANEL2, outline=BORDER)
        cxb = tx+tw-6 if on else tx+6
        d.ellipse((cxb-4, ty+2, cxb+4, ty+10), fill=WHITE)
        y += 42
    d.text((28, 304), "Immediate danger? Also call 911", font=F(8), fill=MUTED)
    im.save(f"{OUT}/sos.png")

# ---------- Settings top ----------
def settings_top():
    im, d = new_page()
    status_bar(d)
    back_arrow(d)
    title(d, "Settings", 22, 30)
    d.text((12, 52), "PIPELINE", font=F(8, True), fill=MUTED)
    rrect(d, (12, 66, 228, 118), 8, fill=PANEL, outline=BORDER)
    # wifi glyph
    cx, cy = 24, 82
    for r,c in [(6,TEAL),(4,TEAL),(2,TEAL)]:
        d.arc((cx-r, cy-r, cx+r, cy+r), 200, 340, fill=c, width=1)
    d.text((36, 76), "Connection Mode", font=F(10, True), fill=WHITE)
    opts = [("Auto", True),("Online", False),("Offline", False)]
    x = 20
    for name, sel in opts:
        w = 60
        rrect(d, (x, 92, x+w, 112), 10, fill=TEAL_DIM if sel else PANEL2,
              outline=TEAL if sel else BORDER)
        d.text((x+w//2-len(name)*3, 96), name, font=F(9, True),
               fill=TEAL if sel else MUTED)
        x += w + 4
    d.text((12, 128), "VOICE ENGINE", font=F(8, True), fill=MUTED)
    rrect(d, (12, 142, 228, 220), 8, fill=PANEL, outline=BORDER)
    d.text((22, 150), "🎙", font=F(10), fill=PURPLE)
    d.text((36, 150), "Local TTS Engine", font=F(10, True), fill=WHITE)
    # two buttons
    rrect(d, (20, 168, 118, 188), 10, fill=PURPLE_DIM, outline=PURPLE)
    d.text((44, 173), "Kokoro", font=F(9, True), fill=PURPLE)
    rrect(d, (122, 168, 220, 188), 10, fill=PANEL2, outline=BORDER)
    d.text((150, 173), "Piper", font=F(9, True), fill=MUTED)
    d.text((22, 196), "Voice Gender", font=F(10, True), fill=WHITE)
    rrect(d, (20, 232, 118, 252), 10, fill=PANEL2, outline=BORDER)
    d.text((54, 237), "Male", font=F(9, True), fill=MUTED)
    rrect(d, (122, 232, 220, 252), 10, fill=RED_DIM, outline=RED)
    d.text((150, 237), "Female", font=F(9, True), fill=RED)
    home_pill(d)
    im.save(f"{OUT}/settings_top.png")

# ---------- Settings bottom ----------
def settings_bottom():
    im, d = new_page()
    status_bar(d)
    back_arrow(d)
    title(d, "Settings", 22, 30)
    d.text((12, 52), "NOTIFICATIONS", font=F(8, True), fill=MUTED)
    rrect(d, (12, 66, 228, 158), 8, fill=PANEL, outline=BORDER)
    rows = [("🔔","Medication Reminders", True),
            ("⏰","Daily Check-in", True),
            ("⚠","Crisis Alerts", False)]
    y = 74
    for icon, name, on in rows:
        d.text((22, y+4), icon, font=F(12), fill=TEAL if on else MUTED)
        d.text((44, y+6), name, font=F(10, True), fill=WHITE)
        tw=24; th=12; tx=190; ty=y+8
        rrect(d, (tx, ty, tx+tw, ty+th), 6, fill=TEAL if on else PANEL2, outline=BORDER)
        cxb = tx+tw-6 if on else tx+6
        d.ellipse((cxb-4, ty+2, cxb+4, ty+10), fill=WHITE)
        y += 28
    d.text((12, 168), "APPEARANCE", font=F(8, True), fill=MUTED)
    rrect(d, (12, 182, 228, 246), 8, fill=PANEL, outline=BORDER)
    rows2 = [("🌙","Dark Mode", True),("↺","Reduced Motion", False)]
    y = 190
    for icon, name, on in rows2:
        d.text((22, y+4), icon, font=F(12), fill=TEAL if on else MUTED)
        d.text((44, y+6), name, font=F(10, True), fill=WHITE)
        tw=24; th=12; tx=190; ty=y+8
        rrect(d, (tx, ty, tx+tw, ty+th), 6, fill=TEAL if on else PANEL2, outline=BORDER)
        cxb = tx+tw-6 if on else tx+6
        d.ellipse((cxb-4, ty+2, cxb+4, ty+10), fill=WHITE)
        y += 28
    home_pill(d)
    im.save(f"{OUT}/settings_bottom.png")

# ---------- Icons library (small standalone for overlays) ----------
def icons():
    icons_dir = "/mnt/documents/sdcard/icons"
    os.makedirs(icons_dir, exist_ok=True)
    def make(name, drawfn, size=32, col=TEAL):
        im = Image.new("RGBA",(size,size),(0,0,0,0))
        d = ImageDraw.Draw(im)
        drawfn(d, size, col)
        im.save(f"{icons_dir}/{name}.png")
    make("wifi", lambda d,s,c: [d.arc((s/2-r,s/2-r,s/2+r,s/2+r), 200, 340, fill=c, width=2) for r in (12,8,4)])
    make("battery", lambda d,s,c: (d.rounded_rectangle((4,10,26,22),2,outline=c,width=2), d.rectangle((26,13,29,19),fill=c), d.rectangle((6,12,20,20),fill=c)))
    make("home", lambda d,s,c: (d.polygon([(6,18),(16,6),(26,18)], outline=c), d.rectangle((10,18,22,26),outline=c)))
    make("back", lambda d,s,c: d.line([(20,6),(10,16),(20,26)], fill=c, width=3))
    make("mic", lambda d,s,c: (d.rounded_rectangle((12,4,20,20),4,fill=c), d.arc((6,10,26,26),0,180,fill=c,width=2), d.line((16,26,16,30),fill=c,width=2)))
    make("bell", lambda d,s,c: (d.pieslice((4,4,28,22),180,360,fill=c), d.rectangle((3,20,29,24),fill=c), d.ellipse((14,24,18,28),fill=c)))
    make("phone", lambda d,s,c: d.polygon([(6,4),(12,4),(14,10),(11,13),(19,21),(22,18),(28,20),(28,26),(22,28),(4,10)], fill=c))
    make("chat", lambda d,s,c: (d.rounded_rectangle((4,6,28,22),4,outline=c,width=2), d.polygon([(10,22),(14,22),(12,26)],fill=c)))
    make("note", lambda d,s,c: (d.line((20,6,20,24),fill=c,width=2), d.ellipse((10,20,22,28),fill=c)))
    make("brain", lambda d,s,c: (d.ellipse((6,6,26,26),outline=c,width=2), d.line((16,6,16,26),fill=c)))
    make("gear", lambda d,s,c: (d.ellipse((6,6,26,26),outline=c,width=2), d.ellipse((13,13,19,19),fill=c)))
    make("warn", lambda d,s,c: (d.polygon([(16,4),(28,26),(4,26)], outline=c, width=2), d.line((16,12,16,20),fill=c,width=2), d.ellipse((15,22,17,24),fill=c)), col=RED)
    make("heart", lambda d,s,c: d.polygon([(16,26),(4,14),(4,10),(10,6),(16,10),(22,6),(28,10),(28,14)], fill=c), col=RED)
    make("play", lambda d,s,c: d.polygon([(10,6),(10,26),(26,16)], fill=c))
    make("pause", lambda d,s,c: (d.rectangle((8,6,14,26),fill=c), d.rectangle((18,6,24,26),fill=c)))
    make("prev", lambda d,s,c: (d.polygon([(22,6),(22,26),(10,16)], fill=c), d.rectangle((6,6,10,26),fill=c)))
    make("next", lambda d,s,c: (d.polygon([(10,6),(10,26),(22,16)], fill=c), d.rectangle((22,6,26,26),fill=c)))
    make("send", lambda d,s,c: d.polygon([(4,4),(28,16),(4,28),(10,16)], fill=c))

# ---------- Audio: notification + alarm WAVs ----------
def wav_tone(path, freqs, dur=1.5, sr=22050, envelope=True):
    n = int(sr*dur)
    frames = bytearray()
    for i in range(n):
        t = i/sr
        s = 0.0
        for f in freqs:
            s += math.sin(2*math.pi*f*t)
        s /= len(freqs)
        env = 1.0
        if envelope:
            attack = 0.02; release = 0.15
            if t < attack: env = t/attack
            elif t > dur-release: env = max(0,(dur-t)/release)
        v = int(s*env*0.6*32767)
        frames += struct.pack("<h", v)
    with wave.open(path,"wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes(bytes(frames))

def notification():
    # two-tone chime
    sr=22050
    frames=bytearray()
    for freq, dur in [(880, 0.15), (0, 0.05), (1320, 0.25)]:
        n=int(sr*dur)
        for i in range(n):
            t=i/sr
            env=1.0
            if freq==0:
                v=0
            else:
                a=0.01; r=min(0.08,dur/2)
                if t<a: env=t/a
                elif t>dur-r: env=max(0,(dur-t)/r)
                v=int(math.sin(2*math.pi*freq*t)*env*0.5*32767)
            frames+=struct.pack("<h", v)
    with wave.open(f"{AUD}/notification.wav","wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes(bytes(frames))

def alarm():
    # gentle rising alarm 3s
    sr=22050; dur=3.0
    n=int(sr*dur)
    frames=bytearray()
    for i in range(n):
        t=i/sr
        # sweep 660->990 with 4Hz warble
        f = 660 + 330*(0.5+0.5*math.sin(2*math.pi*2*t))
        env = 0.5 + 0.5*math.sin(2*math.pi*4*t)
        s = math.sin(2*math.pi*f*t)*env
        a=0.05; r=0.2
        if t<a: s*=t/a
        elif t>dur-r: s*=(dur-t)/r
        frames+=struct.pack("<h", int(s*0.5*32767))
    with wave.open(f"{AUD}/alarm.wav","wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes(bytes(frames))

def ringtone():
    # phone-like ring
    sr=22050
    frames=bytearray()
    pattern=[(440,0.4),(0,0.05),(480,0.4),(0,0.6)]
    for _ in range(2):
        for freq,dur in pattern:
            n=int(sr*dur)
            for i in range(n):
                t=i/sr
                if freq==0: v=0
                else:
                    s=(math.sin(2*math.pi*freq*t)+math.sin(2*math.pi*(freq+40)*t))/2
                    a=0.01;r=0.05
                    env=1
                    if t<a: env=t/a
                    elif t>dur-r: env=max(0,(dur-t)/r)
                    v=int(s*env*0.5*32767)
                frames+=struct.pack("<h", v)
    with wave.open(f"{AUD}/ringtone.wav","wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes(bytes(frames))

# Run all
splash(); wifi_setup(); home(); chat(); modes(); reminders()
music(); dial(); sms(); calllog(); sos()
settings_top(); settings_bottom(); icons()
notification(); alarm(); ringtone()

# Also emit RGB565 raw binaries for TFT_eSPI pushImage()
import struct as _s
def to_rgb565(png_path, bin_path):
    im = Image.open(png_path).convert("RGB")
    px = im.load()
    with open(bin_path,"wb") as f:
        for y in range(im.height):
            for x in range(im.width):
                r,g,b = px[x,y]
                v = ((r&0xF8)<<8) | ((g&0xFC)<<3) | (b>>3)
                f.write(_s.pack(">H", v))  # big-endian for TFT_eSPI

raw_dir = "/mnt/documents/sdcard/raw"
os.makedirs(raw_dir, exist_ok=True)
for fn in os.listdir(OUT):
    if fn.endswith(".png"):
        to_rgb565(f"{OUT}/{fn}", f"{raw_dir}/{fn.replace('.png','.bin')}")

print("OK")
print(os.listdir(OUT))
print(os.listdir(AUD))
print(os.listdir(raw_dir))
