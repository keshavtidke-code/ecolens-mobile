/** Type-safe mirror of the EcoLens FastAPI contracts (backend/app/schemas/*). Timestamps are ISO-8601 strings. */

export type ObservationStatus = "pending" | "analyzing" | "complete" | "failed";
export type PhotoSource = "camera" | "gallery";
export type KnowledgeLevel = "beginner" | "intermediate" | "advanced";
export type ChallengeStatus = "open" | "in_progress" | "completed" | "skipped";
export type ImpactLevel = "low" | "medium" | "high";
export type ActionCategory =
  | "conservation"
  | "water"
  | "biodiversity"
  | "waste_reduction"
  | "citizen_science"
  | "awareness";

// ---------- errors ----------
/** Every backend failure has this body. */
export interface ApiErrorBody {
  code: string;
  message: string;
  details: unknown;
  request_id: string | null;
}

// ---------- auth ----------
export interface User {
  id: number;
  email: string | null;
  display_name: string | null;
  is_anonymous: boolean;
  created_at: string;
}
export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}
export interface AuthResponse {
  user: User;
  tokens: TokenPair;
}
export interface LoginRequest {
  email: string;
  password: string;
}
export interface RegisterRequest extends LoginRequest {
  display_name?: string | null;
}

// ---------- weather / location ----------
export interface WeatherMeasurements {
  temperature_c: number | null;
  feels_like_c: number | null;
  humidity_pct: number | null;
  precipitation_mm: number | null;
  rain_last_24h_mm: number | null;
  wind_speed_kmh: number | null;
  wind_direction_deg: number | null;
  cloud_cover_pct: number | null;
  uv_index: number | null;
  pressure_hpa: number | null;
  soil_moisture: number | null;
  weather_code: number | null;
}
export interface WeatherSnapshot extends WeatherMeasurements {
  id: number;
  provider: string;
  observed_at: string;
}
export interface PlaceInfo {
  place_name: string | null;
  region: string | null;
  country: string | null;
}
export interface WeatherPreview {
  location: PlaceInfo;
  weather: WeatherMeasurements & { provider: string; observed_at: string };
}

// ---------- perception (Analysis.perception_json) ----------
export type WaterPresence =
  | "none" | "damp_ground" | "puddle" | "stream" | "pond_or_lake" | "river" | "coastal_or_sea" | "wetland" | "unclear";
export type SoilCondition =
  | "not_visible" | "dry" | "moist" | "waterlogged" | "compacted_or_bare" | "sandy_or_rocky" | "paved_over" | "rich_organic";
export type VegetationDensity = "none" | "sparse" | "moderate" | "dense" | "very_dense";

export interface Perception {
  ecosystem_type: string;
  ecosystem_confidence: number;
  visible_elements: string[];
  flora: string[];
  fauna: string[];
  water_presence: WaterPresence;
  soil_condition: SoilCondition;
  vegetation_density: VegetationDensity;
  human_impact: string[];
  environmental_pressures: string[];
  interesting_observations: string[];
  confidence: number;
}

export interface Analysis {
  id: number;
  observation_id: number;
  model_name: string;
  prompt_version: string;
  habitat_type: string | null;
  habitat_confidence: number | null;
  summary: string | null;
  perception_json: Perception | null;
  season_context: string | null;
  created_at: string;
}

// ---------- observations ----------
export interface Observation {
  id: number;
  captured_at: string;
  latitude: number;
  longitude: number;
  location_accuracy_m: number | null;
  place_name: string | null;
  region: string | null;
  country: string | null;
  photo_source: PhotoSource;
  status: ObservationStatus;
  user_note: string | null;
  created_at: string;
  updated_at: string;
  /** Relative path, e.g. /api/v1/observations/12/photo. Requires the bearer token. */
  photo_url: string | null;
}
export interface ObservationStatusInfo {
  id: number;
  status: ObservationStatus;
  failure_reason: string | null;
}

/** Fields sent as multipart/form-data to POST /observations. */
export interface CreateObservationInput {
  photoUri: string;
  latitude: number;
  longitude: number;
  capturedAt: string;
  locationAccuracyM?: number | null;
  photoSource?: PhotoSource;
  userNote?: string | null;
}

// ---------- learning ----------
export interface Lesson {
  id: number;
  title: string;
  ecosystem_summary: string;
  what_you_are_seeing: string;
  why_it_matters: string;
  weather_connection: string;
  interesting_fact: string;
  key_concepts: string[];
  knowledge_level: string | null;
  created_at: string;
}
export interface Challenge {
  id: number;
  title: string;
  description: string | null;
  instructions: string[];
  estimated_minutes: number | null;
  success_question: string | null;
  status: string;
}
export interface RecommendedAction {
  id: number;
  title: string;
  description: string | null;
  category: string | null;
  impact_level: string | null;
  status: string;
}
export interface LearningMeta {
  analysis_id: number;
  prompt_version: string | null;
  model: string | null;
  cautious_mode: boolean;
  weather_available: boolean;
  reused: boolean;
}
export interface LearningExperience {
  lesson: Lesson;
  challenge: Challenge;
  recommended_action: RecommendedAction;
  meta: LearningMeta;
}
export interface LearningRequest {
  knowledge_level?: KnowledgeLevel;
  interests?: string[];
}

/** GET /observations/{id}: the observation plus whatever stages have run. */
export interface ObservationDetail extends Observation {
  weather_snapshot: WeatherSnapshot | null;
  analysis: Analysis | null;
  lesson: { id: number; title: string } | null;
}

// ---------- journal ----------
export interface JournalEntry {
  id: number;
  observation_id: number;
  title: string;
  personal_notes: string | null;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
  observation: Observation;
}
export interface JournalCreate {
  observation_id: number;
  title: string;
  personal_notes?: string | null;
  is_favorite?: boolean;
}
export interface JournalUpdate {
  title?: string;
  personal_notes?: string | null;
  is_favorite?: boolean;
}

// ---------- chat ----------
export type ChatRole = "user" | "assistant";
export interface ChatMessage {
  id: number;
  role: ChatRole;
  content: string;
  created_at: string;
}
export interface ChatMeta {
  model: string;
  prompt_version: string;
  attempts: number;
  tokens_used: number | null;
  latency_ms: number;
}
export interface ChatExchange {
  thread_id: number;
  user_message: ChatMessage;
  assistant_message: ChatMessage;
  meta: ChatMeta;
}
export interface ChatHistory {
  thread_id: number | null;
  messages: ChatMessage[];
}

// ---------- generic ----------
export interface Page<T> {
  items: T[];
  next_cursor: number | null;
}
export interface Health {
  status: string;
  version: string;
  environment: string;
}
