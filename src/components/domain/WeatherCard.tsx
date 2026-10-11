import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Text, View } from "react-native";
import type { WeatherMeasurements } from "@/api";
import { Card } from "@/components/ui";
import { colors } from "@/theme/colors";
import { num } from "@/utils/format";
import { describeWeather } from "@/utils/weather";

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View className="w-1/3 py-2">
      <Text className="text-xs uppercase text-ink-faint">{label}</Text>
      <Text className="text-base font-semibold text-ink">{value}</Text>
    </View>
  );
}

export function WeatherCard({ weather, title = "Weather" }: { weather: WeatherMeasurements; title?: string }) {
  const { label, icon } = describeWeather(weather.weather_code);
  return (
    <Card>
      <View className="flex-row items-center gap-3">
        <Ionicons name={icon} size={36} color={colors.brand} />
        <View className="flex-1">
          <Text className="text-xs uppercase text-ink-faint">{title}</Text>
          <Text className="text-lg font-bold text-ink">
            {label}
            {weather.temperature_c != null ? ` · ${weather.temperature_c.toFixed(0)}°C` : ""}
          </Text>
        </View>
      </View>
      <View className="mt-2 flex-row flex-wrap">
        <Metric label="Humidity" value={num(weather.humidity_pct, "%")} />
        <Metric label="Rain 24h" value={num(weather.rain_last_24h_mm, " mm", 1)} />
        <Metric label="Wind" value={num(weather.wind_speed_kmh, " km/h")} />
        <Metric label="Clouds" value={num(weather.cloud_cover_pct, "%")} />
        <Metric label="UV" value={num(weather.uv_index, "", 1)} />
        <Metric label="Feels like" value={num(weather.feels_like_c, "°C")} />
      </View>
    </Card>
  );
}
