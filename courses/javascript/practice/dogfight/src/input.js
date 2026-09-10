const GAME_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'Space',
])

/**
 * Клавіатура як замикання: `down` і `pressed` ніхто зовні не бачить.
 * API — isDown / justPressed / consume / destroy.
 *
 * justPressed = клавіша стала натиснутою саме з минулого consume().
 * OS шле повторні keydown, поки клавіша затиснута — e.repeat ігноруємо,
 * інакше "щойно натиснули" спрацює десятки разів на секунду.
 *
 * consume() треба викликати в кінці кроку симуляції: інакше justPressed
 * лишиться true назавжди.
 *
 * destroy() знімає слухачі. На закритті вкладки це не потрібно — браузер
 * і так викидає сторінку. Потрібно, коли сторінка лишається, а input ні:
 * вихід з матчу, тести, повторний createInput(). removeEventListener працює
 * лише з тією самою функцією, що й add — тому onKeyDown не анонімний.
 */
export function createInput(target) {
  const down = new Set()
  const pressed = new Set()

  function onKeyDown(e) {
    if (GAME_KEYS.has(e.code)) e.preventDefault()
    if (e.repeat) return
    if (!down.has(e.code)) pressed.add(e.code)
    down.add(e.code)
  }

  function onKeyUp(e) {
    if (GAME_KEYS.has(e.code)) e.preventDefault()
    down.delete(e.code)
    pressed.delete(e.code)
  }

  function onBlur() {
    down.clear()
    pressed.clear()
  }

  target.addEventListener('keydown', onKeyDown)
  target.addEventListener('keyup', onKeyUp)
  target.addEventListener('blur', onBlur)

  return {
    isDown: (code) => down.has(code),
    justPressed: (code) => pressed.has(code),
    consume() {
      pressed.clear()
    },
    destroy() {
      target.removeEventListener('keydown', onKeyDown)
      target.removeEventListener('keyup', onKeyUp)
      target.removeEventListener('blur', onBlur)
      down.clear()
      pressed.clear()
    },
  }
}
