#!/usr/bin/env python3
"""Draw docs/screenshots/setup-pages.png: an annotated mock of the one-time GitHub setup (no real data)."""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent.parent / "docs" / "screenshots" / "setup-pages.png"
F = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FB = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def font(size, bold=False):
    try:
        return ImageFont.truetype(FB if bold else F, size)
    except OSError:
        return ImageFont.load_default()


W, H, PW = 1500, 470, 480
ORANGE, GREEN, GREY, TEXT, LINE = (234, 88, 12), (31, 136, 61), (246, 248, 250), (31, 35, 40), (208, 215, 222)
img = Image.new("RGB", (W, H), "white")
d = ImageDraw.Draw(img)
d.text((30, 18), "Turn on your site - one time, about 1 minute", font=font(30, True), fill=TEXT)


def panel(x, n, title, sub):
    d.rounded_rectangle([x, 80, x + PW, H - 30], 14, outline=LINE, width=2, fill="white")
    d.rounded_rectangle([x, 80, x + PW, 130], 14, fill=GREY)
    d.rectangle([x, 115, x + PW, 130], fill=GREY)
    d.ellipse([x + 16, 92, x + 50, 126], fill=ORANGE)
    d.text((x + 27, 95), str(n), font=font(22, True), fill="white")
    d.text((x + 62, 88), title, font=font(19, True), fill=TEXT)
    d.text((x + 62, 110), sub, font=font(13), fill=(87, 96, 106))


def callout(box, label, y_label=None):
    x0, y0, x1, y1 = box
    d.rounded_rectangle([x0 - 6, y0 - 6, x1 + 6, y1 + 6], 10, outline=ORANGE, width=4)
    if label:
        ly = y_label if y_label is not None else y1 + 14
        d.text((x0, ly), label, font=font(15, True), fill=ORANGE)


def button(box, text, fill, color="white"):
    d.rounded_rectangle(box, 8, fill=fill)
    d.text((box[0] + 14, box[1] + 9), text, font=font(15, True), fill=color)


# 1. Settings > Pages
x = 30
panel(x, 1, "Settings > Pages", "your-repo / Settings")
for i, item in enumerate(["General", "Collaborators", "Branches", "Actions", "Pages", "Secrets"]):
    y = 150 + i * 34
    if item == "Pages":
        d.rounded_rectangle([x + 14, y - 4, x + 150, y + 24], 6, fill=(255, 237, 213))
    d.text((x + 24, y), item, font=font(15, item == "Pages"), fill=TEXT)
callout((x + 14, 150 + 4 * 34 - 4, x + 150, 150 + 4 * 34 + 24), "")
d.text((x + 175, 150), "Build and deployment", font=font(16, True), fill=TEXT)
d.text((x + 175, 185), "Source", font=font(14), fill=TEXT)
d.rounded_rectangle([x + 175, 208, x + 455, 244], 6, outline=LINE, width=2)
d.text((x + 187, 217), "GitHub Actions   v", font=font(15, True), fill=TEXT)
callout((x + 175, 208, x + 455, 244), "Choose: GitHub Actions")
d.text((x + 175, 300), "(not 'Deploy from a branch')", font=font(13), fill=(87, 96, 106))

# 2. Actions tab (forks only)
x = 30 + PW + 15
panel(x, 2, "Actions tab (forks only)", "skip this if you used 'Use this template'")
d.multiline_text((x + 24, 160), "Workflows aren't being run on\nthis forked repository", font=font(16, True), fill=TEXT, spacing=6)
d.multiline_text((x + 24, 215), "Because this repository contained\nworkflow files when it was forked...", font=font(13), fill=(87, 96, 106), spacing=4)
d.rounded_rectangle((x + 24, 270, x + 400, 330), 8, fill=GREEN)
d.multiline_text((x + 38, 278), "I understand my workflows,\ngo ahead and enable them", font=font(15, True), fill="white", spacing=4)
callout((x + 24, 270, x + 400, 330), "Click once")

# 3. Run the deploy
x = 30 + 2 * (PW + 15)
panel(x, 3, "Actions > Deploy to GitHub Pages", "then open https://<you>.github.io/<repo>/")
for i, wf in enumerate(["All workflows", "CI", "Deploy to GitHub Pages", "Refresh data (optional)"]):
    y = 150 + i * 34
    if i == 2:
        d.rounded_rectangle([x + 14, y - 4, x + 230, y + 24], 6, fill=(255, 237, 213))
    d.text((x + 24, y), wf, font=font(14, i == 2), fill=TEXT)
callout((x + 14, 150 + 68 - 4, x + 230, 150 + 68 + 24), "")
button((x + 250, 150, x + 420, 186), "Run workflow  v", (246, 248, 250), TEXT)
d.rounded_rectangle([x + 250, 150, x + 420, 186], 8, outline=LINE, width=2)
callout((x + 250, 150, x + 420, 186), "")
button((x + 250, 205, x + 420, 241), "Run workflow", GREEN)
callout((x + 250, 205, x + 420, 241), "Run, wait ~1 min")
d.ellipse([x + 24, 330, x + 44, 350], fill=GREEN)
d.text((x + 54, 330), "Deploy to GitHub Pages  -  success", font=font(14, True), fill=TEXT)
d.text((x + 24, 370), "Your site is live:", font=font(14), fill=TEXT)
d.text((x + 24, 395), "https://<you>.github.io/<repo>/", font=font(15, True), fill=ORANGE)
d.text((30, H - 24), "Illustration only - menus may look slightly different on GitHub.", font=font(12), fill=(140, 149, 159))
OUT.parent.mkdir(parents=True, exist_ok=True)
img.save(OUT, optimize=True)
print("wrote", OUT)
