# Outpost Zero

A 2D survival trainer for junior astronauts. You are alone at a Moon or Mars outpost for two weeks.
Walk the base, fix what breaks, and keep air, water, food and power going.

## Missions
| Mission | Style |
|---|---|
| Mars: Base Duty | Easy start. Solar panels, greenhouse, ice. |
| Mars: Left Behind | Survival. Crew gone, antenna broken. Inspired by *The Martian* (a movie, not NASA). |
| Moon: Base Duty | Easy start. Power unit, heater, dust. |
| Moon: The Long Night | Survival. 14 Earth days of darkness. |

## Run it
Open `index.html` in a browser, or in VS Code use the Live Server extension.
Click once on the page so the browser allows sound.

## Put it on GitHub
```bash
git init
git add .
git commit -m "Outpost Zero"
git branch -M main
git remote add origin https://github.com/YOUR-NAME/outpost-zero.git
git push -u origin main
```
To get a free web link: GitHub repo > Settings > Pages > Deploy from branch `main` / root.

## Files
```
index.html
css/style.css
js/data.js     missions, events, tasks, NASA sources (edit numbers here)
js/audio.js    all sound made in the browser (no audio files)
js/render.js   canvas drawing
js/game.js     rules, interface, main loop
```

## How "Why?" works
After every task, alert, wrong safety answer or blocked action, a **Why?** button appears under Mission Control.
It explains why it worked or failed and shows a NASA fact. The full list is under **NASA sources**.

## NASA sources used
Facts are simplified from public NASA information. The game does not download live data.
- NASA Mars Exploration Program (science.nasa.gov/mars)
- NASA/JPL Mars rovers: Spirit, Opportunity, Curiosity, Perseverance
- NASA Phoenix lander and LCROSS mission
- NASA Moon facts and Artemis (science.nasa.gov/moon)
- NASA Apollo mission reports and Lunar Surface Journal
- NASA International Space Station life support (ECLSS)
- NASA Apollo 13 mission history
- NASA Radioisotope Power Systems (rps.nasa.gov)
- NASA Veggie plant growth system on the ISS
- NASA Deep Space Network
- NASA Heliophysics: solar flares and space weather
- NASA spacewalk (EVA) safety training
- NASA Human Research Program

Please check the exact page links yourself before publishing. Not an official NASA product.

## Make it easier or harder
Edit `WORLDS` and `SCENARIOS` in `js/data.js` (start values, event days, usage rates).
