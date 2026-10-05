"""
English names for the map's bus routes, bus stops and railway stations
(src/i18n/transport.en.json). The operators' GTFS feeds and MLIT's railway data
only publish Japanese, so:

- bus route names are translated by hand (ROUTES);
- stop and station names use Fukui's own readings for local place names (PLACES),
  translate common words (WORDS: 駅 → Station, 病院 → Hospital, ...) and
  romanise the rest (Hepburn, long vowels written plainly: Tojinbo, not Toujinbou).

The map shows the Japanese under the English, so a reading the romaniser gets
wrong is still clear. Re-run after the transport data gains new stops:

    pip install pykakasi
    python scripts/build_transport_en.py <transport_map.json> <transport_trips.json> [transport.json]
"""

import json
import re
import sys

import pykakasi

ROUTES = {
    "越前海岸ブルーライン": "Echizen Coast Blue Line",
    "大安寺線": "Daianji Line",
    "学園線": "Gakuen Line",
    "桜ヶ丘団地線": "Sakuragaoka Estate Line",
    "川西三国線": "Kawanishi–Mikuni Line",
    "幾久・新田塚線（幾久先回り）": "Ikuhisa–Nittazuka Line (Ikuhisa first)",
    "幾久・新田塚線（福井大学前先回り）": "Ikuhisa–Nittazuka Line (Fukui University first)",
    "エンゼルランド線": "Angel Land Line",
    "福井総合病院線": "Fukui General Hospital Line",
    "運転者教育センター線": "Driver Education Center Line",
    "高木線": "Takagi Line",
    "丸岡線（田原町経由）": "Maruoka Line (via Tawaramachi)",
    "丸岡線（町屋町経由）": "Maruoka Line (via Machiya)",
    "県立病院丸岡線": "Prefectural Hospital–Maruoka Line",
    "大和田大学病院線": "Owada–University Hospital Line",
    "大和田丸岡線": "Owada–Maruoka Line",
    "済生会問屋団地線": "Saiseikai–Wholesale District Line",
    "大野線": "Ono Line",
    "羽水高校線": "Usui High School Line",
    "一乗谷東郷線": "Ichijodani–Togo Line",
    "運動公園線（道守高校先回り）": "Sports Park Line (Chimori High School first)",
    "運動公園線（ベル前先回り）": "Sports Park Line (Bell first)",
    "清水グリーンライン": "Shimizu Green Line",
    "東尋坊線": "Tojinbo Line",
    "芦原丸岡永平寺線（長屋経由）": "Awara–Maruoka–Eiheiji Line (via Nagaya)",
    "芦原丸岡永平寺線": "Awara–Maruoka–Eiheiji Line",
    "永平寺線": "Eiheiji Line",
    "ぐるりん中部方面": "Gururin Bus (Central)",
    "すまいるバス北ルート": "Smile Bus North Route",
    "すまいるバス南ルート": "Smile Bus South Route",
    "すまいるバス東ルート": "Smile Bus East Route",
    "すまいるバス西ルート": "Smile Bus West Route",
    "名古屋線": "Nagoya Highway Bus",
    "小松空港線": "Komatsu Airport Line",
    "朝倉・永平寺ダイレクトバス": "Asakura–Eiheiji Direct Bus",
    "永平寺ライナー": "Eiheiji Liner",
    "恐竜バス": "Dinosaur Bus",
    "勝山大野線": "Katsuyama–Ono Line",
    "鶉三国線": "Uzura–Mikuni Line",
    "丸岡永平寺線": "Maruoka–Eiheiji Line",
}

# Railway station names, by hand: their official readings (the romaniser gets many wrong).
STATIONS = {
    "加賀温泉": "Kaga-Onsen",
    "大聖寺": "Daishoji",
    "牛ノ谷": "Ushinoya",
    "細呂木": "Hosorogi",
    "あわら湯のまち": "Awara-Yunomachi",
    "三国港": "Mikuni-Minato",
    "水居": "Mizui",
    "三国": "Mikuni",
    "芦原温泉": "Awara-Onsen",
    "三国神社": "Mikuni-Jinja",
    "番田": "Banden",
    "本荘": "Honjo",
    "大関": "Ozeki",
    "下兵庫こうふく": "Shimohyogo-Kofuku",
    "丸岡": "Maruoka",
    "西長田ゆりの里": "Nishinagata-Yurinosato",
    "西春江ハートピア": "Nishiharue-Heartpia",
    "太郎丸エンゼルランド": "Taromaru-Angelland",
    "春江": "Harue",
    "鷲塚針原": "Washizuka-Haribara",
    "森田": "Morita",
    "中角": "Nakatsuno",
    "志比堺": "Shihizakai",
    "永平寺口": "Eiheiji-guchi",
    "松岡": "Matsuoka",
    "新田塚": "Nittazuka",
    "観音町": "Kannonmachi",
    "下志比": "Shimoshihi",
    "越前島橋": "Echizen-Shimabashi",
    "光明寺": "Komyoji",
    "轟": "Todoroki",
    "東藤島": "Higashi-Fujishima",
    "八ツ島": "Yatsushima",
    "越前野中": "Echizen-Nonaka",
    "追分口": "Oiwakeguchi",
    "日華化学前": "Nikkakagaku-mae",
    "越前新保": "Echizen-Shinbo",
    "山王": "Sanno",
    "まつもと町屋": "Matsumoto-Machiya",
    "小舟渡": "Kobunato",
    "越前開発": "Echizen-Kaihotsu",
    "西別院": "Nishi-Betsuin",
    "田原町": "Tawaramachi",
    "福大前西福井": "Fukudaimae-Nishifukui",
    "越前竹原": "Echizen-Takehara",
    "発坂": "Hossaka",
    "福井口": "Fukuiguchi",
    "保田": "Hota",
    "仁愛女子高校": "Jin-ai Joshi Koko",
    "比島": "Hijima",
    "新福井": "Shin-Fukui",
    "福井城址大名町": "Fukuijoshi-Daimyomachi",
    "福井駅": "Fukui Station",
    "福井": "Fukui",
    "足羽山公園口": "Asuwayama-Koenguchi",
    "勝山": "Katsuyama",
    "商工会議所前": "Shokokaigisho-mae",
    "赤十字前": "Sekijuji-mae",
    "花堂": "Hanando",
    "越前花堂": "Echizen-Hanando",
    "ベル前": "Bell-mae",
    "江端": "Ebata",
    "六条": "Rokujo",
    "越前高田": "Echizen-Takada",
    "清明": "Seimei",
    "足羽": "Asuwa",
    "市波": "Ichinami",
    "越前東郷": "Echizen-Togo",
    "小和清水": "Kowashozu",
    "ハーモニーホール": "Harmony Hall",
    "一乗谷": "Ichijodani",
    "大土呂": "Odoro",
    "浅水": "Asozu",
    "越前薬師": "Echizen-Yakushi",
    "越前大宮": "Echizen-Omiya",
    "泰澄の里": "Taicho-no-Sato",
    "牛ケ原": "Ushigahara",
    "美山": "Miyama",
    "北大野": "Kita-Ono",
    "計石": "Hakariishi",
    "越前富田": "Echizen-Tomida",
    "三十八社": "Sanjuhassha",
    "越前田野": "Echizen-Tano",
    "越前大野": "Echizen-Ono",
    "鳥羽中": "Tobanaka",
    "下唯野": "Shimo-Tadano",
    "神明": "Shinmei",
    "柿ケ島": "Kakigashima",
    "北鯖江": "Kita-Sabae",
    "勝原": "Kadohara",
    "水落": "Mizuochi",
    "西山公園": "Nishiyama-Koen",
    "西鯖江": "Nishi-Sabae",
    "鯖江": "Sabae",
    "サンドーム西": "Sundome-Nishi",
    "家久": "Iehisa",
    "越前下山": "Echizen-Shimoyama",
    "スポーツ公園": "Sports-Koen",
    "北府": "Kitago",
    "たけふ新": "Takefu-Shin",
    "九頭竜湖": "Kuzuryuko",
    "武生": "Takefu",
    "王子保": "Ojiho",
    "南条": "Nanjo",
    "湯尾": "Yuno-o",
    "今庄": "Imajo",
    "南今庄": "Minami-Imajo",
    "敦賀": "Tsuruga",
    "西敦賀": "Nishi-Tsuruga",
    "粟野": "Awano",
    "東美浜": "Higashi-Mihama",
    "美浜": "Mihama",
    "新疋田": "Shin-Hikida",
    "気山": "Kiyama",
    "三方": "Mikata",
    "近江塩津": "Omi-Shiotsu",
    "余呉": "Yogo",
    "藤井": "Fujii",
    "十村": "Tomura",
    "木ノ本": "Kinomoto",
    "大鳥羽": "Otoba",
    "小浜": "Obama",
    "三松": "Mimatsu",
    "若狭和田": "Wakasa-Wada",
    "若狭高浜": "Wakasa-Takahama",
    "松尾寺": "Matsunoo",
    "若狭有田": "Wakasa-Arita",
    "東小浜": "Higashi-Obama",
    "若狭本郷": "Wakasa-Hongo",
    "青郷": "Aogo",
    "勢浜": "Seihama",
    "加斗": "Kato",
    "新平野": "Shin-Hirano",
    "高月": "Takatsuki",
    "東舞鶴": "Higashi-Maizuru",
    "上中": "Kaminaka",
    "河毛": "Kawake",
    "虎姫": "Torahime",
    "長浜": "Nagahama",
    "田村": "Tamura",
    "坂田": "Sakata",
    "米原": "Maibara",
    "越前たけふ": "Echizen-Takefu",
}

# Fukui (and neighbouring) place names the romaniser reads wrongly or that have an established spelling.
PLACES = {
    "芦原": "Awara", "あわら": "Awara", "幾久": "Ikuhisa", "東尋坊": "Tojinbo", "羽水": "Usui", "道守": "Chimori",
    "足羽": "Asuwa", "三國湊": "Mikuni-minato", "三國": "Mikuni", "三国港": "Mikuni-minato", "三国": "Mikuni",
    "九頭竜": "Kuzuryu", "武生": "Takefu", "たけふ": "Takefu", "越前": "Echizen", "一乗谷": "Ichijodani", "一乗": "Ichijo",
    "大野": "Ono", "春江": "Harue", "丸岡": "Maruoka", "敦賀": "Tsuruga", "鯖江": "Sabae", "金津": "Kanazu",
    "森田": "Morita", "新田塚": "Nittazuka", "西別院": "Nishi-Betsuin", "田原町": "Tawaramachi", "仁愛": "Jin-ai",
    "太郎丸": "Taromaru", "志比": "Shihi", "円山": "Maruyama", "計石": "Hakariishi", "定重": "Sadashige",
    "北菅生": "Kitasugao", "蒲生": "Gamo", "江留下": "Erushimo", "泰澄": "Taicho", "明里": "Akesato",
    "鷹巣": "Takasu", "本荘": "Honjo", "舟津": "Funatsu", "六呂瀬": "Rokurose", "楢原": "Narahara",
    "大丹生": "Onyu", "左内": "Sanai", "一本義": "Ippongi", "市波": "Ichinami", "荒谷": "Araya",
    "友末": "Tomosue", "鮎川": "Ayukawa", "糸崎": "Itozaki", "北府": "Kitago", "浄土寺": "Jodoji",
    "中角": "Nakatsuno", "六条": "Rokujo", "大鳥羽": "Otoba", "下安田": "Shimoyasuda", "砂子坂": "Isagozaka",
    "八重巻": "Yaemaki", "山王": "Sanno", "板垣": "Itagaki", "神明": "Shinmei", "永平寺": "Eiheiji",
    "勝山": "Katsuyama", "福井": "Fukui", "ふくい": "Fukui", "松岡": "Matsuoka", "坂井": "Sakai", "大和田": "Owada",
    "清水": "Shimizu", "東郷": "Togo", "大安寺": "Daianji", "高木": "Takagi", "えちしん": "Echishin",
    "名鉄": "Meitetsu", "名古屋": "Nagoya", "小松": "Komatsu", "金沢": "Kanazawa", "加賀": "Kaga",
    "大聖寺": "Daishoji", "芦原湯町": "Awara-yunomachi", "湯のまち": "Yunomachi", "新福井": "Shin-Fukui",
    "福大": "Fukui Univ.", "西福井": "Nishi-Fukui", "セーレン": "Seiren", "エンゼルランド": "Angel Land",
    "ハイツ": "Heights", "けやき台": "Keyakidai", "越前大野": "Echizen-Ono", "越前竹原": "Echizen-Takehara",
    "越前高田": "Echizen-Takada", "越前開発": "Echizen-Kaihotsu", "越前新保": "Echizen-Shinbo",
    "越前島橋": "Echizen-Shimabashi", "越前下山": "Echizen-Shimoyama", "越前薬師": "Echizen-Yakushi",
    "越前花堂": "Echizen-Hanando", "越前東郷": "Echizen-Togo", "越前富田": "Echizen-Tomida",
    "越前田野": "Echizen-Tano", "越前大宮": "Echizen-Omiya", "越前前波": "Echizen-Zenba",
    "越前野中": "Echizen-Nonaka", "越前武生": "Echizen-Takefu", "越前朝日": "Echizen-Asahi",
    "王子保": "Ojiho", "湯尾": "Yunoo", "今庄": "Imajo", "南今庄": "Minami-Imajo", "新疋田": "Shin-Hikida",
    "牛ノ谷": "Ushinoya", "細呂木": "Hosorogi", "丸岡口": "Maruoka-guchi", "西長田ゆりの里": "Nishinagata-Yurinosato",
    "あわら湯のまち": "Awara-Yunomachi", "芦原温泉": "Awara-Onsen", "加賀温泉": "Kaga-Onsen",
    "小松空港": "Komatsu Airport", "福井口": "Fukuiguchi", "福井城址大名町": "Fukuijoshi-Daimyomachi",
    "赤十字前": "Red Cross Hospital", "仁愛女子高校": "Jin-ai Girls' High School",
    "駅前南通り商店街": "Ekimae-Minamidori Shopping Street", "駅前電車通り": "Ekimae Densha-dori", "福井駅北": "Fukui Station North",
    "駅前大通り": "Ekimae-Odori", "駅前大通": "Ekimae-Odori", "福井駅東口": "Fukui Station East Exit", "福井駅西口": "Fukui Station West Exit", "薬師": "Yakushi", "学園": "Gakuen", "四ツ辻": "Yotsutsuji", "曽万布": "Somabu", "問屋": "Tonya",
    "美濃街道": "Mino Kaido", "休暇村": "Kyukamura", "丸岡城": "Maruoka Castle",
}

# Common words, longest first when applied (駅前 before 駅).
WORDS = {
    "駅西口": " Station West Exit", "駅東口": " Station East Exit", "駅前": " Station", "駅": " Station",
    "総合病院": " General Hospital", "大学病院": " University Hospital", "病院": " Hospital", "赤十字": " Red Cross",
    "県立大学": " Prefectural University", "大学": " University", "高等学校": " High School", "高校": " High School",
    "中学校": " Junior High School", "小学校": " Elementary School", "公民館": " Community Center",
    "市役所": " City Hall", "役場": " Town Office", "支所": " Branch Office", "警察署": " Police Station",
    "公園口": " Park Entrance", "公園": " Park", "城": " Castle", "温泉": " Onsen", "バスセンター": " Bus Center", "センター": " Center", "クリニック": " Clinic",
    "整形外科": " Orthopedics", "神社": " Shrine", "入口": " Entrance", "団地": " Estate", "児童館": " Children's Hall",
    "新聞社": " Newspaper", "郵便局": " Post Office", "図書館": " Library", "体育館": " Gymnasium", "運動公園": " Sports Park",
}

kks = pykakasi.kakasi()


def plain(r: str) -> str:
    """Hepburn with long vowels written plainly, as on Japanese road and station signs."""
    r = r.replace("ou", "o").replace("oo", "o").replace("uu", "u")
    return r


def romanise(ja: str) -> str:
    """One place name: its syllables run together (Hanando, not Hana Do); a temple's 寺 reads -ji."""
    if len(ja) > 1 and ja.endswith("寺"):
        return romanise(ja[:-1]) + "ji"
    return "".join(plain(x["hepburn"]) for x in kks.convert(ja) if x["hepburn"].strip())


def title(s: str) -> str:
    return " ".join(w[:1].upper() + w[1:] if w and w[0].isalpha() else w for w in s.split())


def chome(ja: str) -> str:
    nums = {"一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10}
    return re.sub(r"([一二三四五六七八九十])丁目", lambda m: f" {nums[m.group(1)]}-chome", ja)


def english(ja: str) -> str:
    s = ja.strip()
    if s in STATIONS:
        return STATIONS[s]
    s = s.translate(str.maketrans("０１２３４５６７８９（）", "0123456789()"))
    s = chome(s)
    s = re.sub(r"第(\d+)", r" No. \1", s)
    # A trailing 前 ("in front of"): after an institution it reads as the institution itself, otherwise "-mae".
    suffix = ""
    if s.endswith("前") and len(s) > 1:
        s = s[:-1]
        suffix = "" if any(s.endswith(w) for w in WORDS) else "-mae"
    # A trailing 口 ("entrance to"): -guchi, as on the stop signs (公園口 is handled as Park Entrance).
    elif s.endswith("口") and len(s) > 1 and not any(s.endswith(w) for w in ("公園口", "入口", "駅東口", "駅西口")):
        s = s[:-1]
        suffix = " Entrance" if any(s.endswith(w) for w in WORDS) else "-guchi"
    keys = sorted(list(STATIONS) + list(PLACES) + list(WORDS), key=len, reverse=True)
    out: list[str] = []
    i = 0
    buf = ""
    while i < len(s):
        k = next((k for k in keys if s.startswith(k, i)), None)
        if k:
            if buf:
                out.append(romanise(buf))
                buf = ""
            out.append(STATIONS.get(k) or PLACES.get(k) or WORDS[k])
            i += len(k)
        else:
            buf += s[i]
            i += 1
    if buf:
        out.append(romanise(buf))
    en = " ".join(x.strip() for x in out if x.strip())
    en = re.sub(r"\s+", " ", en).strip()
    return title(en) + suffix


def route(ja: str) -> str:
    m = re.match(r"^(\d+)\s*(.+)$", ja)
    num, base = (m.group(1) + " ", m.group(2)) if m else ("", ja)
    return num + (ROUTES.get(base) or english(base))


def walk(v, routes: set, names: set) -> None:
    """transport.json (site access): route names, journey legs' stops, nearby stops."""
    if isinstance(v, dict):
        if v.get("mode") and isinstance(v.get("route"), str):
            routes.add(v["route"])
            for k in ("from", "to"):
                if isinstance(v.get(k), str):
                    names.add(v[k])
        if v.get("mode") == "walk" and isinstance(v.get("to"), str):
            names.add(v["to"])
        if "distance_m" in v and isinstance(v.get("name"), str):
            names.add(v["name"])
        if v.get("mode") and "trips" in v and isinstance(v.get("name"), str):
            routes.add(v["name"])
        for x in v.values():
            walk(x, routes, names)
    elif isinstance(v, list):
        for x in v:
            walk(x, routes, names)


def main(map_path: str, trips_path: str, access_path: str | None = None) -> None:
    m = json.load(open(map_path, encoding="utf-8"))
    tr = json.load(open(trips_path, encoding="utf-8"))
    names = {s["name"] for s in m["stops"]} | {s["name_ja"] for s in (m.get("rail") or {}).get("stations", [])} | set(tr.get("stop_names") or [])
    routes = {l["name"] for l in m["lines"]} | {r["name"] for r in tr["routes"]}
    if access_path:
        walk(json.load(open(access_path, encoding="utf-8")), routes, names)
    out = {"routes": {r: route(r) for r in sorted(routes)}, "places": {n: english(n) for n in sorted(names)}}
    with open("src/i18n/transport.en.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"{len(out['routes'])} routes, {len(out['places'])} stop and station names")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
