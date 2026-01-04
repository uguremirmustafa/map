import { useEffect, useState, useRef } from 'react';
import './TurkeyMap.css';

interface Feature {
  type: string;
  geometry: {
    type: string;
    coordinates: number[][][] | number[][][][];
  };
  properties?: {
    name?: string;
    [key: string]: any;
  };
}

interface GeoJSONData {
  type: string;
  features: Feature[];
}

const TurkeyMap = () => {
  const [geoData, setGeoData] = useState<GeoJSONData | null>(null);
  const [hoveredProvince, setHoveredProvince] = useState<string | null>(null);
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    fetch('/tr.json')
      .then((response) => response.json())
      .then((data: GeoJSONData) => setGeoData(data))
      .catch((error) => console.error('Error loading map data:', error));
  }, []);

  if (!geoData) {
    return <div className="loading">Loading Turkey map...</div>;
  }

  // Calculate bounds for proper scaling
  const allCoords: number[][] = [];
  geoData.features.forEach((feature) => {
    const extractCoords = (coords: any): void => {
      if (typeof coords[0] === 'number') {
        allCoords.push(coords);
      } else {
        coords.forEach((c: any) => extractCoords(c));
      }
    };
    extractCoords(feature.geometry.coordinates);
  });

  const lons = allCoords.map((c) => c[0]);
  const lats = allCoords.map((c) => c[1]);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);

  // Calculate actual geographic range
  const lonRange = maxLon - minLon;
  const latRange = maxLat - minLat;

  // Apply latitude correction (1 degree of longitude is shorter as you go north)
  // Turkey is around 39° latitude
  const avgLat = (minLat + maxLat) / 2;
  const latCorrection = Math.cos((avgLat * Math.PI) / 180);
  const correctedLonRange = lonRange * latCorrection;

  // SVG dimensions - adjust based on actual proportions
  const maxWidth = 1200;
  const padding = 20;

  // Calculate dimensions maintaining aspect ratio
  const aspectRatio = correctedLonRange / latRange;
  const width = maxWidth;
  const height = width / aspectRatio;

  // Calculate scale
  const scaleX = (width - 2 * padding) / lonRange;
  const scaleY = (height - 2 * padding) / latRange;

  // Project coordinates
  const projectPoint = (lon: number, lat: number): [number, number] => {
    const x = (lon - minLon) * scaleX + padding;
    const y = (maxLat - lat) * scaleY + padding; // Flip Y axis
    return [x, y];
  };

  const coordinatesToPath = (coords: number[][][] | number[][][][]): string => {
    const processRing = (ring: number[][]): string => {
      return (
        ring
          .map((point, index) => {
            const [x, y] = projectPoint(point[0], point[1]);
            return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)},${y.toFixed(2)}`;
          })
          .join(' ') + ' Z'
      );
    };

    // Handle both Polygon and MultiPolygon
    if (
      coords.length > 0 &&
      Array.isArray(coords[0][0]) &&
      Array.isArray(coords[0][0][0])
    ) {
      // MultiPolygon
      const multiCoords = coords as number[][][][];
      return multiCoords
        .map((polygon) => polygon.map((ring) => processRing(ring)).join(' '))
        .join(' ');
    } else {
      // Polygon
      const polyCoords = coords as number[][][];
      return polyCoords.map((ring) => processRing(ring)).join(' ');
    }
  };

  return (
    <div className="turkey-map-container">
      <h2>Interactive Turkey Map</h2>
      {hoveredProvince && <div className="tooltip">{hoveredProvince}</div>}
      {selectedProvince && (
        <div className="info-panel">
          <h3>Selected Province</h3>
          <p>{selectedProvince}</p>
          <button onClick={() => setSelectedProvince(null)}>
            Clear Selection
          </button>
        </div>
      )}
      <div className="map-wrapper">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="turkey-map-svg"
          preserveAspectRatio="xMidYMid meet"
        >
          <g>
            {geoData.features.map((feature, index) => {
              const provinceName =
                feature.properties?.name || `Region ${index + 1}`;
              const pathData = coordinatesToPath(feature.geometry.coordinates);
              const isHovered = hoveredProvince === provinceName;
              const isSelected = selectedProvince === provinceName;

              return (
                <path
                  key={index}
                  d={pathData}
                  className={`province ${isHovered ? 'hovered' : ''} ${
                    isSelected ? 'selected' : ''
                  }`}
                  onMouseEnter={() => setHoveredProvince(provinceName)}
                  onMouseLeave={() => setHoveredProvince(null)}
                  onClick={() => setSelectedProvince(provinceName)}
                />
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
};

export default TurkeyMap;
