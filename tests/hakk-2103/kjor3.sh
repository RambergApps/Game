L=http://127.0.0.1:8794/index.html?view=34
timeout 420 node hakk.mjs "$L" E-b804a6b-cpu4 --cpu 4
timeout 420 node hakk.mjs "$L" F-b804a6b-ingen
echo ALLE3
