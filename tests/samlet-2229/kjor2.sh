L=http://127.0.0.1:8841/index.html?view=34
timeout 600 node samlet.mjs "$L" B-cpu4 --cpu 4
echo FERDIGB
timeout 600 node samlet.mjs "$L" A-ingen --vapen
echo ALLE
