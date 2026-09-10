/**
 * createLoop — ігровий цикл поверх event loop браузера.
 *
 * JavaScript однопотоковий: поки виконується функція, нічого іншого
 * (кліки, таймери, малювання сторінки) не станеться. Браузер не викликає
 * наші колбеки "паралельно" — він кладе їх у чергу і забирає, коли стек порожній.
 *
 * requestAnimationFrame(frame) каже браузеру: "виклич frame прямо перед
 * наступним paint". Це не setInterval(16): кадр синхронізований з монітором,
 * паузиться на фоновій вкладці, і now — точний timestamp.
 *
 * Симуляція йде фіксованим кроком (60 разів на секунду), а малювання —
 * стільки разів, скільки герців у екрана. Тому корабель не летить швидше
 * на 120 Hz. alpha — наскільки ми "між" двома кроками симуляції (0..1).
 */
export function createLoop({ step = 1 / 60, simulate, render } = {}) {
  let rafId = 0
  let running = false
  let last = 0
  let accumulator = 0

  let stepsThisSecond = 0
  let framesThisSecond = 0
  let stepsPerSecond = 0
  let framesPerSecond = 0
  let frameTimeMs = 0
  let statsAt = 0

  function frame(now) {
    const dt = last === 0 ? 0 : (now - last) / 1000
    last = now
    frameTimeMs = dt * 1000

    accumulator += Math.min(dt, 0.25)

    while (accumulator >= step) {
      simulate(step)
      accumulator -= step
      stepsThisSecond += 1
    }

    render(accumulator / step, {
      stepsPerSecond,
      framesPerSecond,
      frameTimeMs,
    })
    framesThisSecond += 1

    if (now - statsAt >= 1000) {
      stepsPerSecond = stepsThisSecond
      framesPerSecond = framesThisSecond
      stepsThisSecond = 0
      framesThisSecond = 0
      statsAt = now
    }

    rafId = requestAnimationFrame(frame)
  }

  return {
    start() {
      if (running) return
      running = true
      last = 0
      accumulator = 0
      statsAt = 0
      rafId = requestAnimationFrame(frame)
    },
    stop() {
      running = false
      cancelAnimationFrame(rafId)
    },
    isRunning: () => running,
  }
}
