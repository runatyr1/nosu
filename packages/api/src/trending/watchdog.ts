export interface StalledBuild {
  stage: string
  elapsedMs: number
  timeoutMs: number
}

/** A timed-out build must terminate its worker; starting another would overlap writes. */
export class BuildWatchdog {
  private timer: ReturnType<typeof setInterval> | undefined
  private startedAt = 0
  private stage = ''

  constructor(
    private readonly timeoutMs: number,
    private readonly onStall: (details: StalledBuild) => void,
  ) {}

  begin(stage: string): void {
    this.stop()
    this.startedAt = Date.now()
    this.stage = stage
    this.timer = setInterval(() => {
      const elapsedMs = Date.now() - this.startedAt
      if (elapsedMs < this.timeoutMs) return
      this.stop()
      this.onStall({ stage: this.stage, elapsedMs, timeoutMs: this.timeoutMs })
    }, Math.min(30_000, this.timeoutMs))
  }

  progress(stage: string): void {
    this.stage = stage
  }

  stop(): void {
    if (this.timer !== undefined) clearInterval(this.timer)
    this.timer = undefined
  }
}
