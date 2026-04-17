import fitz
import json

doc = fitz.open('(4주기기관인증)대학경쟁력지표_대학일반_수정.pdf')
pages_data = []

for page_num in range(len(doc)):
    page = doc.load_page(page_num)
    text = page.get_text("blocks")
    # sort blocks vertically then horizontally
    text.sort(key=lambda b: (b[1], b[0]))
    
    blocks = []
    for b in text:
        content = b[4].strip()
        if content:
            blocks.append(content)
            
    pages_data.append({
        'page': page_num + 1,
        'blocks': blocks
    })

with open('pdf_layout.json', 'w', encoding='utf-8') as f:
    json.dump(pages_data, f, ensure_ascii=False, indent=2)

print(f"Extracted {len(doc)} pages.")
