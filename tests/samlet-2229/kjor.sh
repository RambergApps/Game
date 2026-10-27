L=http://127.0.0.1:8823/index.html?view=34
timeout 600 node samlet.mjs "$L" A-ingen --vapen
timeout 600 node samlet.mjs "$L" B-cpu4 --cpu 4
echo ALLE
