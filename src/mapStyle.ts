import type { StyleSpecification } from "maplibre-gl";

/**
 * A blank, pastel world: land, water, soft borders and (when zoomed in) roads and buildings, with no labels.
 * The only names on the map are the places you add. Tiles come from OpenFreeMap (OpenStreetMap data).
 */
export const blankStyle: StyleSpecification = {
  version: 8,
  sources: {
    omt: {
      type: "vector",
      url: "https://tiles.openfreemap.org/planet",
      attribution:
        '<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer">OpenMapTiles</a> data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
    },
  },
  layers: [
    { id: "land", type: "background", paint: { "background-color": "#f8f9ff" } },
    {
      id: "landcover",
      type: "fill",
      source: "omt",
      "source-layer": "landcover",
      filter: ["in", "class", "wood", "grass", "wetland"],
      paint: { "fill-color": "#e3f5ea", "fill-opacity": 0.7 },
    },
    {
      id: "park",
      type: "fill",
      source: "omt",
      "source-layer": "park",
      paint: { "fill-color": "#e0f4e7", "fill-opacity": 0.8 },
    },
    {
      id: "water",
      type: "fill",
      source: "omt",
      "source-layer": "water",
      paint: { "fill-color": "#cfe2ff" },
    },
    {
      id: "waterway",
      type: "line",
      source: "omt",
      "source-layer": "waterway",
      paint: { "line-color": "#cfe2ff", "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.5, 14, 2.5] },
    },
    {
      id: "roads-minor",
      type: "line",
      source: "omt",
      "source-layer": "transportation",
      minzoom: 12,
      filter: ["in", "class", "secondary", "tertiary", "minor", "service"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#e4e8fb", "line-width": ["interpolate", ["linear"], ["zoom"], 12, 0.5, 16, 3.5] },
    },
    {
      id: "roads-major",
      type: "line",
      source: "omt",
      "source-layer": "transportation",
      minzoom: 6,
      filter: ["in", "class", "motorway", "trunk", "primary"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#dde2fa", "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.4, 12, 1.8, 16, 6] },
    },
    {
      id: "buildings",
      type: "fill",
      source: "omt",
      "source-layer": "building",
      minzoom: 14,
      paint: { "fill-color": "#e7eafb", "fill-opacity": 0.9 },
    },
    {
      id: "boundary-state",
      type: "line",
      source: "omt",
      "source-layer": "boundary",
      minzoom: 3,
      filter: ["all", ["==", "admin_level", 4], ["==", "maritime", 0]],
      paint: { "line-color": "#c9d1f5", "line-width": 0.8, "line-dasharray": [3, 3] },
    },
    {
      id: "boundary-country",
      type: "line",
      source: "omt",
      "source-layer": "boundary",
      filter: ["all", ["==", "admin_level", 2], ["==", "maritime", 0]],
      paint: { "line-color": "#b9c3f0", "line-width": ["interpolate", ["linear"], ["zoom"], 1, 0.6, 8, 1.4] },
    },
  ],
};
