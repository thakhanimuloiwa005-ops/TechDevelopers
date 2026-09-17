import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from "react-leaflet";
import { useEffect } from "react";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

interface LocationPoint {
  latitude: number;
  longitude: number;
  capturedAt: string;
}

function RecenterOnUpdate({ position }: { position: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(position, map.getZoom(), { duration: 0.8 });
  }, [position, map]);
  return null;
}

export function IncidentMap({ locations }: { locations: LocationPoint[] }) {
  if (locations.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-lg border border-dashed border-slate-300 text-sm text-slate-400">
        Location not yet available
      </div>
    );
  }

  const latest = locations[locations.length - 1];
  const path = locations.map((l) => [l.latitude, l.longitude] as [number, number]);

  return (
    <div className="h-72 overflow-hidden rounded-lg border border-slate-200">
      <MapContainer center={[latest.latitude, latest.longitude]} zoom={15} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {path.length > 1 && <Polyline positions={path} color="#dc2626" weight={3} opacity={0.6} />}
        <RecenterOnUpdate position={[latest.latitude, latest.longitude]} />
        <Marker position={[latest.latitude, latest.longitude]}>
          <Popup>
            Last known location (SIMULATED GPS)
            <br />
            {new Date(latest.capturedAt).toLocaleTimeString()}
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
