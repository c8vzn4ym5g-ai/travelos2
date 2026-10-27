import json, sys, re, unicodedata
from pathlib import Path
from pypdf import PdfReader
import pypdfium2 as pdfium
from PIL import Image, ImageOps

out = Path(sys.argv[1]).resolve()
books = json.loads((out / '親子記錄-AI作品資料.json').read_text(encoding='utf-8-sig'))
norm = lambda s: re.sub(r'\s+', '', unicodedata.normalize('NFKC', s))
results = []
for book in books:
    lang = book['lang']
    path = out / ('AI成長書-繁中.pdf' if lang == 'zh' else 'AI成長書-English.pdf')
    reader = PdfReader(path)
    assert len(reader.pages) == 4
    text = norm(''.join(page.extract_text() for page in reader.pages))
    assert norm(book['title']) in text
    for entry in book['entries']:
        assert norm(entry['body']) in text, (lang, entry['title'])
    doc = pdfium.PdfDocument(str(path))
    contact = Image.new('RGB', (1400, 1400), '#ded9cf')
    for i in range(4):
        page = doc[i].render(scale=1.6).to_pil().convert('RGB')
        page.save(out / f'AI成長書-{lang}-第{i+1}頁.png')
        contact.paste(ImageOps.contain(page, (674, 674)), ((i % 2)*700+13, (i//2)*700+13))
    contact.save(out / f'AI成長書-{lang}-四頁預覽.png')
    results.append({'lang': lang, 'bookId': book['id'], 'pages': 4, 'savedStoryTextMatches': True, 'allPagesRendered': True})
(out / '親子記錄-AI成書檢查.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(results, ensure_ascii=False))
