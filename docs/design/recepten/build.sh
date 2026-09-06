#!/usr/bin/env bash
# Assembles the mockups: one shared frame (fonts, tokens, icon sprite, tab bar)
# around each page body in src/. Run from this directory: ./build.sh
set -euo pipefail
cd "$(dirname "$0")"

expand() { # inline INCLUDE:file lines
  while IFS= read -r line; do
    if [[ "$line" =~ ^[[:space:]]*INCLUDE:(.+)$ ]]; then cat "src/${BASH_REMATCH[1]}"; else printf '%s\n' "$line"; fi
  done < "$1"
}

frame() { # $1 body file, $2 include tab bar (yes/no)
  echo '<div class="phone"><div class="statusbar">9:41</div>'
  expand "$1"
  [[ "$2" == yes ]] && cat src/_tabbar.html
  echo '</div>'
}

head_html() {
  cat <<HTML
<!doctype html>
<html lang="nl"><head><meta charset="utf-8"><title>$1</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="src/styles.css">
</head><body>
HTML
  cat src/_sprite.html
}

# page file | tab bar | caption
pages=(
  "01-overzicht|yes|<b>1. Overzicht</b> — zoek op naam of ingrediënt, filter op tag, één regel per recept."
  "02-nieuw|no|<b>2. Nieuw recept</b> — titel, tags, ingrediënten als drie velden (aantal · eenheid · ingrediënt), bereiding als stappen."
  "03-recept-ingredienten|yes|<b>3. Recept · Ingrediënten</b> — switch links = ingrediënten, rechts = bereiding. Hoeveelheden in een vaste kolom, wat al op de lijst staat gemarkeerd. Onderin: Lijkt op + In mandje."
  "04-recept-bereiding|yes|<b>4. Recept · Bereiding</b> — grote stappen, afvinkbaar tijdens het koken."
  "05-in-mandje|yes|<b>5. In mandje</b> — sheet: alles aangevinkt, voorraadspullen uitvinken, samenvoeging met de lijst zichtbaar."
  "06-lijkt-op|yes|<b>6. Lijkt op</b> — eigen pagina via de knop onderin: recepten gerangschikt op gedeelde ingrediënten, gedeeld vs. nog nodig. Tik een ingrediënt-chip om te vernauwen."
)

for p in "${pages[@]}"; do
  IFS='|' read -r name tab caption <<< "$p"
  { head_html "Recepten · $name"; echo '<div class="gallery"><div class="shot">'; frame "src/$name.html" "$tab"; echo "<p class=\"caption\">$caption</p></div></div></body></html>"; } > "$name.html"
done

{ head_html "Recepten — redesign"; echo '<div class="gallery">'
  for p in "${pages[@]}"; do
    IFS='|' read -r name tab caption <<< "$p"
    echo '<div class="shot">'; frame "src/$name.html" "$tab"; echo "<p class=\"caption\">$caption</p></div>"
  done
  echo '</div></body></html>'; } > index.html
echo "built: index.html + ${#pages[@]} pages"
