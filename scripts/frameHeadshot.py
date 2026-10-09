"""Frames a headshot like Boris's portrait: face about a third of the width, centred,
background extended by blurred edge pixels. Writes the photo and a head-and-shoulders mask."""
import sys, numpy as np
from PIL import Image, ImageDraw, ImageFilter
src_path, out_photo, out_mask, top = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
src = Image.open(src_path).convert('RGB')
m = Image.new('L', src.size, 0); d = ImageDraw.Draw(m)
d.ellipse((140, 80, 540, 600), fill=255)
d.polygon([(30, 948), (30, 530), (120, 470), (190, 440), (480, 470), (560, 500), (630, 600), (630, 948)], fill=255)
m = m.filter(ImageFilter.GaussianBlur(4))
side = 980; x0 = (side - 657) // 2
pad = ((top, max(0, side - top - 948)), (x0, side - x0 - 657))
img = np.pad(np.asarray(src), pad + ((0, 0),), mode='edge')[:side, :side]
msk = np.zeros((side, side), np.uint8)
h = min(948, side - top); msk[top:top + h, x0:x0 + 657] = np.asarray(m)[:h]
im = Image.fromarray(img); blur = im.filter(ImageFilter.GaussianBlur(18))
inside = Image.new('L', (side, side), 0); ImageDraw.Draw(inside).rectangle((x0, top, x0 + 656, side), fill=255)
im = Image.composite(im, blur, inside.filter(ImageFilter.GaussianBlur(10)))
im.resize((1200, 1200), Image.LANCZOS).save(out_photo)
Image.fromarray(msk).filter(ImageFilter.GaussianBlur(3)).resize((1200, 1200), Image.LANCZOS).save(out_mask)
