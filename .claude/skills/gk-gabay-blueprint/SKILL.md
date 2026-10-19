---
name: gk-gabay-blueprint
description: GK Legend Studio blueprint for turning Somali poetry (gabay, buraanbur, geeraar) and heritage scene ideas into finished song + video packages — music prompt, lyrics, English chorus, Grok video prompts, caption with footer — saved to Drive. Use when Joe sends Somali verse, a gabay, a scene idea, asks for a patriotic/heritage song, a letter-locked (alliteration) gabay, or says "make it a song / make the video prompts".
metadata:
  type: workflow
  version: "1.0"
  owner: GK Legend Studio (Joe)
---

# GK Gabay Blueprint

The repeatable way Joe and Claude build heritage songs and films. Worked
examples (all in Drive folder GK_Viral_Prompts `1GLeqzy5IpYbpQtN-xll-LcH-AE3_LK8Q`):
- Gabay Xarafka "G" — "The Sovereign Rally" (letter-locked on G, best example) — `1Xh80XoyY_ZQPPNBw9eQp3LKtSd_2MemcwUyXnnQVBt4`
- "Hirta iyo Hiddaha" song — `1swAK_ZNoc3R_Z6a3JusxkAlD7y0mQzQkLp9hiW01GEI`
- "Mudane Geesi" song — `1nMF7k--SRNRJ4MWebyG-3TK7IpWhbnRRzod6x27sGZE`
- "Soomaaliyeey" song — `1WiRb0u6ciRxy0SaU8F23CJ2TnMPzB1i2ETpMo-5syow`
- "The Sovereign Shield (Gurmadka iyo Gobannimada)" 4-part film — `1nPp9Ug2IU2xt_n_jUISXNveRPvARCdMpctKIYRKJKjc`
- Strong Buraanbur prompts — `1Lkm4r_j5CbDta7qqQbYeR5JSYN9P6QRELK7d9YGTuHU`

## Iron rules

1. **Joe writes the Somali. Claude never invents Somali verse.** Keep Joe's
   lines exactly as sent — no "fixes". If a word looks like a typo (e.g.
   "ururkaoo", "Atkutaba"), leave it and ask in one line.
2. **Somali words Claude may use on its own:** only real, well-known ones
   (see vocabulary below) or ones fact-checked from a named source. **Why
   this is an iron rule, not a style preference** (Joe, 19 Oct 2026 — source:
   "Autopsy of an Algorithmic Hallucination," a forensic breakdown of a real
   YouTube auto-caption run on a Somali track): when an AI system has no real
   data for a low-resource language like Somali, it doesn't fail cleanly —
   it pattern-matches the input to the nearest *high-resource* language it
   does have deep data for (in that case, Arabic script) and confidently
   outputs fluent-looking nonsense (the deck's example: real Somali vocals
   came out as a looping "راعي راعي راعي" — invented ghost text, not a real
   transcription). This is the exact same failure mode as an LLM inventing
   fake-sounding "Somali" phrasing instead of real words — confident-looking
   output standing in for data that was never there. It's why this skill
   insists on only real, checked vocabulary: the fix isn't "try harder," it's
   "never let the model freewheel in a language it doesn't actually have."
3. **Nothing is generated (audio/image/video) until Joe says "Go" /
   "Generate now".** Before that it's text only.
4. **Every public caption ends with the footer:**
   `© 2026 GK Legend Studio. All rights reserved.` + `https://www.youtube.com/@PathFoundGK`
5. **Facts get checked.** Use the ARS plugin (`academic-research-skills:deep-research`,
   fact-check mode) or web sources; list sources at the bottom of the doc.
   Drop any claim a source doesn't support (e.g. "coded messages").
6. **Defensive, not violent.** Mobilisation/defence scenes show unity and
   standing firm — no blood, no fighting shown.
7. **Platform-safe titles:** words like "Jihaad" (even meaning "struggle") get videos flagged/down-ranked — keep them in the doc, use an English title in public captions, and tell Joe.
8. **Don't show real poets' faces** (e.g. Hawa Jibril) — "inspired by" only.

## How a gabay works (check Joe's verse against this)

- **Qaafiyad (alliteration):** ONE sound runs through the WHOLE poem.
- A gabay line has two halves; **each half needs at least one word** starting
  with that sound. Not every word — one per half-line.
- **All vowels count as the same sound** (A, E, I, O, U alliterate together).
- Gabay = long (14–16 syllables per line, traditionally 100+ lines), formal,
  weighty. Geeraar = short, urgent, punchy. Buraanbur = women's form,
  drum + call-and-answer. A song uses a gabay *excerpt*, so say "gabay-style"
  when it's short.
- When a letter is chosen, list which word carries it in each half-line and
  flag any half-line that's missing it (don't rewrite — ask Joe).

## Workflow

1. **Read what Joe sent** — verse, scene idea, or just a theme/title.
2. **Check** alliteration (above) and any history/culture claims (ARS / web).
3. **Pick the sound** from the brand guide in CLAUDE.md:
   - "Somali"/patriotic/gabay → Pan-Somali Qaraami, Tubeec-style, weighty.
   - "Benadiri/soul" → Axmed Shariif Killer solo mode.
   - Countryside/pastoral → same Qaraami, rawer: wind, goat bells, open space.
   - Buraanbur → women's voices, frame drum, handclaps, ululation.
   - Always: Kaban lead, 6/8 or 4/4, sub-bass, dry snare, ends on the GK
     Kaban audio-logo pluck.
4. **Build the song structure** (default):
   - Intro: Joe's verse 1 **spoken** over solo Kaban.
   - English chorus (short, singable, Claude writes it; hook on one of Joe's
     own words if possible, e.g. "Mudane Geesi", "Soomaaliyeey").
   - Middle verse half-sung, drums build.
   - Bridge/climax: Joe's last verse, ending on his strongest line, then the
     choir explodes into the final chorus (key change, ululation).
   - Outro: one held Kaban note + GK pluck.
5. **Write the video prompts** (Grok, 10 s each) in house style — every one has:
   first-second hook + loud described SOUND (THUD, BOOM, CRACK) · photorealistic
   wording (never "stylized"/"high-fashion") · GK crest worked INTO the scene
   (staff, saddle, drum rim, Kaban body — like a signature, not a watermark) ·
   tight framing when people touch animals/objects · "Accurate anatomy and
   correct proportions, no duplicated limbs or distorted features, natural
   true-to-life colour grading" · real named light · a short bold white
   subtitle "across the bottom third for the full 10 seconds" · "10 seconds."
   A scene idea → 3–4 parts that also join into one ~40 s film.
6. **Write the caption** (Heritage Drop): Hook → Story → Vision → Call
   ("Join…/Secure a Piece of the Legacy", never "buy") → footer.
7. **Save one Drive doc** in GK_Viral_Prompts named
   `GK_<Title>_<SONG|Scene>_<YYYY-MM-DD>` with sections: HOW IT'S BUILT ·
   MUSIC PROMPT · LYRICS · CHECK FOR JOE · VIDEO PROMPT(S) · CAPTION · SOURCES.
   Re-read the doc after saving to confirm the text is there.
8. **Tell Joe in plain words**: the link, the song/film shape in 4–6 bullets,
   the chorus, any one-line question, and "paste MUSIC PROMPT + LYRICS into
   your music app" (no music tool is connected here).
9. **Log it** on the CLAUDE.md status board (date + doc id) via a
   `claude/…` branch → PR → merge into `desktop-script`.

## Style DNA — the 4 layers (Joe, 24 Sep 2026), house-safe version

Add these layers to every video/image prompt. Where Joe's original wording
conflicts with what has been shown to work, the house-safe version wins
(reason noted).

1. **Material & texture** — handwoven Alindi cloth (indigo, crimson, gold
   geometric patterns), Guntiino drapes, structured Shabal silhouettes,
   luminous Dirac silk. Name the real garment and its real colours.
   ⚠️ Say "tailored", "finely made", "premium" — NOT "high-fashion" or
   "stylized": those words caused visible AI artifacts (see CLAUDE.md).
2. **Sound & atmosphere** — the Kaban on screen (a modern carbon-fiber
   Kaban is fine as a future-forward accent), Dhaanto rhythm in the music
   prompt; real named places and light: sunrise over Bakool or the
   southern plains, mist on the highlands, deep blue ocean shelf.
3. **The GK stamp** — metal or embroidered GK logo placed ON something in
   the scene: hardware, buckle, garment hem, saddle, drum rim, Kaban body.
   ⚠️ Never an overlaid/"ambient" watermark — brand guide: a signature on
   the painting, not a watermark slapped on top.
4. **Technical spec** — 9:16 vertical; anamorphic lens flare; volumetric
   light (dust, mist or smoke catching the light); high-contrast grade with
   obsidian blacks, liquid gold and terracotta; ultra-detailed textile
   texture. (Grok outputs its own resolution — "8K" can stay in the text
   but doesn't change the file.)

Always keep the realism lines too: "Photorealistic… Accurate anatomy and
correct proportions, no duplicated limbs or distorted features, natural
true-to-life skin tones" — the colour grade goes on light and cloth, not
on skin.

## Forms catalog — checked 24 Sep 2026 (use only the ✅ ones in captions)

| Form | What it really is | Studio use |
|---|---|---|
| ✅ Gabay | Classical, male-voiced, long, weighty; one alliteration sound through the whole poem | Anthems, documentaries |
| ✅ Geeraar | Classical, short lines, urgent; recited on horseback | Trailers, battle-cry/rally edits |
| ✅ Jiifto | Classical form, lighter than gabay | Storytelling, travel songs |
| ✅ Buraanbur | Women's form (sub-forms hoyal, hoobeeyo, sitaat); drum, call-and-answer, dance | Wedding/pride songs |
| ✅ Hees | Sung "light" poetry: work songs, dance songs, lullabies, camel-watering songs | Pastoral/herding scenes |
| ✅ Balwo → Heello | Balwo = short love-song form; with the lute it grew into heello, the modern song | Romantic tracks |
| ✅ Qaraami | Golden-age romantic/nostalgic Kaban ballads | Luxury heritage drops |
| ✅ Dhaanto | Folk music + dance from the **Somali Region of Ethiopia** (pastoralists, 19th c.); camel-inspired steps, jumps, stomps, claps; revived by the Dervishes, sung on horseback | High-energy dance edits |
| ✅ Shirib | Southern Somali dance: men in two long lines, a song master (lashin) calls a short verse, the lines chant it back | Short 9:16 chant/drill edits |
| ✅ Shir | Council/gathering to decide together | Governance/defence scenes |
| Also real (details not yet checked): wiglo, beercade, afarey, guuraw | Research before use | — |

❌ **Do NOT use (couldn't verify, may be invented):** "Biciidley", "Heyraan",
"Heedhow", "Masafo". For herding/travel songs say **hees** instead.
❌ Dhaanto is **not** "from Bay and Bakool" — it comes from the Somali Region
of Ethiopia (Wikipedia "Dhaanto", Sahan Journal).

## Vocabulary Claude may use (real, common words)

| Word | Meaning | | Word | Meaning |
|---|---|---|---|---|
| Soomaaliyeey | "O Somalia/Somalis" (call) | | Geesi | hero |
| Gobannimo | freedom, dignity | | Gurmad | call to come help / reinforcement |
| Gaashaan | shield | | Guul | victory |
| Gacan | hand | | Geed | tree |
| Shir | council, gathering | | Iskaashi | working together |
| Ergey | envoy, messenger | | Hooyo | mother |
| Calan | flag | | Dhaanto | traditional dance/rhythm |
| Kaban | Somali oud | | Alindi | hand-woven Somali cloth |
| Guntiino / Garbasaar / Dirac | women's garments | | Haan | woven milk vessel |
| Oodda | thornwood fence | | Buraanbur / Gabay / Geeraar | poetry forms |

Tip: letter **G** carries the brand (GK) and has strong words — Geesi,
Gobannimo, Gurmad, Gaashaan, Guul, Gacan, Geed, Galbeed.

## Checked facts (safe for captions)

- Gabay: 14–16 syllables per line, often 100+ lines, the prestige form; one
  alliteration sound through the whole poem, in each half-line.
- Poems were memorised and carried by reciters (hafidayaal); the alliteration
  helps memory. Say "easy to memorise and pass on" — NOT "coded messages".
- Sayid Maxamed Cabdulle Xasan used gabay as resistance against colonial rule.
- Buraanbur: women's poetry, woman poet with drum in the circle, call-and-answer,
  one dancer per family (shawl over face, one-leg step), ululation; used in the
  1940s–50s to rally resistance to colonial rule. Hawa Jibril (1920–2011),
  Mudug plateau, first poem at 12.
- **Golden Age state-sponsored "supergroups" (Joe, 19 Oct 2026):** after
  Maxamed Siyaad Barre's 1969 coup, the government took direct control of
  the arts — commandeering the National Theatre in Mogadishu (opened 1967,
  a gift from China's Chairman Mao Zedong) and attaching major bands
  (Waabeeri, Shareero, Iftin, Horseed, Somaali Jaaz, Onkod, Halgan) to the
  government, military or police, unlike independent groups like the
  Dur-Dur Band — their repertoire was heavily patriotic/propagandised. This
  era drove a shift from unaccompanied poetry to musical theatre ("muusiko"),
  and trained key figures: Maryan Mursal ("first lady of Somali jazz,"
  Waabeeri → Somaali Jaaz), Abdullahi Qarshe, Ali Feiruz, Magool, Hassan
  Sheikh Mumin, Abdi Ali ("Bacalwaan"). The bands also had nightclub/hotel
  residencies in "swinging Mogadishu" (Somaali Jaaz at the Jubba and
  Al-Uruba hotels, Iftin at the Lido nightclub, Shareero at the Jazira
  hotel) alongside the state theatre circuit. Useful background for
  Documentary-lane/history content — don't reproduce any band's actual
  song lyrics in a caption or doc; summarize the history, don't quote the
  art.
- **Balwo origin (Joe, 19 Oct 2026):** founded by Abdi Sinimo, a Somali
  lorry driver from the Reer Nuur subclan of the Gadabuursi, born out of a
  spontaneous moment of frustration (c. 1943–1945) when his truck broke
  down in the bush near Zeila — he sang a short poem of distress ("Belwooy,
  belwooy…"), named the new style balwo ("misfortune"), and it became an
  instant public hit that spread to other poets and directly led to the
  more complex heello genre. Simple, personal lyricism about love, passion
  and suffering — the first modern break from classical gabay formality.
- **Why real Somali vocabulary is a hard rule, not a style choice (Joe,
  19 Oct 2026):** the real song "Dardaaran" by Mohamed BK and Nimco Yaasiin
  (2015) is the actual case study behind a forensic write-up Joe shared
  ("Autopsy of an Algorithmic Hallucination") showing a YouTube auto-caption
  system transcribing real Somali vocals as looping, invented Arabic-script
  nonsense ("راعي راعي راعي…") because it had no real Somali data and
  pattern-matched to the nearest high-resource language instead of failing
  cleanly. Same failure mode as an LLM inventing fake-sounding "Somali"
  lines — confident output standing in for data that isn't there. This is
  the grounding for the standing rule above: only real, checked vocabulary,
  never invented-but-plausible-sounding Somali.
- Flag: sky-blue with a white five-pointed star. Independence/union 1 July 1960.
- "Soomaaliyeey toosoo" (early 1940s); "Qolobaa Calankeed" (music Abdullahi
  Qarshe; national anthem since 2012). Somali Youth League founded 1943 (not
  1947, not "by women").

Sources (forms): Wikipedia "Somali literature", "Dhaanto", "Balwo", "Music of Somalia"; Sahan Journal on dhaanto; Britannica; City Lore "Poetry from Somalia".

Sources: WardheerNews "Paramountcy of Alliteration in Somali Literature";
Wikipedia "Somali literature", "Buraanbur", "Hawa Jibril", "Qolobaa Calankeed",
"Soomaaliyeey toosoo"; Britannica "African literature – Somali"; Sahan Journal
(buraanbur at weddings).
