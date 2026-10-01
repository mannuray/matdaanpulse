#!/usr/bin/env python3
"""
Scrape party logos from Wikipedia infoboxes and ECI election symbols
from Wikimedia Commons. Downloads SVG/PNG and generates SQL.

Usage:
    python3 scraper/src/scrape-party-symbols.py                # scrape all missing
    python3 scraper/src/scrape-party-symbols.py --missing-only  # skip already-downloaded files
    python3 scraper/src/scrape-party-symbols.py --eci-only      # only scrape ECI symbols

Output:
    - frontend/public/symbols/logos/{ID}.{svg,png,jpg}
    - frontend/public/symbols/eci/{ID}.{svg,png,jpg}
    - database/seed_party_symbols.sql
"""

import hashlib
import json
import re
import subprocess
import sys
import time
import urllib.parse
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

MISSING_ONLY = "--missing-only" in sys.argv
ECI_ONLY = "--eci-only" in sys.argv

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
LOGOS_DIR = REPO_ROOT / "frontend" / "public" / "symbols" / "logos"
ECI_DIR = REPO_ROOT / "frontend" / "public" / "symbols" / "eci"
SQL_OUT = REPO_ROOT / "database" / "seed_party_symbols.sql"

DELAY = 2  # seconds between requests

# ── Known Wikipedia slugs for parties that don't auto-resolve ────────
KNOWN_SLUGS: dict[str, str] = {
    "AAP": "Aam_Aadmi_Party",
    "AIADMK": "All_India_Anna_Dravida_Munnetra_Kazhagam",
    "AIMIM": "All_India_Majlis-e-Ittehadul_Muslimeen",
    "TMC": "All_India_Trinamool_Congress",
    "AIUDF": "All_India_United_Democratic_Front",
    "ADSL": "Apna_Dal_(Soneylal)",
    "AGP": "Asom_Gana_Parishad",
    "BSP": "Bahujan_Samaj_Party",
    "BRS": "Bharat_Rashtra_Samithi",
    "BJP": "Bharatiya_Janata_Party",
    "BJD": "Biju_Janata_Dal",
    "CPI": "Communist_Party_of_India",
    "CPIM": "Communist_Party_of_India_(Marxist)",
    "CPOI": "Communist_Party_of_India_(Marxist%E2%80%93Leninist)_Liberation",
    "DMDK": "Desiya_Murpokku_Dravida_Kazhagam",
    "DMK": "Dravida_Munnetra_Kazhagam",
    "HAM": "Hindustani_Awam_Morcha_(Secular)",
    "INC": "Indian_National_Congress",
    "IUML": "Indian_Union_Muslim_League",
    "INLD": "Indian_National_Lok_Dal",
    "JKNC": "Jammu_%26_Kashmir_National_Conference",
    "JKPDP": "Jammu_and_Kashmir_Peoples_Democratic_Party",
    "JDS": "Janata_Dal_(Secular)",
    "JDU": "Janata_Dal_(United)",
    "JP": "Jana_Sena_Party",
    "JMM": "Jharkhand_Mukti_Morcha",
    "KEC": "Kerala_Congress",
    "KCM": "Kerala_Congress_(M)",
    "LJPRV": "Lok_Janshakti_Party_(Ram_Vilas)",
    "MDMK": "Marumalarchi_Dravida_Munnetra_Kazhagam",
    "NCP": "Nationalist_Congress_Party",
    "NCPSP": "Nationalist_Congress_Party_(Sharadchandra_Pawar)",
    "NDPP": "Nationalist_Democratic_Progressive_Party",
    "NPF": "Naga_Peoples_Front",
    "NPP": "National_People%27s_Party_(India)",
    "NTK": "Naam_Tamilar_Katchi",
    "PMK": "Pattali_Makkal_Katchi",
    "RJD": "Rashtriya_Janata_Dal",
    "RLD": "Rashtriya_Lok_Dal",
    "RLTP": "Rashtriya_Loktantrik_Party",
    "RSP": "Revolutionary_Socialist_Party_(India)",
    "SP": "Samajwadi_Party",
    "SAD": "Shiromani_Akali_Dal",
    "SHS": "Shiv_Sena",
    "SHSUBT": "Shiv_Sena_(Uddhav_Balasaheb_Thackeray)",
    "SKM": "Sikkim_Krantikari_Morcha",
    "SDF": "Sikkim_Democratic_Front",
    "SBSP": "Suheldev_Bharatiya_Samaj_Party",
    "TDP": "Telugu_Desam_Party",
    "VCK": "Viduthalai_Chiruthaigal_Katchi",
    "VPP": "Voice_of_the_People_Party",
    "YSRCP": "YSR_Congress_Party",
    "VBA": "Vanchit_Bahujan_Aaghadi",
    "BVA": "Bahujan_Vikas_Aaghadi",
    "DPAP": "Democratic_Progressive_Azad_Party",
    "MNF": "Mizo_National_Front",
    "ZPM1": "Zoram_People%27s_Movement",
    "AMMK": "Amma_Makkal_Munnettra_Kazagam",
}

# ECI election symbol search terms for major parties
ECI_SYMBOL_SEARCH: dict[str, str] = {
    "BJP": "Indian_Election_Symbol_Lotus",
    "INC": "Indian_Election_Symbol_Hand",
    "AAP": "Election_symbol_of_Aam_Aadmi_Party",
    "BSP": "Indian_Election_Symbol_Elephant",
    "SP": "Election_symbol_bicycle",
    "TMC": "Election_symbol_of_All_India_Trinamool_Congress",
    "DMK": "Election_Symbol_Rising_Sun",
    "AIADMK": "Election_Symbol_Two_Leaves",
    "CPI": "Election_Symbol_Ears_of_corn_and_sickle",
    "CPIM": "Election_Symbol_Hammer,_Sickle_and_Star",
    "JDU": "Election_symbol_of_Janata_Dal_(United)",
    "RJD": "Election_symbol_of_Rashtriya_Janata_Dal",
    "BJD": "Election_symbol_of_Biju_Janata_Dal",
    "SHS": "Election_symbol_of_Shiv_Sena",
    "NCP": "Election_symbol_of_NCP",
    "SAD": "Election_symbol_of_Shiromani_Akali_Dal",
    "TDP": "Election_symbol_of_Telugu_Desam_Party",
    "JMM": "Election_symbol_of_Jharkhand_Mukti_Morcha",
    "YSRCP": "Election_symbol_of_YSR_Congress_Party",
}

# Skip these IDs — no meaningful logo
SKIP_IDS = {"NOTA", "IND"}


def get_all_parties_from_db() -> list[dict]:
    """Query the DB for all parties (id, name)."""
    cmd = [
        "docker", "exec", "election_tracker_db",
        "psql", "-U", "admin", "-d", "election_tracker",
        "-t", "-A", "-c",
        "SELECT json_agg(json_build_object('id', id, 'name', name)) FROM parties WHERE id NOT IN ('NOTA','IND');",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"DB query failed: {result.stderr}")
        return []
    raw = result.stdout.strip()
    if not raw:
        return []
    return json.loads(raw)


def has_existing_file(directory: Path, party_id: str) -> str | None:
    """Check if a file exists for this party (any format). Returns web path or None."""
    for ext in ("svg", "png", "jpg", "jpeg"):
        p = directory / f"{party_id}.{ext}"
        if p.exists():
            rel = p.relative_to(REPO_ROOT / "frontend" / "public")
            return f"/{rel}"
    return None


def download_file(page, url: str, dest: Path, expect_svg: bool = False) -> bool:
    """Download a file. If expect_svg, validates SVG content."""
    try:
        resp = page.request.get(url)
        if resp.status != 200:
            print(f"    HTTP {resp.status} for {url}")
            return False
        body = resp.body()
        if expect_svg:
            text = body[:500].decode("utf-8", errors="replace")
            if "<svg" not in text.lower():
                print(f"    Not SVG content: {url[:80]}")
                return False
        dest.write_bytes(body)
        print(f"    Saved → {dest.relative_to(REPO_ROOT)}")
        return True
    except Exception as e:
        print(f"    Download error: {e}")
        return False


def commons_file_url(filename: str) -> str:
    """Build the direct Wikimedia Commons URL for a file."""
    name = filename.replace(" ", "_")
    md5 = hashlib.md5(name.encode("utf-8")).hexdigest()
    return f"https://upload.wikimedia.org/wikipedia/commons/{md5[0]}/{md5[:2]}/{urllib.parse.quote(name)}"


def extract_infobox_image(page) -> tuple[str | None, str]:
    """Find the first image in a Wikipedia infobox. Returns (filename, format).
    Prefers SVG, falls back to PNG/JPG."""
    # First pass: SVG
    svg_selectors = [
        ".infobox a[href*='File:'][href$='.svg']",
        ".infobox a.mw-file-description[href*='.svg']",
        ".infobox img[src*='.svg']",
        ".infobox-image a[href*='File:']",
    ]
    for sel in svg_selectors:
        for el in page.query_selector_all(sel):
            href = el.get_attribute("href") or ""
            src = el.get_attribute("src") or ""
            if href and ".svg" in href.lower():
                m = re.search(r"File:(.+\.svg)", href, re.IGNORECASE)
                if m:
                    return urllib.parse.unquote(m.group(1)), "svg"
            if src and ".svg" in src.lower():
                m = re.search(r"/commons/(?:thumb/)?[0-9a-f]/[0-9a-f]{2}/(.+\.svg)", src, re.IGNORECASE)
                if m:
                    return urllib.parse.unquote(m.group(1)), "svg"

    # Second pass: PNG/JPG
    img_selectors = [
        ".infobox a.mw-file-description img",
        ".infobox-image img",
        ".infobox img",
    ]
    for sel in img_selectors:
        for el in page.query_selector_all(sel):
            src = el.get_attribute("src") or ""
            if not src:
                continue
            width = el.get_attribute("width")
            if width and width.isdigit() and int(width) < 50:
                continue
            for pattern in [
                r"/commons/thumb/[0-9a-f]/[0-9a-f]{2}/(.+\.(?:png|jpg|jpeg))/",
                r"/en/thumb/[0-9a-f]/[0-9a-f]{2}/(.+\.(?:png|jpg|jpeg))/",
                r"/commons/[0-9a-f]/[0-9a-f]{2}/(.+\.(?:png|jpg|jpeg))",
                r"/en/[0-9a-f]/[0-9a-f]{2}/(.+\.(?:png|jpg|jpeg))",
            ]:
                m = re.search(pattern, src, re.IGNORECASE)
                if m:
                    fname = urllib.parse.unquote(m.group(1))
                    ext = fname.rsplit(".", 1)[-1].lower()
                    return fname, ext
    return None, ""


def search_wikipedia_page(page, party_name: str) -> str | None:
    """Search Wikipedia for a party and navigate to the first result.
    Returns the final URL if a page was found, None otherwise."""
    search_url = f"https://en.wikipedia.org/w/index.php?search={urllib.parse.quote(party_name + ' political party India')}&title=Special:Search&ns0=1"
    try:
        page.goto(search_url, timeout=15000)
        page.wait_for_timeout(1000)
        # If we landed on an article (redirected from search), great
        if "/wiki/" in page.url and "Special:" not in page.url:
            return page.url
        # Otherwise pick the first search result
        first = page.query_selector(".mw-search-result-heading a")
        if first:
            href = first.get_attribute("href")
            if href:
                full = f"https://en.wikipedia.org{href}"
                page.goto(full, timeout=15000)
                page.wait_for_timeout(500)
                return page.url
    except PlaywrightTimeout:
        print("    Search timeout")
    except Exception as e:
        print(f"    Search error: {e}")
    return None


def scrape_logo_for_party(page, party_id: str, party_name: str, results: dict) -> None:
    """Try to scrape a logo for a party. Updates results dict."""
    logo_path = None

    # Determine Wikipedia URL
    slug = KNOWN_SLUGS.get(party_id)
    if slug:
        wiki_url = f"https://en.wikipedia.org/wiki/{slug}"
        print(f"\n[{party_id}] Wikipedia: {slug}")
    else:
        print(f"\n[{party_id}] Searching: {party_name}")
        wiki_url = None

    try:
        if slug:
            page.goto(wiki_url, timeout=15000)
            page.wait_for_timeout(1000)
        else:
            found = search_wikipedia_page(page, party_name)
            if not found:
                print("    No Wikipedia page found")
                results[party_id] = {"logo_path": None, "eci_path": None}
                return

        # Now we're on a Wikipedia article — extract image
        filename, fmt = extract_infobox_image(page)
        if filename:
            url = commons_file_url(filename)
            dest = LOGOS_DIR / f"{party_id}.{fmt}"
            is_svg = fmt == "svg"
            if download_file(page, url, dest, expect_svg=is_svg):
                logo_path = f"/symbols/logos/{party_id}.{fmt}"
            else:
                alt_url = url.replace("/wikipedia/commons/", "/wikipedia/en/")
                if download_file(page, alt_url, dest, expect_svg=is_svg):
                    logo_path = f"/symbols/logos/{party_id}.{fmt}"
        else:
            print("    No image found in infobox")

    except PlaywrightTimeout:
        print("    Timeout")
    except Exception as e:
        print(f"    Error: {e}")

    results[party_id] = {"logo_path": logo_path, "eci_path": None}


def search_commons_image(page, search_term: str) -> tuple[str | None, str]:
    """Search Wikimedia Commons for an image. Prefers SVG, falls back to PNG/JPG."""
    url = f"https://commons.wikimedia.org/w/index.php?search={urllib.parse.quote(search_term)}&title=Special:MediaSearch&go=Go&type=image"
    try:
        page.goto(url, timeout=15000)
        page.wait_for_timeout(1000)
        links = page.query_selector_all("a[href*='File:']")
        # SVG first
        for link in links:
            href = link.get_attribute("href") or ""
            if ".svg" in href.lower():
                m = re.search(r"File:(.+\.svg)", href, re.IGNORECASE)
                if m:
                    return urllib.parse.unquote(m.group(1)), "svg"
        # PNG/JPG fallback
        for link in links:
            href = link.get_attribute("href") or ""
            m = re.search(r"File:(.+\.(?:png|jpg|jpeg))", href, re.IGNORECASE)
            if m:
                fname = urllib.parse.unquote(m.group(1))
                ext = fname.rsplit(".", 1)[-1].lower()
                return fname, ext
    except Exception as e:
        print(f"    Commons search error: {e}")
    return None, ""


def main():
    LOGOS_DIR.mkdir(parents=True, exist_ok=True)
    ECI_DIR.mkdir(parents=True, exist_ok=True)

    # Get all parties from DB
    print("Fetching parties from database...")
    all_parties = get_all_parties_from_db()
    if not all_parties:
        print("No parties found in DB!")
        return
    print(f"Found {len(all_parties)} parties\n")

    results: dict[str, dict[str, str | None]] = {}

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) MatdaanPulse/1.0"
        )
        page = context.new_page()

        # ── Phase 1: Logos from Wikipedia ────────────────────────────────
        if not ECI_ONLY:
            print("=" * 60)
            print(f"Phase 1: Scraping logos from Wikipedia ({len(all_parties)} parties)")
            print("=" * 60)

            scraped = 0
            skipped = 0
            for party in all_parties:
                pid = party["id"]
                name = party["name"]

                existing = has_existing_file(LOGOS_DIR, pid)
                if MISSING_ONLY and existing:
                    results[pid] = {"logo_path": existing, "eci_path": None}
                    skipped += 1
                    continue

                scrape_logo_for_party(page, pid, name, results)
                scraped += 1
                time.sleep(DELAY)

            print(f"\n  Scraped: {scraped} | Skipped: {skipped}")
        else:
            # Still populate results from existing files
            for party in all_parties:
                pid = party["id"]
                existing = has_existing_file(LOGOS_DIR, pid)
                results[pid] = {"logo_path": existing, "eci_path": None}

        # ── Phase 2: ECI election symbols from Commons ──────────────────
        print("\n" + "=" * 60)
        print("Phase 2: Scraping ECI election symbols from Wikimedia Commons")
        print("=" * 60)

        for party_id, search_term in ECI_SYMBOL_SEARCH.items():
            existing_eci = has_existing_file(ECI_DIR, party_id)
            if MISSING_ONLY and existing_eci:
                if party_id not in results:
                    results[party_id] = {"logo_path": None, "eci_path": existing_eci}
                else:
                    results[party_id]["eci_path"] = existing_eci
                print(f"\n[{party_id}] SKIP (ECI exists)")
                continue

            print(f"\n[{party_id}] Commons: {search_term}")
            eci_path = None

            try:
                filename, fmt = search_commons_image(page, search_term)
                if filename:
                    url = commons_file_url(filename)
                    dest = ECI_DIR / f"{party_id}.{fmt}"
                    if download_file(page, url, dest, expect_svg=(fmt == "svg")):
                        eci_path = f"/symbols/eci/{party_id}.{fmt}"
                else:
                    print("    No image found on Commons")
            except Exception as e:
                print(f"    Error: {e}")

            if party_id not in results:
                results[party_id] = {"logo_path": None, "eci_path": eci_path}
            else:
                results[party_id]["eci_path"] = eci_path
            time.sleep(DELAY)

        browser.close()

    # ── Phase 3: Generate SQL ───────────────────────────────────────────
    print("\n" + "=" * 60)
    print("Phase 3: Generating SQL")
    print("=" * 60)

    lines = [
        "-- Auto-generated by scrape-party-symbols.py",
        "-- Updates party symbol_url and eci_symbol_url columns",
        "",
    ]

    logo_count = 0
    eci_count = 0

    for party_id, paths in sorted(results.items()):
        logo = paths.get("logo_path")
        eci = paths.get("eci_path")
        if not logo and not eci:
            continue

        sets = []
        if logo:
            sets.append(f"symbol_url = '{logo}'")
            logo_count += 1
        if eci:
            sets.append(f"eci_symbol_url = '{eci}'")
            eci_count += 1

        # Escape single quotes in party_id (unlikely but safe)
        safe_id = party_id.replace("'", "''")
        lines.append(f"UPDATE parties SET {', '.join(sets)} WHERE id = '{safe_id}';")

    SQL_OUT.write_text("\n".join(lines) + "\n")
    print(f"\nWrote {SQL_OUT.relative_to(REPO_ROOT)}")
    print(f"  Logos: {logo_count}  |  ECI symbols: {eci_count}")
    total = len([p for p in results.values() if p.get("logo_path") or p.get("eci_path")])
    print(f"  Total parties with at least one symbol: {total}/{len(all_parties)}")


if __name__ == "__main__":
    main()
