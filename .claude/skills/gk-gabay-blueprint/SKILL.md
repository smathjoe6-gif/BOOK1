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
   (see vocabulary below) or ones fact-checked from a named source.
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
- Flag: sky-blue with a white five-pointed star. Independence/union 1 July 1960.
- "Soomaaliyeey toosoo" (early 1940s); "Qolobaa Calankeed" (music Abdullahi
  Qarshe; national anthem since 2012). Somali Youth League founded 1943 (not
  1947, not "by women").

Sources (forms): Wikipedia "Somali literature", "Dhaanto", "Balwo", "Music of Somalia"; Sahan Journal on dhaanto; Britannica; City Lore "Poetry from Somalia".

Sources: WardheerNews "Paramountcy of Alliteration in Somali Literature";
Wikipedia "Somali literature", "Buraanbur", "Hawa Jibril", "Qolobaa Calankeed",
"Soomaaliyeey toosoo"; Britannica "African literature – Somali"; Sahan Journal
(buraanbur at weddings).

## Regional palettes — taught by Joe, 24 Oct 2026

Joe's four regional looks for scenes, costumes and colour grades. They are
JOE'S classification (not independently verified by Claude); use them as his
creative direction, and ask him before turning any of it into a public FACT
claim (for example which cloth is worn where).

1. **Banaadiri Coastal (Mogadishu and the coast).** Deep maritime indigo,
   sea-foam white, ocean blue, gold accents. Light, intricate hand-loomed
   weaves; refined trade and tailoring. Scenes: sunlit white-stucco courtyard
   gathering round a master Kaban player; a starlit ocean terrace.
2. **Digil & Mirifle / Southwest Agrarian (Bay and Bakool).** Rich earth tones,
   deep crimson, ochre, forest green. Heavy-weave Alindi and multicoloured
   geometric cloth that tells the story of land and farming. Scenes: river-basin
   harvest dance to Dhaanto percussion; two elders playing Kaban in a
   brick studio with amber lattice light.
3. **Northern & Nomadic (Hargeisa, Burao, the interior).** Bold primary red,
   stark white, deep black, orange contrasts. Durable wraps and shawls built
   for movement, with sharp geometric striping. Scenes: a figure in a red,
   black and white wrap on a rocky overlook; a low-key portrait against red
   clay with orange Alindi borders.
4. **Jubbaland & Riverine (Kismayo and the Lower South).** Tropical green,
   sun-baked terracotta, bright yellow, sky blue. Flowing silhouettes, tie-dye
   and woven patterns. Scenes: a walk through a sun-dappled coastal forest to
   Kaban strumming; community gathering on the Jubba river docks at dusk with
   lanterns.

How to use them: pick ONE palette per prompt, name the colours and the cloth,
add the Kaban and the GK mark, and keep the rest of the house style.

### House-safe changes to Joe's examples (so they don't trip platforms or AI artifacts)
- Joe's text says "high-fashion editorial" and "model": write "tailored,
  premium editorial portrait" and "a woman/man wearing ..." (see Style DNA).
- GK mark: put it ON an object in the scene (bench corner, drum rim, headstock,
  lapel, soundhole) like a signature. Never "watermark" and never an overlay.
- Laas Geel is a real rock-art site near Hargeisa: show the landscape and
  granite peaks only; no people climbing on or touching the paintings.
- Keep the realism lines (anatomy, no duplicated fingers, true-to-life skin
  tones) in every prompt.

## Verified Somali — the learning table (Joe is teaching Claude step by step)

Rule: a line moves to CONFIRMED only when Joe (or a native speaker he names)
says it is right. Until then it stays CHECK. Record every correction here with
the wrong form and the reason, so no session repeats a mistake.

CONFIRMED by Joe: (none yet; add rows as Joe confirms)

CLAUDE'S CONFIDENT PHRASES (still to be confirmed by Joe):
| Somali | Meaning |
|---|---|
| Hambalyo! | Congratulations! |
| Nabad iyo caano! | Peace and milk! (blessing of peace and plenty) |
| Soo dhawoow! | Welcome! |
| Soomaaliyeey! | O Somalia / O Somalis! |

CHECK (asked Joe 24 Oct): "Guul iyo midnimo" (victory and unity) and
"Farxad iyo barwaaqo" (joy and abundance): spelling and wording.

CORRECTIONS FROM JOE: (none yet)

Forms Joe asked about (24 Oct): not only gabay and buraanbur. His list had
several forms; "shrimp" is probably **Shirib**. Ask Joe which FIVE are the core
and record them here. Verified forms are in the Forms catalog above.

Learning loop when Joe shows a real verse or song: (1) break it down (sound
that carries the alliteration, half-lines, rhythm, vocabulary, tone), (2) Joe
corrects, (3) save the lesson and the corrected words in this table, (4) only
then write new material in that form.

### Lesson 24 Oct 2026 (night): gabay vs buraanbur, taught by Joe
Joe pasted a text on Somali verse (source: Somali cultural-festival text, Wikipedia-style; he did not name it) and a media-source map. What it says, saved as his lesson:
- **Gabay** = the epic poem, the height of Somali poetic attainment, usually composed by MEN.
- **Buraanbur** = its female counterpart, lighter measure (miisaan), the highest women's literary genre. Sub-forms: **hoyal, hoobeeyo, sitaat** (sitaat = religious song).
- Buraanbur is a women's voice for child-rearing, marriage, social and political issues; often with drums, clapping, dancing; passed down by women across generations. Farhio Ilmi leads a Buraanbur performance at Somalisk Kulturfestival 2026.
- **Rule for prompts:** a woman performer = buraanbur (not gabay); an elder man under an acacia = gabay. Resolves the earlier CHECK on Gabay Prompt 2 (woman on the coastal terrace -> make it buraanbur).
- Joe's source map (titles only, not verified by Claude): Bulsho News "B-ARIMAHA HAWEENKA & BARWAAQO"; Dheel Dhaqan Studio "Boodo Isaaq", "Buraanbur Gacan Loo Taagay", "Buraanbur Sacad Muse"; Dhaqankeena "Buraanbur Majerten"; Hido iyo Dhaqan Media "Ciyaar Buraanbur Salaan Lootaagaay"; Digital: Instagram, "Wedding Video Blueprint". The titles hint at clan/regional buraanbur styles (Isaaq, Sacad Muse, Majerten); not yet taught, ask Joe before using any clan name in a prompt.
