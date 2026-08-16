#!/usr/bin/env python3
"""Build a Racing Kings leaderboard snapshot from lichess.thijs.com.

Thijs' Arena Rankings are published as HTML pages rather than a documented API.
The URLs below are stable ranking views. We parse only the public table rows and
write a small JSON snapshot consumed by leaderboard.html.
"""
import json, re
from datetime import datetime, timezone
from html.parser import HTMLParser
from urllib.request import Request, urlopen

BASE = "https://lichess.thijs.com/rankings/racingkings/all/"
VIEWS = {
    "points": "list_players_points.html",
    "maximum": "list_players_maximum.html",
    "events": "list_players_events.html",
    "trophies": "list_players_trophies.html",
}

class TableParser(HTMLParser):
    def __init__(self):
        super().__init__(); self.rows=[]; self.row=[]; self.cell=[]; self.in_td=False; self.in_tr=False
    def handle_starttag(self, tag, attrs):
        if tag == "tr": self.in_tr=True; self.row=[]
        elif tag in ("td","th") and self.in_tr: self.in_td=True; self.cell=[]
    def handle_endtag(self, tag):
        if tag in ("td","th") and self.in_td: self.row.append(" ".join("".join(self.cell).split())); self.in_td=False
        elif tag == "tr" and self.in_tr:
            if self.row: self.rows.append(self.row)
            self.in_tr=False
    def handle_data(self, data):
        if self.in_td: self.cell.append(data)

def fetch(url):
    req=Request(url, headers={"User-Agent":"RacingKingsTitles/1.0 leaderboard updater"})
    with urlopen(req, timeout=30) as r: return r.read().decode("utf-8", "replace")

def parse(url):
    p=TableParser(); p.feed(fetch(url)); out=[]
    for row in p.rows:
        text=[re.sub(r"\s+", " ", x).strip() for x in row]
        if len(text) < 5 or not re.match(r"^\d+\.?$", text[0]): continue
        username=None
        for value in text[1:5]:
            if re.fullmatch(r"[A-Za-z0-9_\-]{2,30}", value) and value.lower() not in {"gm","im","fm","nm","cm","wgm","wim","wfm","points","events"}:
                username=value; break
        if not username: continue
        nums=[v.replace(",", "") for v in text if re.fullmatch(r"\d+(?:\.\d+)?", v.replace(",", ""))]
        if not nums: continue
        out.append({"username":username,"cells":text,"primary":int(float(nums[-1])) if nums[-1].isdigit() else float(nums[-1])})
    return out

def main():
    data={"source":"https://lichess.thijs.com","variant":"Racing Kings","updatedAt":datetime.now(timezone.utc).isoformat(),"views":{}}
    for name, file in VIEWS.items():
        try:
            data["views"][name]=parse(BASE+file)
        except Exception as e:
            data["views"][name]=[]
            data.setdefault("errors",{})[name]=str(e)
    with open("json/thijs-leaderboards.json","w",encoding="utf-8") as f: json.dump(data,f,ensure_ascii=False,indent=2)

if __name__ == "__main__": main()
