# Notes 07 — V8, пам’ять, тести

Поруч із лабою: [lab-07-engine-performance-testing.md](lab-07-engine-performance-testing.md).

DevTools (Performance, Memory) + термінал. Цифри записуй *до* оптимізації. Питання «чому гальмує» на співбесіді часто зводяться до GC і форм об’єктів.

---

## Ідея

V8: парсить → байткод → за гарячими функціями JIT. Об’єкти з однаковою формою полів — **hidden class**; додав `.z` посеред масиву — поліморфізм, повільніше. GC зупиняє світ: у грі це hitch. Другий потік JS у вкладці — лише **Worker** (Lab 1: головний потік один).

Тести (Vitest, property tests, Playwright) — щоб рефакторинг pooling не зламав фізику.

---

## 1. Deopt на очах

```bash
node --allow-natives-syntax -e "function add(a,b){return a+b}; for(let i=0;i<1e6;i++) add(i,1); %OptimizeFunctionOnNextCall(add); add(1,2); console.log(%GetOptimizationStatus(add)); add('a','b'); console.log(%GetOptimizationStatus(add))"
```

**Очікуй:** статус зміниться після `add('a','b')` — функцію деоптимізували (число + рядок). Розбір бітів: пошукай `GetOptimizationStatus bits`.

---

## 2. Форма об’єктів vs TypedArray

```js
const n = 1e6
const a = Array.from({ length: n }, (_, i) => ({ x: i, y: i }))
const b = Array.from({ length: n }, (_, i) =>
  i % 10 === 0 ? { x: i, y: i, z: 0 } : { x: i, y: i },
)
function sumX(arr) {
  let s = 0
  for (let i = 0; i < arr.length; i++) s += arr[i].x
  return s
}
console.time('mono')
sumX(a)
console.timeEnd('mono')
console.time('poly')
sumX(b)
console.timeEnd('poly')
```

**Очікуй:** `poly` повільніший. Далі ті самі `x` у `Float32Array` — зазвичай ще швидше і без об’єктів для GC.

---

## 3. Профіль гри

DevTools → Performance → 10 с польоту. Знайди жовті/сірі блоки GC. Memory → allocation — хто алокує (кулі?). Запиши **до** pooling.

---

## 4. Transfer vs clone у Worker

```js
const w = new Worker(URL.createObjectURL(new Blob(['onmessage=e=>postMessage(e.data)'])))
function once(buf, transfer) {
  return new Promise((res) => {
    w.onmessage = () => res({ left: buf.byteLength, ms: performance.now() - t })
    const t = performance.now()
    transfer ? w.postMessage(buf, [buf]) : w.postMessage(buf)
  })
}
const a = new ArrayBuffer(50 * 1024 * 1024)
console.log(await once(a, false))
const b = new ArrayBuffer(50 * 1024 * 1024)
console.log(await once(b, true))
```

**Очікуй:** після transfer у відправника `byteLength === 0`; clone лишає буфер і копіює 50 MB.

---

## 5. Property test

```js
// vitest + fast-check у проєкті лаби
// fc.assert(fc.property(fc.float(), x => Math.fround(x) === x))
```

`float` (32) часто проходить; `fc.double()` — ні. Прочитай *shrunk* приклад: дріб, який не є float32.

---

## У проєкті

Спочатку тест на `integrate` і колізії, потім pool куль, потім (якщо треба) worker. Без цифр з Performance оптимізація — ворожіння.

---

## На співбесіді

- Що таке hidden class / shape. Чому додати поле «іноді» в об’єкти масиву дорого.
- Чому GC дає hitch у грі. Коли object pool має сенс, а коли ні.
- Main thread vs Worker. Що можна перенести, що ні (DOM).
- Як би ти довів, що рефакторинг не зламав фізику (тест, не «ну я пограв»).
