"""Static demo content for 12th Coach.

Everything here is fictional: player names, the opponent, past matches and the
free-text reasons. No real personal data and no real player names are used.
"""

HOME = {"name": "FC Bayern", "short": "FCB"}
AWAY = {"name": "SV Nordhafen", "short": "NOR"}
MATCHDAY = 10

BLOCKS = ["Südkurve", "Nordkurve", "West Stand", "East Stand", "Remote"]
REMOTE_BLOCK = 4
COUNTRIES = ["Germany", "Austria", "Türkiye", "USA", "UK", "Japan", "Brazil", "Other"]

# minute, kind ("goal-home" | "goal-away" | "info"), text
EVENTS = [
    (1, "info", "Kick-off at the Arena."),
    (9, "info", "Brandner's header goes just wide."),
    (17, "info", "Tannert tips a long-range shot over the bar."),
    (21, "goal-home", "GOAL! Brandner finishes Arakawa's through ball."),
    (33, "info", "Nordhafen start to press higher."),
    (38, "goal-away", "Nordhafen equalise after a turnover in midfield."),
    (45, "info", "Half-time."),
    (52, "info", "64% possession for Bayern, but few clear chances."),
    (63, "goal-home", "GOAL! Brandner heads in a cross from the right."),
    (74, "info", "Nordhafen bring on a second striker."),
    (88, "goal-home", "GOAL! Arakawa finishes a counter-attack."),
    (90, "info", "Full time."),
]

# The three demo fans (no login). `attended` = home matches attended this season.
PERSONAS = {
    "season": {
        "label": "Season-ticket holder",
        "detail": "Südkurve · Munich",
        "block": 0, "country": 0, "attended": 16, "fanIq": 365,
        "history": [
            {"label": "Called the 3-4-3 switch — minority and right", "match": "vs SC Altenberg", "pts": 15},
            {"label": "Player of the moment matched the staff's pick", "match": "vs TSV Rheinau", "pts": 10},
            {"label": "Called the substitution", "match": "vs VfR Hohenfels", "pts": 10},
        ],
    },
    "occasional": {
        "label": "Occasional visitor",
        "detail": "East Stand · Nuremberg",
        "block": 3, "country": 0, "attended": 3, "fanIq": 120,
        "history": [
            {"label": "Called the substitution", "match": "vs Union Kessel", "pts": 10},
            {"label": "Called the game plan — minority and right", "match": "vs SV Bergstedt", "pts": 15},
        ],
    },
    "remote": {
        "label": "Remote fan abroad",
        "detail": "Second screen · Istanbul",
        "block": 4, "country": 2, "attended": 0, "fanIq": 210,
        "history": [
            {"label": "Player of the moment matched the staff's pick", "match": "vs FC Kronstein", "pts": 10},
            {"label": "Called the substitution", "match": "vs Eintracht Westhagen", "pts": 10},
        ],
    },
}

REWARDS = [
    {"name": "Fan scarf", "cost": 150},
    {"name": "Match jersey", "cost": 400},
    {"name": "Stadium tour", "cost": 800},
]

# Decision moments of the simulated match.
#   stadium / remote: base probability per option for synthetic fans.
#   coach: the scripted decision (pre-selected in the operator panel; the
#          operator can enter anything).
#   reasons: per option, (free text, cluster id). Mixed English, German, Turkish.
# Rule for every question: forward-looking and positive. No question asks fans
# to rate a player negatively or to vote someone off.
MOMENTS = [
    {
        "id": "m1", "minute": 23, "type": "potm", "title": "Player of the moment",
        "context": "1–0 after 21 minutes. Bayern are on top.",
        "question": "Who is your player of the moment?",
        "resolveLabel": "Coaching staff's pick",
        "options": [
            {"id": "a", "label": "Lukas Brandner", "sub": "Scored the opener"},
            {"id": "b", "label": "Kenji Arakawa", "sub": "Assist and three key passes"},
            {"id": "c", "label": "Daniel Obuya", "sub": "Won every duel at the back"},
            {"id": "d", "label": "Felix Tannert", "sub": "Big save at 0–0"},
        ],
        "stadium": [0.36, 0.32, 0.20, 0.12], "remote": [0.52, 0.28, 0.08, 0.12],
        "loyal": [0.8, 1.3, 1.2, 1.0],
        "coach": "b",
        "clusters": {
            "decisive": "Decisive goal contribution",
            "buildup": "Runs the build-up play",
            "defence": "Defensive security",
            "movement": "Work rate off the ball",
        },
        "reasons": {
            "a": [("Clinical finish, that is what a striker is for", "decisive"),
                  ("Eiskalt vor dem Tor, genau so!", "decisive"),
                  ("Golü atan o, başka söze gerek yok", "decisive"),
                  ("His movement drags both centre-backs out of position", "movement")],
            "b": [("Every attack goes through him", "buildup"),
                  ("Er macht das Spiel, alle Angriffe laufen über ihn", "buildup"),
                  ("Asist harikaydı, oyunu o yönetiyor", "buildup"),
                  ("That pass split four defenders", "decisive")],
            "c": [("Gewinnt jeden Zweikampf, absolute Wand", "defence"),
                  ("Has not lost a duel yet", "defence"),
                  ("Savunmada duvar gibi", "defence")],
            "d": [("That save at 0-0 changed the game", "decisive"),
                  ("Ohne die Parade stünde es 0:1", "defence"),
                  ("O kurtarış olmasa geride olurduk", "defence")],
        },
    },
    {
        "id": "m2", "minute": 41, "type": "shape", "title": "Shape",
        "context": "1–1. Nordhafen press high and keep winning the ball in midfield.",
        "question": "Should the shape change?",
        "resolveLabel": "What the coach actually did",
        "options": [
            {"id": "a", "label": "Stay 4-2-3-1", "sub": "Trust the plan"},
            {"id": "b", "label": "Switch to 3-4-3", "sub": "Extra man in the build-up"},
            {"id": "c", "label": "Go 4-4-2", "sub": "Two strikers, play direct"},
        ],
        "stadium": [0.26, 0.52, 0.22], "remote": [0.50, 0.26, 0.24],
        "loyal": [0.7, 1.5, 0.9],
        "coach": "b",
        "clusters": {
            "trust": "Trust the starting shape",
            "beatpress": "Beat the high press",
            "direct": "Play more direct",
            "midfield": "Win back midfield control",
        },
        "reasons": {
            "a": [("One goal conceded does not mean the plan is wrong", "trust"),
                  ("Ruhe bewahren, das System passt", "trust"),
                  ("Sistem doğru, sabır lazım", "trust"),
                  ("Half-time is four minutes away, adjust then", "trust")],
            "b": [("An extra centre-back gives us a free man against their press", "beatpress"),
                  ("Mit Dreierkette kommen wir sauberer hinten raus", "beatpress"),
                  ("Üçlü savunmayla presi kırarız", "beatpress"),
                  ("High wing-backs would pin their full-backs", "midfield")],
            "c": [("Skip their press with long balls to two strikers", "direct"),
                  ("Zwei Spitzen, lange Bälle, fertig", "direct"),
                  ("İki forvetle daha direkt oynayalım", "direct"),
                  ("A flat four in midfield closes the centre", "midfield")],
        },
    },
    {
        "id": "m3", "minute": 58, "type": "sub", "title": "Substitution",
        "context": "Still 1–1. The attack needs fresh legs.",
        "question": "Who should come on?",
        "resolveLabel": "What the coach actually did",
        "options": [
            {"id": "a", "label": "Emre Yıldıran", "sub": "Winger · pace"},
            {"id": "b", "label": "Jonas Feldner", "sub": "Striker · aerial threat"},
            {"id": "c", "label": "Luca Bianchetti", "sub": "Playmaker · creativity"},
            {"id": "d", "label": "No change yet", "sub": "Give it ten more minutes"},
        ],
        "stadium": [0.46, 0.24, 0.20, 0.10], "remote": [0.34, 0.18, 0.38, 0.10],
        "loyal": [1.3, 1.0, 0.7, 0.9],
        "coach": "a",
        "clusters": {
            "pace": "Pace against tired defenders",
            "aerial": "Aerial presence in the box",
            "creative": "Creativity between the lines",
            "patience": "Too early to change",
        },
        "reasons": {
            "a": [("Their left-back is on a yellow and tired, run at him", "pace"),
                  ("Tempo über außen, die Außenverteidiger sind platt", "pace"),
                  ("Hızıyla savunmanın arkasına sarkar", "pace"),
                  ("Yıldıran oyunu açar, kanatlar boş", "pace")],
            "b": [("We keep crossing with nobody in the box", "aerial"),
                  ("Wir brauchen einen Abnehmer für die Flanken", "aerial"),
                  ("Ortalara kafa vuracak adam lazım", "aerial")],
            "c": [("We need someone who can unlock a deep block", "creative"),
                  ("Zwischen den Linien fehlt die Idee", "creative"),
                  ("Orta sahada yaratıcılık eksik, Bianchetti girsin", "creative"),
                  ("He sees passes nobody else sees", "creative")],
            "d": [("This eleven is creating chances, be patient", "patience"),
                  ("Noch zehn Minuten Geduld", "patience"),
                  ("Biraz daha sabır", "patience")],
        },
    },
    {
        "id": "m4", "minute": 67, "type": "plan", "title": "Game plan",
        "context": "2–1 up since the 63rd minute.",
        "question": "What is the plan for the last 20 minutes?",
        "resolveLabel": "What the coach actually did",
        "options": [
            {"id": "a", "label": "Keep attacking", "sub": "Go for the third goal"},
            {"id": "b", "label": "Control possession", "sub": "Slow the game down"},
            {"id": "c", "label": "Add a holding midfielder", "sub": "Protect the lead"},
        ],
        "stadium": [0.50, 0.28, 0.22], "remote": [0.30, 0.42, 0.28],
        "loyal": [1.3, 0.8, 0.9],
        "coach": "b",
        "clusters": {
            "third": "A third goal ends it",
            "tempo": "Control the tempo",
            "protect": "Protect the lead",
        },
        "reasons": {
            "a": [("The best defence is a third goal", "third"),
                  ("Weiter nach vorne, das 3:1 machen!", "third"),
                  ("Üçüncü golü bulup maçı bitirelim", "third"),
                  ("They are wide open on the counter now", "third")],
            "b": [("Keep the ball and let them run", "tempo"),
                  ("Ballbesitz, Tempo rausnehmen", "tempo"),
                  ("Topu saklayıp oyunu soğutalım", "tempo"),
                  ("They chase, we stay fresh for Wednesday", "tempo")],
            "c": [("Their number 10 has too much space", "protect"),
                  ("Ein Sechser mehr und das Ding ist durch", "protect"),
                  ("Orta sahaya bir kesici şart", "protect")],
        },
    },
    {
        "id": "m5", "minute": 82, "type": "sub", "title": "Substitution",
        "context": "2–1. Nordhafen throw everything forward.",
        "question": "Final change: who should come on?",
        "resolveLabel": "What the coach actually did",
        "options": [
            {"id": "a", "label": "Tomáš Hradil", "sub": "Holding midfielder"},
            {"id": "b", "label": "Mateo Serrano", "sub": "Fresh full-back"},
            {"id": "c", "label": "Niklas Vogt", "sub": "Box-to-box runner"},
        ],
        "stadium": [0.44, 0.26, 0.30], "remote": [0.50, 0.20, 0.30],
        "loyal": [1.1, 1.2, 0.8],
        "coach": "a",
        "clusters": {
            "protect": "Protect the lead",
            "legs": "Fresh legs against fatigue",
            "counter": "Threat on the counter",
        },
        "reasons": {
            "a": [("Close the centre and see it out", "protect"),
                  ("Zentrum dicht machen", "protect"),
                  ("Merkezi kapatıp maçı alalım", "protect"),
                  ("Their long balls keep landing in front of the back four", "protect")],
            "b": [("Our right side is exhausted", "legs"),
                  ("Rechts hinten geht nichts mehr, frische Beine", "legs"),
                  ("Sağ bek yoruldu, taze kan lazım", "legs")],
            "c": [("His runs give us an outlet on the counter", "counter"),
                  ("Mit Vogt können wir kontern", "counter"),
                  ("Kontrada işimizi görür", "counter")],
        },
    },
]

# ---- Seed data for the Fan Insight Pool: nine past fictional matches --------

PAST_MATCHES = [
    # matchday, opponent, venue, date, score (Bayern first), participants
    (1, "SC Altenberg", "home", "2026-08-22", "3–1", 8200),
    (2, "Union Kessel", "away", "2026-08-29", "1–1", 7400),
    (3, "TSV Rheinau", "home", "2026-09-12", "2–0", 10100),
    (4, "FC Lindenau 04", "away", "2026-09-19", "2–3", 9600),
    (5, "VfR Hohenfels", "home", "2026-09-26", "4–0", 12300),
    (6, "SpVgg Marktbach", "away", "2026-10-03", "2–1", 11800),
    (7, "Eintracht Westhagen", "home", "2026-10-17", "1–0", 14600),
    (8, "SV Bergstedt", "away", "2026-10-24", "0–0", 13900),
    (9, "FC Kronstein", "home", "2026-11-07", "3–2", 17200),
]

# Option pools for generated past moments: (label, reason cluster it attracts)
PAST_TEMPLATES = {
    "sub": {
        "title": "Substitution", "question": "Who should come on?",
        "pool": [
            ("Emre Yıldıran", "Pace against tired defenders"),
            ("Jonas Feldner", "Aerial presence in the box"),
            ("Luca Bianchetti", "Creativity between the lines"),
            ("Tomáš Hradil", "Protect the lead"),
            ("Mateo Serrano", "Fresh legs against fatigue"),
            ("Niklas Vogt", "Threat on the counter"),
        ],
        "pick": 3, "extra": ("No change yet", "Too early to change"),
        "matchRate": {"home": 0.62, "away": 0.40},
    },
    "shape": {
        "title": "Shape", "question": "Should the shape change?",
        "pool": [
            ("Stay 4-2-3-1", "Trust the starting shape"),
            ("Switch to 3-4-3", "Beat the high press"),
            ("Go 4-4-2", "Play more direct"),
        ],
        "pick": 3, "extra": None,
        "matchRate": {"home": 0.45, "away": 0.35},
    },
    "potm": {
        "title": "Player of the moment", "question": "Who is your player of the moment?",
        "pool": [
            ("Lukas Brandner", "Decisive goal contribution"),
            ("Kenji Arakawa", "Runs the build-up play"),
            ("Daniel Obuya", "Defensive security"),
            ("Felix Tannert", "Decisive saves"),
            ("Paul Wernicke", "Work rate off the ball"),
        ],
        "pick": 4, "extra": None,
        "matchRate": {"home": 0.75, "away": 0.70},
    },
    "plan": {
        "title": "Game plan", "question": "What is the plan for the last 20 minutes?",
        "pool": [
            ("Keep attacking", "A third goal ends it"),
            ("Control possession", "Control the tempo"),
            ("Add a holding midfielder", "Protect the lead"),
        ],
        "pick": 3, "extra": None,
        "matchRate": {"home": 0.60, "away": 0.55},
    },
}

# Which moment types each past match had, with minutes.
PAST_SCHEDULE = [
    [("potm", 19), ("sub", 61), ("plan", 72), ("sub", 84)],
    [("shape", 34), ("sub", 57), ("sub", 79)],
    [("potm", 27), ("shape", 44), ("sub", 63), ("plan", 70)],
    [("shape", 31), ("sub", 55), ("sub", 68), ("potm", 77)],
    [("potm", 16), ("sub", 59), ("plan", 66), ("potm", 81), ("sub", 85)],
    [("shape", 39), ("sub", 62), ("plan", 73), ("sub", 86)],
    [("potm", 24), ("shape", 47), ("sub", 64), ("plan", 71), ("sub", 83)],
    [("shape", 28), ("sub", 56), ("sub", 74), ("potm", 80)],
    [("potm", 22), ("shape", 42), ("sub", 60), ("plan", 69), ("sub", 87)],
]

ASK_EXAMPLES = [
    "How did fans react to substitutions in away matches?",
    "When do fans disagree most with the coach?",
    "How do stadium fans and fans abroad differ?",
]

TYPE_LABEL = {"sub": "substitution", "shape": "shape", "potm": "player-of-the-moment", "plan": "game-plan"}
