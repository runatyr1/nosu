import { afterEach, describe, expect, it, vi } from 'vitest'
import { BuildWatchdog } from './watchdog'

afterEach(() => vi.useRealTimers())

describe('Trending build watchdog', () => {
  it('reports the blocked stage once when a build never completes', () => {
    vi.useFakeTimers()
    const restart = vi.fn()
    const watchdog = new BuildWatchdog(60_000, restart)
    watchdog.begin('candidate index')
    vi.advanceTimersByTime(30_000)
    watchdog.progress('4h: recount pass 2')
    vi.advanceTimersByTime(30_000)
    expect(restart).toHaveBeenCalledWith({ stage: '4h: recount pass 2', elapsedMs: 60_000, timeoutMs: 60_000 })
    vi.advanceTimersByTime(120_000)
    expect(restart).toHaveBeenCalledTimes(1)
  })

  it('does not restart completed builds or a stopped worker', () => {
    vi.useFakeTimers()
    const restart = vi.fn()
    const watchdog = new BuildWatchdog(60_000, restart)
    watchdog.begin('building')
    vi.advanceTimersByTime(30_000)
    watchdog.stop()
    vi.advanceTimersByTime(120_000)
    expect(restart).not.toHaveBeenCalled()
    watchdog.begin('next build')
    vi.advanceTimersByTime(30_000)
    expect(restart).not.toHaveBeenCalled()
    watchdog.stop()
  })

  it('detects an expired build after a wall-clock jump such as host resume', () => {
    vi.useFakeTimers()
    const restart = vi.fn()
    const watchdog = new BuildWatchdog(60_000, restart)
    watchdog.begin('resolving')
    vi.setSystemTime(Date.now() + 3_600_000)
    vi.advanceTimersByTime(30_000)
    expect(restart).toHaveBeenCalledOnce()
    watchdog.stop()
  })
})
