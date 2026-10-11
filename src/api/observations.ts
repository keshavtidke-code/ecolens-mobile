import { TIMEOUTS } from "@/config/env";
import { apiUrl, http } from "./client";
import { tokenStore } from "./tokenStore";
import type {
  Analysis,
  CreateObservationInput,
  LearningExperience,
  LearningRequest,
  Observation,
  ObservationDetail,
  ObservationStatusInfo,
  Page,
  WeatherPreview,
} from "./types";

/** Lets callers abort an in-flight request (screen left / user pressed stop). */
export interface RequestOptions {
  signal?: AbortSignal;
}

export const observationsApi = {
  /** POST /observations (multipart). The backend reverse-geocodes and fetches weather on capture. */
  async create(input: CreateObservationInput, options: RequestOptions = {}): Promise<ObservationDetail> {
    const form = new FormData();
    // React Native's FormData accepts { uri, name, type } for files.
    form.append("photo", { uri: input.photoUri, name: "observation.jpg", type: "image/jpeg" } as unknown as Blob);
    form.append("latitude", String(input.latitude));
    form.append("longitude", String(input.longitude));
    form.append("captured_at", input.capturedAt);
    form.append("photo_source", input.photoSource ?? "camera");
    if (input.locationAccuracyM != null) form.append("location_accuracy_m", String(input.locationAccuracyM));
    if (input.userNote?.trim()) form.append("user_note", input.userNote.trim());
    const { data } = await http.post<ObservationDetail>("/observations", form, {
      timeout: TIMEOUTS.upload,
      signal: options.signal,
      headers: { "Content-Type": "multipart/form-data" },
      transformRequest: (body) => body, // keep RN FormData untouched
    });
    return data;
  },

  async list(params: { limit?: number; cursor?: number | null; status?: string } = {}): Promise<Page<Observation>> {
    const { data } = await http.get<Page<Observation>>("/observations", {
      params: { limit: params.limit ?? 20, cursor: params.cursor ?? undefined, status: params.status },
    });
    return data;
  },

  async get(id: number): Promise<ObservationDetail> {
    const { data } = await http.get<ObservationDetail>(`/observations/${id}`);
    return data;
  },

  async status(id: number, options: RequestOptions = {}): Promise<ObservationStatusInfo> {
    const { data } = await http.get<ObservationStatusInfo>(`/observations/${id}/status`, { signal: options.signal });
    return data;
  },

  /** Synchronous Gemini vision analysis (5-30 s). */
  async analyze(id: number, options: RequestOptions = {}): Promise<Analysis> {
    const { data } = await http.post<Analysis>(`/observations/${id}/analyze`, undefined, {
      timeout: TIMEOUTS.analyze,
      signal: options.signal,
    });
    return data;
  },

  /** Lesson + challenge + action. Idempotent: repeating the call returns the stored result (meta.reused). */
  async learningExperience(
    id: number,
    body?: LearningRequest,
    regenerate = false,
    options: RequestOptions = {},
  ): Promise<LearningExperience> {
    const { data } = await http.post<LearningExperience>(`/observations/${id}/learning-experience`, body ?? {}, {
      params: regenerate ? { regenerate: true } : undefined,
      timeout: TIMEOUTS.learning,
      signal: options.signal,
    });
    return data;
  },

  async refreshContext(id: number): Promise<ObservationDetail> {
    const { data } = await http.post<ObservationDetail>(`/observations/${id}/refresh-context`);
    return data;
  },

  async remove(id: number): Promise<void> {
    await http.delete(`/observations/${id}`);
  },

  /** Image props for <Image source=...>: the photo endpoint requires the bearer token. */
  photoSource(photoUrl: string | null | undefined): { uri: string; headers: Record<string, string> } | null {
    if (!photoUrl) return null;
    const tokens = tokenStore.get();
    return { uri: apiUrl(photoUrl), headers: tokens ? { Authorization: `Bearer ${tokens.access_token}` } : {} };
  },
};

export const weatherApi = {
  /** Strict preview (nothing saved). 502/504 name the failing provider. */
  async preview(lat: number, lon: number, at?: string): Promise<WeatherPreview> {
    const { data } = await http.get<WeatherPreview>("/weather/preview", { params: { lat, lon, at } });
    return data;
  },
};
