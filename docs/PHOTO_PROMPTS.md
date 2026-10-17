# Промты для фото сайта Blind Barber (для Codex)

Скопируйте весь файл в Codex как задачу. Codex должен сгенерировать каждое изображение
и сохранить его **точно по указанному пути** внутри `frontend/assets/img/`.
Сайт уже ссылается на эти файлы: пока фото нет, вместо него видна тёмная подложка с надписью BLIND BARBER.

---

## Задача для Codex

> Сгенерируй изображения для сайта барбершопа по списку ниже, используя модель генерации изображений
> в максимальном качестве (`quality: high`). Для каждого пункта:
> 1. Возьми общий стиль (раздел «Общий стиль») и добавь к нему промт пункта.
> 2. Размер — как в колонке «Размер». Формат: `.jpg` — обычное фото; `.png` — **прозрачный фон**
>    (`background: transparent`, только объект с чистыми краями, без тени на фоне).
> 3. Сохрани файл по пути из колонки «Путь» (относительно `frontend/assets/img/`). Имена не менять.
> 4. JPG сжимай до качества ~85, чтобы файл был не больше 600 КБ; PNG — оптимизируй без потери альфа-канала.
> 5. На изображениях не должно быть текста, логотипов, водяных знаков (кроме надписей на товарах, где это указано).

---

## Общий стиль (добавлять в каждый промт)

```
Photorealistic premium editorial photography for a luxury men's barbershop brand.
Dark, moody low-key lighting, deep rich blacks, warm amber and copper accent light (#C08A5B),
muted desaturated palette with warm brown undertones, cinematic contrast, soft film grain,
shallow depth of field, shot on full-frame camera, 50mm–85mm lens, ultra detailed, sharp focus on subject.
No text, no logos, no watermarks, no extra people unless specified.
```

Для PNG-слоёв дополнительно:

```
Isolated subject on a fully transparent background (PNG with alpha channel), clean precise edges,
no ground shadow, no background elements, lit with the same warm side light as the scene.
```

---

## 1. Главные многослойные сцены (самое важное)

Каждый главный экран собран из слоёв: **фон** (`bg.jpg`) + **элементы** (`.png` с прозрачностью).
Слои двигаются с разной скоростью (параллакс), поэтому элементы должны быть отдельными файлами,
а свет и перспектива — совпадать с фоном.

### 1.1 Главная страница — `layers/home/`

| Путь | Размер | Промт |
|---|---|---|
| `layers/home/bg.jpg` | 2560×1440 | Wide interior of an empty upscale barbershop at night, no people. Black walls, dark wood and brass details, row of vintage mirrors with warm amber lamps, shelves with dark glass bottles, slightly out of focus (depth of field). Left half of the frame is very dark and calm (space for headline text), the right half has the warm glowing lights. Eye-level camera, straight perspective. |
| `layers/home/man.png` | 1600×2000, PNG | Stylish bearded man about 30 years old sitting in a black leather barber chair, wearing a black barber cape, one hand running through his freshly cut textured hair, confident calm expression, looking to the right, three-quarter view, watch on wrist, tattoos on forearm. Upper body and chair visible, framed from the waist up. Warm side light from the right, rim light on hair and beard. Transparent background. |
| `layers/home/haze.png` | 2560×1440 | Soft atmospheric haze and thin drifting smoke with subtle warm light rays coming from the upper right, on a **pure black background** (black will be removed by screen blending). No objects, only light and smoke. |

### 1.2 Промо магазина (главная + страница магазина) — `layers/shop/`

| Путь | Размер | Промт |
|---|---|---|
| `layers/shop/bg.jpg` | 2400×1200 | Dark polished black marble pedestal/shelf in front of a dark textured wall, warm soft spotlight from the upper right, empty surface on the right two-thirds where products will be placed, left side falls into deep shadow. Product photography studio set, no products. |
| `layers/shop/bottle.png` | 900×1600, PNG | Matte black cylindrical pump bottle of men's hair product with minimal white serif label "HARD WAX" and small text "MATTE FINISH", premium cosmetic packaging, front view, slight reflection of warm light on the edge. Transparent background. |
| `layers/shop/jar.png` | 1000×800, PNG | Low wide matte black jar with black lid, minimal light grey label "MATTE PASTE", premium men's styling product, front three-quarter view, soft warm highlight. Transparent background. |

### 1.3 Страница «О нас» — `layers/about/`

| Путь | Размер | Промт |
|---|---|---|
| `layers/about/bg.jpg` | 2560×1440 | Dark atmospheric background of a classic barbershop: blurred bokeh of warm lamps and mirrors, dark leather and wood, very dark left side, gentle warm glow on the right. No people. |
| `layers/about/portrait.png` | 1400×1800, PNG | Distinguished gentleman around 55 years old with neatly groomed grey beard and swept-back grey hair, wearing a dark tailored suit and white shirt, thoughtful pose with hand near chin, looking to the left, black and white feel with slight warm tone, dramatic side light. Framed from the chest up. Transparent background. |

### 1.4 Вход / регистрация — `layers/booking/`

| Путь | Размер | Промт |
|---|---|---|
| `layers/booking/bg.jpg` | 1600×2000 | Vertical shot of a dark luxury barbershop interior: tall mirror with warm wall lamps, marble counter, shelves with amber glass bottles, deep shadows, empty space in the lower half for a barber chair. No people. |
| `layers/booking/chair.png` | 1400×1600, PNG | Vintage black leather barber chair with chrome and dark metal details, three-quarter view, slightly worn premium leather with warm highlights. Full chair visible. Transparent background. |
| `layers/booking/tools.png` | 1200×600, PNG | Barber tools neatly laid out: steel scissors, straight razor with dark wooden handle, black comb and a shaving brush on a small dark leather tray, top-down three-quarter angle. Transparent background. |

---

## 2. Фото страниц

| Путь | Размер | Промт |
|---|---|---|
| `about/teaser.jpg` | 1200×1000 | Close-up of a barber's hands doing a precise skin fade with a clipper on a client's head, comb in other hand, dark background, warm side light, hair particles visible in the light. |
| `about/story.jpg` | 1500×1200 | Small cozy barbershop with a single vintage chair in early morning light, warm sun through a window, dark wood, mirrors, coffee cup on the counter — the place where the story began. |

---

## 3. Барбершопы — `shops/` (6 заведений × 3 фото, 1600×1200)

Фото 1 — общий вид зала (обложка), фото 2 — рабочее место мастера крупнее, фото 3 — деталь атмосферы.
Людей нет или они размыты на заднем плане.

| Путь | Промт |
|---|---|
| `shops/the-cut-1.jpg` | Wide interior of "The Cut" barbershop: row of black leather barber chairs, large mirrors with warm round lamps, dark walls, polished concrete floor, evening atmosphere. |
| `shops/the-cut-2.jpg` | Barber workstation at The Cut: leather chair, mirror, marble counter with clippers, combs and products, warm lamp light. |
| `shops/the-cut-3.jpg` | Waiting lounge of The Cut: leather sofa, coffee table with espresso cups and magazines, warm dim light, plants. |
| `shops/gentlemen-1.jpg` | Classic English-style barbershop "Gentlemen": dark wood panelling, green leather details, vintage chairs, brass lamps, framed old photos on walls. |
| `shops/gentlemen-2.jpg` | Hot towel and straight razor shaving station: vintage chair reclined, steaming towels, shaving bowl and brush on wooden counter. |
| `shops/gentlemen-3.jpg` | Wooden shelf with antique barber tools, shaving brushes, glass bottles of aftershave, warm brass lamp. |
| `shops/blade-1.jpg` | Industrial modern barbershop "Blade": raw concrete walls, black metal frames, exposed ceiling, linear LED and warm spotlights, black chairs in a row. |
| `shops/blade-2.jpg` | Workstation with black metal mirror frame, professional clippers lined up on a concrete counter, cables neatly organised, moody light. |
| `shops/blade-3.jpg` | Detail: vinyl record player and speakers on a metal shelf next to hair products in a dark industrial barbershop. |
| `shops/chapter-1.jpg` | Small intimate barbershop "Chapter" with four chairs, warm wooden floor, bookshelves, soft warm lighting, calm and cozy. |
| `shops/chapter-2.jpg` | Single barber chair in front of an arched mirror, small wooden console with neatly arranged tools. |
| `shops/chapter-3.jpg` | Reading corner in the barbershop: armchair, shelves with books and grooming products, warm lamp. |
| `shops/old-fox-1.jpg` | Flagship barbershop "Old Fox": dark wood, vintage leather chairs, long mirrors, and a small bar with bottles in the back, amber lighting. |
| `shops/old-fox-2.jpg` | Bar counter inside the barbershop: crafted drinks bottles, glasses, warm backlit shelves, bokeh. |
| `shops/old-fox-3.jpg` | Vintage barber chair detail with brass footrest and worn leather, dramatic light. |
| `shops/blind-barber-1.jpg` | Classic city-centre barbershop "Blind Barber": black and wood interior, three chairs, big windows with evening city lights outside, warm interior lamps. |
| `shops/blind-barber-2.jpg` | Barber's mirror station with clippers, trimmer, neck brush and products, warm light, shallow depth of field. |
| `shops/blind-barber-3.jpg` | Shelf with branded black product bottles and jars (no readable text), coffee machine, warm cozy detail. |

---

## 4. Услуги — `services/` (1200×1200, квадрат)

Чёрно-белая или почти монохромная съёмка с лёгким тёплым тоном, клиент крупным планом, тёмный фон.

| Путь | Промт |
|---|---|
| `services/haircut.jpg` | Side profile of a man with a fresh classic short haircut, neat side part, dark background, monochrome warm tone. |
| `services/haircut-beard.jpg` | Man with fresh haircut and perfectly shaped full beard, three-quarter view, confident look, dark background. |
| `services/beard.jpg` | Close-up of a barber trimming and shaping a dense beard with scissors and comb, dark background. |
| `services/fade.jpg` | Back-side view of a man's head with a perfect skin fade transitioning to textured top, crisp line-up. |
| `services/grey-blending.jpg` | Mature man around 45 with salt-and-pepper hair and beard naturally blended, refined look, dark background. |
| `services/royal-shave.jpg` | Classic straight razor shave: hot towel, shaving foam on cheek, barber's hand with razor, steam, warm light. |
| `services/kids.jpg` | Boy around 8 years old smiling in a barber chair with a neat short haircut, barber cape, warm friendly light. |
| `services/styling.jpg` | Man's hair being styled with a comb and matte paste into a textured quiff, close-up from the side. |

---

## 5. Мастера — `masters/` (1200×1500, портрет 4:5)

Портрет мастера в рабочей одежде (чёрная футболка/рубашка, фартук), тёмный фон барбершопа, взгляд в камеру или чуть в сторону.

| Путь | Мастер | Промт |
|---|---|---|
| `masters/master-1.jpg` | Алексей, топ-барбер, 8 лет | Confident barber around 32 with short textured hair and well-groomed beard, black apron, arms crossed, tattoos on forearms. |
| `masters/master-2.jpg` | Данияр, барбер, 4 года | Young Kazakh barber around 25, sharp skin fade haircut, black t-shirt, holding clippers, friendly smile. |
| `masters/master-3.jpg` | Тимур, арт-директор, 10 лет | Experienced Central Asian barber around 38, classic side part, trimmed beard, white shirt with rolled sleeves and leather apron. |
| `masters/master-4.jpg` | Руслан, барбер, 5 лет | Barber around 28 with pompadour hairstyle and light stubble, black shirt, holding a comb and scissors. |
| `masters/master-5.jpg` | Арман, топ-барбер, 7 лет | Kazakh barber around 30, modern crop haircut, short beard, black hoodie under apron, serious confident look. |
| `masters/master-6.jpg` | Максим, барбер, 3 года | Young barber around 23, curly hair on top with fade, clean-shaven, black t-shirt, warm smile. |
| `masters/master-7.jpg` | Ерлан, топ-барбер, 9 лет | Kazakh barber around 36, slicked-back hair, full well-shaped beard, dark denim apron, calm and wise look. |
| `masters/master-8.jpg` | Санжар, барбер, 4 года | Kazakh barber around 26, textured fringe, light moustache, black shirt, holding a hair dryer. |
| `masters/master-9.jpg` | Нурлан, топ-барбер, 8 лет | Kazakh barber around 34, short neat haircut with a touch of grey, trimmed beard, black apron over grey shirt. |
| `masters/master-10.jpg` | Артём, барбер, 5 лет | Barber around 27 with medium-length swept hair, light beard, black t-shirt, tattoos, relaxed pose. |
| `masters/master-11.jpg` | Дмитрий, топ-барбер, 7 лет | Barber around 31 with crisp fade and full beard, black apron, holding straight razor, confident. |
| `masters/master-12.jpg` | Айдос, барбер, 3 года | Young Kazakh barber around 22, buzz cut with line-up, clean-shaven, black t-shirt, friendly. |

---

## 6. Работы мастеров — `works/` (1200×1200)

Результат стрижки крупным планом, клиент без лица или в профиль, тёмный фон.

| Путь | Промт |
|---|---|
| `works/work-1.jpg` | Mid skin fade with textured crop on top, back three-quarter view. |
| `works/work-2.jpg` | Classic gentleman's side part with clean taper, side profile. |
| `works/work-3.jpg` | Full beard sculpted with sharp cheek lines and neat moustache, close-up. |
| `works/work-4.jpg` | Textured quiff with low fade, side profile. |
| `works/work-5.jpg` | Buzz cut with sharp line-up and hard part, back view. |
| `works/work-6.jpg` | Slicked-back undercut with shine, side profile. |
| `works/work-7.jpg` | Curly top with drop fade, three-quarter view. |
| `works/work-8.jpg` | Short French crop with blunt fringe and skin fade. |
| `works/work-9.jpg` | Grey hair blending on a mature man, natural look, side view. |

---

## 7. Товары магазина — `products/` (1200×1200)

Предметная съёмка на **светлом тёплом сером бесшовном фоне** (#E4DFD7), мягкая тень, флакон по центру,
премиальная минималистичная упаковка чёрного цвета с белой надписью. Надписи на упаковке — разрешены.

| Путь | Промт |
|---|---|
| `products/shampoo.jpg` | Tall matte black bottle with pump, white minimal label "SHAMPOO · BLIND BARBER LAB · 250 ml". |
| `products/conditioner.jpg` | Matte black squeeze tube standing on its cap, white label "CONDITIONER · BLIND BARBER LAB". |
| `products/matte-paste.jpg` | Wide matte black jar with lid, label "MATTE PASTE · STRONG HOLD · NATURAL FINISH · 100 ml". |
| `products/hard-wax.jpg` | Matte black jar, label "HARD WAX · MAXIMUM HOLD", lid slightly open showing wax texture. |
| `products/texture-powder.jpg` | Small matte black shaker bottle, label "TEXTURE POWDER", some white powder scattered nearby. |
| `products/pomade.jpg` | Round dark brown tin with embossed lid, label "POMADE · NORTHWOOD", classic style. |
| `products/beard-oil.jpg` | Amber glass dropper bottle with black cap, black label "BEARD OIL · 30 ml", drop of oil on the surface. |
| `products/beard-balm.jpg` | Small dark tin open showing creamy balm, label "BEARD BALM · NORTHWOOD". |
| `products/comb.jpg` | Black carbon barber comb with fine and wide teeth, lying diagonally, top view. |
| `products/shaving-brush.jpg` | Shaving brush with dense dark synthetic bristles and black resin handle, standing upright. |

---

## Итог

- Слоистые главные сцены: **11 файлов** (4 сцены).
- Фото страниц: 2, барбершопы: 18, услуги: 8, мастера: 12, работы: 9, товары: 10.
- Всего: **70 изображений**.

После генерации просто обновите страницу сайта — фото подхватятся автоматически.
