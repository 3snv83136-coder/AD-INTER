export type VideoFormat = "vertical" | "horizontal" | "square"

export type PhotoItem = {
  url: string
  caption?: string
}

export type InterventionVideoProps = {
  format: VideoFormat
  photos: PhotoItem[]
  clientNom?: string
  ville?: string
  typeIntervention?: string
  dateRealisee?: string
  enableMusic?: boolean
  musicVolume?: number
}

export const FORMAT_DIMENSIONS: Record<VideoFormat, { width: number; height: number }> = {
  vertical: { width: 1080, height: 1920 },
  horizontal: { width: 1920, height: 1080 },
  square: { width: 1080, height: 1080 },
}

export const FPS = 30

export const TIMINGS = {
  introFrames: 90,
  photoFrames: 120,
  photoCrossfadeFrames: 18,
  outroFrames: 180,
} as const

export const BRAND = {
  navy: "#0F1E3D",
  navyLight: "#1E3A5F",
  red: "#D63A3A",
  white: "#FFFFFF",
  yellow: "#FFC83D",
  slogan: "Débouchage d'urgence 24h/24 — 7j/7",
  tel: "0 805 55 35 55",
  site: "allodebouchage.com",
  zone: "Toute la France",
  logoUrl: "/images/logo.png",
  logoSmallUrl: "/icons/icon-512x512.png",
  camionUrl: "/images/logo.png",
  musicUrl: "https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3",
} as const
