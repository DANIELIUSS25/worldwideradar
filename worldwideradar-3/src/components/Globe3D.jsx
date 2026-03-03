// Globe3D v8 — Advanced Three.js globe with satellite fires, seismic, proxy arcs, country choropleth
import { useRef, useEffect, useState } from "react";
import * as THREE from "three";
import { SEV_COLOR, ACLED_COLORS } from "../data/zones.js";
import { MONO } from "./UI.jsx";

// Country topojson numeric ID → conflict severity (Natural Earth IDs)
const COUNTRY_SEV = {
  804:"CRITICAL", 275:"CRITICAL",                          // Ukraine, Palestine
  729:"HIGH", 104:"HIGH", 466:"HIGH", 854:"HIGH", 562:"HIGH", 180:"HIGH", 887:"HIGH", // Sudan,Myanmar,Mali,BF,Niger,DRC,Yemen
  706:"MEDIUM", 332:"MEDIUM", 231:"MEDIUM",                // Somalia,Haiti,Ethiopia
};
const SEV_HEX = { CRITICAL:0xff2d55, HIGH:0xff9f0a, MEDIUM:0xffd60a, LOW:0x30d158 };

// Proxy war links — animated arcs
const PROXY_ARCS = [
  { from:[35.7,51.4], to:[31.5,34.5], label:"Iran→Gaza",      col:"#ff2d55" },
  { from:[35.7,51.4], to:[15.5,48.5], label:"Iran→Yemen",     col:"#ff2d55" },
  { from:[55.75,37.6],to:[49.0,31.0], label:"Russia→Ukraine", col:"#ff9f0a" },
  { from:[-1.94,30.06],to:[-1.5,28.5],label:"Rwanda→DRC",     col:"#ff9f0a" },
  { from:[24.4,54.4], to:[15.5,32.5], label:"UAE→Sudan",      col:"#ffd60a" },
];

function latLonToVec3(lat, lon, r=1) {
  const phi   = (90 - lat) * Math.PI / 180;
  const theta = (lon + 180) * Math.PI / 180;
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta),
  );
}

function buildArcPoints(lat1,lon1,lat2,lon2,h=0.38,n=60) {
  const p1  = latLonToVec3(lat1,lon1,1.01);
  const p2  = latLonToVec3(lat2,lon2,1.01);
  const mid = p1.clone().add(p2).multiplyScalar(0.5).normalize().multiplyScalar(1.01+h);
  const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2);
  return curve.getPoints(n);
}

export default function Globe3D({ zones, acledEvents, fires=[], quakes=[], selected, onSelect, filter, layers={} }) {
  const mountRef = useRef(null);
  const sceneRef = useRef({});
  const [hovered, setHovered] = useState(null);
  const [ready, setReady] = useState(false);
  const animRef = useRef(null);
  const isDragging = useRef(false);
  const lastMouse = useRef({x:0,y:0});
  const rotation = useRef({x:0.3, y:0});

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const W = el.clientWidth || 920;
    const H = el.clientHeight || 470;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x020c18, 1);
    el.appendChild(renderer.domElement);

    // Scene + Camera
    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, W/H, 0.1, 100);
    camera.position.z = 2.5;

    // Ambient light
    scene.add(new THREE.AmbientLight(0x112233, 2));
    const sun = new THREE.DirectionalLight(0x334455, 1.5);
    sun.position.set(5, 3, 5);
    scene.add(sun);
    const rimLight = new THREE.DirectionalLight(0x00c864, 0.3);
    rimLight.position.set(-5, -2, -3);
    scene.add(rimLight);

    // Globe sphere
    const globeGeo  = new THREE.SphereGeometry(1, 64, 64);
    const globeMat  = new THREE.MeshPhongMaterial({
      color: 0x061d35, emissive: 0x020810, specular: 0x1a4a3a,
      shininess: 15, transparent: true, opacity: 0.95,
    });
    const globe = new THREE.Mesh(globeGeo, globeMat);
    scene.add(globe);

    // Atmosphere glow
    const atmGeo = new THREE.SphereGeometry(1.05, 64, 64);
    const atmMat = new THREE.MeshPhongMaterial({
      color: 0x00c864, transparent: true, opacity: 0.04,
      side: THREE.BackSide,
    });
    scene.add(new THREE.Mesh(atmGeo, atmMat));

    // Grid lines (lat/lon)
    const gridMat = new THREE.LineBasicMaterial({ color:0x00c864, transparent:true, opacity:0.07 });
    for (let lat = -60; lat <= 60; lat += 30) {
      const pts = [];
      for (let lon = 0; lon <= 360; lon += 4) pts.push(latLonToVec3(lat, lon-180, 1.001));
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gridMat));
    }
    for (let lon = 0; lon < 360; lon += 30) {
      const pts = [];
      for (let lat = -90; lat <= 90; lat += 4) pts.push(latLonToVec3(lat, lon-180, 1.001));
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gridMat));
    }

    // Groups for each data layer
    const hotspotsGroup = new THREE.Group(); scene.add(hotspotsGroup); sceneRef.current.hotspotsGroup = hotspotsGroup;
    const eventsGroup   = new THREE.Group(); scene.add(eventsGroup);   sceneRef.current.eventsGroup   = eventsGroup;
    const firesGroup    = new THREE.Group(); scene.add(firesGroup);    sceneRef.current.firesGroup    = firesGroup;
    const seismicGroup  = new THREE.Group(); scene.add(seismicGroup);  sceneRef.current.seismicGroup  = seismicGroup;
    const arcsGroup     = new THREE.Group(); scene.add(arcsGroup);     sceneRef.current.arcsGroup     = arcsGroup;

    // Pre-build proxy arcs (animated)
    PROXY_ARCS.forEach(arc => {
      const pts = buildArcPoints(arc.from[0],arc.from[1],arc.to[0],arc.to[1]);
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color:new THREE.Color(arc.col), transparent:true, opacity:0.5 });
      arcsGroup.add(new THREE.Line(geo, mat));
    });

    // Country borders + conflict-zone choropleth glow
    fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
      .then(r=>r.json()).then(world=>{
        if (!window.topojson) { setReady(true); return; }
        const countries = window.topojson.feature(world, world.objects.countries);
        const borderMat = new THREE.LineBasicMaterial({ color:0x00c864, transparent:true, opacity:0.18 });
        countries.features.forEach(f => {
          const sev = COUNTRY_SEV[parseInt(f.id)];
          const drawLine = (coords) => {
            const pts = coords.map(([lon,lat]) => latLonToVec3(lat, lon, 1.002));
            if (pts.length > 1) scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), borderMat));
          };
          if (f.geometry?.type==="Polygon")      f.geometry.coordinates.forEach(r=>drawLine(r));
          if (f.geometry?.type==="MultiPolygon") f.geometry.coordinates.forEach(p=>p.forEach(r=>drawLine(r)));
          // Choropleth: extra bright border for conflict states
          if (sev) {
            const glowOp = sev==="CRITICAL"?0.65:sev==="HIGH"?0.5:0.35;
            const glowMat = new THREE.LineBasicMaterial({ color:SEV_HEX[sev], transparent:true, opacity:glowOp });
            const drawGlow = (coords) => {
              const pts = coords.map(([lon,lat]) => latLonToVec3(lat, lon, 1.0025));
              if (pts.length > 1) scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), glowMat));
            };
            if (f.geometry?.type==="Polygon")      f.geometry.coordinates.forEach(r=>drawGlow(r));
            if (f.geometry?.type==="MultiPolygon") f.geometry.coordinates.forEach(p=>p.forEach(r=>drawGlow(r)));
          }
        });
        setReady(true);
      }).catch(()=>setReady(true));

    sceneRef.current = { ...sceneRef.current, renderer, scene, camera, globe };

    // Scroll to zoom
    const onWheel = (e) => {
      e.preventDefault();
      camera.position.z = Math.max(1.4, Math.min(4.5, camera.position.z + e.deltaY * 0.003));
    };
    el.addEventListener("wheel", onWheel, { passive: false });

    // Animation
    let frame = 0;
    const animate = () => {
      animRef.current = requestAnimationFrame(animate);
      frame++;
      if (!isDragging.current) rotation.current.y += 0.0010;
      globe.rotation.x = rotation.current.x;
      globe.rotation.y = rotation.current.y;
      [hotspotsGroup, eventsGroup, firesGroup, seismicGroup, arcsGroup].forEach(g => g.rotation.copy(globe.rotation));
      hotspotsGroup.children.forEach((mesh, i) => {
        if (mesh.userData.pulse) { const s = 1 + 0.28 * Math.sin(frame * 0.05 + i * 0.8); mesh.scale.setScalar(s); }
      });
      arcsGroup.children.forEach((line, i) => {
        if (line.material) line.material.opacity = 0.2 + 0.35 * Math.abs(Math.sin(frame * 0.018 + i * 1.2));
      });
      renderer.render(scene, camera);
    };

    // Mouse interaction
    const onMouseDown = (e) => { isDragging.current=true; lastMouse.current={x:e.clientX,y:e.clientY}; };
    const onMouseUp   = () => { isDragging.current=false; };
    const onMouseMove = (e) => {
      if (!isDragging.current) return;
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      rotation.current.y += dx * 0.005;
      rotation.current.x += dy * 0.005;
      rotation.current.x = Math.max(-1.2, Math.min(1.2, rotation.current.x));
      lastMouse.current={x:e.clientX,y:e.clientY};
    };
    el.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("mousemove", onMouseMove);

    return () => {
      cancelAnimationFrame(animRef.current);
      el.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("mousemove", onMouseMove);
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, []);

  // Update zone hotspots when zones or selection changes
  useEffect(() => {
    const { hotspotsGroup } = sceneRef.current;
    if (!hotspotsGroup) return;
    while (hotspotsGroup.children.length) hotspotsGroup.remove(hotspotsGroup.children[0]);

    const visZones = filter==="ALL" ? zones : zones.filter(z=>z.sev===filter);
    visZones.forEach(z => {
      const pos = latLonToVec3(z.lat, z.lon, 1.003);
      const col = new THREE.Color(SEV_COLOR[z.sev] || "#ffd60a");
      const isSel = selected?.id === z.id;

      // Glow ring
      const ringGeo = new THREE.RingGeometry(0.025, 0.045, 32);
      const ringMat = new THREE.MeshBasicMaterial({ color:col, transparent:true, opacity:isSel?0.9:0.35, side:THREE.DoubleSide });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.lookAt(pos.clone().multiplyScalar(2));
      ring.position.copy(pos);
      hotspotsGroup.add(ring);

      // Outer ring (selected)
      if (isSel) {
        const outerGeo = new THREE.RingGeometry(0.055, 0.07, 32);
        const outerMat = new THREE.MeshBasicMaterial({ color:col, transparent:true, opacity:0.5, side:THREE.DoubleSide });
        const outer = new THREE.Mesh(outerGeo, outerMat);
        outer.lookAt(pos.clone().multiplyScalar(2));
        outer.position.copy(pos);
        hotspotsGroup.add(outer);
      }

      // Center dot
      const dotGeo = new THREE.SphereGeometry(isSel?0.018:0.012, 8, 8);
      const dotMat = new THREE.MeshBasicMaterial({ color:col });
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.copy(pos);
      dot.userData = { zone:z, pulse:true };
      hotspotsGroup.add(dot);

      // Crosshair lines
      const lineMat = new THREE.LineBasicMaterial({ color:col, transparent:true, opacity:0.4 });
      const right = new THREE.Vector3().crossVectors(pos, new THREE.Vector3(0,1,0)).normalize();
      const up    = new THREE.Vector3().crossVectors(right, pos).normalize();
      [right, right.clone().negate(), up, up.clone().negate()].forEach((dir, i) => {
        const start = pos.clone().add(dir.clone().multiplyScalar(0.05));
        const end   = pos.clone().add(dir.clone().multiplyScalar(0.09));
        const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
        hotspotsGroup.add(new THREE.Line(geo, lineMat));
      });
    });
  }, [zones, selected, filter]);

  // Update ACLED events
  useEffect(() => {
    const { eventsGroup } = sceneRef.current;
    if (!eventsGroup) return;
    while (eventsGroup.children.length) eventsGroup.remove(eventsGroup.children[0]);
    if (!layers || !layers.events) return;
    acledEvents.slice(0, 500).forEach(e => {
      if (!e.lat || !e.lon) return;
      const pos = latLonToVec3(e.lat, e.lon, 1.004);
      const col = new THREE.Color(ACLED_COLORS[e.type] || "#636366");
      const r   = e.fatalities > 20 ? 0.007 : e.fatalities > 5 ? 0.005 : 0.003;
      const geo = new THREE.SphereGeometry(r, 4, 4);
      const mat = new THREE.MeshBasicMaterial({ color:col, transparent:true, opacity:0.6 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      eventsGroup.add(mesh);
    });
  }, [acledEvents, layers]);

  // Satellite fires layer
  useEffect(() => {
    const { firesGroup } = sceneRef.current;
    if (!firesGroup) return;
    while (firesGroup.children.length) firesGroup.remove(firesGroup.children[0]);
    if (!layers?.fires || !fires?.length) return;
    fires.slice(0, 2000).forEach(f => {
      if (!f.lat || !f.lon) return;
      const pos = latLonToVec3(f.lat, f.lon, 1.004);
      const frp = f.frp || 10;
      const col = frp > 100 ? new THREE.Color(0xff2d55) : frp > 40 ? new THREE.Color(0xff6b35) : new THREE.Color(0xff9f0a);
      const r   = 0.003 + Math.min(0.012, frp / 8000);
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 4, 4), new THREE.MeshBasicMaterial({ color:col, transparent:true, opacity:0.75 }));
      mesh.position.copy(pos);
      firesGroup.add(mesh);
    });
  }, [fires, layers]);

  // Seismic layer
  useEffect(() => {
    const { seismicGroup } = sceneRef.current;
    if (!seismicGroup) return;
    while (seismicGroup.children.length) seismicGroup.remove(seismicGroup.children[0]);
    if (!layers?.seismic || !quakes?.length) return;
    quakes.forEach(q => {
      if (!q.lat || !q.lon) return;
      const pos = latLonToVec3(q.lat, q.lon, 1.005);
      const col = q.mag >= 7 ? new THREE.Color(0xbf5af2) : q.mag >= 6 ? new THREE.Color(0xff2d55) : q.mag >= 5 ? new THREE.Color(0xff9f0a) : new THREE.Color(0xffd60a);
      const r   = 0.008 + (q.mag - 4.5) * 0.006;
      const ring = new THREE.Mesh(new THREE.RingGeometry(r*0.4, r, 16), new THREE.MeshBasicMaterial({ color:col, transparent:true, opacity:0.7, side:THREE.DoubleSide }));
      ring.lookAt(pos.clone().multiplyScalar(2));
      ring.position.copy(pos);
      seismicGroup.add(ring);
    });
  }, [quakes, layers]);

  // Proxy arcs visibility toggle
  useEffect(() => {
    const { arcsGroup } = sceneRef.current;
    if (arcsGroup) arcsGroup.visible = !!(layers?.arcs !== false);
  }, [layers]);


  // Load topojson
  useEffect(() => {
    if (window.topojson) return;
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/topojson/3.0.2/topojson.min.js";
    document.head.appendChild(s);
  }, []);

  return (
    <div style={{ position:"relative", width:"100%", height:"100%", cursor:"grab" }}>
      <div ref={mountRef} style={{ width:"100%", height:"100%" }}/>
      {!ready && (
        <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", pointerEvents:"none" }}>
          <span style={{ fontFamily:MONO, fontSize:10, color:"#1a3a1a", letterSpacing:3 }}>RENDERING GLOBE...</span>
        </div>
      )}
      <div style={{ position:"absolute", bottom:10, left:10, fontFamily:MONO, fontSize:7, color:"#1a3a1a", letterSpacing:2, pointerEvents:"none" }}>
        DRAG TO ROTATE · THREE.JS GLOBE · WORLDWIDERADAR.COM
      </div>
      {/* Corner brackets */}
      {[[0,0,"0 0"],[0,0,"90deg"],[0,0,"180deg"],[0,0,"270deg"]].map((_,i)=>(
        <div key={i} style={{ position:"absolute", width:20, height:20, ...[{top:8,left:8},{top:8,right:8},{bottom:8,left:8},{bottom:8,right:8}][i], pointerEvents:"none" }}>
          <svg width="20" height="20" viewBox="0 0 20 20">
            <path d={["M0,8 L0,0 L8,0","M12,0 L20,0 L20,8","M0,12 L0,20 L8,20","M12,20 L20,20 L20,12"][i]} fill="none" stroke="#00c864" strokeWidth="1.5" opacity="0.4"/>
          </svg>
        </div>
      ))}
    </div>
  );
}