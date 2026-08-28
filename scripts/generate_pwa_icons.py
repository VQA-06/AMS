import os
from PIL import Image, ImageColor

# Ensure public/icons directory exists
ICONS_DIR = "/home/vqa/code/cc/AMS/public/icons"
os.makedirs(ICONS_DIR, exist_ok=True)

LOGO_PATH = "/home/vqa/code/cc/AMS/public/logo.webp"

# Open original logo
with Image.open(LOGO_PATH) as img:
    img = img.convert("RGBA")

    # 1. Standard icons (any purpose)
    for size in [192, 512, 180, 64, 32]:
        resized = img.resize((size, size), Image.Resampling.LANCZOS)
        if size == 180:
            resized.save(os.path.join(ICONS_DIR, "apple-touch-icon.png"), "PNG")
        elif size in [64, 32]:
            resized.save(os.path.join(ICONS_DIR, f"favicon-{size}.png"), "PNG")
        else:
            resized.save(os.path.join(ICONS_DIR, f"icon-{size}.png"), "PNG")

    # 2. Maskable icons (with 10% safe area padding on dark background #020617)
    bg_color = (2, 6, 23, 255)  # slate-950
    for size in [192, 512]:
        maskable_canvas = Image.new("RGBA", (size, size), bg_color)
        inner_size = int(size * 0.80)  # 80% size for 10% safe zone padding
        inner_img = img.resize((inner_size, inner_size), Image.Resampling.LANCZOS)
        offset = ((size - inner_size) // 2, (size - inner_size) // 2)
        maskable_canvas.paste(inner_img, offset, inner_img)
        maskable_canvas.save(os.path.join(ICONS_DIR, f"icon-maskable-{size}.png"), "PNG")

print("PWA Icons generated successfully in public/icons!")
