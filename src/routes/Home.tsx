import { useEffect, useRef, useState } from "react";
import mapboxgl, { LngLatLike, Map, Marker, GeoJSONSource } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import { useLocation } from "react-router-dom";
import { toast } from "react-toastify";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

interface Polygon {
  id?: string;
  name: string;
  coordinates: [number, number][];
  session_id: string;
}

const Home = () => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const [map, setMap] = useState<Map | null>(null);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [selectMode, setSelectMode] = useState(false);
  const [polygonName, setPolygonName] = useState("");
  const [polygonId, setPolygonId] = useState<string | null>(null);
  const [polygonHistory, setPolygonHistory] = useState<Polygon[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("currentSession");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage] = useState<number>(5);
  const location = useLocation();

  useEffect(() => {
    const initializeSessionId = () => {
      const urlParams = new URLSearchParams(location.search);
      const sessionIdFromUrl = urlParams.get("session_id");
      if (sessionIdFromUrl) {
        setSessionId(sessionIdFromUrl);
      } else {
        const newSessionId = uuidv4();
        setSessionId(newSessionId);
      }
    };

    initializeSessionId();
  }, [location.search]);

  useEffect(() => {
    if (mapContainerRef.current && !map) {
      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: "mapbox://styles/mapbox/streets-v11",
        center: [-73.935242, 40.73061],
        zoom: 12,
      });

      map.on("load", () => {
        setMap(map);
        map.resize();
      });
    }
  }, [map]);

  /**
   * Fetches the polygon history from the server and updates the state.
   * If there's an error, it logs the error and sets the polygon history to an empty array.
   */
  useEffect(() => {
    const fetchPolygonHistory = async () => {
      if (!sessionId) return;
      try {
        const response = await axios.get("http://localhost:5000/polygons");
        const allPolygons = response.data;
        setPolygonHistory(allPolygons);
      } catch (error) {
        toast.error("Error fetching polygon history");
        setPolygonHistory([]);
      }
    };

    fetchPolygonHistory();
  }, [sessionId]);

  /**
   * Adds a point to the map and creates a marker at the given longitude and latitude.
   * @param {LngLatLike} lngLat - The longitude and latitude of the point to add.
   */
  const addPoint = (lngLat: LngLatLike) => {
    const point: [number, number] = Array.isArray(lngLat)
      ? lngLat
      : "lng" in lngLat
      ? [lngLat.lng, lngLat.lat]
      : [lngLat.lon, lngLat.lat];
    addMarker(point);
  };

  /**
   * Checks if the polygon coordinates are valid.
   * @param coordinates - The coordinates of the polygon.
   * @returns True if the polygon is valid, otherwise false.
   */
  const isValidPolygon = (coordinates: [number, number][]) => {
    return coordinates.length > 2;
  };

  useEffect(() => {
    if (map) {
      const handleMapClick = (
        e: mapboxgl.MapMouseEvent & { lngLat: mapboxgl.LngLat }
      ) => {
        if (selectMode) {
          addPoint(e.lngLat);
        }
      };

      map.on("click", handleMapClick);

      return () => {
        map.off("click", handleMapClick);
      };
    }
  }, [map, selectMode]);

  useEffect(() => {
    if (map) {
      if (selectMode) {
        map.dragPan.disable();
      } else {
        map.dragPan.enable();
      }
    }
  }, [map, selectMode]);

  /**
   * Updates the polygon source on the map with the current markers.
   * If there are more than two markers, it creates a polygon with the markers' coordinates.
   */
  const updatePolygonSource = () => {
    if (map && markers.length > 2) {
      const coordinates = markers.map(
        (marker) => marker.getLngLat().toArray() as [number, number]
      );
      const polygonCoordinates = [...coordinates, coordinates[0]]; // Close the polygon

      const source = map.getSource("polygon") as GeoJSONSource;
      if (source) {
        source.setData({
          type: "Feature",
          properties: {},
          geometry: {
            type: "Polygon",
            coordinates: [polygonCoordinates],
          },
        });
      } else {
        map.addSource("polygon", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "Polygon",
              coordinates: [polygonCoordinates],
            },
          },
        });
        map.addLayer({
          id: "polygon",
          type: "fill",
          source: "polygon",
          paint: {
            "fill-color": "#088",
            "fill-opacity": 0.8,
          },
        });
      }
    }
  };

  useEffect(() => {
    updatePolygonSource();
  }, [map, markers]);

  /**
   * Adds a draggable marker to the map at the specified longitude and latitude.
   * @param {[number, number]} lngLat - The longitude and latitude of the marker.
   */
  const addMarker = (lngLat: [number, number]) => {
    if (map) {
      const marker = new mapboxgl.Marker({ draggable: true })
        .setLngLat(lngLat)
        .addTo(map)
        .on("dragend", () => {
          updatePolygonSource();
          setMarkers((prevMarkers) =>
            prevMarkers.map((m) =>
              m.getLngLat().toArray().toString() === lngLat.toString()
                ? marker
                : m
            )
          );
        });
      setMarkers((prevMarkers) => [...prevMarkers, marker]);
    }
  };

  /**
   * Clears the current polygon, markers, and map sources.
   */
  const clearPolygon = () => {
    setPolygonId(null);
    setPolygonName("");
    setSelectMode(false);
    markers.forEach((marker) => marker.remove());
    setMarkers([]);
    if (map) {
      const source = map.getSource("polygon");
      if (source) {
        map.removeLayer("polygon");
        map.removeSource("polygon");
      }
    }
  };

  /**
   * Saves or updates a polygon on the server.
   */
  const savePolygon = async () => {
    const coordinates = markers.map(
      (marker) => marker.getLngLat().toArray() as [number, number]
    );
    if (isValidPolygon(coordinates) && polygonName) {
      const newPolygon = {
        id: polygonId || undefined,
        name: polygonName,
        coordinates: coordinates,
        sessionId: sessionId || "",
      };
      try {
        const response = await axios({
          method: polygonId ? "PUT" : "POST",
          url: `http://localhost:5000/polygons/${polygonId || ""}`,
          headers: {
            "Content-Type": "application/json",
          },
          data: JSON.stringify(newPolygon),
        });
        const data = response.data;
        const savedPolygon = data.polygon;
        if (polygonId) {
          setPolygonHistory((prevHistory) =>
            prevHistory.map((p) => (p.id === polygonId ? savedPolygon : p))
          );
        } else {
          setPolygonHistory((prevHistory) => [...prevHistory, savedPolygon]);
        }
        setPolygonName("");
        setPolygonId(null);
        clearPolygon();
      } catch (error) {
        toast.error("Error saving polygon");
      }
    } else {
      toast.error("Invalid polygon or missing name");
    }
  };

  /**
   * Deletes a polygon by its ID.
   * @param id - The ID of the polygon to delete.
   */
  const deletePolygon = async (id: string) => {
    try {
      const response = await axios.delete(
        `http://localhost:5000/polygons/${id}`
      );
      if (response.status !== 200) {
        throw new Error("Network response was not ok");
      }
      setPolygonHistory((prevHistory) =>
        prevHistory.filter((polygon) => polygon.id !== id)
      );
    } catch (error) {
      toast.error("Error deleting polygon");
    }
  };

  /**
   * Toggles between select mode on and off.
   */
  const toggleSelectMode = () => {
    setSelectMode((prevSelectMode) => !prevSelectMode);
  };

  /**
   * Displays a polygon on the map.
   * @param polygon - The polygon to display.
   */
  const showPolygon = (polygon: Polygon) => {
    clearPolygon();
    setPolygonName(polygon.name);
    setPolygonId(polygon.id || null);
    if (map) {
      const coordinates = polygon.coordinates;
      coordinates.forEach((coord) => addMarker(coord));
      updatePolygonSource();
    }
  };

  const getPolygonsForCurrentSession = () => {
    return polygonHistory.filter((polygon) => polygon.session_id === sessionId);
  };

  // Pagination logic
  const indexOfLastPolygon = currentPage * itemsPerPage;
  const indexOfFirstPolygon = indexOfLastPolygon - itemsPerPage;
  const currentPolygons = polygonHistory.slice(
    indexOfFirstPolygon,
    indexOfLastPolygon
  );
  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-screen bg-gray-100 p-4">
      <div
        ref={mapContainerRef}
        className="h-96 w-full max-w-4xl mb-4 border border-gray-300 shadow-lg"
      />
      <div className="flex flex-wrap items-center justify-center space-x-4 mb-4">
        <button
          onClick={toggleSelectMode}
          className="px-4 py-2 bg-blue-600 text-white rounded shadow"
        >
          {selectMode ? "Disable Add Points Mode" : "Enable Add Points Mode"}
        </button>
        <button
          onClick={clearPolygon}
          className="px-4 py-2 bg-red-600 text-white rounded shadow"
        >
          Clear Polygon
        </button>
        <input
          type="text"
          value={polygonName}
          onChange={(e) => setPolygonName(e.target.value)}
          placeholder="Polygon Name"
          className="px-4 py-2 border border-gray-300 rounded shadow"
        />
        <button
          onClick={savePolygon}
          className="px-4 py-2 bg-green-600 text-white rounded shadow"
        >
          {polygonId ? "Save Polygon" : "Create Polygon"}
        </button>
      </div>
      <div className="w-full max-w-4xl bg-white rounded shadow-lg p-4">
        <h2 className="text-xl font-semibold mb-2">Polygons</h2>
        <div className="flex mb-4 border-b-[1px] border-gray-300">
          <button
            className={`px-4 py-2 rounded-tl-lg ${
              activeTab === "currentSession"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-800"
            } transition-colors duration-200 ease-in-out`}
            onClick={() => setActiveTab("currentSession")}
          >
            Current Session Polygons
          </button>
          <button
            className={`px-4 py-2 rounded-tr-lg ${
              activeTab === "allPolygons"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-800"
            } transition-colors duration-200 ease-in-out`}
            onClick={() => setActiveTab("allPolygons")}
          >
            All Polygons
          </button>
        </div>
        <div className="mt-4">
          {activeTab === "currentSession" ? (
            <div className="grid grid-cols-1 gap-4">
              {getPolygonsForCurrentSession().length > 0 ? (
                getPolygonsForCurrentSession().map((polygon) => (
                  <div
                    key={polygon.id}
                    className={`flex items-center justify-between p-4 border rounded shadow hover:bg-gray-200 cursor-pointer ${
                      polygon.id === polygonId
                        ? "bg-blue-100 border-blue-500"
                        : ""
                    }`}
                    onClick={() => showPolygon(polygon)}
                  >
                    <h3 className="text-lg font-semibold">{polygon.name}</h3>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deletePolygon(polygon.id!);
                      }}
                      className="px-2 py-1 bg-red-500 text-white rounded"
                    >
                      Delete
                    </button>
                  </div>
                ))
              ) : (
                <div>No polygons found for this session</div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {currentPolygons.length > 0 ? (
                currentPolygons.map((polygon) => (
                  <div
                    key={polygon.id}
                    className={`flex items-center justify-between p-4 border rounded shadow hover:bg-gray-200 cursor-pointer ${
                      polygon.id === polygonId
                        ? "bg-blue-100 border-blue-500"
                        : ""
                    }`}
                    onClick={() => showPolygon(polygon)}
                  >
                    <h3 className="text-lg font-semibold">{polygon.name}</h3>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deletePolygon(polygon.id!);
                      }}
                      className="px-2 py-1 bg-red-500 text-white rounded"
                    >
                      Delete
                    </button>
                  </div>
                ))
              ) : (
                <div>No polygons found</div>
              )}
            </div>
          )}
        </div>
        {activeTab === "allPolygons" && (
          <div className="flex justify-center mt-4">
            {Array.from(
              { length: Math.ceil(polygonHistory.length / itemsPerPage) },
              (_, index) => (
                <button
                  key={index + 1}
                  onClick={() => paginate(index + 1)}
                  className={`px-3 py-1 mx-1 rounded ${
                    currentPage === index + 1
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-800"
                  }`}
                >
                  {index + 1}
                </button>
              )
            )}
          </div>
        )}
      </div>
      {sessionId && (
        <div className="mt-4 flex flex-col items-center">
          <p>Share this link to view the polygons for this session:</p>
          <a
            href={`${window.location.origin}/?session_id=${sessionId}`}
            className="text-blue-600 underline"
          >
            {window.location.origin}/?session_id={sessionId}
          </a>
        </div>
      )}
    </div>
  );
};

export default Home;
