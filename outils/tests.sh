#!/bin/sh
# Lance tous les tests du serveur ; s'arrête au premier échec.
cd "$(dirname "$0")/.." || exit 1
for f in tests/test-*.js; do
  node "$f" > /tmp/test.log 2>&1 || { echo "ÉCHEC : $f"; tail -20 /tmp/test.log; exit 1; }
  echo "$f : $(tail -1 /tmp/test.log)"
done
