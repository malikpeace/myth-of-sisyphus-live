#!/bin/bash
# usage: runcaps.sh TAG DEV ALTS LOOK REALM:PORT ...   (runs in parallel, bounded)
cd "$(dirname "$0")"
TAG=$1; DEV=$2; ALTS=$3; LOOK=$4; shift 4
for rp in "$@"; do
  r=${rp%%:*}; p=${rp##*:}
  perl -e 'alarm 260; exec @ARGV' python3 herogame.py $p $r $ALTS $DEV ${TAG}_${DEV}_$r "$LOOK" 3 > out/log_${TAG}_${DEV}_$r.txt 2>&1 &
done
wait
tail -n 2 out/log_${TAG}_${DEV}_*.txt
