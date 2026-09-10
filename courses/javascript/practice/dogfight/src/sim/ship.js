// Підкрутка "на відчуття". Не фізика ракет, а щоб корабель слухався.
// ROTATE_SPEED 3.6 — повний оберт ~1.7 с: можна цілитись, не крутиться як дзиґа.
// THRUST 520 — розгін відчутний за пів секунди.
// DRAG 1.15 — без газу швидко зупиняється; інакше важко прицілитись.
// MAX_SPEED 380 — не вилітає за межі реакції на 60 Hz кроці.
export const ROTATE_SPEED = 3.6
export const THRUST = 520
export const DRAG = 1.15
export const MAX_SPEED = 380

export function createShip({ x = 0, y = 0, angle = -Math.PI / 2 } = {}) {
  return { x, y, vx: 0, vy: 0, angle, thrust: 0 }
}

export function cloneShip(ship) {
  return {
    x: ship.x,
    y: ship.y,
    vx: ship.vx,
    vy: ship.vy,
    angle: ship.angle,
    thrust: ship.thrust,
  }
}

export function integrate(ship, input, dt) {
  const left = input.isDown('ArrowLeft') || input.isDown('KeyA')
  const right = input.isDown('ArrowRight') || input.isDown('KeyD')
  const thrusting = input.isDown('ArrowUp') || input.isDown('KeyW')

  if (left) ship.angle -= ROTATE_SPEED * dt
  if (right) ship.angle += ROTATE_SPEED * dt

  ship.thrust = thrusting ? THRUST : 0
  if (thrusting) {
    ship.vx += Math.cos(ship.angle) * THRUST * dt
    ship.vy += Math.sin(ship.angle) * THRUST * dt
  }

  const damp = Math.exp(-DRAG * dt)
  ship.vx *= damp
  ship.vy *= damp

  const speed = Math.hypot(ship.vx, ship.vy)
  if (speed > MAX_SPEED) {
    const scale = MAX_SPEED / speed
    ship.vx *= scale
    ship.vy *= scale
  }

  ship.x += ship.vx * dt
  ship.y += ship.vy * dt
}
