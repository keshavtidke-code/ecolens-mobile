import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

interface MapTilerMapProps {
  latitude: number;
  longitude: number;
  /** Map height in pixels, default 200 */
  height?: number;
}

const MAPTILER_KEY = "881teNl5bQ0wXMFKLvj7";
const STYLE_URL = `https://api.maptiler.com/maps/base-v4/style.json?key=${MAPTILER_KEY}`;

function buildMapHtml(lat: number, lng: number): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
  <link rel="stylesheet" href="https://cdn.maptiler.com/maptiler-sdk-js/v3/maptiler-sdk.css" />
  <script src="https://cdn.maptiler.com/maptiler-sdk-js/v3/maptiler-sdk.umd.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #map { width: 100%; height: 100%; overflow: hidden; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    maptilersdk.config.apiKey = "${MAPTILER_KEY}";
    const map = new maptilersdk.Map({
      container: "map",
      style: "${STYLE_URL}",
      center: [${lng}, ${lat}],
      zoom: 14,
      attributionControl: false,
      navigationControl: false,
    });

    let marker;
    map.on("load", () => {
      marker = new maptilersdk.Marker({ color: "#16a34a", scale: 1.2 })
        .setLngLat([${lng}, ${lat}])
        .addTo(map);
    });

    // Called from React Native to update the pin position
    window.updateLocation = function(lat, lng) {
      if (marker) {
        marker.setLngLat([lng, lat]);
        map.flyTo({ center: [lng, lat], zoom: 14, duration: 1000 });
      }
    };
  </script>
</body>
</html>`;
}

/**
 * Embeds a MapTiler GL map via WebView. Updates the marker whenever
 * latitude/longitude props change.
 */
export default function MapTilerMap({ latitude, longitude, height = 200 }: MapTilerMapProps) {
  const webViewRef = useRef<WebView>(null);
  const [html] = useState(() => buildMapHtml(latitude, longitude));

  useEffect(() => {
    // Push updated coordinates to the running map
    webViewRef.current?.injectJavaScript(
      `window.updateLocation(${latitude}, ${longitude}); true;`
    );
  }, [latitude, longitude]);

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        ref={webViewRef}
        originWhitelist={["*"]}
        source={{ html }}
        style={styles.map}
        scrollEnabled={false}
        javaScriptEnabled
        domStorageEnabled
        // Allow loading CDN assets
        mixedContentMode="always"
        allowsInlineMediaPlayback
        onError={(e) => console.warn("[MapTilerMap] WebView error:", e.nativeEvent.description)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#e2e8f0",
  },
  map: {
    flex: 1,
    backgroundColor: "transparent",
  },
});
