"""Generate the static sharing card from the existing blue/mint brand mark."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[1]
scale = 2
image = Image.new('RGB', (1200 * scale, 630 * scale), '#f5f7fb')
draw = ImageDraw.Draw(image)

def text(x, y, value, size, color, bold=False):
    font = ImageFont.truetype('C:/Windows/Fonts/malgunbd.ttf' if bold else 'C:/Windows/Fonts/malgun.ttf', size * scale)
    draw.text((x * scale, y * scale), value, font=font, fill=color)

# Match public/icon.svg, including the overlapping rounded links.
unit = 4
logo = Image.new('RGBA', (108 * unit, 108 * unit))
mark = ImageDraw.Draw(logo)
for x, color in [(27, '#2878F5'), (46, '#22BCAB')]:
    mark.rounded_rectangle((x*unit, 38*unit, (x+35)*unit, 70*unit), radius=16*unit, outline=color, width=10*unit)
mark.arc((30*unit, 38*unit, 62*unit, 70*unit), 270, 360, fill='#2878F5', width=10*unit)
logo = logo.rotate(42, resample=Image.Resampling.BICUBIC).resize((216*scale, 216*scale), Image.Resampling.LANCZOS)
draw.rounded_rectangle((832*scale, 160*scale, 1100*scale, 428*scale), radius=64*scale, fill='white')
image.paste(logo, (858*scale, 186*scale), logo)
text(88, 65, '옮김', 40, '#245bea', True)
text(88, 189, '옮기기 전,', 64, '#172337', True)
text(88, 276, '혜택부터 비교하세요.', 57, '#172337', True)
text(88, 389, '중개형 ISA · 연금저축 · IRP', 28, '#53627a')
text(88, 505, '증권사 10곳의 이전 혜택과 조건을 한눈에', 27, '#53627a')
image.resize((1200, 630), Image.Resampling.LANCZOS).save(root / 'public/share-v1.png', optimize=True)
