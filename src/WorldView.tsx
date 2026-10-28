import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
// Hand MapLibre its worker through Vite so it is found in dev and in production builds.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import type { Person } from "./types";
import { HUES } from "./types";
import { blankStyle } from "./mapStyle";
import type { Cluster, DisplayLevel } from "./worldLayout";
import { clusterPeople, levelForZoom, nextZoom } from "./worldLayout";

// In dev MapLibre finds its worker beside its own module; a production bundle needs it pointed out.
if (import.meta.env.PROD) maplibregl.setWorkerUrl(workerUrl);

interface Props {
  people: Person[];
  onOpen: (id: string) => void;
}

const bg = (p: Person) =>
  `${p.photo ? `url("${p.photo}") center / cover no-repeat, ` : ""}linear-gradient(135deg, ${HUES[p.hue].light}, ${HUES[p.hue].deep})`;
const initial = (p: Person) => p.name.trim().charAt(0).toUpperCase() || "?";

/** Puts React content on the map at a real coordinate, kept in place by MapLibre as you pan and zoom. */
function MapMarker({ map, lng, lat, children }: { map: maplibregl.Map; lng: number; lat: number; children: ReactNode }) {
  const el = useMemo(() => {
    const d = document.createElement("div");
    d.className = "mk";
    return d;
  }, []);
  const marker = useRef<maplibregl.Marker | null>(null);

  useEffect(() => {
    const m = new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([lng, lat]).addTo(map);
    marker.current = m;
    return () => {
      m.remove();
      marker.current = null;
    };
    // the marker is created once per map; position changes are applied below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, el]);

  useEffect(() => {
    marker.current?.setLngLat([lng, lat]);
  }, [lng, lat]);

  return createPortal(children, el);
}

/** A flat glass disc holding up to four people, like a small collage. */
function Collage({ members }: { members: Person[] }) {
  const shown = members.length > 4 ? members.slice(0, 3) : members.slice(0, 4);
  const extra = members.length - shown.length;
  return (
    <span className={"collage n" + Math.min(members.length, 4)}>
      {shown.map((m) => (
        <span key={m.id} className="mini" style={{ background: bg(m) }}>
          {!m.photo && initial(m)}
        </span>
      ))}
      {extra > 0 && <span className="mini more">+{extra}</span>}
    </span>
  );
}

function Disc({ person, size, onOpen }: { person: Person; size: number; onOpen: (id: string) => void }) {
  return (
    <button className="disc" style={{ width: size, height: size, background: bg(person), fontSize: size * 0.42 }} aria-label={`${person.name}, open page`} onClick={() => onOpen(person.id)}>
      <span>{!person.photo && initial(person)}</span>
    </button>
  );
}

/** At a city's center: its place name, with each person circling it like the relationship map. */
function Ring({ cluster, people, onOpen, onZoom }: { cluster: Cluster; people: Person[]; onOpen: (id: string) => void; onZoom: () => void }) {
  const n = people.length;
  const radius = 66 + Math.max(0, n - 6) * 7;
  const size = 2 * (radius + 44);
  const pos = people.map((_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return { x: radius * Math.cos(a), y: radius * Math.sin(a) };
  });
  return (
    <div className="ring-place">
      <svg className="ring-lines" width={size} height={size} style={{ left: -size / 2, top: -size / 2 }} aria-hidden="true">
        {people.map((p, i) => (
          <line key={p.id} x1={size / 2} y1={size / 2} x2={size / 2 + pos[i].x} y2={size / 2 + pos[i].y} stroke={HUES[p.hue].deep} strokeOpacity="0.5" strokeWidth="2.5" strokeLinecap="round" />
        ))}
      </svg>
      <button className="place-pill glass" onClick={onZoom} aria-label={`Zoom in on ${cluster.name}`}>
        {cluster.name}
      </button>
      {people.map((p, i) => (
        <span key={p.id} className="ring-person" style={{ left: pos[i].x, top: pos[i].y }}>
          <Disc person={p} size={46} onOpen={onOpen} />
          <span className="disc-name">{p.name}</span>
        </span>
      ))}
    </div>
  );
}

export default function WorldView({ people, onOpen }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [level, setLevel] = useState<DisplayLevel>("country");
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const fitted = useRef(false);

  useEffect(() => {
    // Fail fast and visibly when the browser cannot draw the map at all.
    const probe = document.createElement("canvas");
    if (!probe.getContext("webgl2") && !probe.getContext("webgl")) {
      setStatus("failed");
      return;
    }

    let m: maplibregl.Map;
    try {
      m = new maplibregl.Map({
        container: box.current!,
        style: blankStyle,
        center: [-30, 30],
        zoom: 1.6,
        minZoom: 0.4,
        maxZoom: 19,
        dragRotate: false,
        attributionControl: { compact: true },
      });
    } catch {
      // most often WebGL is unavailable or disabled
      setStatus("failed");
      return;
    }
    m.touchZoomRotate.disableRotation();
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    const onZoom = () => setLevel(levelForZoom(m.getZoom()));
    m.on("zoom", onZoom);
    onZoom();

    // If the map never gets going (offline, blocked tiles, a worker that cannot start), say so instead of showing an empty box.
    let loaded = false;
    const giveUp = window.setTimeout(() => !loaded && setStatus("failed"), 12000);
    m.on("load", () => {
      loaded = true;
      setStatus("ready");
    });
    m.on("error", () => !loaded && setStatus("failed"));

    setMap(m);
    return () => {
      window.clearTimeout(giveUp);
      m.remove();
      setMap(null);
    };
  }, []);

  const located = useMemo(() => people.filter((p) => p.place), [people]);

  // Frame everyone once the map is ready.
  useEffect(() => {
    if (!map || fitted.current || located.length === 0) return;
    fitted.current = true;
    const lons = located.map((p) => p.place!.lon);
    const lats = located.map((p) => p.place!.lat);
    map.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], { padding: 140, maxZoom: 5, duration: 0 });
  }, [map, located]);

  const clusterLevel = level === "ring" || level === "house" ? "city" : level;
  const clusters = useMemo(() => clusterPeople(located, clusterLevel), [located, clusterLevel]);

  const zoomInto = (c: Cluster) => {
    if (!map) return;
    const min = nextZoom[level];
    const cam = map.cameraForBounds([[c.bounds[0], c.bounds[1]], [c.bounds[2], c.bounds[3]]], { padding: 140, maxZoom: min + 1 });
    map.easeTo({ center: cam?.center ?? [c.lng, c.lat], zoom: Math.max(cam?.zoom ?? min, min + 0.05), duration: 900 });
  };

  const showAll = () => {
    if (!map || located.length === 0) return;
    const lons = located.map((p) => p.place!.lon);
    const lats = located.map((p) => p.place!.lat);
    map.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], { padding: 140, maxZoom: 5, duration: 900 });
  };

  // At street level, anyone with an exact address stands at their real house.
  const atHouse = level === "house" ? located.filter((p) => p.place!.precision === "address") : [];
  const houseIds = new Set(atHouse.map((p) => p.id));

  return (
    <div className="world">
      <div className="world-map" ref={box} />

      {map &&
        level !== "ring" &&
        level !== "house" &&
        clusters.map((c) => (
          <MapMarker key={level + c.id} map={map} lng={c.lng} lat={c.lat}>
            <button className="place" onClick={() => zoomInto(c)} aria-label={`${c.name}, ${c.members.length} ${c.members.length === 1 ? "person" : "people"}. Zoom in`}>
              <Collage members={c.members} />
              <span className="place-label glass">{c.name}</span>
            </button>
          </MapMarker>
        ))}

      {map &&
        (level === "ring" || level === "house") &&
        clusters.map((c) => {
          const around = level === "house" ? c.members.filter((m) => !houseIds.has(m.id)) : c.members;
          if (around.length === 0) return null;
          return (
            <MapMarker key={level + c.id} map={map} lng={c.lng} lat={c.lat}>
              <Ring cluster={c} people={around} onOpen={onOpen} onZoom={() => zoomInto(c)} />
            </MapMarker>
          );
        })}

      {map &&
        atHouse.map((p) => (
          <MapMarker key={"h" + p.id} map={map} lng={p.place!.lon} lat={p.place!.lat}>
            <span className="house">
              <Disc person={p} size={42} onOpen={onOpen} />
              <span className="place-label glass">{p.place!.nickname || p.name}</span>
            </span>
          </MapMarker>
        ))}

      {status === "failed" && (
        <div className="world-notice glass" role="alert">
          <strong>The map couldn't load</strong>
          <span>It needs an internet connection and WebGL. Check your connection, then try again. Your people and places are safe.</span>
          <button className="pill-btn primary" onClick={() => window.location.reload()}>
            Try again
          </button>
        </div>
      )}

      {located.length === 0 && status !== "failed" && (
        <div className="empty-hint glass">
          <strong>No one is on the map yet</strong>
          <span>Open someone's page and add where they live. Any level works: a country, a city, or an exact address.</span>
        </div>
      )}
      {located.length > 0 && (
        <button className="pill-btn glass show-all" onClick={showAll}>
          Show everyone
        </button>
      )}
    </div>
  );
}
