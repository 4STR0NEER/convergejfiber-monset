// Is this machine too weak for the always-moving 3D map? Checked once per session.

// ponytail: GPU name match, add names here as clients report slow machines
const WEAK_RENDERER = /swiftshader|llvmpipe|softpipe|basic render|intel.*hd graphics|gma/i

export const isWeakRenderer = (renderer: string) => WEAK_RENDERER.test(renderer)

let cached: boolean | undefined

export function lowPowerGpu(): boolean {
  if (cached !== undefined) return cached
  try {
    // Fails when the browser would fall back to software rendering (no GPU, or hardware acceleration off).
    const gl = document.createElement('canvas').getContext('webgl', { failIfMajorPerformanceCaveat: true })
    if (!gl) return (cached = true)
    const info = gl.getExtension('WEBGL_debug_renderer_info')
    const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : ''
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    const memory = (navigator as { deviceMemory?: number }).deviceMemory // Chrome and Edge only
    return (cached = isWeakRenderer(renderer) || navigator.hardwareConcurrency <= 4 || (memory !== undefined && memory <= 4))
  } catch {
    return (cached = true)
  }
}
