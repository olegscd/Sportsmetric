"""
Builds an Interactive Digital Book Viewer (HTML) and a Printable PDF
for UAAP Annual Reports.

Usage:
    python scripts/build_book_pdf_and_viewer.py --season 2003-2004
"""

import argparse
import os
import re
import subprocess
import sys
from pathlib import Path
import markdown

HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>UAAP Season {season} — Annual Report (Digital Book)</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;800&family=Lora:ital,wght@0,400;0,600;1,400&family=Inter:wght@400;500;600;700&display=swap');

    :root {{
      --bg: #0f172a;
      --card-bg: #ffffff;
      --text: #1e293b;
      --primary: #1e3a8a;
      --accent: #d97706;
      --border: #cbd5e1;
    }}

    * {{
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }}

    body {{
      font-family: 'Lora', Georgia, serif;
      background: #1e293b;
      color: #334155;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }}

    /* Top Navigation Toolbar */
    .toolbar {{
      position: sticky;
      top: 0;
      z-index: 100;
      background: #0f172a;
      color: #f8fafc;
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid #334155;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      font-family: 'Inter', sans-serif;
    }}

    .toolbar-title {{
      font-family: 'Cinzel', serif;
      font-size: 1.15rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      color: #f59e0b;
      display: flex;
      align-items: center;
      gap: 10px;
    }}

    .toolbar-controls {{
      display: flex;
      align-items: center;
      gap: 16px;
    }}

    .search-box {{
      background: #1e293b;
      border: 1px solid #475569;
      color: #f8fafc;
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 0.85rem;
      width: 220px;
      outline: none;
    }}
    .search-box:focus {{
      border-color: #f59e0b;
    }}

    .btn {{
      background: #3b82f6;
      color: white;
      border: none;
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: background 0.15s ease;
    }}
    .btn:hover {{
      background: #2563eb;
    }}
    .btn-gold {{
      background: #d97706;
    }}
    .btn-gold:hover {{
      background: #b45309;
    }}

    /* Layout Container */
    .app-container {{
      display: flex;
      flex: 1;
      height: calc(100vh - 58px);
      overflow: hidden;
    }}

    /* Sidebar Table of Contents */
    .sidebar {{
      width: 320px;
      background: #0f172a;
      border-right: 1px solid #334155;
      overflow-y: auto;
      padding: 16px;
      font-family: 'Inter', sans-serif;
      flex-shrink: 0;
    }}

    .sidebar-section-title {{
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #94a3b8;
      margin: 16px 0 8px 8px;
    }}

    .nav-item {{
      display: block;
      padding: 8px 12px;
      color: #cbd5e1;
      text-decoration: none;
      font-size: 0.85rem;
      border-radius: 6px;
      margin-bottom: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      transition: all 0.15s ease;
    }}
    .nav-item:hover {{
      background: #1e293b;
      color: #f8fafc;
      padding-left: 16px;
    }}
    .nav-item.sport-header {{
      font-weight: 700;
      color: #fbbf24;
      background: rgba(245, 158, 11, 0.1);
      margin-top: 8px;
    }}

    /* Main Document Reader */
    .document-viewport {{
      flex: 1;
      overflow-y: auto;
      padding: 40px 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 32px;
      background: #334155;
    }}

    /* Book Page Simulation */
    .book-page {{
      width: 100%;
      max-width: 820px;
      min-height: 1100px;
      background: #ffffff;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
      padding: 60px 70px;
      border-radius: 4px;
      position: relative;
      color: #1e293b;
      line-height: 1.6;
    }}

    .page-header {{
      display: flex;
      justify-content: space-between;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 8px;
      margin-bottom: 28px;
      font-family: 'Inter', sans-serif;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #64748b;
    }}

    .page-footer {{
      position: absolute;
      bottom: 24px;
      left: 70px;
      right: 70px;
      display: flex;
      justify-content: space-between;
      border-top: 1px solid #f1f5f9;
      padding-top: 10px;
      font-family: 'Inter', sans-serif;
      font-size: 0.75rem;
      color: #94a3b8;
    }}

    /* Content Typography inside pages */
    .book-page h1 {{
      font-family: 'Cinzel', serif;
      font-size: 1.65rem;
      text-align: center;
      color: #0f172a;
      margin: 20px 0 16px;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 12px;
      line-height: 1.3;
    }}

    .book-page h2 {{
      font-family: 'Cinzel', serif;
      font-size: 1.3rem;
      color: #1e3a8a;
      margin: 18px 0 12px;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 6px;
    }}

    .book-page h3 {{
      font-family: 'Inter', sans-serif;
      font-size: 1.1rem;
      font-weight: 700;
      color: #334155;
      margin: 14px 0 8px;
    }}

    .book-page h4 {{
      font-family: 'Inter', sans-serif;
      font-size: 0.95rem;
      font-weight: 600;
      color: #475569;
      margin: 12px 0 6px;
    }}

    .book-page p {{
      margin-bottom: 12px;
      font-size: 0.95rem;
    }}

    .book-page blockquote {{
      border-left: 4px solid #d97706;
      background: #fef3c7;
      padding: 12px 18px;
      margin: 16px 0;
      font-style: italic;
      color: #78350f;
      border-radius: 0 6px 6px 0;
    }}

    .book-page ul, .book-page ol {{
      margin: 12px 0 16px 24px;
      font-size: 0.95rem;
    }}

    .book-page li {{
      margin-bottom: 6px;
    }}

    /* Tables */
    .book-page table {{
      width: 100%;
      border-collapse: collapse;
      margin: 18px 0;
      font-family: 'Inter', sans-serif;
      font-size: 0.82rem;
    }}

    .book-page th, .book-page td {{
      border: 1px solid #cbd5e1;
      padding: 8px 10px;
      text-align: left;
    }}

    .book-page th {{
      background: #f1f5f9;
      font-weight: 700;
      color: #0f172a;
      text-transform: uppercase;
      font-size: 0.75rem;
      letter-spacing: 0.05em;
    }}

    .book-page tr:nth-child(even) {{
      background: #f8fafc;
    }}

    .book-page strong {{
      font-weight: 700;
      color: #0f172a;
    }}

    /* Print / PDF Stylesheet */
    @media print {{
      body {{
        background: white;
        color: black;
      }}
      .toolbar, .sidebar {{
        display: none !important;
      }}
      .app-container {{
        height: auto;
        display: block;
      }}
      .document-viewport {{
        padding: 0;
        background: white;
        display: block;
      }}
      .book-page {{
        width: 100% !important;
        max-width: 100% !important;
        min-height: auto !important;
        box-shadow: none !important;
        border-radius: 0 !important;
        padding: 40px 50px 50px !important;
        page-break-after: always;
        break-after: page;
      }}
      .page-footer {{
        position: static;
        margin-top: 30px;
      }}
    }}
  </style>
</head>
<body>

  <!-- Top Toolbar -->
  <header class="toolbar">
    <div class="toolbar-title">
      <span>🏛️</span>
      <span>UAAP Season {season} — Annual Report</span>
    </div>
    <div class="toolbar-controls">
      <input type="text" id="searchInput" class="search-box" placeholder="Search athletes, scores, sports...">
      <button class="btn btn-gold" onclick="window.print()">🖨️ Print / Save PDF</button>
      <a href="UAAP_{season_clean}_Annual_Report.pdf" class="btn" download>📥 Download PDF</a>
    </div>
  </header>

  <div class="app-container">
    <!-- Sidebar Navigation -->
    <nav class="sidebar">
      <div class="sidebar-section-title">Table of Contents ({total_pages} Pages)</div>
      {sidebar_nav}
    </nav>

    <!-- Main Pages Scroll -->
    <main class="document-viewport" id="viewport">
      {pages_html}
    </main>
  </div>

  <script>
    // Search filtering across all 201 pages
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', function() {{
      const query = this.value.toLowerCase().trim();
      const pages = document.querySelectorAll('.book-page');
      let firstMatch = null;

      pages.forEach(page => {{
        if (!query) {{
          page.style.display = 'block';
          return;
        }}
        const text = page.innerText.toLowerCase();
        if (text.includes(query)) {{
          page.style.display = 'block';
          if (!firstMatch) firstMatch = page;
        }} else {{
          page.style.display = 'none';
        }}
      }});

      if (firstMatch && query) {{
        firstMatch.scrollIntoView({{ behavior: 'smooth', block: 'start' }});
      }}
    }});
  </script>
</body>
</html>
"""

def generate_html_and_pdf(season_name: str):
    base_dir = Path(__file__).resolve().parent.parent / "data" / "seasons" / season_name
    pages_dir = base_dir / "digital_pages"
    output_html = base_dir / "UAAP_2003_2004_Annual_Report.html"
    output_pdf = base_dir / "UAAP_2003_2004_Annual_Report.pdf"

    md_files = sorted(pages_dir.glob("*.md"))
    if not md_files:
        print(f"[!] No markdown pages found in {pages_dir}")
        return

    print(f"\nFound {len(md_files)} pages to assemble...")

    md_parser = markdown.Markdown(extensions=["tables", "fenced_code", "nl2br"])

    sidebar_items = []
    rendered_pages = []

    sports_keywords = [
        "BADMINTON", "JUDO", "VOLLEYBALL", "TABLE TENNIS", "TAE KWON DO",
        "BASEBALL", "SOFTBALL", "CHESS", "FENCING", "SWIMMING", "TRACK", "BASKETBALL"
    ]

    for idx, page_file in enumerate(md_files, start=1):
        raw_md = page_file.read_text(encoding="utf-8")
        html_content = md_parser.convert(raw_md)
        md_parser.reset()

        # Try to detect a title for the table of contents
        detected_sport = None
        for kw in sports_keywords:
            if kw in raw_md.upper():
                detected_sport = kw.title()
                break

        first_line_match = re.search(r"#+\s*(.+)", raw_md)
        title_summary = first_line_match.group(1).strip() if first_line_match else page_file.stem
        # Clean title length
        if len(title_summary) > 40:
            title_summary = title_summary[:38] + "..."

        is_cover = "TOURNAMENT" in raw_md.upper() and len(raw_md) < 500

        nav_class = "nav-item sport-header" if is_cover else "nav-item"
        nav_label = f"P.{idx:03d} • {detected_sport or title_summary}"
        sidebar_items.append(
            f'<a href="#page-{idx}" class="{nav_class}" title="{page_file.stem}">{nav_label}</a>'
        )

        page_html = f"""
        <article class="book-page" id="page-{idx}">
          <div class="page-header">
            <span>UAAP Season {season_name} Annual Report</span>
            <span>Source: {page_file.stem}</span>
          </div>

          {html_content}

          <div class="page-footer">
            <span>University Athletic Association of the Philippines</span>
            <span>Page {idx} of {len(md_files)}</span>
          </div>
        </article>
        """
        rendered_pages.append(page_html)

    season_clean = season_name.replace("-", "_")
    final_html = HTML_TEMPLATE.format(
        season=season_name,
        season_clean=season_clean,
        total_pages=len(md_files),
        sidebar_nav="\n".join(sidebar_items),
        pages_html="\n".join(rendered_pages)
    )

    output_html.write_text(final_html, encoding="utf-8")
    print(f"-> Interactive Viewer generated: {output_html.resolve()}")

    # Render PDF using Playwright + Edge
    print("Generating PDF from HTML via Playwright + Edge...")
    node_script = f"""
    import {{ chromium }} from '@playwright/test';
    (async () => {{
      const browser = await chromium.launch({{ channel: 'msedge' }});
      const page = await browser.newPage();
      await page.goto('file:///{output_html.resolve().as_posix()}', {{ waitUntil: 'networkidle' }});
      await page.pdf({{
        path: '{output_pdf.resolve().as_posix()}',
        format: 'A4',
        printBackground: true,
        margin: {{ top: '0px', right: '0px', bottom: '0px', left: '0px' }}
      }});
      await browser.close();
      console.log('PDF_GENERATED');
    }})();
    """

    try:
        res = subprocess.run(["node", "-e", node_script], capture_output=True, text=True, check=True)
        if "PDF_GENERATED" in res.stdout:
            print(f"-> PDF Successfully Created: {output_pdf.resolve()} ({output_pdf.stat().st_size // 1024} KB)")
    except Exception as e:
        print(f"[!] Headless PDF generation notice: {e}")
        print(f"You can also open {output_html.name} in any browser and click 'Print / Save PDF'!")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--season", default="2003-2004")
    args = parser.parse_args()
    generate_html_and_pdf(args.season)
