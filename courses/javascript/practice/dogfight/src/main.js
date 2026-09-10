import './style.css'
import { createLoop } from './loop.js'
import { createInput } from './input.js'
import { cloneShip, createShip, integrate } from './sim/ship.js'
import { hideWrapForLerp, wrap } from './sim/arena.js'
import { createCanvas } from './render/canvas.js'
import {
  createStarfield,
  drawBackground,
  drawGrid,
  drawHud,
  drawShip,
  drawStarfield,
  interpolateShip,
} from './render/draw.js'

const input = createInput(window)
const ship = createShip()
let previous = cloneShip(ship)
let stars = []

const { ctx, size } = createCanvas(document.querySelector('#game'), {
  onResize({ w, h }) {
    wrap(ship, w, h)
    stars = createStarfield(w, h)
  },
})

ship.x = size.w / 2
ship.y = size.h / 2
previous = cloneShip(ship)

function simulate(dt) {
  previous = cloneShip(ship)
  integrate(ship, input, dt)
  wrap(ship, size.w, size.h)
  hideWrapForLerp(previous, ship, size.w, size.h)
  input.consume()
}

function render(alpha, stats) {
  drawBackground(ctx, size.w, size.h)
  drawGrid(ctx, size.w, size.h)
  drawStarfield(ctx, stars)
  drawShip(ctx, interpolateShip(previous, ship, alpha))
  drawHud(ctx, stats)
}

const loop = createLoop({ simulate, render })
loop.start()

window.addEventListener('keydown', (e) => {
  if (e.code !== 'Space') return
  e.preventDefault()
  if (loop.isRunning()) loop.stop()
  else loop.start()
})
