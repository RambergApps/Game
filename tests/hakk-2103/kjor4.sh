U=https://rambergapps.github.io/Game/game/index.html?view=34
timeout 420 node hakk.mjs "$U" H-cpu4-uten-korn --cpu 4 --uten-korn
timeout 420 node hakk.mjs "$U" I-cpu4-uten-begge --cpu 4 --uten-korn --uten-spillrender
timeout 420 node hakk.mjs "$U" G-cpu4-uten-spillrender --cpu 4 --uten-spillrender
echo ALLE4
