#!/usr/bin/env python3
"""
Scripted download attempt against gateway.ifionline.org's ASP.NET WebForms
download page. Stdlib-only (urllib), polite (single GET + single POST per
attempt, sane UA, small delay).
"""
import re
import sys
import time
import urllib.request
import http.cookiejar

BASE = "https://gateway.ifionline.org"
PAGE = BASE + "/public/download.aspx"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) LocalTransparency-research-spike/1.0 (contact: dmcnelis@gmail.com)"

def make_opener():
    cj = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
    return opener, cj

def extract_hidden(html, name):
    m = re.search(r'id="%s"[^>]*value="([^"]*)"' % re.escape(name), html)
    if not m:
        m = re.search(r'name="%s"[^>]*value="([^"]*)"' % re.escape(name), html)
    return m.group(1) if m else None

def get_page(opener):
    req = urllib.request.Request(PAGE, headers={"User-Agent": UA, "Accept": "text/html"})
    with opener.open(req, timeout=30) as resp:
        status = resp.status
        html = resp.read().decode("utf-8", errors="replace")
    return status, html

def post_download(opener, html, file_type, tax_year, county_code):
    viewstate = extract_hidden(html, "__VIEWSTATE")
    viewstategen = extract_hidden(html, "__VIEWSTATEGENERATOR")
    eventval = extract_hidden(html, "__EVENTVALIDATION")
    tsm = extract_hidden(html, "ctl00_ContentPlaceHolder1_ScriptManager1_TSM")

    if not (viewstate and viewstategen and eventval):
        print("MISSING hidden fields:", viewstate is not None, viewstategen is not None, eventval is not None)
        return None, None

    data = {
        "ctl00_ContentPlaceHolder1_ScriptManager1_TSM": tsm or "",
        "__EVENTTARGET": "",
        "__EVENTARGUMENT": "",
        "__VIEWSTATE": viewstate,
        "__VIEWSTATEGENERATOR": viewstategen,
        "__EVENTVALIDATION": eventval,
        # AFR section controls (defaults, unused but part of same <form>)
        "ctl00$ContentPlaceHolder1$RadComboBox1": "Annual Financial Reports",
        "ctl00$ContentPlaceHolder1$RadComboBox2": "Capital Assets",
        "ctl00$ContentPlaceHolder1$DropDownListUnitType": "All",
        "ctl00$ContentPlaceHolder1$DropDownListYear": "All",
        # Property Files section controls (what we actually want)
        "ctl00$ContentPlaceHolder1$DropDownList1": file_type,   # 3=Tax Bill,4=Adjustments,5=Real Property,6=Personal Property
        "ctl00$ContentPlaceHolder1$DropDownList2": tax_year,    # e.g. 2025 (means 2025 pay 2026)
        "ctl00$ContentPlaceHolder1$DropDownList3": county_code, # 29 = Hamilton
        "ctl00$ContentPlaceHolder1$button2": "Download",        # button2 = the Property Files download button
    }
    import urllib.parse
    body = urllib.parse.urlencode(data).encode("utf-8")
    req = urllib.request.Request(
        PAGE,
        data=body,
        headers={
            "User-Agent": UA,
            "Content-Type": "application/x-www-form-urlencoded",
            "Referer": PAGE,
            "Accept": "text/html,application/xhtml+xml,*/*",
            "Origin": BASE,
        },
        method="POST",
    )
    with opener.open(req, timeout=60) as resp:
        status = resp.status
        headers = dict(resp.getheaders())
        content = resp.read()
    return status, (headers, content)

def main():
    file_type = sys.argv[1] if len(sys.argv) > 1 else "3"   # Tax Bill
    tax_year = sys.argv[2] if len(sys.argv) > 2 else "2025" # 2025 pay 2026 (most recent)
    county = sys.argv[3] if len(sys.argv) > 3 else "29"     # Hamilton

    opener, cj = make_opener()

    print("Step 1: GET", PAGE)
    status, html = get_page(opener)
    print("  status:", status, "len:", len(html))
    open("last_get.html", "w").write(html)

    time.sleep(1.5)  # be polite between GET and POST

    print("Step 2: POST download form (file_type=%s year=%s county=%s)" % (file_type, tax_year, county))
    status, result = post_download(opener, html, file_type, tax_year, county)
    if result is None:
        print("  Could not build POST (missing fields).")
        return 1
    headers, content = result
    print("  status:", status)
    for k, v in headers.items():
        if k.lower() in ("content-type", "content-disposition", "content-length", "location"):
            print("   header:", k, "=", v)

    ctype = headers.get("Content-Type", "") or headers.get("content-type", "")
    cdisp = headers.get("Content-Disposition", "") or headers.get("content-disposition", "")

    if "text/html" in ctype.lower():
        text = content.decode("utf-8", errors="replace")
        open("post_response.html", "w").write(text)
        print("  Got HTML back (likely the form re-rendered, possibly with an error). Saved to post_response.html")
        print("  First 500 chars of body text (stripped of tags, roughly):")
        stripped = re.sub(r"<[^>]+>", " ", text)
        stripped = re.sub(r"\s+", " ", stripped)
        print("   ", stripped[:1000])
    else:
        # Looks like a real file
        fname = "downloaded_file.bin"
        m = re.search(r'filename="?([^";]+)"?', cdisp)
        if m:
            fname = m.group(1)
        with open(fname, "wb") as f:
            f.write(content)
        print("  Saved binary/file response as:", fname, "size:", len(content))

    return 0

if __name__ == "__main__":
    sys.exit(main())
