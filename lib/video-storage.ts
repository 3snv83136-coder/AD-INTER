import fs from "node:fs/promises"
import { uploadBlob, blobPaths } from "./storage"

export async function uploadVideoToStorage(opts: {
  filePath: string
  storagePath: string
}): Promise<string> {
  const buffer = await fs.readFile(opts.filePath)
  const parts = opts.storagePath.split('/')
  const interventionId = parts[0] || 'unknown'
  const filename = parts.slice(1).join('/') || 'video.mp4'
  return uploadBlob({
    pathname: blobPaths.video(interventionId, filename),
    body: buffer,
    contentType: "video/mp4",
  })
}
