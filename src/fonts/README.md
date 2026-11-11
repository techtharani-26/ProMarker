# Fonts

`inter-latin-wght.woff2` — Inter variable font (weights 100–900), Latin subset, by Rasmus Andersson.
Licensed under the SIL Open Font License 1.1 (https://openfontlicense.org), which allows bundling it in this app.

`build.js` embeds every `.woff2` here into the page as a base64 `@font-face`, so ProMarker stays one self-contained file.
Characters outside the Latin subset fall back to the system font.
