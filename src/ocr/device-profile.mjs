export async function collectDeviceProfile(scope = globalThis) {
  const navigatorObject = scope.navigator || {};
  let webgpu = false;
  try {
    webgpu = Boolean(navigatorObject.gpu && await navigatorObject.gpu.requestAdapter());
  } catch {}

  return {
    capturedAt: new Date().toISOString(),
    userAgent: String(navigatorObject.userAgent || ''),
    platform: String(navigatorObject.platform || ''),
    language: String(navigatorObject.language || ''),
    logicalProcessors: Number(navigatorObject.hardwareConcurrency) || null,
    deviceMemoryGiB: Number(navigatorObject.deviceMemory) || null,
    maxTouchPoints: Number(navigatorObject.maxTouchPoints) || 0,
    viewport: scope.innerWidth && scope.innerHeight ? { width: scope.innerWidth, height: scope.innerHeight, dpr: scope.devicePixelRatio || 1 } : null,
    webgpu,
    crossOriginIsolated: Boolean(scope.crossOriginIsolated)
  };
}

export function createRunTelemetry({
  engine,
  method,
  pageNumber,
  width,
  height,
  durationMs,
  preprocessingMs = null,
  confidence = null,
  wordCount = null,
  warningCount = 0,
  heapBeforeBytes = null,
  heapAfterBytes = null
} = {}) {
  return {
    engine: String(engine || ''),
    method: String(method || ''),
    pageNumber: Number.isInteger(pageNumber) ? pageNumber : null,
    width: Number(width) || null,
    height: Number(height) || null,
    durationMs: Number.isFinite(durationMs) ? durationMs : null,
    preprocessingMs: Number.isFinite(preprocessingMs) ? preprocessingMs : null,
    confidence: Number.isFinite(confidence) ? confidence : null,
    wordCount: Number.isInteger(wordCount) ? wordCount : null,
    warningCount: Number.isInteger(warningCount) ? warningCount : 0,
    heapDeltaBytes: Number.isFinite(heapBeforeBytes) && Number.isFinite(heapAfterBytes) ? heapAfterBytes - heapBeforeBytes : null
  };
}
