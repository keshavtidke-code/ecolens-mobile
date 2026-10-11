import type { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";

type IconName = ComponentProps<typeof Ionicons>["name"];

/** WMO weather codes (Open-Meteo), same table the backend uses. */
const WMO: Record<number, { label: string; icon: IconName }> = {
  0: { label: "Clear sky", icon: "sunny" },
  1: { label: "Mainly clear", icon: "partly-sunny" },
  2: { label: "Partly cloudy", icon: "partly-sunny" },
  3: { label: "Overcast", icon: "cloudy" },
  45: { label: "Fog", icon: "cloud" },
  48: { label: "Freezing fog", icon: "cloud" },
  51: { label: "Light drizzle", icon: "rainy" },
  53: { label: "Drizzle", icon: "rainy" },
  55: { label: "Dense drizzle", icon: "rainy" },
  56: { label: "Freezing drizzle", icon: "rainy" },
  57: { label: "Freezing drizzle", icon: "rainy" },
  61: { label: "Slight rain", icon: "rainy" },
  63: { label: "Rain", icon: "rainy" },
  65: { label: "Heavy rain", icon: "rainy" },
  66: { label: "Freezing rain", icon: "rainy" },
  67: { label: "Freezing rain", icon: "rainy" },
  71: { label: "Slight snow", icon: "snow" },
  73: { label: "Snow", icon: "snow" },
  75: { label: "Heavy snow", icon: "snow" },
  77: { label: "Snow grains", icon: "snow" },
  80: { label: "Rain showers", icon: "rainy" },
  81: { label: "Rain showers", icon: "rainy" },
  82: { label: "Violent showers", icon: "thunderstorm" },
  85: { label: "Snow showers", icon: "snow" },
  86: { label: "Heavy snow showers", icon: "snow" },
  95: { label: "Thunderstorm", icon: "thunderstorm" },
  96: { label: "Thunderstorm, hail", icon: "thunderstorm" },
  99: { label: "Thunderstorm, hail", icon: "thunderstorm" },
};

export function describeWeather(code: number | null | undefined): { label: string; icon: IconName } {
  return (code != null && WMO[code]) || { label: "Weather", icon: "partly-sunny" };
}
