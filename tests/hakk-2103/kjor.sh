set -x
timeout 420 node hakk.mjs "https://rambergapps.github.io/Game/game/index.html?view=34" A-ingen
timeout 420 node hakk.mjs "https://rambergapps.github.io/Game/game/index.html?view=34" B-cpu4 --cpu 4
timeout 600 node hakk.mjs "https://rambergapps.github.io/Game/game/index.html?view=34" C-cpu4-10mbit --cpu 4 --net 10
timeout 420 node hakk.mjs "https://rambergapps.github.io/Game/game/index.html?view=34" D-cpu4-dpr2 --cpu 4 --dpr 2
timeout 420 node hakk.mjs "http://127.0.0.1:8794/index.html?view=34" E-b804a6b-cpu4 --cpu 4
timeout 420 node hakk.mjs "http://127.0.0.1:8794/index.html?view=34" F-b804a6b-ingen
echo ALLE
