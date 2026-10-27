# CINDERBORN – designark (UTKAST)

> **Status 23.10.2026: Påbegynt av Nivåer og story, overtatt av Fiende-design – utkast.**
> Nivåer og story har stoppet arbeidet her etter beskjed fra Breach. Fiende-design eier nå arket og fiendenes utseende. Alt nedenfor er et utgangspunkt, ikke låst.

## Hva som er ferdig
- **Malte hovedillustrasjoner i trekvart** for alle seks (Husk, Lurcher, Kiln, Spitter, Kiln Alpha, Ashmaw), laget med bildegenerering: `reviews/img/cinderborn/<navn>-main.jpg`.
- **Malte profiler på hvit bakgrunn** og **svarte silhuetter** skåret ut med Pillow/scipy:
  - side: alle seks (`<navn>-side-ref.jpg` / `-side-silhouette.png`)
  - ovenfra: alle seks (`<navn>-top-ref.jpg` / `-top-silhouette.png`), hodet peker opp
  - skrå trekvart (zScale 0,75, ca. 37° fra loddrett, vendt mot sørøst): fem av seks (`<navn>-oblique-ref.jpg` / `-oblique-silhouette.png`)
- **Samleark:** `reviews/img/cinderborn-designark.png` med maling, tre silhuetter, ovenfra-silhuett i spillstørrelse (1× og 3×), palett og lysmønster per monster.

## Hva som mangler
- **Skrå silhuett for Kiln Alpha** er ikke laget.
- **Husk ovenfra:** skjoldarmen forsvant i utskjæringen fordi den er lys grå mot hvitt. Silhuetten må rettes for hånd eller genereres på nytt.
- **Ett ark per monster** er ikke laget, bare samlearket.
- **Ikke laget:** animasjonsnotater, testing i 28–32 px mot ekte arenagulv og lysmønster tegnet inn på silhuettene.
- **Konsistens mellom visningene:** profil-, topp- og skråbildene er generert hver for seg ut fra hovedbildet. Proporsjonene stemmer derfor ikke helt, og Spitter-profilen er mer brun enn svart. Ashmaws malte hovedbilde og skråbildet har ikke helt samme antall ventiler; ovenfra- og skråbildet viser 8.
- **Kiln og Kiln Alpha** lignet hverandre ovenfra i første forsøk. Alpha har nå piggkant og to kjerner og leses ulikt, men dette bør sjekkes i spillskala.

## Utkast til tabell (i samsvar med STORY-KONSEPTER.md, konsept A)
| Monster | Rolle | Størrelse | Silhuett ovenfra | Farger (hex) | Lysmønster | Svake punkter |
|---|---|---|---|---|---|---|
| Husk | Grunt | 1 rute, kropp 30 px | rund kuppel med kort, butt «nese» foran; piggarm på én side, skjold på den andre | kitin `#141416`/`#2a2624`, glo `#c0392b` | røde sprekker over pukkelen, rød halsspalte foran (retning) | halsspalten forfra; ryggen når skjoldet vender bort |
| Lurcher | Flanker | 1 rute, kropp ~32 px med hale | dråpe med to «vinger» (hinnekrage) bak hodet, lang tynn hale | `#121214`/`#2b2220`, krage `#8e1e1e` | to små røde øyne helt foran; kragen gløder svakt når den folder seg ut i fart | lav HP; kragen er stor treffflate når den er ute |
| Kiln | Heavy | 36 px (Heavy-unntak) | bred, avrundet firkant med fire korte bein i hjørnene | `#151515`/`#33302c`, kjerne `#ff7a1a` | kjernen i brystet pulserer (1200 ms), glo i ryggsømmene | kjernen forfra under spray; snur sakte (flank) |
| Spitter | Grenadier | 1 rute, kropp 30 px (beina stikker ut) | oval med lang hals foran, tynne edderkoppbein, lysende klase bak | `#131315`/`#2a2730`, sekker `#9b59ff` | tre kalde lilla sekker bak (eneste kalde lys) | sekkene: treff gir giftsprut rundt den |
| Kiln Alpha | Mini-boss | ~52 px | stor blokk med sagtakket piggkant langs ryggen og sidene | `#141312`/`#3a332c`, `#ffb347`/`#ff7a1a` | to kjerner langs ryggraden (fram/bak); slagg fra kjeften | kjernen bak (flank); fase 2 når en kjerne er knust |
| Ashmaw | Sluttboss | ~120 px (ca. 4 ruter) | rund kuppel med åtte ventiler i ring, ovnskjeft foran (retning), bein ut til alle kanter | `#101012`/`#2c2826`, `#ff7a1a`/`#ffd27a` | 8 oransje gjelleventiler pulserer; kjeften gløder før smeltekjeglen | ventilene (lukker seg når hun ser deg, så det krever flanking); kjeften i fase 3 |

Animasjonsnotater og endelige mål for kroppen eies nå av Fiende-design.

## Tillegg fra Fiende-design (23.10.2026)
- `reviews/img/cinderborn-designark.png` er nå **v2-arket** fra Fiende-design. Arket ovenfor som tabellen beskriver, ligger i `reviews/img/cinderborn-designark-utkast.png`.
- Silhuetter, proporsjoner, lysmønster med tider, animasjonsliste, fargevalg for Kiln Alpha og Ashmaw og filgrensen mot Fiende-AI står i **docs/FIENDE-DESIGN.md**.
- Overstyrt fra tabellen:
  - Lurcher har ingen vinger. Den er en lav insekt-øgle med hinnekrage.
  - Kiln Alpha bruker aksent `#fff0b0` i stedet for `#ffb347`.
  - Ashmaws kjeft er `#ff5a1a`.
