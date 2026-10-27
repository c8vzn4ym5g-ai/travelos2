"""Final deliverable check: four pages, saved text present, and render every page."""
import json, sys, re, unicodedata
from pathlib import Path
from pypdf import PdfReader
import pypdfium2 as pdfium
from PIL import Image, ImageOps, ImageDraw

output = Path(sys.argv[1]).resolve()
records = json.loads((output / '親子記錄-作品來源證據.json').read_text(encoding='utf-8'))
normalize = lambda text: re.sub(r'\s+', '', unicodedata.normalize('NFKC', text))
results = []
for lang, stem in [('zh', '小禾的第一年-繁中四頁成長書'), ('en', 'Milo-Our-First-Year-English')]:
    path = output / (stem + '.pdf')
    reader = PdfReader(path)
    assert len(reader.pages) == 4, (lang, len(reader.pages))
    record = next(item for item in records if item['lang'] == lang)
    text = normalize(''.join(page.extract_text() for page in reader.pages))
    assert normalize(record['title']) in text, (lang, 'title missing')
    for entry in record['entries']:
        assert normalize(entry['body']) in text, (lang, 'saved story missing', entry['title'])
    doc = pdfium.PdfDocument(str(path))
    contact = Image.new('RGB', (1400, 1400), '#ded9cf')
    for i in range(4):
        page = doc[i]
        preview = page.render(scale=1.6).to_pil().convert('RGB')
        preview.save(output / f'成長書-{lang}-第{i+1}頁.png')
        thumb = ImageOps.contain(preview, (674, 674))
        x, y = (i % 2) * 700 + 13, (i // 2) * 700 + 13
        contact.paste(thumb, (x, y))
        box = reader.pages[i].mediabox
        assert abs(float(box.width)-595.276) < 1 and abs(float(box.height)-595.276) < 1
    contact.save(output / f'成長書-{lang}-四頁預覽.png')
    results.append({'language': lang, 'pages': 4, 'size': '210 x 210 mm', 'savedTitleAndAllStoryTextPresent': True, 'renderedPages': 4})
(output / '親子記錄-PDF檢查.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(results, ensure_ascii=False))
