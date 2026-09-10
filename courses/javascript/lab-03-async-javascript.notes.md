# Notes 03 — Promises і `async`/`await`

Поруч із лабою: [lab-03-async-javascript.md](lab-03-async-javascript.md).

Консоль Chrome. Це друга половина event loop з Lab 1: реакції промісів — **мікрозадачі**. На співбесіді майже завжди просять порядок логів з `then` / `await` / `setTimeout`.

---

## Ідея

Promise — значення, якого ще немає: pending → fulfilled або rejected, **один раз**. `.then` завжди асинхронний, навіть якщо проміс уже готовий. `async`/`await` — той самий механізм, зручніший синтаксис: після `await` продовження йде як мікрозадача.

У грі не можна `while (!image.complete) {}` — це Lab 1. Треба чекати без блокування: спрайти, звук, лобі.

---

## 1. Порядок: мікрозадача vs лог

```js
Promise.resolve(1).then(console.log)
console.log(2)
```

**Очікуй:** `2`, потім `1`.

Додай таймер і прогноз повного порядку:

```js
setTimeout(() => console.log(4), 0)
Promise.resolve(1).then(() => console.log(1))
console.log(2)
```

**Очікуй:** `2`, `1`, `4`.

---

## 2. `fetch` 404 — це fulfill, не reject

```js
fetch('https://httpbin.org/status/404').then((r) =>
  console.log('ok', r.ok, 'status', r.status),
)
```

**Очікуй:** проміс **виконався**, `ok false`, `status 404`. Мережа відбулась. Reject — коли запит не вдався (немає хоста, abort). HTTP-помилка — перевіряй `r.ok` сам.

---

## 3. Послідовно vs `Promise.all`

```js
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

console.time('seq')
await wait(1000)
await wait(1000)
console.timeEnd('seq')

console.time('all')
await Promise.all([wait(1000), wait(1000)])
console.timeEnd('all')
```

Вставляй у консоль на сторінці, або в `async` IIFE. **Очікуй:** seq ~2000 мс, all ~1000 мс. Завантаження спрайтів у грі — `all` (або `allSettled`, якщо один файл може відвалитись).

---

## 4. Скасування

```js
const c = new AbortController()
fetch('https://httpbin.org/delay/5', { signal: c.signal }).catch((e) =>
  console.log(e.name),
)
c.abort()
```

**Очікуй:** `AbortError`. Далі спробуй `AbortSignal.timeout(1000)` замість ручного abort.

Без `.catch` rejected promise у браузері дає `unhandledrejection`; у Node (Lab 4) часто вбиває процес.

```js
window.addEventListener('unhandledrejection', (e) => {
  console.log('unhandled', e.reason)
  e.preventDefault()
})
Promise.reject(new Error('x'))
```

---

## У проєкті

Екран завантаження: чекай пак ассетів через комбінатори, показуй прогрес. Кнопка «вийти з лобі» — `abort()`, щоб відповідь не приїхала «з того світу» і не зламала стан.

---

## На співбесіді

- `Promise.resolve().then(log); console.log(2)` — порядок і чому.
- `async`/`await` — це цукор над промісами, продовження після `await` є мікрозадачею.
- Чому `fetch` на 404 **не** reject? Де тоді обробляти HTTP-помилку?
- Навіщо `AbortController`. Що таке unhandled rejection.
